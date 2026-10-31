
import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import type { UserProfile, Photo, FilterRule, Prediction } from '../services/types.ts';
import { PhotoStatus } from '../services/types.ts';
import { useFileSystem } from './useFileSystem.ts';
import { usePhotoAnalysis } from './usePhotoAnalysis.ts';
import { usePhotoSelection } from './usePhotoSelection.ts';
import { useProgressPersistence } from './useProgressPersistence.ts';
import { useKeepScreenOn } from './useKeepScreenOn.ts';
import { useBackgroundProgress } from './useBackgroundProgress.ts';
import { findDuplicateGroups } from '../services/duplicateDetection.ts';
import { revokePhotoURLs } from '../services/photoUrls.ts';
import { t } from '../services/i18n.ts';
import { initAutopilot, setIgnoredFeatures, recordDecisions, forgetKeep, autopilotMatch } from '../services/autopilot.ts';


interface UsePhotoManagerProps {
  userProfile: UserProfile;
  onProfileUpdate: (profile: UserProfile) => void;
  filterLabel: string;
}

export const usePhotoManager = ({ userProfile, onProfileUpdate, filterLabel }: UsePhotoManagerProps) => {
  const [photos, setPhotos] = useState<Map<string, Photo>>(new Map());
  const [statusMessage, setStatusMessage] = useState<string>('Ready to organize some photos! 🥳');
  const [confirmDeleteState, setConfirmDeleteState] = useState<{isOpen: boolean, photosToDelete: Photo[]}>({ isOpen: false, photosToDelete: [] });

  // Revoke blob URLs on unmount to prevent memory leaks
  const photosRef = useRef(photos);
  photosRef.current = photos;
  useEffect(() => {
    return () => {
      for (const photo of photosRef.current.values()) {
        revokePhotoURLs(photo);
      }
    };
  }, []);

  useProgressPersistence(photos);

  const directoryHandleRef = useRef<FileSystemDirectoryHandle | null>(null);
  const userProfileRef = useRef(userProfile);
  userProfileRef.current = userProfile;

  // --- Sub-hook for Selection Logic ---
  const {
    selectedPhotos,
    isolateSelection,
    setIsolateSelection,
    handleSelectPhoto,
    handleToggleIsolateSelection,
    selectAllFiltered,
    clearSelectionFiltered
  } = usePhotoSelection(photos, setPhotos, setStatusMessage);

  const [isolateSaved, setIsolateSaved] = useState(false);
  // Duplicate Detection State
  const [isolateDuplicates, setIsolateDuplicates] = useState(false);
  const [duplicateCount, setDuplicateCount] = useState(0);

  // Blur Isolation State
  const [isolateBlurry, setIsolateBlurry] = useState(false);

  const savedPhotos = useMemo(() => Array.from(photos.values()).filter(p => p.isSaved), [photos]);
  const blurryPhotos = useMemo(() => Array.from(photos.values()).filter(p => p.blurLevel === 'blurry'), [photos]);

  const processingQueueCount = useMemo(() => {
    let count = 0;
    for (const photo of photos.values()) {
      if (!photo.awaitingApproval && (photo.status === PhotoStatus.QUEUED || photo.status === PhotoStatus.ANALYZING)) {
        count++;
      }
    }
    return count;
  }, [photos]);

  useKeepScreenOn(processingQueueCount > 0);
  useBackgroundProgress(processingQueueCount);

  // --- Sub-hook for File System Logic ---
  const {
    isLoading,
    isApiSupported,
    handleLoadPhotos,
    handleDeletePhotos,
    handleMoveSaved
  } = useFileSystem(directoryHandleRef, photos, setPhotos, setStatusMessage);

  // --- Rule Application Logic ---
  const applyRules = useCallback((predictions: Prediction[], rules: FilterRule[]): string[] => {
    if (!rules || rules.length === 0) return [];
    const matchedRuleLabels: string[] = [];
    for (const rule of rules) {
      const photoPrediction = predictions.find(p => p.label.toLowerCase().includes(rule.label.toLowerCase()));
      if (photoPrediction) {
        if (rule.confidence === undefined || (photoPrediction.score * 100) >= rule.confidence) {
          matchedRuleLabels.push(rule.label);
        }
      }
    }
    return matchedRuleLabels;
  }, []);

  // --- Sub-hook for Analysis Logic ---
  const {
    tfBackend,
    modelsLoadState,
    reanalyzeAll,
    startNewPhotosAnalysis,
  } = usePhotoAnalysis(photos, setPhotos, userProfileRef, applyRules);

  // --- Derived State ---
  const { allAvailableClassificationLabels, allAvailableDetectionLabels, allAvailableLabels } = useMemo(() => {
    const classificationLabels = new Set<string>();
    const detectionLabels = new Set<string>();
    for (const photo of photos.values()) {
      if (photo.status === PhotoStatus.ANALYZED || photo.status === PhotoStatus.UNCATEGORIZED) {
        photo.classifications.forEach(c => classificationLabels.add(c.label.toLowerCase()));
        photo.detections.forEach(d => detectionLabels.add(d.label.toLowerCase()));
      }
    }
    const customLabelNames = (userProfile.customLabels ?? []).map(cl => cl.name.toLowerCase());
    const allLabels = new Set([...classificationLabels, ...detectionLabels, ...customLabelNames]);

    return {
      allAvailableClassificationLabels: Array.from(classificationLabels).sort(),
      allAvailableDetectionLabels: Array.from(detectionLabels).sort(),
      allAvailableLabels: Array.from(allLabels).sort()
    };
  }, [photos, userProfile.customLabels]);

  // Autopilot: load the stored decisions once, and follow the features the user asked to ignore
  useEffect(() => { initAutopilot(); }, []);
  useEffect(() => { setIgnoredFeatures(userProfile.autopilotIgnored); }, [userProfile.autopilotIgnored]);

  const handleToggleSavePhoto = useCallback((id: string) => {
    const before = photosRef.current.get(id);
    if (before) {
      if (before.isSaved) forgetKeep([before]); else recordDecisions([before], 'keep');
    }
    setPhotos(prev => {
      const newPhotos = new Map(prev);
      const photo = newPhotos.get(id);
      if (photo) {
        newPhotos.set(id, { ...photo, isSaved: !photo.isSaved });
      }
      return newPhotos;
    });
  }, [setPhotos]);

  const handleBulkSave = useCallback((photosToSave: Photo[]) => {
    if (photosToSave.length === 0) return;

    // If all photos are already saved, unsave all. Otherwise, save all.
    const allAreSaved = photosToSave.every(p => p.isSaved);
    if (allAreSaved) forgetKeep(photosToSave); else recordDecisions(photosToSave.filter(p => !p.isSaved), 'keep');

    setPhotos(prev => {
      const newPhotos = new Map(prev);
      photosToSave.forEach(photo => {
        const current = newPhotos.get(photo.id);
        if (current) {
          newPhotos.set(photo.id, { ...current, isSaved: !allAreSaved });
        }
      });
      return newPhotos;
    });

    setStatusMessage(t(allAreSaved ? 'pm.unsaved' : 'pm.saved', { count: photosToSave.length }));
  }, [setPhotos, setStatusMessage]);

  const handleToggleIsolateSaved = useCallback(() => {
    if (savedPhotos.length > 0 || isolateSaved) {
      const newState = !isolateSaved;
      setIsolateSaved(newState);
      if (newState) {
        setIsolateDuplicates(false);
        setIsolateBlurry(false);
        if (isolateSelection) handleToggleIsolateSelection();
      }
    }
  }, [savedPhotos.length, isolateSaved, isolateSelection, handleToggleIsolateSelection]);

  const handleToggleIsolateDuplicates = useCallback(() => {
    if (duplicateCount > 0 || isolateDuplicates) {
      const newState = !isolateDuplicates;
      setIsolateDuplicates(newState);
      if (newState) {
        setIsolateSaved(false);
        setIsolateBlurry(false);
        if (isolateSelection) handleToggleIsolateSelection();
      }
    }
  }, [duplicateCount, isolateDuplicates, isolateSelection, handleToggleIsolateSelection]);

  const handleToggleIsolateBlurry = useCallback(() => {
    if (blurryPhotos.length > 0 || isolateBlurry) {
      const newState = !isolateBlurry;
      setIsolateBlurry(newState);
      if (newState) {
        setIsolateSaved(false);
        setIsolateDuplicates(false);
        if (isolateSelection) handleToggleIsolateSelection();
      }
    }
  }, [blurryPhotos.length, isolateBlurry, isolateSelection, handleToggleIsolateSelection]);

  const handleMoveSavedPhotos = useCallback((photosToMove: Photo[] = savedPhotos, folderName: string = userProfileRef.current.savedFolderName || 'saves', operation: 'copy' | 'move' = userProfileRef.current.savedOperation || 'move') => {
    handleMoveSaved(photosToMove, folderName, operation);
  }, [savedPhotos, userProfileRef, handleMoveSaved]);

  const handleRequestDelete = useCallback((photos: Photo[] = selectedPhotos, skipConfirm: boolean = false) => {
    if (photos.length === 0) return;

    const savedInSelection = photos.filter(p => p.isSaved);

    if (!skipConfirm && savedInSelection.length > 0) {
      setConfirmDeleteState({ isOpen: true, photosToDelete: photos });
    } else {
      // No saved photos in selection, ask for simple confirmation
      if (skipConfirm || window.confirm(t('pm.confirmDelete', { count: photos.length }))) {
        handleDeletePhotos(photos);
      }
    }
  }, [selectedPhotos, handleDeletePhotos]);

  const handleConfirmDelete = useCallback(() => {
    handleDeletePhotos(confirmDeleteState.photosToDelete);
    setConfirmDeleteState({ isOpen: false, photosToDelete: [] });
  }, [confirmDeleteState.photosToDelete, handleDeletePhotos]);

  const handleConfirmDeleteKeepSaved = useCallback(() => {
    const photosToDelete = confirmDeleteState.photosToDelete.filter(p => !p.isSaved);
    if (photosToDelete.length > 0) {
      handleDeletePhotos(photosToDelete);
    }
    setConfirmDeleteState({ isOpen: false, photosToDelete: [] });
  }, [confirmDeleteState.photosToDelete, handleDeletePhotos]);

  const handleCancelDelete = useCallback(() => {
    setConfirmDeleteState({ isOpen: false, photosToDelete: [] });
  }, []);


  // --- High-level Handlers (combining selection and business logic) ---
  const handleSelectAll = useCallback(() => {
    let photosToProcess = Array.from(photos.values()).filter(p => p.status === PhotoStatus.ANALYZED);
    if (filterLabel.trim()) {
      const lowercasedFilter = filterLabel.toLowerCase().trim();
      photosToProcess = photosToProcess.filter(p =>
          p.classifications.some(pred => pred.label.toLowerCase().includes(lowercasedFilter)) ||
          p.detections.some(pred => pred.label.toLowerCase().includes(lowercasedFilter))
      );
    }
    selectAllFiltered(photosToProcess);
  }, [photos, filterLabel, selectAllFiltered]);

  const handleClearSelection = useCallback(() => {
    let photosToClear = selectedPhotos;
    if (filterLabel.trim()) {
      const lowercasedFilter = filterLabel.toLowerCase().trim();
      photosToClear = photosToClear.filter(p =>
          p.status === PhotoStatus.ANALYZED &&
          (p.classifications.some(pred => pred.label.toLowerCase().includes(lowercasedFilter)) ||
              p.detections.some(pred => pred.label.toLowerCase().includes(lowercasedFilter)))
      );
    }
    clearSelectionFiltered(photosToClear);
  }, [selectedPhotos, filterLabel, clearSelectionFiltered]);

  const handleReanalyze = useCallback(() => {
    const total = Array.from(photos.values()).filter(p => p.status === PhotoStatus.ANALYZED || p.status === PhotoStatus.UNCATEGORIZED || p.status === PhotoStatus.ERROR).length;
    if (total === 0) {
      setStatusMessage(t('pm.noneToReanalyze'));
      return;
    }
    if (!window.confirm(t('pm.confirmReanalyze', { count: total }))) return;
    const count = reanalyzeAll();
    setStatusMessage(t('pm.reanalyzing', { count }));
  }, [photos, reanalyzeAll, setStatusMessage]);

  const handleAnalyzeNew = useCallback((applyRules: boolean) => {
    const count = startNewPhotosAnalysis(applyRules);
    if (count > 0) setStatusMessage(t('new.started', { count }));
  }, [startNewPhotosAnalysis, setStatusMessage]);

  // Selects the analysed photos matching the rules, then narrows the display to the selection.
  // Returns how many photos are selected afterwards (0: nothing to show).
  const handleApplyRulesManually = useCallback((): number => {
    const photosToProcess = Array.from(photos.values()).filter(p => p.status === PhotoStatus.ANALYZED);
    if (photosToProcess.length === 0) {
      setStatusMessage(t('pm.noAnalyzed'));
      return -1;
    }

    const profile = userProfileRef.current;
    const matches = new Map<string, NonNullable<Photo['matchedRules']>>();
    for (const photo of photosToProcess) {
      const classification = applyRules(photo.classifications, profile.classificationRules);
      const detection = applyRules(photo.detections, profile.detectionRules);
      const autopilot = profile.autopilot ? autopilotMatch(photo, profile.autopilotThreshold) : null;
      if (classification.length > 0 || detection.length > 0 || autopilot) {
        matches.set(photo.id, { classification, detection, ...(autopilot ? { autopilot } : {}) });
      }
    }

    let newlySelectedCount = 0;
    let selectedAfter = 0;
    for (const photo of photos.values()) {
      if (photo.selected) selectedAfter++;
      else if (matches.has(photo.id)) { selectedAfter++; newlySelectedCount++; }
    }

    if (matches.size > 0) {
      setPhotos(prevPhotos => {
        const newPhotos = new Map(prevPhotos);
        for (const [id, m] of matches) {
          const currentPhoto = newPhotos.get(id);
          if (currentPhoto) newPhotos.set(id, { ...currentPhoto, selected: true, matchedRules: m });
        }
        return newPhotos;
      });
    }

    if (newlySelectedCount > 0) {
      setStatusMessage(t('pm.ruleSelected', { count: newlySelectedCount }));
    } else if (matches.size > 0) {
      setStatusMessage(t('pm.ruleAlready', { count: matches.size }));
    } else {
      setStatusMessage(t('pm.ruleNone'));
    }

    if (selectedAfter > 0) {
      setIsolateSaved(false);
      setIsolateDuplicates(false);
      setIsolateBlurry(false);
      setIsolateSelection(true);
    }
    return selectedAfter;
  }, [photos, applyRules, userProfileRef, setPhotos, setStatusMessage, setIsolateSelection]);

  const handleFindDuplicates = useCallback(async () => {
    setStatusMessage(t('pm.dupScanning'));
    const photosArray = Array.from(photos.values());

    try {
      const groups = await findDuplicateGroups(photosArray);

      if (groups.length === 0) {
        setStatusMessage(t('pm.dupNone'));
        return;
      }

      setPhotos(prev => {
        const newPhotos = new Map(prev);
        let redundantCount = 0;

        groups.forEach(group => {
          group.photos.forEach(photoId => {
            const p = newPhotos.get(photoId);
            if (p) {
              newPhotos.set(photoId, {
                ...p,
                duplicateGroupId: group.id,
                isDuplicate: photoId !== group.bestPhotoId, // Mark redundant ones
                selected: photoId !== group.bestPhotoId // Select redundant ones automatically
              });
              if (photoId !== group.bestPhotoId) redundantCount++;
            }
          });
        });
        setDuplicateCount(redundantCount);
        return newPhotos;
      });

      setIsolateDuplicates(true); // Auto switch to duplicates view
      setIsolateSaved(false); // Reset others
      setIsolateBlurry(false);
      if (isolateSelection) handleToggleIsolateSelection();

      setStatusMessage(t('pm.dupFound', { groups: groups.length, count: groups.reduce((acc, g) => acc + g.photos.length - 1, 0) }));

    } catch (error) {
      console.error(error);
      setStatusMessage(t('pm.dupError'));
    }
  }, [photos, setStatusMessage, isolateSelection, handleToggleIsolateSelection]);

  const handleCreateRuleFromSelection = useCallback(() => {
    if (selectedPhotos.length === 0) {
      setStatusMessage(t('pm.pickToRule'));
      return;
    }

    let newClassificationRules: FilterRule[] = [];
    let newDetectionRules: FilterRule[] = [];

    const existingClassificationLabels = new Set(userProfileRef.current.classificationRules.map(r => r.label.toLowerCase()));
    const existingDetectionLabels = new Set(userProfileRef.current.detectionRules.map(r => r.label.toLowerCase()));

    if (selectedPhotos.length === 1) {
      const photo = selectedPhotos[0];
      if (photo.classifications.length > 0) {
        const topClassification = photo.classifications.reduce((max, p) => p.score > max.score ? p : max);
        if (!existingClassificationLabels.has(topClassification.label.toLowerCase())) {
          newClassificationRules.push({
            id: crypto.randomUUID(),
            label: topClassification.label,
            confidence: Math.max(1, Math.floor(topClassification.score * 100)),
          });
        }
      }
      if (photo.detections.length > 0) {
        const topDetection = photo.detections.reduce((max, p) => p.score > max.score ? p : max);
        if (!existingDetectionLabels.has(topDetection.label.toLowerCase())) {
          newDetectionRules.push({
            id: crypto.randomUUID(),
            label: topDetection.label,
            confidence: Math.max(1, Math.floor(topDetection.score * 100)),
          });
        }
      }
    } else {
      const commonClassifications = new Map<string, { score: number; originalLabel: string }>(
          selectedPhotos[0].classifications.map(p => [ p.label.toLowerCase(), { score: p.score, originalLabel: p.label }])
      );
      const commonDetections = new Map<string, { score: number; originalLabel: string }>(
          selectedPhotos[0].detections.map(p => [ p.label.toLowerCase(), { score: p.score, originalLabel: p.label }])
      );

      for (let i = 1; i < selectedPhotos.length; i++) {
        const photo = selectedPhotos[i];
        const photoClassifications = new Map(photo.classifications.map(p => [p.label.toLowerCase(), p.score]));
        const photoDetections = new Map(photo.detections.map(p => [p.label.toLowerCase(), p.score]));
        for (const [labelKey, data] of commonClassifications.entries()) {
          if (photoClassifications.has(labelKey)) {
            data.score = Math.min(data.score, photoClassifications.get(labelKey)!);
          } else {
            commonClassifications.delete(labelKey);
          }
        }
        for (const [labelKey, data] of commonDetections.entries()) {
          if (photoDetections.has(labelKey)) {
            data.score = Math.min(data.score, photoDetections.get(labelKey)!);
          } else {
            commonDetections.delete(labelKey);
          }
        }
      }

      for (const [labelKey, data] of commonClassifications.entries()) {
        if (!existingClassificationLabels.has(labelKey)) {
          newClassificationRules.push({
            id: crypto.randomUUID(),
            label: data.originalLabel,
            confidence: Math.max(1, Math.floor(data.score * 100)),
          });
        }
      }
      for (const [labelKey, data] of commonDetections.entries()) {
        if (!existingDetectionLabels.has(labelKey)) {
          newDetectionRules.push({
            id: crypto.randomUUID(),
            label: data.originalLabel,
            confidence: Math.max(1, Math.floor(data.score * 100)),
          });
        }
      }
    }

    if (newClassificationRules.length === 0 && newDetectionRules.length === 0) {
      setStatusMessage(t('pm.noNewRules'));
      return;
    }

    const updatedProfile: UserProfile = {
      ...userProfileRef.current,
      classificationRules: [...userProfileRef.current.classificationRules, ...newClassificationRules],
      detectionRules: [...userProfileRef.current.detectionRules, ...newDetectionRules],
    };
    onProfileUpdate(updatedProfile);
    const totalNewRules = newClassificationRules.length + newDetectionRules.length;
    setStatusMessage(t('pm.rulesAdded', { count: totalNewRules }));
  }, [selectedPhotos, onProfileUpdate, setStatusMessage]);

  const handleCreateRuleFromFilter = useCallback((label: string) => {
    const trimmedLabel = label.trim();
    if (!trimmedLabel) return;
    const lowercasedLabel = trimmedLabel.toLowerCase();

    const currentProfile = userProfileRef.current;
    const newProfile = { ...currentProfile, classificationRules: [...currentProfile.classificationRules], detectionRules: [...currentProfile.detectionRules]};
    let ruleAdded = false;

    const hasClassificationRule = currentProfile.classificationRules.some(r => r.label.toLowerCase() === lowercasedLabel);
    if (!hasClassificationRule) {
      newProfile.classificationRules.push({ id: crypto.randomUUID(), label: trimmedLabel });
      ruleAdded = true;
    }

    const hasDetectionRule = currentProfile.detectionRules.some(r => r.label.toLowerCase() === lowercasedLabel);
    if (!hasDetectionRule) {
      newProfile.detectionRules.push({ id: crypto.randomUUID(), label: trimmedLabel });
      ruleAdded = true;
    }

    if (ruleAdded) {
      onProfileUpdate(newProfile);
      setStatusMessage(t('pm.ruleCreated', { label: trimmedLabel }));
    } else {
      setStatusMessage(t('pm.ruleExists', { label: trimmedLabel }));
    }
  }, [onProfileUpdate, setStatusMessage]);

  return {
    photos,
    statusMessage,
    isLoading,
    isApiSupported,
    handleLoadPhotos,
    handleSelectPhoto,
    selectedPhotos,
    savedPhotos,
    handleRequestDelete,
    handleApplyRulesManually,
    handleReanalyze,
    handleAnalyzeNew,
    handleSelectAll,
    handleClearSelection,
    tfBackend,
    isolateSelection,
    handleToggleIsolateSelection,
    isolateSaved,
    handleToggleIsolateSaved,
    allAvailableLabels,
    allAvailableClassificationLabels,
    allAvailableDetectionLabels,
    modelsLoadState,
    handleCreateRuleFromSelection,
    handleCreateRuleFromFilter,
    handleToggleSavePhoto,
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
    duplicateCount,
    isolateBlurry,
    handleToggleIsolateBlurry,
    blurryPhotoCount: blurryPhotos.length
  };
};
