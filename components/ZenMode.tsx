
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronLeft,
  ChevronRight,
  Heart,
  X,
  CheckCircle2,
  Keyboard,
  Save,
  Info,
  Trash2,
  RotateCw
} from 'lucide-react';
import type { Photo } from '../services/types.ts';
import type { PanInfo } from 'motion/react';

// Swipe thresholds (px, px/s)
const SWIPE_DISTANCE = 90;
const SWIPE_VELOCITY = 500;

type SwipeHint = 'next' | 'prev' | 'keep' | 'delete' | null;
const HINTS: Record<Exclude<SwipeHint, null>, { text: string; className: string }> = {
  next: { text: 'Suivante →', className: 'bg-white/20' },
  prev: { text: '← Précédente', className: 'bg-white/20' },
  keep: { text: '↑ Garder', className: 'bg-pink-500' },
  delete: { text: '↓ Supprimer', className: 'bg-red-600' },
};

interface ZenModeProps {
  photos: Photo[];
  onClose: () => void;
  onToggleSavePhoto: (id: string) => void;
  onRequestDelete: (photos: Photo[], skipConfirm?: boolean) => void;
  onMoveSavedPhotos: (photos: Photo[], folderName: string) => void;
  savedFolderName: string;
}

const ZenMode: React.FC<ZenModeProps> = ({
                                           photos,
                                           onClose,
                                           onToggleSavePhoto,
                                           onRequestDelete,
                                           onMoveSavedPhotos,
                                           savedFolderName
                                         }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const [showShortcuts, setShowShortcuts] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [customFolderName, setCustomFolderName] = useState(savedFolderName);

  // Filter out photos that might have been deleted during the session
  // But we rely on the parent updating the 'photos' prop
  const currentPhoto = photos[currentIndex];

  const handleNext = useCallback(() => {
    if (currentIndex < photos.length - 1) {
      setDirection(1);
      setCurrentIndex(prev => prev + 1);
    }
  }, [currentIndex, photos.length]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setDirection(-1);
      setCurrentIndex(prev => prev - 1);
    }
  }, [currentIndex]);

  const handleDelete = useCallback(() => {
    if (!currentPhoto) return;
    onRequestDelete([currentPhoto], true);
  }, [currentPhoto, onRequestDelete]);

  const handleToggleSave = useCallback(() => {
    if (!currentPhoto) return;
    onToggleSavePhoto(currentPhoto.id);
  }, [currentPhoto, onToggleSavePhoto]);

  const [rotation, setRotation] = useState(0);
  const [swipeHint, setSwipeHint] = useState<SwipeHint>(null);

  const hintFor = (info: PanInfo): SwipeHint => {
    const { x, y } = info.offset;
    if (Math.max(Math.abs(x), Math.abs(y)) < 40) return null;
    if (Math.abs(x) > Math.abs(y)) return x < 0 ? 'next' : 'prev';
    return y < 0 ? 'keep' : 'delete';
  };

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    setSwipeHint(null);
    const { x, y } = info.offset;
    const horizontal = Math.abs(x) > Math.abs(y);
    const distance = horizontal ? Math.abs(x) : Math.abs(y);
    const velocity = Math.abs(horizontal ? info.velocity.x : info.velocity.y);
    if (distance < SWIPE_DISTANCE && !(distance > 40 && velocity > SWIPE_VELOCITY)) return;
    if (horizontal) {
      if (x < 0) handleNext(); else handlePrev();
    } else if (y < 0) {
      handleToggleSave();
    } else {
      handleDelete();
    }
  };

  const handleRotate = useCallback((direction: 'left' | 'right') => {
    setRotation(prev => (direction === 'left' ? prev - 90 : prev + 90));
  }, []);

  useEffect(() => {
    setRotation(0);
  }, [currentPhoto]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isExporting) return;

      switch (e.key) {
        case 'ArrowLeft':
          if (e.shiftKey) handleRotate('left');
          else handlePrev();
          break;
        case 'ArrowRight':
          if (e.shiftKey) handleRotate('right');
          else handleNext();
          break;
        case 'Delete':
        case 'Backspace':
          handleDelete();
          break;
        case 'p':
        case 'P':
          handleToggleSave();
          break;
        case 'Escape':
          onClose();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNext, handlePrev, handleDelete, handleToggleSave, onClose, isExporting]);

  // Adjust index if photos are removed
  useEffect(() => {
    if (currentIndex >= photos.length && photos.length > 0) {
      setCurrentIndex(photos.length - 1);
    }
  }, [photos.length, currentIndex]);

  if (photos.length === 0) {
    return (
        <div className="flex flex-col items-center justify-center h-full text-center p-8 bg-gray-900 text-white">
          <CheckCircle2 className="w-20 h-20 text-green-500 mb-4" />
          <h2 className="text-2xl font-bold">Terminé !</h2>
          <p className="text-gray-400 mt-2">Plus aucune photo à examiner dans ce mode.</p>
          <button
              onClick={onClose}
              className="mt-6 px-6 py-2 bg-primary text-white rounded-full font-semibold hover:bg-primary-dark transition-colors"
          >
            Retour à la grille
          </button>
        </div>
    );
  }

  const handleFinish = () => {
    setIsExporting(true);
  };

  const handleConfirmExport = () => {
    const savedPhotos = photos.filter(p => p.isSaved);
    onMoveSavedPhotos(savedPhotos, customFolderName);
    onClose();
  };

  return (
      <div className="fixed inset-0 z-[100] flex flex-col bg-black text-white overflow-hidden font-sans">
        {/* Header */}
        <div className="h-16 shrink-0 flex items-center justify-between px-3 sm:px-6 z-10 pt-[env(safe-area-inset-top)] bg-gradient-to-b from-black/80 to-transparent">
          <div className="flex items-center gap-2 sm:gap-4">
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors" title="Quitter le mode Zen">
              <X className="w-6 h-6" />
            </button>
            <div className="flex flex-col">
              <span className="font-bold text-lg tracking-tight">Mode Zen</span>
              <span className="text-xs text-gray-400 font-mono">{currentIndex + 1} / {photos.length}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
                onClick={() => setShowShortcuts(!showShortcuts)}
                className={`p-2 rounded-full transition-colors ${showShortcuts ? 'bg-primary text-white' : 'hover:bg-white/10 text-gray-400'}`}
                title="Afficher les raccourcis"
            >
              <Keyboard className="w-5 h-5" />
            </button>
            <button
                onClick={handleFinish}
                className="flex items-center gap-2 px-3 sm:px-4 py-1.5 bg-green-600 whitespace-nowrap text-sm sm:text-base hover:bg-green-500 rounded-full font-semibold transition-colors shadow-lg"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span className="hidden sm:inline">Terminer et exporter</span><span className="sm:hidden">Exporter</span>
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 min-h-0 flex items-center justify-center relative px-4 sm:px-12">
          <button
              onClick={handlePrev}
              disabled={currentIndex === 0}
              className="absolute left-4 p-3 hover:bg-white/10 rounded-full disabled:opacity-0 transition-all z-10 hidden sm:block"
          >
            <ChevronLeft className="w-10 h-10" />
          </button>

          <div className="relative w-full h-full flex items-center justify-center p-4">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                  key={currentPhoto.id}
                  custom={direction}
                  initial={{ opacity: 0, x: direction * 50, scale: 0.95 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: -direction * 50, scale: 0.95 }}
                  transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                  drag
                  dragSnapToOrigin
                  dragElastic={0.5}
                  onDrag={(_, info) => setSwipeHint(hintFor(info))}
                  onDragEnd={handleDragEnd}
                  className="relative max-w-full max-h-full flex flex-col items-center touch-none"
              >
                <div className="relative group">
                  <img
                      src={currentPhoto.objectURL}
                      alt="Revue Zen"
                      style={{ transform: `rotate(${rotation}deg)`, transition: 'transform 0.2s' }}
                      className="max-w-full max-h-[calc(100dvh-17rem)] sm:max-h-[75vh] object-contain select-none pointer-events-none rounded-lg shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-white/5"
                  />

                  {/* Status Indicators */}
                  <div className="absolute top-4 right-4 flex gap-2">
                    {currentPhoto.isSaved && (
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="bg-pink-500 text-white p-2 rounded-full shadow-lg"
                        >
                          <Heart className="w-5 h-5 fill-current" />
                        </motion.div>
                    )}
                  </div>
                </div>

                {/* Info Bar */}
                <div className="mt-6 flex flex-col items-center gap-2">
                  <h3 className="text-sm font-medium text-gray-400 truncate max-w-md">{currentPhoto.id.split('/').pop()}</h3>
                  <div className="flex gap-2">
                    {currentPhoto.classifications.slice(0, 3).map(c => (
                        <span key={c.label} className="px-2 py-0.5 bg-white/10 rounded text-[10px] uppercase tracking-wider font-bold text-gray-300">
                              {c.label}
                          </span>
                    ))}
                  </div>
                </div>

              </motion.div>
            </AnimatePresence>
          </div>

          <button
              onClick={handleNext}
              disabled={currentIndex === photos.length - 1}
              className="absolute right-4 p-3 hover:bg-white/10 rounded-full disabled:opacity-0 transition-all z-10 hidden sm:block"
          >
            <ChevronRight className="w-10 h-10" />
          </button>
        </div>

        {/* Swipe hint */}
        <AnimatePresence>
          {swipeHint && (
              <motion.div
                  key={swipeHint}
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className={`absolute top-20 left-1/2 -translate-x-1/2 z-20 px-4 py-2 rounded-full font-bold text-sm shadow-lg pointer-events-none ${HINTS[swipeHint].className}`}
              >
                {HINTS[swipeHint].text}
              </motion.div>
          )}
        </AnimatePresence>

        {/* Touch actions (no keyboard on a phone) */}
        <div className="shrink-0 flex items-center justify-center gap-3 sm:gap-5 pt-2 pb-3 px-4 sm:hidden">
          <button onClick={handlePrev} disabled={currentIndex === 0} aria-label="Photo précédente" className="p-3 rounded-full bg-white/10 disabled:opacity-30 active:scale-95 transition">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button onClick={() => handleRotate('right')} aria-label="Pivoter" className="p-3 rounded-full bg-white/10 active:scale-95 transition">
            <RotateCw className="w-6 h-6" />
          </button>
          <button onClick={handleToggleSave} aria-label="Garder" className={`p-4 rounded-full active:scale-95 transition ${currentPhoto.isSaved ? 'bg-pink-500' : 'bg-white/10'}`}>
            <Heart className={`w-7 h-7 ${currentPhoto.isSaved ? 'fill-current' : ''}`} />
          </button>
          <button onClick={handleDelete} aria-label="Supprimer" className="p-3 rounded-full bg-red-600/80 active:scale-95 transition">
            <Trash2 className="w-6 h-6" />
          </button>
          <button onClick={handleNext} disabled={currentIndex === photos.length - 1} aria-label="Photo suivante" className="p-3 rounded-full bg-white/10 disabled:opacity-30 active:scale-95 transition">
            <ChevronRight className="w-6 h-6" />
          </button>
        </div>
        <p className="sm:hidden text-center text-[10px] text-gray-500 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          Glisse : ← → photos, ↑ garder, ↓ supprimer
        </p>

        {/* Progress Bar */}
        <div className="h-1.5 w-full bg-white/5">
          <motion.div
              className="h-full bg-primary shadow-[0_0_10px_rgba(var(--primary-rgb),0.5)]"
              initial={{ width: 0 }}
              animate={{ width: `${((currentIndex + 1) / photos.length) * 100}%` }}
              transition={{ type: 'spring', bounce: 0, duration: 0.5 }}
          />
        </div>

        {/* Shortcuts Help */}
        <AnimatePresence>
          {showShortcuts && (
              <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="absolute bottom-8 left-8 flex flex-col gap-3 pointer-events-none hidden md:flex"
              >
                <div className="flex items-center gap-4 text-xs bg-white/5 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10">
                  <div className="flex gap-1">
                    <kbd className="bg-white/20 px-2 py-1 rounded font-mono shadow-inner">←</kbd>
                    <kbd className="bg-white/20 px-2 py-1 rounded font-mono shadow-inner">→</kbd>
                  </div>
                  <span className="text-gray-400 font-medium uppercase tracking-wider">Naviguer</span>
                </div>
                <div className="flex items-center gap-4 text-xs bg-white/5 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10">
                  <div className="flex gap-1">
                    <kbd className="bg-white/20 px-2 py-1 rounded font-mono shadow-inner text-[9px]">SHIFT</kbd>
                    <kbd className="bg-white/20 px-2 py-1 rounded font-mono shadow-inner">←</kbd>
                    <kbd className="bg-white/20 px-2 py-1 rounded font-mono shadow-inner">→</kbd>
                  </div>
                  <span className="text-gray-400 font-medium uppercase tracking-wider">Rotation</span>
                </div>
                <div className="flex items-center gap-4 text-xs bg-white/5 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10">
                  <kbd className="bg-white/20 px-2 py-1 rounded font-mono shadow-inner w-8 text-center">P</kbd>
                  <span className="text-gray-400 font-medium uppercase tracking-wider">Favori</span>
                </div>
                <div className="flex items-center gap-4 text-xs bg-white/5 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10">
                  <kbd className="bg-white/20 px-2 py-1 rounded font-mono shadow-inner">DEL</kbd>
                  <span className="text-gray-400 font-medium uppercase tracking-wider">Supprimer</span>
                </div>
              </motion.div>
          )}
        </AnimatePresence>

        {/* Export Modal */}
        <AnimatePresence>
          {isExporting && (
              <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-[110] flex items-center justify-center bg-black/90 backdrop-blur-xl p-6"
              >
                <motion.div
                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    className="bg-gray-900 border border-white/10 p-10 rounded-[2rem] max-w-md w-full shadow-[0_0_100px_rgba(0,0,0,0.8)]"
                >
                  <div className="flex flex-col items-center text-center">
                    <div className="w-20 h-20 bg-green-500/10 text-green-500 flex items-center justify-center rounded-3xl mb-6 rotate-3">
                      <Save className="w-10 h-10" />
                    </div>
                    <h3 className="text-3xl font-bold mb-3 tracking-tight">Prêt à exporter ?</h3>
                    <p className="text-gray-400 mb-8 leading-relaxed">
                      Tu as choisi <span className="text-white font-bold">{photos.filter(p => p.isSaved).length}</span> photo(s) à garder. Elles seront déplacées dans le dossier choisi.
                    </p>

                    <div className="w-full text-left mb-8">
                      <label className="block text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 mb-3 ml-1">Dossier de destination</label>
                      <div className="relative">
                        <input
                            type="text"
                            value={customFolderName}
                            onChange={(e) => setCustomFolderName(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 focus:ring-2 focus:ring-primary outline-none transition-all text-lg font-medium"
                            placeholder="Nom du dossier..."
                        />
                      </div>
                      <p className="mt-3 flex items-center gap-2 text-[10px] text-gray-500 italic ml-1">
                        <Info className="w-3 h-3" />
                        Ce dossier sera créé à l'emplacement de destination.
                      </p>
                    </div>

                    <div className="flex gap-4 w-full">
                      <button
                          onClick={() => setIsExporting(false)}
                          className="flex-1 px-6 py-4 rounded-2xl hover:bg-white/10 transition-colors font-bold uppercase tracking-widest text-xs"
                      >
                        Continuer le tri
                      </button>
                      <button
                          onClick={handleConfirmExport}
                          className="flex-1 px-6 py-4 bg-primary hover:bg-primary-dark rounded-2xl transition-all font-bold uppercase tracking-widest text-xs shadow-lg shadow-primary/20 hover:shadow-primary/40 active:scale-95"
                      >
                        Exporter
                      </button>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
          )}
        </AnimatePresence>
      </div>
  );
};

export default ZenMode;
