import React from 'react';
import type { ModelsLoadState, ModelLoadStatus } from '../services/types.ts';
import { Spinner } from './ui.tsx';
import { CheckCircle2, XCircle } from 'lucide-react';

const StatusIcon: React.FC<{ status: ModelLoadStatus }> = ({ status }) => {
  switch (status) {
    case 'loading':
      return <Spinner className="w-4 h-4" />;
    case 'loaded':
      return <CheckCircle2 className="w-4 h-4 text-green-500" />;
    case 'error':
      return <XCircle className="w-4 h-4 text-red-500" />;
    default:
      return <div className="w-4 h-4" />; // Placeholder for 'idle'
  }
};

const ModelLoadingIndicator: React.FC<{ status: ModelsLoadState }> = ({ status }) => {
  // Hide component if both models are loaded successfully
  if (status.classification === 'loaded' && status.detection === 'loaded') {
    return null;
  }

  // Hide if idle and no action has been taken yet
  if (status.classification === 'idle' && status.detection === 'idle') {
    return null;
  }

  return (
      <div className="mt-4 mb-2 p-3 bg-gray-100 dark:bg-gray-700/50 rounded-lg text-sm space-y-2 transition-all duration-300">
        <h4 className="font-semibold text-center text-gray-600 dark:text-gray-300 text-xs uppercase tracking-wider">État des modèles IA</h4>
        <div className="flex items-center justify-between">
          <span className="text-gray-700 dark:text-gray-200">Classification</span>
          <StatusIcon status={status.classification} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-700 dark:text-gray-200">Détection d'objets</span>
          <StatusIcon status={status.detection} />
        </div>
      </div>
  );
};

export default ModelLoadingIndicator;
