import { Capacitor, registerPlugin } from '@capacitor/core';

// Android app only: every photo on the phone, through the native PhotoLibrary plugin (MediaStore,
// see android/.../PhotoLibraryPlugin.java). Replaces the folder picker, which Android's WebView lacks.

interface NativePhoto {
  mediaId: number;
  name: string;
  folder: string; // e.g. "DCIM/Camera/"
  size: number;
  lastModified: number;
}

interface PhotoLibraryPlugin {
  checkAccess(): Promise<{ granted: boolean; limited: boolean }>;
  requestAccess(): Promise<{ granted: boolean; limited: boolean }>;
  listPhotos(): Promise<{ photos: NativePhoto[] }>;
  deletePhotos(options: { mediaIds: number[] }): Promise<{ done: number[] }>;
  movePhotos(options: { mediaIds: number[]; folder: string }): Promise<{ done: number[] }>;
  copyPhotos(options: { mediaIds: number[]; folder: string }): Promise<{ done: number[] }>;
  getDeviceName(): Promise<{ name: string }>;
}

const PhotoLibrary = registerPlugin<PhotoLibraryPlugin>('PhotoLibrary');

// Served by PhotoLibraryWebViewClient.java
const MEDIA_ENDPOINT = '/_pixo_media';
// Photos per system consent dialog; keeps each request well under Android's IPC size limit
const BATCH_SIZE = 500;

export interface PhoneScanEntry {
  id: string; // "DCIM/Camera/IMG_0001.jpg", the photo's id in the app
  url: string; // full-size photo
  thumbnailURL: string; // small system thumbnail
  size: number;
  lastModified: number;
}

// App photo id -> MediaStore id, filled by the last scan
const mediaIds = new Map<string, number>();

export const isPhoneLibrary = (): boolean => Capacitor.getPlatform() === 'android';

export async function hasPhotoAccess(): Promise<boolean> {
  return (await PhotoLibrary.checkAccess()).granted;
}

export async function requestPhotoAccess(): Promise<boolean> {
  return (await PhotoLibrary.requestAccess()).granted;
}

/** Lists every photo on the phone, newest first. `generation` makes the URLs unique to this scan. */
export async function scanPhone(generation: number): Promise<PhoneScanEntry[]> {
  const { photos } = await PhotoLibrary.listPhotos();
  mediaIds.clear();
  const entries: PhoneScanEntry[] = [];
  for (const p of photos) {
    let id = `${p.folder}${p.name}`;
    // Same path on two storage volumes (internal and SD card)
    if (mediaIds.has(id)) id = `${id} (${p.mediaId})`;
    mediaIds.set(id, p.mediaId);
    entries.push({
      id,
      url: `${MEDIA_ENDPOINT}?id=${p.mediaId}&g=${generation}`,
      thumbnailURL: `${MEDIA_ENDPOINT}?id=${p.mediaId}&thumb=1`,
      size: p.size,
      lastModified: p.lastModified,
    });
  }
  return entries;
}

/**
 * Runs a native batch operation on photos by app id, one consent dialog per batch, and returns the
 * ids it succeeded on. A cancelled dialog leaves that batch untouched.
 */
async function runInBatches(ids: string[], run: (mediaIds: number[]) => Promise<{ done: number[] }>): Promise<Set<string>> {
  const byMediaId = new Map<number, string>();
  for (const id of ids) {
    const mediaId = mediaIds.get(id);
    if (mediaId !== undefined) byMediaId.set(mediaId, id);
  }
  const all = [...byMediaId.keys()];
  const done = new Set<string>();
  for (let i = 0; i < all.length; i += BATCH_SIZE) {
    try {
      const result = await run(all.slice(i, i + BATCH_SIZE));
      for (const mediaId of result.done) {
        const id = byMediaId.get(mediaId);
        if (id) done.add(id);
      }
    } catch (error) {
      if ((error as { code?: string }).code !== 'CANCELLED') console.error('Photo operation failed:', error);
    }
  }
  return done;
}

/** Moves photos to the trash (Android 11+, recoverable for 30 days) or deletes them (older versions). */
export const deletePhotos = (ids: string[]) => runInBatches(ids, mediaIds => PhotoLibrary.deletePhotos({ mediaIds }));

/** Moves or copies photos into Pictures/<folder>. */
export const transferPhotos = (ids: string[], folder: string, operation: 'copy' | 'move') =>
  runInBatches(ids, mediaIds => operation === 'move' ? PhotoLibrary.movePhotos({ mediaIds, folder }) : PhotoLibrary.copyPhotos({ mediaIds, folder }));

/** First name guessed from the phone's name ("Alex's Pixel", "Galaxy S24 de Alex"), or ''. */
export async function guessOwnerFirstName(): Promise<string> {
  if (!isPhoneLibrary()) return '';
  try {
    const { name } = await PhotoLibrary.getDeviceName();
    return ownerFromDeviceName(name);
  } catch {
    return '';
  }
}

export function ownerFromDeviceName(deviceName: string): string {
  const name = deviceName.trim();
  const match =
    name.match(/^(\p{L}[\p{L}\-]*)['’]s?\s/u) ?? // Alex's Pixel, Thomas' Galaxy
    name.match(/\s(?:de|d['’]|di|von|van)\s*(\p{L}[\p{L}\-]*)$/u) ?? // Galaxy S24 de Alex, iPhone d'Émile
    name.match(/^(\p{L}[\p{L}\-]*)\s+(?:phone|telefon|téléphone)$/iu);
  const first = match?.[1] ?? '';
  return first ? first.charAt(0).toUpperCase() + first.slice(1) : '';
}
