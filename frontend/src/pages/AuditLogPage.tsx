import { useEffect, useState } from 'react';
import { Button, FloatButton } from 'antd';

import { useAppContext } from '../context/AppContext';
import PageLayout from '../components/PageLayout';
import ResponsiveDataView from '../components/ResponsiveDataView';
import TableFieldSettings from '../components/TableFieldSettings';
import CollapsibleStatsBoard from '../components/stats/CollapsibleStatsBoard';
import { useMobile } from '../hooks/useMobile';
import { useTableColumns } from '../hooks/useTableColumns';
import {
  AUDIT_LOG_DEFAULT_COLUMNS,
  AUDIT_LOG_TABLE_KEY,
  AuditLogFilters,
  AuditLogMobileCard,
  AuditLogStats,
  AuditLogTable,
  mapAuditLogStatsToSegments,
  useAuditLogActions,
} from './audit-log';

import type {
  AuditLogColumnConfig,
  AuditLogFiltersState,
  AuditLogRecord,
  AuditLogTablePagination,
} from './audit-log/types';

const INITIAL_PAGINATION: AuditLogTablePagination = {
  current: 1,
  pageSize: 20,
  total: 0,
};

const INITIAL_FILTERS: AuditLogFiltersState = {
  action: [],
  module: [],
  keyword: '',
  dateRange: null,
};

export default function AuditLogPage() {
  const { actions } = useAppContext();
  const isMobile = useMobile();
  const [pagination, setPagination] = useState(INITIAL_PAGINATION);
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sortField, setSortField] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const fetchTableConfig = actions.fetchTableConfig as
    | ((tableKey: string) => Promise<{ config?: AuditLogColumnConfig[] } | null | undefined>)
    | undefined;
  const saveTableConfig = actions.saveTableConfig as
    | ((tableKey: string, columns: AuditLogColumnConfig[]) => Promise<unknown>)
    | undefined;

  const {
    columns: auditColumns,
    visibleColumns: visibleAuditColumns,
    save: saveAuditColumns,
    resetToDefault: resetAuditColumns,
    saving: savingAuditColumns,
  } = useTableColumns<AuditLogColumnConfig>({
    tableKey: AUDIT_LOG_TABLE_KEY,
    defaultColumns: AUDIT_LOG_DEFAULT_COLUMNS,
    fetchConfig: fetchTableConfig
      ? async (tableKey) => fetchTableConfig(tableKey)
      : undefined,
    saveConfig: saveTableConfig
      ? async (tableKey, columns) => saveTableConfig(tableKey, columns)
      : undefined,
  });

  const {
    logs,
    loading,
    error,
    options,
    stats,
    loadLogs,
    loadStats,
    handleTableChange,
    handleSearch,
  } = useAuditLogActions({
    filters,
    pagination,
    setPagination,
    sortField,
    sortOrder,
    setSortField,
    setSortOrder,
  });

  useEffect(() => {
    void loadLogs(1, pagination.pageSize);
  }, [filters, loadLogs, pagination.pageSize]);

  useEffect(() => {
    void loadStats();
  }, [filters, loadStats]);

  const handleReset = (): void => {
    setFilters(INITIAL_FILTERS);
    setSortField('createdAt');
    setSortOrder('desc');
  };

  const handleRetry = (): void => {
    void loadLogs(pagination.current, pagination.pageSize);
    void loadStats();
  };

  const hasActiveFilters =
    filters.action.length > 0 ||
    filters.module.length > 0 ||
    Boolean(filters.keyword.trim()) ||
    Boolean(filters.dateRange);

  const errorBlock = error ? (
    <div className="error" style={{ padding: 24, textAlign: 'center' }}>
      <p>{error}</p>
      <Button onClick={handleRetry}>重新加载</Button>
    </div>
  ) : null;

  return (
    <>
      <div className="management-theme-page">
        <PageLayout
          statsLayout="custom"
          stats={
            <CollapsibleStatsBoard
              expandedContent={<AuditLogStats stats={stats} />}
              segments={mapAuditLogStatsToSegments(stats)}
            />
          }
          filters={
            <AuditLogFilters
              isMobile={isMobile}
              filters={filters}
              setFilters={setFilters}
              options={options}
              handleSearch={handleSearch}
              handleReset={handleReset}
              filterDrawerOpen={filterDrawerOpen}
              setFilterDrawerOpen={setFilterDrawerOpen}
              onOpenSettings={() => setSettingsOpen(true)}
            />
          }
        >
          {isMobile ? (
            errorBlock || (
              <ResponsiveDataView<AuditLogRecord>
                isMobile
                dataSource={logs}
                loading={loading}
                rowKey="id"
                emptyText={hasActiveFilters ? '没有匹配的审计日志' : '暂无审计日志'}
                pagination={{
                  current: pagination.current,
                  pageSize: pagination.pageSize,
                  total: pagination.total,
                }}
                onPaginationChange={(page: number, pageSize: number) => {
                  handleTableChange({ current: page, pageSize });
                }}
                renderCard={(log: AuditLogRecord) => (
                  <AuditLogMobileCard log={log} options={options} />
                )}
              />
            )
          ) : (
            <>
              <div className="table-head dorm-table-head mb-4">
                <div className="flex items-center gap-2">
                  <div className="dorm-table-head-accent" />
                  <h3 className="dorm-table-head-title">操作记录</h3>
                </div>
              </div>
              <div className="table-wrapper dorm-table-wrapper">
                {errorBlock || (
                  <AuditLogTable
                    logs={logs}
                    loading={loading}
                    pagination={pagination}
                    visibleColumns={visibleAuditColumns}
                    sortField={sortField}
                    sortOrder={sortOrder}
                    handleTableChange={handleTableChange}
                    options={options}
                  />
                )}
              </div>
            </>
          )}
        </PageLayout>
      </div>
      <TableFieldSettings
        open={settingsOpen}
        columns={auditColumns}
        onClose={() => setSettingsOpen(false)}
        onSave={async (columns) => {
          await saveAuditColumns(
            columns.map((column) => ({
              ...column,
              fieldKey: column.fieldKey,
              label: column.label || column.fieldKey,
            })) as AuditLogColumnConfig[],
          );
          setSettingsOpen(false);
        }}
        onReset={resetAuditColumns}
        saving={savingAuditColumns}
        title="审计日志字段设置"
      />
      {isMobile && <FloatButton.BackTop style={{ right: 24, bottom: 24 }} />}
    </>
  );
}
