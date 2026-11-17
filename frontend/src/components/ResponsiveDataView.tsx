import React from 'react';
import { Pagination, Empty } from 'antd';
import type { Key, ReactElement, ReactNode } from 'react';
import type { PaginationProps, TableProps } from 'antd';
import MobileDataCard from './MobileDataCard';
import GlassTable from './GlassTable';
import { CardSkeletonList, TableSkeleton } from './Skeletons';
import type { MobileDataCardActions, MobileDataField } from './MobileDataCard';

type TableRecord = Record<string, unknown>;
type RowKeyGetter<TItem> = keyof TItem | ((item: TItem) => Key);
type TablePagination = false | PaginationProps;

interface CardRenderContext {
  selected: boolean;
  onSelect?: (checked: boolean) => void;
}

interface CardRenderResult {
  title?: ReactNode;
  subtitle?: ReactNode;
  extra?: ReactNode;
  fields?: MobileDataField[];
  actions?: MobileDataCardActions;
  onClick?: () => void;
}

interface ResponsiveDataViewProps<TItem extends TableRecord = TableRecord> {
  isMobile?: boolean;
  dataSource?: TItem[];
  loading?: boolean;
  pagination?: TablePagination;
  onPaginationChange?: (page: number, pageSize: number) => void;
  columns?: TableProps<TItem>['columns'];
  rowSelection?: TableProps<TItem>['rowSelection'];
  onChange?: TableProps<TItem>['onChange'];
  scroll?: TableProps<TItem>['scroll'];
  rowKey?: RowKeyGetter<TItem>;
  size?: TableProps<TItem>['size'];
  className?: string;
  resizable?: boolean;
  renderCard?: (
    item: TItem,
    index: number,
    context: CardRenderContext,
  ) => ReactElement | CardRenderResult;
  selectedKeys?: Key[];
  onSelectChange?: (keys: Key[]) => void;
  selectionType?: 'checkbox' | 'radio';
  emptyText?: ReactNode;
}

function getPaginationPageSize(
  pagination: TablePagination | undefined,
  fallback: number,
): number {
  if (!pagination || typeof pagination !== 'object') {
    return fallback;
  }

  return typeof pagination.pageSize === 'number' ? pagination.pageSize : fallback;
}

/**
 * 响应式数据视图组件
 * 自动根据 isMobile 切换 Table 或 CardList 视图
 * 
 * @param {Object} props
 * @param {boolean} props.isMobile - 是否移动端
 * @param {Array} props.dataSource - 数据源
 * @param {boolean} props.loading - 加载状态
 * @param {Object} props.pagination - 分页配置 { current, pageSize, total }
 * @param {Function} props.onPaginationChange - 分页变化回调 (page, pageSize)
 * 
 * -- Table 模式专用 --
 * @param {Array} props.columns - 表格列配置
 * @param {Object} props.rowSelection - 行选择配置
 * @param {Function} props.onChange - 表格变化回调
 * @param {Object} props.scroll - 表格滚动配置
 * @param {string} props.rowKey - 行 key
 * @param {string} props.size - 表格尺寸
 * @param {string} props.className - 表格类名
 * @param {boolean} props.resizable - 是否启用列宽调整（桌面端）
 * 
 * -- CardList 模式专用 --
 * @param {Function} props.renderCard - 卡片渲染函数 (item, index) => { title, subtitle, extra, fields, actions, onClick }
 * @param {Array} props.selectedKeys - 选中的 key 数组
 * @param {Function} props.onSelectChange - 选择变化回调 (keys)
 */
export default function ResponsiveDataView<TItem extends TableRecord = TableRecord>({
  isMobile,
  dataSource = [],
  loading = false,
  pagination,
  onPaginationChange,
  // Table props
  columns,
  rowSelection,
  onChange,
  scroll,
  rowKey = 'id',
  size = 'middle',
  className = '',
  resizable = false,
  // CardList props
  renderCard,
  selectedKeys = [],
  onSelectChange,
  selectionType = 'checkbox',
  emptyText = '暂无数据',
}: ResponsiveDataViewProps<TItem>) {
  // 桌面端：渲染表格
  if (!isMobile) {
    // 加载中时显示表格骨架
    if (loading) {
      return (
        <TableSkeleton 
          columns={columns?.length || 6} 
          rows={getPaginationPageSize(pagination, 10)} 
        />
      );
    }

    return (
      <GlassTable
        columns={columns}
        dataSource={dataSource}
        loading={false}
        pagination={pagination ? {
          ...pagination,
          onChange: onPaginationChange,
          onShowSizeChange: onPaginationChange,
        } : false}
        rowSelection={onSelectChange ? {
          type: selectionType === 'radio' ? 'radio' : 'checkbox',
          selectedRowKeys: selectedKeys,
          onChange: onSelectChange,
        } : rowSelection}
        onChange={onChange}
        scroll={scroll}
        rowKey={rowKey}
        size={size}
        className={className}
        locale={{ emptyText }}
        resizable={resizable}
      />
    );
  }

  // 移动端：渲染卡片列表
  const getRowKey = (item: TItem): Key => {
    if (typeof rowKey === 'function') return rowKey(item);
    return item[rowKey] as Key;
  };

  const handleSelect = (item: TItem, checked: boolean) => {
    if (!onSelectChange) return;
    const key = getRowKey(item);
    
    if (selectionType === 'radio') {
      onSelectChange(checked ? [key] : []);
      return;
    }

    if (checked) {
      onSelectChange([...selectedKeys, key]);
    } else {
      onSelectChange(selectedKeys.filter((existingKey) => existingKey !== key));
    }
  };

  return (
    <div className="mobile-card-list">
      {loading ? (
        // 移动端加载中显示卡片骨架
        <CardSkeletonList count={getPaginationPageSize(pagination, 5)} />
      ) : dataSource.length === 0 ? (
        <Empty description={emptyText} style={{ padding: '40px 0' }} />
      ) : (
        <>
          {dataSource.map((item, index) => {
            const key = getRowKey(item);
            const isSelected = selectedKeys.includes(key);
            
            // Allow renderCard to return a React Element directly (flexibility) 
            // OR a config object (backward compatibility)
            const cardResult = renderCard
              ? renderCard(item, index, {
                  selected: isSelected,
                  onSelect: onSelectChange
                    ? (checked: boolean) => handleSelect(item, checked)
                    : undefined,
                })
              : ({} as CardRenderResult);

            if (React.isValidElement(cardResult)) {
              return React.cloneElement(cardResult, { key });
            }

            const cardConfig = cardResult as CardRenderResult;

            // Fallback to config object for existing implementations
            return (
              <MobileDataCard
                key={key}
                title={cardConfig.title}
                subtitle={cardConfig.subtitle}
                extra={cardConfig.extra}
                fields={cardConfig.fields || []}
                actions={cardConfig.actions}
                selected={isSelected}
                onSelect={onSelectChange ? (checked) => handleSelect(item, checked) : undefined}
                onClick={cardConfig.onClick}
              />
            );
          })}

          {/* 移动端简化分页器 */}
          {pagination && typeof pagination === 'object' && (pagination.total ?? 0) > 0 && (
            <div className="mobile-list-footer">
              <Pagination
                simple
                size="small"
                current={pagination.current}
                pageSize={pagination.pageSize}
                total={pagination.total}
                onChange={onPaginationChange}
                showTotal={(total) => `共 ${total} 条`}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
