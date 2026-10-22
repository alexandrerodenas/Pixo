import { useEffect, useRef } from 'react';
import type { Photo } from '../services/types.ts';
import { saveProgress } from '../services/progressStore.ts';

const SAVE_DELAY_MS = 1500;

// Saves photos whose state changed (analysis done, selected, saved...) shortly after the change,
// and right away when the app goes to the background, where Android may kill it.
export const useProgressPersistence = (photos: Map<string, Photo>) => {
  const previousRef = useRef<Map<string, Photo>>(new Map());
  const pendingRef = useRef<Map<string, Photo>>(new Map());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useRef(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    const batch = [...pendingRef.current.values()];
    pendingRef.current.clear();
    if (batch.length > 0) saveProgress(batch).catch(error => console.warn('Could not save progress:', error));
  }).current;

  useEffect(() => {
    // Photo objects are replaced on every change, so identity tells what changed.
    for (const [id, photo] of photos) {
      if (previousRef.current.get(id) !== photo) pendingRef.current.set(id, photo);
    }
    previousRef.current = photos;
    if (pendingRef.current.size > 0 && !timerRef.current) timerRef.current = setTimeout(flush, SAVE_DELAY_MS);
  }, [photos, flush]);

  useEffect(() => {
    const onHide = () => { if (document.visibilityState === 'hidden') flush(); };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, [flush]);
};
