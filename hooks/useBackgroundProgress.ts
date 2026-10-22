import { useEffect, useRef } from 'react';
import { isPhoneLibrary, showAnalysisProgress, hideAnalysisProgress, askNotificationPermission } from '../services/phoneLibrary.ts';
import { t } from '../services/i18n.ts';

const UPDATE_INTERVAL_MS = 1500;
const PERMISSION_ASKED_KEY = 'pixo.notificationsAsked';

// Android app only: mirrors the analysis queue in a progress notification, which also keeps the
// analysis running while the app is in the background. `pending` is the number of photos still
// waiting or being analysed.
export const useBackgroundProgress = (pending: number) => {
  const batchRef = useRef({ total: 0, done: 0, previous: 0, lastUpdate: 0 });

  useEffect(() => {
    if (!isPhoneLibrary()) return;
    const batch = batchRef.current;

    if (pending === 0) {
      if (batch.total > 0) {
        const total = batch.total;
        batch.total = batch.done = batch.previous = 0;
        // A "finished" notification is only useful when the user is not looking at the app
        hideAnalysisProgress(document.visibilityState === 'hidden' ? t('notification.done', { count: total }) : undefined);
      }
      return;
    }

    if (batch.total === 0) {
      batch.lastUpdate = 0;
      try {
        if (!localStorage.getItem(PERMISSION_ASKED_KEY)) {
          localStorage.setItem(PERMISSION_ASKED_KEY, '1');
          askNotificationPermission();
        }
      } catch { /* not critical */ }
    }
    // Photos can be added while the batch runs
    if (pending > batch.previous) batch.total += pending - batch.previous;
    else batch.done += batch.previous - pending;
    batch.previous = pending;

    const now = Date.now();
    if (now - batch.lastUpdate >= UPDATE_INTERVAL_MS) {
      batch.lastUpdate = now;
      showAnalysisProgress(batch.done, batch.total, t('notification.progress', { done: batch.done, total: batch.total }));
    }
  }, [pending]);
};
