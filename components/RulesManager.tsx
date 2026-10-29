
import React, { useState } from 'react';
import type { UserProfile, FilterRule } from '../services/types.ts';
import { Trash2, PlusCircle, Bot, Boxes, Pencil, Check, X } from 'lucide-react';
import AutocompleteInput from './AutocompleteInput.tsx';
import { t } from '../services/i18n.ts';

interface RulesManagerProps {
  profile: UserProfile;
  setProfile: (updater: (profile: UserProfile) => UserProfile) => void;
  allAvailableClassificationLabels: string[];
  allAvailableDetectionLabels: string[];
}

export const RulesManager: React.FC<RulesManagerProps> = ({ profile, setProfile, allAvailableClassificationLabels, allAvailableDetectionLabels }) => {
  // State for adding new rules
  const [newClassificationRule, setNewClassificationRule] = useState({ label: '', confidence: 75 });
  const [isClassificationAnyConfidence, setIsClassificationAnyConfidence] = useState(false);

  const [newDetectionRule, setNewDetectionRule] = useState({ label: '', confidence: 75 });
  const [isDetectionAnyConfidence, setIsDetectionAnyConfidence] = useState(false);

  // State for editing existing rules
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [editRuleData, setEditRuleData] = useState<{ confidence: number; anyConfidence: boolean }>({ confidence: 75, anyConfidence: false });

  const handleAddRule = (type: 'classification' | 'detection') => {
    if (type === 'classification') {
      if (!newClassificationRule.label.trim()) return;
      const ruleToAdd: FilterRule = {
        id: crypto.randomUUID(),
        label: newClassificationRule.label.trim(),
      };
      if (!isClassificationAnyConfidence) {
        ruleToAdd.confidence = newClassificationRule.confidence;
      }
      setProfile(p => ({
        ...p,
        classificationRules: [...p.classificationRules, ruleToAdd]
      }));
      setNewClassificationRule({ label: '', confidence: 75 });
      setIsClassificationAnyConfidence(false);
    } else {
      if (!newDetectionRule.label.trim()) return;
      const ruleToAdd: FilterRule = {
        id: crypto.randomUUID(),
        label: newDetectionRule.label.trim(),
      };
      if (!isDetectionAnyConfidence) {
        ruleToAdd.confidence = newDetectionRule.confidence;
      }
      setProfile(p => ({
        ...p,
        detectionRules: [...p.detectionRules, ruleToAdd]
      }));
      setNewDetectionRule({ label: '', confidence: 75 });
      setIsDetectionAnyConfidence(false);
    }
  };

  const handleRemoveRule = (id: string, type: 'classification' | 'detection') => {
    if (type === 'classification') {
      setProfile(p => ({...p, classificationRules: p.classificationRules.filter(rule => rule.id !== id)}));
    } else {
      setProfile(p => ({...p, detectionRules: p.detectionRules.filter(rule => rule.id !== id)}));
    }
  };

  const handleStartEdit = (rule: FilterRule) => {
    setEditingRuleId(rule.id);
    setEditRuleData({
      confidence: rule.confidence ?? 75,
      anyConfidence: rule.confidence === undefined,
    });
  };

  const handleCancelEdit = () => {
    setEditingRuleId(null);
  };

  const handleSaveEdit = (type: 'classification' | 'detection') => {
    if (!editingRuleId) return;

    const ruleUpdater = (rules: FilterRule[]) => rules.map(rule => {
      if (rule.id === editingRuleId) {
        const updatedRule = { ...rule };
        if (editRuleData.anyConfidence) {
          delete updatedRule.confidence;
        } else {
          updatedRule.confidence = editRuleData.confidence;
        }
        return updatedRule;
      }
      return rule;
    });

    if (type === 'classification') {
      setProfile(p => ({ ...p, classificationRules: ruleUpdater(p.classificationRules) }));
    } else {
      setProfile(p => ({ ...p, detectionRules: ruleUpdater(p.detectionRules) }));
    }

    setEditingRuleId(null);
  };

  return (
      <div className="space-y-6">
        {/* Classification Rules Section */}
        <div className="space-y-4">
          <h3 className="text-lg font-bold flex items-center gap-2"><Bot className="w-5 h-5 text-secondary"/> {t('rules.classTitle')}</h3>
          {profile.classificationRules.length === 0 && <p className="text-gray-500 text-sm">{t('rules.classNone')}</p>}
          <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
            {profile.classificationRules.map(rule => (
                <div key={rule.id}>
                  {editingRuleId === rule.id ? (
                      <div className="p-3 bg-gray-200 dark:bg-gray-900 rounded-lg space-y-3 ring-2 ring-primary">
                        <div>
                          <label className="block text-sm font-medium mb-1">{t('rules.confidence', { value: editRuleData.confidence })}</label>
                          <input type="range" min="1" max="100" value={editRuleData.confidence} onChange={e => setEditRuleData({...editRuleData, confidence: parseInt(e.target.value)})} className="w-full h-2 bg-gray-300 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer disabled:cursor-not-allowed" disabled={editRuleData.anyConfidence}/>
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer text-sm font-medium">
                          <input type="checkbox" checked={editRuleData.anyConfidence} onChange={e => setEditRuleData({...editRuleData, anyConfidence: e.target.checked})} className="w-4 h-4 rounded text-primary focus:ring-primary"/>
                          <span>{t('rules.anyScore')}</span>
                        </label>
                        <div className="flex justify-end gap-2 mt-2">
                          <button onClick={handleCancelEdit} className="p-2 rounded-full hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors">
                            <X className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                          </button>
                          <button onClick={() => handleSaveEdit('classification')} className="p-2 rounded-full hover:bg-green-200 dark:hover:bg-green-800/50 transition-colors">
                            <Check className="w-5 h-5 text-green-600" />
                          </button>
                        </div>
                      </div>
                  ) : (
                      <div className="flex items-center gap-2 p-2 bg-gray-100 dark:bg-gray-700/50 rounded-md">
                        <span className="font-semibold px-2 py-1 text-xs rounded-full bg-primary/20 text-primary">SELECT</span>
                        <span>{t('rules.ifContains')}</span>
                        <span className="font-semibold text-primary">{`"${rule.label}"`}</span>
                        {rule.confidence !== undefined ? (
                            <>
                              <span>{t('rules.withScore')}</span>
                              <span className="font-semibold text-primary">{`> ${rule.confidence}%`}</span>
                            </>
                        ) : (
                            <span className="font-semibold text-primary/90 ml-1">{t('rules.anyScoreLower')}</span>
                        )}
                        <div className="ml-auto flex items-center gap-1">
                          <button onClick={() => handleStartEdit(rule)} className="p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                            <Pencil className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                          </button>
                          <button onClick={() => handleRemoveRule(rule.id, 'classification')} className="p-1.5 rounded-full hover:bg-red-200 dark:hover:bg-red-800/50 transition-colors">
                            <Trash2 className="w-4 h-4 text-red-600"/>
                          </button>
                        </div>
                      </div>
                  )}
                </div>
            ))}
          </div>
          <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
            <h4 className="font-semibold mb-2">{t('rules.addClassTitle')}</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
              <div>
                <label className="block text-sm font-medium mb-1">{t('rules.label')}</label>
                <AutocompleteInput
                    placeholder={t('rules.classPlaceholder')}
                    value={newClassificationRule.label}
                    onChange={val => setNewClassificationRule({...newClassificationRule, label: val})}
                    suggestions={allAvailableClassificationLabels}
                />
              </div>
              <div className={`transition-opacity ${isClassificationAnyConfidence ? 'opacity-50' : ''}`}>
                <label className="block text-sm font-medium mb-1">{t('rules.confidence', { value: newClassificationRule.confidence })}</label>
                <input type="range" min="1" max="100" value={newClassificationRule.confidence} onChange={e => setNewClassificationRule({...newClassificationRule, confidence: parseInt(e.target.value)})} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-600 disabled:cursor-not-allowed" disabled={isClassificationAnyConfidence}/>
              </div>
            </div>
            <div className="mt-3">
              <label className="flex items-center gap-2 cursor-pointer text-sm font-medium">
                <input type="checkbox" checked={isClassificationAnyConfidence} onChange={e => setIsClassificationAnyConfidence(e.target.checked)} className="w-4 h-4 rounded text-primary focus:ring-primary"/>
                <span>{t('rules.anyScore')}</span>
              </label>
            </div>
            <button onClick={() => handleAddRule('classification')} className="mt-4 w-full sm:w-auto justify-center flex items-center gap-2 px-4 py-2.5 bg-primary text-white font-semibold rounded-md hover:bg-primary-dark transition text-sm">
              <PlusCircle className="w-4 h-4"/> {t('rules.addClass')}
            </button>
          </div>
        </div>

        {/* Detection Rules Section */}
        <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-bold flex items-center gap-2"><Boxes className="w-5 h-5 text-secondary"/> {t('rules.detectTitle')}</h3>
          {profile.detectionRules.length === 0 && <p className="text-gray-500 text-sm">{t('rules.detectNone')}</p>}
          <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
            {profile.detectionRules.map(rule => (
                <div key={rule.id}>
                  {editingRuleId === rule.id ? (
                      <div className="p-3 bg-gray-200 dark:bg-gray-900 rounded-lg space-y-3 ring-2 ring-accent">
                        <div>
                          <label className="block text-sm font-medium mb-1">{t('rules.confidence', { value: editRuleData.confidence })}</label>
                          <input type="range" min="1" max="100" value={editRuleData.confidence} onChange={e => setEditRuleData({...editRuleData, confidence: parseInt(e.target.value)})} className="w-full h-2 bg-gray-300 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer disabled:cursor-not-allowed" disabled={editRuleData.anyConfidence}/>
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer text-sm font-medium">
                          <input type="checkbox" checked={editRuleData.anyConfidence} onChange={e => setEditRuleData({...editRuleData, anyConfidence: e.target.checked})} className="w-4 h-4 rounded text-accent focus:ring-accent"/>
                          <span>{t('rules.anyScore')}</span>
                        </label>
                        <div className="flex justify-end gap-2 mt-2">
                          <button onClick={handleCancelEdit} className="p-2 rounded-full hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors">
                            <X className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                          </button>
                          <button onClick={() => handleSaveEdit('detection')} className="p-2 rounded-full hover:bg-green-200 dark:hover:bg-green-800/50 transition-colors">
                            <Check className="w-5 h-5 text-green-600" />
                          </button>
                        </div>
                      </div>
                  ) : (
                      <div className="flex items-center gap-2 p-2 bg-gray-100 dark:bg-gray-700/50 rounded-md">
                        <span className="font-semibold px-2 py-1 text-xs rounded-full bg-accent/20 text-accent">SELECT</span>
                        <span>{t('rules.ifObject')}</span>
                        <span className="font-semibold text-accent">{`"${rule.label}"`}</span>
                        {rule.confidence !== undefined ? (
                            <>
                              <span>{t('rules.withScore')}</span>
                              <span className="font-semibold text-accent">{`> ${rule.confidence}%`}</span>
                            </>
                        ) : (
                            <span className="font-semibold text-accent/90 ml-1">{t('rules.anyScoreLower')}</span>
                        )}
                        <div className="ml-auto flex items-center gap-1">
                          <button onClick={() => handleStartEdit(rule)} className="p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                            <Pencil className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                          </button>
                          <button onClick={() => handleRemoveRule(rule.id, 'detection')} className="p-1.5 rounded-full hover:bg-red-200 dark:hover:bg-red-800/50 transition-colors">
                            <Trash2 className="w-4 h-4 text-red-600"/>
                          </button>
                        </div>
                      </div>
                  )}
                </div>
            ))}
          </div>
          <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
            <h4 className="font-semibold mb-2">{t('rules.addDetectTitle')}</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
              <div>
                <label className="block text-sm font-medium mb-1">{t('rules.objectName')}</label>
                <AutocompleteInput
                    placeholder={t('rules.detectPlaceholder')}
                    value={newDetectionRule.label}
                    onChange={val => setNewDetectionRule({...newDetectionRule, label: val})}
                    suggestions={allAvailableDetectionLabels}
                />
              </div>
              <div className={`transition-opacity ${isDetectionAnyConfidence ? 'opacity-50' : ''}`}>
                <label className="block text-sm font-medium mb-1">{t('rules.confidence', { value: newDetectionRule.confidence })}</label>
                <input type="range" min="1" max="100" value={newDetectionRule.confidence} onChange={e => setNewDetectionRule({...newDetectionRule, confidence: parseInt(e.target.value)})} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-600 disabled:cursor-not-allowed" disabled={isDetectionAnyConfidence}/>
              </div>
            </div>
            <div className="mt-3">
              <label className="flex items-center gap-2 cursor-pointer text-sm font-medium">
                <input type="checkbox" checked={isDetectionAnyConfidence} onChange={e => setIsDetectionAnyConfidence(e.target.checked)} className="w-4 h-4 rounded text-accent focus:ring-accent"/>
                <span>{t('rules.anyScore')}</span>
              </label>
            </div>
            <button onClick={() => handleAddRule('detection')} className="mt-4 w-full sm:w-auto justify-center flex items-center gap-2 px-4 py-2.5 bg-accent text-white font-semibold rounded-md hover:bg-accent-dark transition text-sm">
              <PlusCircle className="w-4 h-4"/> {t('rules.addDetect')}
            </button>
          </div>
        </div>
      </div>
  );
};
