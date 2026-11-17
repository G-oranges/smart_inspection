/**
 * 骨架屏组件 - 指标卡片骨架
 * 用于仪表盘 Stat Cards 的加载占位
 */
import React from 'react';
import './Skeletons.css';

/**
 * 单个指标卡片骨架
 */
export function StatCardSkeleton() {
  return (
    <div className="skeleton-stat-card">
      <div className="skeleton-stat-value skeleton-pulse" />
      <div className="skeleton-stat-label">
        <div className="skeleton-dot skeleton-pulse" />
        <div className="skeleton-line skeleton-pulse" style={{ width: '60%', height: 12 }} />
      </div>
    </div>
  );
}

/**
 * 指标卡片骨架组 (4 个)
 */
export function StatCardSkeletonGroup() {
  return (
    <div className="skeleton-stat-group">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="skeleton-stat-col">
          <StatCardSkeleton />
        </div>
      ))}
    </div>
  );
}

export default StatCardSkeleton;
