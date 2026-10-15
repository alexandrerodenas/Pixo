import type { Photo } from './types.ts';

// Releases every blob URL held by a photo (original and thumbnail).
export function revokePhotoURLs(photo: Photo): void {
  URL.revokeObjectURL(photo.objectURL);
  if (photo.thumbnailURL) URL.revokeObjectURL(photo.thumbnailURL);
}
