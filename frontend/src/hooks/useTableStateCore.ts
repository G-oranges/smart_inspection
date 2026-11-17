import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';

import type {
  PaginationState,
  TableStateCoreOptions,
  TableStateCoreResult,
  TableStateCoreStrategies,
} from '../types/table';

export function useTableStateCore<TFilters>(
  options: TableStateCoreOptions = {},
  strategies: TableStateCoreStrategies<TFilters>,
): TableStateCoreResult<TFilters> {
  const {
    defaultPageSize = 10,
    syncUrl = true,
    onApply,
    onReset,
    extraUrlDeps = [],
  } = options;

  const [searchParams, setSearchParams] = useSearchParams();

  const onApplyRef = useRef(onApply);
  const onResetRef = useRef(onReset);
  onApplyRef.current = onApply;
  onResetRef.current = onReset;

  const strategiesRef = useRef(strategies);
  strategiesRef.current = strategies;

  const [draftFilters, setDraftFilters] = useState<TFilters>(() =>
    strategies.parseFiltersFromUrl(searchParams),
  );
  const [appliedFilters, setAppliedFilters] = useState<TFilters>(() =>
    strategies.parseFiltersFromUrl(searchParams),
  );
  const [pagination, setPagination] = useState<PaginationState>({
    current: Number(searchParams.get('page')) || 1,
    pageSize: Number(searchParams.get('pageSize')) || defaultPageSize,
    total: 0,
  });

  const appliedFiltersRef = useRef(appliedFilters);
  appliedFiltersRef.current = appliedFilters;

  const appliedFiltersKey = useMemo(
    () => strategiesRef.current.generateFiltersKey(appliedFilters),
    [appliedFilters],
  );

  const isDirty = useMemo(
    () => !strategiesRef.current.areFiltersEqual(draftFilters, appliedFilters),
    [appliedFilters, draftFilters],
  );

  const isInternalUrlUpdateRef = useRef(false);
  const prevUrlRef = useRef('');
  const extraUrlDepsKey = JSON.stringify(extraUrlDeps);
  const currentPage = pagination.current;
  const pageSize = pagination.pageSize;

  useEffect(() => {
    if (!syncUrl) {
      return;
    }

    const params = new URLSearchParams();

    if (currentPage !== 1) {
      params.set('page', String(currentPage));
    }
    if (pageSize !== defaultPageSize) {
      params.set('pageSize', String(pageSize));
    }

    strategiesRef.current.serializeFiltersToUrl(
      appliedFiltersRef.current,
      params,
      { defaultPageSize },
    );

    const newUrl = params.toString();
    if (newUrl === prevUrlRef.current) {
      return;
    }
    prevUrlRef.current = newUrl;

    isInternalUrlUpdateRef.current = true;
    setSearchParams(params, { replace: true });

    requestAnimationFrame(() => {
      isInternalUrlUpdateRef.current = false;
    });
  }, [
    appliedFiltersKey,
    currentPage,
    defaultPageSize,
    extraUrlDepsKey,
    pageSize,
    setSearchParams,
    syncUrl,
  ]);

  const location = useLocation();
  const isFirstMountRef = useRef(true);
  const prevLocationSearchRef = useRef(location.search);

  useEffect(() => {
    if (isFirstMountRef.current) {
      isFirstMountRef.current = false;
      return;
    }

    if (!syncUrl) {
      return;
    }
    if (isInternalUrlUpdateRef.current) {
      return;
    }
    if (location.search === prevLocationSearchRef.current) {
      return;
    }
    prevLocationSearchRef.current = location.search;

    const urlParams = new URLSearchParams(location.search);
    const newFilters = strategiesRef.current.parseFiltersFromUrl(urlParams);
    setDraftFilters(newFilters);
    setAppliedFilters(newFilters);

    setPagination((prev) => ({
      ...prev,
      current: Number(urlParams.get('page')) || 1,
      pageSize: Number(urlParams.get('pageSize')) || defaultPageSize,
    }));
  }, [defaultPageSize, location.search, syncUrl]);

  const applyFilters = useCallback(() => {
    if (!strategiesRef.current.areFiltersEqual(draftFilters, appliedFilters)) {
      const clonedFilters = strategiesRef.current.cloneFilters(draftFilters);
      setAppliedFilters(clonedFilters);
      setPagination((prev) => ({ ...prev, current: 1 }));
      onApplyRef.current?.();
    }
  }, [appliedFilters, draftFilters]);

  const resetAll = useCallback(() => {
    const defaultFilters = strategiesRef.current.createDefaultFilters();
    setDraftFilters(defaultFilters);
    setAppliedFilters(defaultFilters);
    setPagination((prev) => ({
      ...prev,
      current: 1,
      pageSize: defaultPageSize,
    }));
    onResetRef.current?.();
  }, [defaultPageSize]);

  return {
    draftFilters,
    appliedFilters,
    pagination,
    isDirty,
    appliedFiltersKey,
    setDraftFilters,
    setAppliedFilters,
    setPagination,
    applyFilters,
    resetAll,
    strategiesRef,
    onApplyRef,
    onResetRef,
    isInternalUrlUpdateRef,
  };
}
