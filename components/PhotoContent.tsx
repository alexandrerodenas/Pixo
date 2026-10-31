
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
  Sparkles,
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
  newPhotosOnly: boolean;
  showPrevious: boolean;
  onShowPrevious: () => void;
  onAnalyzeNew: (applyRules: boolean) => void;
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
                                                     savedFolderName,
                                                     newPhotosOnly,
                                                     showPrevious,
                                                     onShowPrevious,
                                                     onAnalyzeNew
                                                   }) => {

  // "New photos only" mode: the photos analysed in a previous session stay hidden until asked for,
  // except while searching (a search looks at everything)
  // Any isolation (selection, kept, duplicates, blurry) looks at every photo as well
  const hidingPrevious = newPhotosOnly && !showPrevious && filterLabel.trim() === '' && !isolateSelection && !isolateSaved && !isolateDuplicates && !isolateBlurry;
  const previousCount = useMemo(() => {
    let count = 0;
    for (const photo of photos.values()) if (photo.fromPreviousSession) count++;
    return count;
  }, [photos]);

  const photosToShow = useMemo(() => {
    let photosToReturn = photos;
    if (hidingPrevious) {
      photosToReturn = new Map();
      for (const [id, photo] of photos.entries()) if (!photo.fromPreviousSession) photosToReturn.set(id, photo);
    }

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
  }, [photos, hidingPrevious, isolateSelection, isolateSaved, isolateDuplicates, isolateBlurry]);

  const filteredPhotosForGrid = useMemo(() => {
    const photosArray = Array.from(photosToShow.values());

    // Sort duplications if active: Group by groupID
    if (isolateDuplicates) {
      photosArray.sort((a, b) => (a.duplicateGroupId || '').localeCompare(b.duplicateGroupId || ''));
      return photosArray;
    }

    // Photos still being analysed are left out; the order itself is never changed (library order)
    const processedPhotos = photosArray.filter(p => p.awaitingApproval || (p.status !== PhotoStatus.QUEUED && p.status !== PhotoStatus.ANALYZING));

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

    if (photosToShow.size === 0 && !(hidingPrevious && previousCount > 0)) {
      let title = t('content.none.title');
      let message = t('content.none.body');
      let Icon = Filter;

      if (isolateDuplicates) {
        title = t('content.dup.title');
        message = t('content.dup.body');
        Icon = Copy;
      } else if (isolateSelection) {
        title = t('content.sel.title');
        message = t('content.sel.body');
        Icon = EyeOff;
      } else if (isolateSaved) {
        title = t('content.saved.title');
        message = t('content.saved.body');
        Icon = Heart;
      } else if (isolateBlurry) {
        title = t('content.blur.title');
        message = t('content.blur.body');
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

    if (photosToShow.size === 0) {
      return (
          <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 dark:text-gray-400">
            <p className="mb-4 max-w-sm">{t('content.noNew.title')}</p>
            <button
                onClick={onShowPrevious}
                className="px-4 py-2 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-semibold hover:opacity-90"
            >
              {t('content.loadPrevious', { count: previousCount })}
            </button>
          </div>
      );
    }

    if (viewMode === 'grid') {
      if (filteredPhotosForGrid.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 dark:text-gray-400">
              <Filter className="w-24 h-24 mb-4 text-gray-300 dark:text-gray-600" />
              <h2 className="text-2xl font-semibold">{t('content.none.title')}</h2>
              <p className="mt-2 max-w-sm">{t('content.filter.body')}</p>
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

  const awaitingCount = useMemo(() => {
    let count = 0;
    for (const photo of photos.values()) if (photo.awaitingApproval) count++;
    return count;
  }, [photos]);

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
              {pull >= PULL_THRESHOLD ? t('content.release') : t('content.pull')}
            </div>
        )}
        {awaitingCount > 0 && viewMode !== 'zen' && (
            <div className="sticky top-0 z-20 -mx-6 -mt-6 mb-6 px-4 py-3 bg-blue-600 text-white shadow-md">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 max-w-4xl mx-auto">
                <div className="flex items-start gap-2 flex-1 min-w-0">
                  <Sparkles className="w-5 h-5 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="font-semibold text-sm">{t('new.title', { count: awaitingCount })}</p>
                    <p className="text-xs text-blue-100">{t('new.hint')}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => onAnalyzeNew(true)} className="flex-1 sm:flex-none px-3 py-2 rounded-lg bg-white text-blue-700 text-sm font-semibold hover:bg-blue-50 transition">
                    {t('new.analyzeRules')}
                  </button>
                  <button onClick={() => onAnalyzeNew(false)} className="flex-1 sm:flex-none px-3 py-2 rounded-lg bg-blue-700 text-white text-sm font-semibold hover:bg-blue-800 transition">
                    {t('new.analyze')}
                  </button>
                </div>
              </div>
            </div>
        )}
        {renderContent()}
        {hidingPrevious && previousCount > 0 && photosToShow.size > 0 && viewMode !== 'zen' && (
            <div className="flex justify-center py-6">
              <button
                  onClick={onShowPrevious}
                  className="px-4 py-2 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-semibold hover:opacity-90"
              >
                {t('content.loadPrevious', { count: previousCount })}
              </button>
            </div>
        )}
      </main>
  );
};

export default PhotoContent;
