/**
 * 入住管理移动端卡片组件
 * OccupancyManagementPage 模块化
 */

import { Space, Tag, Badge } from "antd";
import { CheckCircleOutlined } from "@ant-design/icons";

import type { OccupancyMobileCardProps } from "./types";

/**
 * 学生入住信息卡片（移动端）
 */
export default function OccupancyMobileCard({ 
  record, 
  selected, 
  onSelect, 
  isBatchMode 
}: OccupancyMobileCardProps) {
  return (
    <div 
      className={`mobile-compact-card ${selected ? 'selected' : ''}`}
      onClick={() => {
        onSelect && onSelect(!selected);
      }}
      style={{ position: 'relative' }}
    >
      {isBatchMode && (
        <div style={{ position: 'absolute', right: 12, top: 40, zIndex: 2 }}>
          <Badge status={selected ? 'processing' : 'default'} />
        </div>
      )}
      <div className="compact-card-header">
        <div className="compact-header-left">
          <div className="compact-title">{record.fullName || '-'}</div>
          <div className="compact-subtitle">{record.studentNo}</div>
        </div>
        <div className="compact-header-right">
          <Space size={2}>
            {record.dormId ? (
              <Tag color="success" icon={<CheckCircleOutlined />} style={{ margin: 0, fontSize: 10 }}>已入住</Tag>
            ) : (
              <Tag color="default" style={{ margin: 0, fontSize: 10 }}>未入住</Tag>
            )}
          </Space>
        </div>
      </div>
      
      <div className="compact-card-grid">
        <div className="compact-info-item">
          <span className="compact-label">学院</span>
          <span className="compact-value">{record.college || '-'}</span>
        </div>
        <div className="compact-info-item">
          <span className="compact-label">性别</span>
          <span className="compact-value">{record.gender || '-'}</span>
        </div>
        <div className="compact-info-item">
          <span className="compact-label">班级</span>
          <span className="compact-value">{record.className || '-'}</span>
        </div>
        <div className="compact-info-item">
          <span className="compact-label">宿舍</span>
          <span className="compact-value">
            {record.dormId ? `${record.building || ''} ${record.roomNo || ''}` : '-'}
          </span>
        </div>
        <div className="compact-info-item">
          <span className="compact-label">床位</span>
          <span className="compact-value">{record.bedNo ? `${record.bedNo}号床` : '-'}</span>
        </div>
      </div>
    </div>
  );
}
