/**
 * DormMobileCard.jsx - 宿舍移动端卡片组件
 * 
 * 用于移动端列表展示宿舍信息的卡片组件
 */
import { Tag, Space } from "antd";

import type { DormRecord } from './types';

interface DormMobileCardProps {
  dorm: DormRecord;
  selected?: boolean;
  onSelect?: (selected: boolean) => void;
}

/**
 * 移动端宿舍卡片 (Ticket-style)
 * @param {Object} props
 * @param {Object} props.dorm - 宿舍数据
 * @param {number} props.index - 列表索引
 * @param {boolean} props.selected - 是否选中
 * @param {Function} props.onSelect - 选中回调
 */
export default function DormMobileCard({
  dorm,
  selected = false,
  onSelect,
}: DormMobileCardProps) {
  return (
    <div 
      className={`mobile-compact-card relative overflow-hidden transition-all duration-300 ${selected ? 'selected ring-2 ring-ios-blue ring-offset-2' : 'hover:shadow-md'}`}
      onClick={() => onSelect && onSelect(!selected)}
      style={{ marginBottom: 12, borderRadius: '16px' }}
    >
      {/* Header */}
      <div className="compact-card-header">
        <div className="compact-header-left">
          <div className="compact-title font-bold text-gray-800 dark:text-gray-100">
            {dorm.building} {dorm.roomNo}
          </div>
          <div className="compact-subtitle text-gray-400">{dorm.campus}</div>
        </div>
        <div className="compact-header-right">
          <Space size={4}>
            {dorm.gender && (
              <Tag 
                className="rounded-full border-none px-2"
                color={dorm.gender === '男' ? 'blue' : dorm.gender === '女' ? 'magenta' : 'orange'}
              >
                {dorm.gender}
              </Tag>
            )}
          </Space>
        </div>
      </div>
      
      {/* Grid */}
      <div className="compact-card-grid mt-3">
        <div className="compact-info-item">
          <span className="compact-label text-gray-400">可住</span>
          <span className="compact-value font-medium">{dorm.capacity || 0}</span>
        </div>
        <div className="compact-info-item">
          <span className="compact-label text-gray-400">已住</span>
          <span className="compact-value font-medium">{dorm.occupiedCount || 0}</span>
        </div>
        <div className="compact-info-item">
          <span className="compact-label text-gray-400">楼层</span>
          <span className="compact-value font-medium">{dorm.floor}层</span>
        </div>
        <div className="compact-info-item">
          <span className="compact-label text-gray-400">年级</span>
          <span className="compact-value font-medium">{dorm.grade || '-'}</span>
        </div>
        <div className="compact-info-item" style={{ gridColumn: 'span 2' }}>
          <span className="compact-label text-gray-400">寝室长</span>
          <span className="compact-value font-medium">{dorm.monitorName || '未设置'}</span>
        </div>
      </div>
    </div>
  );
}
