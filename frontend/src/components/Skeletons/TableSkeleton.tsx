/**
 * 骨架屏组件 - 表格行骨架
 * 用于桌面端表格的加载占位
 */
import React from 'react';
import './Skeletons.css';

/**
 * 表格骨架行
 * @param {number} columns - 列数
 */
export function TableRowSkeleton({ columns = 6 }: { columns?: number }) {
  // 根据列数生成不同宽度的占位条
  const widths = ['60%', '80%', '40%', '70%', '50%', '65%', '55%', '75%'];
  
  return (
    <div className="skeleton-table-row">
      {[...Array(columns)].map((_, i) => (
        <div key={i} className="skeleton-table-cell">
          <div 
            className="skeleton-line skeleton-pulse" 
            style={{ width: widths[i % widths.length], height: 14 }} 
          />
        </div>
      ))}
    </div>
  );
}

/**
 * 表格骨架
 * @param {number} columns - 列数
 * @param {number} rows - 行数
 */
export function TableSkeleton({
  columns = 6,
  rows = 10,
}: {
  columns?: number;
  rows?: number;
}) {
  return (
    <div className="skeleton-table">
      {/* 表头骨架 */}
      <div className="skeleton-table-header">
        {[...Array(columns)].map((_, i) => (
          <div key={i} className="skeleton-table-cell">
            <div className="skeleton-line skeleton-pulse" style={{ width: '70%', height: 12 }} />
          </div>
        ))}
      </div>
      {/* 表体骨架 */}
      <div className="skeleton-table-body">
        {[...Array(rows)].map((_, i) => (
          <TableRowSkeleton key={i} columns={columns} />
        ))}
      </div>
    </div>
  );
}

export default TableSkeleton;
