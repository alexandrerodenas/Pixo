// Web Worker for CLIP zero-shot classification (Transformers.js / ONNX Runtime Web).
// The model and the ONNX wasm runtime are downloaded at first use and cached by the browser.

import { pipeline, env, RawImage } from '@huggingface/transformers';
import { CLIP_LABELS } from '../services/clipLabels.ts';

env.allowLocalModels = false;
// The wasm runtime is fetched from a CDN instead of being bundled, to keep the APK small.
if (env.backends.onnx.wasm) env.backends.onnx.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.31.0-dev.20260914-8d85527a0/dist/';

const MODEL = 'Xenova/clip-vit-base-patch32';

let classifier: any = null;
let initPromise: Promise<{ loadMs: number; downloadedBytes: number; device: string }> | null = null;

function initialize() {
  initPromise ??= (async () => {
    const start = performance.now();
    const files = new Map<string, number>();
    const progress_callback = (p: any) => {
      if (p.status === 'progress' && p.file && typeof p.total === 'number') files.set(p.file, p.total);
    };
    let device = 'webgpu';
    try {
      classifier = await pipeline('zero-shot-image-classification', MODEL, { device: 'webgpu', dtype: 'q8', progress_callback } as any);
    } catch {
      device = 'wasm';
      classifier = await pipeline('zero-shot-image-classification', MODEL, { device: 'wasm', dtype: 'q8', progress_callback } as any);
    }
    let downloadedBytes = 0;
    for (const total of files.values()) downloadedBytes += total;
    return { loadMs: Math.round(performance.now() - start), downloadedBytes, device };
  })().catch(error => {
    initPromise = null;
    throw error;
  });
  return initPromise;
}

self.onmessage = async (event: MessageEvent) => {
  const msg = event.data;
  try {
    if (msg.type === 'initialize') {
      self.postMessage({ type: 'initialized', ...(await initialize()) });
    } else if (msg.type === 'classify') {
      await initialize();
      const start = performance.now();
      const image = await RawImage.fromBlob(msg.file as Blob);
      const output = await classifier(image, CLIP_LABELS, { hypothesis_template: 'a photo of {}' });
      const classifications = (output as Array<{ label: string; score: number }>).slice(0, 5);
      self.postMessage({ type: 'result', photoId: msg.photoId, classifications, ms: Math.round(performance.now() - start) });
    }
  } catch (error) {
    self.postMessage({ type: 'error', photoId: msg?.photoId, error: error instanceof Error ? error.message : String(error) });
  }
};
