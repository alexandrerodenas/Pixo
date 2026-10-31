import type { Photo } from './types.ts';
import { PhotoStatus } from './types.ts';

// Autopilot: learns from the user's decisions (photos deleted vs photos kept) which photos they
// usually throw away, and proposes them for selection. Everything stays on the device: decisions
// are stored in IndexedDB and a small logistic regression is retrained in a few milliseconds after
// each change. It never deletes anything itself, it only selects, like the manual rules.

export type DecisionSource = 'delete' | 'keep' | 'correction';

export interface AutopilotExample {
  id: string; // photo id (its path): the latest decision on a photo replaces the previous one
  label: 0 | 1; // 1: the user deleted it, 0: the user kept it
  source: DecisionSource;
  features: Record<string, number>;
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

  // Age of the file
  const date = photo.source?.lastModified;
  if (date) {
    const days = (now - date) / DAY;
    put(`age:${days < 31 ? 'month' : days < 365 ? 'year' : days < 5 * 365 ? 'years' : 'old'}`);
  }
  return f;
}

// --- Model ----------------------------------------------------------------------------------

interface Model {
  bias: number;
  weights: Map<string, number>;
}

const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));

/**
 * Logistic regression trained by full-batch gradient descent with L2 regularisation.
 * Classes are re-weighted so that a user who deletes a lot does not bias every proposal.
 */
export function train(examples: AutopilotExample[], ignored: Set<string> = new Set(),
                      // fewer passes on large histories, so retraining stays around 200 ms on a phone
                      iterations = Math.round(Math.min(300, Math.max(80, 300_000 / Math.max(1, examples.length))))): Model {
  const weights = new Map<string, number>();
  let bias = 0;
  if (examples.length === 0) return { bias, weights };
  const positives = examples.filter(e => e.label === 1).length;
  const negatives = examples.length - positives;
  const wPos = positives ? examples.length / (2 * positives) : 1;
  const wNeg = negatives ? examples.length / (2 * negatives) : 1;
  const rows = examples.map(e => ({
    y: e.label,
    w: e.label === 1 ? wPos : wNeg,
    x: Object.entries(e.features).filter(([k]) => !ignored.has(k)),
  }));
  for (const r of rows) for (const [k] of r.x) weights.set(k, 0);

  const lr = 0.5;
  const l2 = 0.02;
  const n = rows.length;
  const grad = new Map<string, number>();
  for (let it = 0; it < iterations; it++) {
    grad.clear();
    let gBias = 0;
    for (const r of rows) {
      let z = bias;
      for (const [k, v] of r.x) z += weights.get(k)! * v;
      const err = (sigmoid(z) - r.y) * r.w;
      gBias += err;
      for (const [k, v] of r.x) grad.set(k, (grad.get(k) ?? 0) + err * v);
    }
    bias -= lr * gBias / n;
    for (const [k, w] of weights) weights.set(k, w - lr * ((grad.get(k) ?? 0) / n + l2 * w));
  }
  return { bias, weights };
}

export function predict(model: Model, features: Record<string, number>, ignored: Set<string> = new Set()): { probability: number; contributions: [string, number][] } {
  let z = model.bias;
  const contributions: [string, number][] = [];
  for (const [k, v] of Object.entries(features)) {
    if (ignored.has(k)) continue;
    const w = model.weights.get(k);
    if (w === undefined) continue;
    z += w * v;
    contributions.push([k, w * v]);
  }
  contributions.sort((a, b) => b[1] - a[1]);
  return { probability: sigmoid(z), contributions };
}

/** The strongest weights, with how often the user deleted or kept photos having them. */
export function learnedRules(model: Model, examples: AutopilotExample[]): LearnedRule[] {
  const counts = new Map<string, { deleted: number; kept: number }>();
  for (const e of examples) {
    for (const [k, v] of Object.entries(e.features)) {
      if (v < 0.2) continue; // a label predicted with a very low score says little
      const c = counts.get(k) ?? { deleted: 0, kept: 0 };
      if (e.label === 1) c.deleted++; else c.kept++;
      counts.set(k, c);
    }
  }
  const rules: LearnedRule[] = [];
  for (const [feature, weight] of model.weights) {
    const c = counts.get(feature);
    if (!c || c.deleted + c.kept < MIN_RULE_SUPPORT || Math.abs(weight) < RULE_WEIGHT) continue;
    const action = weight > 0 ? 'delete' : 'keep';
    const agree = action === 'delete' ? c.deleted : c.kept;
    if (agree / (c.deleted + c.kept) < 0.6) continue;
    rules.push({ feature, weight, action, ...c });
  }
  return rules.sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight)).slice(0, MAX_RULES);
}

export const isReady = (deleted: number, kept: number) =>
  deleted + kept >= MIN_EXAMPLES && deleted >= MIN_PER_CLASS && kept >= MIN_PER_CLASS;

// --- Store (IndexedDB) and live state ------------------------------------------------------

const DB_NAME = 'pixo-autopilot';
const STORE = 'examples';
const examples = new Map<string, AutopilotExample>();
let ignoredFeatures = new Set<string>();
let model: Model = { bias: 0, weights: new Map() };
let state: AutopilotState = { loaded: false, total: 0, deleted: 0, kept: 0, ready: false, rules: [] };
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

function retrain() {
  trainTimer = null;
  const all = [...examples.values()];
  const deleted = all.filter(e => e.label === 1).length;
  model = train(all, ignoredFeatures);
  state = {
    loaded: true,
    total: all.length,
    deleted,
    kept: all.length - deleted,
    ready: isReady(deleted, all.length - deleted),
    rules: learnedRules(model, all).filter(r => !ignoredFeatures.has(r.feature)),
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
    retrain();
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
    const e: AutopilotExample = { id: p.id, label: source === 'delete' ? 1 : 0, source, features: extractFeatures(p, now), at: now };
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

export async function resetAutopilot() {
  const remove = [...examples.keys()];
  examples.clear();
  await write([], remove);
  retrain();
}

export function setIgnoredFeatures(features: string[] = []) {
  const next = new Set(features);
  if (next.size === ignoredFeatures.size && [...next].every(f => ignoredFeatures.has(f))) return;
  ignoredFeatures = next;
  if (state.loaded) scheduleRetrain();
}

/**
 * Whether the autopilot would select this photo: ready, not kept by the user, and a probability
 * of deletion at or above the threshold (0-100).
 */
export function autopilotMatch(photo: Photo, threshold: number = DEFAULT_THRESHOLD): AutopilotMatch | null {
  if (!state.ready || photo.isSaved || photo.status !== PhotoStatus.ANALYZED) return null;
  if (examples.get(photo.id)?.label === 0) return null; // the user already said to keep it
  const { probability, contributions } = predict(model, extractFeatures(photo), ignoredFeatures);
  const score = Math.round(probability * 100);
  if (score < threshold) return null;
  return { score, features: contributions.filter(([, c]) => c > 0.1).slice(0, 3).map(([k]) => k) };
}

export const getAutopilotState = () => state;

export function subscribeAutopilot(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
