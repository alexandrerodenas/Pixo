import { t, type MessageKey } from './i18n.ts';
import { messages } from './messages.ts';

const FIXED: Record<string, MessageKey> = {
  'd:none': 'ap.f.noObject',
  'uncategorized': 'ap.f.uncategorized',
  'blur:blurry': 'ap.f.blurry',
  'blur:ok': 'ap.f.ok',
  'blur:sharp': 'ap.f.sharp',
  'dup:redundant': 'ap.f.dupRedundant',
  'dup:best': 'ap.f.dupBest',
  'src:screenshot': 'ap.f.screenshot',
  'src:whatsapp': 'ap.f.whatsapp',
  'src:messaging': 'ap.f.messaging',
  'src:download': 'ap.f.download',
  'ext:png': 'ap.f.png',
};

const WITH_LABEL: Record<string, MessageKey> = {
  c: 'ap.f.class',
  d: 'ap.f.object',
  custom: 'ap.f.custom',
  folder: 'ap.f.folder',
};

/** A learned feature (see extractFeatures) in words, in the interface language. */
export function describeFeature(feature: string): string {
  if (FIXED[feature]) return t(FIXED[feature]);
  const i = feature.indexOf(':');
  const kind = feature.slice(0, i);
  const value = feature.slice(i + 1);
  if (WITH_LABEL[kind]) return t(WITH_LABEL[kind], { label: value });
  const key = `ap.f.${kind}.${value}`;
  return key in messages ? t(key as MessageKey) : feature;
}

/** Learned features that map to a manual rule: classification and detection labels. */
export function featureToRule(feature: string): { type: 'classification' | 'detection'; label: string } | null {
  if (feature.startsWith('c:')) return { type: 'classification', label: feature.slice(2) };
  if (feature.startsWith('d:') && feature !== 'd:none') return { type: 'detection', label: feature.slice(2) };
  return null;
}
