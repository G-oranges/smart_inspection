/**
 * 骨架屏组件 - 详情描述骨架
 * 用于 Modal 详情弹窗的加载占位
 */
import React from 'react';
import './Skeletons.css';

/**
 * 详情描述骨架
 * @param {number} rows - 行数
 * @param {number} columns - 列数 (1 或 2)
 */
export function DetailSkeleton({
  rows = 6,
  columns = 2,
}: {
  rows?: number;
  columns?: number;
}) {
  const widths = ['80%', '60%', '90%', '70%', '50%', '85%', '65%', '75%'];
  
  return (
    <div className="skeleton-detail">
      {[...Array(rows)].map((_, rowIndex) => (
        <div key={rowIndex} className="skeleton-detail-row">
          {[...Array(columns)].map((_, colIndex) => (
            <div key={colIndex} className="skeleton-detail-item">
              <div 
                className="skeleton-line skeleton-pulse skeleton-label" 
                style={{ width: '30%', height: 12, marginBottom: 6 }} 
              />
              <div 
                className="skeleton-line skeleton-pulse" 
                style={{ width: widths[(rowIndex * columns + colIndex) % widths.length], height: 14 }} 
              />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export default DetailSkeleton;
