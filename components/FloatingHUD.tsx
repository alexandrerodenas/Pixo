
import React, { useState } from 'react';
import type { ModelsLoadState } from '../services/types.ts';
import { ChevronDown, ChevronUp, Activity, Image as ImageIcon, CheckSquare, Heart, AlertCircle, CheckCircle2, Loader } from 'lucide-react';
import { Spinner } from './ui.tsx';

interface FloatingHUDProps {
  totalCount: number;
  selectedCount: number;
  savedCount: number;
  statusMessage: string;
  modelsLoadState: ModelsLoadState;
  tfBackend: string | null;
  processingQueueCount: number;
}

const FloatingHUD: React.FC<FloatingHUDProps> = ({
                                                   totalCount,
                                                   selectedCount,
                                                   savedCount,
                                                   statusMessage,
                                                   modelsLoadState,
                                                   tfBackend,
                                                   processingQueueCount
                                                 }) => {
  const [isExpanded, setIsExpanded] = useState(true);

  const isModelLoading = modelsLoadState.classification === 'loading' || modelsLoadState.detection === 'loading';
  const areModelsReady = modelsLoadState.classification === 'loaded' && modelsLoadState.detection === 'loaded';

  return (
      <div className="fixed bottom-4 left-4 z-40 flex flex-col items-start gap-2 max-w-sm">

        {/* Main Stats Card */}
        <div className={`bg-white/90 dark:bg-gray-800/90 backdrop-blur-md shadow-lg border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden transition-all duration-300 ${isExpanded ? 'w-64' : 'w-auto'}`}>
          {/* Header / Toggle */}
          <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="w-full flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
          >
            <div className="flex items-center gap-2 font-bold text-sm text-gray-800 dark:text-gray-100">
              <Activity className="w-4 h-4 text-primary" />
              {isExpanded && <span>Statistiques et état</span>}
            </div>
            {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronUp className="w-4 h-4 text-gray-400" />}
          </button>

          {/* Content */}
          {isExpanded && (
              <div className="px-4 pb-4 space-y-4">
                {/* Counters Grid */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                    <ImageIcon className="w-4 h-4 mx-auto mb-1 text-gray-500" />
                    <span className="block text-xs font-bold">{totalCount}</span>
                  </div>
                  <div className={`p-2 rounded-lg ${selectedCount > 0 ? 'bg-accent/10 text-accent' : 'bg-gray-100 dark:bg-gray-700 text-gray-500'}`}>
                    <CheckSquare className="w-4 h-4 mx-auto mb-1" />
                    <span className="block text-xs font-bold">{selectedCount}</span>
                  </div>
                  <div className={`p-2 rounded-lg ${savedCount > 0 ? 'bg-pink-500/10 text-pink-500' : 'bg-gray-100 dark:bg-gray-700 text-gray-500'}`}>
                    <Heart className="w-4 h-4 mx-auto mb-1 fill-current" />
                    <span className="block text-xs font-bold">{savedCount}</span>
                  </div>
                </div>

                {/* Processing Status */}
                {processingQueueCount > 0 && (
                    <div className="flex items-center justify-between text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-300 p-2 rounded-md">
                      <span className="flex items-center gap-2"><Spinner className="w-3 h-3" /> En cours</span>
                      <span className="font-bold">{processingQueueCount} remaining</span>
                    </div>
                )}

                {/* Status Message */}
                <div className="text-xs text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700 pt-2 mt-2">
                  <p className="line-clamp-2">{statusMessage}</p>
                </div>

                {/* Technical Footer */}
                <div className="flex items-center justify-between text-[10px] text-gray-400 uppercase tracking-wider font-mono pt-1">
                  <span>{tfBackend || 'Init...'}</span>
                  <div className="flex items-center gap-1">
                    <span>Modèles IA :</span>
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
