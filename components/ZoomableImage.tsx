import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface ZoomableImageProps {
  src: string;
  alt: string;
  className?: string;
}

interface View { scale: number; x: number; y: number }

const MIN_SCALE = 1;
const MAX_SCALE = 6;
const DOUBLE_TAP_SCALE = 2.5;
const DOUBLE_TAP_MS = 300;
const TAP_MOVE_PX = 10;
const BUTTON_STEP = 1.5;
const IDENTITY: View = { scale: 1, x: 0, y: 0 };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

// Photo with touch zoom: pinch to zoom, drag to move when zoomed, double tap to zoom in and out.
// The mouse wheel and the buttons do the same on a computer.
const ZoomableImage: React.FC<ZoomableImageProps> = ({ src, alt, className = '' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>(IDENTITY);
  const viewRef = useRef(view);
  viewRef.current = view;

  const pointers = useRef(new Map<number, { x: number; y: number }>());
  // State at the start of the current gesture, so the zoom is always computed from it (no drift)
  const gesture = useRef<{ view: View; distance: number; mid: { x: number; y: number } } | null>(null);
  const lastTap = useRef<{ time: number; x: number; y: number } | null>(null);
  const moved = useRef(false);

  useEffect(() => { setView(IDENTITY); }, [src]);

  // Offset of a screen point from the center of the container (the zoom origin)
  const toOffset = (clientX: number, clientY: number) => {
    const rect = containerRef.current!.getBoundingClientRect();
    return { x: clientX - rect.left - rect.width / 2, y: clientY - rect.top - rect.height / 2 };
  };

  // Keeps the photo from being dragged out of the frame
  const constrain = useCallback((next: View): View => {
    const rect = containerRef.current?.getBoundingClientRect();
    const scale = clamp(next.scale, MIN_SCALE, MAX_SCALE);
    if (!rect || scale <= MIN_SCALE + 0.001) return IDENTITY;
    const maxX = ((scale - 1) * rect.width) / 2;
    const maxY = ((scale - 1) * rect.height) / 2;
    return { scale, x: clamp(next.x, -maxX, maxX), y: clamp(next.y, -maxY, maxY) };
  }, []);

  // Zooms to a new scale keeping the point under `pivot` where it is
  const zoomAt = useCallback((from: View, scale: number, pivot: { x: number; y: number }): View => {
    const target = clamp(scale, MIN_SCALE, MAX_SCALE);
    const ratio = target / from.scale;
    return constrain({ scale: target, x: pivot.x - (pivot.x - from.x) * ratio, y: pivot.y - (pivot.y - from.y) * ratio });
  }, [constrain]);

  const startGesture = () => {
    const points = Array.from(pointers.current.values());
    const rect = containerRef.current!.getBoundingClientRect();
    const mid = points.length === 2
      ? { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 }
      : points[0];
    gesture.current = {
      view: viewRef.current,
      distance: points.length === 2 ? Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y) : 0,
      mid: { x: mid.x - rect.left - rect.width / 2, y: mid.y - rect.top - rect.height / 2 },
    };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    containerRef.current?.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1) moved.current = false;
    startGesture();
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId) || !gesture.current) return;
    const previous = pointers.current.get(e.pointerId)!;
    if (Math.hypot(e.clientX - previous.x, e.clientY - previous.y) > 0) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const points = Array.from(pointers.current.values());
    const start = gesture.current;
    const rect = containerRef.current!.getBoundingClientRect();

    if (points.length >= 2 && start.distance > 0) {
      moved.current = true;
      const distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
      const mid = {
        x: (points[0].x + points[1].x) / 2 - rect.left - rect.width / 2,
        y: (points[0].y + points[1].y) / 2 - rect.top - rect.height / 2,
      };
      const scale = clamp(start.view.scale * (distance / start.distance), MIN_SCALE, MAX_SCALE);
      const ratio = scale / start.view.scale;
      // The point that was under the fingers at the start follows the fingers
      setView(constrain({
        scale,
        x: mid.x - (start.mid.x - start.view.x) * ratio,
        y: mid.y - (start.mid.y - start.view.y) * ratio,
      }));
    } else if (points.length === 1 && start.view.scale > 1) {
      const dx = points[0].x - rect.left - rect.width / 2 - start.mid.x;
      const dy = points[0].y - rect.top - rect.height / 2 - start.mid.y;
      if (Math.hypot(dx, dy) > TAP_MOVE_PX) moved.current = true;
      setView(constrain({ scale: start.view.scale, x: start.view.x + dx, y: start.view.y + dy }));
    } else if (points.length === 1) {
      const dx = points[0].x - rect.left - rect.width / 2 - start.mid.x;
      const dy = points[0].y - rect.top - rect.height / 2 - start.mid.y;
      if (Math.hypot(dx, dy) > TAP_MOVE_PX) moved.current = true;
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const wasSingle = pointers.current.size === 1;
    pointers.current.delete(e.pointerId);
    if (pointers.current.size > 0) {
      startGesture(); // one finger left after a pinch: keep panning from here
      return;
    }
    gesture.current = null;
    if (!wasSingle || moved.current) return;

    // A tap: two taps close together zoom in on the spot, or back out
    const now = Date.now();
    const previousTap = lastTap.current;
    if (previousTap && now - previousTap.time < DOUBLE_TAP_MS && Math.hypot(e.clientX - previousTap.x, e.clientY - previousTap.y) < 40) {
      lastTap.current = null;
      const current = viewRef.current;
      setView(current.scale > 1.05 ? IDENTITY : zoomAt(current, DOUBLE_TAP_SCALE, toOffset(e.clientX, e.clientY)));
    } else {
      lastTap.current = { time: now, x: e.clientX, y: e.clientY };
    }
  };

  const onPointerCancel = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    gesture.current = null;
  };

  // The wheel needs a non-passive listener to stop the page from scrolling
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = element.getBoundingClientRect();
      const pivot = { x: e.clientX - rect.left - rect.width / 2, y: e.clientY - rect.top - rect.height / 2 };
      setView(current => zoomAt(current, current.scale * Math.exp(-e.deltaY * 0.0015), pivot));
    };
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  }, [zoomAt]);

  const zoomBy = (factor: number) => setView(current => zoomAt(current, current.scale * factor, { x: 0, y: 0 }));
  const zoomed = view.scale > 1.01;

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden touch-none select-none ${zoomed ? 'cursor-grab active:cursor-grabbing' : 'cursor-zoom-in'} ${className}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      <img
        src={src}
        alt={alt}
        draggable={false}
        className="absolute inset-0 w-full h-full object-contain pointer-events-none will-change-transform"
        style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}
      />
      <div className="absolute bottom-3 left-3 flex items-center gap-1 rounded-full bg-black/50 p-1 text-white" onPointerDown={e => e.stopPropagation()}>
        <button onClick={() => zoomBy(1 / BUTTON_STEP)} disabled={!zoomed} aria-label="Zoom arrière" className="p-1.5 rounded-full hover:bg-white/20 disabled:opacity-30"><ZoomOut className="w-4 h-4" /></button>
        <button onClick={() => zoomBy(BUTTON_STEP)} disabled={view.scale >= MAX_SCALE} aria-label="Zoom avant" className="p-1.5 rounded-full hover:bg-white/20 disabled:opacity-30"><ZoomIn className="w-4 h-4" /></button>
        {zoomed && (
          <button onClick={() => setView(IDENTITY)} aria-label="Réinitialiser le zoom" className="p-1.5 rounded-full hover:bg-white/20"><RotateCcw className="w-4 h-4" /></button>
        )}
      </div>
    </div>
  );
};

export default ZoomableImage;
