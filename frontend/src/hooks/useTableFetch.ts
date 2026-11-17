import { useCallback, useEffect, useRef, useState } from 'react';

import type { TableFetchOptions, TableFetchResult, TableResponse } from '../types/table';

export function useTableFetch<T>(
  options: TableFetchOptions<T>,
): TableFetchResult<T> {
  const {
    fetchFn,
    buildParams,
    enabled = true,
    onSuccess,
    onError,
    deps = [],
    keepPreviousData = false,
  } = options;

  const [data, setData] = useState<TableResponse<T>>({ items: [], total: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(false);

  const fetchIdRef = useRef(0);
  const activeControllerRef = useRef<AbortController | null>(null);

  // 通过 ref 存储回调函数，避免引用变化触发 doFetch 重建导致无限循环
  const fetchFnRef = useRef(fetchFn);
  const buildParamsRef = useRef(buildParams);
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);

  fetchFnRef.current = fetchFn;
  buildParamsRef.current = buildParams;
  onSuccessRef.current = onSuccess;
  onErrorRef.current = onError;

  const doFetch = useCallback(
    async (signal?: AbortSignal) => {
      const fetchId = ++fetchIdRef.current;

      if (!keepPreviousData) {
        setLoading(true);
      }
      setIsFetching(true);
      setError(null);

      try {
        const params = buildParamsRef.current();
        // 通过 ref 读取最新的 fetchFn，不参与依赖
        const result = await fetchFnRef.current(params, { signal });
        const isFresh = fetchId === fetchIdRef.current && !signal?.aborted;

        if (isFresh) {
          setData(result);
          onSuccessRef.current?.(result, true);
        }
      } catch (err) {
        if (signal?.aborted) {
          return;
        }

        if (fetchId === fetchIdRef.current) {
          const normalizedError = err instanceof Error
            ? err
            : new Error('请求失败');

          setError(normalizedError.message);
          setData({ items: [], total: 0 });
          onErrorRef.current?.(normalizedError);
        }
      } finally {
        if (fetchId === fetchIdRef.current && !signal?.aborted) {
          setLoading(false);
          setIsFetching(false);
        }
      }
    },
    [keepPreviousData],
  );

  const depsKey = JSON.stringify(deps);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    activeControllerRef.current?.abort();
    const controller = new AbortController();
    activeControllerRef.current = controller;

    void doFetch(controller.signal);

    return () => controller.abort();
  }, [depsKey, doFetch, enabled]);

  const refetch = useCallback(() => {
    activeControllerRef.current?.abort();
    const controller = new AbortController();
    activeControllerRef.current = controller;
    void doFetch(controller.signal);
  }, [doFetch]);

  return { data, loading, error, refetch, isFetching };
}
