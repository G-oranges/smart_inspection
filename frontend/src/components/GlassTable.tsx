import { useMemo } from 'react';
import { Table } from 'antd';
import type { TableProps } from 'antd';

import { TableSkeleton } from './Skeletons';
import ResizableTitle from './ResizableTitle';
import { PAGINATION_SIZE_CHANGER_PROPS } from '../utils/pagination';

const PAGINATION_LOCALE = {
  jump_to: '跳至',
  page: '页',
  items_per_page: '条/页',
};

const DEFAULT_PAGINATION = {
  showSizeChanger: PAGINATION_SIZE_CHANGER_PROPS,
  showQuickJumper: true,
  showTotal: (total: number) => `共 ${total} 条`,
  locale: PAGINATION_LOCALE,
};

type TableRecord = Record<string, unknown>;
type GlassTablePagination<T extends object> = TableProps<T>['pagination'] | false;

type GlassTableProps<T extends object = TableRecord> = TableProps<T> & {
  pagination?: GlassTablePagination<T>;
  useSkeleton?: boolean;
  resizable?: boolean;
};

function getPaginationPageSize<T extends object>(
  pagination: GlassTablePagination<T> | undefined,
): number {
  if (!pagination) {
    return 10;
  }

  if (typeof pagination === 'object' && 'pageSize' in pagination) {
    return typeof pagination.pageSize === 'number' ? pagination.pageSize : 10;
  }

  return 10;
}

function applyDefaultCenterAlign<T extends object>(
  columns: TableProps<T>['columns'],
): TableProps<T>['columns'] {
  if (!Array.isArray(columns)) {
    return columns;
  }

  return columns.map((column) => {
    if ('children' in column && Array.isArray(column.children)) {
      return {
        ...column,
        align: column.align ?? 'center',
        children: applyDefaultCenterAlign(column.children),
      };
    }

    return {
      ...column,
      align: column.align ?? 'center',
    };
  });
}

export default function GlassTable<T extends object = TableRecord>({
  pagination,
  className = '',
  size = 'middle',
  loading = false,
  useSkeleton = true,
  columns = [],
  resizable = false,
  components: customComponents,
  ...restProps
}: GlassTableProps<T>) {
  const centeredColumns = useMemo(
    () => applyDefaultCenterAlign(columns),
    [columns],
  );
  const mergedPagination =
    pagination === false
      ? false
      : pagination
        ? { ...DEFAULT_PAGINATION, ...pagination }
        : false;

  const mergedClassName = `glass-table ${className}`.trim();

  const mergedComponents = useMemo(() => {
    if (!resizable) {
      return customComponents;
    }

    return {
      ...customComponents,
      header: {
        ...(customComponents?.header || {}),
        cell: ResizableTitle,
      },
    } as TableProps<T>['components'];
  }, [customComponents, resizable]);

  if (loading && useSkeleton) {
    const columnCount = columns.length || 6;
    const rowCount = getPaginationPageSize(pagination);
    return <TableSkeleton columns={columnCount} rows={rowCount} />;
  }

  return (
    <Table<T>
      size={size}
      className={mergedClassName}
      pagination={mergedPagination}
      loading={Boolean(loading) && !useSkeleton}
      columns={centeredColumns}
      components={mergedComponents}
      {...restProps}
    />
  );
}
