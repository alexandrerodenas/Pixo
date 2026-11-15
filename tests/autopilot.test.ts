import { test } from 'node:test';
import assert from 'node:assert/strict';
import { train, predict, visualLogit, projectEmbedding, embeddingWeights, auc, VEC_DIM, VISUAL, type TrainingRow } from '../services/autopilotModel.ts';
import { recordDecisions, autopilotMatch, initAutopilot, getAutopilotState, subscribeAutopilot, backtest, extractFeatures } from '../services/autopilot.ts';
import { PhotoStatus, type Photo } from '../services/types.ts';

function random(seed: number) {
  return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
}
const gaussian = (r: () => number) => Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r());

// Fake photo library: every "subject" is a cluster of 1024-number embeddings (non-negative, like
// MobileNet's), and the labels the classifier gives say nothing about the subject.
const DIM = 1024;
const r = random(42);
const centres = Array.from({ length: 6 }, () => Array.from({ length: DIM }, () => Math.max(0, gaussian(r))));
function embeddingOf(subject: number): number[] {
  return centres[subject].map(c => Math.max(0, c + 0.9 * gaussian(r)));
}
const NOISE_LABELS = ['c:web site', 'c:menu', 'c:envelope', 'c:daisy', 'c:pot'];
function sample(subject: number) {
  const embedding = embeddingOf(subject);
  return { subject, embedding, features: { [NOISE_LABELS[Math.floor(r() * NOISE_LABELS.length)]]: 0.5 + r() / 2 } as Record<string, number> };
}
const DELETED_SUBJECTS = new Set([0, 3]);
const labelOf = (subject: number): 0 | 1 => (DELETED_SUBJECTS.has(subject) ? 1 : 0);
const library = (n: number) => Array.from({ length: n }, (_, i) => sample(i % centres.length));
const toRows = (items: ReturnType<typeof library>, withVec = true): TrainingRow[] =>
  items.map(s => ({ label: labelOf(s.subject), weight: 1, features: s.features, vec: withVec ? projectEmbedding(s.embedding) : undefined }));

test('the projection is stable, of fixed size, and keeps similarities', () => {
  const a = embeddingOf(0), b = embeddingOf(0), c = embeddingOf(1);
  const pa = projectEmbedding(a)!, pb = projectEmbedding(b)!, pc = projectEmbedding(c)!;
  assert.equal(pa.length, VEC_DIM);
  assert.deepEqual(projectEmbedding(a), pa);
  assert.equal(projectEmbedding(new Array(DIM).fill(0)), undefined);
  const cosine = (x: ArrayLike<number>, y: ArrayLike<number>) => {
    let d = 0, nx = 0, ny = 0;
    for (let i = 0; i < x.length; i++) { d += x[i] * y[i]; nx += x[i] * x[i]; ny += y[i] * y[i]; }
    return d / Math.sqrt(nx * ny);
  };
  assert.ok(Math.abs(cosine(pa, pb) - cosine(a, b)) < 0.15);
  assert.ok(Math.abs(cosine(pa, pc) - cosine(a, c)) < 0.15);
});

test('it learns what deleted photos look like when labels say nothing', () => {
  const training = library(120), unseen = library(300);
  const labels = unseen.map(s => labelOf(s.subject));

  const withLooks = train(toRows(training));
  const scores = unseen.map(s => predict(withLooks.model, s.features, visualLogit(withLooks.model, projectEmbedding(s.embedding))).probability);
  assert.ok(auc(scores, labels) > 0.95, `auc with embeddings: ${auc(scores, labels)}`);
  assert.ok(withLooks.quality.auc > 0.9, `self-check auc: ${withLooks.quality.auc}`);

  const labelsOnly = train(toRows(training, false));
  const blind = unseen.map(s => predict(labelsOnly.model, s.features).probability);
  assert.ok(auc(blind, labels) < 0.65, `auc with labels only: ${auc(blind, labels)}`);
  assert.ok(labelsOnly.quality.auc < 0.65, 'the self-check sees that labels alone predict nothing');
});

test('scoring from the raw embedding gives the same result as from its projection', () => {
  const { model } = train(toRows(library(60)));
  const weights = embeddingWeights(model, DIM)!;
  for (const s of library(10)) {
    let dot = 0, squares = 0;
    s.embedding.forEach((v, i) => { dot += weights[i] * v; squares += v * v; });
    const fast = dot / Math.sqrt(squares) - model.visualOffset;
    assert.ok(Math.abs(fast - visualLogit(model, projectEmbedding(s.embedding))) < 1e-3);
  }
});

test('the self-check counts are consistent and probabilities are calibrated', () => {
  const rows = toRows(library(300));
  const { model, quality } = train(rows);
  const deleted = rows.filter(row => row.label === 1).length;
  assert.equal(quality.tested, rows.length);
  assert.equal(quality.deletedAbove[0], deleted);
  assert.equal(quality.keptAbove[0], rows.length - deleted);
  for (let t = 1; t <= 100; t++) assert.ok(quality.deletedAbove[t] <= quality.deletedAbove[t - 1]);
  // At 85%, nearly everything proposed among hidden decisions was really deleted
  assert.ok(quality.deletedAbove[85] > 0.7 * deleted);
  assert.ok(quality.keptAbove[85] <= 0.1 * quality.deletedAbove[85]);
  assert.ok(model.calibration.a > 0);
});

test('decisions without any logic are reported as unpredictable', () => {
  const coin = random(7);
  const rows = toRows(library(200)).map(row => ({ ...row, label: (coin() < 0.5 ? 1 : 0) as 0 | 1 }));
  const { quality } = train(rows);
  assert.ok(quality.auc < 0.62, `auc on random decisions: ${quality.auc}`);
});

test('ignoring the visual likeness or a feature removes it from the model', () => {
  const rows = toRows(library(60)).map(row => ({ ...row, features: { ...row.features, 'src:screenshot': row.label } }));
  const full = train(rows).model;
  assert.ok(full.visual && full.weights.get('src:screenshot')! > 0);
  const reduced = train(rows, { ignored: new Set([VISUAL, 'src:screenshot']) }).model;
  assert.equal(reduced.visual, null);
  assert.equal(reduced.weights.has('src:screenshot'), false);
});

test('a named feature still explains a proposal', () => {
  const rows: TrainingRow[] = library(80).map((s, i) => ({ label: (i % 2) as 0 | 1, weight: 1, features: i % 2 ? { 'src:screenshot': 1, 'ext:png': 1 } : { 'shape:landscape': 1 } }));
  const { model } = train(rows);
  const { probability, contributions } = predict(model, { 'src:screenshot': 1, 'ext:png': 1 });
  assert.ok(probability > 0.85);
  assert.ok(['src:screenshot', 'ext:png'].includes(contributions[0][0]));
  assert.ok(predict(model, { 'shape:landscape': 1 }).probability < 0.15);
});

// --- The service, as the app uses it (no IndexedDB here: decisions just stay in memory) ------

let photoCount = 0;
function photoOf(subject: number, extra: Partial<Photo> = {}): Photo {
  const s = sample(subject);
  return {
    id: `DCIM/Camera/IMG_${++photoCount}.jpg`, objectURL: '', status: PhotoStatus.ANALYZED, selected: false,
    classifications: [{ label: Object.keys(s.features)[0].slice(2), score: 0.6 }], detections: [],
    embedding: s.embedding, blurRaw: 250, blurLevel: 'ok', ...extra,
  };
}
const nextTraining = () => new Promise<void>(resolve => { const stop = subscribeAutopilot(() => { stop(); resolve(); }); });

test('the service proposes look-alikes of deleted photos, and never a photo the user kept', async () => {
  const warn = console.warn;
  console.warn = () => {}; // IndexedDB is missing on purpose
  try {
    await initAutopilot();
    assert.equal(getAutopilotState().reliable, false);
    assert.equal(autopilotMatch(photoOf(0)), null);

    const kept = Array.from({ length: 30 }, (_, i) => photoOf([1, 2, 4, 5][i % 4]));
    recordDecisions(Array.from({ length: 30 }, (_, i) => photoOf(i % 2 ? 0 : 3)), 'delete');
    recordDecisions(kept, 'keep');
    await nextTraining();

    const state = getAutopilotState();
    assert.equal(state.total, 60);
    assert.ok(state.ready && state.reliable, `auc ${state.quality?.auc}`);
    assert.equal(state.rules[0].feature, VISUAL);
    const check = backtest(state.quality!, 85);
    assert.ok(check.deleted > 15 && check.kept <= 2 && check.recall > 0.5);

    const proposals = Array.from({ length: 40 }, () => autopilotMatch(photoOf(0))).filter(Boolean);
    assert.ok(proposals.length >= 30, `proposed ${proposals.length}/40 look-alikes`);
    assert.ok(proposals[0]!.features.includes(VISUAL));
    const wrong = Array.from({ length: 40 }, (_, i) => autopilotMatch(photoOf([1, 2, 4, 5][i % 4]))).filter(Boolean);
    assert.ok(wrong.length <= 1, `proposed ${wrong.length}/40 photos of kept subjects`);

    // Same look as deleted photos, but the user said to keep this one
    const exception = photoOf(0);
    recordDecisions([exception], 'correction');
    assert.equal(autopilotMatch(exception, 50), null);
    assert.equal(autopilotMatch(photoOf(0, { isSaved: true }), 50), null);
  } finally {
    await new Promise(resolve => setTimeout(resolve, 20)); // let the failed saves report
    console.warn = warn;
  }
});

test('features include a sharpness measure that does not depend on the profile thresholds', () => {
  const soft = extractFeatures(photoOf(0, { blurRaw: 20 }));
  const sharp = extractFeatures(photoOf(0, { blurRaw: 900 }));
  assert.ok(soft['n:blur'] > 0.5 && sharp['n:blur'] < 0.05);
});
