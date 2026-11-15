// Keeps the faces, the people and which photos were already looked at in IndexedDB, on the device.
// Face descriptors are biometric data: they never leave the phone, and clearFaceData() erases them
// (called when the user turns the feature off).

import type { FaceRecord, Person } from './faceIndex.ts';

const DB_NAME = 'pixo-faces';
const FACES = 'faces';
const PEOPLE = 'people';
const SCANS = 'scans';

export interface ScanRecord {
  photoId: string;
  size: number;
  lastModified: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      db.createObjectStore(FACES, { keyPath: 'id' });
      db.createObjectStore(PEOPLE, { keyPath: 'id' });
      db.createObjectStore(SCANS, { keyPath: 'photoId' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  dbPromise.catch(() => { dbPromise = null; });
  return dbPromise;
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = tx.onabort = () => reject(tx.error);
  });
}

function getAll<T>(db: IDBDatabase, store: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const request = db.transaction(store).objectStore(store).getAll();
    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () => reject(request.error);
  });
}

export async function loadFaceData(): Promise<{ faces: FaceRecord[]; people: Person[]; scans: ScanRecord[] }> {
  const db = await openDb();
  const [faces, people, scans] = await Promise.all([
    getAll<FaceRecord>(db, FACES), getAll<Person>(db, PEOPLE), getAll<ScanRecord>(db, SCANS),
  ]);
  return { faces, people, scans };
}

export async function saveFaceChanges(changes: {
  faces: FaceRecord[]; removedFaces: string[]; people: Person[]; removedPeople: string[]; scans?: ScanRecord[];
}): Promise<void> {
  const db = await openDb();
  const tx = db.transaction([FACES, PEOPLE, SCANS], 'readwrite');
  const faces = tx.objectStore(FACES);
  const people = tx.objectStore(PEOPLE);
  for (const id of changes.removedFaces) faces.delete(id);
  for (const f of changes.faces) faces.put(f);
  for (const id of changes.removedPeople) people.delete(id);
  for (const p of changes.people) people.put(p);
  for (const s of changes.scans ?? []) tx.objectStore(SCANS).put(s);
  await done(tx);
}

export async function clearFaceData(): Promise<void> {
  const db = await openDb();
  const tx = db.transaction([FACES, PEOPLE, SCANS], 'readwrite');
  for (const store of [FACES, PEOPLE, SCANS]) tx.objectStore(store).clear();
  await done(tx);
}
