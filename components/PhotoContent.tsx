
import React, { useMemo } from 'react';
import type { Photo, ThumbnailSize } from '../services/types.ts';
import { PhotoStatus } from '../services/types.ts';
import PhotoGrid from './PhotoGrid.tsx';
import FolderView from './FolderView.tsx';
import ZenMode from './ZenMode.tsx';
import { isPhoneLibrary } from '../services/phoneLibrary.ts';
import {
  FolderOpen,
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
            <h2 className="text-2xl font-semibold">Your workspace is empty</h2>
            <p className="mt-2 max-w-sm">{isPhoneLibrary() ? "Tap the phone button in the top bar to load every photo on your phone." : "Click 'Open Folder' in the top bar to begin your photo organizing adventure!"}</p>
          </div>
      );
    }

    if (photosToShow.size === 0) {
      let title = "No Matching Photos";
      let message = "No photos match the current criteria. Try adjusting your search.";
      let Icon = Filter;

      if (isolateDuplicates) {
        title = "No Duplicates Found";
        message = "Great news! No duplicates were detected in your current set.";
        Icon = Copy;
      } else if (isolateSelection) {
        title = "No Selected Photos";
        message = "You're in isolation mode, but no photos are selected. Clear the isolation to see all photos.";
        Icon = EyeOff;
      } else if (isolateSaved) {
        title = "No Saved Photos";
        message = "You're in isolation mode, but no photos are saved. Click the heart on photos to save them.";
        Icon = Heart;
      } else if (isolateBlurry) {
        title = "No Blurry Photos";
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
              <h2 className="text-2xl font-semibold">No Matching Photos</h2>
              <p className="mt-2 max-w-sm">No photos match your label filter. Try a different search term.</p>
            </div>
        );
      }
      return <PhotoGrid photos={filteredPhotosForGrid} onSelectPhoto={onSelectPhoto} onViewPhoto={onViewPhoto} thumbnailSize={thumbnailSize} onFilterChange={onFilterChange} onToggleSavePhoto={onToggleSavePhoto} />;
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

  return (
      <main className="flex-1 p-6 overflow-y-auto">
        {renderContent()}
      </main>
  );
};

export default PhotoContent;
