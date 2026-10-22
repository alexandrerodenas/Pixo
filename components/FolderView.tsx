import React, { useState, useMemo } from 'react';
import type { Photo, ThumbnailSize } from '../services/types.ts';
import { PhotoStatus } from '../services/types.ts';
import PhotoCard from './PhotoCard.tsx';
import { ChevronRight, Folder, ArrowDownAZ, ArrowDown10, Tag, Boxes, Heart, Trash2 } from 'lucide-react';

interface FolderViewProps {
  photos: Map<string, Photo>;
  onSelectPhoto: (id: string) => void;
  onViewPhoto: (photo: Photo) => void;
  thumbnailSize: ThumbnailSize;
  onFilterChange: (label: string) => void;
  onToggleSave: (id: string) => void;
  onRequestDelete: (photos: Photo[]) => void;
  onBulkSave: (photos: Photo[]) => void;
}

const FolderView: React.FC<FolderViewProps> = ({ photos, onSelectPhoto, onViewPhoto, thumbnailSize, onFilterChange, onToggleSave, onRequestDelete, onBulkSave }) => {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set([PhotoStatus.ANALYZED, PhotoStatus.UNCATEGORIZED]));
  const [sortOrder, setSortOrder] = useState<'alpha' | 'count'>('alpha');
  const [groupBy, setGroupBy] = useState<'classification' | 'detection'>('classification');

  const sizeClassesAnalyzed: Record<ThumbnailSize, string> = {
    XS: 'grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-9 2xl:grid-cols-11',
    S: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-9',
    M: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-7',
    L: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6',
    XL: 'grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4',
  };

  const sizeClassesOther: Record<ThumbnailSize, string> = {
    XS: 'grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 2xl:grid-cols-12',
    S: 'grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10',
    M: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8',
    L: 'grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6',
    XL: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5',
  };

  const toggleFolder = (key: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const groupedPhotos = useMemo(() => {
    const groups: {
      [PhotoStatus.ANALYZED]: Record<string, Photo[]>;
      [PhotoStatus.QUEUED]: Photo[];
      [PhotoStatus.ANALYZING]: Photo[];
      [PhotoStatus.ERROR]: Photo[];
      [PhotoStatus.UNCATEGORIZED]: Photo[];
    } = {
      [PhotoStatus.ANALYZED]: {},
      [PhotoStatus.QUEUED]: [],
      [PhotoStatus.ANALYZING]: [],
      [PhotoStatus.ERROR]: [],
      [PhotoStatus.UNCATEGORIZED]: [],
    };

    const photosToGroup = Array.from(photos.values());

    for (const photo of photosToGroup) {
      if (photo.status === PhotoStatus.ANALYZED) {
        let keyLabel: string | null = photo.customLabel || null;

        if (photo.customLabel) {
          if (!groups[PhotoStatus.ANALYZED][photo.customLabel]) {
            groups[PhotoStatus.ANALYZED][photo.customLabel] = [];
          }
          groups[PhotoStatus.ANALYZED][photo.customLabel].push(photo);
          continue; // Skip other grouping logic if custom label is present
        }

        if (groupBy === 'classification') {
          if (photo.classifications.length > 0) {
            const topPrediction = photo.classifications.reduce((max, p) => p.score > max.score ? p : max, photo.classifications[0]);
            keyLabel = topPrediction.label;
          }
        } else { // groupBy === 'detection'
          if (photo.detections.length > 0) {
            // Group by each detected object label
            const uniqueLabels = new Set<string>(photo.detections.map(d => d.label));
            uniqueLabels.forEach(label => {
              const capitalizedLabel = label.charAt(0).toUpperCase() + label.slice(1);
              if (!groups[PhotoStatus.ANALYZED][capitalizedLabel]) {
                groups[PhotoStatus.ANALYZED][capitalizedLabel] = [];
              }
              groups[PhotoStatus.ANALYZED][capitalizedLabel].push(photo);
            });
            continue; // Skip single label push below
          }
        }

        if (keyLabel) {
          const capitalizedLabel = keyLabel.charAt(0).toUpperCase() + keyLabel.slice(1);
          if (!groups[PhotoStatus.ANALYZED][capitalizedLabel]) {
            groups[PhotoStatus.ANALYZED][capitalizedLabel] = [];
          }
          groups[PhotoStatus.ANALYZED][capitalizedLabel].push(photo);
        }

      } else {
        const status = photo.status as keyof typeof groups;
        if (groups[status]) {
          (groups[status] as Photo[]).push(photo);
        }
      }
    }

    const sortedKeys = Object.keys(groups[PhotoStatus.ANALYZED]).sort((a, b) => {
      if (sortOrder === 'count') {
        const countA = groups[PhotoStatus.ANALYZED][a].length;
        const countB = groups[PhotoStatus.ANALYZED][b].length;
        if (countB !== countA) {
          return countB - countA;
        }
      }
      return a.localeCompare(b);
    });

    const sortedAnalyzed = sortedKeys.reduce((obj, key) => {
      obj[key] = groups[PhotoStatus.ANALYZED][key];
      return obj;
    }, {} as Record<string, Photo[]>);

    groups[PhotoStatus.ANALYZED] = sortedAnalyzed;

    return groups;
  }, [photos, sortOrder, groupBy]);

  const folderOrder = [
    PhotoStatus.ANALYZED,
    PhotoStatus.UNCATEGORIZED,
    PhotoStatus.ERROR,
  ];

  return (
      <div className="space-y-4">
        {folderOrder.map((status) => {
          const content = groupedPhotos[status as keyof typeof groupedPhotos];
          if(!content) return null;

          const isAnalyzed = status === PhotoStatus.ANALYZED;
          const photoList = isAnalyzed ? Object.values(content as Record<string, Photo[]>).flat() : (content as Photo[]);
          if (photoList.length === 0) return null;
          const isStatusExpanded = expandedFolders.has(status);

          return (
              <div key={status}>
                <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-200/60 dark:hover:bg-gray-700/60 transition-colors">
                  <div onClick={() => toggleFolder(status)} className="flex items-center gap-3 flex-grow cursor-pointer">
                    <ChevronRight className={`w-5 h-5 text-gray-500 transition-transform ${isStatusExpanded ? 'rotate-90' : ''}`} />
                    <Folder className="w-6 h-6 text-secondary" />
                    <h3 className="font-bold text-lg capitalize">{status.toLowerCase().replace(/_/g, ' ')}</h3>
                    <span className="text-sm text-gray-500 dark:text-gray-400">({photoList.length} photos)</span>
                  </div>
                  {isAnalyzed && isStatusExpanded && (
                      <div className="flex items-center gap-2 ml-auto">
                        <div className="flex items-center p-0.5 bg-gray-300 dark:bg-gray-600 rounded-md">
                          <button
                              onClick={() => setGroupBy('classification')}
                              className={`p-1.5 rounded-sm transition-colors ${groupBy === 'classification' ? 'bg-white dark:bg-gray-800 text-primary shadow-sm' : 'text-gray-600 dark:text-gray-300 hover:bg-white/50 dark:hover:bg-gray-800/50'}`}
                              aria-label="Grouper par classification"
                              title="Grouper par classification"
                          >
                            <Tag className="w-4 h-4" />
                          </button>
                          <button
                              onClick={() => setGroupBy('detection')}
                              className={`p-1.5 rounded-sm transition-colors ${groupBy === 'detection' ? 'bg-white dark:bg-gray-800 text-primary shadow-sm' : 'text-gray-600 dark:text-gray-300 hover:bg-white/50 dark:hover:bg-gray-800/50'}`}
                              aria-label="Grouper par objets détectés"
                              title="Grouper par objets détectés"
                          >
                            <Boxes className="w-4 h-4" />
                          </button>
                        </div>
                        {Object.keys(content as object).length > 1 && (
                            <div className="flex items-center p-0.5 bg-gray-300 dark:bg-gray-600 rounded-md">
                              <button
                                  onClick={() => setSortOrder('alpha')}
                                  className={`p-1.5 rounded-sm transition-colors ${sortOrder === 'alpha' ? 'bg-white dark:bg-gray-800 text-primary shadow-sm' : 'text-gray-600 dark:text-gray-300 hover:bg-white/50 dark:hover:bg-gray-800/50'}`}
                                  aria-label="Trier par ordre alphabétique"
                                  title="Trier par ordre alphabétique"
                              >
                                <ArrowDownAZ className="w-4 h-4" />
                              </button>
                              <button
                                  onClick={() => setSortOrder('count')}
                                  className={`p-1.5 rounded-sm transition-colors ${sortOrder === 'count' ? 'bg-white dark:bg-gray-800 text-primary shadow-sm' : 'text-gray-600 dark:text-gray-300 hover:bg-white/50 dark:hover:bg-gray-800/50'}`}
                                  aria-label="Trier par nombre de photos"
                                  title="Trier par nombre de photos"
                              >
                                <ArrowDown10 className="w-4 h-4" />
                              </button>
                            </div>
                        )}
                      </div>
                  )}
                </div>

                {isStatusExpanded && (
                    <div className="pl-11 pt-3 space-y-3">
                      {isAnalyzed ? (
                          Object.entries(content as Record<string, Photo[]>).map(([label, labelPhotos]) => {
                            const folderKey = `${status}-${label}`;
                            const isLabelExpanded = expandedFolders.has(folderKey);
                            const allInCategorySaved = labelPhotos.length > 0 && labelPhotos.every(p => p.isSaved);
                            return (
                                <div key={folderKey}>
                                  <div className="group flex items-center justify-between gap-2 p-1 rounded-md hover:bg-gray-200/60 dark:hover:bg-gray-700/60 transition-colors">
                                    <div onClick={() => toggleFolder(folderKey)} className="flex items-center gap-2 flex-grow cursor-pointer">
                                      <ChevronRight className={`w-4 h-4 text-gray-500 transition-transform ${isLabelExpanded ? 'rotate-90' : ''}`} />
                                      <Folder className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                                      <h4 className="font-semibold">{label}</h4>
                                      <span className="text-xs text-gray-500 dark:text-gray-400">({labelPhotos.length})</span>
                                    </div>
                                    <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button
                                          onClick={(e) => { e.stopPropagation(); onBulkSave(labelPhotos); }}
                                          className="p-1.5 rounded-full hover:bg-gray-300 dark:hover:bg-gray-600"
                                          title={allInCategorySaved ? 'Ne plus garder toute la catégorie' : 'Garder toute la catégorie'}
                                      >
                                        <Heart className={`w-4 h-4 text-pink-500 transition-colors ${allInCategorySaved ? 'fill-current' : ''}`} />
                                      </button>
                                      <button
                                          onClick={(e) => { e.stopPropagation(); onRequestDelete(labelPhotos); }}
                                          className="p-1.5 rounded-full hover:bg-red-200 dark:hover:bg-red-800/50"
                                          title="Supprimer toute la catégorie"
                                      >
                                        <Trash2 className="w-4 h-4 text-red-600" />
                                      </button>
                                    </div>
                                  </div>
                                  {isLabelExpanded && (
                                      <div className={`pl-7 pt-2 grid ${sizeClassesAnalyzed[thumbnailSize]} gap-4`}>
                                        {labelPhotos.map(photo => <PhotoCard key={photo.id} photo={photo} onSelect={onSelectPhoto} onView={onViewPhoto} onFilterChange={onFilterChange} onToggleSave={onToggleSave} onDelete={(p) => onRequestDelete([p])} />)}
                                      </div>
                                  )}
                                </div>
                            );
                          })
                      ) : (
                          <div className={`grid ${sizeClassesOther[thumbnailSize]} gap-4`}>
                            {(content as Photo[]).map(photo => <PhotoCard key={photo.id} photo={photo} onSelect={onSelectPhoto} onView={onViewPhoto} onFilterChange={onFilterChange} onToggleSave={onToggleSave} onDelete={(p) => onRequestDelete([p])} />)}
                          </div>
                      )}
                    </div>
                )}
              </div>
          );
        })}
      </div>
  );
};

export default FolderView;