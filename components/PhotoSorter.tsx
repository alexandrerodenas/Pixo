
import * as React from 'react';
import type { UserProfile, Photo } from '../services/types.ts';
import { PhotoStatus } from '../services/types.ts';
import { usePhotoManager } from '../hooks/usePhotoManager.ts';
import * as phone from '../services/phoneLibrary.ts';

import ControlBar from './ControlBar.tsx'; // Replaces Sidebar
import FloatingHUD from './FloatingHUD.tsx'; // New Stats/Status Widget
import PhotoContent from './PhotoContent.tsx';
import PhotoViewerModal from './PhotoViewerModal.tsx';
import ProfileSettingsModal from './ProfileSettingsModal.tsx';
import ConfirmDeleteModal from './ConfirmDeleteModal.tsx';
import DataWarningModal from './DataWarningModal.tsx';
import { t } from '../services/i18n.ts';

interface PhotoSorterProps {
  userProfile: UserProfile;
  onProfileUpdate: (newProfile: UserProfile) => void;
}

const PhotoSorter: React.FC<PhotoSorterProps> = ({ userProfile, onProfileUpdate }) => {
  const [filterLabel, setFilterLabel] = React.useState<string>('');
  const [isProfileModalOpen, setProfileModalOpen] = React.useState<boolean>(false);
  const [viewingPhoto, setViewingPhoto] = React.useState<Photo | null>(null);

  // Android: Open with Pixo asks to show one photo; it is shown as soon as it is in the library
  const [viewRequestId, setViewRequestId] = React.useState<string | null>(null);
  React.useEffect(() => phone.onViewRequest(setViewRequestId), []);

  // Lifted ViewMode state so ControlBar can manage it
  // "Show everything" at opening, and the notice shown when the rules select nothing
  const [showPrevious, setShowPrevious] = React.useState(false);
  const [noRuleMatchOpen, setNoRuleMatchOpen] = React.useState(false);

  const [viewMode, setViewMode] = React.useState<'grid' | 'folder' | 'zen'>('grid');

  const {
    photos,
    statusMessage,
    isLoading,
    isApiSupported,
    handleLoadPhotos,
    handleSelectPhoto,
    selectedPhotos,
    handleRequestDelete,
    handleApplyRulesManually,
    handleReanalyze,
    handleAnalyzeNew,
    handleSelectAll,
    handleClearSelection,
    isolateSelection,
    handleToggleIsolateSelection,
    tfBackend,
    allAvailableLabels,
    allAvailableClassificationLabels,
    allAvailableDetectionLabels,
    modelsLoadState,
    handleCreateRuleFromSelection,
    handleCreateRuleFromFilter,
    savedPhotos,
    handleToggleSavePhoto,
    isolateSaved,
    handleToggleIsolateSaved,
    handleMoveSavedPhotos,
    confirmDeleteState,
    handleConfirmDelete,
    handleConfirmDeleteKeepSaved,
    handleCancelDelete,
    processingQueueCount,
    handleBulkSave,
    handleFindDuplicates,
    isolateDuplicates,
    handleToggleIsolateDuplicates,
    isolateBlurry,
    handleToggleIsolateBlurry,
    blurryPhotoCount
  } = usePhotoManager({ userProfile, onProfileUpdate, filterLabel });


  React.useEffect(() => {
    if (!viewRequestId) return;
    const photo = photos.get(viewRequestId);
    if (!photo) return;
    setViewingPhoto(photo);
    setViewRequestId(null);
    phone.clearViewRequest();
  }, [viewRequestId, photos]);

  const handleApplyRules = () => {
    const selected = handleApplyRulesManually();
    if (selected > 0) setFilterLabel('');
    else if (selected === 0) setNoRuleMatchOpen(true);
  };

  const noAnalyzedPhotos = React.useMemo(() =>
          Array.from(photos.values()).every(p => p.status !== PhotoStatus.ANALYZED),
      [photos]);

  return (
      <div className="relative h-screen flex flex-col overflow-hidden bg-gray-100 dark:bg-gray-900">
        {!isApiSupported && (
            <div className="bg-red-500 text-white text-sm font-medium px-4 py-2 text-center w-full shadow-md z-50">
              {t('sorter.noApi')}
            </div>
        )}

        {/* Top Control Bar */}
        <ControlBar
            userProfile={userProfile}
            onOpenProfileSettings={() => setProfileModalOpen(true)}
            onLoadPhotos={handleLoadPhotos}
            isLoading={isLoading}
            isApiSupported={isApiSupported}
            filterLabel={filterLabel}
            onFilterChange={setFilterLabel}
            onSelectAll={handleSelectAll}
            onClearSelection={handleClearSelection}
            onApplyRules={handleApplyRules}
            onReanalyze={handleReanalyze}
            onDeleteSelected={() => handleRequestDelete()}
            selectedPhotoCount={selectedPhotos.length}
            noAnalyzedPhotos={noAnalyzedPhotos}
            isolateSelection={isolateSelection}
            onToggleIsolateSelection={handleToggleIsolateSelection}
            allAvailableLabels={allAvailableLabels}
            onCreateRuleFromSelection={handleCreateRuleFromSelection}
            onCreateRuleFromFilter={handleCreateRuleFromFilter}
            savedPhotoCount={savedPhotos.length}
            isolateSaved={isolateSaved}
            onToggleIsolateSaved={handleToggleIsolateSaved}
            onMoveSavedPhotos={handleMoveSavedPhotos}
            onFindDuplicates={handleFindDuplicates}
            isolateDuplicates={isolateDuplicates}
            onToggleIsolateDuplicates={handleToggleIsolateDuplicates}
            isolateBlurry={isolateBlurry}
            onToggleIsolateBlurry={handleToggleIsolateBlurry}
            blurryPhotoCount={blurryPhotoCount}
            viewMode={viewMode}
            setViewMode={setViewMode}
        />

        {/* Main Content Area */}
        <PhotoContent
            photos={photos}
            isLoading={isLoading}
            filterLabel={filterLabel}
            onFilterChange={setFilterLabel}
            onSelectPhoto={handleSelectPhoto}
            onViewPhoto={setViewingPhoto}
            isolateSelection={isolateSelection}
            isolateSaved={isolateSaved}
            isolateDuplicates={isolateDuplicates}
            isolateBlurry={isolateBlurry}
            thumbnailSize={userProfile.thumbnailSize ?? 'M'}
            onToggleSavePhoto={handleToggleSavePhoto}
            onRequestDelete={handleRequestDelete}
            onBulkSave={handleBulkSave}
            onMoveSavedPhotos={handleMoveSavedPhotos}
            viewMode={viewMode}
            setViewMode={setViewMode}
            savedFolderName={userProfile.savedFolderName || 'saves'}
            newPhotosOnly={userProfile.startupView !== 'all'}
            showPrevious={showPrevious}
            onShowPrevious={() => setShowPrevious(true)}
            onAnalyzeNew={handleAnalyzeNew}
        />

        {/* Floating HUD (Stats & Status) */}
        {photos.size > 0 && (
            <FloatingHUD
                totalCount={photos.size}
                selectedCount={selectedPhotos.length}
                savedCount={savedPhotos.length}
                statusMessage={statusMessage}
                modelsLoadState={modelsLoadState}
                tfBackend={tfBackend}
                processingQueueCount={processingQueueCount}
            />
        )}

        <PhotoViewerModal
            photo={viewingPhoto ? photos.get(viewingPhoto.id) ?? viewingPhoto : null}
            onClose={() => setViewingPhoto(null)}
        />

        {noRuleMatchOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setNoRuleMatchOpen(false)}>
              <div className="w-full max-w-sm rounded-xl bg-white dark:bg-gray-800 p-5 shadow-xl" onClick={e => e.stopPropagation()}>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('rules.none.title')}</h2>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{t('rules.none.body')}</p>
                <div className="mt-4 flex justify-end gap-2">
                  <button onClick={() => setNoRuleMatchOpen(false)} className="px-3 py-2 rounded-lg text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">{t('rules.none.close')}</button>
                  <button
                      onClick={() => { setFilterLabel(''); setShowPrevious(true); setNoRuleMatchOpen(false); }}
                      className="px-3 py-2 rounded-lg text-sm font-semibold bg-gray-900 dark:bg-white text-white dark:text-gray-900"
                  >
                    {t('rules.none.showAll')}
                  </button>
                </div>
              </div>
            </div>
        )}

        <DataWarningModal />
        <ConfirmDeleteModal
            isOpen={confirmDeleteState.isOpen}
            onClose={handleCancelDelete}
            onConfirm={handleConfirmDelete}
            onConfirmKeepSaved={handleConfirmDeleteKeepSaved}
            deleteCount={confirmDeleteState.photosToDelete.length}
            savedCount={confirmDeleteState.photosToDelete.filter(p => p.isSaved).length}
        />

        <ProfileSettingsModal
            isOpen={isProfileModalOpen}
            onClose={() => setProfileModalOpen(false)}
            userProfile={userProfile}
            onSave={onProfileUpdate}
            allAvailableClassificationLabels={allAvailableClassificationLabels}
            allAvailableDetectionLabels={allAvailableDetectionLabels}
            allAvailableLabels={allAvailableLabels}
        />
      </div>
  );
};

export default PhotoSorter;
