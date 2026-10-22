
import React, { useRef, useEffect, useState } from 'react';
import type { Photo } from '../services/types.ts';
import { PhotoStatus } from '../services/types.ts';
import { StatusPill } from './ui.tsx';
import PhotoActionMenu from './PhotoActionMenu.tsx';
import { Check, Tag, Boxes, Heart, Bookmark, AlertTriangle } from 'lucide-react';

interface PhotoCardProps {
  photo: Photo;
  onSelect: (id: string) => void;
  onView: (photo: Photo) => void;
  onFilterChange: (label: string) => void;
  onToggleSave: (id: string) => void;
  onDelete?: (photo: Photo) => void;
}

const LONG_PRESS_MS = 500;
const LONG_PRESS_MOVE_PX = 10;

function PhotoCard({ photo, onSelect, onView, onFilterChange, onToggleSave, onDelete }: PhotoCardProps) {
  const clickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressStartRef = useRef<{ x: number; y: number } | null>(null);
  const longPressedRef = useRef(false);

  const cancelPress = () => {
    if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
    pressTimerRef.current = null;
    pressStartRef.current = null;
  };

  const openMenu = () => {
    cancelPress();
    longPressedRef.current = true;
    try { navigator.vibrate?.(15); } catch { /* not critical */ }
    setMenuOpen(true);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    longPressedRef.current = false;
    pressStartRef.current = { x: e.clientX, y: e.clientY };
    pressTimerRef.current = setTimeout(openMenu, LONG_PRESS_MS);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const start = pressStartRef.current;
    if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > LONG_PRESS_MOVE_PX) cancelPress();
  };

  useEffect(() => {
    const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            observer.unobserve(entry.target);
          }
        },
        {
          rootMargin: '200px 0px',
        }
    );

    const currentRef = cardRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
      }
      if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
    };
  }, []);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // The click that ends a long press must not also select or open the photo
    if (longPressedRef.current) {
      longPressedRef.current = false;
      return;
    }
    // If a timer is already running, it's a double click.
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
      onView(photo); // Trigger the double-click action (view photo).
    } else {
      // Otherwise, it's the first click. Start a timer.
      clickTimeoutRef.current = setTimeout(() => {
        onSelect(photo.id); // If timer completes, trigger single-click action (select photo).
        clickTimeoutRef.current = null;
      }, 250); // 250ms window to detect a double click.
    }
  };

  const handleLabelClick = (e: React.MouseEvent, label: string) => {
    e.stopPropagation(); // Important: prevent card's single/double click
    onFilterChange(label);
  };


  // Find the prediction with the highest score from classifications
  const topClassification = photo.status === PhotoStatus.ANALYZED && photo.classifications.length > 0
      ? photo.classifications.reduce((max, p) => p.score > max.score ? p : max, photo.classifications[0])
      : null;

  // Find the prediction with the highest score from detections
  const topDetection = photo.status === PhotoStatus.ANALYZED && photo.detections.length > 0
      ? photo.detections.reduce((max, p) => p.score > max.score ? p : max, photo.detections[0])
      : null;

  return (
      <div
          ref={cardRef}
          className="relative group aspect-square select-none [-webkit-touch-callout:none] bg-gray-200 dark:bg-gray-800 rounded-lg overflow-hidden cursor-pointer shadow-md hover:shadow-xl transition-all duration-300"
          onClick={handleClick}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={cancelPress}
          onPointerCancel={cancelPress}
          onPointerLeave={cancelPress}
          onContextMenu={(e) => { e.preventDefault(); openMenu(); }}
      >
        {menuOpen && (
            <PhotoActionMenu
                photo={photo}
                onClose={() => setMenuOpen(false)}
                onView={() => onView(photo)}
                onSelect={() => onSelect(photo.id)}
                onToggleSave={() => onToggleSave(photo.id)}
                onDelete={onDelete ? () => onDelete(photo) : undefined}
            />
        )}
        {isVisible && (
            <>
              <img src={photo.thumbnailURL ?? photo.objectURL} alt={photo.id} decoding="async" className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110" loading="lazy" />
              <div className="absolute inset-0 bg-black/10 group-hover:bg-black/30 transition-opacity duration-300"></div>

              {photo.selected && (
                  <div className="absolute inset-0 border-4 border-accent rounded-lg pointer-events-none"></div>
              )}

              <StatusPill status={photo.status} />

              <div className="absolute top-2 right-2 flex items-center gap-2 z-10">
                <button
                    onClick={(e) => { e.stopPropagation(); onToggleSave(photo.id); }}
                    className="p-1.5 bg-black/40 rounded-full text-white hover:text-red-400 transition-colors"
                    title={photo.isSaved ? "Unsave photo" : "Save for later"}
                >
                  <Heart className={`w-4 h-4 transition-all ${photo.isSaved ? 'fill-red-400' : 'fill-transparent'}`} />
                </button>
                {photo.selected && (
                    <div className="bg-accent text-white rounded-full p-1">
                      <Check className="w-4 h-4" />
                    </div>
                )}
              </div>

              {/* Blur Indicator */}
              {photo.blurLevel === 'blurry' && (
                  <div className="absolute bottom-12 right-2 z-10">
                    <div className="bg-orange-500/90 text-white p-1 rounded-full shadow-sm" title={`Blur Detected (Score: ${photo.blurScore})`}>
                      <AlertTriangle className="w-3 h-3" />
                    </div>
                  </div>
              )}


              <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/70 to-transparent">
                <div className="mb-1 space-y-1">
                  {photo.customLabel ? (
                      <div className="flex items-center justify-between text-white">
                        <button
                            onClick={(e) => handleLabelClick(e, photo.customLabel!)}
                            className="flex items-center gap-1.5 overflow-hidden text-left hover:underline focus:outline-none focus:underline"
                            title={`Filter by custom label "${photo.customLabel}"`}
                        >
                          <Bookmark className="w-3 h-3 text-secondary shrink-0" />
                          <span className="text-sm font-bold capitalize truncate">
                                    {photo.customLabel}
                                </span>
                        </button>
                      </div>
                  ) : topDetection ? (
                      <div className="flex items-center justify-between text-white">
                        <button
                            onClick={(e) => handleLabelClick(e, topDetection.label)}
                            className="flex items-center gap-1.5 overflow-hidden text-left hover:underline focus:outline-none focus:underline"
                            title={`Filter by "${topDetection.label}"`}
                        >
                          <Boxes className="w-3 h-3 text-white/90 shrink-0" />
                          <span className="text-sm font-bold capitalize truncate">
                                    {topDetection.label}
                                </span>
                        </button>
                        <span className="text-xs font-mono bg-accent/20 px-1.5 py-0.5 rounded-full">
                                {`${(topDetection.score * 100).toFixed(0)}%`}
                            </span>
                      </div>
                  ) : topClassification ? (
                      <div className="flex items-center justify-between text-white">
                        <button
                            onClick={(e) => handleLabelClick(e, topClassification.label)}
                            className="flex items-center gap-1.5 overflow-hidden text-left hover:underline focus:outline-none focus:underline"
                            title={`Filter by "${topClassification.label}"`}
                        >
                          <Tag className="w-3 h-3 text-white/90 shrink-0" />
                          <span className="text-sm font-bold capitalize truncate">
                                    {topClassification.label}
                                </span>
                        </button>
                        <span className="text-xs font-mono bg-white/20 px-1.5 py-0.5 rounded-full">
                                {`${(topClassification.score * 100).toFixed(0)}%`}
                            </span>
                      </div>
                  ) : null}
                </div>
                <p className="text-white text-xs truncate" title={photo.id.split(/[\\/]/).pop()}>
                  {photo.id.split(/[\\/]/).pop()}
                </p>
              </div>
            </>
        )}
      </div>
  );
};

export default React.memo(PhotoCard);
