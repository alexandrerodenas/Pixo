import React, { useState, useEffect } from 'react';
import type { UserProfile, CustomLabel } from '../services/types.ts';
import { Trash2, PlusCircle, X, Edit, Save, Tag } from 'lucide-react';
import AutocompleteInput from './AutocompleteInput.tsx';


interface CustomLabelsManagerProps {
  profile: UserProfile;
  setProfile: (updater: (profile: UserProfile) => UserProfile) => void;
  allAvailableLabels: string[];
}

export const CustomLabelsManager: React.FC<CustomLabelsManagerProps> = ({ profile, setProfile, allAvailableLabels }) => {
  const [editingLabel, setEditingLabel] = useState<CustomLabel | null>(null);
  const [name, setName] = useState('');
  const [associatedLabels, setAssociatedLabels] = useState<string[]>([]);
  const [currentAILabel, setCurrentAILabel] = useState('');

  useEffect(() => {
    if (editingLabel) {
      setName(editingLabel.name);
      setAssociatedLabels(editingLabel.labels);
    } else {
      setName('');
      setAssociatedLabels([]);
    }
  }, [editingLabel]);

  const handleAddAILabel = () => {
    const labelToAdd = currentAILabel.trim().toLowerCase();
    if (labelToAdd && !associatedLabels.includes(labelToAdd)) {
      setAssociatedLabels(prev => [...prev, labelToAdd]);
    }
    setCurrentAILabel('');
  };

  const handleRemoveAILabel = (labelToRemove: string) => {
    setAssociatedLabels(prev => prev.filter(l => l !== labelToRemove));
  };

  const handleSave = () => {
    if (!name.trim() || associatedLabels.length === 0) {
      alert('Donne un nom et au moins un libellé IA associé.');
      return;
    }

    setProfile(p => {
      const customLabels = p.customLabels ?? [];
      if (editingLabel) {
        // Update existing
        return {
          ...p,
          customLabels: customLabels.map(cl =>
              cl.id === editingLabel.id
                  ? { ...cl, name: name.trim(), labels: associatedLabels }
                  : cl
          )
        };
      } else {
        // Add new
        const newLabel: CustomLabel = {
          id: crypto.randomUUID(),
          name: name.trim(),
          labels: associatedLabels
        };
        return { ...p, customLabels: [...customLabels, newLabel] };
      }
    });

    setEditingLabel(null); // This will trigger the useEffect to reset the form
  };

  const handleDelete = (id: string) => {
    if(window.confirm('Supprimer ce libellé personnalisé ?')) {
      setProfile(p => ({
        ...p,
        customLabels: (p.customLabels ?? []).filter(cl => cl.id !== id)
      }));
    }
  };

  const handleCancel = () => {
    setEditingLabel(null);
  };

  const existingCustomLabelNames = (profile.customLabels ?? []).map(l => l.name);
  const availableSuggestions = allAvailableLabels.filter(l => !associatedLabels.includes(l.toLowerCase()));

  return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-bold">Libellés personnalisés</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Group multiple AI-generated labels under a single, personalized name. For example, a "Dog" label could group "collie", "poodle", and "retriever".
          </p>
        </div>

        {/* Form for adding/editing */}
        <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg space-y-4">
          <h4 className="font-semibold text-lg">{editingLabel ? `Editing "${editingLabel.name}"` : 'Créer un libellé personnalisé'}</h4>

          <div>
            <label className="block text-sm font-medium mb-1">Nom du libellé</label>
            <AutocompleteInput
                placeholder="e.g., Dog, My Family, Vacation"
                value={name}
                onChange={setName}
                suggestions={existingCustomLabelNames}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Libellés IA associés</label>
            <div className="flex items-center gap-2">
              <div className="flex-grow">
                <AutocompleteInput
                    placeholder="Tape un libellé IA à ajouter..."
                    value={currentAILabel}
                    onChange={setCurrentAILabel}
                    suggestions={availableSuggestions}
                />
              </div>
              <button
                  type="button"
                  onClick={handleAddAILabel}
                  disabled={!currentAILabel.trim()}
                  className="px-3 py-2 bg-secondary text-white font-semibold rounded-md hover:bg-secondary-dark transition text-sm disabled:bg-gray-400"
              >
                Add
              </button>
            </div>
          </div>

          {associatedLabels.length > 0 && (
              <div className="flex flex-wrap gap-2 p-2 bg-white dark:bg-gray-700 rounded-md border border-gray-200 dark:border-gray-600">
                {associatedLabels.map(label => (
                    <span key={label} className="flex items-center gap-1.5 px-2 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 rounded-full text-sm font-medium">
                        {label}
                      <button onClick={() => handleRemoveAILabel(label)} className="p-0.5 rounded-full hover:bg-blue-200 dark:hover:bg-blue-800">
                            <X className="w-3 h-3" />
                        </button>
                    </span>
                ))}
              </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            {editingLabel && (
                <button onClick={handleCancel} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 font-semibold rounded-md hover:bg-gray-300 dark:hover:bg-gray-500 transition">
                  Cancel
                </button>
            )}
            <button onClick={handleSave} className="flex items-center gap-2 px-4 py-2 bg-primary text-white font-semibold rounded-md hover:bg-primary-dark transition">
              {editingLabel ? <Save className="w-5 h-5"/> : <PlusCircle className="w-5 h-5"/>}
              {editingLabel ? 'Enregistrer' : 'Créer le libellé'}
            </button>
          </div>
        </div>

        {/* List of existing labels */}
        <div className="space-y-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-bold">Libellés existants</h3>
          {(profile.customLabels ?? []).length === 0 ? (
              <p className="text-gray-500 text-sm">Aucun libellé personnalisé pour l'instant.</p>
          ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                {(profile.customLabels ?? []).map(label => (
                    <div key={label.id} className="p-3 bg-gray-100 dark:bg-gray-700/50 rounded-lg">
                      <div className="flex items-center justify-between">
                        <h5 className="font-bold text-primary dark:text-primary-light flex items-center gap-2">
                          <Tag className="w-4 h-4"/>
                          {label.name}
                        </h5>
                        <div className="flex items-center gap-2">
                          <button onClick={() => setEditingLabel(label)} title="Edit Label" className="p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                            <Edit className="w-4 h-4 text-gray-600 dark:text-gray-300"/>
                          </button>
                          <button onClick={() => handleDelete(label.id)} title="Delete Label" className="p-1.5 rounded-full hover:bg-red-200 dark:hover:bg-red-800/50 transition-colors">
                            <Trash2 className="w-4 h-4 text-red-600"/>
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {label.labels.map(aiLabel => (
                            <span key={aiLabel} className="px-2 py-0.5 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-md text-xs">
                                        {aiLabel}
                                    </span>
                        ))}
                      </div>
                    </div>
                ))}
              </div>
          )}
        </div>
      </div>
  );
};
