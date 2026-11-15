import type { Photo } from './types.ts';
import { PhotoStatus } from './types.ts';
import { peopleOfPhoto } from './peopleRegistry.ts';
import { train, predict, projectEmbedding, embeddingWeights, emptyModel, VISUAL, type Model, type Quality, type TrainingRow } from './autopilotModel.ts';

// Autopilot: learns from the user's decisions (photos deleted vs photos kept) which photos they
// usually throw away, and proposes them for selection. Everything stays on the device: decisions
// are stored in IndexedDB and a small model (services/autopilotModel.ts) is retrained in a worker
// after each change. It never deletes anything itself, it only selects, like the manual rules.

export type DecisionSource = 'delete' | 'keep' | 'correction';

export interface AutopilotExample {
  id: string; // photo id (its path): the latest decision on a photo replaces the previous one
  label: 0 | 1; // 1: the user deleted it, 0: the user kept it
  source: DecisionSource;
  features: Record<string, number>;
  vec?: Float32Array; // what the photo looks like: its embedding, projected (absent before v1.21)
  at: number;
}

export interface LearnedRule {
  feature: string;
  weight: number;
  action: 'delete' | 'keep';
  deleted: number; // examples with this feature the user deleted
  kept: number; // examples with this feature the user kept
}

export interface AutopilotState {
  loaded: boolean;
  total: number;
  deleted: number;
  kept: number;
  ready: boolean; // enough examples of both kinds to make proposals
  /** The model predicts decisions it has not seen well enough to make proposals */
  reliable: boolean;
  /** Self-check on past decisions (see autopilotModel.ts), null before the first training */
  quality: Quality | null;
  rules: LearnedRule[];
  trainedAt?: number;
}

export interface AutopilotMatch {
  score: number; // 0-100, probability the user would delete it
  features: string[]; // the main reasons, strongest first
}

export const MIN_EXAMPLES = 20;
export const MIN_PER_CLASS = 5;
export const DEFAULT_THRESHOLD = 85;
const MAX_EXAMPLES = 5000;
const MIN_RULE_SUPPORT = 3;
const RULE_WEIGHT = 0.5;
const MAX_RULES = 30;
// Below this, the model orders deleted and kept photos hardly better than chance: it stays quiet
export const MIN_AUC = 0.65;
// Taking a photo out of a selection is a deliberate "you are wrong": it counts double
const CORRECTION_WEIGHT = 2;
const BLUR_FULL_AT = Math.log(1 + 1000);

// --- Features -------------------------------------------------------------------------------

const DAY = 24 * 3600 * 1000;

const slug = (s: string) => s.trim().toLowerCase();

/** Every piece of information already computed on the photo, as sparse numeric features. */
export function extractFeatures(photo: Photo, now: number = Date.now()): Record<string, number> {
  const f: Record<string, number> = {};
  const put = (key: string, value = 1) => { f[key] = Math.max(f[key] ?? 0, value); };

  for (const c of photo.classifications ?? []) put(`c:${slug(c.label)}`, c.score);
  for (const d of photo.detections ?? []) put(`d:${slug(d.label)}`, d.score);
  if ((photo.detections ?? []).length === 0) put('d:none');
  if (photo.status === PhotoStatus.UNCATEGORIZED) put('uncategorized');
  if (photo.customLabel) put(`custom:${slug(photo.customLabel)}`);

  if (photo.blurLevel) put(`blur:${photo.blurLevel}`);
  // The levels above move with the thresholds of the profile; this one is the measure itself
  // (0: very sharp, 1: no detail at all), so "a bit too soft for me" can be learned
  if (photo.blurRaw !== undefined) put('n:blur', 1 - Math.min(1, Math.log(1 + Math.max(0, photo.blurRaw)) / BLUR_FULL_AT));
  if (photo.isDuplicate) put('dup:redundant');
  else if (photo.duplicateGroupId) put('dup:best');

  // Where the photo comes from: folder and file name
  const parts = photo.id.split('/').filter(Boolean);
  const name = (parts.pop() ?? '').toLowerCase();
  const folder = parts.length > 0 ? slug(parts[parts.length - 1]) : '';
  if (folder) put(`folder:${folder}`);
  const path = photo.id.toLowerCase();
  if (/screenshot|screen_?shot|capture d.?[ée]cran|scrnshot/.test(path)) put('src:screenshot');
  if (/whatsapp|-wa\d{3,}/.test(path)) put('src:whatsapp');
  if (/telegram|signal|messenger|snapchat|instagram|facebook/.test(path)) put('src:messaging');
  if (/download|t[ée]l[ée]chargement/.test(path)) put('src:download');
  if (/\.png$/.test(name)) put('ext:png');

  // File size and image shape
  const size = photo.source?.size ?? photo.metadata?.size;
  if (size) put(`size:${size < 200_000 ? 'tiny' : size < 1_000_000 ? 'small' : size < 4_000_000 ? 'medium' : 'large'}`);
  const w = photo.metadata?.width;
  const h = photo.metadata?.height;
  if (w && h) {
    const mp = (w * h) / 1e6;
    put(`res:${mp < 1 ? 'low' : mp < 4 ? 'mid' : 'high'}`);
    const ratio = Math.max(w, h) / Math.min(w, h);
    if (ratio >= 1.9) put('shape:elongated'); // phone screenshots, panoramas
    else if (ratio < 1.1) put('shape:square');
    put(h > w ? 'shape:portrait' : 'shape:landscape');
  }

  // Who is on it (people recognition, when on and the photo's faces were looked for)
  const people = peopleOfPhoto(photo.id);
  if (people) {
    put(`faces:${people.faces === 0 ? 'none' : people.faces === 1 ? 'one' : people.faces <= 3 ? 'few' : 'group'}`);
    for (const id of people.people) put(`person:${id}`);
  }

  // Age of the file
  const date = photo.source?.lastModified;
  if (date) {
    const days = (now - date) / DAY;
    put(`age:${days < 31 ? 'month' : days < 365 ? 'year' : days < 5 * 365 ? 'years' : 'old'}`);
  }
  return f;
}

// --- Model ----------------------------------------------------------------------------------

const toRow = (e: AutopilotExample): TrainingRow =>
  ({ label: e.label, weight: e.source === 'correction' ? CORRECTION_WEIGHT : 1, features: e.features, vec: e.vec });

/** The strongest weights, with how often the user deleted or kept photos having them. */
export function learnedRules(model: Model, examples: AutopilotExample[]): LearnedRule[] {
  const counts = new Map<string, { deleted: number; kept: number }>();
  const visual = { deleted: 0, kept: 0 };
  for (const e of examples) {
    if (e.vec) { if (e.label === 1) visual.deleted++; else visual.kept++; }
    for (const [k, v] of Object.entries(e.features)) {
      if (v < 0.2) continue; // a label predicted with a very low score says little
      const c = counts.get(k) ?? { deleted: 0, kept: 0 };
      if (e.label === 1) c.deleted++; else c.kept++;
      counts.set(k, c);
    }
  }
  const rules: LearnedRule[] = [];
  for (const [feature, raw] of model.weights) {
    const weight = raw * model.calibration.a;
    const c = counts.get(feature);
    if (feature.startsWith('n:') || !c || c.deleted + c.kept < MIN_RULE_SUPPORT || Math.abs(weight) < RULE_WEIGHT) continue;
    const action = weight > 0 ? 'delete' : 'keep';
    const agree = action === 'delete' ? c.deleted : c.kept;
    if (agree / (c.deleted + c.kept) < 0.6) continue;
    rules.push({ feature, weight, action, ...c });
  }
  rules.sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight));
  // What photos look like is not a rule one can read, but it is listed so it can be turned off
  if (model.visual) rules.unshift({ feature: VISUAL, weight: 0, action: 'delete', ...visual });
  return rules.slice(0, MAX_RULES);
}

export const isReady = (deleted: number, kept: number) =>
  deleted + kept >= MIN_EXAMPLES && deleted >= MIN_PER_CLASS && kept >= MIN_PER_CLASS;

// Training runs in a worker (a few hundred ms on a phone with a long history); without workers,
// or if it fails to start, it runs here.
type Trained = ReturnType<typeof train>;
let worker: Worker | null | undefined;
let jobId = 0;
const jobs = new Map<number, { rows: TrainingRow[]; ignored: Set<string>; resolve: (t: Trained) => void }>();

function trainInWorker(rows: TrainingRow[], ignored: Set<string>): Promise<Trained> {
  if (worker === undefined) {
    worker = null;
    if (typeof Worker !== 'undefined') {
      try {
        const created = new Worker(new URL('../workers/autopilot.worker.ts', import.meta.url), { type: 'module' });
        const runHere = () => {
          worker = null;
          created.terminate();
          for (const job of jobs.values()) job.resolve(train(job.rows, { ignored: job.ignored }));
          jobs.clear();
        };
        created.onmessage = (event: MessageEvent) => {
          const job = jobs.get(event.data.id);
          if (event.data.error || !job) return event.data.error ? runHere() : undefined;
          jobs.delete(event.data.id);
          job.resolve({ model: event.data.model, quality: event.data.quality });
        };
        created.onerror = runHere;
        worker = created;
      } catch { /* trained on this thread */ }
    }
  }
  if (!worker) return Promise.resolve(train(rows, { ignored }));
  return new Promise(resolve => {
    const id = ++jobId;
    jobs.set(id, { rows, ignored, resolve });
    worker!.postMessage({ id, rows, ignored });
  });
}

// --- Store (IndexedDB) and live state ------------------------------------------------------

const DB_NAME = 'pixo-autopilot';
const STORE = 'examples';
const examples = new Map<string, AutopilotExample>();
let ignoredFeatures = new Set<string>();
let model: Model = emptyModel();
const fastVisual = new Map<number, Float32Array | null>(); // the model's visual weights, per embedding length
let trainings = 0;
let state: AutopilotState = { loaded: false, total: 0, deleted: 0, kept: 0, ready: false, reliable: false, quality: null, rules: [] };
const listeners = new Set<() => void>();
let dbPromise: Promise<IDBDatabase> | null = null;
let trainTimer: ReturnType<typeof setTimeout> | null = null;

function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  dbPromise.catch(() => { dbPromise = null; });
  return dbPromise;
}

async function write(put: AutopilotExample[], remove: string[]) {
  if (put.length === 0 && remove.length === 0) return;
  try {
    const db = await openDb();
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    put.forEach(e => store.put(e));
    remove.forEach(id => store.delete(id));
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = tx.onabort = () => reject(tx.error);
    });
  } catch (error) {
    console.warn('Autopilot: could not save decisions', error);
  }
}

function emit() {
  listeners.forEach(l => l());
}

async function retrain() {
  trainTimer = null;
  const run = ++trainings;
  const all = [...examples.values()].sort((a, b) => a.at - b.at);
  const ignored = ignoredFeatures;
  const trained = await trainInWorker(all.map(toRow), ignored);
  if (run !== trainings) return; // a more recent training is on its way
  const deleted = all.filter(e => e.label === 1).length;
  const ready = isReady(deleted, all.length - deleted);
  model = trained.model;
  fastVisual.clear();
  state = {
    loaded: true,
    total: all.length,
    deleted,
    kept: all.length - deleted,
    ready,
    reliable: ready && trained.quality.tested > 0 && trained.quality.auc >= MIN_AUC,
    quality: trained.quality,
    rules: learnedRules(model, all).filter(r => !ignored.has(r.feature)),
    trainedAt: Date.now(),
  };
  emit();
}

function scheduleRetrain() {
  if (trainTimer) clearTimeout(trainTimer);
  trainTimer = setTimeout(retrain, 300);
}

let loadPromise: Promise<void> | null = null;
/** Loads the stored decisions once and trains the first model. */
export function initAutopilot(): Promise<void> {
  loadPromise ??= (async () => {
    try {
      const db = await openDb();
      const all = await new Promise<AutopilotExample[]>((resolve, reject) => {
        const request = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
        request.onsuccess = () => resolve(request.result as AutopilotExample[]);
        request.onerror = () => reject(request.error);
      });
      // Decisions made while loading are more recent: keep them
      for (const e of all) if (!examples.has(e.id)) examples.set(e.id, e);
    } catch (error) {
      console.warn('Autopilot: stored decisions unavailable', error);
    }
    await retrain();
  })();
  return loadPromise;
}

const canLearnFrom = (p: Photo) => p.status === PhotoStatus.ANALYZED || p.status === PhotoStatus.UNCATEGORIZED;

/** Records the user's decision on photos. Recorded whatever the toggle, so the autopilot is trained when turned on. */
export function recordDecisions(photos: Photo[], source: DecisionSource) {
  const now = Date.now();
  const put: AutopilotExample[] = [];
  for (const p of photos) {
    if (!canLearnFrom(p)) continue;
    const vec = p.embedding ? projectEmbedding(p.embedding) : undefined;
    const e: AutopilotExample = { id: p.id, label: source === 'delete' ? 1 : 0, source, features: extractFeatures(p, now), ...(vec ? { vec } : {}), at: now };
    examples.set(p.id, e);
    put.push(e);
  }
  const remove: string[] = [];
  if (examples.size > MAX_EXAMPLES) {
    const oldest = [...examples.values()].sort((a, b) => a.at - b.at).slice(0, examples.size - MAX_EXAMPLES);
    for (const e of oldest) { examples.delete(e.id); remove.push(e.id); }
  }
  if (put.length === 0) return;
  write(put, remove);
  scheduleRetrain();
}

/** Forgets a "kept" decision, when the user takes a photo back out of the kept ones. */
export function forgetKeep(photos: Photo[]) {
  const remove = photos.map(p => p.id).filter(id => examples.get(id)?.source === 'keep');
  if (remove.length === 0) return;
  remove.forEach(id => examples.delete(id));
  write([], remove);
  scheduleRetrain();
}

/**
 * Two people were merged in the People screen: past decisions about `fromId` now count for
 * `intoId`, so what the autopilot learned about either is kept.
 */
export function mergePersonFeature(fromId: string, intoId: string) {
  const from = `person:${fromId}`;
  const into = `person:${intoId}`;
  const put: AutopilotExample[] = [];
  for (const e of examples.values()) {
    if (!(from in e.features)) continue;
    const features = { ...e.features, [into]: Math.max(e.features[into] ?? 0, e.features[from]) };
    delete features[from];
    const updated = { ...e, features };
    examples.set(e.id, updated);
    put.push(updated);
  }
  if (put.length === 0) return;
  write(put, []);
  scheduleRetrain();
}

export async function resetAutopilot() {
  const remove = [...examples.keys()];
  examples.clear();
  await write([], remove);
  await retrain();
}

export function setIgnoredFeatures(features: string[] = []) {
  const next = new Set(features);
  if (next.size === ignoredFeatures.size && [...next].every(f => ignoredFeatures.has(f))) return;
  ignoredFeatures = next;
  if (state.loaded) scheduleRetrain();
}

/** The visual part of the score, straight from the photo's embedding (see embeddingWeights). */
function visualOf(photo: Photo): number {
  const embedding = photo.embedding;
  if (!model.visual || !embedding?.length) return 0;
  let weights = fastVisual.get(embedding.length);
  if (weights === undefined) fastVisual.set(embedding.length, weights = embeddingWeights(model, embedding.length));
  if (!weights) return 0;
  let dot = 0, squares = 0;
  for (let i = 0; i < embedding.length; i++) { dot += weights[i] * embedding[i]; squares += embedding[i] * embedding[i]; }
  return squares > 0 ? dot / Math.sqrt(squares) - model.visualOffset : 0;
}

/**
 * Whether the autopilot would select this photo: ready and reliable, not kept by the user, and a
 * probability of deletion at or above the threshold (0-100).
 */
export function autopilotMatch(photo: Photo, threshold: number = DEFAULT_THRESHOLD): AutopilotMatch | null {
  if (!state.reliable || photo.isSaved || photo.status !== PhotoStatus.ANALYZED) return null;
  if (examples.get(photo.id)?.label === 0) return null; // the user already said to keep it
  const { probability, contributions } = predict(model, extractFeatures(photo), visualOf(photo));
  const score = Math.round(probability * 100);
  if (score < threshold) return null;
  return { score, features: contributions.filter(([, c]) => c > 0.1).slice(0, 3).map(([k]) => k) };
}

/** For a threshold, what the self-check says the autopilot would have proposed among past decisions. */
export function backtest(quality: Quality, threshold: number): { deleted: number; kept: number; recall: number } {
  const t = Math.min(100, Math.max(0, Math.round(threshold)));
  const deleted = quality.deletedAbove[t];
  return { deleted, kept: quality.keptAbove[t], recall: quality.deletedAbove[0] ? deleted / quality.deletedAbove[0] : 0 };
}

export const getAutopilotState = () => state;

export function subscribeAutopilot(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
