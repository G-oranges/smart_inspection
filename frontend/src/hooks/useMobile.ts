import { useState, useEffect } from 'react';

/**
 * 移动端检测 Hook
 *
 * 使用 matchMedia API 监听断点变化，仅在实际跨越断点时触发一次更新，
 * 避免 resize 事件每秒 60+ 次触发导致全组件树重渲染。
 *
 * @param {number} breakpoint - 断点宽度，默认 768px
 * @returns {boolean} isMobile - 是否为移动端
 */
export function useMobile(breakpoint = 768): boolean {
  const [isMobile, setIsMobile] = useState(() => {
    // SSR 兼容：服务端渲染时默认返回 false
    if (typeof window === 'undefined') return false;
    return window.matchMedia(`(max-width: ${breakpoint - 1}px)`).matches;
  });

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);

    // 初始同步（处理 SSR hydration 不一致的情况）
    setIsMobile(mql.matches);

    // 仅在跨断点时触发，不会高频触发
    const handler = (e: MediaQueryListEvent) => {
      setIsMobile(e.matches);
    };

    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [breakpoint]);

  return isMobile;
}

export default useMobile;
