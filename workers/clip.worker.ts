// Web Worker for CLIP zero-shot classification (Transformers.js / ONNX Runtime Web).
// The model and the ONNX wasm runtime are downloaded at first use and cached by the browser.
// The label embeddings are computed once at load, so each photo only costs one image pass.

import { AutoTokenizer, AutoProcessor, CLIPTextModelWithProjection, CLIPVisionModelWithProjection, env, RawImage } from '@huggingface/transformers';
import { CLIP_LABELS, CLIP_OTHER_LABELS } from '../services/clipLabels.ts';

env.allowLocalModels = false;
// The wasm runtime is fetched from a CDN instead of being bundled, to keep the APK small.
if (env.backends.onnx.wasm) env.backends.onnx.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.31.0-dev.20260914-8d85527a0/dist/';

const MODEL = 'Xenova/clip-vit-base-patch32';
// Several phrasings per label, averaged: more robust than a single "a photo of ..."
const TEMPLATES = ['a photo of {}.', 'a picture showing {}.'];
// CLIP's learned temperature: similarity (cosine) is multiplied by this before the softmax
const LOGIT_SCALE = 100;
const TEXT_BATCH = 64;
const TOP_K = 5;

const ALL_LABELS = [...CLIP_LABELS, ...CLIP_OTHER_LABELS];
const OTHER_START = CLIP_LABELS.length;

let processor: any = null;
let visionModel: any = null;
let labelEmbeddings: Float32Array[] = [];
let initPromise: Promise<{ loadMs: number; downloadedBytes: number; device: string }> | null = null;

// Label embeddings are kept in IndexedDB: computing them takes a while on a phone, and they only
// change when the label list or the phrasings change.
const CACHE_DB = 'pixo-clip';
const CACHE_STORE = 'label-embeddings';

function cacheKey(): string {
  let hash = 0;
  for (const char of MODEL + TEMPLATES.join('|') + ALL_LABELS.join('|')) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return `${MODEL}:${ALL_LABELS.length}:${hash}`;
}

function openCache(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(CACHE_DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(CACHE_STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readCache(): Promise<Float32Array[] | null> {
  try {
    const db = await openCache();
    return await new Promise(resolve => {
      const request = db.transaction(CACHE_STORE).objectStore(CACHE_STORE).get(cacheKey());
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function writeCache(embeddings: Float32Array[]) {
  try {
    const db = await openCache();
    db.transaction(CACHE_STORE, 'readwrite').objectStore(CACHE_STORE).put(embeddings, cacheKey());
  } catch { /* not critical */ }
}

function normalize(vector: Float32Array): Float32Array {
  let norm = 0;
  for (let i = 0; i < vector.length; i++) norm += vector[i] * vector[i];
  norm = Math.sqrt(norm) || 1;
  const out = new Float32Array(vector.length);
  for (let i = 0; i < vector.length; i++) out[i] = vector[i] / norm;
  return out;
}

// Progress for the main thread (shown in the stats widget): model download, then label embeddings
let lastProgressAt = 0;
function reportProgress(phase: 'download' | 'labels', done: number, total: number, force = false) {
  const now = performance.now();
  if (!force && now - lastProgressAt < 200) return;
  lastProgressAt = now;
  self.postMessage({ type: 'progress', phase, done, total });
}

async function loadModels(device: 'webgpu' | 'wasm', progress_callback: (p: any) => void) {
  const options = { device, dtype: 'q8', progress_callback } as any;
  const [tokenizer, textModel, loadedProcessor, loadedVision] = await Promise.all([
    AutoTokenizer.from_pretrained(MODEL, { progress_callback } as any),
    CLIPTextModelWithProjection.from_pretrained(MODEL, options),
    AutoProcessor.from_pretrained(MODEL, { progress_callback } as any),
    CLIPVisionModelWithProjection.from_pretrained(MODEL, options),
  ]);
  processor = loadedProcessor;
  visionModel = loadedVision;

  const cached = await readCache();
  if (cached) {
    labelEmbeddings = cached;
    return;
  }

  // One embedding per label: the average of its phrasings
  const texts = ALL_LABELS.flatMap(label => TEMPLATES.map(template => template.replace('{}', label)));
  const rows: Float32Array[] = [];
  for (let i = 0; i < texts.length; i += TEXT_BATCH) {
    const inputs = tokenizer(texts.slice(i, i + TEXT_BATCH), { padding: true, truncation: true });
    const { text_embeds } = await textModel(inputs);
    const dim = text_embeds.dims[1];
    for (let r = 0; r < text_embeds.dims[0]; r++) {
      rows.push(normalize((text_embeds.data as Float32Array).slice(r * dim, (r + 1) * dim)));
    }
    reportProgress('labels', rows.length, texts.length);
  }
  labelEmbeddings = ALL_LABELS.map((_, labelIndex) => {
    const sum = new Float32Array(rows[0].length);
    for (let t = 0; t < TEMPLATES.length; t++) {
      const row = rows[labelIndex * TEMPLATES.length + t];
      for (let i = 0; i < sum.length; i++) sum[i] += row[i];
    }
    return normalize(sum);
  });
  writeCache(labelEmbeddings);
}

function initialize() {
  initPromise ??= (async () => {
    const start = performance.now();
    const files = new Map<string, number>();
    const loaded = new Map<string, number>();
    const progress_callback = (p: any) => {
      if (p.status === 'progress' && p.file && typeof p.total === 'number') {
        files.set(p.file, p.total);
        loaded.set(p.file, p.loaded ?? 0);
        let done = 0, total = 0;
        for (const [file, size] of files) { total += size; done += loaded.get(file) ?? 0; }
        reportProgress('download', done, total);
      }
    };
    // Phone WebViews rarely have WebGPU: go straight to wasm instead of failing a first attempt
    let device = 'wasm';
    if ((self.navigator as any).gpu) {
      try {
        await loadModels('webgpu', progress_callback);
        device = 'webgpu';
      } catch { /* falls back to wasm */ }
    }
    if (device === 'wasm') await loadModels('wasm', progress_callback);
    let downloadedBytes = 0;
    for (const total of files.values()) downloadedBytes += total;
    return { loadMs: Math.round(performance.now() - start), downloadedBytes, device };
  })().catch(error => {
    initPromise = null;
    throw error;
  });
  return initPromise;
}

async function classify(blob: Blob) {
  const image = await RawImage.fromBlob(blob);
  const { image_embeds } = await visionModel(await processor(image));
  const embedding = normalize((image_embeds.data as Float32Array).slice(0, image_embeds.dims[1]));

  // Softmax over every label, including the "other" ones that absorb photos matching nothing
  const logits = labelEmbeddings.map(label => {
    let dot = 0;
    for (let i = 0; i < embedding.length; i++) dot += embedding[i] * label[i];
    return dot * LOGIT_SCALE;
  });
  const max = Math.max(...logits);
  const exps = logits.map(l => Math.exp(l - max));
  const total = exps.reduce((a, b) => a + b, 0);

  const scored: Array<{ label: string; score: number }> = [];
  for (let i = 0; i < OTHER_START; i++) scored.push({ label: ALL_LABELS[i], score: exps[i] / total });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, TOP_K);
}

self.onmessage = async (event: MessageEvent) => {
  const msg = event.data;
  try {
    if (msg.type === 'initialize') {
      self.postMessage({ type: 'initialized', ...(await initialize()) });
    } else if (msg.type === 'classify') {
      await initialize();
      const start = performance.now();
      const classifications = await classify(msg.file as Blob);
      self.postMessage({ type: 'result', photoId: msg.photoId, classifications, ms: Math.round(performance.now() - start) });
    }
  } catch (error) {
    self.postMessage({ type: 'error', photoId: msg?.photoId, error: error instanceof Error ? error.message : String(error) });
  }
};
