import { useCallback, useEffect, useState } from 'react';

import { request, tokenManager } from '../../utils/api';

import type {
  AuditLogActionsResult,
  AuditLogFiltersState,
  AuditLogListResponse,
  AuditLogOptions,
  AuditLogRecord,
  AuditLogStatsState,
  UseAuditLogActionsProps,
} from './types';

function buildAuditLogQuery({
  filters,
  page,
  pageSize,
}: {
  filters: AuditLogFiltersState;
  page?: number;
  pageSize?: number;
}): string {
  const searchParams = new URLSearchParams();
  if (page !== undefined) {
    searchParams.set('page', String(page));
  }
  if (pageSize !== undefined) {
    searchParams.set('pageSize', String(pageSize));
  }

  filters.action.forEach((value) => searchParams.append('action', value));
  filters.module.forEach((value) => searchParams.append('module', value));

  if (filters.keyword) {
    searchParams.set('keyword', filters.keyword);
  }
  if (filters.dateRange && filters.dateRange.length === 2) {
    searchParams.set('dateFrom', filters.dateRange[0].toISOString());
    searchParams.set('dateTo', filters.dateRange[1].toISOString());
  }

  return searchParams.toString();
}

export function useAuditLogActions({
  filters,
  pagination,
  setPagination,
}: UseAuditLogActionsProps): AuditLogActionsResult {
  const [logs, setLogs] = useState<AuditLogRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [options, setOptions] = useState<AuditLogOptions>({
    actions: [],
    modules: [],
  });
  const [stats, setStats] = useState<AuditLogStatsState>({
    total: 0,
    byAction: [],
    byModule: [],
  });

  const loadOptions = useCallback(async (): Promise<void> => {
    if (!tokenManager.hasTokens()) {
      return;
    }
    try {
      const data = await request<AuditLogOptions>('/api/audit-logs/options');
      setOptions({
        actions: Array.isArray(data?.actions) ? data.actions : [],
        modules: Array.isArray(data?.modules) ? data.modules : [],
      });
    } catch (error) {
      console.error('加载筛选选项失败:', error);
    }
  }, []);

  const loadStats = useCallback(async (): Promise<void> => {
    if (!tokenManager.hasTokens()) {
      return;
    }
    try {
      const queryString = buildAuditLogQuery({ filters, page: undefined, pageSize: undefined });
      const data = await request<AuditLogStatsState>(
        `/api/audit-logs/stats${queryString ? `?${queryString}` : ''}`,
      );
      setStats({
        total: Number(data?.total) || 0,
        byAction: Array.isArray(data?.byAction) ? data.byAction : [],
        byModule: Array.isArray(data?.byModule) ? data.byModule : [],
      });
    } catch (error) {
      console.error('加载统计数据失败:', error);
    }
  }, [filters]);

  const loadLogs = useCallback(
    async (page = 1, pageSize = 20): Promise<void> => {
      if (!tokenManager.hasTokens()) {
        return;
      }
      setLoading(true);
      setError('');
      try {
        const queryString = buildAuditLogQuery({ filters, page, pageSize });
        const data = await request<AuditLogListResponse>(
          `/api/audit-logs?${queryString}`,
        );
        setLogs(Array.isArray(data?.items) ? data.items : []);
        setPagination({
          current: Number(data?.page) || page,
          pageSize: Number(data?.pageSize) || pageSize,
          total: Number(data?.total) || 0,
        });
      } catch (err) {
        console.error('加载审计日志失败:', err);
        setLogs([]);
        setError(
          err instanceof Error && err.message.trim()
            ? err.message
            : '加载审计日志失败，请重试',
        );
      } finally {
        setLoading(false);
      }
    },
    [filters, setPagination],
  );

  useEffect(() => {
    void loadOptions();
  }, [loadOptions]);

  const handleTableChange = (paginationConfig: {
    current?: number;
    pageSize?: number;
  }): void => {
    void loadLogs(paginationConfig.current, paginationConfig.pageSize);
  };

  const handleSearch = (): void => {
    void loadLogs(1, pagination.pageSize);
  };

  return {
    logs,
    loading,
    error,
    options,
    stats,
    loadLogs,
    loadStats,
    handleTableChange,
    handleSearch,
  };
}
