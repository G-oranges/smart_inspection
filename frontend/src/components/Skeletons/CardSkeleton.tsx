/**
 * 骨架屏组件 - 卡片骨架
 * 用于移动端卡片列表的加载占位
 */
import React from 'react';
import './Skeletons.css';

/**
 * 单个卡片骨架
 */
export function CardSkeleton() {
  return (
    <div className="skeleton-card">
      {/* 头部：标题 + 副标题 + 标签 */}
      <div className="skeleton-card-header">
        <div className="skeleton-header-left">
          <div className="skeleton-line skeleton-pulse" style={{ width: '60%', height: 16, marginBottom: 6 }} />
          <div className="skeleton-line skeleton-pulse" style={{ width: '40%', height: 12 }} />
        </div>
        <div className="skeleton-tag skeleton-pulse" />
      </div>
      {/* 网格内容 */}
      <div className="skeleton-card-grid">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="skeleton-grid-item">
            <div className="skeleton-line skeleton-pulse" style={{ width: '50%', height: 10, marginBottom: 4 }} />
            <div className="skeleton-line skeleton-pulse" style={{ width: '70%', height: 14 }} />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * 卡片骨架列表
 * @param {number} count - 显示的骨架卡片数量
 */
export function CardSkeletonList({ count = 5 }: { count?: number }) {
  return (
    <div className="skeleton-card-list">
      {[...Array(count)].map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

export default CardSkeleton;
