
import React, { useState, useEffect, useCallback } from 'react';
import type { UserProfile } from './services/types.ts';
import PhotoSorter from './components/PhotoSorter.tsx';
import Onboarding from './components/Onboarding.tsx';
import { storageService } from './services/storage.ts';
import WelcomeModal from './components/WelcomeModal.tsx';

const App: React.FC = () => {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isWelcomeModalOpen, setWelcomeModalOpen] = useState(false);

  useEffect(() => {
    let loadedProfile = storageService.loadUserProfile();

    // Handle migration from legacy profile structure for existing users
    if (loadedProfile) {
      if ((loadedProfile as any).rules && !loadedProfile.classificationRules) {
        loadedProfile.classificationRules = (loadedProfile as any).rules;
        delete (loadedProfile as any).rules;
      }
      if (!loadedProfile.detectionRules) {
        loadedProfile.detectionRules = [];
      }
      if (!loadedProfile.thumbnailSize) {
        loadedProfile.thumbnailSize = 'M';
      }
      if (!loadedProfile.savedFolderName) {
        loadedProfile.savedFolderName = 'saves';
      }
      if (!loadedProfile.savedOperation) {
        loadedProfile.savedOperation = 'move';
      }
      if (!loadedProfile.customLabels) {
        loadedProfile.customLabels = [];
      }
      // Initialize default blur thresholds if missing
      if (loadedProfile.blurThreshold === undefined) {
        loadedProfile.blurThreshold = 100;
      }
      if (loadedProfile.sharpThreshold === undefined) {
        loadedProfile.sharpThreshold = 300;
      }
    }

    setUserProfile(loadedProfile);
    setIsLoading(false);

    if (loadedProfile) {
      const welcomeDismissed = storageService.loadWelcomeDismissed();
      if (!welcomeDismissed) {
        setWelcomeModalOpen(true);
      }
    }

    // Set dark mode from system preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.documentElement.classList.add('dark');
    }
  }, []);

  const handleProfileUpdate = useCallback((profile: UserProfile) => {
    const isFirstTime = !userProfile;
    storageService.saveUserProfile(profile);
    setUserProfile(profile);

    if (isFirstTime) {
      setWelcomeModalOpen(true);
    }
  }, [userProfile]);

  const handleWelcomeModalClose = useCallback((dontShowAgain: boolean) => {
    setWelcomeModalOpen(false);
    if (dontShowAgain) {
      storageService.saveWelcomeDismissed(true);
    }
  }, []);

  if (isLoading) {
    return (
        <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-300">
          <p className="text-xl animate-pulse">Chargement de ton espace... ✨</p>
        </div>
    );
  }

  return (
      <div className="min-h-screen font-sans">
        {userProfile ? (
            <>
              <PhotoSorter userProfile={userProfile} onProfileUpdate={handleProfileUpdate} />
              <WelcomeModal isOpen={isWelcomeModalOpen} onClose={handleWelcomeModalClose} />
            </>
        ) : (
            <Onboarding onProfileSave={handleProfileUpdate} />
        )}
      </div>
  );
};

export default App;
