import {
  getConnectionInfo,
  reportPerformanceMetric,
  type ConnectionInfo,
} from './reporter';

type RouteTransitionRating = 'good' | 'needs-improvement' | 'poor';

export interface RouteTransitionMetric {
  id: string;
  type: 'route-transition';
  fromRoute: string | null;
  toRoute: string;
  value: number;
  rating: RouteTransitionRating;
  timestamp: number;
  navigationType: 'spa';
  connection: ConnectionInfo;
}

const EVENT_NAME = 'app:route-transition';

function getRouteTransitionRating(value: number): RouteTransitionRating {
  if (value <= 200) {
    return 'good';
  }
  if (value > 500) {
    return 'poor';
  }

  return 'needs-improvement';
}

function buildMetric(
  toRoute: string,
  fromRoute: string | null,
  value: number,
): RouteTransitionMetric {
  return {
    id: `route:${fromRoute || 'entry'}->${toRoute}:${Date.now()}`,
    type: 'route-transition',
    fromRoute,
    toRoute,
    value,
    rating: getRouteTransitionRating(value),
    timestamp: Date.now(),
    navigationType: 'spa',
    connection: getConnectionInfo(),
  };
}

function reportRouteTransitionMetric(metric: RouteTransitionMetric) {
  reportPerformanceMetric(EVENT_NAME, metric, '[route-transition]');
}

export function trackRouteTransition(
  toRoute: string,
  fromRoute: string | null = null,
) {
  if (typeof window === 'undefined' || typeof performance === 'undefined') {
    return () => {};
  }

  if (!fromRoute || fromRoute === toRoute) {
    return () => {};
  }

  if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
    return () => {};
  }

  const startedAt = performance.now();
  let frameIdOne = 0;
  let frameIdTwo = 0;
  let cancelled = false;

  frameIdOne = window.requestAnimationFrame(() => {
    frameIdTwo = window.requestAnimationFrame(() => {
      if (cancelled) {
        return;
      }

      const value = Number((performance.now() - startedAt).toFixed(2));
      reportRouteTransitionMetric(buildMetric(toRoute, fromRoute, value));
    });
  });

  return () => {
    cancelled = true;
    window.cancelAnimationFrame(frameIdOne);
    window.cancelAnimationFrame(frameIdTwo);
  };
}
