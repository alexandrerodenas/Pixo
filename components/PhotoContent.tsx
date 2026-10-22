
import React, { useMemo, useRef, useState, useLayoutEffect } from 'react';
import type { Photo, ThumbnailSize } from '../services/types.ts';
import { PhotoStatus } from '../services/types.ts';
import PhotoGrid from './PhotoGrid.tsx';
import FolderView from './FolderView.tsx';
import ZenMode from './ZenMode.tsx';
import { isPhoneLibrary } from '../services/phoneLibrary.ts';
import { t } from '../services/i18n.ts';
import {
  FolderOpen,
  ArrowDown,
  EyeOff,
  Filter,
  Heart,
  Copy,
  AlertTriangle,
} from 'lucide-react';

interface PhotoContentProps {
  photos: Map<string, Photo>;
  isLoading: boolean;
  filterLabel: string;
  isolateSelection: boolean;
  isolateSaved: boolean;
  isolateDuplicates: boolean;
  isolateBlurry: boolean;
  onSelectPhoto: (id: string) => void;
  onViewPhoto: (photo: Photo) => void;
  thumbnailSize: ThumbnailSize;
  onFilterChange: (label: string) => void;
  onToggleSavePhoto: (id: string) => void;
  onRequestDelete: (photos: Photo[], skipConfirm?: boolean) => void;
  onBulkSave: (photos: Photo[]) => void;
  onMoveSavedPhotos: (photos: Photo[], folderName: string) => void;
  viewMode: 'grid' | 'folder' | 'zen';
  setViewMode: (mode: 'grid' | 'folder' | 'zen') => void;
  savedFolderName: string;
}

const PhotoContent: React.FC<PhotoContentProps> = ({
                                                     photos,
                                                     isLoading,
                                                     filterLabel,
                                                     isolateSelection,
                                                     isolateSaved,
                                                     isolateDuplicates,
                                                     isolateBlurry,
                                                     onSelectPhoto,
                                                     onViewPhoto,
                                                     thumbnailSize,
                                                     onFilterChange,
                                                     onToggleSavePhoto,
                                                     onRequestDelete,
                                                     onBulkSave,
                                                     onMoveSavedPhotos,
                                                     viewMode,
                                                     setViewMode,
                                                     savedFolderName
                                                   }) => {

  const photosToShow = useMemo(() => {
    let photosToReturn = photos;

    if (isolateDuplicates) {
      const isolatedMap = new Map<string, Photo>();
      for (const [id, photo] of photosToReturn.entries()) {
        if (photo.duplicateGroupId) {
          isolatedMap.set(id, photo);
        }
      }
      return isolatedMap;
    }

    if (isolateSaved) {
      const isolatedMap = new Map<string, Photo>();
      for (const [id, photo] of photosToReturn.entries()) {
        if (photo.isSaved) {
          isolatedMap.set(id, photo);
        }
      }
      return isolatedMap;
    }

    if (isolateBlurry) {
      const isolatedMap = new Map<string, Photo>();
      for (const [id, photo] of photosToReturn.entries()) {
        if (photo.blurLevel === 'blurry') {
          isolatedMap.set(id, photo);
        }
      }
      return isolatedMap;
    }

    if (isolateSelection) {
      const isolatedMap = new Map<string, Photo>();
      for (const [id, photo] of photosToReturn.entries()) {
        if (photo.selected) {
          isolatedMap.set(id, photo);
        }
      }
      return isolatedMap;
    }

    return photosToReturn;
  }, [photos, isolateSelection, isolateSaved, isolateDuplicates, isolateBlurry]);

  const filteredPhotosForGrid = useMemo(() => {
    const photosArray = Array.from(photosToShow.values());

    // Sort duplications if active: Group by groupID
    if (isolateDuplicates) {
      photosArray.sort((a, b) => (a.duplicateGroupId || '').localeCompare(b.duplicateGroupId || ''));
      return photosArray;
    }

    // First, filter out unprocessed photos
    const processedPhotos = photosArray.filter(p => p.status !== PhotoStatus.QUEUED && p.status !== PhotoStatus.ANALYZING);

    if (!filterLabel.trim()) {
      return processedPhotos; // Return all processed if no filter
    }

    const lowercasedFilter = filterLabel.toLowerCase();
    // Then apply label filter on the processed photos
    return processedPhotos.filter(p =>
            (p.status === PhotoStatus.ANALYZED || p.status === PhotoStatus.UNCATEGORIZED) && (
                p.customLabel?.toLowerCase().includes(lowercasedFilter) ||
                p.classifications.some(pred => pred.label.toLowerCase().includes(lowercasedFilter)) ||
                p.detections.some(pred => pred.label.toLowerCase().includes(lowercasedFilter))
            )
    );
  }, [photosToShow, filterLabel, isolateDuplicates]);


  const renderContent = () => {
    if (photos.size === 0 && !isLoading) {
      return (
          <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 dark:text-gray-400">
            <FolderOpen className="w-24 h-24 mb-4 text-gray-300 dark:text-gray-600" />
            <h2 className="text-2xl font-semibold">{t('empty.title')}</h2>
            <p className="mt-2 max-w-sm">{isPhoneLibrary() ? t('empty.phone') : t('empty.folder')}</p>
          </div>
      );
    }

    if (photosToShow.size === 0) {
      let title = "Aucune photo correspondante";
      let message = "Aucune photo ne correspond aux critères. Essaie de modifier ta recherche.";
      let Icon = Filter;

      if (isolateDuplicates) {
        title = "Aucun doublon trouvé";
        message = "Bonne nouvelle ! Aucun doublon dans cette sélection.";
        Icon = Copy;
      } else if (isolateSelection) {
        title = "Aucune photo sélectionnée";
        message = "You're in isolation mode, but no photos are selected. Clear the isolation to see all photos.";
        Icon = EyeOff;
      } else if (isolateSaved) {
        title = "Aucune photo gardée";
        message = "You're in isolation mode, but no photos are saved. Click the heart on photos to save them.";
        Icon = Heart;
      } else if (isolateBlurry) {
        title = "Aucune photo floue";
        message = "Excellent! All your photos appear to be sharp.";
        Icon = AlertTriangle;
      }


      return (
          <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 dark:text-gray-400">
            <Icon className="w-24 h-24 mb-4 text-gray-300 dark:text-gray-600" />
            <h2 className="text-2xl font-semibold">{title}</h2>
            <p className="mt-2 max-w-sm">{message}</p>
          </div>
      )
    }

    if (viewMode === 'grid') {
      if (filteredPhotosForGrid.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 dark:text-gray-400">
              <Filter className="w-24 h-24 mb-4 text-gray-300 dark:text-gray-600" />
              <h2 className="text-2xl font-semibold">Aucune photo correspondante</h2>
              <p className="mt-2 max-w-sm">Aucune photo ne correspond à ton filtre. Essaie un autre terme.</p>
            </div>
        );
      }
      return <PhotoGrid photos={filteredPhotosForGrid} onSelectPhoto={onSelectPhoto} onViewPhoto={onViewPhoto} thumbnailSize={thumbnailSize} onFilterChange={onFilterChange} onToggleSavePhoto={onToggleSavePhoto} onRequestDelete={onRequestDelete} />;
    }

    if (viewMode === 'zen') {
      return (
          <ZenMode
              photos={filteredPhotosForGrid}
              onClose={() => setViewMode('grid')}
              onToggleSavePhoto={onToggleSavePhoto}
              onRequestDelete={onRequestDelete}
              onMoveSavedPhotos={onMoveSavedPhotos}
              savedFolderName={savedFolderName}
          />
      );
    }

    return <FolderView photos={photosToShow} onSelectPhoto={onSelectPhoto} onViewPhoto={onViewPhoto} thumbnailSize={thumbnailSize} onFilterChange={onFilterChange} onToggleSave={onToggleSavePhoto} onRequestDelete={onRequestDelete} onBulkSave={onBulkSave} />;
  }

  // Position of the global list, remembered while a text search replaces it
  const mainRef = useRef<HTMLElement>(null);
  const savedScroll = useRef(0);
  const searching = filterLabel.trim() !== '';
  const searchingRef = useRef(searching);
  searchingRef.current = searching;

  useLayoutEffect(() => {
    if (!searching && mainRef.current) mainRef.current.scrollTop = savedScroll.current;
  }, [searching]);

  const handleScroll = (e: React.UIEvent<HTMLElement>) => {
    if (!searchingRef.current) savedScroll.current = e.currentTarget.scrollTop;
  };

  // Pull down from the top, like a reload: forget the saved position and start over
  const PULL_THRESHOLD = 90;
  const pullStart = useRef<number | null>(null);
  const [pull, setPull] = useState(0);

  const handleTouchStart = (e: React.TouchEvent<HTMLElement>) => {
    pullStart.current = e.currentTarget.scrollTop <= 0 ? e.touches[0].clientY : null;
  };
  const handleTouchMove = (e: React.TouchEvent<HTMLElement>) => {
    if (pullStart.current === null) return;
    if (e.currentTarget.scrollTop > 0) { pullStart.current = null; setPull(0); return; }
    setPull(Math.max(0, e.touches[0].clientY - pullStart.current));
  };
  const handleTouchEnd = () => {
    if (pullStart.current !== null && pull >= PULL_THRESHOLD) {
      savedScroll.current = 0;
      if (mainRef.current) mainRef.current.scrollTop = 0;
    }
    pullStart.current = null;
    setPull(0);
  };

  return (
      <main
          ref={mainRef}
          className="flex-1 p-6 overflow-y-auto relative"
          onScroll={handleScroll}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
      >
        {pull > 10 && (
            <div
                className="pointer-events-none absolute left-1/2 top-2 z-10 -translate-x-1/2 flex items-center gap-1 rounded-full bg-gray-900/80 px-3 py-1 text-xs text-white"
                style={{ opacity: Math.min(1, pull / PULL_THRESHOLD) }}
            >
              <ArrowDown className={`w-3 h-3 transition-transform ${pull >= PULL_THRESHOLD ? 'rotate-180' : ''}`} />
              {pull >= PULL_THRESHOLD ? 'Relâcher pour repartir du début' : 'Tirer pour repartir du début'}
            </div>
        )}
        {renderContent()}
      </main>
  );
};

export default PhotoContent;
