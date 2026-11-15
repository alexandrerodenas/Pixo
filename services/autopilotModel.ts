// The maths of the autopilot, without DOM or storage, so it runs (and is tested) outside the app.
//
// A logistic regression over two kinds of inputs:
//  - named features (labels, objects, blur, origin of the file...): sparse and explainable;
//  - the visual embedding the analysis already computes for duplicate detection, squeezed to
//    VEC_DIM numbers by a fixed random projection (256 keeps nearly all of what 1024 tell). It lets the autopilot recognise "photos that
//    look like the ones I delete" even when no label describes them.
// The model checks itself by cross-validation on the user's own decisions: the scores it gives to
// photos it has not been trained on calibrate its probabilities, and tell whether it is reliable.

export const VEC_DIM = 256;
/** Name of the visual-similarity input in explanations and in the ignored list. */
export const VISUAL = 'vis:similar';

export interface TrainingRow {
  label: 0 | 1; // 1: deleted, 0: kept
  weight: number;
  features: Record<string, number>;
  vec?: Float32Array; // projected embedding (see projectEmbedding)
}

export interface Model {
  bias: number;
  weights: Map<string, number>;
  visual: Float32Array | null; // weights on the projected embedding
  visualOffset: number; // subtracted from the visual part (centring of the embeddings)
  calibration: { a: number; b: number }; // probability = sigmoid(a * logit + b)
}

export interface Quality {
  tested: number; // decisions scored by a model that had not seen them
  auc: number; // 0.5: no better than chance, 1: deleted photos always score above kept ones
  /** Among the tested decisions, how many score at or above each threshold (index: threshold 0-100) */
  deletedAbove: Uint32Array;
  keptAbove: Uint32Array;
}

export interface TrainOptions {
  ignored?: Set<string>;
  minSupport?: number; // a named feature seen in fewer decisions is left out
  l2?: number;
  l2Visual?: number;
  iterations?: number;
}

const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));

function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- Random projection ------------------------------------------------------------------------

const signsByDim = new Map<number, Int8Array>();

/** The fixed ±1 matrix (VEC_DIM rows) for embeddings of a given length: the same on every device. */
function projectionSigns(dim: number): Int8Array {
  let signs = signsByDim.get(dim);
  if (!signs) {
    const random = mulberry32(0x9E3779B9 ^ dim);
    signs = new Int8Array(VEC_DIM * dim);
    for (let i = 0; i < signs.length; i++) signs[i] = random() < 0.5 ? -1 : 1;
    signsByDim.set(dim, signs);
  }
  return signs;
}

const PROJECTION_SCALE = 1 / Math.sqrt(VEC_DIM);

function norm(embedding: ArrayLike<number>): number {
  let sum = 0;
  for (let i = 0; i < embedding.length; i++) sum += embedding[i] * embedding[i];
  return Math.sqrt(sum);
}

/** Embedding (any length) -> unit length -> VEC_DIM numbers that keep its distances to the others. */
export function projectEmbedding(embedding: ArrayLike<number>): Float32Array | undefined {
  const dim = embedding.length;
  const length = norm(embedding);
  if (!dim || !(length > 0)) return undefined;
  const signs = projectionSigns(dim);
  const out = new Float32Array(VEC_DIM);
  const scale = PROJECTION_SCALE / length;
  for (let j = 0, offset = 0; j < VEC_DIM; j++, offset += dim) {
    let sum = 0;
    for (let i = 0; i < dim; i++) sum += signs[offset + i] * embedding[i];
    out[j] = sum * scale;
  }
  return out;
}

/**
 * The visual weights brought back to the embedding's own space: scoring a photo then costs one
 * dot product over its embedding instead of a projection (VEC_DIM times more work).
 */
export function embeddingWeights(model: Model, dim: number): Float32Array | null {
  if (!model.visual) return null;
  const signs = projectionSigns(dim);
  const out = new Float32Array(dim);
  for (let j = 0, offset = 0; j < VEC_DIM; j++, offset += dim) {
    const w = model.visual[j] * PROJECTION_SCALE;
    if (w === 0) continue;
    for (let i = 0; i < dim; i++) out[i] += signs[offset + i] * w;
  }
  return out;
}

// --- Training set -----------------------------------------------------------------------------

interface Dataset {
  n: number;
  y: Uint8Array;
  weight: Float32Array;
  vocab: string[];
  ptr: Int32Array; // row i has its named features in [ptr[i], ptr[i + 1])
  col: Int32Array;
  val: Float32Array;
  dense: Float32Array | null; // n x VEC_DIM, centred and scaled; rows without embedding are zero
  mean: Float32Array;
  scale: number;
}

function buildDataset(rows: TrainingRow[], ignored: Set<string>, minSupport: number): Dataset {
  const n = rows.length;
  const support = new Map<string, number>();
  for (const r of rows) for (const k in r.features) if (!ignored.has(k)) support.set(k, (support.get(k) ?? 0) + 1);
  const vocab: string[] = [];
  const index = new Map<string, number>();
  for (const [k, count] of support) if (count >= minSupport) { index.set(k, vocab.length); vocab.push(k); }

  const y = new Uint8Array(n);
  const weight = new Float32Array(n);
  const ptr = new Int32Array(n + 1);
  const col: number[] = [];
  const val: number[] = [];
  rows.forEach((r, i) => {
    y[i] = r.label;
    weight[i] = r.weight;
    for (const k in r.features) {
      const c = index.get(k);
      if (c !== undefined) { col.push(c); val.push(r.features[k]); }
    }
    ptr[i + 1] = col.length;
  });

  // Embeddings: centred on their average, and scaled as a whole (not per dimension, which would
  // be unstable with few decisions) so that a typical one has length 1.
  const mean = new Float32Array(VEC_DIM);
  let dense: Float32Array | null = null;
  let scale = 1;
  const withVec = ignored.has(VISUAL) ? [] : rows.map((r, i) => (r.vec?.length === VEC_DIM ? i : -1)).filter(i => i >= 0);
  if (withVec.length >= 2) {
    for (const i of withVec) { const v = rows[i].vec!; for (let j = 0; j < VEC_DIM; j++) mean[j] += v[j]; }
    for (let j = 0; j < VEC_DIM; j++) mean[j] /= withVec.length;
    let squares = 0;
    for (const i of withVec) { const v = rows[i].vec!; for (let j = 0; j < VEC_DIM; j++) squares += (v[j] - mean[j]) ** 2; }
    scale = Math.sqrt(squares / withVec.length) || 1;
    dense = new Float32Array(n * VEC_DIM);
    for (const i of withVec) { const v = rows[i].vec!; for (let j = 0; j < VEC_DIM; j++) dense[i * VEC_DIM + j] = (v[j] - mean[j]) / scale; }
  }
  return { n, y, weight, vocab, ptr, col: Int32Array.from(col), val: Float32Array.from(val), dense, mean, scale };
}

interface Fit {
  theta: Float64Array; // [bias, named features..., visual dimensions...]
}

function logitOf(ds: Dataset, theta: Float64Array, i: number): number {
  let z = theta[0];
  for (let p = ds.ptr[i]; p < ds.ptr[i + 1]; p++) z += theta[1 + ds.col[p]] * ds.val[p];
  if (ds.dense) {
    const base = 1 + ds.vocab.length;
    const row = i * VEC_DIM;
    for (let j = 0; j < VEC_DIM; j++) z += theta[base + j] * ds.dense[row + j];
  }
  return z;
}

/**
 * Logistic regression fitted with Adam on the given rows. Classes are re-weighted to count as much
 * as each other, so that a user who deletes a lot does not bias every proposal.
 */
function fit(ds: Dataset, subset: Int32Array, l2: number, l2Visual: number, iterations: number): Fit {
  const v = ds.vocab.length;
  const size = 1 + v + (ds.dense ? VEC_DIM : 0);
  const theta = new Float64Array(size);
  const sums = [0, 0];
  for (const i of subset) sums[ds.y[i]] += ds.weight[i];
  if (sums[0] === 0 || sums[1] === 0) return { theta };
  const w = new Float64Array(subset.length);
  subset.forEach((i, s) => { w[s] = ds.weight[i] / (2 * sums[ds.y[i]]); }); // sums to 1

  const grad = new Float64Array(size);
  const m = new Float64Array(size);
  const u = new Float64Array(size);
  const beta1 = 0.9, beta2 = 0.999, lr = 0.08;
  for (let it = 1; it <= iterations; it++) {
    grad.fill(0);
    for (let s = 0; s < subset.length; s++) {
      const i = subset[s];
      const err = (sigmoid(logitOf(ds, theta, i)) - ds.y[i]) * w[s];
      grad[0] += err;
      for (let p = ds.ptr[i]; p < ds.ptr[i + 1]; p++) grad[1 + ds.col[p]] += err * ds.val[p];
      if (ds.dense) {
        const row = i * VEC_DIM;
        for (let j = 0; j < VEC_DIM; j++) grad[1 + v + j] += err * ds.dense[row + j];
      }
    }
    for (let k = 1; k <= v; k++) grad[k] += l2 * theta[k];
    for (let k = 1 + v; k < size; k++) grad[k] += l2Visual * theta[k];
    const step = lr * Math.sqrt(1 - beta2 ** it) / (1 - beta1 ** it) / (1 + it / 60);
    for (let k = 0; k < size; k++) {
      m[k] = beta1 * m[k] + (1 - beta1) * grad[k];
      u[k] = beta2 * u[k] + (1 - beta2) * grad[k] * grad[k];
      theta[k] -= step * m[k] / (Math.sqrt(u[k]) + 1e-8);
    }
  }
  return { theta };
}

// --- Self-check ---------------------------------------------------------------------------------

/** Share of (deleted, kept) pairs where the deleted photo has the higher score. */
export function auc(scores: ArrayLike<number>, labels: ArrayLike<number>): number {
  const order = Array.from({ length: scores.length }, (_, i) => i).sort((a, b) => scores[a] - scores[b]);
  let positives = 0, rankSum = 0;
  for (let start = 0; start < order.length;) {
    let end = start;
    while (end < order.length && scores[order[end]] === scores[order[start]]) end++;
    const rank = (start + end + 1) / 2; // average rank of tied scores
    for (let k = start; k < end; k++) if (labels[order[k]] === 1) { positives++; rankSum += rank; }
    start = end;
  }
  const negatives = order.length - positives;
  if (!positives || !negatives) return 0.5;
  return (rankSum - positives * (positives + 1) / 2) / (positives * negatives);
}

/** Platt scaling: the a and b making sigmoid(a * logit + b) match what really happened. */
function calibrate(logits: Float64Array, labels: Uint8Array, weights: Float64Array): { a: number; b: number } {
  let a = 1, b = 0;
  for (let it = 0; it < 50; it++) {
    let ga = 1e-3 * (a - 1), gb = 0, haa = 1e-3, hab = 0, hbb = 1e-6;
    for (let i = 0; i < logits.length; i++) {
      const p = sigmoid(a * logits[i] + b);
      const err = (p - labels[i]) * weights[i];
      const curve = Math.max(p * (1 - p), 1e-6) * weights[i];
      ga += err * logits[i]; gb += err;
      haa += curve * logits[i] * logits[i]; hab += curve * logits[i]; hbb += curve;
    }
    const det = haa * hbb - hab * hab;
    if (!(det > 1e-12)) break;
    const da = (hbb * ga - hab * gb) / det;
    const db = (haa * gb - hab * ga) / det;
    a -= da; b -= db;
    if (Math.abs(da) + Math.abs(db) < 1e-6) break;
  }
  if (!Number.isFinite(a) || !Number.isFinite(b)) return { a: 1, b: 0 };
  return { a: Math.min(Math.max(a, 0), 20), b };
}

const CV_MAX_ROWS = 2000;

function defaultIterations(n: number): number {
  return Math.round(Math.min(200, Math.max(80, 400_000 / Math.max(1, n))));
}

/**
 * Trains the model on every decision, after training it several times on a part of them to score
 * the rest: those honest scores give the calibration and the quality figures.
 * Rows must be ordered oldest first (the self-check uses the most recent ones).
 */
export function train(rows: TrainingRow[], options: TrainOptions = {}): { model: Model; quality: Quality } {
  const { ignored = new Set<string>(), minSupport = 2, l2 = 0.01, l2Visual = 0.001 } = options;
  const iterations = options.iterations ?? defaultIterations(rows.length);
  const ds = buildDataset(rows, ignored, minSupport);
  const quality: Quality = { tested: 0, auc: 0.5, deletedAbove: new Uint32Array(101), keptAbove: new Uint32Array(101) };
  let calibration = { a: 1, b: 0 };

  // Cross-validation, each fold with as many deleted and kept photos as possible
  const tested: number[] = [];
  for (let i = Math.max(0, ds.n - CV_MAX_ROWS); i < ds.n; i++) tested.push(i);
  const byClass: [number[], number[]] = [[], []];
  for (const i of tested) byClass[ds.y[i]].push(i);
  const folds = Math.min(tested.length > 600 ? 3 : 5, byClass[0].length, byClass[1].length);
  if (folds >= 2) {
    const random = mulberry32(12345);
    const foldOf = new Int8Array(ds.n).fill(-1);
    for (const members of byClass) {
      for (let i = members.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [members[i], members[j]] = [members[j], members[i]];
      }
      members.forEach((i, k) => { foldOf[i] = k % folds; });
    }
    // Folds are trained on the tested decisions only, to keep the check cheap on long histories
    const logits = new Float64Array(tested.length);
    for (let f = 0; f < folds; f++) {
      const { theta } = fit(ds, Int32Array.from(tested.filter(i => foldOf[i] !== f)), l2, l2Visual, iterations);
      tested.forEach((i, t) => { if (foldOf[i] === f) logits[t] = logitOf(ds, theta, i); });
    }
    const labels = Uint8Array.from(tested, i => ds.y[i]);
    const sums = [0, 0];
    for (const i of tested) sums[ds.y[i]] += ds.weight[i];
    const weights = Float64Array.from(tested, i => ds.weight[i] / (2 * sums[ds.y[i]]));
    calibration = calibrate(logits, labels, weights);
    quality.tested = tested.length;
    quality.auc = auc(logits, labels);
    for (let t = 0; t < tested.length; t++) {
      const score = Math.round(sigmoid(calibration.a * logits[t] + calibration.b) * 100);
      const counts = labels[t] === 1 ? quality.deletedAbove : quality.keptAbove;
      for (let threshold = 0; threshold <= score; threshold++) counts[threshold]++;
    }
  }

  const all = new Int32Array(ds.n);
  for (let i = 0; i < ds.n; i++) all[i] = i;
  const { theta } = fit(ds, all, l2, l2Visual, iterations);
  const weights = new Map<string, number>();
  ds.vocab.forEach((k, c) => weights.set(k, theta[1 + c]));
  let visual: Float32Array | null = null;
  let visualOffset = 0;
  if (ds.dense) {
    visual = new Float32Array(VEC_DIM);
    for (let j = 0; j < VEC_DIM; j++) {
      visual[j] = theta[1 + ds.vocab.length + j] / ds.scale;
      visualOffset += visual[j] * ds.mean[j];
    }
  }
  return { model: { bias: theta[0], weights, visual, visualOffset, calibration }, quality };
}

export const emptyModel = (): Model => ({ bias: 0, weights: new Map(), visual: null, visualOffset: 0, calibration: { a: 1, b: 0 } });

/** How much the look of a photo pushes towards deletion (+) or keeping (-), from its projected embedding. */
export function visualLogit(model: Model, vec: Float32Array | undefined): number {
  if (!model.visual || !vec) return 0;
  let z = -model.visualOffset;
  for (let j = 0; j < VEC_DIM; j++) z += model.visual[j] * vec[j];
  return z;
}

/**
 * Probability of deletion and what speaks for it, strongest first. `visual` is the visual part
 * of the logit (see visualLogit, or embeddingWeights for the fast path).
 */
export function predict(model: Model, features: Record<string, number>, visual = 0): { probability: number; contributions: [string, number][] } {
  let z = model.bias + visual;
  const { a, b } = model.calibration;
  const contributions: [string, number][] = [];
  for (const k in features) {
    const w = model.weights.get(k);
    if (w === undefined) continue;
    z += w * features[k];
    contributions.push([k, a * w * features[k]]);
  }
  if (visual !== 0) contributions.push([VISUAL, a * visual]);
  contributions.sort((x, y) => y[1] - x[1]);
  return { probability: sigmoid(a * z + b), contributions };
}
