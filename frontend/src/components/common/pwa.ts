import { useEffect, useState } from 'react';

declare global {
  interface Window {
    __pwa_registered?: boolean;
    __pwaUpdateSW?: (reloadPage?: boolean) => Promise<void> | void;
  }

  interface Navigator {
    standalone?: boolean;
  }
}

export const isServiceWorkerSupported = 'serviceWorker' in navigator;

export function isPWAInstalled(): boolean {
  if (window.matchMedia('(display-mode: standalone)').matches) {
    return true;
  }

  return window.navigator.standalone === true;
}

export function usePWAStatus() {
  const [isInstalled, setIsInstalled] = useState(isPWAInstalled);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleDisplayModeChange = (event: MediaQueryListEvent) => {
      setIsInstalled(event.matches);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    mediaQuery.addEventListener?.('change', handleDisplayModeChange);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      mediaQuery.removeEventListener?.('change', handleDisplayModeChange);
    };
  }, []);

  return { isInstalled, isOnline };
}

export {};
