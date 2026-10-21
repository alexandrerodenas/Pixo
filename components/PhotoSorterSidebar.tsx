
import React, { useMemo } from 'react';
import type { UserProfile, ModelsLoadState } from '../services/types.ts';
import {
  FolderOpen,
  Trash2,
  Filter,
  Search,
  Zap,
  Settings2,
  CheckSquare,
  XSquare,
  Eye,
  EyeOff,
  Wand2,
  PlusCircle,
  Heart,
  Save,
  ChevronLeft,
  Copy,
  AlertTriangle
} from 'lucide-react';
import { Spinner } from './ui.tsx';
import AutocompleteInput from './AutocompleteInput.tsx';
import ModelLoadingIndicator from "./ModelLoadingIndicator.tsx";
import { isPhoneLibrary } from '../services/phoneLibrary.ts';
import { t } from '../services/i18n.ts';

interface PhotoSorterSidebarProps {
  userProfile: UserProfile;
  onOpenProfileSettings: () => void;
  onLoadPhotos: () => void;
  isLoading: boolean;
  isApiSupported: boolean;
  filterLabel: string;
  onFilterChange: (value: string) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onApplyRules: () => void;
  onDeleteSelected: () => void;
  selectedPhotoCount: number;
  totalPhotoCount: number;
  statusMessage: string;
  noAnalyzedPhotos: boolean;
  tfBackend: string | null;
  isolateSelection: boolean;
  onToggleIsolateSelection: () => void;
  allAvailableLabels: string[];
  modelsLoadState: ModelsLoadState;
  onCreateRuleFromSelection: () => void;
  onCreateRuleFromFilter: (label: string) => void;
  savedPhotoCount: number;
  isolateSaved: boolean;
  onToggleIsolateSaved: () => void;
  onMoveSavedPhotos: () => void;
  isOpen: boolean;
  onToggle: () => void;
  processingQueueCount: number;
  onFindDuplicates: () => void;
  isolateDuplicates: boolean;
  onToggleIsolateDuplicates: () => void;
  isolateBlurry: boolean;
  onToggleIsolateBlurry: () => void;
  blurryPhotoCount: number;
}

const PhotoSorterSidebar: React.FC<PhotoSorterSidebarProps> = ({
                                                                 userProfile,
                                                                 onOpenProfileSettings,
                                                                 onLoadPhotos,
                                                                 isLoading,
                                                                 isApiSupported,
                                                                 filterLabel,
                                                                 onFilterChange,
                                                                 onSelectAll,
                                                                 onClearSelection,
                                                                 onApplyRules,
                                                                 onDeleteSelected,
                                                                 selectedPhotoCount,
                                                                 totalPhotoCount,
                                                                 statusMessage,
                                                                 noAnalyzedPhotos,
                                                                 tfBackend,
                                                                 isolateSelection,
                                                                 onToggleIsolateSelection,
                                                                 allAvailableLabels,
                                                                 modelsLoadState,
                                                                 onCreateRuleFromSelection,
                                                                 onCreateRuleFromFilter,
                                                                 savedPhotoCount,
                                                                 isolateSaved,
                                                                 onToggleIsolateSaved,
                                                                 onMoveSavedPhotos,
                                                                 isOpen,
                                                                 onToggle,
                                                                 processingQueueCount,
                                                                 onFindDuplicates,
                                                                 isolateDuplicates,
                                                                 onToggleIsolateDuplicates,
                                                                 isolateBlurry,
                                                                 onToggleIsolateBlurry,
                                                                 blurryPhotoCount
                                                               }) => {

  const existingRuleLabels = useMemo(() => new Set([
    ...userProfile.classificationRules.map(r => r.label.toLowerCase()),
    ...userProfile.detectionRules.map(r => r.label.toLowerCase()),
  ]), [userProfile.classificationRules, userProfile.detectionRules]);

  const trimmedFilterLabel = filterLabel.trim();
  const showCreateRuleButton = trimmedFilterLabel && !existingRuleLabels.has(trimmedFilterLabel.toLowerCase());

  const ActionButton = ({ onClick, disabled, title, openTitle, icon, children, className = '' } : { onClick: () => void, disabled: boolean, title: string, openTitle?: string, icon: React.ReactNode, children: React.ReactNode, className?: string }) => (
      <button
          onClick={onClick}
          disabled={disabled}
          className={`w-full flex items-center gap-3 p-2 font-semibold rounded-md transition-colors disabled:bg-gray-400/30 disabled:text-gray-500 disabled:cursor-not-allowed ${className} ${isOpen ? 'justify-start px-3' : 'justify-center'}`}
          title={isOpen ? openTitle || title : title}
      >
        <span className="shrink-0">{icon}</span>
        <span className={`whitespace-nowrap transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0 w-0'}`}>{children}</span>
      </button>
  );


  return (
      <aside className={`fixed inset-y-0 left-0 z-40 w-80 bg-white dark:bg-gray-800 flex flex-col shadow-lg transform transition-all duration-300 ease-in-out lg:relative lg:translate-x-0 ${isOpen ? 'translate-x-0 lg:w-80' : '-translate-x-full lg:w-20'}`}>
        <div className="flex-1 flex flex-col p-4 overflow-y-auto">
          {/* Header */}
          <div className={`hidden lg:flex items-center gap-3 mb-6 transition-all duration-300 ${isOpen ? 'justify-start' : 'justify-center'}`}>
            <img src="/logo.png" alt="Pixo Logo" className="w-10 h-10 shrink-0" />
            <h1 className={`text-2xl font-bold tracking-tight whitespace-nowrap overflow-hidden transition-opacity ${isOpen ? 'opacity-100' : 'opacity-0'}`}>Pixo</h1>
          </div>

          {/* Profile */}
          <div
              role="button"
              tabIndex={0}
              aria-label="Open profile settings"
              onClick={onOpenProfileSettings}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onOpenProfileSettings()}
              className={`flex items-center gap-3 mb-8 p-3 bg-gray-100 dark:bg-gray-700/60 rounded-lg cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600/80 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${isOpen ? 'justify-between' : 'lg:justify-center'}`}
              title={isOpen ? '' : 'Profile Settings'}
          >
            <div className={`flex items-center gap-3 overflow-hidden`}>
              <div className="w-10 h-10 bg-primary text-white flex items-center justify-center rounded-full font-bold text-lg shrink-0">
                {userProfile.firstName.charAt(0).toUpperCase()}
              </div>
              <div className={`overflow-hidden whitespace-nowrap transition-opacity ${isOpen ? 'opacity-100' : 'opacity-0 w-0'}`}>
                <p className="font-semibold text-gray-800 dark:text-gray-100 truncate" title={userProfile.firstName}>{userProfile.firstName}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">View settings</p>
              </div>
            </div>
            <Settings2 className={`w-5 h-5 text-gray-500 dark:text-gray-400 shrink-0 transition-opacity ${isOpen ? 'opacity-100' : 'opacity-0'}`} />
          </div>

          {/* Directory Loader */}
          <div className="mb-6">
            <label className={`font-semibold mb-2 flex items-center gap-2 transition-all ${isOpen ? '' : 'lg:justify-center'}`}><FolderOpen className="w-5 h-5 text-secondary shrink-0" /> <span className={`transition-opacity ${isOpen ? 'opacity-100' : 'opacity-0 lg:hidden'}`}>Load Photos</span></label>
            <div className="flex gap-2">
              <button
                  onClick={onLoadPhotos}
                  disabled={isLoading || !isApiSupported}
                  className={`w-full px-4 py-2 bg-primary text-white font-semibold rounded-md hover:bg-primary-dark transition disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2 ${isOpen ? 'justify-center' : 'lg:justify-center'}`}
                  title={!isApiSupported ? "Your browser is not supported for this feature." : isPhoneLibrary() ? "Load every photo on this phone" : "Select a directory to load photos"}
              >
                {isLoading ? <Spinner className="w-5 h-5"/> : (isOpen ? (isPhoneLibrary() ? t('button.scanPhone') : t('button.selectDirectory')) : <FolderOpen className="w-5 h-5"/>)}
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className={`mb-6 transition-all ${isOpen ? '' : 'lg:px-0'}`}>
            <label className={`font-semibold mb-2 flex items-center gap-2 ${isOpen ? '' : 'lg:justify-center'}`}><Filter className="w-5 h-5 text-secondary shrink-0" /> <span className={`transition-opacity ${isOpen ? 'opacity-100' : 'opacity-0 lg:hidden'}`}>Filter by Label</span></label>
            <div className={`${isOpen ? '' : 'lg:hidden'}`}>
              <AutocompleteInput
                  icon={<Search />}
                  placeholder="e.g., cat, dog, car..."
                  value={filterLabel}
                  onChange={onFilterChange}
                  suggestions={allAvailableLabels}
              />
              {showCreateRuleButton && (
                  <button
                      onClick={() => onCreateRuleFromFilter(filterLabel)}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 mt-2 text-sm bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-semibold rounded-md hover:bg-blue-200 dark:hover:bg-blue-900/60 transition"
                      title={`Create new rules for "${trimmedFilterLabel}"`}
                  >
                    <PlusCircle className="w-4 h-4 shrink-0" />
                    <span className="truncate">Create Rule for "{trimmedFilterLabel}"</span>
                  </button>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <ActionButton onClick={onClearSelection} disabled={selectedPhotoCount === 0} title="Clear All" className="bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-sm" icon={<XSquare className="w-5 h-5" />}>Clear All</ActionButton>
              <ActionButton onClick={onSelectAll} disabled={isLoading || noAnalyzedPhotos} title="Select All" openTitle={noAnalyzedPhotos && !isLoading ? "No analyzed photos to select" : "Select all analyzed photos"} className="bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-sm" icon={<CheckSquare className="w-5 h-5" />}>Select All</ActionButton>
            </div>
            <ActionButton onClick={onApplyRules} disabled={isLoading || noAnalyzedPhotos} title="Apply Manual Rules" openTitle={noAnalyzedPhotos && !isLoading ? "No analyzed photos to apply rules to" : "Apply custom rules to all analyzed photos"} className="bg-secondary text-white hover:bg-secondary-dark" icon={<Zap className="w-5 h-5"/>}>Apply Rules</ActionButton>
            <ActionButton onClick={onCreateRuleFromSelection} disabled={selectedPhotoCount === 0} title="Create Rule from Selection" openTitle={selectedPhotoCount > 0 ? "Create new rules from selected photos" : "Select photos to create rules from"} className="bg-accent text-white hover:bg-accent-dark" icon={<Wand2 className="w-5 h-5"/>}>Create Rule</ActionButton>

            {/* Deduplication & Blur Actions */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-2 space-y-2">
              <ActionButton onClick={onFindDuplicates} disabled={isLoading || noAnalyzedPhotos} title="Find Duplicates" className="bg-purple-600 text-white hover:bg-purple-700" icon={<Copy className="w-5 h-5"/>}>Find Duplicates</ActionButton>
              {isolateDuplicates ? (
                  <ActionButton onClick={onToggleIsolateDuplicates} disabled={false} title="Show All Photos" className="bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-900/50 dark:text-purple-300" icon={<Eye className="w-5 h-5"/>}>Show All</ActionButton>
              ) : null}

              <ActionButton onClick={onToggleIsolateBlurry} disabled={blurryPhotoCount === 0 && !isolateBlurry} title={isolateBlurry ? "Show all photos" : `Isolate Blurry (${blurryPhotoCount})`} className="bg-orange-500 text-white hover:bg-orange-600" icon={<AlertTriangle className="w-5 h-5"/>}>{isolateBlurry ? "Show All" : `Blurry (${blurryPhotoCount})`}</ActionButton>
            </div>

            <ActionButton onClick={onToggleIsolateSelection} disabled={selectedPhotoCount === 0 && !isolateSelection} title={isolateSelection ? "Show all photos" : "Isolate Selection"} className="bg-blue-500 text-white hover:bg-blue-600" icon={isolateSelection ? <Eye className="w-5 h-5"/> : <EyeOff className="w-5 h-5"/>}>{isolateSelection ? "Show All" : "Isolate"}</ActionButton>
            <ActionButton onClick={onToggleIsolateSaved} disabled={savedPhotoCount === 0 && !isolateSaved} title={isolateSaved ? "Show all photos" : `Isolate Saved (${savedPhotoCount})`} className="bg-pink-500 text-white hover:bg-pink-600" icon={<Heart className="w-5 h-5 fill-current"/>}>{isolateSaved ? "Show All" : `Isolate (${savedPhotoCount})`}</ActionButton>
            <ActionButton onClick={() => onMoveSavedPhotos()} disabled={savedPhotoCount === 0} title={`Move Saved (${savedPhotoCount})`} className="bg-green-600 text-white hover:bg-green-700" icon={<Save className="w-5 h-5"/>}>{`Move (${savedPhotoCount})`}</ActionButton>
            <ActionButton onClick={onDeleteSelected} disabled={selectedPhotoCount === 0} title={`Delete Selected (${selectedPhotoCount})`} className="bg-red-600 text-white hover:bg-red-700" icon={<Trash2 className="w-5 h-5"/>}>{`Delete (${selectedPhotoCount})`}</ActionButton>
          </div>
        </div>

        {/* Counters & Status */}
        <div className="mt-auto p-4 border-t border-gray-200 dark:border-gray-700 shrink-0">
          <div className={isOpen ? 'opacity-100 transition-opacity' : 'opacity-0 lg:hidden'}>
            <div className="flex justify-between items-center text-sm font-medium mb-2">
              <span>Total Photos</span>
              <span className="px-2 py-0.5 bg-primary/20 text-primary rounded-full">{totalPhotoCount}</span>
            </div>
            <div className="flex justify-between items-center text-sm font-medium mb-2">
              <span>Selected</span>
              <span className="px-2 py-0.5 bg-accent/20 text-accent rounded-full">{selectedPhotoCount}</span>
            </div>
            <div className="flex justify-between items-center text-sm font-medium">
              <span>Saved</span>
              <span className="px-2 py-0.5 bg-pink-500/20 text-pink-500 rounded-full">{savedPhotoCount}</span>
            </div>

            {processingQueueCount > 0 && (
                <div className="flex justify-between items-center text-sm font-medium mt-2">
                  <span>Processing</span>
                  <span className="px-2 py-0.5 bg-blue-500/20 text-blue-500 rounded-full flex items-center gap-1.5">
                        <Spinner className="w-3 h-3 text-blue-500" />
                    {processingQueueCount}
                    </span>
                </div>
            )}

            <ModelLoadingIndicator status={modelsLoadState} />

            <div className="mt-4 text-xs text-gray-500 dark:text-gray-400 p-2 bg-gray-100 dark:bg-gray-700/50 rounded-md text-center space-y-1">
              <p>{statusMessage}</p>
              {tfBackend && (
                  <p className="font-mono text-gray-400 dark:text-gray-500 text-[10px] tracking-wider pt-1 border-t border-gray-200 dark:border-gray-600/50 mt-1">
                    AI Backend: {tfBackend}
                  </p>
              )}
            </div>
          </div>
          <button
              onClick={onToggle}
              className="hidden lg:flex items-center w-full mt-4 p-2 font-semibold rounded-md transition-colors bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600"
              title={isOpen ? "Collapse menu" : "Expand menu"}
          >
            <div className={`flex items-center gap-3 ${isOpen ? 'justify-start' : 'justify-center' } w-full`}>
              <ChevronLeft className={`w-5 h-5 transition-transform shrink-0 ${isOpen ? '' : 'rotate-180'}`} />
              <span className={`whitespace-nowrap transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0 w-0'}`}>Collapse</span>
            </div>
          </button>
        </div>
      </aside>
  );
};

export default PhotoSorterSidebar;
