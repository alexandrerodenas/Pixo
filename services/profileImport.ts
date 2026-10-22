import type { UserProfile, FilterRule, CustomLabel, ThumbnailSize } from './types.ts';

export type ImportedProfile = Pick<UserProfile, 'firstName' | 'autoApplyRules' | 'classificationRules' | 'detectionRules'>
    & Partial<UserProfile> & { customLabels: CustomLabel[] };

const THUMBNAIL_SIZES: ThumbnailSize[] = ['XS', 'S', 'M', 'L', 'XL'];

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNumberInRange = (v: unknown, min: number, max: number): v is number =>
    typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;

function parseRules(value: unknown): FilterRule[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return null;
  const rules: FilterRule[] = [];
  for (const item of value) {
    if (!isObject(item) || typeof item.label !== 'string' || !item.label.trim()) return null;
    if (item.confidence !== undefined && !isNumberInRange(item.confidence, 0, 100)) return null;
    rules.push({
      id: typeof item.id === 'string' ? item.id : crypto.randomUUID(),
      label: item.label,
      ...(item.confidence !== undefined ? { confidence: item.confidence as number } : {}),
    });
  }
  return rules;
}

function parseCustomLabels(value: unknown): CustomLabel[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return null;
  const labels: CustomLabel[] = [];
  for (const item of value) {
    if (!isObject(item) || typeof item.name !== 'string' || !item.name.trim()) return null;
    if (!Array.isArray(item.labels) || !item.labels.every(l => typeof l === 'string')) return null;
    labels.push({
      id: typeof item.id === 'string' ? item.id : crypto.randomUUID(),
      name: item.name,
      labels: (item.labels as string[]).map(l => l.toLowerCase()),
    });
  }
  return labels;
}

/**
 * Validates an imported profile JSON field by field and keeps only known keys.
 * Returns null when the file is not a valid Pixo profile.
 */
export function parseImportedProfile(raw: unknown): ImportedProfile | null {
  if (!isObject(raw)) return null;
  if (typeof raw.firstName !== 'string' || typeof raw.autoApplyRules !== 'boolean') return null;

  // Legacy profiles stored classification rules under "rules"
  const classificationRules = parseRules(raw.classificationRules ?? raw.rules);
  const detectionRules = parseRules(raw.detectionRules);
  const customLabels = parseCustomLabels(raw.customLabels);
  if (!classificationRules || !detectionRules || !customLabels) return null;

  const profile: ImportedProfile = {
    firstName: raw.firstName,
    autoApplyRules: raw.autoApplyRules,
    classificationRules,
    detectionRules,
    customLabels,
  };

  if (raw.classifier === 'mobilenet' || raw.classifier === 'clip') profile.classifier = raw.classifier;
  if (isNumberInRange(raw.unknownThreshold, 0, 100)) profile.unknownThreshold = raw.unknownThreshold;
  if (THUMBNAIL_SIZES.includes(raw.thumbnailSize as ThumbnailSize)) profile.thumbnailSize = raw.thumbnailSize as ThumbnailSize;
  if (raw.savedOperation === 'copy' || raw.savedOperation === 'move') profile.savedOperation = raw.savedOperation;
  if (typeof raw.savedFolderName === 'string' && /^[^/\\]+$/.test(raw.savedFolderName.trim()) && !['.', '..'].includes(raw.savedFolderName.trim())) {
    profile.savedFolderName = raw.savedFolderName.trim();
  }
  if (isNumberInRange(raw.blurThreshold, 0, 100000)) profile.blurThreshold = raw.blurThreshold;
  if (isNumberInRange(raw.sharpThreshold, 0, 100000)) profile.sharpThreshold = raw.sharpThreshold;

  return profile;
}
