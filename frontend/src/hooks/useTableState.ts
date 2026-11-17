import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

import { useTableStateCore } from './useTableStateCore';
import {
  areFiltersEqual as arePlainFiltersEqual,
  createDefaultFilters,
  createInitialFilters,
} from '../utils/filterUtils';
import type {
  AntTablePaginationLike,
  AntTableSorterLike,
  SearchFilters,
  SortOrder,
  TableStateCoreStrategies,
  UseTableStateOptions,
  UseTableStateResult,
} from '../types/table';

interface SearchStateRef {
  draft: string;
  applied: string;
}

interface SortStateRef {
  field: string;
  order: SortOrder;
}

interface SearchSortState {
  draftSearchTerm: string;
  appliedSearchTerm: string;
  sortField: string;
  sortOrder: SortOrder;
  setDraftSearchTerm: React.Dispatch<React.SetStateAction<string>>;
  setAppliedSearchTerm: React.Dispatch<React.SetStateAction<string>>;
  setSortField: React.Dispatch<React.SetStateAction<string>>;
  setSortOrder: React.Dispatch<React.SetStateAction<SortOrder>>;
  searchTermRef: React.MutableRefObject<SearchStateRef>;
  sortRef: React.MutableRefObject<SortStateRef>;
}

interface SyncSearchSortParams {
  defaultSortField: string;
  defaultSortOrder: SortOrder;
  syncUrl: boolean;
  isInternalUrlUpdateRef: React.MutableRefObject<boolean>;
  setDraftSearchTerm: React.Dispatch<React.SetStateAction<string>>;
  setAppliedSearchTerm: React.Dispatch<React.SetStateAction<string>>;
  setSortField: React.Dispatch<React.SetStateAction<string>>;
  setSortOrder: React.Dispatch<React.SetStateAction<SortOrder>>;
}

interface TableStateActionsParams {
  appliedSearchTerm: string;
  coreAppliedFilters: SearchFilters;
  coreDraftFilters: SearchFilters;
  defaultSortField: string;
  defaultSortOrder: SortOrder;
  draftSearchTerm: string;
  filterKeysRef: React.MutableRefObject<string[]>;
  onApplyRef: React.MutableRefObject<(() => void) | undefined>;
  resetCoreState: () => void;
  setAppliedFilters: React.Dispatch<React.SetStateAction<SearchFilters>>;
  setAppliedSearchTerm: React.Dispatch<React.SetStateAction<string>>;
  setDraftSearchTerm: React.Dispatch<React.SetStateAction<string>>;
  setPagination: React.Dispatch<
    React.SetStateAction<{ current: number; pageSize: number; total: number }>
  >;
  setSortField: React.Dispatch<React.SetStateAction<string>>;
  setSortOrder: React.Dispatch<React.SetStateAction<SortOrder>>;
}

function generateFiltersKey(filters: SearchFilters, filterKeys: string[]): string {
  return filterKeys
    .map((key) => {
      const values = filters[key] || [];
      return `${key}:${[...values].sort().join(',')}`;
    })
    .join('|');
}

function normalizeSortOrder(value: string | null | undefined): SortOrder {
  return value === 'desc' ? 'desc' : 'asc';
}

function readInitialSearchTerm(): string {
  if (typeof window === 'undefined') {
    return '';
  }

  const params = new URLSearchParams(window.location.search);
  return params.get('search') || '';
}

function readInitialSort(
  defaultSortField: string,
  defaultSortOrder: SortOrder,
): SortStateRef {
  if (typeof window === 'undefined') {
    return { field: defaultSortField, order: defaultSortOrder };
  }

  const params = new URLSearchParams(window.location.search);
  return {
    field: params.get('sortField') || defaultSortField,
    order: normalizeSortOrder(params.get('sortOrder') || defaultSortOrder),
  };
}

function cloneSearchFilters(filters: SearchFilters): SearchFilters {
  return Object.fromEntries(
    Object.entries(filters).map(([key, value]) => [key, [...value]]),
  ) as SearchFilters;
}

function buildTableStateStrategies(params: {
  defaultSortField: string;
  defaultSortOrder: SortOrder;
  filterKeysRef: React.MutableRefObject<string[]>;
  normalizersRef: React.MutableRefObject<Record<string, (value: unknown) => string>>;
  searchTermRef: React.MutableRefObject<SearchStateRef>;
  sortRef: React.MutableRefObject<SortStateRef>;
}): TableStateCoreStrategies<SearchFilters> {
  const {
    defaultSortField,
    defaultSortOrder,
    filterKeysRef,
    normalizersRef,
    searchTermRef,
    sortRef,
  } = params;

  return {
    parseFiltersFromUrl: (searchParams) =>
      createInitialFilters(searchParams, filterKeysRef.current) as SearchFilters,

    serializeFiltersToUrl: (filters, params) => {
      const { field, order } = sortRef.current;
      const { applied } = searchTermRef.current;

      if (field !== defaultSortField) {
        params.set('sortField', field);
      }
      if (order !== defaultSortOrder) {
        params.set('sortOrder', order);
      }
      if (applied.trim()) {
        params.set('search', applied.trim());
      }

      filterKeysRef.current.forEach((key) => {
        const values = filters[key] || [];
        [...values].sort().forEach((value) => {
          const normalizer = normalizersRef.current[key];
          const normalized = normalizer ? normalizer(value) : String(value);
          if (normalized) {
            params.append(key, normalized);
          }
        });
      });
    },

    areFiltersEqual: (draft, applied) => {
      const filtersEqual = arePlainFiltersEqual(
        draft,
        applied,
        filterKeysRef.current,
      );
      const { draft: draftSearch, applied: appliedSearch } = searchTermRef.current;
      return filtersEqual && draftSearch.trim() === appliedSearch.trim();
    },

    generateFiltersKey: (filters) => {
      const base = generateFiltersKey(filters, filterKeysRef.current);
      const { applied } = searchTermRef.current;
      const { field, order } = sortRef.current;
      return `${base}|search:${applied.trim()}|sort:${field}:${order}`;
    },

    createDefaultFilters: () =>
      createDefaultFilters(filterKeysRef.current) as SearchFilters,

    cloneFilters: cloneSearchFilters,
  };
}

function useSearchSortState(
  defaultSortField: string,
  defaultSortOrder: SortOrder,
): SearchSortState {
  const [draftSearchTerm, setDraftSearchTerm] = useState(readInitialSearchTerm);
  const [appliedSearchTerm, setAppliedSearchTerm] = useState(readInitialSearchTerm);
  const [sortField, setSortField] = useState(
    () => readInitialSort(defaultSortField, defaultSortOrder).field,
  );
  const [sortOrder, setSortOrder] = useState<SortOrder>(
    () => readInitialSort(defaultSortField, defaultSortOrder).order,
  );

  const searchTermRef = useRef<SearchStateRef>({
    draft: draftSearchTerm,
    applied: appliedSearchTerm,
  });
  searchTermRef.current = { draft: draftSearchTerm, applied: appliedSearchTerm };

  const sortRef = useRef<SortStateRef>({ field: sortField, order: sortOrder });
  sortRef.current = { field: sortField, order: sortOrder };

  return {
    draftSearchTerm,
    appliedSearchTerm,
    sortField,
    sortOrder,
    setDraftSearchTerm,
    setAppliedSearchTerm,
    setSortField,
    setSortOrder,
    searchTermRef,
    sortRef,
  };
}

function useSyncSearchSortFromUrl({
  defaultSortField,
  defaultSortOrder,
  syncUrl,
  isInternalUrlUpdateRef,
  setDraftSearchTerm,
  setAppliedSearchTerm,
  setSortField,
  setSortOrder,
}: SyncSearchSortParams): void {
  const location = useLocation();
  const isFirstMountRef = useRef(true);
  const prevLocationSearchRef = useRef(location.search);

  useEffect(() => {
    if (isFirstMountRef.current) {
      isFirstMountRef.current = false;
      return;
    }
    if (!syncUrl || isInternalUrlUpdateRef.current) {
      return;
    }
    if (location.search === prevLocationSearchRef.current) {
      return;
    }

    prevLocationSearchRef.current = location.search;

    const urlParams = new URLSearchParams(location.search);
    const newSearch = urlParams.get('search') || '';
    setDraftSearchTerm(newSearch);
    setAppliedSearchTerm(newSearch);
    setSortField(urlParams.get('sortField') || defaultSortField);
    setSortOrder(
      normalizeSortOrder(urlParams.get('sortOrder') || defaultSortOrder),
    );
  }, [
    defaultSortField,
    defaultSortOrder,
    isInternalUrlUpdateRef,
    location.search,
    setAppliedSearchTerm,
    setDraftSearchTerm,
    setSortField,
    setSortOrder,
    syncUrl,
  ]);
}

function useTableStateActions({
  appliedSearchTerm,
  coreAppliedFilters,
  coreDraftFilters,
  defaultSortField,
  defaultSortOrder,
  draftSearchTerm,
  filterKeysRef,
  onApplyRef,
  resetCoreState,
  setAppliedFilters,
  setAppliedSearchTerm,
  setDraftSearchTerm,
  setPagination,
  setSortField,
  setSortOrder,
}: TableStateActionsParams): Pick<
  UseTableStateResult,
  'applyFilters' | 'resetAll' | 'handleTableChange'
> {
  const applyFilters = useCallback(() => {
    const filtersEqual = arePlainFiltersEqual(
      coreDraftFilters,
      coreAppliedFilters,
      filterKeysRef.current,
    );
    const searchEqual = draftSearchTerm.trim() === appliedSearchTerm.trim();

    if (filtersEqual && searchEqual) {
      return;
    }

    setAppliedSearchTerm(draftSearchTerm);
    setAppliedFilters(cloneSearchFilters(coreDraftFilters));
    setPagination((prev) => ({ ...prev, current: 1 }));
    onApplyRef.current?.();
  }, [
    appliedSearchTerm,
    coreAppliedFilters,
    coreDraftFilters,
    draftSearchTerm,
    filterKeysRef,
    onApplyRef,
    setAppliedFilters,
    setAppliedSearchTerm,
    setPagination,
  ]);

  const resetAll = useCallback(() => {
    setDraftSearchTerm('');
    setAppliedSearchTerm('');
    setSortField(defaultSortField);
    setSortOrder(defaultSortOrder);
    resetCoreState();
  }, [
    defaultSortField,
    defaultSortOrder,
    resetCoreState,
    setAppliedSearchTerm,
    setDraftSearchTerm,
    setSortField,
    setSortOrder,
  ]);

  const handleTableChange = useCallback(
    (
      newPagination: AntTablePaginationLike,
      _tableFilters: unknown,
      sorter: AntTableSorterLike | AntTableSorterLike[],
    ) => {
      setPagination((prev) => ({
        ...prev,
        current: newPagination.current ?? prev.current,
        pageSize: newPagination.pageSize ?? prev.pageSize,
      }));

      const activeSorter = Array.isArray(sorter) ? sorter[0] : sorter;
      if (activeSorter?.field && activeSorter?.order) {
        setSortField(String(activeSorter.field));
        setSortOrder(activeSorter.order === 'ascend' ? 'asc' : 'desc');
        return;
      }

      setSortField(defaultSortField);
      setSortOrder(defaultSortOrder);
    },
    [
      defaultSortField,
      defaultSortOrder,
      setPagination,
      setSortField,
      setSortOrder,
    ],
  );

  return { applyFilters, resetAll, handleTableChange };
}

export function useTableState(
  options: UseTableStateOptions,
): UseTableStateResult {
  const {
    filterKeys,
    defaultSortField = 'id',
    defaultSortOrder = 'asc',
    defaultPageSize = 10,
    syncUrl = true,
    normalizers = {},
    onApply,
    onReset,
  } = options;

  const normalizersRef = useRef(normalizers);
  normalizersRef.current = normalizers;

  const filterKeysRef = useRef(filterKeys);
  filterKeysRef.current = filterKeys;

  const searchSortState = useSearchSortState(defaultSortField, defaultSortOrder);
  const {
    draftSearchTerm,
    appliedSearchTerm,
    sortField,
    sortOrder,
    setDraftSearchTerm,
    setAppliedSearchTerm,
    setSortField,
    setSortOrder,
    searchTermRef,
    sortRef,
  } = searchSortState;

  const strategies = useMemo(
    () =>
      buildTableStateStrategies({
        defaultSortField,
        defaultSortOrder,
        filterKeysRef,
        normalizersRef,
        searchTermRef,
        sortRef,
      }),
    [defaultSortField, defaultSortOrder, searchTermRef, sortRef],
  );

  const appliedSearchKey = appliedSearchTerm.trim();
  const sortKey = `${sortField}:${sortOrder}`;
  const core = useTableStateCore<SearchFilters>(
    {
      defaultPageSize,
      syncUrl,
      onApply,
      onReset,
      extraUrlDeps: [appliedSearchKey, sortKey],
    },
    strategies,
  );

  const {
    draftFilters: coreDraftFilters,
    appliedFilters: coreAppliedFilters,
    pagination,
    appliedFiltersKey,
    setDraftFilters,
    setAppliedFilters,
    setPagination,
    resetAll: resetCoreState,
    isInternalUrlUpdateRef,
    onApplyRef,
  } = core;

  useSyncSearchSortFromUrl({
    defaultSortField,
    defaultSortOrder,
    syncUrl,
    isInternalUrlUpdateRef,
    setDraftSearchTerm,
    setAppliedSearchTerm,
    setSortField,
    setSortOrder,
  });

  const { applyFilters, resetAll, handleTableChange } = useTableStateActions({
    appliedSearchTerm,
    coreAppliedFilters,
    coreDraftFilters,
    defaultSortField,
    defaultSortOrder,
    draftSearchTerm,
    filterKeysRef,
    onApplyRef,
    resetCoreState,
    setAppliedFilters,
    setAppliedSearchTerm,
    setDraftSearchTerm,
    setPagination,
    setSortField,
    setSortOrder,
  });

  const isDirty = useMemo(() => {
    const filtersEqual = arePlainFiltersEqual(
      coreDraftFilters,
      coreAppliedFilters,
      filterKeysRef.current,
    );
    const searchEqual = draftSearchTerm.trim() === appliedSearchTerm.trim();
    return !(filtersEqual && searchEqual);
  }, [appliedSearchTerm, coreAppliedFilters, coreDraftFilters, draftSearchTerm]);

  return {
    draftFilters: coreDraftFilters,
    appliedFilters: coreAppliedFilters,
    pagination,
    draftSearchTerm,
    appliedSearchTerm,
    sortField,
    sortOrder,
    isDirty,
    appliedFiltersKey,
    setDraftFilters,
    setDraftSearchTerm,
    setPagination,
    applyFilters,
    resetAll,
    handleTableChange,
  };
}

export default useTableState;
