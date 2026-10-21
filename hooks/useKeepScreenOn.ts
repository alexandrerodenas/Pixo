import { useEffect } from 'react';

// Keeps the screen on while `active` (photos are being analysed), so Android does not put the
// app to sleep in the middle of a long run. Released as soon as it is no longer needed.
export const useKeepScreenOn = (active: boolean) => {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;

    const acquire = () => {
      navigator.wakeLock.request('screen')
        .then(sentinel => {
          if (cancelled) sentinel.release();
          else lock = sentinel;
        })
        .catch(() => { /* refused (battery saver, hidden tab): analysis still works */ });
    };
    // The system drops the lock when the page is hidden, so take it again when it comes back
    const onVisible = () => { if (document.visibilityState === 'visible' && !lock) acquire(); };

    acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      lock?.release();
    };
  }, [active]);
};
