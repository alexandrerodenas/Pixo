// Main-thread interface for the CLIP worker, with the measurements shown in the profile screen.

export interface ClipStats {
  loaded: boolean;
  device?: string;
  loadMs?: number;
  downloadedMB?: number;
  photos: number;
  avgMs?: number;
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

function start(): Promise<void> {
  if (ready) return ready;
  worker = new Worker(new URL('../workers/clip.worker.ts', import.meta.url), { type: 'module' });
  ready = new Promise<void>((resolve, reject) => {
    worker!.onmessage = (event: MessageEvent) => {
      const msg = event.data;
      if (msg.type === 'initialized') {
        Object.assign(stats, {
          loaded: true, device: msg.device, loadMs: msg.loadMs,
          downloadedMB: Math.round(msg.downloadedBytes / 1e5) / 10,
        });
        publish();
        resolve();
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
  ready.catch(() => { worker?.terminate(); worker = null; ready = null; });
  return ready;
}

/** Classifies a photo with CLIP. Rejects when the model cannot load: callers fall back to MobileNet. */
export async function classifyWithClip(photoId: string, file: Blob): Promise<Classification[]> {
  await start();
  return new Promise((resolve, reject) => {
    pending.set(photoId, { resolve, reject });
    worker!.postMessage({ type: 'classify', photoId, file });
  });
}
