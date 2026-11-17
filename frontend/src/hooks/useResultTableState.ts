import dayjs from 'dayjs';
import { useMemo } from 'react';

import { useTableStateCore } from './useTableStateCore';
import {
  areResultFiltersEqual,
  generateResultFiltersKey,
} from '../utils/filterUtils';
import {
  INITIAL_FILTERS,
  RESULT_DEFAULT_SORT,
  RESULT_FILTER_KEYS,
} from '../pages/result/resultSchema';
import type { ResultFiltersState } from '../pages/result/types';

interface UseResultTableStateOptions {
  defaultPageSize?: number;
  syncUrl?: boolean;
  onApply?: () => void;
  onReset?: () => void;
}

function parseFiltersFromUrl(searchParams: URLSearchParams): ResultFiltersState {
  const filters = { ...INITIAL_FILTERS } as ResultFiltersState;

  RESULT_FILTER_KEYS.forEach((key) => {
    const values = searchParams.getAll(key);
    if (values.length > 0) {
        filters[key] = values;
      }
  });

  const keyword = searchParams.get('keyword');
  if (keyword) {
    filters.keyword = keyword;
  }

  const dateFrom = searchParams.get('dateFrom');
  const dateTo = searchParams.get('dateTo');
  if (dateFrom && dateTo) {
    filters.dateRange = [dayjs(dateFrom), dayjs(dateTo)];
  }

  const sort = searchParams.get('sort');
  if (sort) {
        filters.sort = sort;
  }

  return filters;
}

export function useResultTableState(
  options: UseResultTableStateOptions = {},
) {
  const {
    defaultPageSize = 10,
    syncUrl = true,
    onApply,
    onReset,
  } = options;

  const strategies = useMemo(
    () => ({
      parseFiltersFromUrl,

      serializeFiltersToUrl: (
        filters: ResultFiltersState,
        params: URLSearchParams,
      ) => {
        RESULT_FILTER_KEYS.forEach((key) => {
          const values = (filters[key] as string[] | undefined) || [];
          [...values].sort().forEach((value) => {
            if (value) {
              params.append(key, String(value));
            }
          });
        });

        if (filters.keyword?.trim()) {
          params.set('keyword', filters.keyword.trim());
        }

        const dateRange = filters.dateRange;
        if (
          Array.isArray(dateRange) &&
          dateRange.length === 2 &&
          dateRange[0] &&
          dateRange[1]
        ) {
          params.set('dateFrom', dateRange[0].format('YYYY-MM-DD'));
          params.set('dateTo', dateRange[1].format('YYYY-MM-DD'));
        }

        if (filters.sort && filters.sort !== INITIAL_FILTERS.sort) {
          params.set('sort', filters.sort);
        }
      },

      areFiltersEqual: (draft: ResultFiltersState, applied: ResultFiltersState) =>
        areResultFiltersEqual(draft, applied, RESULT_FILTER_KEYS, {
          defaultSort: RESULT_DEFAULT_SORT,
        }),

      generateFiltersKey: (filters: ResultFiltersState) =>
        generateResultFiltersKey(
          filters,
          RESULT_FILTER_KEYS,
          RESULT_DEFAULT_SORT,
        ),

      createDefaultFilters: (): ResultFiltersState => ({
        ...INITIAL_FILTERS,
        keyword: '',
        dateRange: [],
        taskId: [],
        grade: [],
        college: [],
        level: [],
        gender: [],
      }),

      cloneFilters: (filters: ResultFiltersState): ResultFiltersState => ({
        ...filters,
        keyword: filters.keyword || '',
        taskId: [...(filters.taskId || [])],
        grade: [...(filters.grade || [])],
        college: [...(filters.college || [])],
        level: [...(filters.level || [])],
        gender: [...(filters.gender || [])],
        dateRange: filters.dateRange ? [...filters.dateRange] : [],
      }),
    }),
    [],
  );

  const core = useTableStateCore<ResultFiltersState>(
    {
      defaultPageSize,
      syncUrl,
      onApply,
      onReset,
    },
    strategies,
  );

  return {
    draftFilters: core.draftFilters,
    appliedFilters: core.appliedFilters,
    pagination: core.pagination,
    isDirty: core.isDirty,
    appliedFiltersKey: core.appliedFiltersKey,
    setDraftFilters: core.setDraftFilters,
    setPagination: core.setPagination,
    applyFilters: core.applyFilters,
    resetAll: core.resetAll,
    RESULT_FILTER_KEYS,
    INITIAL_FILTERS,
  };
}
