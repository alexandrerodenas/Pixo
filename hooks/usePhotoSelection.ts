import { useState, useMemo, useCallback, useEffect } from 'react';
import type { Photo } from '../services/types.ts';


export const usePhotoSelection = (
    photos: Map<string, Photo>,
    setPhotos: React.Dispatch<React.SetStateAction<Map<string, Photo>>>,
    setStatusMessage: (message: string) => void,
) => {
  const [isolateSelection, setIsolateSelection] = useState<boolean>(false);

  const selectedPhotos = useMemo(() => Array.from(photos.values()).filter(p => p.selected), [photos]);

  useEffect(() => {
    // If the selection becomes empty while in isolation mode, turn it off automatically.
    if (selectedPhotos.length === 0 && isolateSelection) {
      setIsolateSelection(false);
    }
  }, [selectedPhotos.length, isolateSelection]);

  const handleSelectPhoto = (id: string) => {
    setPhotos(prev => {
      const newPhotos = new Map(prev);
      const photo = newPhotos.get(id);
      if (photo) {
        const isBecomingDeselected = photo.selected;
        const update: Partial<Photo> = { selected: !photo.selected };
        if (isBecomingDeselected) {
          update.matchedRules = undefined;
        }
        newPhotos.set(id, { ...photo, ...update });
      }
      return newPhotos;
    });
  };

  const handleToggleIsolateSelection = useCallback(() => {
    // Only allow enabling isolation if photos are selected.
    // Always allow disabling isolation.
    if (selectedPhotos.length > 0 || isolateSelection) {
      setIsolateSelection(prev => !prev);
    }
  }, [selectedPhotos.length, isolateSelection]);

  const selectAllFiltered = useCallback((photosToSelect: Photo[], options?: { isManualApplication?: boolean }) => {
    if (photosToSelect.length === 0) {
      if (options?.isManualApplication) {
        setStatusMessage("Aucune photo ne correspond à tes règles. ✨");
      } else {
        setStatusMessage("Aucune photo ne correspond aux critères pour la sélection.");
      }
      return;
    }

    let newlySelectedCount = 0;
    setPhotos(prevPhotos => {
      const newPhotos = new Map(prevPhotos);
      photosToSelect.forEach(photo => {
        const currentPhoto = newPhotos.get(photo.id);
        if (currentPhoto && !currentPhoto.selected) {
          newPhotos.set(photo.id, { ...currentPhoto, selected: true });
          newlySelectedCount++;
        }
      });
      return newPhotos;
    });

    if (newlySelectedCount > 0) {
      const s = newlySelectedCount === 1 ? '' : 's';
      const context = options?.isManualApplication ? 'based on your rules' : '';
      setStatusMessage(`Selected ${newlySelectedCount} new photo${s} ${context}.`);
    } else {
      const s = photosToSelect.length === 1 ? '' : 's';
      const were = photosToSelect.length === 1 ? 'was' : 'were';
      setStatusMessage(`All ${photosToSelect.length} matching photo${s} ${were} already selected.`);
    }
  }, [setPhotos, setStatusMessage]);

  const clearSelectionFiltered = useCallback((photosToClear: Photo[]) => {
    if (photosToClear.length === 0) {
      setStatusMessage("Aucune photo sélectionnée à effacer.");
      return;
    }

    setPhotos(prevPhotos => {
      const newPhotos = new Map(prevPhotos);
      photosToClear.forEach(photo => {
        const currentPhoto = newPhotos.get(photo.id);
        if (currentPhoto?.selected) {
          newPhotos.set(photo.id, { ...currentPhoto, selected: false, matchedRules: undefined });
        }
      });
      return newPhotos;
    });

    const s = photosToClear.length === 1 ? '' : 's';
    setStatusMessage(`Cleared selection of ${photosToClear.length} photo${s}.`);
  }, [setPhotos, setStatusMessage]);

  return {
    selectedPhotos,
    isolateSelection,
    handleSelectPhoto,
    handleToggleIsolateSelection,
    selectAllFiltered,
    clearSelectionFiltered,
  };
};