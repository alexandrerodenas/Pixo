import React, { useState } from 'react';
import { Bot, CheckSquare, FolderTree, Heart, ShieldCheck, Wand2, X } from 'lucide-react';
import { t } from '../services/i18n.ts';

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: (dontShowAgain: boolean) => void;
}

const FeatureItem = ({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) => (
    <div className="flex items-start gap-4">
      <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-primary/20 text-primary">
        {icon}
      </div>
      <div>
        <h4 className="font-bold text-gray-800 dark:text-gray-100">{title}</h4>
        <p className="text-sm text-gray-600 dark:text-gray-400">{description}</p>
      </div>
    </div>
);

const WelcomeModal: React.FC<WelcomeModalProps> = ({ isOpen, onClose }) => {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  if (!isOpen) return null;

  const handleClose = () => {
    onClose(dontShowAgain);
  };

  return (
      <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={handleClose}>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
          <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt={t('onb.logoAlt')} className="w-10 h-10" />
              <h2 className="text-2xl font-bold">{t('welcome.title')}</h2>
            </div>
            <button onClick={handleClose} className="p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600">
              <X className="w-5 h-5"/>
            </button>
          </div>
          <div className="p-6 overflow-y-auto space-y-6">
            <p className="text-center text-lg text-gray-700 dark:text-gray-300">
              {t('welcome.intro')}
            </p>
            <div className="space-y-5">
              <FeatureItem
                  icon={<ShieldCheck className="w-5 h-5" />}
                  title={t('welcome.f1.title')}
                  description={t('welcome.f1.body')}
              />
              <FeatureItem
                  icon={<Bot className="w-5 h-5" />}
                  title={t('welcome.f2.title')}
                  description={t('welcome.f2.body')}
              />
              <FeatureItem
                  icon={<FolderTree className="w-5 h-5" />}
                  title={t('welcome.f3.title')}
                  description={t('welcome.f3.body')}
              />
              <FeatureItem
                  icon={<Wand2 className="w-5 h-5" />}
                  title={t('welcome.f4.title')}
                  description={t('welcome.f4.body')}
              />
              <FeatureItem
                  icon={<Heart className="w-5 h-5" />}
                  title={t('welcome.f5.title')}
                  description={t('welcome.f5.body')}
              />
              <FeatureItem
                  icon={<CheckSquare className="w-5 h-5" />}
                  title={t('welcome.f6.title')}
                  description={t('welcome.f6.body')}
              />
            </div>
          </div>
          <div className="p-4 bg-gray-50 dark:bg-gray-800/50 flex flex-col sm:flex-row justify-between items-center gap-4 rounded-b-lg border-t border-gray-200 dark:border-gray-700">
            <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-600 dark:text-gray-400">
              <input
                  type="checkbox"
                  checked={dontShowAgain}
                  onChange={(e) => setDontShowAgain(e.target.checked)}
                  className="w-4 h-4 rounded text-primary focus:ring-primary"
              />
              {t('welcome.dontShow')}
            </label>
            <button
                onClick={handleClose}
                className="w-full sm:w-auto px-6 py-2 bg-primary text-white font-semibold rounded-md hover:bg-primary-dark transition"
            >
              {t('welcome.go')}
            </button>
          </div>
        </div>
      </div>
  );
};

export default WelcomeModal;