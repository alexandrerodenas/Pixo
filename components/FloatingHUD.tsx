import React, { useEffect, useState } from 'react';
import type { ModelsLoadState } from '../services/types.ts';
import { ChevronDown, Activity, Image as ImageIcon, CheckSquare, Heart, AlertCircle, CheckCircle2, Loader } from 'lucide-react';
import { subscribeClipStats, type ClipStats } from '../services/clipClient.ts';
import { t } from '../services/i18n.ts';

interface FloatingHUDProps {
  totalCount: number;
  selectedCount: number;
  savedCount: number;
  statusMessage: string;
  modelsLoadState: ModelsLoadState;
  tfBackend: string | null;
  processingQueueCount: number;
}

const isSmallScreen = () => typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches;

const FloatingHUD: React.FC<FloatingHUDProps> = ({
                                                   totalCount,
                                                   selectedCount,
                                                   savedCount,
                                                   statusMessage,
                                                   modelsLoadState,
                                                   tfBackend,
                                                   processingQueueCount
                                                 }) => {
  // Phones start with the compact pill: the full card covers a good part of the photos
  const [isExpanded, setIsExpanded] = useState(() => !isSmallScreen());
  const [clip, setClip] = useState<ClipStats>({ loaded: false, photos: 0 });
  useEffect(() => subscribeClipStats(setClip), []);

  const isModelLoading = modelsLoadState.classification === 'loading' || modelsLoadState.detection === 'loading';
  const areModelsReady = modelsLoadState.classification === 'loaded' && modelsLoadState.detection === 'loaded';

  const isProcessing = processingQueueCount > 0;
  const done = Math.max(0, totalCount - processingQueueCount);
  const percent = totalCount > 0 ? Math.round((done / totalCount) * 100) : 0;

  const clipPercent = Math.round((clip.progress ?? 0) * 100);
  const clipLine = clip.error ? t('hud.clipError')
      : clip.phase === 'download' ? t('hud.clipDownload', { percent: clipPercent })
      : clip.phase === 'labels' ? t('hud.clipLabels', { percent: clipPercent })
      : null;

  const Counter = ({ icon, value, label, active, activeClass }: { icon: React.ReactNode; value: number; label: string; active?: boolean; activeClass?: string }) => (
      <div className={`p-2 rounded-lg ${active ? activeClass : 'bg-gray-100 dark:bg-gray-700 text-gray-500'}`}>
        {icon}
        <span className="block text-sm font-bold leading-tight">{value}</span>
        <span className="block text-[10px] leading-tight opacity-70 truncate">{label}</span>
      </div>
  );

  return (
      <div className="fixed left-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] md:left-4 md:bottom-4 z-40 max-w-[calc(100vw-1.5rem)]">
        <div className={`bg-white/95 dark:bg-gray-800/95 backdrop-blur-md shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden transition-all duration-200 ${isExpanded ? 'w-72 max-w-full rounded-2xl' : 'w-auto rounded-full'}`}>
          <button
              onClick={() => setIsExpanded(!isExpanded)}
              aria-label={isExpanded ? t('hud.collapse') : t('hud.expand')}
              className={`w-full flex items-center justify-between gap-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${isExpanded ? 'p-3' : 'py-2 pl-3 pr-4'}`}
          >
            <div className="flex items-center gap-2 font-bold text-sm text-gray-800 dark:text-gray-100">
              {isProcessing ? <Loader className="w-4 h-4 text-primary animate-spin" /> : <Activity className="w-4 h-4 text-primary" />}
              {isExpanded
                  ? <span>{t('hud.title')}</span>
                  : <span className="font-mono text-xs">
                      {isProcessing ? `${percent} %` : totalCount}
                      {clip.phase && ` · CLIP ${clipPercent} %`}
                    </span>}
            </div>
            {isExpanded && <ChevronDown className="w-4 h-4 text-gray-400" />}
          </button>

          {isExpanded && (
              <div className="px-4 pb-4 space-y-3">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <Counter icon={<ImageIcon className="w-4 h-4 mx-auto mb-1" />} value={totalCount} label={t('hud.photos')} />
                  <Counter icon={<CheckSquare className="w-4 h-4 mx-auto mb-1" />} value={selectedCount} label={t('hud.selected')} active={selectedCount > 0} activeClass="bg-accent/10 text-accent" />
                  <Counter icon={<Heart className="w-4 h-4 mx-auto mb-1 fill-current" />} value={savedCount} label={t('hud.kept')} active={savedCount > 0} activeClass="bg-pink-500/10 text-pink-500" />
                </div>

                {isProcessing && (
                    <div className="text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-300 p-2 rounded-md space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span>{t('hud.running')}</span>
                        <span className="font-bold">{t('hud.progress', { done, total: totalCount })}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-blue-200 dark:bg-blue-900/60 overflow-hidden">
                        <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${percent}%` }} />
                      </div>
                    </div>
                )}

                {clipLine && (
                    <div className={`text-xs p-2 rounded-md ${clip.error ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300' : 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300'}`}>
                      <p>{clipLine}</p>
                      {!clip.error && (
                          <div className="mt-1.5 h-1.5 rounded-full bg-purple-200 dark:bg-purple-900/60 overflow-hidden">
                            <div className="h-full bg-purple-500 transition-all duration-300" style={{ width: `${clipPercent}%` }} />
                          </div>
                      )}
                    </div>
                )}

                {statusMessage && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700 pt-2 line-clamp-3">{statusMessage}</p>
                )}

                <div className="flex items-center justify-between text-[10px] text-gray-400 uppercase tracking-wider font-mono">
                  <span>{tfBackend || t('hud.init')}</span>
                  <div className="flex items-center gap-1">
                    <span>{t('hud.models')}</span>
                    {isModelLoading ? <Loader className="w-3 h-3 animate-spin" /> :
                        areModelsReady ? <CheckCircle2 className="w-3 h-3 text-green-500" /> :
                            <AlertCircle className="w-3 h-3 text-red-500" />}
                  </div>
                </div>
              </div>
          )}
        </div>
      </div>
  );
};

export default FloatingHUD;
