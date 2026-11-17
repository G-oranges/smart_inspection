import { useCallback, useEffect, useRef, useState } from 'react';

export type ContextualStatsState =
  | 'EXPANDED'
  | 'COLLAPSED'
  | 'ARMED'
  | 'EXPANDING';

interface UseContextualStatsStateOptions {
  collapseThreshold?: number;
  armedExitThreshold?: number;
  desktopBurstDelayMs?: number;
  desktopBurstWindowMs?: number;
  desktopBurstThreshold?: number;
  mobilePullThreshold?: number;
  expansionDurationMs?: number;
  isMobile?: boolean;
  enabled?: boolean;
  getScrollContainer?: () => HTMLElement | null;
}

const DEFAULT_SCROLL_CONTAINER_SELECTOR = 'main.flex-1.overflow-y-auto';

function getNow(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }

  return Date.now();
}

function resolveDefaultScrollContainer(): HTMLElement | null {
  if (typeof document === 'undefined') {
    return null;
  }

  return document.querySelector(DEFAULT_SCROLL_CONTAINER_SELECTOR);
}

export function useContextualStatsState(
  options: UseContextualStatsStateOptions = {},
) {
  const {
    collapseThreshold = 80,
    armedExitThreshold = 12,
    desktopBurstDelayMs = 120,
    desktopBurstWindowMs = 180,
    desktopBurstThreshold = 48,
    mobilePullThreshold = 28,
    expansionDurationMs = 500,
    isMobile = false,
    enabled = true,
    getScrollContainer,
  } = options;

  const initialState = isMobile ? 'COLLAPSED' : 'EXPANDED';
  const [state, setState] = useState<ContextualStatsState>(initialState);
  const stateRef = useRef<ContextualStatsState>(initialState);
  const expandTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const armedAtRef = useRef(0);
  const lastWheelAtRef = useRef(0);
  const wheelAccumulatorRef = useRef(0);
  const touchStartYRef = useRef<number | null>(null);
  const touchPullDistanceRef = useRef(0);

  const clearExpandTimer = useCallback(() => {
    if (expandTimerRef.current) {
      clearTimeout(expandTimerRef.current);
      expandTimerRef.current = null;
    }
  }, []);

  const resetGestureState = useCallback(() => {
    lastWheelAtRef.current = 0;
    wheelAccumulatorRef.current = 0;
    touchStartYRef.current = null;
    touchPullDistanceRef.current = 0;
  }, []);

  const transitionTo = useCallback(
    (nextState: ContextualStatsState) => {
      if (stateRef.current === nextState) {
        return;
      }

      clearExpandTimer();

      if (nextState === 'ARMED') {
        armedAtRef.current = getNow();
      }

      if (nextState === 'EXPANDING') {
        resetGestureState();
        stateRef.current = nextState;
        setState(nextState);
        expandTimerRef.current = setTimeout(() => {
          stateRef.current = 'EXPANDED';
          setState('EXPANDED');
        }, expansionDurationMs);
        return;
      }

      if (nextState === 'COLLAPSED' || nextState === 'EXPANDED') {
        resetGestureState();
      }

      stateRef.current = nextState;
      setState(nextState);
    },
    [clearExpandTimer, expansionDurationMs, resetGestureState],
  );

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    if (!enabled) {
      clearExpandTimer();
      stateRef.current = initialState;
      setState(initialState);
      resetGestureState();
      return undefined;
    }

    const scrollContainer = getScrollContainer?.() ?? resolveDefaultScrollContainer();
    if (!scrollContainer) {
      return undefined;
    }

    const readScrollTop = () => Math.max(scrollContainer.scrollTop || 0, 0);

    const handleScroll = () => {
      const scrollTop = readScrollTop();
      const currentState = stateRef.current;

      if (currentState === 'EXPANDING') {
        return;
      }

      if (scrollTop >= collapseThreshold) {
        if (currentState === 'EXPANDED') {
          transitionTo('COLLAPSED');
        }
        return;
      }

      if (!isMobile && scrollTop === 0) {
        if (currentState === 'COLLAPSED') {
          transitionTo('ARMED');
        }
        return;
      }

      if (currentState === 'ARMED' && scrollTop > armedExitThreshold) {
        transitionTo('COLLAPSED');
      }
    };

    const handleWheel = (event: WheelEvent) => {
      if (isMobile || stateRef.current !== 'ARMED' || readScrollTop() !== 0) {
        return;
      }

      const now = getNow();
      if (now - armedAtRef.current < desktopBurstDelayMs) {
        return;
      }

      if (event.deltaY >= 0) {
        wheelAccumulatorRef.current = 0;
        lastWheelAtRef.current = now;
        return;
      }

      if (now - lastWheelAtRef.current > desktopBurstWindowMs) {
        wheelAccumulatorRef.current = 0;
      }

      wheelAccumulatorRef.current += event.deltaY;
      lastWheelAtRef.current = now;

      if (wheelAccumulatorRef.current <= -desktopBurstThreshold) {
        transitionTo('EXPANDING');
      }
    };

    const handleTouchStart = (event: TouchEvent) => {
      if (readScrollTop() !== 0 || !isMobile) {
        touchStartYRef.current = null;
        touchPullDistanceRef.current = 0;
        return;
      }

      if (stateRef.current === 'COLLAPSED') {
        transitionTo('ARMED');
      } else if (stateRef.current !== 'ARMED') {
        touchStartYRef.current = null;
        touchPullDistanceRef.current = 0;
        return;
      }

      if (event.touches.length === 0) {
        return;
      }

      const now = getNow();
      if (now < armedAtRef.current) {
        return;
      }

      touchStartYRef.current = event.touches[0].clientY;
      touchPullDistanceRef.current = 0;
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (
        !isMobile ||
        stateRef.current !== 'ARMED' ||
        touchStartYRef.current === null ||
        event.touches.length === 0
      ) {
        return;
      }

      if (readScrollTop() !== 0) {
        touchStartYRef.current = null;
        touchPullDistanceRef.current = 0;
        return;
      }

      const pullDistance = event.touches[0].clientY - touchStartYRef.current;
      if (pullDistance <= 0) {
        return;
      }

      touchPullDistanceRef.current = Math.max(
        touchPullDistanceRef.current,
        pullDistance,
      );

      if (touchPullDistanceRef.current >= mobilePullThreshold) {
        transitionTo('EXPANDING');
      }
    };

    const handleTouchEnd = () => {
      touchStartYRef.current = null;
      touchPullDistanceRef.current = 0;

      if (isMobile && stateRef.current === 'ARMED') {
        transitionTo('COLLAPSED');
      }
    };

    scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
    scrollContainer.addEventListener('wheel', handleWheel, { passive: true });
    scrollContainer.addEventListener('touchstart', handleTouchStart, {
      passive: true,
    });
    scrollContainer.addEventListener('touchmove', handleTouchMove, {
      passive: true,
    });
    scrollContainer.addEventListener('touchend', handleTouchEnd, {
      passive: true,
    });
    scrollContainer.addEventListener('touchcancel', handleTouchEnd, {
      passive: true,
    });

    handleScroll();

    return () => {
      clearExpandTimer();
      scrollContainer.removeEventListener('scroll', handleScroll);
      scrollContainer.removeEventListener('wheel', handleWheel);
      scrollContainer.removeEventListener('touchstart', handleTouchStart);
      scrollContainer.removeEventListener('touchmove', handleTouchMove);
      scrollContainer.removeEventListener('touchend', handleTouchEnd);
      scrollContainer.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [
    armedExitThreshold,
    clearExpandTimer,
    collapseThreshold,
    desktopBurstDelayMs,
    desktopBurstThreshold,
    desktopBurstWindowMs,
    enabled,
    getScrollContainer,
    initialState,
    isMobile,
    mobilePullThreshold,
    resetGestureState,
    transitionTo,
  ]);

  useEffect(() => () => clearExpandTimer(), [clearExpandTimer]);

  return {
    state,
    isCollapsed: state === 'COLLAPSED' || state === 'ARMED',
    isArmed: state === 'ARMED',
    isExpanded: state === 'EXPANDED',
    isExpanding: state === 'EXPANDING',
  };
}

export default useContextualStatsState;
