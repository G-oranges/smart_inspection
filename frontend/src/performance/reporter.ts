export interface ConnectionInfo {
  effectiveType?: string;
  saveData?: boolean;
}

interface NavigatorWithConnection extends Navigator {
  connection?: ConnectionInfo;
  mozConnection?: ConnectionInfo;
  webkitConnection?: ConnectionInfo;
}

interface PerformanceMetricEnvelope {
  id: string;
  type: string;
  timestamp: number;
}

const GLOBAL_EVENT_NAME = 'app:performance-metric';
const STORAGE_KEY = 'app:performance-metrics';
const STORAGE_VERSION_KEY = 'app:performance-metrics:version';
const STORAGE_VERSION = '2';
const STORAGE_LIMIT = 50;

function getSampleRate() {
  const rawValue = Number(import.meta.env.VITE_WEB_VITALS_SAMPLE_RATE ?? 1);
  if (!Number.isFinite(rawValue)) {
    return 1;
  }

  return Math.min(1, Math.max(0, rawValue));
}

export function getConnectionInfo(): ConnectionInfo {
  if (typeof navigator === 'undefined') {
    return {};
  }

  const connection =
    (navigator as NavigatorWithConnection).connection ||
    (navigator as NavigatorWithConnection).mozConnection ||
    (navigator as NavigatorWithConnection).webkitConnection;

  if (!connection) {
    return {};
  }

  return {
    effectiveType: connection.effectiveType,
    saveData: connection.saveData,
  };
}

function shouldReportMetric() {
  if (import.meta.env.DEV) {
    return true;
  }

  return Math.random() <= getSampleRate();
}

function persistMetric(metric: PerformanceMetricEnvelope) {
  if (typeof sessionStorage === 'undefined') {
    return;
  }

  try {
    const metrics = readStoredPerformanceMetrics<PerformanceMetricEnvelope>();
    const nextMetrics = [...metrics, metric].slice(-STORAGE_LIMIT);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(nextMetrics));
    sessionStorage.setItem(STORAGE_VERSION_KEY, STORAGE_VERSION);
  } catch {
    // Ignore storage write failures.
  }
}

export function readStoredPerformanceMetrics<T extends PerformanceMetricEnvelope>() {
  if (typeof sessionStorage === 'undefined') {
    return [] as T[];
  }

  try {
    const currentVersion = sessionStorage.getItem(STORAGE_VERSION_KEY);
    if (currentVersion !== STORAGE_VERSION) {
      sessionStorage.removeItem(STORAGE_KEY);
      sessionStorage.setItem(STORAGE_VERSION_KEY, STORAGE_VERSION);
      return [] as T[];
    }

    const current = sessionStorage.getItem(STORAGE_KEY);
    const metrics = current ? (JSON.parse(current) as T[]) : [];

    return metrics.filter(
      (metric) =>
        metric &&
        typeof metric === 'object' &&
        typeof metric.id === 'string' &&
        typeof metric.type === 'string' &&
        typeof metric.timestamp === 'number',
    );
  } catch {
    return [] as T[];
  }
}

export function clearStoredPerformanceMetrics() {
  if (typeof sessionStorage === 'undefined') {
    return;
  }

  try {
    sessionStorage.removeItem(STORAGE_KEY);
    sessionStorage.setItem(STORAGE_VERSION_KEY, STORAGE_VERSION);
  } catch {
    // Ignore storage write failures.
  }
}

export function initializePerformanceReporter() {
  if (typeof sessionStorage === 'undefined') {
    return;
  }

  try {
    const currentVersion = sessionStorage.getItem(STORAGE_VERSION_KEY);
    if (currentVersion !== STORAGE_VERSION) {
      sessionStorage.removeItem(STORAGE_KEY);
      sessionStorage.setItem(STORAGE_VERSION_KEY, STORAGE_VERSION);
    }
  } catch {
    // Ignore storage initialization failures.
  }
}

export function subscribeToPerformanceMetrics<T extends PerformanceMetricEnvelope>(
  listener: (metric: T) => void,
) {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handleMetric = (event: Event) => {
    const customEvent = event as CustomEvent<T>;
    if (customEvent.detail) {
      listener(customEvent.detail);
    }
  };

  window.addEventListener(GLOBAL_EVENT_NAME, handleMetric as EventListener);

  return () => {
    window.removeEventListener(GLOBAL_EVENT_NAME, handleMetric as EventListener);
  };
}

function sendMetric(metric: PerformanceMetricEnvelope) {
  const endpoint = import.meta.env.VITE_WEB_VITALS_ENDPOINT;
  if (!endpoint || typeof navigator === 'undefined' || typeof Blob === 'undefined') {
    return;
  }

  if (typeof navigator.sendBeacon === 'function') {
    const payload = new Blob([JSON.stringify(metric)], {
      type: 'application/json',
    });
    navigator.sendBeacon(endpoint, payload);
  }
}

export function reportPerformanceMetric<T extends PerformanceMetricEnvelope>(
  eventName: string,
  metric: T,
  devLabel: string,
) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent<T>(eventName, {
        detail: metric,
      }),
    );
    window.dispatchEvent(
      new CustomEvent<T>(GLOBAL_EVENT_NAME, {
        detail: metric,
      }),
    );
  }

  persistMetric(metric);

  if (import.meta.env.DEV) {
    console.info(devLabel, metric);
  }

  if (!shouldReportMetric()) {
    return;
  }

  sendMetric(metric);
}
