
import React, { useState, useRef } from 'react';
import type { UserProfile } from '../services/types.ts';
import { ProfileEditor } from './ProfileEditor.tsx';
import { RulesManager } from './RulesManager.tsx';
import { CustomLabelsManager } from './CustomLabelsManager.tsx';
import { parseImportedProfile } from '../services/profileImport.ts';
import { User, X, Wand2, Settings, Save, Upload, Download, Tags } from 'lucide-react';
import { t } from '../services/i18n.ts';

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
      alert(t('prof.exportError'));
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
          throw new Error(t('prof.readFail'));
        }
        const importedProfile = parseImportedProfile(JSON.parse(text));
        if (!importedProfile) {
          throw new Error(t('prof.badFormat'));
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
        alert(t('prof.imported'));
      } catch (error) {
        console.error("Failed to import profile:", error);
        alert(t('prof.importError'));
      }
    };
    reader.onerror = () => {
      alert(t('prof.readError'));
    };
    reader.readAsText(file);

    if(event.target) event.target.value = '';
  };

  if (!isOpen) return null;

  const TabButton = ({ isActive, onClick, children, icon }: {isActive: boolean, onClick: () => void, children: React.ReactNode, icon: React.ReactNode}) => (
      <button
          onClick={onClick}
          className={`flex flex-1 sm:flex-none items-center justify-center gap-1.5 sm:gap-2 px-2 sm:px-4 py-3 sm:py-2 text-sm font-semibold rounded-t-md transition-colors border-b-2 whitespace-nowrap ${
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
      <div className="fixed inset-0 bg-black/70 z-50 flex items-stretch sm:items-center justify-center sm:p-4" onClick={onClose}>
        <div className="bg-white dark:bg-gray-800 sm:rounded-lg shadow-2xl w-full sm:max-w-2xl h-[100dvh] sm:h-auto sm:max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
          <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".json"
              className="hidden"
          />
          <div className="px-4 sm:px-6 py-3 sm:py-6 pt-[max(0.75rem,env(safe-area-inset-top))] border-b border-gray-200 dark:border-gray-700 flex justify-between items-center flex-shrink-0">
            <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2"><User className="text-primary"/> {t('prof.title')}</h2>
            <button onClick={onClose} aria-label={t('prof.close')} className="p-2 -mr-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600"><X className="w-5 h-5"/></button>
          </div>
          <div className="border-b border-gray-200 dark:border-gray-700 px-2 sm:px-6 bg-gray-50 dark:bg-gray-800/50 flex-shrink-0">
            <nav className="flex -mb-px">
              <TabButton isActive={activeTab === 'profile'} onClick={() => setActiveTab('profile')} icon={<Settings className="w-4 h-4"/>}>
                {t('prof.tabGeneral')}
              </TabButton>
              <TabButton isActive={activeTab === 'rules'} onClick={() => setActiveTab('rules')} icon={<Wand2 className="w-4 h-4" />}>
                {t('prof.tabRules')}
              </TabButton>
              <TabButton isActive={activeTab === 'labels'} onClick={() => setActiveTab('labels')} icon={<Tags className="w-4 h-4" />}>
                {t('prof.tabLabels')}
              </TabButton>
            </nav>
          </div>
          <div className="p-4 sm:p-6 overflow-y-auto flex-1 min-h-0">
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
          <div className="flex items-center gap-2 sm:gap-3 p-3 sm:p-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex-shrink-0">
            <button onClick={handleImportClick} aria-label={t('prof.importLabel')} title={t('prof.importLabel')} className="flex items-center justify-center gap-2 p-2.5 sm:px-3 sm:py-2 text-sm bg-gray-200 dark:bg-gray-700 font-semibold rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition">
              <Upload className="w-5 h-5 sm:w-4 sm:h-4"/> <span className="hidden sm:inline">{t('prof.import')}</span>
            </button>
            <button onClick={handleExportProfile} aria-label={t('prof.exportLabel')} title={t('prof.exportLabel')} className="flex items-center justify-center gap-2 p-2.5 sm:px-3 sm:py-2 text-sm bg-gray-200 dark:bg-gray-700 font-semibold rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition">
              <Download className="w-5 h-5 sm:w-4 sm:h-4"/> <span className="hidden sm:inline">{t('prof.export')}</span>
            </button>
            <div className="flex-1 sm:flex-none sm:ml-auto flex justify-end gap-3">
              <button onClick={onClose} className="hidden sm:block px-4 py-2 bg-gray-200 dark:bg-gray-600 font-semibold rounded-md hover:bg-gray-300 dark:hover:bg-gray-500 transition">{t('prof.cancel')}</button>
              <button onClick={handleSave} className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 sm:py-2 bg-primary text-white font-semibold rounded-md hover:bg-primary-dark transition">
                <Save className="w-5 h-5"/> {t('prof.save')}
              </button>
            </div>
          </div>
        </div>
      </div>
  );
};

export default ProfileSettingsModal;