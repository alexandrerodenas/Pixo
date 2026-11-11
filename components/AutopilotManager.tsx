import React from 'react';
import type { UserProfile } from '../services/types.ts';
import { Sparkles, Trash2, Heart, EyeOff, Eye, Wand2, RotateCcw } from 'lucide-react';
import { useAutopilot } from '../hooks/useAutopilot.ts';
import { DEFAULT_THRESHOLD, MIN_EXAMPLES, MIN_PER_CLASS, resetAutopilot } from '../services/autopilot.ts';
import { describeFeature, featureToRule } from '../services/autopilotLabels.ts';
import { t } from '../services/i18n.ts';

interface AutopilotManagerProps {
  profile: UserProfile;
  setProfile: (updater: (profile: UserProfile) => UserProfile) => void;
}

export const AutopilotManager: React.FC<AutopilotManagerProps> = ({ profile, setProfile }) => {
  const state = useAutopilot();
  const ignored = profile.autopilotIgnored ?? [];
  const threshold = profile.autopilotThreshold ?? DEFAULT_THRESHOLD;
  const rules = state.rules.filter(r => !ignored.includes(r.feature));

  const hasManualRule = (feature: string) => {
    const rule = featureToRule(feature);
    if (!rule) return false;
    const list = rule.type === 'classification' ? profile.classificationRules : profile.detectionRules;
    return list.some(r => r.label.toLowerCase() === rule.label);
  };

  const toggleIgnored = (feature: string) => setProfile(p => {
    const current = p.autopilotIgnored ?? [];
    return { ...p, autopilotIgnored: current.includes(feature) ? current.filter(f => f !== feature) : [...current, feature] };
  });

  const forceRule = (feature: string) => {
    const rule = featureToRule(feature);
    if (!rule) return;
    setProfile(p => rule.type === 'classification'
      ? { ...p, classificationRules: [...p.classificationRules, { id: crypto.randomUUID(), label: rule.label }] }
      : { ...p, detectionRules: [...p.detectionRules, { id: crypto.randomUUID(), label: rule.label }] });
  };

  const handleReset = () => {
    if (window.confirm(t('ap.confirmReset', { count: state.total }))) resetAutopilot();
  };

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <h3 className="text-lg font-bold flex items-center gap-2"><Sparkles className="w-5 h-5 text-secondary" /> {t('ap.title')}</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">{t('ap.intro')}</p>
        <label className="flex items-center gap-2 cursor-pointer font-medium">
          <input type="checkbox" checked={!!profile.autopilot} onChange={e => setProfile(p => ({ ...p, autopilot: e.target.checked }))} className="w-5 h-5 rounded text-primary focus:ring-primary" />
          <span>{t('ap.enable')}</span>
        </label>
        <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg text-sm space-y-1">
          <p>{t('ap.stats', { total: state.total, deleted: state.deleted, kept: state.kept })}</p>
          <p className="text-gray-600 dark:text-gray-400">
            {state.ready ? t('ap.ready') : t('ap.notReady', { min: MIN_EXAMPLES, perClass: MIN_PER_CLASS })}
          </p>
        </div>
        <div className={profile.autopilot ? '' : 'opacity-50'}>
          <label className="block text-sm font-medium mb-1">{t('ap.threshold', { value: threshold })}</label>
          <input type="range" min="50" max="99" value={threshold} disabled={!profile.autopilot}
            onChange={e => setProfile(p => ({ ...p, autopilotThreshold: parseInt(e.target.value) }))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-600 disabled:cursor-not-allowed" />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('ap.thresholdHint')}</p>
        </div>
      </div>

      <div className="space-y-2 pt-4 border-t border-gray-200 dark:border-gray-700">
        <h4 className="font-bold">{t('ap.rulesTitle')}</h4>
        {rules.length === 0 && <p className="text-sm text-gray-500">{t('ap.rulesNone')}</p>}
        <ul className="space-y-2">
          {rules.map(rule => (
            <li key={rule.feature} className="flex items-center gap-2 p-2 bg-gray-100 dark:bg-gray-700/50 rounded-md text-sm">
              <span className={`flex items-center gap-1 font-semibold px-2 py-1 text-xs rounded-full flex-shrink-0 ${rule.action === 'delete' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' : 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'}`}>
                {rule.action === 'delete' ? <Trash2 className="w-3 h-3" /> : <Heart className="w-3 h-3" />}
                {t(rule.action === 'delete' ? 'ap.toDelete' : 'ap.toKeep')}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">{describeFeature(rule.feature)}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{t('ap.evidence', { deleted: rule.deleted, kept: rule.kept })}</p>
              </div>
              {rule.action === 'delete' && featureToRule(rule.feature) && (
                hasManualRule(rule.feature)
                  ? <span className="text-xs text-primary flex-shrink-0" title={t('ap.forced')}><Wand2 className="w-4 h-4" /></span>
                  : <button onClick={() => forceRule(rule.feature)} title={t('ap.force')} aria-label={t('ap.force')} className="p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 flex-shrink-0">
                      <Wand2 className="w-4 h-4 text-primary" />
                    </button>
              )}
              <button onClick={() => toggleIgnored(rule.feature)} title={t('ap.ignore')} aria-label={t('ap.ignore')} className="p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 flex-shrink-0">
                <EyeOff className="w-4 h-4 text-gray-500" />
              </button>
            </li>
          ))}
        </ul>
      </div>

      {ignored.length > 0 && (
        <div className="space-y-2 pt-4 border-t border-gray-200 dark:border-gray-700">
          <h4 className="font-bold">{t('ap.ignoredTitle')}</h4>
          <ul className="space-y-1">
            {ignored.map(feature => (
              <li key={feature} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <span className="flex-1 truncate line-through">{describeFeature(feature)}</span>
                <button onClick={() => toggleIgnored(feature)} title={t('ap.restore')} aria-label={t('ap.restore')} className="p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600">
                  <Eye className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {state.total > 0 && (
        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <button onClick={handleReset} className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-200 dark:bg-gray-700 font-semibold rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition">
            <RotateCcw className="w-4 h-4" /> {t('ap.reset')}
          </button>
        </div>
      )}
    </div>
  );
};
