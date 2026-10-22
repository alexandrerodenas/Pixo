
import React, { useEffect, useState } from 'react';
import type { UserProfile, ThumbnailSize } from '../services/types.ts';
import { Info } from 'lucide-react';
import { subscribeClipStats, type ClipStats } from '../services/clipClient.ts';

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
            <label className="block font-semibold mb-1">Prénom</label>
            <input type="text" value={profile.firstName} onChange={e => handleInputChange('firstName', e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-primary"/>
          </div>
          <div>
            <label className="block font-semibold mb-1">Nom du dossier des photos gardées</label>
            <input type="text" value={profile.savedFolderName} onChange={e => handleInputChange('savedFolderName', e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-primary"/>
          </div>
          <div>
            <label className="block font-semibold mb-1">Action pour les photos gardées</label>
            <select value={profile.savedOperation || 'move'} onChange={e => handleInputChange('savedOperation', e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-primary">
              <option value="move">Déplacer (supprime l'original)</option>
              <option value="copy">Copier (garde l'original)</option>
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <label className="block font-semibold">Taille des miniatures</label>
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
          <label className="block text-sm font-medium mb-1">Modèle de reconnaissance (expérimental)</label>
          <select value={profile.classifier || 'mobilenet'} onChange={e => handleInputChange('classifier', e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-primary">
            <option value="mobilenet">MobileNet (léger, par défaut)</option>
            <option value="clip">CLIP (plus précis, téléchargement au premier usage)</option>
          </select>
          {profile.classifier === 'clip' && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {clipStats.loaded
                ? `Mesures : ${clipStats.downloadedMB} Mo téléchargés, chargé en ${((clipStats.loadMs ?? 0) / 1000).toFixed(1)} s (${clipStats.device})` +
                  (clipStats.avgMs ? `, ${clipStats.avgMs} ms par photo sur ${clipStats.photos} photos` : ', aucune photo analysée pour l\'instant')
                : 'Le modèle se télécharge à la prochaine analyse. Les mesures s\'affichent ici ensuite. Les nouvelles photos seulement sont concernées.'}
            </p>
          )}
        </div>

        <div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={profile.autoApplyRules} onChange={e => handleInputChange('autoApplyRules', e.target.checked)} className="w-5 h-5 rounded text-primary focus:ring-primary"/>
            <span>Appliquer automatiquement les règles au chargement</span>
          </label>
        </div>

        {/* Blur Detection Settings */}
        <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-bold">Sensibilité de détection du flou</h3>
          <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg space-y-4 border border-gray-200 dark:border-gray-700">
            <div className="flex items-start gap-3 text-sm text-gray-600 dark:text-gray-400">
              <Info className="w-5 h-5 flex-shrink-0 text-secondary" />
              <div>
                <p className="font-semibold mb-1">Seuils recommandés (score de variance) :</p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li><span className="font-medium text-gray-800 dark:text-gray-200">0 - 60:</span> Très flou / hors focus</li>
                  <li><span className="font-medium text-gray-800 dark:text-gray-200">60 - 150:</span> Doux / léger flou de bougé</li>
                  <li><span className="font-medium text-gray-800 dark:text-gray-200">150 - 300:</span> Netteté correcte</li>
                  <li><span className="font-medium text-gray-800 dark:text-gray-200">300+:</span> Très net / beaucoup de détails</li>
                </ul>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <div className="flex justify-between mb-1">
                  <label className="block text-sm font-semibold text-orange-600 dark:text-orange-400">Seuil de flou</label>
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
                <p className="text-xs text-gray-500 mt-1">Les photos sous ce score sont marquées <span className="font-bold text-orange-600">floues</span>.</p>
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <label className="block text-sm font-semibold text-green-600 dark:text-green-400">Seuil de netteté</label>
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
                <p className="text-xs text-gray-500 mt-1">Les photos au-dessus de ce score sont marquées <span className="font-bold text-green-600">nettes</span>.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Uncategorized Rule Section */}
        <div className="space-y-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-bold">Règle « Sans catégorie » (selon la classification)</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            If all AI **classification** scores for a photo are below this threshold, it will be classified as 'Uncategorized'. This helps filter out ambiguous images.
          </p>
          <div>
            <label className="block text-sm font-medium mb-1">Seuil de confiance ({profile.unknownThreshold}%)</label>
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
