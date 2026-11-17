import {
  getConnectionInfo,
  reportPerformanceMetric,
  type ConnectionInfo,
} from './reporter';

type MetricName = 'CLS' | 'FCP' | 'INP' | 'LCP' | 'TTFB';
type MetricRating = 'good' | 'needs-improvement' | 'poor';

interface WebVitalMetric {
  id: string;
  type: 'web-vital';
  name: MetricName;
  value: number;
  rating: MetricRating;
  route: string;
  timestamp: number;
  navigationType: string;
  connection: ConnectionInfo;
}

const METRIC_LIMITS: Record<
  MetricName,
  { good: number; poor: number }
> = {
  CLS: { good: 0.1, poor: 0.25 },
  FCP: { good: 1800, poor: 3000 },
  INP: { good: 200, poor: 500 },
  LCP: { good: 2500, poor: 4000 },
  TTFB: { good: 800, poor: 1800 },
};

const EVENT_NAME = 'app:web-vital';
const REPORTED_KEYS = new Set<string>();
let monitoringStarted = false;

function getNavigationType() {
  if (typeof performance === 'undefined') {
    return 'unknown';
  }

  const navigationEntry = performance.getEntriesByType(
    'navigation',
  )[0] as PerformanceNavigationTiming | undefined;

  return navigationEntry?.type || 'navigate';
}

function getCurrentRoute() {
  if (typeof window === 'undefined') {
    return '/';
  }

  return `${window.location.pathname}${window.location.search}`;
}

function getMetricRating(name: MetricName, value: number): MetricRating {
  const thresholds = METRIC_LIMITS[name];
  if (value <= thresholds.good) {
    return 'good';
  }
  if (value > thresholds.poor) {
    return 'poor';
  }

  return 'needs-improvement';
}

function buildMetric(name: MetricName, value: number): WebVitalMetric {
  return {
    id: `${name}-${getCurrentRoute()}`,
    type: 'web-vital',
    name,
    value,
    rating: getMetricRating(name, value),
    route: getCurrentRoute(),
    timestamp: Date.now(),
    navigationType: getNavigationType(),
    connection: getConnectionInfo(),
  };
}

function reportMetric(name: MetricName, value: number) {
  if (typeof window === 'undefined') {
    return;
  }

  if (
    typeof document !== 'undefined' &&
    (name === 'FCP' || name === 'LCP') &&
    document.visibilityState !== 'visible'
  ) {
    return;
  }

  const route = getCurrentRoute();
  const reportKey = `${name}:${route}`;
  if (REPORTED_KEYS.has(reportKey)) {
    return;
  }
  REPORTED_KEYS.add(reportKey);

  const metric = buildMetric(name, value);
  reportPerformanceMetric(EVENT_NAME, metric, '[web-vital]');
}

function onPageHidden(callback: () => void) {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return () => {};
  }

  const handleVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      callback();
    }
  };

  window.addEventListener('pagehide', callback, { once: true });
  document.addEventListener('visibilitychange', handleVisibilityChange, {
    passive: true,
  });

  return () => {
    window.removeEventListener('pagehide', callback);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };
}

function observeFcp() {
  if (typeof PerformanceObserver === 'undefined') {
    return () => {};
  }

  const observer = new PerformanceObserver((list) => {
    const entry = list
      .getEntries()
      .find((candidate) => candidate.name === 'first-contentful-paint');
    if (!entry) {
      return;
    }

    reportMetric('FCP', entry.startTime);
    observer.disconnect();
  });

  observer.observe({ type: 'paint', buffered: true });
  return () => observer.disconnect();
}

function observeTtfb() {
  if (typeof performance === 'undefined') {
    return () => {};
  }

  const navigationEntry = performance.getEntriesByType(
    'navigation',
  )[0] as PerformanceNavigationTiming | undefined;
  if (!navigationEntry) {
    return () => {};
  }

  reportMetric('TTFB', navigationEntry.responseStart);
  return () => {};
}

function observeLcp() {
  if (typeof PerformanceObserver === 'undefined') {
    return () => {};
  }

  let lastLcp = 0;
  const observer = new PerformanceObserver((list) => {
    const entries = list.getEntries();
    const lastEntry = entries[entries.length - 1];
    if (lastEntry) {
      lastLcp = lastEntry.startTime;
    }
  });

  observer.observe({ type: 'largest-contentful-paint', buffered: true });
  const unsubscribe = onPageHidden(() => {
    if (lastLcp > 0) {
      reportMetric('LCP', lastLcp);
    }
    observer.disconnect();
  });

  return () => {
    unsubscribe();
    observer.disconnect();
  };
}

function observeCls() {
  if (typeof PerformanceObserver === 'undefined') {
    return () => {};
  }

  let cls = 0;
  const observer = new PerformanceObserver((list) => {
    list.getEntries().forEach((entry) => {
      const layoutShiftEntry = entry as PerformanceEntry & {
        value?: number;
        hadRecentInput?: boolean;
      };

      if (!layoutShiftEntry.hadRecentInput) {
        cls += layoutShiftEntry.value || 0;
      }
    });
  });

  observer.observe({ type: 'layout-shift', buffered: true });
  const unsubscribe = onPageHidden(() => {
    reportMetric('CLS', Number(cls.toFixed(4)));
    observer.disconnect();
  });

  return () => {
    unsubscribe();
    observer.disconnect();
  };
}

function observeInp() {
  if (typeof PerformanceObserver === 'undefined') {
    return () => {};
  }

  let maxInteractionLatency = 0;
  let observer: PerformanceObserver | null = null;

  try {
    observer = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        const eventEntry = entry as PerformanceEntry & {
          interactionId?: number;
          duration?: number;
        };

        if ((eventEntry.interactionId || 0) > 0) {
          maxInteractionLatency = Math.max(
            maxInteractionLatency,
            eventEntry.duration || 0,
          );
        }
      });
    });

    observer.observe({
      type: 'event',
      buffered: true,
      durationThreshold: 40,
    } as PerformanceObserverInit);
  } catch {
    observer = new PerformanceObserver((list) => {
      const firstInputEntry = list.getEntries()[0] as PerformanceEntry & {
        processingStart?: number;
      };

      if (!firstInputEntry) {
        return;
      }

      const processingStart = firstInputEntry.processingStart || 0;
      maxInteractionLatency = Math.max(
        maxInteractionLatency,
        processingStart - firstInputEntry.startTime,
      );
    });

    observer.observe({ type: 'first-input', buffered: true });
  }

  const unsubscribe = onPageHidden(() => {
    if (maxInteractionLatency > 0) {
      reportMetric('INP', maxInteractionLatency);
    }
    observer?.disconnect();
  });

  return () => {
    unsubscribe();
    observer?.disconnect();
  };
}

export function initPerformanceMonitoring() {
  if (monitoringStarted || typeof window === 'undefined') {
    return () => {};
  }

  monitoringStarted = true;
  const cleanups = [
    observeTtfb(),
    observeFcp(),
    observeLcp(),
    observeCls(),
    observeInp(),
  ];

  return () => {
    cleanups.forEach((cleanup) => cleanup());
  };
}
