import type { Dispatch, Key, SetStateAction } from 'react';
import { useCallback } from 'react';
import { Alert, Button } from 'antd';
import type { ColumnsType } from 'antd/es/table';

import ResponsiveDataView from '../../components/ResponsiveDataView';
import AppealMobileCard from './AppealMobileCard';
import type { AppealRecord } from '../../types/service';
import type { AntTablePaginationLike, AntTableSorterLike } from '../../types/table';

export interface AppealTableProps {
  items: AppealRecord[];
  total: number;
  loading: boolean;
  errorMessage: string | null;
  isMobile: boolean;
  canHandle: boolean;
  hasActiveFilter: boolean;
  lastUpdatedText: string;
  columns: ColumnsType<AppealRecord>;
  selectedIds: string[];
  setSelectedIds: Dispatch<SetStateAction<string[]>>;
  page: number;
  pageSize: number;
  onPageChange: (page: number, pageSize?: number) => void;
  onTableChange: (
    pagination: AntTablePaginationLike,
    filters: unknown,
    sorter: AntTableSorterLike | AntTableSorterLike[],
  ) => void;
  onRetry: () => void;
  onOpenDetail: (record: AppealRecord) => void;
}

export default function AppealTable({
  items,
  total,
  loading,
  errorMessage,
  isMobile,
  canHandle,
  hasActiveFilter,
  lastUpdatedText,
  columns,
  selectedIds,
  setSelectedIds,
  page,
  pageSize,
  onPageChange,
  onTableChange,
  onRetry,
  onOpenDetail,
}: AppealTableProps) {
  const renderCard = useCallback(
    (
      record: AppealRecord,
      _index: number,
      options: { selected: boolean; onSelect?: (selected: boolean) => void },
    ) => (
      <AppealMobileCard
        appeal={record}
        selected={options.selected}
        onSelect={options.onSelect}
        onOpenDetail={onOpenDetail}
      />
    ),
    [onOpenDetail],
  );

  return (
    <>
      <div className="table-head dorm-table-head mb-4">
        <div className="flex items-center gap-2">
          <div className="dorm-table-head-accent" />
          <h3 className="dorm-table-head-title">申诉列表</h3>
          <span className="dorm-table-head-time">最后更新: {lastUpdatedText}</span>
        </div>
      </div>

      <div className={`table-wrapper${isMobile ? '' : ' dorm-table-wrapper'}`}>
        {errorMessage ? (
          <div className="p-4">
            <Alert
              message={errorMessage}
              type="error"
              showIcon
              action={
                <Button size="small" onClick={onRetry}>
                  重试
                </Button>
              }
            />
          </div>
        ) : (
          <ResponsiveDataView<AppealRecord>
            isMobile={isMobile}
            dataSource={items}
            loading={loading}
            rowKey="id"
            columns={columns}
            rowSelection={
              canHandle
                ? {
                    selectedRowKeys: selectedIds,
                    onChange: (keys: Key[]) => setSelectedIds(keys.map(String)),
                    getCheckboxProps: (record: AppealRecord) => ({
                      disabled: record.status !== 'pending',
                    }),
                    preserveSelectedRowKeys: true,
                  }
                : undefined
            }
            scroll={{ x: 1200 }}
            onChange={(nextPagination, filters, sorter) => {
              onTableChange(nextPagination, filters, sorter as AntTableSorterLike);
            }}
            size="middle"
            className="dorm-table"
            emptyText={hasActiveFilter ? '没有匹配的申诉记录' : '暂无申诉记录'}
            resizable={true}
            pagination={{
              current: page,
              pageSize,
              total,
            }}
            onPaginationChange={onPageChange}
            renderCard={renderCard}
            selectedKeys={selectedIds}
            onSelectChange={(keys: Key[]) => setSelectedIds(keys.map(String))}
          />
        )}
      </div>
    </>
  );
}
