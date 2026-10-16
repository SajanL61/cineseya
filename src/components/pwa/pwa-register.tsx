'use client';

import { useEffect } from 'react';

export function PwaRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator) || process.env.NODE_ENV !== 'production') return;

    let refreshing = false;
    const refreshForNewWorker = () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener('controllerchange', refreshForNewWorker);
    navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).then((registration) => registration.update()).catch(() => {
      // The site remains fully usable when service workers are disabled or blocked.
    });

    return () => navigator.serviceWorker.removeEventListener('controllerchange', refreshForNewWorker);
  }, []);

  return null;
}
