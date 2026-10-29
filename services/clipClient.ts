// Main-thread interface for the CLIP worker, with the measurements shown in the profile screen.

import { confirmModelDownload, markModelsDownloaded } from './downloadGuard.ts';

// Approximate download of the CLIP model and the ONNX runtime, shown in the mobile-data warning
const CLIP_SIZE_MB = 90;

export interface ClipStats {
  loaded: boolean;
  device?: string;
  loadMs?: number;
  downloadedMB?: number;
  photos: number;
  avgMs?: number;
  /** What the model is doing before the first photo: downloading it, then embedding the labels */
  phase?: 'download' | 'labels';
  progress?: number; // 0..1 within the phase
  error?: string; // set when CLIP could not load: photos then keep their MobileNet labels
}

export type Classification = { label: string; score: number };

let worker: Worker | null = null;
let ready: Promise<void> | null = null;
const pending = new Map<string, { resolve: (c: Classification[]) => void; reject: (e: Error) => void }>();
let totalMs = 0;
const stats: ClipStats = { loaded: false, photos: 0 };
const listeners = new Set<(s: ClipStats) => void>();

const publish = () => listeners.forEach(l => l({ ...stats }));

export function subscribeClipStats(listener: (s: ClipStats) => void): () => void {
  listeners.add(listener);
  listener({ ...stats });
  return () => { listeners.delete(listener); };
}

// A failed load is not retried for every photo (each attempt would download the model again)
const RETRY_AFTER_MS = 5 * 60 * 1000;
const STALL_TIMEOUT_MS = 2 * 60 * 1000;
let failedAt = 0;

function start(): Promise<void> {
  if (ready) return ready;
  if (failedAt && Date.now() - failedAt < RETRY_AFTER_MS) return Promise.reject(new Error(stats.error ?? 'CLIP unavailable'));
  stats.phase = 'download';
  stats.progress = 0;
  stats.error = undefined;
  publish();
  ready = confirmModelDownload('clip', CLIP_SIZE_MB).then(allowed => {
    if (!allowed) throw new Error('Download declined');
    return createWorker();
  });
  ready.catch(error => {
    worker?.terminate();
    worker = null;
    ready = null;
    failedAt = Date.now();
    stats.phase = undefined;
    stats.error = error?.message || 'CLIP unavailable';
    publish();
  });
  return ready;
}

function createWorker(): Promise<void> {
  worker = new Worker(new URL('../workers/clip.worker.ts', import.meta.url), { type: 'module' });
  return new Promise<void>((resolve, reject) => {
    // The worker reports progress all along (download, labels): silence means it is stuck
    let watchdog: ReturnType<typeof setTimeout> | undefined;
    const rearm = () => {
      clearTimeout(watchdog);
      watchdog = setTimeout(() => reject(new Error('CLIP model did not respond')), STALL_TIMEOUT_MS);
    };
    rearm();
    worker!.onmessage = (event: MessageEvent) => {
      const msg = event.data;
      if (msg.type === 'initialized' || msg.type === 'error') clearTimeout(watchdog); else if (ready && !stats.loaded) rearm();
      if (msg.type === 'initialized') {
        failedAt = 0;
        Object.assign(stats, {
          loaded: true, phase: undefined, progress: undefined, error: undefined, device: msg.device, loadMs: msg.loadMs,
          downloadedMB: Math.round(msg.downloadedBytes / 1e5) / 10,
        });
        publish();
        markModelsDownloaded('clip');
        resolve();
      } else if (msg.type === 'progress') {
        stats.phase = msg.phase;
        stats.progress = msg.total > 0 ? Math.min(1, msg.done / msg.total) : 0;
        publish();
      } else if (msg.type === 'result') {
        totalMs += msg.ms;
        stats.photos++;
        stats.avgMs = Math.round(totalMs / stats.photos);
        publish();
        pending.get(msg.photoId)?.resolve(msg.classifications);
        pending.delete(msg.photoId);
      } else if (msg.type === 'error') {
        if (msg.photoId) {
          pending.get(msg.photoId)?.reject(new Error(msg.error));
          pending.delete(msg.photoId);
        } else {
          reject(new Error(msg.error));
        }
      }
    };
    worker!.onerror = e => reject(new Error(e.message));
    worker!.postMessage({ type: 'initialize' });
  });
}

/** Classifies a photo with CLIP. Rejects when the model cannot load: callers fall back to MobileNet. */
export async function classifyWithClip(photoId: string, file: Blob): Promise<Classification[]> {
  await start();
  return new Promise((resolve, reject) => {
    pending.set(photoId, { resolve, reject });
    worker!.postMessage({ type: 'classify', photoId, file });
  });
}
