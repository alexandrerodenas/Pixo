import { useState, useEffect, useCallback, useRef } from 'react';
import type { Photo } from '../services/types.ts';
import { PhotoStatus } from '../services/types.ts';
import { revokePhotoURLs } from '../services/photoUrls.ts';
import { restoreProgress, pruneProgress } from '../services/progressStore.ts';
import * as phone from '../services/phoneLibrary.ts';

// Parallel file-system operations (deletions)
const MAX_CONCURRENT_FS_OPS = 8;
// Set once the phone was scanned, so the app scans again by itself when it is reopened
const PHONE_SCANNED_KEY = 'pixoPhoneScanned';
// Makes each phone scan's photo URLs unique, so a rescan re-queues photos that need analysis
let scanGeneration = 0;

interface ScannedPhoto {
  id: string;
  objectURL: string;
  thumbnailURL?: string;
  source: { size: number; lastModified: number };
}

// Helper to recursively delete a file by its relative path from a directory handle
async function deleteFileByPath(dirHandle: FileSystemDirectoryHandle, path: string): Promise<boolean> {
  const pathParts = path.split('/');
  const fileName = pathParts.pop();
  if (!fileName) return false;

  try {
    let currentDirHandle = dirHandle;
    for (const part of pathParts) {
      currentDirHandle = await currentDirHandle.getDirectoryHandle(part, { create: false });
    }
    await currentDirHandle.removeEntry(fileName);
    return true;
  } catch (error) {
    console.error(`Failed to delete file ${path}:`, error);
    return false;
  }
}

// Helper to get a file handle by its relative path
async function getFileHandleByPath(dirHandle: FileSystemDirectoryHandle, path: string): Promise<FileSystemFileHandle | null> {
  const pathParts = path.split('/');
  const fileName = pathParts.pop();
  if (!fileName) return null;

  try {
    let currentDirHandle = dirHandle;
    for (const part of pathParts) {
      currentDirHandle = await currentDirHandle.getDirectoryHandle(part, { create: false });
    }
    return await currentDirHandle.getFileHandle(fileName);
  } catch (error) {
    console.error(`Could not get handle for file ${path}:`, error);
    return null;
  }
}

// Returns a file name that does not exist yet in dirHandle, suffixing " (n)" before the extension if needed.
// Names already handed out in this batch are tracked in `reserved` so two sources never get the same target.
async function getAvailableFileName(dirHandle: FileSystemDirectoryHandle, fileName: string, reserved: Set<string>): Promise<string> {
  const dotIndex = fileName.lastIndexOf('.');
  const base = dotIndex > 0 ? fileName.slice(0, dotIndex) : fileName;
  const ext = dotIndex > 0 ? fileName.slice(dotIndex) : '';

  for (let n = 0; ; n++) {
    const candidate = n === 0 ? fileName : `${base} (${n})${ext}`;
    if (reserved.has(candidate.toLowerCase())) continue;
    try {
      await dirHandle.getFileHandle(candidate);
    } catch (error) {
      if ((error as DOMException).name === 'NotFoundError') {
        reserved.add(candidate.toLowerCase());
        return candidate;
      }
      throw error;
    }
  }
}


export const useFileSystem = (
    directoryHandleRef: React.MutableRefObject<FileSystemDirectoryHandle | null>,
    photos: Map<string, Photo>,
    setPhotos: React.Dispatch<React.SetStateAction<Map<string, Photo>>>,
    setStatusMessage: (message: string) => void
) => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isApiSupported, setIsApiSupported] = useState<boolean>(true);

  // Check for API support on mount
  useEffect(() => {
    if (phone.isPhoneLibrary()) return;
    if (!window.showDirectoryPicker) {
      setIsApiSupported(false);
      setStatusMessage('Browser not supported. Use Chrome or Edge for directory access.');
      console.warn("File System Access API (`showDirectoryPicker`) is not supported in this browser.");
    }
  }, [setStatusMessage]);

  // Lists the photos of a folder the user picks (browser).
  const scanFolder = useCallback(async (): Promise<ScannedPhoto[]> => {
    const handle = await window.showDirectoryPicker();
    directoryHandleRef.current = handle;
    setIsLoading(true);
    setStatusMessage('Scanning directory...');

    const filesToProcess: { path: string, handle: FileSystemFileHandle }[] = [];
    async function getFilesRecursively(dirHandle: FileSystemDirectoryHandle, path: string) {
      for await (const entry of (dirHandle as any).values()) {
        const newPath = path ? `${path}/${entry.name}` : entry.name;
        if (entry.kind === 'file' && entry.name.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
          filesToProcess.push({ path: newPath, handle: entry as FileSystemFileHandle });
        } else if (entry.kind === 'directory') {
          await getFilesRecursively(entry as FileSystemDirectoryHandle, newPath);
        }
      }
    }
    await getFilesRecursively(handle, '');

    return Promise.all(filesToProcess.map(async ({ path, handle }) => {
      const file = await handle.getFile();
      return { id: path, objectURL: URL.createObjectURL(file), source: { size: file.size, lastModified: file.lastModified } };
    }));
  }, [directoryHandleRef, setStatusMessage]);

  // Lists every photo on the phone (Android app), asking for access the first time.
  const scanPhone = useCallback(async (): Promise<ScannedPhoto[]> => {
    if (!(await phone.hasPhotoAccess()) && !(await phone.requestPhotoAccess())) {
      throw new DOMException('Photo access denied', 'NotAllowedError');
    }
    setIsLoading(true);
    setStatusMessage('Scanning your phone...');
    const entries = await phone.scanPhone(++scanGeneration);
    try { localStorage.setItem(PHONE_SCANNED_KEY, '1'); } catch { /* not critical */ }
    return entries.map(e => ({ id: e.id, objectURL: e.url, thumbnailURL: e.thumbnailURL, source: { size: e.size, lastModified: e.lastModified } }));
  }, [setStatusMessage]);

  const handleLoadPhotos = useCallback(async () => {
    if (!isApiSupported) return;

    try {
      const isPhone = phone.isPhoneLibrary();
      const scanned = isPhone ? await scanPhone() : await scanFolder();
      setPhotos(new Map());

      if (scanned.length === 0) {
        setStatusMessage(isPhone ? 'No photos found on this phone.' : 'No photos found in this directory. Try another one!');
        setIsLoading(false);
        return;
      }

      setStatusMessage(`Found ${scanned.length} photos. Restoring previous progress...`);

      // Revoke old blob URLs to prevent memory leak
      for (const photo of photos.values()) {
        revokePhotoURLs(photo);
      }

      const restored = await restoreProgress(scanned.map(({ id, objectURL, thumbnailURL, source }) => ({
        id,
        objectURL,
        thumbnailURL,
        source,
        status: PhotoStatus.QUEUED,
        classifications: [],
        detections: [],
        selected: false,
      })));
      // A phone scan sees every photo: forget the ones that are gone.
      if (isPhone) pruneProgress(new Set(scanned.map(p => p.id))).catch(console.warn);

      setPhotos(new Map(restored.map(p => [p.id, p]))); // Add all photos at once for initial render
      // The usePhotoAnalysis hook will pick up the 'QUEUED' photos.

    } catch (error) {
      const name = (error as DOMException).name;
      if (name === 'AbortError') {
        setStatusMessage('Directory selection cancelled.');
      } else if (name === 'NotAllowedError') {
        setStatusMessage('Pixo needs access to your photos. Allow it in the phone settings, then try again.');
      } else {
        console.error('Error loading photos:', error);
        setStatusMessage('Could not load photos. Check console for details.');
      }
      setIsLoading(false);
    }
  }, [isApiSupported, photos, scanFolder, scanPhone, setPhotos, setStatusMessage]);

  // Android app: when it is reopened (or restarted by the system), scan the phone again right away.
  const autoScanDoneRef = useRef(false);
  useEffect(() => {
    if (autoScanDoneRef.current || !phone.isPhoneLibrary()) return;
    autoScanDoneRef.current = true;
    let scannedBefore = false;
    try { scannedBefore = localStorage.getItem(PHONE_SCANNED_KEY) === '1'; } catch { /* not critical */ }
    if (!scannedBefore) return;
    phone.hasPhotoAccess().then(granted => { if (granted) handleLoadPhotos(); }).catch(console.warn);
  }, [handleLoadPhotos]);

  const handleDeletePhotos = useCallback(async (photosToDelete: Photo[]) => {
    if (photosToDelete.length === 0) return;
    const isPhone = phone.isPhoneLibrary();
    if (!isPhone && !directoryHandleRef.current) return;

    setStatusMessage(`Deleting ${photosToDelete.length} photo(s)...`);

    // Delete a few files at a time, then remove from the UI only those really deleted,
    // so a failed deletion stays visible instead of silently disappearing.
    let deleted: Photo[] = [];
    if (isPhone) {
      // One system confirmation for the whole batch
      const done = await phone.deletePhotos(photosToDelete.map(p => p.id));
      deleted = photosToDelete.filter(p => done.has(p.id));
    } else {
      const queue = [...photosToDelete];
      const deleteNext = async (): Promise<void> => {
        const p = queue.shift();
        if (!p) return;
        if (await deleteFileByPath(directoryHandleRef.current!, p.id)) deleted.push(p);
        return deleteNext();
      };
      await Promise.all(Array.from({ length: Math.min(MAX_CONCURRENT_FS_OPS, queue.length) }, deleteNext));
    }

    const deletedIds = new Set(deleted.map(p => p.id));
    setPhotos(prevPhotos => {
      const newPhotos = new Map(prevPhotos);
      deletedIds.forEach(id => newPhotos.delete(id));
      return newPhotos;
    });
    deleted.forEach(revokePhotoURLs);

    if (deleted.length < photosToDelete.length) {
      setStatusMessage(`Deleted ${deleted.length} of ${photosToDelete.length} photos. ${photosToDelete.length - deleted.length} could not be deleted and are still shown.`);
    } else {
      setStatusMessage(`Successfully deleted ${deleted.length} photos. ✅`);
    }
  }, [directoryHandleRef, setPhotos, setStatusMessage]);

  const handleMoveSaved = useCallback(async (savedPhotos: Photo[], savedFolderName: string, operation: 'copy' | 'move' = 'move') => {
    if (savedPhotos.length === 0) return;

    if (phone.isPhoneLibrary()) {
      if (!window.confirm(`This will ${operation} ${savedPhotos.length} photo(s) to Pictures/${savedFolderName}. Continue?`)) return;
      setStatusMessage(`${operation === 'move' ? 'Moving' : 'Copying'} ${savedPhotos.length} photo(s)...`);
      const done = await phone.transferPhotos(savedPhotos.map(p => p.id), savedFolderName, operation);
      if (operation === 'move') {
        setPhotos(prev => {
          const newPhotos = new Map(prev);
          done.forEach(id => {
            const photo = newPhotos.get(id);
            if (photo) {
              revokePhotoURLs(photo);
              newPhotos.delete(id);
            }
          });
          return newPhotos;
        });
      }
      const failed = savedPhotos.length - done.size;
      setStatusMessage(failed > 0
        ? `${operation === 'move' ? 'Moved' : 'Copied'} ${done.size} photos. ${failed} were not.`
        : `Successfully ${operation === 'move' ? 'moved' : 'copied'} ${done.size} photos to Pictures/${savedFolderName}. ✅`);
      return;
    }

    if (!directoryHandleRef.current) return;

    if (!window.confirm(`This will ${operation} ${savedPhotos.length} photo(s) to a new directory. This action is permanent. Continue?`)) {
      return;
    }

    let destDirHandle: FileSystemDirectoryHandle;
    try {
      destDirHandle = await window.showDirectoryPicker({
        title: `Select Destination Directory for Saved Photos (${operation})`
      });
    } catch (error) {
      if ((error as DOMException).name === 'AbortError') {
        setStatusMessage('Destination selection cancelled.');
      } else {
        setStatusMessage('Could not open destination directory.');
        console.error(error);
      }
      return;
    }

    try {
      setStatusMessage(`Preparing to ${operation} files...`);
      const targetSubDir = await destDirHandle.getDirectoryHandle(savedFolderName, { create: true });

      const processedPhotoIds: string[] = [];
      const failedOperations: string[] = [];
      const reservedNames = new Set<string>();

      for (const photo of savedPhotos) {
        setStatusMessage(`${operation === 'move' ? 'Moving' : 'Copying'} ${photo.id}...`);
        const sourceHandle = directoryHandleRef.current;
        const sourceFileHandle = await getFileHandleByPath(sourceHandle, photo.id);

        if (!sourceFileHandle) {
          console.error(`Could not find source file for ${photo.id}`);
          failedOperations.push(photo.id);
          continue;
        }

        try {
          const fileData = await sourceFileHandle.getFile();
          // Never overwrite: photos from different subfolders often share a name (IMG_0001.jpg).
          const targetName = await getAvailableFileName(targetSubDir, fileData.name, reservedNames);
          const newFileHandle = await targetSubDir.getFileHandle(targetName, { create: true });
          const writable = await newFileHandle.createWritable();
          await writable.write(fileData);
          await writable.close();

          // Only remove the original once the copy is verified on disk.
          const written = await newFileHandle.getFile();
          if (written.size !== fileData.size) {
            throw new Error(`Copy of ${photo.id} is incomplete (${written.size}/${fileData.size} bytes)`);
          }

          let processed = true;
          if (operation === 'move') {
            processed = await deleteFileByPath(sourceHandle, photo.id);
          }
          
          if (processed) {
            processedPhotoIds.push(photo.id);
          } else {
            console.error(`Error deleting original for ${photo.id}`);
            failedOperations.push(photo.id);
          }
        } catch (opError) {
          console.error(`Error ${operation}ing file ${photo.id}:`, opError);
          failedOperations.push(photo.id);
        }
      }

      setPhotos(prev => {
        const newPhotos = new Map(prev);
        if (operation === 'move') {
          processedPhotoIds.forEach(id => {
            const photo = newPhotos.get(id);
            if (photo) {
              revokePhotoURLs(photo);
              newPhotos.delete(id);
            }
          });
        }
        return newPhotos;
      });

      if (failedOperations.length > 0) {
        setStatusMessage(`${operation === 'move' ? 'Moved' : 'Copied'} ${processedPhotoIds.length} photos. ${failedOperations.length} failed.`);
      } else {
        setStatusMessage(`Successfully ${operation === 'move' ? 'moved' : 'copied'} ${processedPhotoIds.length} photos to "${savedFolderName}". ✅`);
      }

    } catch(err) {
      setStatusMessage(`An error occurred during the ${operation} operation.`);
      console.error(err);
    }
  }, [directoryHandleRef, setPhotos, setStatusMessage]);

  // This effect is to manage the global loading state based on analysis progress.
  // It's a bit of a grey area, but FileSystem is the "entry point" for loading.
  useEffect(() => {
    const photoArray = Array.from(photos.values());
    const total = photoArray.length;
    const processed = photoArray.filter(p => p.status !== PhotoStatus.QUEUED && p.status !== PhotoStatus.ANALYZING).length;

    if (total > 0 && processed === total && isLoading) {
      setIsLoading(false);
      setStatusMessage(`Analysis complete! ${total} photos ready. ✅`);
    } else if (isLoading && total > 0) {
      setStatusMessage(`Analyzing... (${processed}/${total})`);
    }

  }, [photos, isLoading, setStatusMessage]);


  return { isLoading, isApiSupported, handleLoadPhotos, handleDeletePhotos, handleMoveSaved };
};