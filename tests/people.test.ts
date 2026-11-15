import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FaceIndex, letterOf } from '../services/faceIndex.ts';
import { setPhotoPeople } from '../services/peopleRegistry.ts';
import { extractFeatures } from '../services/autopilot.ts';
import { train, predict, type TrainingRow } from '../services/autopilotModel.ts';
import { PhotoStatus, type Photo } from '../services/types.ts';

function random(seed: number) {
  return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
}
const r = random(7);
const gaussian = () => Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r());
// Fake face descriptors: one centre per person, faces spread around it like face-api's (same
// person about 0.3-0.45 apart, different people about 0.8 and more)
const centres = Array.from({ length: 5 }, () => Float32Array.from({ length: 128 }, () => gaussian() * 0.07));
const faceOf = (person: number) => ({ box: { x: 0, y: 0, width: 0.2, height: 0.2 }, score: 0.9, descriptor: centres[person].map(c => c + gaussian() * 0.02) });

test('faces of the same person are grouped, two faces of one photo never are', () => {
  const index = new FaceIndex();
  for (let i = 0; i < 12; i++) index.setPhotoFaces(`p${i}`, [faceOf(i % 3)]);
  const people = index.visiblePeople();
  assert.equal(people.length, 3);
  for (const person of people) assert.equal(person.faces.length, 4);

  index.setPhotoFaces('twice', [faceOf(0), faceOf(0)]);
  const [a, b] = index.facesOfPhoto('twice');
  assert.notEqual(a.personId, b.personId);
  assert.deepEqual(people.map(p => letterOf(p.seq!)).sort(), ['A', 'B', 'C']);
  assert.equal(letterOf(26), 'AA');
});

test('a face taken out of a person is never put back with them, and merges are reported', () => {
  const index = new FaceIndex();
  for (let i = 0; i < 6; i++) index.setPhotoFaces(`p${i}`, [faceOf(i % 2)]);
  index.takeChanges();
  const [first, second] = index.visiblePeople();
  const moved = first.faces[0];
  const target = index.detachFace(moved.id)!;
  assert.notEqual(target, first.id);
  assert.ok(index.faces.get(moved.id)!.rejected!.includes(first.id));

  index.rename(second.id, 'Marie');
  index.merge(first.id, second.id);
  const { merges } = index.takeChanges();
  assert.deepEqual(merges, [[first.id, second.id]]);
  assert.equal(index.people.get(second.id)!.name, 'Marie');
  assert.equal(index.people.has(first.id), false);
});

const photo = (id: string): Photo => ({ id, objectURL: '', status: PhotoStatus.ANALYZED, classifications: [], detections: [], selected: false });

test('the autopilot sees who is on a photo, once its faces were looked for', () => {
  setPhotoPeople(new Map([
    ['a.jpg', { people: ['p1', 'p2'], faces: 2 }],
    ['b.jpg', { people: [], faces: 0 }],
  ]), new Map());
  const a = extractFeatures(photo('a.jpg'));
  assert.equal(a['person:p1'], 1);
  assert.equal(a['person:p2'], 1);
  assert.equal(a['faces:few'], 1);
  assert.equal(extractFeatures(photo('b.jpg'))['faces:none'], 1);
  const unknown = extractFeatures(photo('c.jpg'));
  assert.ok(!Object.keys(unknown).some(k => k.startsWith('person:') || k.startsWith('faces:')));
  setPhotoPeople(new Map(), new Map());
});

test('it learns to delete the photos of one person and keep those of another', () => {
  const noise = ['c:web site', 'c:menu', 'c:daisy'];
  const rows: TrainingRow[] = Array.from({ length: 80 }, (_, i) => ({
    label: (i % 2) as 0 | 1,
    weight: 1,
    features: { [`person:${i % 2 ? 'ex' : 'friend'}`]: 1, [noise[i % 3]]: 0.8 },
  }));
  const { model } = train(rows);
  assert.ok(predict(model, { 'person:ex': 1, 'c:menu': 0.8 }).probability > 0.8);
  assert.ok(predict(model, { 'person:friend': 1, 'c:menu': 0.8 }).probability < 0.2);
});
