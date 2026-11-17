import {
  clearStoredPerformanceMetrics,
  readStoredPerformanceMetrics,
  subscribeToPerformanceMetrics,
} from './reporter';

interface PerformanceDebugApi {
  read: typeof readStoredPerformanceMetrics;
  clear: typeof clearStoredPerformanceMetrics;
  subscribe: typeof subscribeToPerformanceMetrics;
}

declare global {
  interface Window {
    __appPerformance?: PerformanceDebugApi;
  }
}

export function installPerformanceDebugTools() {
  if (!import.meta.env.DEV || typeof window === 'undefined') {
    return;
  }

  window.__appPerformance = {
    read: readStoredPerformanceMetrics,
    clear: clearStoredPerformanceMetrics,
    subscribe: subscribeToPerformanceMetrics,
  };

  console.info(
    '[performance-debug] window.__appPerformance.read() / clear() / subscribe() 已可用',
  );
}
