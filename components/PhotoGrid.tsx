
import React, { useRef, useCallback, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { Photo, ThumbnailSize } from '../services/types.ts';
import PhotoCard from './PhotoCard.tsx';

interface PhotoGridProps {
  photos: Photo[];
  onSelectPhoto: (id: string) => void;
  onViewPhoto: (photo: Photo) => void;
  thumbnailSize: ThumbnailSize;
  onFilterChange: (label: string) => void;
  onToggleSavePhoto: (id: string) => void;
  onRequestDelete?: (photos: Photo[], skipConfirm?: boolean) => void;
}

// Column count per breakpoint for each thumbnail size
const COLUMN_MAP: Record<ThumbnailSize, { default: number; sm: number; md: number; lg: number; xl: number; xxl: number }> = {
  XS: { default: 4, sm: 5, md: 6, lg: 8, xl: 10, xxl: 12 },
  S:  { default: 3, sm: 4, md: 5, lg: 6, xl: 8,  xxl: 10 },
  M:  { default: 2, sm: 3, md: 4, lg: 5, xl: 6,  xxl: 8 },
  L:  { default: 2, sm: 2, md: 3, lg: 4, xl: 5,  xxl: 6 },
  XL: { default: 1, sm: 2, md: 2, lg: 3, xl: 4,  xxl: 5 },
};

// Estimate columns based on container width (same logic as Tailwind grid-cols-*)
function estimateColumns(containerWidth: number, size: ThumbnailSize): number {
  const map = COLUMN_MAP[size];
  if (containerWidth >= 1536) return map.xxl;
  if (containerWidth >= 1280) return map.xl;
  if (containerWidth >= 1024) return map.lg;
  if (containerWidth >= 768) return map.md;
  if (containerWidth >= 640) return map.sm;
  return map.default;
}

const OVERSCAN = 2; // rows to render above/below viewport

const PhotoGrid: React.FC<PhotoGridProps> = ({ photos, onSelectPhoto, onViewPhoto, thumbnailSize, onFilterChange, onToggleSavePhoto, onRequestDelete }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Measure container width to estimate columns
  const [containerWidth, setContainerWidth] = React.useState(1024);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const columns = useMemo(() => estimateColumns(containerWidth, thumbnailSize), [containerWidth, thumbnailSize]);
  const rowCount = Math.ceil(photos.length / columns);

  // Calculate row height based on container width and column count
  // Cards are aspect-square, so each card height = card width
  // Gap is 16px (gap-4 = 1rem = 16px)
  const gapPx = 16;
  const cardWidth = (containerWidth - gapPx * (columns - 1)) / columns;
  const rowHeight = cardWidth + gapPx; // card height + bottom gap

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: useCallback(() => {
      // Find the scrollable parent (the main content area)
      const el = containerRef.current?.closest('.overflow-y-auto') as HTMLElement | null;
      return el;
    }, []),
    estimateSize: useCallback(() => rowHeight, [rowHeight]),
    overscan: OVERSCAN,
    paddingEnd: 16, // matches p-6 padding bottom
  });

  return (
      <div ref={containerRef} className="relative" style={{ height: `${virtualizer.getTotalSize()}px` }}>
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const rowIndex = virtualRow.index;
          const startIndex = rowIndex * columns;
          const rowPhotos = photos.slice(startIndex, startIndex + columns);

          return (
              <div
                  key={rowIndex}
                  className="absolute left-0 right-0 flex gap-4"
                  style={{
                    height: `${rowHeight - gapPx}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
              >
                {rowPhotos.map((photo) => (
                    <div
                        key={photo.id}
                        className="flex-1 min-w-0"
                        style={{ maxWidth: `calc((100% - ${gapPx * (columns - 1)}px) / ${columns})` }}
                    >
                      <PhotoCard photo={photo} onSelect={onSelectPhoto} onView={onViewPhoto} onFilterChange={onFilterChange} onToggleSave={onToggleSavePhoto} onDelete={onRequestDelete ? (p) => onRequestDelete([p]) : undefined} />
                    </div>
                ))}
                {/* Fill remaining slots to keep column alignment */}
                {rowPhotos.length < columns && Array.from({ length: columns - rowPhotos.length }).map((_, i) => (
                    <div key={`filler-${i}`} className="flex-1 min-w-0" />
                ))}
              </div>
          );
        })}
      </div>
  );
};

export default PhotoGrid;
