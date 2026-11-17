import type {
  Dispatch,
  MutableRefObject,
  SetStateAction,
} from 'react';

export interface TableResponse<T> {
  items: T[];
  total: number;
}

export interface PaginationState {
  current: number;
  pageSize: number;
  total: number;
}

export type SortOrder = 'asc' | 'desc';
export type SearchFilters = Record<string, string[]>;

export interface TableFetchOptions<T> {
  fetchFn: (
    params: Record<string, unknown>,
    opts?: { signal?: AbortSignal },
  ) => Promise<TableResponse<T>>;
  buildParams: () => Record<string, unknown>;
  enabled?: boolean;
  onSuccess?: (data: TableResponse<T>, isFresh: boolean) => void;
  onError?: (error: Error) => void;
  deps?: readonly (string | number | boolean | null | undefined)[];
  keepPreviousData?: boolean;
}

export interface TableFetchResult<T> {
  data: TableResponse<T>;
  loading: boolean;
  error: string | null;
  refetch: () => void;
  isFetching: boolean;
}

export interface SerializeFiltersOptions {
  defaultPageSize: number;
}

export interface TableStateCoreOptions {
  defaultPageSize?: number;
  syncUrl?: boolean;
  onApply?: () => void;
  onReset?: () => void;
  extraUrlDeps?: readonly unknown[];
}

export interface TableStateCoreStrategies<TFilters> {
  parseFiltersFromUrl: (searchParams: URLSearchParams) => TFilters;
  serializeFiltersToUrl: (
    filters: TFilters,
    params: URLSearchParams,
    options: SerializeFiltersOptions,
  ) => void;
  areFiltersEqual: (draft: TFilters, applied: TFilters) => boolean;
  generateFiltersKey: (filters: TFilters) => string;
  createDefaultFilters: () => TFilters;
  cloneFilters: (filters: TFilters) => TFilters;
}

export interface TableStateCoreResult<TFilters> {
  draftFilters: TFilters;
  appliedFilters: TFilters;
  pagination: PaginationState;
  isDirty: boolean;
  appliedFiltersKey: string;
  setDraftFilters: Dispatch<SetStateAction<TFilters>>;
  setAppliedFilters: Dispatch<SetStateAction<TFilters>>;
  setPagination: Dispatch<SetStateAction<PaginationState>>;
  applyFilters: () => void;
  resetAll: () => void;
  strategiesRef: MutableRefObject<TableStateCoreStrategies<TFilters>>;
  onApplyRef: MutableRefObject<(() => void) | undefined>;
  onResetRef: MutableRefObject<(() => void) | undefined>;
  isInternalUrlUpdateRef: MutableRefObject<boolean>;
}

export interface AntTablePaginationLike {
  current?: number;
  pageSize?: number;
}

export interface AntTableSorterLike {
  field?: string | number | symbol;
  order?: 'ascend' | 'descend' | null;
}

export interface UseTableStateOptions {
  filterKeys: string[];
  defaultSortField?: string;
  defaultSortOrder?: SortOrder;
  defaultPageSize?: number;
  syncUrl?: boolean;
  normalizers?: Record<string, (value: unknown) => string>;
  onApply?: () => void;
  onReset?: () => void;
}

export interface UseTableStateResult {
  draftFilters: SearchFilters;
  appliedFilters: SearchFilters;
  pagination: PaginationState;
  draftSearchTerm: string;
  appliedSearchTerm: string;
  sortField: string;
  sortOrder: SortOrder;
  isDirty: boolean;
  appliedFiltersKey: string;
  setDraftFilters: Dispatch<SetStateAction<SearchFilters>>;
  setDraftSearchTerm: Dispatch<SetStateAction<string>>;
  setPagination: Dispatch<SetStateAction<PaginationState>>;
  applyFilters: () => void;
  resetAll: () => void;
  handleTableChange: (
    newPagination: AntTablePaginationLike,
    _tableFilters: unknown,
    sorter: AntTableSorterLike | AntTableSorterLike[],
  ) => void;
}
