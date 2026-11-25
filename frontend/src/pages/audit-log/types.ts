import type { Dispatch, SetStateAction } from 'react';
import type { Dayjs } from 'dayjs';

import type { EntityId, ServiceRecord } from '../../types/service';

export interface AuditLogColumnConfig {
  fieldKey: string;
  label: string;
  visible: boolean;
  sortable: boolean;
  order: number;
  [key: string]: unknown;
}

export interface AuditLogOption {
  value: string;
  label: string;
}

export interface AuditLogOptions {
  actions: AuditLogOption[];
  modules: AuditLogOption[];
}

export interface AuditLogStatBucket extends ServiceRecord {
  action?: string;
  module?: string;
  count?: number;
}

export interface AuditLogStatsState {
  total: number;
  byAction: AuditLogStatBucket[];
  byModule: AuditLogStatBucket[];
}

export interface AuditLogOperator extends ServiceRecord {
  id?: EntityId;
  username?: string;
  fullName?: string;
}

export interface AuditLogRecord extends ServiceRecord {
  id?: EntityId;
  createdAt?: string;
  action?: string;
  module?: string;
  description?: string;
  targetName?: string;
  operatorName?: string;
  operator?: AuditLogOperator;
  ipAddress?: string;
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
}

export interface AuditLogTablePagination {
  current: number;
  pageSize: number;
  total: number;
}

export interface AuditLogFiltersState {
  action: string[];
  module: string[];
  keyword: string;
  dateRange: [Dayjs, Dayjs] | null;
}

export interface AuditLogListResponse {
  items?: AuditLogRecord[];
  page?: number;
  pageSize?: number;
  total?: number;
}

export interface AuditLogSorterInput {
  field?: string;
  columnKey?: string;
  order?: 'ascend' | 'descend' | null;
}

export interface UseAuditLogActionsProps {
  filters: AuditLogFiltersState;
  pagination: AuditLogTablePagination;
  setPagination: Dispatch<SetStateAction<AuditLogTablePagination>>;
  sortField: string;
  sortOrder: 'asc' | 'desc';
  setSortField: Dispatch<SetStateAction<string>>;
  setSortOrder: Dispatch<SetStateAction<'asc' | 'desc'>>;
}

export interface AuditLogActionsResult {
  logs: AuditLogRecord[];
  loading: boolean;
  error: string;
  options: AuditLogOptions;
  stats: AuditLogStatsState;
  loadLogs: (
    page?: number,
    pageSize?: number,
    nextSortField?: string,
    nextSortOrder?: 'asc' | 'desc',
  ) => Promise<void>;
  loadStats: () => Promise<void>;
  handleTableChange: (
    paginationConfig: {
      current?: number;
      pageSize?: number;
    },
    _filters?: unknown,
    sorter?: AuditLogSorterInput | AuditLogSorterInput[],
  ) => void;
  handleSearch: () => void;
}
