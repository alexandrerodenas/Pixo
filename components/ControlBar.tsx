
import React, { useState, useRef, useEffect } from 'react';
import type { UserProfile } from '../services/types.ts';
import {
  FolderOpen,
  Trash2,
  Search,
  Zap,
  CheckSquare,
  XSquare,
  Eye,
  EyeOff,
  Wand2,
  PlusCircle,
  Heart,
  Save,
  Copy,
  AlertTriangle,
  LayoutGrid,
  FolderTree,
  Sparkles,
  MoreHorizontal, Smartphone } from 'lucide-react';
import { Spinner } from './ui.tsx';
import AutocompleteInput from './AutocompleteInput.tsx';
import { isPhoneLibrary } from '../services/phoneLibrary.ts';

interface ControlBarProps {
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
  noAnalyzedPhotos: boolean;
  isolateSelection: boolean;
  onToggleIsolateSelection: () => void;
  allAvailableLabels: string[];
  onCreateRuleFromSelection: () => void;
  onCreateRuleFromFilter: (label: string) => void;
  savedPhotoCount: number;
  isolateSaved: boolean;
  onToggleIsolateSaved: () => void;
  onMoveSavedPhotos: () => void;
  onFindDuplicates: () => void;
  isolateDuplicates: boolean;
  onToggleIsolateDuplicates: () => void;
  isolateBlurry: boolean;
  onToggleIsolateBlurry: () => void;
  blurryPhotoCount: number;
  viewMode: 'grid' | 'folder' | 'zen';
  setViewMode: (mode: 'grid' | 'folder' | 'zen') => void;
}

const ControlBar: React.FC<ControlBarProps> = ({
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
                                                 noAnalyzedPhotos,
                                                 isolateSelection,
                                                 onToggleIsolateSelection,
                                                 allAvailableLabels,
                                                 onCreateRuleFromSelection,
                                                 onCreateRuleFromFilter,
                                                 savedPhotoCount,
                                                 isolateSaved,
                                                 onToggleIsolateSaved,
                                                 onMoveSavedPhotos,
                                                 onFindDuplicates,
                                                 isolateDuplicates,
                                                 onToggleIsolateDuplicates,
                                                 isolateBlurry,
                                                 onToggleIsolateBlurry,
                                                 blurryPhotoCount,
                                                 viewMode,
                                                 setViewMode
                                               }) => {

  const existingRuleLabels = new Set([
    ...userProfile.classificationRules.map(r => r.label.toLowerCase()),
    ...userProfile.detectionRules.map(r => r.label.toLowerCase()),
  ]);
  const trimmedFilterLabel = filterLabel.trim();
  const showCreateRuleButton = trimmedFilterLabel && !existingRuleLabels.has(trimmedFilterLabel.toLowerCase());

  // Mobile actions dropdown state
  const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target as Node)) {
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Helper for Icon Buttons
  const IconButton = ({ onClick, disabled, active, icon, title, className = '', activeClass = 'bg-primary text-white', inactiveClass = 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700' }: any) => (
      <button
          onClick={onClick}
          disabled={disabled}
          title={title}
          className={`p-2 rounded-md transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed ${active ? activeClass : inactiveClass} ${className}`}
      >
        {icon}
      </button>
  );

  const Divider = () => <div className="w-px h-8 bg-gray-300 dark:bg-gray-600 mx-1 flex-shrink-0"></div>;

  return (
      <header className="h-16 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-700 flex items-center gap-4 px-4 sticky top-0 z-30 shadow-sm">

        {/* Left: Brand & Load */}
        <div className="flex items-center gap-4 shrink-0">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="Pixo" className="w-8 h-8" />
            <span className="font-bold text-xl tracking-tight hidden md:block text-primary dark:text-primary-light">Pixo</span>
          </div>

          <button
              onClick={onLoadPhotos}
              disabled={isLoading || !isApiSupported}
              className="flex items-center gap-2 px-3 py-1.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 text-sm whitespace-nowrap"
          >
            {isLoading ? <Spinner className="w-4 h-4 text-current" /> : isPhoneLibrary() ? <Smartphone className="w-4 h-4" /> : <FolderOpen className="w-4 h-4" />}
            <span className="hidden sm:inline">{isPhoneLibrary() ? 'Scan Phone' : 'Open Folder'}</span>
          </button>
        </div>

        {/* Search - Extracted from scroll container to prevent clipping */}
        <div className="w-48 md:w-64 shrink-0 relative group z-50">
          <AutocompleteInput
              icon={<Search className="w-4 h-4" />}
              placeholder="Search labels..."
              value={filterLabel}
              onChange={onFilterChange}
              suggestions={allAvailableLabels}
              className="w-full pl-9 pr-8 py-1.5 text-sm bg-gray-100 dark:bg-gray-700/50 border-transparent focus:bg-white dark:focus:bg-gray-700 rounded-full focus:ring-2 focus:ring-primary transition-all"
          />
          {showCreateRuleButton && (
              <button
                  onClick={() => onCreateRuleFromFilter(filterLabel)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-blue-600 hover:bg-blue-100 rounded-full"
                  title={`Create rule for "${trimmedFilterLabel}"`}
              >
                <PlusCircle className="w-4 h-4" />
              </button>
          )}
        </div>

        {/* Center: Actions Toolbar — Desktop (horizontal scroll) */}
        <div className="hidden md:flex flex-1 items-center justify-start gap-2 overflow-x-auto no-scrollbar mask-linear-gradient">

          <Divider />

          {/* View Modes */}
          <div className="flex bg-gray-100 dark:bg-gray-700/50 p-1 rounded-lg shrink-0">
            <IconButton
                active={viewMode === 'grid'}
                onClick={() => setViewMode('grid')}
                icon={<LayoutGrid className="w-4 h-4" />}
                title="Grid View"
                activeClass="bg-white dark:bg-gray-600 shadow-sm text-primary"
                inactiveClass="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                className="!p-1.5"
            />
            <IconButton
                active={viewMode === 'folder'}
                onClick={() => setViewMode('folder')}
                icon={<FolderTree className="w-4 h-4" />}
                title="Folder View"
                activeClass="bg-white dark:bg-gray-600 shadow-sm text-primary"
                inactiveClass="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                className="!p-1.5"
            />
            <IconButton
                active={viewMode === 'zen'}
                onClick={() => setViewMode('zen')}
                icon={<Sparkles className="w-4 h-4" />}
                title="Zen Mode"
                activeClass="bg-white dark:bg-gray-600 shadow-sm text-primary"
                inactiveClass="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                className="!p-1.5"
            />
          </div>

          <Divider />

          {/* Selection Tools */}
          <div className="flex gap-1 shrink-0">
            <IconButton onClick={onSelectAll} disabled={noAnalyzedPhotos} icon={<CheckSquare className="w-5 h-5" />} title="Select All" />
            <IconButton onClick={onClearSelection} disabled={selectedPhotoCount === 0} icon={<XSquare className="w-5 h-5" />} title="Clear Selection" />
            <IconButton
                active={isolateSelection}
                onClick={onToggleIsolateSelection}
                disabled={selectedPhotoCount === 0 && !isolateSelection}
                icon={isolateSelection ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                title={isolateSelection ? "Show All" : "Isolate Selection"}
                activeClass="bg-blue-500 text-white"
            />
          </div>

          <Divider />

          {/* Magic / AI Tools */}
          <div className="flex gap-1 shrink-0">
            <IconButton onClick={onApplyRules} disabled={noAnalyzedPhotos} icon={<Zap className="w-5 h-5" />} title="Apply Rules" className="text-yellow-600 dark:text-yellow-400 hover:bg-yellow-100 dark:hover:bg-yellow-900/30" />
            <IconButton onClick={onCreateRuleFromSelection} disabled={selectedPhotoCount === 0} icon={<Wand2 className="w-5 h-5" />} title="Create Rule from Selection" className="text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/30" />
            <IconButton onClick={onFindDuplicates} disabled={noAnalyzedPhotos} icon={<Copy className="w-5 h-5" />} title="Find Duplicates" className="text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/30" />
          </div>

          <Divider />

          {/* Filters / Isolations */}
          <div className="flex gap-1 shrink-0">
            <IconButton
                active={isolateDuplicates}
                onClick={onToggleIsolateDuplicates}
                disabled={!isolateDuplicates} // Keep enabled if active to toggle off
                icon={<Copy className="w-5 h-5" />}
                title="Show Duplicates"
                activeClass="bg-indigo-500 text-white"
                className={!isolateDuplicates ? "opacity-50 hover:opacity-100" : ""}
            />
            <IconButton
                active={isolateBlurry}
                onClick={onToggleIsolateBlurry}
                disabled={blurryPhotoCount === 0 && !isolateBlurry}
                icon={<AlertTriangle className="w-5 h-5" />}
                title="Show Blurry"
                activeClass="bg-orange-500 text-white"
                className={!isolateBlurry ? "text-orange-600 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-900/30" : ""}
            />
            <IconButton
                active={isolateSaved}
                onClick={onToggleIsolateSaved}
                disabled={savedPhotoCount === 0 && !isolateSaved}
                icon={<Heart className={`w-5 h-5 ${isolateSaved ? 'fill-current' : ''}`} />}
                title="Show Saved"
                activeClass="bg-pink-500 text-white"
                className={!isolateSaved ? "text-pink-600 dark:text-pink-400 hover:bg-pink-100 dark:hover:bg-pink-900/30" : ""}
            />
          </div>

          <Divider />

          {/* Destructive Actions */}
          <div className="flex gap-1 shrink-0">
            <IconButton onClick={() => onMoveSavedPhotos()} disabled={savedPhotoCount === 0} icon={<Save className="w-5 h-5" />} title="Move Saved Photos" className="text-green-600 dark:text-green-500 hover:bg-green-100 dark:hover:bg-green-900/30"/>
            <IconButton onClick={onDeleteSelected} disabled={selectedPhotoCount === 0} icon={<Trash2 className="w-5 h-5" />} title="Delete Selected" className="text-red-600 dark:text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30"/>
          </div>
        </div>

        {/* Center: Actions Toolbar — Mobile (dropdown) */}
        <div className="flex md:hidden flex-1 items-center justify-end gap-2" ref={mobileMenuRef}>
          {/* More Actions Button */}
          <button
              onClick={() => setMobileMenuOpen(!isMobileMenuOpen)}
              className={`p-2 rounded-lg transition-colors ${isMobileMenuOpen ? 'bg-gray-200 dark:bg-gray-600 text-primary' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
              title="More actions"
          >
            <MoreHorizontal className="w-5 h-5" />
          </button>

          {/* Dropdown Menu */}
          {isMobileMenuOpen && (
              <div className="absolute top-full right-4 mt-2 w-72 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-50 p-3 max-h-[70vh] overflow-y-auto">
                {/* View Modes */}
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 px-1 mb-1 block">View Mode</label>
                <div className="flex bg-gray-100 dark:bg-gray-700/50 p-1 rounded-lg mb-3">
                  <IconButton
                      active={viewMode === 'grid'}
                      onClick={() => { setViewMode('grid'); setMobileMenuOpen(false); }}
                      icon={<LayoutGrid className="w-4 h-4" />}
                      title="Grid"
                      activeClass="bg-white dark:bg-gray-600 shadow-sm text-primary"
                      inactiveClass="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                      className="!p-1.5 flex-1"
                  />
                  <IconButton
                      active={viewMode === 'folder'}
                      onClick={() => { setViewMode('folder'); setMobileMenuOpen(false); }}
                      icon={<FolderTree className="w-4 h-4" />}
                      title="Folder"
                      activeClass="bg-white dark:bg-gray-600 shadow-sm text-primary"
                      inactiveClass="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                      className="!p-1.5 flex-1"
                  />
                  <IconButton
                      active={viewMode === 'zen'}
                      onClick={() => { setViewMode('zen'); setMobileMenuOpen(false); }}
                      icon={<Sparkles className="w-4 h-4" />}
                      title="Zen"
                      activeClass="bg-white dark:bg-gray-600 shadow-sm text-primary"
                      inactiveClass="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                      className="!p-1.5 flex-1"
                  />
                </div>

                {/* Selection Tools */}
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 px-1 mb-1 block">Selection</label>
                <div className="flex gap-1 mb-3 flex-wrap">
                  <IconButton onClick={() => { onSelectAll(); setMobileMenuOpen(false); }} disabled={noAnalyzedPhotos} icon={<CheckSquare className="w-5 h-5" />} title="Select All" />
                  <IconButton onClick={() => { onClearSelection(); setMobileMenuOpen(false); }} disabled={selectedPhotoCount === 0} icon={<XSquare className="w-5 h-5" />} title="Clear Selection" />
                  <IconButton
                      active={isolateSelection}
                      onClick={() => { onToggleIsolateSelection(); setMobileMenuOpen(false); }}
                      disabled={selectedPhotoCount === 0 && !isolateSelection}
                      icon={isolateSelection ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                      title={isolateSelection ? "Show All" : "Isolate Sel."}
                      activeClass="bg-blue-500 text-white"
                  />
                </div>

                {/* Magic / AI Tools */}
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 px-1 mb-1 block">AI Tools</label>
                <div className="flex gap-1 mb-3 flex-wrap">
                  <IconButton onClick={() => { onApplyRules(); setMobileMenuOpen(false); }} disabled={noAnalyzedPhotos} icon={<Zap className="w-5 h-5" />} title="Apply Rules" className="text-yellow-600 dark:text-yellow-400" />
                  <IconButton onClick={() => { onCreateRuleFromSelection(); setMobileMenuOpen(false); }} disabled={selectedPhotoCount === 0} icon={<Wand2 className="w-5 h-5" />} title="Auto Rule" className="text-purple-600 dark:text-purple-400" />
                  <IconButton onClick={() => { onFindDuplicates(); setMobileMenuOpen(false); }} disabled={noAnalyzedPhotos} icon={<Copy className="w-5 h-5" />} title="Duplicates" className="text-indigo-600 dark:text-indigo-400" />
                </div>

                {/* Filters / Isolations */}
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 px-1 mb-1 block">Filters</label>
                <div className="flex gap-1 mb-3 flex-wrap">
                  <IconButton
                      active={isolateDuplicates}
                      onClick={() => { onToggleIsolateDuplicates(); setMobileMenuOpen(false); }}
                      disabled={!isolateDuplicates}
                      icon={<Copy className="w-5 h-5" />}
                      title={isolateDuplicates ? "Duplicates: On" : "Duplicates"}
                      activeClass="bg-indigo-500 text-white"
                      className={!isolateDuplicates ? "opacity-50" : ""}
                  />
                  <IconButton
                      active={isolateBlurry}
                      onClick={() => { onToggleIsolateBlurry(); setMobileMenuOpen(false); }}
                      disabled={blurryPhotoCount === 0 && !isolateBlurry}
                      icon={<AlertTriangle className="w-5 h-5" />}
                      title={isolateBlurry ? "Blurry: On" : "Blurry"}
                      activeClass="bg-orange-500 text-white"
                  />
                  <IconButton
                      active={isolateSaved}
                      onClick={() => { onToggleIsolateSaved(); setMobileMenuOpen(false); }}
                      disabled={savedPhotoCount === 0 && !isolateSaved}
                      icon={<Heart className={`w-5 h-5 ${isolateSaved ? 'fill-current' : ''}`} />}
                      title={isolateSaved ? "Saved: On" : "Saved"}
                      activeClass="bg-pink-500 text-white"
                  />
                </div>

                {/* Destructive Actions */}
                <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 px-1 mb-1 block">Actions</label>
                <div className="flex gap-1 flex-wrap">
                  <IconButton onClick={() => { onMoveSavedPhotos(); setMobileMenuOpen(false); }} disabled={savedPhotoCount === 0} icon={<Save className="w-5 h-5" />} title="Move Saved" className="text-green-600 dark:text-green-500"/>
                  <IconButton onClick={() => { onDeleteSelected(); setMobileMenuOpen(false); }} disabled={selectedPhotoCount === 0} icon={<Trash2 className="w-5 h-5" />} title="Delete Selected" className="text-red-600 dark:text-red-500"/>
                </div>
              </div>
          )}
        </div>

        {/* Right: Profile */}
        <div className="shrink-0 pl-2">
          <button
              onClick={onOpenProfileSettings}
              className="flex items-center gap-2 p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title="Settings & Profile"
          >
            <div className="w-8 h-8 bg-gradient-to-br from-primary to-accent text-white flex items-center justify-center rounded-full font-bold shadow-md">
              {userProfile.firstName.charAt(0).toUpperCase()}
            </div>
          </button>
        </div>
      </header>
  );
};

export default ControlBar;
