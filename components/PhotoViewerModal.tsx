
import React from 'react';
import type { Photo } from '../services/types.ts';
import { PhotoStatus } from '../services/types.ts';
import { Spinner } from './ui.tsx';
import ZoomableImage from './ZoomableImage.tsx';
import { X, Bot, Boxes, Wand2, Focus, AlertTriangle, CheckCircle2, Sparkles } from 'lucide-react';
import { describeFeature } from '../services/autopilotLabels.ts';
import { t } from '../services/i18n.ts';

interface PhotoViewerModalProps {
  photo: Photo | null;
  onClose: () => void;
}

const PhotoViewerModal: React.FC<PhotoViewerModalProps> = ({ photo, onClose }) => {
  if (!photo) return null;

  const isAnalysisPending = photo.status === PhotoStatus.ANALYZING || photo.status === PhotoStatus.QUEUED;
  const hasMatchedRules = photo.matchedRules && (photo.matchedRules.classification?.length || photo.matchedRules.detection?.length);

  const getBlurColor = (level?: string) => {
    switch (level) {
      case 'sharp': return 'text-green-600 bg-green-100 dark:text-green-300 dark:bg-green-900/50';
      case 'ok': return 'text-blue-600 bg-blue-100 dark:text-blue-300 dark:bg-blue-900/50';
      case 'blurry': return 'text-orange-600 bg-orange-100 dark:text-orange-300 dark:bg-orange-900/50';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getBlurIcon = (level?: string) => {
    switch(level) {
      case 'sharp': return <CheckCircle2 className="w-4 h-4" />;
      case 'blurry': return <AlertTriangle className="w-4 h-4" />;
      default: return <Focus className="w-4 h-4" />;
    }
  };

  return (
      <div className="fixed inset-0 bg-black/70 z-40 flex items-center justify-center" onClick={onClose}>
        <div className="relative w-full max-w-4xl max-h-[90vh] bg-white dark:bg-gray-800 rounded-lg shadow-2xl flex flex-col md:flex-row" onClick={e => e.stopPropagation()}>
          <div className="md:w-2/3 shrink-0 bg-black/90 rounded-t-lg md:rounded-tr-none md:rounded-l-lg overflow-hidden">
            <ZoomableImage src={photo.objectURL} alt={t('viewer.alt')} className="w-full h-[50vh] md:h-[85vh]" />
          </div>
          <div className="md:w-1/3 p-4 md:p-6 flex flex-col overflow-y-auto min-h-0 flex-1">
            <button onClick={onClose} className="absolute top-3 right-3 p-1.5 bg-gray-200/50 dark:bg-gray-700/50 rounded-full hover:bg-red-500 hover:text-white transition">
              <X className="w-5 h-5"/>
            </button>
            {isAnalysisPending ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-500">
                  <Spinner className="w-10 h-10 mb-2"/>
                  <p>{t('viewer.pending')}</p>
                </div>
            ) : (
                <div className="space-y-6">
                  {hasMatchedRules && (
                      <div className="p-3 bg-green-50 dark:bg-green-900/30 border-l-4 border-green-500 rounded-r-md">
                        <h3 className="text-lg font-bold mb-2 flex items-center gap-2 text-green-700 dark:text-green-300">
                          <Wand2 className="w-5 h-5"/> {t('viewer.rules')}
                        </h3>
                        <ul className="space-y-1 text-sm list-disc list-inside text-gray-700 dark:text-gray-300">
                          {photo.matchedRules!.classification?.map(ruleLabel => (
                              <li key={`c-rule-${ruleLabel}`}>
                                {t('viewer.ruleClass')} <span className="font-semibold capitalize">{ruleLabel}</span>
                              </li>
                          ))}
                          {photo.matchedRules!.detection?.map(ruleLabel => (
                              <li key={`d-rule-${ruleLabel}`}>
                                {t('viewer.ruleDetect')} <span className="font-semibold capitalize">{ruleLabel}</span>
                              </li>
                          ))}
                        </ul>
                      </div>
                  )}

                  {photo.matchedRules?.autopilot && (
                      <div className="p-3 bg-purple-50 dark:bg-purple-900/30 border-l-4 border-purple-500 rounded-r-md">
                        <h3 className="text-lg font-bold mb-2 flex items-center gap-2 text-purple-700 dark:text-purple-300">
                          <Sparkles className="w-5 h-5"/> {t('ap.viewerTitle', { score: photo.matchedRules.autopilot.score })}
                        </h3>
                        <ul className="space-y-1 text-sm list-disc list-inside text-gray-700 dark:text-gray-300">
                          {photo.matchedRules.autopilot.features.map(feature => <li key={feature}>{describeFeature(feature)}</li>)}
                        </ul>
                        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{t('ap.viewerHint')}</p>
                      </div>
                  )}

                  {photo.blurScore !== undefined && (
                      <div className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
                        <div className="flex justify-between items-center mb-2">
                          <h3 className="font-bold flex items-center gap-2">
                            <Focus className="w-5 h-5 text-secondary" /> {t('viewer.sharpness')}
                          </h3>
                          <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${getBlurColor(photo.blurLevel)}`}>
                                    {getBlurIcon(photo.blurLevel)} {photo.blurLevel ? t(`blur.${photo.blurLevel}`) : ''}
                                </span>
                        </div>
                        <div className="relative pt-1">
                          <div className="flex items-center justify-between">
                            <div className="text-xs font-semibold text-gray-600 dark:text-gray-400">0</div>
                            <div className="text-xs font-bold text-primary">{photo.blurScore}/100</div>
                            <div className="text-xs font-semibold text-gray-600 dark:text-gray-400">100</div>
                          </div>
                          <div className="overflow-hidden h-2 mb-1 text-xs flex rounded bg-gray-200 dark:bg-gray-600 mt-1">
                            <div
                                style={{ width: `${photo.blurScore}%` }}
                                className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center ${photo.blurLevel === 'blurry' ? 'bg-orange-500' : photo.blurLevel === 'ok' ? 'bg-blue-500' : 'bg-green-500'}`}
                            ></div>
                          </div>
                        </div>
                      </div>
                  )}

                  <div>
                    <h3 className="text-lg font-bold mb-3 flex items-center gap-2"><Bot className="w-5 h-5 text-secondary" /> {t('viewer.classifications')}</h3>
                    <ul className="space-y-3">
                      {photo.classifications.length > 0 ? photo.classifications.map((p, i) => (
                          <li key={`class-${i}`} className="text-sm">
                            <div className="flex justify-between items-center mb-1">
                              <span className="font-semibold capitalize">{p.label}</span>
                              <span className="font-mono text-xs px-2 py-0.5 bg-primary/20 text-primary rounded-full">{`${(p.score * 100).toFixed(1)}%`}</span>
                            </div>
                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                              <div className="bg-primary h-1.5 rounded-full" style={{width: `${p.score * 100}%`}}></div>
                            </div>
                          </li>
                      )) : <p className="text-gray-500 text-sm">{t('viewer.noClass')}</p>}
                    </ul>
                  </div>

                  <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-bold mb-3 flex items-center gap-2"><Boxes className="w-5 h-5 text-secondary" /> {t('viewer.objects')}</h3>
                    <ul className="space-y-3">
                      {photo.detections.length > 0 ? photo.detections.map((p, i) => (
                          <li key={`detect-${i}`} className="text-sm">
                            <div className="flex justify-between items-center mb-1">
                              <span className="font-semibold capitalize">{p.label}</span>
                              <span className="font-mono text-xs px-2 py-0.5 bg-accent/20 text-accent rounded-full">{`${(p.score * 100).toFixed(1)}%`}</span>
                            </div>
                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                              <div className="bg-accent h-1.5 rounded-full" style={{width: `${p.score * 100}%`}}></div>
                            </div>
                          </li>
                      )) : <p className="text-gray-500 text-sm">{t('viewer.noObjects')}</p>}
                    </ul>
                  </div>
                </div>
            )}

            <div className="mt-auto pt-4">
              <p className="text-xs text-gray-400 truncate" title={photo.id}>{photo.id}</p>
            </div>
          </div>
        </div>
      </div>
  );
};

export default PhotoViewerModal;
