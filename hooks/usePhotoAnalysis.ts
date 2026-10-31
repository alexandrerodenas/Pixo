
import { useState, useEffect, useCallback, useRef } from 'react';
import type { UserProfile, Photo, FilterRule, Prediction, ModelsLoadState } from '../services/types.ts';
import { PhotoStatus } from '../services/types.ts';
import * as api from '../services/api.ts';
import { classifyWithClip } from '../services/clipClient.ts';
import { autopilotMatch } from '../services/autopilot.ts';


type PhotoPatch = (photo: Photo | undefined) => Photo | undefined;

const MAX_CONCURRENT_ANALYSES = 3; // To prevent browser from freezing
const FLUSH_INTERVAL_MS = 250; // Analysis results are applied to state in batches

export const usePhotoAnalysis = (
    photos: Map<string, Photo>,
    setPhotos: React.Dispatch<React.SetStateAction<Map<string, Photo>>>,
    userProfileRef: React.RefObject<UserProfile>,
    applyRules: (predictions: Prediction[], rules: FilterRule[]) => string[],
) => {
  const [tfBackend, setTfBackend] = useState<string | null>(null);
  const [modelsLoadState, setModelsLoadState] = useState<ModelsLoadState>({ classification: 'idle', detection: 'idle' });

  const photosRef = useRef(photos);
  photosRef.current = photos;
  const applyRulesRef = useRef(applyRules);
  applyRulesRef.current = applyRules;

  const queueRef = useRef<string[]>([]);
  // Blob URLs already queued; unique per directory load, so re-opening the same folder re-queues it.
  const enqueuedRef = useRef<Set<string>>(new Set());
  const activeCountRef = useRef(0);
  const pendingPatchesRef = useRef<Array<[string, PhotoPatch]>>([]);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Preload models and subscribe to their loading status on mount
  useEffect(() => {
    api.preloadModels();
    const unsubscribe = api.subscribeToModelStatus(setModelsLoadState);
    return () => unsubscribe(); // Cleanup on unmount
  }, []);

  // Apply all pending patches with a single Map copy instead of one copy per photo update.
  const flushPatches = useCallback(() => {
    flushTimerRef.current = null;
    const patches = pendingPatchesRef.current;
    if (patches.length === 0) return;
    pendingPatchesRef.current = [];
    setPhotos(prev => {
      const next = new Map(prev);
      for (const [id, patch] of patches) {
        const updated = patch(next.get(id));
        if (updated) next.set(id, updated);
      }
      return next;
    });
  }, [setPhotos]);

  const queuePatch = useCallback((id: string, patch: PhotoPatch) => {
    pendingPatchesRef.current.push([id, patch]);
    if (!flushTimerRef.current) flushTimerRef.current = setTimeout(flushPatches, FLUSH_INTERVAL_MS);
  }, [flushPatches]);

  useEffect(() => () => {
    if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
  }, []);

  // Effect to re-evaluate blur levels when user profile thresholds change
  useEffect(() => {
    const blurThreshold = userProfileRef.current?.blurThreshold ?? 100;
    const sharpThreshold = userProfileRef.current?.sharpThreshold ?? 300;

    setPhotos(prevPhotos => {
      const newPhotos = new Map(prevPhotos);
      let hasChanges = false;

      for (const [id, photo] of newPhotos) {
        if (photo.blurRaw !== undefined) {
          let newLevel: 'sharp' | 'ok' | 'blurry';
          if (photo.blurRaw < blurThreshold) newLevel = 'blurry';
          else if (photo.blurRaw > sharpThreshold) newLevel = 'sharp';
          else newLevel = 'ok';

          if (newLevel !== photo.blurLevel) {
            newPhotos.set(id, { ...photo, blurLevel: newLevel });
            hasChanges = true;
          }
        }
      }
      return hasChanges ? newPhotos : prevPhotos;
    });
  }, [userProfileRef.current?.blurThreshold, userProfileRef.current?.sharpThreshold, setPhotos]);

  const analyzePhoto = useCallback(async (photoId: string) => {
    const photoToAnalyze = photosRef.current.get(photoId);
    if (!photoToAnalyze) return;
    const { objectURL } = photoToAnalyze;
    // Ignore results for a photo that was removed or reloaded (same path, new blob URL) meanwhile.
    const isSamePhoto = (p: Photo | undefined): p is Photo => !!p && p.objectURL === objectURL;

    queuePatch(photoId, p => isSamePhoto(p) ? { ...p, status: PhotoStatus.ANALYZING } : p);

    try {
      // Hand the file to the worker as a Blob: no base64 data URL on the main thread.
      const fileBlob = await (await fetch(objectURL)).blob();

      const blurThreshold = userProfileRef.current?.blurThreshold ?? 100;
      const sharpThreshold = userProfileRef.current?.sharpThreshold ?? 300;

      // Use batch analysis (Web Worker if available, fallback to main thread)
      const result = await api.analyzePhotoBatch({
        file: fileBlob,
        photoId,
        blurThreshold,
        sharpThreshold,
      });

      if (userProfileRef.current?.classifier === 'clip') {
        try {
          result.classifications = await classifyWithClip(photoId, fileBlob);
        } catch (error) {
          console.warn('CLIP unavailable, keeping MobileNet results:', error);
        }
      }

      const threshold = userProfileRef.current?.unknownThreshold ?? 10;
      const isUncategorized = result.classifications.length === 0 || result.classifications.every(p => (p.score * 100) < threshold);

      let matchedCustomLabel: string | undefined = undefined;
      const customLabels = userProfileRef.current?.customLabels ?? [];
      if (customLabels.length > 0) {
        const allPhotoLabels = new Set([
          ...result.classifications.map(c => c.label.toLowerCase()),
          ...result.detections.map(d => d.label.toLowerCase())
        ]);

        for (const customLabel of customLabels) {
          if (customLabel.labels.some(l => allPhotoLabels.has(l))) {
            matchedCustomLabel = customLabel.name;
            break;
          }
        }
      }

      const thumbnailURL = result.thumbnail ? URL.createObjectURL(result.thumbnail) : undefined;

      queuePatch(photoId, currentPhoto => {
        if (!isSamePhoto(currentPhoto)) {
          // The photo was deleted, moved or reloaded while it was being analyzed
          if (thumbnailURL) URL.revokeObjectURL(thumbnailURL);
          return currentPhoto;
        }
        const finalStatus = isUncategorized ? PhotoStatus.UNCATEGORIZED : PhotoStatus.ANALYZED;
        const updatedPhoto: Photo = {
          ...currentPhoto,
          status: finalStatus,
          classifications: result.classifications,
          detections: result.detections,
          embedding: result.embedding,
          blurScore: result.blurScore,
          blurRaw: result.blurRaw,
          blurLevel: result.blurLevel,
          metadata: { ...result.metadata, size: fileBlob.size, lastModified: Date.now() },
          customLabel: matchedCustomLabel,
          thumbnailURL,
        };
        if (updatedPhoto.status === PhotoStatus.ANALYZED && (userProfileRef.current?.autoApplyRules || currentPhoto.applyRulesWhenAnalyzed)) {
          const classificationMatches = applyRulesRef.current(updatedPhoto.classifications, userProfileRef.current.classificationRules);
          const detectionMatches = applyRulesRef.current(updatedPhoto.detections, userProfileRef.current.detectionRules);
          const autopilot = userProfileRef.current.autopilot ? autopilotMatch(updatedPhoto, userProfileRef.current.autopilotThreshold) : null;
          if (classificationMatches.length > 0 || detectionMatches.length > 0 || autopilot) {
            updatedPhoto.selected = true;
            updatedPhoto.matchedRules = {
              classification: classificationMatches,
              detection: detectionMatches,
              ...(autopilot ? { autopilot } : {}),
            };
          }
        }
        return updatedPhoto;
      });
    } catch (error) {
      console.error(`Failed to analyze ${photoId}:`, error);
      queuePatch(photoId, p => isSamePhoto(p) ? { ...p, status: PhotoStatus.ERROR, classifications: [], detections: [] } : p);
    }
  }, [queuePatch, userProfileRef]);
  // Fixed-size pool: at most MAX_CONCURRENT_ANALYSES photos are in flight at any time.
  const pump = useCallback(() => {
    while (activeCountRef.current < MAX_CONCURRENT_ANALYSES && queueRef.current.length > 0) {
      const photoId = queueRef.current.shift()!;
      activeCountRef.current++;
      analyzePhoto(photoId).finally(() => {
        activeCountRef.current--;
        pump();
      });
    }
  }, [analyzePhoto]);

  /** Puts every finished photo back in the queue so it is analysed again with the current profile. Returns how many. */
  const reanalyzeAll = useCallback((): number => {
    let count = 0;
    const next = new Map(photosRef.current);
    for (const [id, photo] of next) {
      if (photo.status !== PhotoStatus.ANALYZED && photo.status !== PhotoStatus.UNCATEGORIZED && photo.status !== PhotoStatus.ERROR) continue;
      enqueuedRef.current.delete(photo.objectURL);
      next.set(id, { ...photo, status: PhotoStatus.QUEUED, matchedRules: undefined, customLabel: undefined, applyRulesWhenAnalyzed: undefined });
      count++;
    }
    if (count > 0) setPhotos(next);
    return count;
  }, [setPhotos]);

  /** Lets the photos found at opening go into the queue, optionally applying the rules to them. Returns how many. */
  const startNewPhotosAnalysis = useCallback((applyRulesToThem: boolean): number => {
    let count = 0;
    const next = new Map(photosRef.current);
    for (const [id, photo] of next) {
      if (!photo.awaitingApproval) continue;
      next.set(id, { ...photo, awaitingApproval: false, applyRulesWhenAnalyzed: applyRulesToThem });
      count++;
    }
    if (count > 0) setPhotos(next);
    return count;
  }, [setPhotos]);

  // Queue newly loaded photos
  useEffect(() => {
    let added = false;
    for (const photo of photos.values()) {
      if (photo.status === PhotoStatus.QUEUED && !photo.awaitingApproval && !enqueuedRef.current.has(photo.objectURL)) {
        enqueuedRef.current.add(photo.objectURL);
        queueRef.current.push(photo.id);
        added = true;
      }
    }
    if (added) pump();
  }, [photos, pump]);

  useEffect(() => {
    if (tfBackend) return;
    const backend = api.getTfBackend();
    if (backend) setTfBackend(backend);
  }, [photos, tfBackend]);

  return { tfBackend, modelsLoadState, reanalyzeAll, startNewPhotosAnalysis };
};
