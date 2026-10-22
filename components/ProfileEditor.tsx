
import React, { useEffect, useState } from 'react';
import type { UserProfile, ThumbnailSize } from '../services/types.ts';
import { Info } from 'lucide-react';
import { subscribeClipStats, type ClipStats } from '../services/clipClient.ts';
import { t } from '../services/i18n.ts';

interface ProfileEditorProps {
  profile: UserProfile;
  setProfile: (updater: (profile: UserProfile) => UserProfile) => void;
}

export const ProfileEditor: React.FC<ProfileEditorProps> = ({ profile, setProfile }) => {
  const thumbnailSizes: ThumbnailSize[] = ['XS', 'S', 'M', 'L', 'XL'];

  const handleInputChange = (field: keyof UserProfile, value: any) => {
    setProfile(p => ({ ...p, [field]: value }));
  };

  const [clipStats, setClipStats] = useState<ClipStats>({ loaded: false, photos: 0 });
  useEffect(() => subscribeClipStats(setClipStats), []);

  const blurThreshold = profile.blurThreshold ?? 100;
  const sharpThreshold = profile.sharpThreshold ?? 300;

  const handleBlurThresholdChange = (newVal: number) => {
    // Ensure blur threshold doesn't exceed sharp threshold
    const validVal = Math.min(newVal, sharpThreshold - 10);
    handleInputChange('blurThreshold', validVal);
  };

  const handleSharpThresholdChange = (newVal: number) => {
    // Ensure sharp threshold doesn't go below blur threshold
    const validVal = Math.max(newVal, blurThreshold + 10);
    handleInputChange('sharpThreshold', validVal);
  };

  return (
      <div className="space-y-6">
        {/* General Settings */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block font-semibold mb-1">{t('pe.firstName')}</label>
            <input type="text" value={profile.firstName} onChange={e => handleInputChange('firstName', e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-primary"/>
          </div>
          <div>
            <label className="block font-semibold mb-1">{t('pe.savedFolder')}</label>
            <input type="text" value={profile.savedFolderName} onChange={e => handleInputChange('savedFolderName', e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-primary"/>
          </div>
          <div>
            <label className="block font-semibold mb-1">{t('pe.savedAction')}</label>
            <select value={profile.savedOperation || 'move'} onChange={e => handleInputChange('savedOperation', e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-primary">
              <option value="move">{t('pe.move')}</option>
              <option value="copy">{t('pe.copy')}</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block font-semibold mb-1">{t('pe.language')}</label>
          <select value={profile.language || 'auto'} onChange={e => handleInputChange('language', e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-primary">
            <option value="auto">{t('pe.langAuto')}</option>
            <option value="fr">Français</option>
            <option value="en">English</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className="block font-semibold">{t('pe.thumbSize')}</label>
          <div className="flex items-center p-1 bg-gray-200 dark:bg-gray-700 rounded-lg">
            {thumbnailSizes.map(size => (
                <button
                    key={size}
                    onClick={() => handleInputChange('thumbnailSize', size)}
                    className={`flex-1 p-2 rounded-md transition-colors text-sm font-semibold ${
                        (profile.thumbnailSize || 'M') === size
                            ? 'bg-white dark:bg-gray-800 text-primary shadow-sm'
                            : 'text-gray-600 dark:text-gray-400 hover:bg-white/50 dark:hover:bg-gray-800/50'
                    }`}
                >
                  {size}
                </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block font-semibold mb-1">{t('pe.startup')}</label>
          <select value={profile.startupView || 'all'} onChange={e => handleInputChange('startupView', e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-primary">
            <option value="all">{t('pe.startAll')}</option>
            <option value="new">{t('pe.startNew')}</option>
          </select>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {t('pe.startNote')}
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">{t('pe.model')}</label>
          <select value={profile.classifier || 'mobilenet'} onChange={e => handleInputChange('classifier', e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-primary">
            <option value="mobilenet">{t('pe.mobilenet')}</option>
            <option value="clip">{t('pe.clip')}</option>
          </select>
          {profile.classifier === 'clip' && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {clipStats.loaded
                ? t('pe.clipStats', { mb: clipStats.downloadedMB ?? 0, sec: ((clipStats.loadMs ?? 0) / 1000).toFixed(1), device: clipStats.device ?? '' }) +
                  (clipStats.avgMs ? t('pe.clipPerPhoto', { ms: clipStats.avgMs, photos: clipStats.photos }) : t('pe.clipNoPhoto'))
                : t('pe.clipPending')}
            </p>
          )}
        </div>

        <div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={profile.autoApplyRules} onChange={e => handleInputChange('autoApplyRules', e.target.checked)} className="w-5 h-5 rounded text-primary focus:ring-primary"/>
            <span>{t('pe.autoApply')}</span>
          </label>
        </div>

        {/* Blur Detection Settings */}
        <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-bold">{t('pe.blurTitle')}</h3>
          <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg space-y-4 border border-gray-200 dark:border-gray-700">
            <div className="flex items-start gap-3 text-sm text-gray-600 dark:text-gray-400">
              <Info className="w-5 h-5 flex-shrink-0 text-secondary" />
              <div>
                <p className="font-semibold mb-1">{t('pe.blurHint')}</p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li><span className="font-medium text-gray-800 dark:text-gray-200">0 - 60:</span> {t('pe.blur1')}</li>
                  <li><span className="font-medium text-gray-800 dark:text-gray-200">60 - 150:</span> {t('pe.blur2')}</li>
                  <li><span className="font-medium text-gray-800 dark:text-gray-200">150 - 300:</span> {t('pe.blur3')}</li>
                  <li><span className="font-medium text-gray-800 dark:text-gray-200">300+:</span> {t('pe.blur4')}</li>
                </ul>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <div className="flex justify-between mb-1">
                  <label className="block text-sm font-semibold text-orange-600 dark:text-orange-400">{t('pe.blurThreshold')}</label>
                  <span className="text-xs font-mono bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 px-2 py-0.5 rounded">&lt; {blurThreshold}</span>
                </div>
                <input
                    type="range"
                    min="10"
                    max="500"
                    step="10"
                    value={blurThreshold}
                    onChange={e => handleBlurThresholdChange(parseInt(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-600 accent-orange-500"
                />
                <p className="text-xs text-gray-500 mt-1">{t('pe.blurBelow')}</p>
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <label className="block text-sm font-semibold text-green-600 dark:text-green-400">{t('pe.sharpThreshold')}</label>
                  <span className="text-xs font-mono bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 px-2 py-0.5 rounded">&gt; {sharpThreshold}</span>
                </div>
                <input
                    type="range"
                    min="50"
                    max="1000"
                    step="10"
                    value={sharpThreshold}
                    onChange={e => handleSharpThresholdChange(parseInt(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-600 accent-green-500"
                />
                <p className="text-xs text-gray-500 mt-1">{t('pe.sharpAbove')}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Uncategorized Rule Section */}
        <div className="space-y-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-bold">{t('pe.uncatTitle')}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('pe.uncatBody')}
          </p>
          <div>
            <label className="block text-sm font-medium mb-1">{t('pe.confidence', { value: profile.unknownThreshold ?? 0 })}</label>
            <input
                type="range"
                min="0"
                max="50"
                value={profile.unknownThreshold}
                onChange={e => handleInputChange('unknownThreshold', parseInt(e.target.value, 10))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-600"
            />
          </div>
        </div>
      </div>
  );
};
