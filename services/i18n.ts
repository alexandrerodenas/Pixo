import { messages } from './messages.ts';

// The interface language: the one chosen in the profile, else the phone's (French or English).
export type Language = 'fr' | 'en';
export type LanguageSetting = 'auto' | Language;
export type MessageKey = keyof typeof messages;

const STORAGE_KEY = 'pixoLanguage';

function detectLanguage(): Language {
  const preferred = typeof navigator !== 'undefined' ? (navigator.languages?.[0] ?? navigator.language ?? '') : '';
  return preferred.toLowerCase().startsWith('fr') ? 'fr' : 'en';
}

function initialLanguage(): Language {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'fr' || stored === 'en') return stored;
  } catch { /* not critical */ }
  return detectLanguage();
}

let language: Language = initialLanguage();
const listeners = new Set<() => void>();

export const getLanguage = (): Language => language;

export function subscribeLanguage(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Applies the profile's language setting ('auto' follows the phone). */
export function setLanguage(setting: LanguageSetting = 'auto') {
  const next = setting === 'auto' ? detectLanguage() : setting;
  try { localStorage.setItem(STORAGE_KEY, next); } catch { /* not critical */ }
  if (next === language) return;
  language = next;
  document.documentElement.lang = next;
  listeners.forEach(listener => listener());
}

export function t(key: MessageKey, args: Record<string, string | number> = {}): string {
  return messages[key][language].replace(/\{(\w+)\}/g, (_, name) => String(args[name] ?? `{${name}}`));
}
