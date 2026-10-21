
import React, { useState, useRef } from 'react';
import type { UserProfile } from '../services/types.ts';
import { ProfileEditor } from './ProfileEditor.tsx';
import { RulesManager } from './RulesManager.tsx';
import { CustomLabelsManager } from './CustomLabelsManager.tsx';
import { parseImportedProfile } from '../services/profileImport.ts';
import { User, X, Wand2, Settings, Save, Upload, Download, Tags } from 'lucide-react';

interface ProfileSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: UserProfile;
  onSave: (newProfile: UserProfile) => void;
  allAvailableClassificationLabels: string[];
  allAvailableDetectionLabels: string[];
  allAvailableLabels: string[];
}

const ProfileSettingsModal: React.FC<ProfileSettingsModalProps> = ({ isOpen, onClose, userProfile, onSave, allAvailableClassificationLabels, allAvailableDetectionLabels, allAvailableLabels }) => {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState<'profile' | 'rules' | 'labels'>('profile');
  const [editedProfile, setEditedProfile] = useState<UserProfile>(() => ({
    ...userProfile,
    classificationRules: userProfile.classificationRules || [],
    detectionRules: userProfile.detectionRules || [],
    customLabels: userProfile.customLabels || [],
    unknownThreshold: userProfile.unknownThreshold ?? 10,
    thumbnailSize: userProfile.thumbnailSize ?? 'M',
    savedFolderName: userProfile.savedFolderName || 'saves',
    savedOperation: userProfile.savedOperation || 'move',
  }));
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSave = () => {
    onSave(editedProfile);
    onClose();
  };

  const handleExportProfile = () => {
    try {
      const profileJson = JSON.stringify(editedProfile, null, 2);
      const blob = new Blob([profileJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pixo_profile_${editedProfile.firstName.toLowerCase().replace(/\s/g, '_')}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to export profile:", error);
      alert("Une erreur est survenue pendant l'export du profil.");
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result;
        if (typeof text !== 'string') {
          throw new Error("Impossible de lire le contenu du fichier.");
        }
        const importedProfile = parseImportedProfile(JSON.parse(text));
        if (!importedProfile) {
          throw new Error("Format de fichier de profil invalide.");
        }

        const newProfileState: UserProfile = {
          ...userProfile,
          ...importedProfile,
          unknownThreshold: importedProfile.unknownThreshold ?? 10,
          thumbnailSize: importedProfile.thumbnailSize ?? 'M',
          savedFolderName: importedProfile.savedFolderName || 'saves',
          savedOperation: importedProfile.savedOperation || 'move',
        };
        setEditedProfile(newProfileState);
        alert("Profil importé ! Vérifie les changements puis clique sur « Enregistrer » pour les appliquer.");
      } catch (error) {
        console.error("Failed to import profile:", error);
        alert("Impossible d'importer le profil. Vérifie que c'est un fichier JSON exporté depuis Pixo.");
      }
    };
    reader.onerror = () => {
      alert("Erreur de lecture du fichier.");
    };
    reader.readAsText(file);

    if(event.target) event.target.value = '';
  };

  const TabButton = ({ isActive, onClick, children, icon }: {isActive: boolean, onClick: () => void, children: React.ReactNode, icon: React.ReactNode}) => (
      <button
          onClick={onClick}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-t-md transition-colors border-b-2 ${
              isActive
                  ? 'border-primary text-primary bg-white dark:bg-gray-800'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
      >
        {icon}
        {children}
      </button>
  );


  return (
      <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center" onClick={onClose}>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
          <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".json"
              className="hidden"
          />
          <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center flex-shrink-0">
            <h2 className="text-2xl font-bold flex items-center gap-2"><User className="text-primary"/> Profil et règles</h2>
            <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600"><X className="w-5 h-5"/></button>
          </div>
          <div className="border-b border-gray-200 dark:border-gray-700 px-6 bg-gray-50 dark:bg-gray-800/50 flex-shrink-0">
            <nav className="flex -mb-px">
              <TabButton isActive={activeTab === 'profile'} onClick={() => setActiveTab('profile')} icon={<Settings className="w-4 h-4"/>}>
                General Settings
              </TabButton>
              <TabButton isActive={activeTab === 'rules'} onClick={() => setActiveTab('rules')} icon={<Wand2 className="w-4 h-4" />}>
                AI Rules
              </TabButton>
              <TabButton isActive={activeTab === 'labels'} onClick={() => setActiveTab('labels')} icon={<Tags className="w-4 h-4" />}>
                Custom Labels
              </TabButton>
            </nav>
          </div>
          <div className="p-6 overflow-y-auto">
            {activeTab === 'profile' && (
                <ProfileEditor profile={editedProfile} setProfile={setEditedProfile} />
            )}
            {activeTab === 'rules' && (
                <RulesManager profile={editedProfile} setProfile={setEditedProfile} allAvailableClassificationLabels={allAvailableClassificationLabels} allAvailableDetectionLabels={allAvailableDetectionLabels} />
            )}
            {activeTab === 'labels' && (
                <CustomLabelsManager profile={editedProfile} setProfile={setEditedProfile} allAvailableLabels={allAvailableLabels} />
            )}
          </div>
          <div className="flex justify-between items-center gap-3 p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex-shrink-0">
            <div className="flex gap-2">
              <button onClick={handleImportClick} className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-200 dark:bg-gray-700 font-semibold rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition">
                <Upload className="w-4 h-4"/> Import
              </button>
              <button onClick={handleExportProfile} className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-200 dark:bg-gray-700 font-semibold rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition">
                <Download className="w-4 h-4"/> Export
              </button>
            </div>
            <div className="flex gap-3">
              <button onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 font-semibold rounded-md hover:bg-gray-300 dark:hover:bg-gray-500 transition">Cancel</button>
              <button onClick={handleSave} className="flex items-center gap-2 px-4 py-2 bg-primary text-white font-semibold rounded-md hover:bg-primary-dark transition">
                <Save className="w-5 h-5"/> Save Changes
              </button>
            </div>
          </div>
        </div>
      </div>
  );
};

export default ProfileSettingsModal;