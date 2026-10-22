// Client-side interface for the analysis Web Worker
// Manages worker lifecycle, message passing, and cleanup

import { confirmModelDownload, markModelsDownloaded } from './downloadGuard.ts';

type ErrorCallback = (error: string, photoId?: string) => void;

let worker: Worker | null = null;
let isWorkerSupported = typeof Worker !== 'undefined';
let isInitialized = false;
let workerBackend: string | null = null;
let pendingResolve: Map<string, { resolve: (value: any) => void; reject: (reason?: any) => void }> = new Map();
let initPromise: Promise<void> | null = null;
let errorSubscriber: ErrorCallback | null = null;
let downloadConfirmed = false;
// Approximate size of MobileNet + COCO-SSD, shown in the mobile-data warning
const MODELS_SIZE_MB = 25;

function createWorker(): Worker | null {
  if (!isWorkerSupported) return null;
  try {
    return new Worker(new URL('../workers/analysis.worker.ts', import.meta.url), { type: 'module' });
  } catch (e) {
    console.warn('Failed to create analysis worker, falling back to main thread:', e);
    isWorkerSupported = false;
    return null;
  }
}

function handleWorkerMessage(event: MessageEvent) {
  const msg = event.data;

  switch (msg.type) {
    case 'initialized':
      isInitialized = true;
      markModelsDownloaded('tf');
      workerBackend = msg.backend ?? null;
      break;

    case 'result': {
      const pending = pendingResolve.get(msg.photoId);
      if (pending) {
        pendingResolve.delete(msg.photoId);
        pending.resolve(msg);
      }
      break;
    }

    case 'error': {
      const pending = pendingResolve.get(msg.photoId);
      if (pending) {
        pendingResolve.delete(msg.photoId);
        pending.reject(new Error(msg.error));
      }
      // Notify error subscriber
      errorSubscriber?.(msg.error, msg.photoId);
      break;
    }
  }
}

function handleWorkerError(event: ErrorEvent) {
  console.error('Analysis worker error:', event.message);
  // A crashed worker never answers: fail every pending analysis instead of hanging the queue.
  for (const pending of pendingResolve.values()) {
    pending.reject(new Error(event.message || 'Analysis worker crashed'));
  }
  pendingResolve.clear();
  errorSubscriber?.(event.message);
}

export async function ensureWorkerInitialized(): Promise<void> {
  if (isInitialized) return;
  if (initPromise) return initPromise;

  // Nothing is downloaded before the user agreed, when the models are not on the phone yet and it uses mobile data
  if (!downloadConfirmed) {
    initPromise = confirmModelDownload('tf', MODELS_SIZE_MB).then(() => {
      downloadConfirmed = true;
      initPromise = null;
      return ensureWorkerInitialized();
    });
    return initPromise;
  }

  if (!worker) {
    worker = createWorker();
    if (!worker) {
      initPromise = Promise.reject(new Error('Workers not supported'));
      return initPromise;
    }
    worker.onmessage = handleWorkerMessage;
    worker.onerror = handleWorkerError;
  }

  initPromise = new Promise<void>((resolve, reject) => {
    // Model download can be slow on a cold cache
    const timeout = setTimeout(() => {
      worker!.removeEventListener('message', handler as any);
      reject(new Error('Worker initialization timed out'));
    }, 60000);

    const handler = (event: MessageEvent) => {
      if (event.data.type === 'initialized' || (event.data.type === 'error' && !event.data.photoId)) {
        clearTimeout(timeout);
        worker!.removeEventListener('message', handler as any);
        if (event.data.type === 'initialized') {
          isInitialized = true;
          markModelsDownloaded('tf');
          resolve();
        } else {
          reject(new Error(event.data.error));
        }
      }
    };
    worker!.addEventListener('message', handler as any);

    worker!.postMessage({ type: 'initialize' });
  });

  return initPromise;
}

export interface AnalyzeOptions {
  file: Blob;
  photoId: string;
  blurThreshold?: number;
  sharpThreshold?: number;
}

export function analyzePhoto(options: AnalyzeOptions): Promise<any> {
  return new Promise(async (resolve, reject) => {
    if (!isWorkerSupported) {
      reject(new Error('Worker not available'));
      return;
    }

    // Ensure worker is initialized (waits for the mobile-data answer when the models must be downloaded)
    try {
      await ensureWorkerInitialized();
    } catch (e) {
      reject(e);
      return;
    }
    if (!worker) {
      reject(new Error('Worker not available'));
      return;
    }

    const { photoId } = options;

    // Store pending promise
    pendingResolve.set(photoId, { resolve, reject });

    // Send analysis request. Blobs are passed by reference, not copied or base64-encoded.
    worker.postMessage({
      type: 'analyze',
      ...options,
    });
  });
}

export function onAnalysisError(callback: ErrorCallback) {
  errorSubscriber = callback;
}

export function terminateWorker() {
  if (worker) {
    worker.postMessage({ type: 'terminate' });
    worker.terminate();
    worker = null;
  }
  isInitialized = false;
  workerBackend = null;
  initPromise = null;
  pendingResolve.clear();
}

export function isWorkerActive(): boolean {
  return worker !== null && isInitialized;
}

export function getWorkerBackend(): string | null {
  return workerBackend;
}
