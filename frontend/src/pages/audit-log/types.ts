import type { Dispatch, SetStateAction } from 'react';
import type { Dayjs } from 'dayjs';

import type { EntityId, ServiceRecord } from '../../types/service';

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

export interface UseAuditLogActionsProps {
  filters: AuditLogFiltersState;
  pagination: AuditLogTablePagination;
  setPagination: Dispatch<SetStateAction<AuditLogTablePagination>>;
}

export interface AuditLogActionsResult {
  logs: AuditLogRecord[];
  loading: boolean;
  options: AuditLogOptions;
  stats: AuditLogStatsState;
  loadLogs: (page?: number, pageSize?: number) => Promise<void>;
  loadStats: () => Promise<void>;
  handleTableChange: (paginationConfig: {
    current?: number;
    pageSize?: number;
  }) => void;
  handleSearch: () => void;
}
