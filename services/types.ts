
export enum PhotoStatus {
  QUEUED = 'QUEUED',
  ANALYZING = 'ANALYZING',
  ANALYZED = 'ANALYZED',
  ERROR = 'ERROR',
  UNCATEGORIZED = 'UNCATEGORIZED',
}

export interface Prediction {
  label: string;
  score: number;
}

export interface Photo {
  id: string; // The full path of the photo, used as a unique ID
  objectURL: string; // blob url of the original file (viewer, Zen mode)
  thumbnailURL?: string; // blob url of a small JPEG generated during analysis (grid)
  status: PhotoStatus;
  classifications: Prediction[];
  detections: Prediction[];
  selected: boolean;
  isSaved?: boolean;
  source?: { size: number; lastModified: number }; // the file as scanned, to match saved progress
  fromPreviousSession?: boolean; // restored from saved progress: analysed before this opening
  customLabel?: string;

  // Duplicate Detection
  embedding?: number[]; // 1024-dim vector
  duplicateGroupId?: string;
  isDuplicate?: boolean; // If true, this is NOT the best photo in the group

  // Blur Detection
  blurScore?: number; // 0-100 normalized score
  blurRaw?: number; // Raw variance value
  blurLevel?: 'sharp' | 'ok' | 'blurry';

  matchedRules?: {
    classification?: string[]; // Names of matching classification rules
    detection?: string[]; // Names of matching detection rules
  };
  metadata?: {
    width: number;
    height: number;
    size: number;
    lastModified: number;
  }
}

export interface DuplicateGroup {
  id: string;
  photos: string[]; // List of Photo IDs
  bestPhotoId: string;
}

export interface FilterRule {
  id: string;
  label: string;
  confidence?: number; // 0-100, optional
}

export interface CustomLabel {
  id: string;
  name: string;
  labels: string[]; // a list of AI labels (lowercase)
}

export type ThumbnailSize = 'XS' | 'S' | 'M' | 'L' | 'XL';

export type ModelLoadStatus = 'idle' | 'loading' | 'loaded' | 'error';

export interface ModelsLoadState {
  classification: ModelLoadStatus;
  detection: ModelLoadStatus;
}

export interface UserProfile {
  firstName: string;
  classificationRules: FilterRule[];
  detectionRules: FilterRule[];
  autoApplyRules: boolean;
  unknownThreshold?: number; // 0-50, percentage for classifying photos as 'Uncategorized'
  thumbnailSize?: ThumbnailSize;
  savedFolderName?: string;
  savedOperation?: 'copy' | 'move';
  customLabels?: CustomLabel[];

  language?: 'auto' | 'fr' | 'en'; // interface language, 'auto' follows the phone
  startupView?: 'all' | 'new'; // 'new': at opening, only show photos not analysed in a previous session

  classifier?: 'mobilenet' | 'clip'; // Classification model (CLIP is an experimental prototype)

  // Blur Settings
  blurThreshold?: number; // Raw variance below this is 'blurry'
  sharpThreshold?: number; // Raw variance above this is 'sharp'
}
