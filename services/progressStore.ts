import type { Photo } from './types.ts';
import { PhotoStatus } from './types.ts';

// Keeps analysis results, selections and saved flags in IndexedDB, so a reload (or Android killing
// the app in the background) does not throw the work away. A record is reused only while the file
// keeps the same size and modification date.

const DB_NAME = 'pixo';
const STORE = 'photos';

type PersistedFields = Pick<Photo,
  'status' | 'classifications' | 'detections' | 'selected' | 'isSaved' | 'customLabel' |
  'blurScore' | 'blurRaw' | 'blurLevel' | 'matchedRules' | 'metadata'>;

interface ProgressRecord {
  id: string;
  size: number;
  lastModified: number;
  fields: PersistedFields;
  embedding?: Float32Array;
  thumbnail?: Blob;
}

let dbPromise: Promise<IDBDatabase> | null = null;

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

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = tx.onabort = () => reject(tx.error);
  });
}

const isFinished = (p: Photo) => p.status === PhotoStatus.ANALYZED || p.status === PhotoStatus.UNCATEGORIZED;

/** Saves finished photos. Thumbnails are copied only when they are blob URLs (made by the analysis). */
export async function saveProgress(photos: Photo[]): Promise<void> {
  const records: ProgressRecord[] = [];
  for (const p of photos) {
    if (!isFinished(p) || !p.source) continue;
    let thumbnail: Blob | undefined;
    if (p.thumbnailURL?.startsWith('blob:')) {
      try {
        thumbnail = await (await fetch(p.thumbnailURL)).blob();
      } catch {
        // The photo was removed meanwhile and its URL revoked
      }
    }
    records.push({
      id: p.id,
      size: p.source.size,
      lastModified: p.source.lastModified,
      fields: {
        status: p.status, classifications: p.classifications, detections: p.detections,
        selected: p.selected, isSaved: p.isSaved, customLabel: p.customLabel,
        blurScore: p.blurScore, blurRaw: p.blurRaw, blurLevel: p.blurLevel,
        matchedRules: p.matchedRules, metadata: p.metadata,
      },
      embedding: p.embedding ? Float32Array.from(p.embedding) : undefined,
      thumbnail,
    });
  }
  if (records.length === 0) return;
  const db = await openDb();
  const tx = db.transaction(STORE, 'readwrite');
  const store = tx.objectStore(STORE);
  for (const r of records) store.put(r);
  await transactionDone(tx);
}

/**
 * Applies saved progress to freshly scanned photos (same id, size and date): they come back
 * analyzed, with their selection and saved flag, and skip the analysis queue.
 */
export async function restoreProgress(photos: Photo[]): Promise<Photo[]> {
  let db: IDBDatabase;
  try {
    db = await openDb();
  } catch (error) {
    console.warn('Saved progress unavailable:', error);
    return photos;
  }
  const tx = db.transaction(STORE, 'readonly');
  const store = tx.objectStore(STORE);
  const records = await Promise.all(photos.map(p => new Promise<ProgressRecord | undefined>(resolve => {
    const request = store.get(p.id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(undefined);
  })));

  return photos.map((p, i) => {
    const r = records[i];
    if (!r || !p.source || r.size !== p.source.size || r.lastModified !== p.source.lastModified) return p;
    let thumbnailURL = p.thumbnailURL;
    if (r.thumbnail) {
      if (thumbnailURL?.startsWith('blob:')) URL.revokeObjectURL(thumbnailURL);
      thumbnailURL = URL.createObjectURL(r.thumbnail);
    }
    return { ...p, ...r.fields, embedding: r.embedding ? Array.from(r.embedding) : undefined, thumbnailURL };
  });
}

/** Forgets every photo not in keepIds (used after a full phone scan). */
export async function pruneProgress(keepIds: Set<string>): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE, 'readwrite');
  const request = tx.objectStore(STORE).openKeyCursor();
  request.onsuccess = () => {
    const cursor = request.result;
    if (!cursor) return;
    if (!keepIds.has(cursor.primaryKey as string)) tx.objectStore(STORE).delete(cursor.primaryKey);
    cursor.continue();
  };
  await transactionDone(tx);
}
