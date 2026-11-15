// Main-thread interface for the face worker (workers/face.worker.ts).

import { confirmModelDownload, markModelsDownloaded } from './downloadGuard.ts';

// Face detector + landmarks + recognition weights, shown in the mobile-data warning
const FACE_MODELS_SIZE_MB = 7;
const STALL_TIMEOUT_MS = 2 * 60 * 1000;

export interface DetectedFace {
  box: { x: number; y: number; width: number; height: number }; // relative to the photo, 0..1
  score: number;
  descriptor: Float32Array;
  thumbnail: Blob | null;
}

let worker: Worker | null = null;
let ready: Promise<void> | null = null;
const pending = new Map<string, { resolve: (faces: DetectedFace[]) => void; reject: (e: Error) => void }>();

function start(): Promise<void> {
  if (ready) return ready;
  ready = confirmModelDownload('faces', FACE_MODELS_SIZE_MB).then(allowed => {
    if (!allowed) throw new Error('Download declined');
    return createWorker();
  });
  ready.catch(() => stopFaceWorker());
  return ready;
}

function createWorker(): Promise<void> {
  worker = new Worker(new URL('../workers/face.worker.ts', import.meta.url), { type: 'module' });
  return new Promise<void>((resolve, reject) => {
    const watchdog = setTimeout(() => reject(new Error('Face model did not respond')), STALL_TIMEOUT_MS);
    worker!.onmessage = (event: MessageEvent) => {
      const msg = event.data;
      if (msg.type === 'initialized') {
        clearTimeout(watchdog);
        markModelsDownloaded('faces');
        resolve();
      } else if (msg.type === 'result') {
        pending.get(msg.photoId)?.resolve(msg.faces);
        pending.delete(msg.photoId);
      } else if (msg.type === 'error') {
        if (msg.photoId) {
          pending.get(msg.photoId)?.reject(new Error(msg.error));
          pending.delete(msg.photoId);
        } else {
          clearTimeout(watchdog);
          reject(new Error(msg.error));
        }
      }
    };
    worker!.onerror = e => {
      clearTimeout(watchdog);
      for (const p of pending.values()) p.reject(new Error(e.message || 'Face worker crashed'));
      pending.clear();
      reject(new Error(e.message));
    };
    worker!.postMessage({ type: 'initialize' });
  });
}

/** Finds the faces in a photo. Rejects when the model cannot load. */
export async function detectFaces(photoId: string, file: Blob): Promise<DetectedFace[]> {
  await start();
  return new Promise((resolve, reject) => {
    pending.set(photoId, { resolve, reject });
    worker!.postMessage({ type: 'detect', photoId, file });
  });
}

export function stopFaceWorker() {
  worker?.terminate();
  worker = null;
  ready = null;
  for (const p of pending.values()) p.reject(new Error('Face recognition stopped'));
  pending.clear();
}
