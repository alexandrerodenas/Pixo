import { useSyncExternalStore } from 'react';
import { getLanguage, subscribeLanguage } from '../services/i18n.ts';

/** Re-renders the component when the interface language changes. */
export const useLanguage = () => useSyncExternalStore(subscribeLanguage, getLanguage);
