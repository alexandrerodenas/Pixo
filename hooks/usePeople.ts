import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Photo } from '../services/types.ts';
import { PhotoStatus } from '../services/types.ts';
import { FaceIndex, displayName, type FaceRecord, type Person } from '../services/faceIndex.ts';
import { clearFaceData, loadFaceData, saveFaceChanges, type ScanRecord } from '../services/faceStore.ts';
import { detectFaces, stopFaceWorker } from '../services/faceClient.ts';
import { setPhotoPeople, type PhotoPeople } from '../services/peopleRegistry.ts';
import { mergePersonFeature } from '../services/autopilot.ts';
import { t } from '../services/i18n.ts';

// Face recognition, opt-in: once the regular analysis of a photo is done, its faces are looked for
// in the background, one photo at a time, and grouped into people (services/faceIndex.ts).
// A photo is looked at again only when its file changes (size or date).

export type VisiblePerson = Person & { faces: FaceRecord[] };

export interface PeopleState {
  enabled: boolean;
  people: VisiblePerson[];
  /** Photos already looked at, among the analysed ones; loadingModel while the face model downloads */
  progress: { done: number; total: number; loadingModel: boolean };
  error?: string;
  faceUrl: (face: FaceRecord) => string | undefined;
  photoIdsOf: (personId: string) => Set<string>;
  rename: (personId: string, name: string) => void;
  merge: (fromId: string, intoId: string) => void;
  detachFace: (faceId: string) => void;
  clearAll: () => Promise<void>;
}

const isFinished = (p: Photo) => p.status === PhotoStatus.ANALYZED || p.status === PhotoStatus.UNCATEGORIZED;
const fingerprintOf = (p: Photo) => ({ size: p.source?.size ?? p.metadata?.size ?? 0, lastModified: p.source?.lastModified ?? 0 });

/**
 * @param onPhotosScanned called with the photos whose faces were just found, so the autopilot can
 *   look at them again (people are among what it learns from).
 */
export function usePeople(photos: Map<string, Photo>, enabled: boolean, onPhotosScanned?: (photoIds: string[]) => void): PeopleState {
  const onScannedRef = useRef(onPhotosScanned);
  onScannedRef.current = onPhotosScanned;
  const indexRef = useRef<FaceIndex | null>(null);
  const scansRef = useRef(new Map<string, ScanRecord>());
  const failedRef = useRef(new Set<string>());
  const urlsRef = useRef(new Map<string, string>());
  const busyRef = useRef(false);
  const photosRef = useRef(photos);
  photosRef.current = photos;

  const [ready, setReady] = useState(false);
  const [version, setVersion] = useState(0);
  const [loadingModel, setLoadingModel] = useState(false);
  const modelReadyRef = useRef(false);
  const [error, setError] = useState<string>();
  const bump = useCallback(() => setVersion(v => v + 1), []);

  const revokeUrls = () => {
    for (const url of urlsRef.current.values()) URL.revokeObjectURL(url);
    urlsRef.current.clear();
  };

  // Who is on each photo, for the autopilot's features
  const publishToAutopilot = useCallback(() => {
    const index = indexRef.current;
    if (!index) { setPhotoPeople(new Map(), new Map()); return; }
    const byPhoto = new Map<string, PhotoPeople>();
    for (const photoId of scansRef.current.keys()) byPhoto.set(photoId, { people: [], faces: 0 });
    for (const face of index.faces.values()) {
      const entry = byPhoto.get(face.photoId) ?? { people: [], faces: 0 };
      entry.faces++;
      if (!entry.people.includes(face.personId)) entry.people.push(face.personId);
      byPhoto.set(face.photoId, entry);
    }
    const names = new Map<string, string>();
    for (const person of index.people.values()) names.set(person.id, displayName(person, t('people.default')));
    setPhotoPeople(byPhoto, names);
  }, []);

  // Load what is already known, or stop everything when the feature is off
  useEffect(() => {
    if (!enabled) {
      stopFaceWorker();
      indexRef.current = null;
      modelReadyRef.current = false;
      setPhotoPeople(new Map(), new Map());
      setReady(false);
      return;
    }
    let cancelled = false;
    loadFaceData().then(({ faces, people, scans }) => {
      if (cancelled) return;
      indexRef.current = new FaceIndex(faces, people);
      scansRef.current = new Map(scans.map(s => [s.photoId, s]));
      publishToAutopilot();
      setReady(true);
      bump();
    }).catch(e => setError(e?.message ?? String(e)));
    return () => { cancelled = true; };
  }, [enabled, bump, publishToAutopilot]);

  useEffect(() => () => { stopFaceWorker(); revokeUrls(); }, []);

  const needsScan = useCallback((p: Photo) => {
    if (!isFinished(p) || failedRef.current.has(p.id)) return false;
    const scan = scansRef.current.get(p.id);
    const fp = fingerprintOf(p);
    return !scan || scan.size !== fp.size || scan.lastModified !== fp.lastModified;
  }, []);

  const persist = useCallback(async (scans?: ScanRecord[]) => {
    const index = indexRef.current;
    if (!index) return;
    const { merges, ...changes } = index.takeChanges();
    for (const [from, into] of merges) mergePersonFeature(from, into);
    publishToAutopilot();
    for (const id of changes.removedFaces) {
      const url = urlsRef.current.get(id);
      if (url) { URL.revokeObjectURL(url); urlsRef.current.delete(id); }
    }
    try {
      await saveFaceChanges({ ...changes, scans });
    } catch (e) {
      console.warn('Could not save faces:', e);
    }
  }, [publishToAutopilot]);

  // Background queue: one photo at a time, so the regular analysis keeps the priority
  const run = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      while (indexRef.current) {
        let photo: Photo | undefined;
        for (const p of photosRef.current.values()) if (needsScan(p)) { photo = p; break; }
        if (!photo) break;
        try {
          const blob = await (await fetch(photo.objectURL)).blob();
          if (!modelReadyRef.current) setLoadingModel(true);
          const faces = await detectFaces(photo.id, blob).finally(() => setLoadingModel(false));
          modelReadyRef.current = true;
          const index = indexRef.current;
          if (!index) break;
          index.setPhotoFaces(photo.id, faces.map(f => ({
            box: f.box, score: f.score, descriptor: f.descriptor, thumbnail: f.thumbnail ?? undefined,
          })));
          const scan = { photoId: photo.id, ...fingerprintOf(photo) };
          scansRef.current.set(photo.id, scan);
          await persist([scan]);
          onScannedRef.current?.([photo.id]);
          setError(undefined);
          bump();
        } catch (e: any) {
          // The model could not load: stop here, the queue starts again with the next photo change
          if (!photo.objectURL || /model|declined|worker|stopped/i.test(e?.message ?? '')) {
            setError(e?.message ?? String(e));
            break;
          }
          failedRef.current.add(photo.id);
          bump();
        }
      }
    } finally {
      busyRef.current = false;
    }
  }, [needsScan, persist, bump]);

  useEffect(() => {
    if (enabled && ready) run();
  }, [photos, enabled, ready, run]);

  const progress = useMemo(() => {
    let done = 0, total = 0;
    if (indexRef.current) {
      for (const p of photos.values()) {
        if (!isFinished(p)) continue;
        total++;
        if (!needsScan(p)) done++;
      }
    }
    return { done, total, loadingModel };
  }, [photos, version, loadingModel, needsScan]);

  const people = useMemo(() => {
    const index = indexRef.current;
    if (!index) return [];
    return index.visiblePeople(new Set(photos.keys()));
  }, [photos, version]);

  const faceUrl = useCallback((face: FaceRecord) => {
    if (!face.thumbnail) return undefined;
    let url = urlsRef.current.get(face.id);
    if (!url) {
      url = URL.createObjectURL(face.thumbnail);
      urlsRef.current.set(face.id, url);
    }
    return url;
  }, []);

  const photoIdsOf = useCallback((personId: string) => {
    const index = indexRef.current;
    return new Set(index ? index.membersOf(personId).map(f => f.photoId) : []);
  }, [version]); // eslint-disable-line react-hooks/exhaustive-deps

  const edit = useCallback((change: (index: FaceIndex) => void) => {
    const index = indexRef.current;
    if (!index) return;
    change(index);
    persist();
    bump();
  }, [persist, bump]);

  const rename = useCallback((personId: string, name: string) => edit(i => i.rename(personId, name)), [edit]);
  const merge = useCallback((fromId: string, intoId: string) => edit(i => i.merge(fromId, intoId)), [edit]);
  const detachFace = useCallback((faceId: string) => edit(i => { i.detachFace(faceId); }), [edit]);

  const clearAll = useCallback(async () => {
    stopFaceWorker();
    modelReadyRef.current = false;
    await clearFaceData();
    revokeUrls();
    scansRef.current.clear();
    failedRef.current.clear();
    indexRef.current = enabled ? new FaceIndex() : null;
    publishToAutopilot();
    bump();
    if (enabled) run();
  }, [enabled, bump, run, publishToAutopilot]);

  return { enabled, people, progress, error, faceUrl, photoIdsOf, rename, merge, detachFace, clearAll };
}
