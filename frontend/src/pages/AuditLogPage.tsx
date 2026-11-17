import { useEffect, useState } from 'react';
import { FloatButton } from 'antd';

import PageLayout from '../components/PageLayout';
import ResponsiveDataView from '../components/ResponsiveDataView';
import CollapsibleStatsBoard from '../components/stats/CollapsibleStatsBoard';
import { useMobile } from '../hooks/useMobile';
import {
  AuditLogFilters,
  AuditLogMobileCard,
  AuditLogStats,
  AuditLogTable,
  mapAuditLogStatsToSegments,
  useAuditLogActions,
} from './audit-log';

import type {
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
  const isMobile = useMobile();
  const [pagination, setPagination] = useState(INITIAL_PAGINATION);
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);

  const {
    logs,
    loading,
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
  });

  useEffect(() => {
    void loadLogs(1, pagination.pageSize);
    void loadStats();
  }, [filters, loadLogs, loadStats, pagination.pageSize]);

  const handleReset = (): void => {
    setFilters(INITIAL_FILTERS);
  };

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
            />
          }
        >
          {isMobile ? (
            <ResponsiveDataView<AuditLogRecord>
              isMobile
              dataSource={logs}
              loading={loading}
              rowKey="id"
              emptyText="暂无审计日志"
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
          ) : (
            <>
              <div className="table-head dorm-table-head mb-4">
                <div className="flex items-center gap-2">
                  <div className="dorm-table-head-accent" />
                  <h3 className="dorm-table-head-title">操作记录</h3>
                </div>
              </div>
              <div className="table-wrapper dorm-table-wrapper">
                <AuditLogTable
                  logs={logs}
                  loading={loading}
                  pagination={pagination}
                  handleTableChange={handleTableChange}
                  options={options}
                />
              </div>
            </>
          )}
        </PageLayout>
      </div>
      {isMobile && <FloatButton.BackTop style={{ right: 24, bottom: 24 }} />}
    </>
  );
}
