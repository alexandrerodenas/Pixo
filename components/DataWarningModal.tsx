import React, { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';
import { subscribeDownloadRequests, type DownloadRequest } from '../services/downloadGuard.ts';
import { closeApp, isPhoneLibrary } from '../services/phoneLibrary.ts';
import { t } from '../services/i18n.ts';

// Shown before the AI models are downloaded over mobile data.
const DataWarningModal: React.FC = () => {
  const [request, setRequest] = useState<DownloadRequest | null>(null);

  useEffect(() => subscribeDownloadRequests(setRequest), []);
  if (!request) return null;

  const answer = (allowed: boolean) => {
    request.resolve(allowed);
    setRequest(null);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4" role="alertdialog" aria-modal="true">
      <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-gray-800 p-6 shadow-2xl">
        <div className="flex items-center gap-3 mb-3">
          <WifiOff className="w-6 h-6 text-orange-500 shrink-0" />
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{t('data.title')}</h2>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-5">{t('data.body', { size: request.sizeMB })}</p>
        <div className="flex flex-col gap-2">
          {isPhoneLibrary() && (
            <button
              onClick={() => { answer(false); closeApp(); }}
              className="w-full px-4 py-2.5 rounded-lg bg-primary text-white font-semibold"
            >
              {t('data.close')}
            </button>
          )}
          <button
            onClick={() => answer(true)}
            className="w-full px-4 py-2.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100 font-semibold"
          >
            {t('data.continue')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DataWarningModal;
