import { isOnMobileData } from './phoneLibrary.ts';

// Asks the user before the AI models are downloaded over mobile data. The models are cached by the
// browser, so the question is only asked while they have never been downloaded on this phone.

export interface DownloadRequest {
  sizeMB: number;
  resolve: (allowed: boolean) => void;
}

const DOWNLOADED_KEY = 'pixo.modelsDownloaded.';
let listener: ((request: DownloadRequest | null) => void) | null = null;
const approved = new Set<string>();
const inFlight = new Map<string, Promise<boolean>>();

export const subscribeDownloadRequests = (callback: (request: DownloadRequest | null) => void) => {
  listener = callback;
  return () => { if (listener === callback) listener = null; };
};

export function markModelsDownloaded(kind: string) {
  try { localStorage.setItem(DOWNLOADED_KEY + kind, '1'); } catch { /* not critical */ }
}

const alreadyDownloaded = (kind: string) => {
  try { return localStorage.getItem(DOWNLOADED_KEY + kind) === '1'; } catch { return false; }
};

/** Resolves true when the download can start now: models already on the phone, Wi-Fi, or the user agreed. */
export function confirmModelDownload(kind: string, sizeMB: number): Promise<boolean> {
  if (alreadyDownloaded(kind) || approved.has(kind)) return Promise.resolve(true);
  const pending = inFlight.get(kind);
  if (pending) return pending;

  const promise = (async () => {
    if (!(await isOnMobileData()) || !listener) return true;
    const allowed = await new Promise<boolean>(resolve => listener!({ sizeMB, resolve }));
    if (allowed) approved.add(kind);
    return allowed;
  })().finally(() => inFlight.delete(kind));
  inFlight.set(kind, promise);
  return promise;
}
