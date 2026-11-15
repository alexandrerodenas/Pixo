// Groups the faces found in the photos into people, on the device.
//
// Each face has a 128-number descriptor (see workers/face.worker.ts): two faces of the same person
// are close (Euclidean distance usually under 0.45), two different people usually above 0.55.
// Grouping is incremental: a new face joins the person whose average face (centroid) is closest,
// when it is close enough, otherwise it starts a new person. The user corrects the groups:
// renaming, merging two people, or taking a face out of a person ("this is not them"), which is
// remembered so the face is never put back there.

export interface FaceBox { x: number; y: number; width: number; height: number }

export interface FaceRecord {
  id: string; // `${photoId}::${index}`
  photoId: string;
  box: FaceBox; // relative to the photo, 0..1
  score: number;
  descriptor: Float32Array;
  thumbnail?: Blob;
  personId: string;
  rejected?: string[]; // people the user said this face is not
}

export interface Person {
  id: string;
  seq?: number; // gives the default name ("Person A", "Person B"...), set once the person is shown
  name?: string; // given by the user
  createdAt: number;
}

// Distances (Euclidean, between descriptors). Measured on sample photos: same person 0.10-0.48,
// different people 0.53 and more.
const CENTROID_MAX = 0.5; // a face joins a person whose average face is this close...
const LINK_MAX = 0.42; // ...or one of whose faces is this close
const MERGE_MAX = 0.4; // two automatic groups this close are the same person
const NEAREST_CANDIDATES = 4;
/** A person is shown once they appear on this many photos (or as soon as they are named). */
export const MIN_FACES_SHOWN = 2;

export function distance(a: Float32Array, b: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

/** "A".."Z", then "AA", "AB"... */
export function letterOf(seq: number): string {
  let n = seq;
  let out = '';
  do {
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return out;
}

const newId = () => (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`);

export class FaceIndex {
  faces = new Map<string, FaceRecord>();
  people = new Map<string, Person>();
  private members = new Map<string, Set<string>>(); // personId -> face ids
  private centroids = new Map<string, Float32Array>();
  private nextSeq = 0;
  /** People and faces changed since the last takeChanges(), to be saved */
  private dirtyPeople = new Set<string>();
  private dirtyFaces = new Set<string>();
  private removedPeople = new Set<string>();

  constructor(faces: FaceRecord[] = [], people: Person[] = []) {
    for (const p of people) {
      this.people.set(p.id, p);
      if (p.seq !== undefined) this.nextSeq = Math.max(this.nextSeq, p.seq + 1);
    }
    for (const f of faces) {
      if (!this.people.has(f.personId)) this.people.set(f.personId, { id: f.personId, createdAt: Date.now() });
      this.faces.set(f.id, f);
      this.memberSet(f.personId).add(f.id);
    }
  }

  private memberSet(personId: string): Set<string> {
    let set = this.members.get(personId);
    if (!set) this.members.set(personId, set = new Set());
    return set;
  }

  membersOf(personId: string): FaceRecord[] {
    return [...(this.members.get(personId) ?? [])].map(id => this.faces.get(id)!).filter(Boolean);
  }

  facesOfPhoto(photoId: string): FaceRecord[] {
    const out: FaceRecord[] = [];
    for (const f of this.faces.values()) if (f.photoId === photoId) out.push(f);
    return out;
  }

  private centroid(personId: string): Float32Array | null {
    const cached = this.centroids.get(personId);
    if (cached) return cached;
    const faces = this.membersOf(personId);
    if (faces.length === 0) return null;
    const sum = new Float32Array(faces[0].descriptor.length);
    for (const f of faces) for (let i = 0; i < sum.length; i++) sum[i] += f.descriptor[i];
    for (let i = 0; i < sum.length; i++) sum[i] /= faces.length;
    this.centroids.set(personId, sum);
    return sum;
  }

  private touchPerson(personId: string) {
    this.centroids.delete(personId);
    this.dirtyPeople.add(personId);
    const person = this.people.get(personId);
    // A person gets a letter the first time they are shown, so letters follow the order people appear in
    if (person && person.seq === undefined && (this.members.get(personId)?.size ?? 0) >= MIN_FACES_SHOWN) {
      person.seq = this.nextSeq++;
    }
  }

  private moveFace(face: FaceRecord, personId: string) {
    const previous = face.personId;
    this.members.get(previous)?.delete(face.id);
    face.personId = personId;
    this.memberSet(personId).add(face.id);
    this.dirtyFaces.add(face.id);
    this.touchPerson(personId);
    if (previous !== personId) this.dropIfEmpty(previous);
  }

  private dropIfEmpty(personId: string) {
    if ((this.members.get(personId)?.size ?? 0) > 0) return;
    this.members.delete(personId);
    this.centroids.delete(personId);
    this.people.delete(personId);
    this.dirtyPeople.delete(personId);
    this.removedPeople.add(personId);
  }

  private createPerson(): string {
    const person: Person = { id: newId(), createdAt: Date.now() };
    this.people.set(person.id, person);
    this.dirtyPeople.add(person.id);
    return person.id;
  }

  private peopleInPhoto(photoId: string, exceptFaceId?: string): Set<string> {
    const out = new Set<string>();
    for (const f of this.faces.values()) if (f.photoId === photoId && f.id !== exceptFaceId) out.add(f.personId);
    return out;
  }

  /** The person a face belongs to, or null when it looks like nobody known. */
  private bestPerson(face: Omit<FaceRecord, 'personId'>, excluded: Set<string>): string | null {
    const scored: Array<{ id: string; d: number }> = [];
    for (const id of this.people.keys()) {
      if (excluded.has(id)) continue;
      const c = this.centroid(id);
      if (c) scored.push({ id, d: distance(face.descriptor, c) });
    }
    scored.sort((a, b) => a.d - b.d);
    for (const { id, d } of scored.slice(0, NEAREST_CANDIDATES)) {
      if (d <= CENTROID_MAX) return id;
      if (this.membersOf(id).some(m => distance(face.descriptor, m.descriptor) <= LINK_MAX)) return id;
    }
    return null;
  }

  /** Adds (or replaces) the faces of a photo and puts each one with a person. */
  setPhotoFaces(photoId: string, faces: Array<Omit<FaceRecord, 'id' | 'photoId' | 'personId'>>) {
    for (const old of this.facesOfPhoto(photoId)) this.removeFace(old.id);
    const taken = new Set<string>(); // two faces of one photo are never the same person
    faces.forEach((f, index) => {
      const record = { ...f, id: `${photoId}::${index}`, photoId } as FaceRecord;
      const personId = this.bestPerson(record, taken) ?? this.createPerson();
      taken.add(personId);
      record.personId = personId;
      this.faces.set(record.id, record);
      this.memberSet(personId).add(record.id);
      this.dirtyFaces.add(record.id);
      this.touchPerson(personId);
    });
    this.mergeCloseGroups(taken);
  }

  private removeFace(faceId: string) {
    const face = this.faces.get(faceId);
    if (!face) return;
    this.faces.delete(faceId);
    this.members.get(face.personId)?.delete(faceId);
    this.dirtyFaces.add(faceId);
    this.touchPerson(face.personId);
    this.dropIfEmpty(face.personId);
  }

  private coOccur(a: string, b: string): boolean {
    const photosOfA = new Set(this.membersOf(a).map(f => f.photoId));
    return this.membersOf(b).some(f => photosOfA.has(f.photoId));
  }

  private refused(a: string, b: string): boolean {
    return this.membersOf(a).some(f => f.rejected?.includes(b)) || this.membersOf(b).some(f => f.rejected?.includes(a));
  }

  /**
   * Incremental grouping depends on the order photos come in: a person just given new faces is
   * joined with an automatic group that has become close. Only those people are compared, so the
   * cost stays linear in the number of people.
   */
  private mergeCloseGroups(touched: Iterable<string>) {
    for (const id of touched) {
      const a = this.people.get(id);
      const ca = a && this.centroid(id);
      if (!a || !ca) continue;
      for (const b of [...this.people.values()]) {
        if (b.id === id || (a.name && b.name)) continue;
        const cb = this.centroid(b.id);
        if (!cb || distance(ca, cb) > MERGE_MAX) continue;
        if (this.coOccur(id, b.id) || this.refused(id, b.id)) continue;
        // The named one, or else the bigger one, is kept
        const keepA = !!a.name || (!b.name && (this.members.get(id)?.size ?? 0) >= (this.members.get(b.id)?.size ?? 0));
        if (keepA) this.merge(b.id, id); else { this.merge(id, b.id); break; }
      }
    }
  }

  // --- User corrections ---

  rename(personId: string, name: string) {
    const person = this.people.get(personId);
    if (!person) return;
    person.name = name.trim() || undefined;
    this.dirtyPeople.add(personId);
  }

  /** Puts every face of `fromId` into `intoId`. The kept name is the one of `intoId`, or else of `fromId`. */
  merge(fromId: string, intoId: string) {
    if (fromId === intoId) return;
    const from = this.people.get(fromId);
    const into = this.people.get(intoId);
    if (!from || !into) return;
    if (!into.name && from.name) into.name = from.name;
    if (into.seq === undefined || (from.seq !== undefined && from.seq < into.seq)) into.seq = from.seq ?? into.seq;
    for (const face of this.membersOf(fromId)) {
      if (face.rejected?.includes(intoId)) face.rejected = face.rejected.filter(id => id !== intoId);
      this.moveFace(face, intoId);
    }
    this.dirtyPeople.add(intoId);
  }

  /** "This is not them": the face leaves the person and is never put back with them. */
  detachFace(faceId: string): string | null {
    const face = this.faces.get(faceId);
    if (!face) return null;
    const from = face.personId;
    face.rejected = [...new Set([...(face.rejected ?? []), from])];
    const excluded = new Set([...face.rejected, ...this.peopleInPhoto(face.photoId, face.id)]);
    const target = this.bestPerson(face, excluded) ?? this.createPerson();
    this.moveFace(face, target);
    this.touchPerson(from);
    return target;
  }

  // --- Reading ---

  /** People to show: named, or seen on enough photos among `loaded` (the photos currently open). */
  visiblePeople(loaded?: Set<string>): Array<Person & { faces: FaceRecord[] }> {
    const out: Array<Person & { faces: FaceRecord[] }> = [];
    for (const person of this.people.values()) {
      const faces = this.membersOf(person.id).filter(f => !loaded || loaded.has(f.photoId));
      if (faces.length === 0) continue;
      if (!person.name && faces.length < MIN_FACES_SHOWN) continue;
      out.push({ ...person, faces: faces.sort((a, b) => b.score - a.score) });
    }
    return out.sort((a, b) => b.faces.length - a.faces.length);
  }

  peopleByPhoto(): Map<string, Set<string>> {
    const out = new Map<string, Set<string>>();
    for (const f of this.faces.values()) {
      let set = out.get(f.photoId);
      if (!set) out.set(f.photoId, set = new Set());
      set.add(f.personId);
    }
    return out;
  }

  /** What changed since the last call, to be written to the database. */
  takeChanges() {
    const changes = {
      faces: [...this.dirtyFaces].map(id => this.faces.get(id)).filter((f): f is FaceRecord => !!f),
      removedFaces: [...this.dirtyFaces].filter(id => !this.faces.has(id)),
      people: [...this.dirtyPeople].map(id => this.people.get(id)).filter((p): p is Person => !!p),
      removedPeople: [...this.removedPeople],
    };
    this.dirtyFaces.clear();
    this.dirtyPeople.clear();
    this.removedPeople.clear();
    return changes;
  }
}

export function displayName(person: Person, prefix: string): string {
  return person.name || `${prefix} ${person.seq !== undefined ? letterOf(person.seq) : '?'}`;
}
