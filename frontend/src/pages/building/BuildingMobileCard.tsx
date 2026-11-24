/**
 * BuildingMobileCard.jsx - 楼栋移动端卡片组件
 * 
 * 用于 ResponsiveDataView 的移动端渲染
 */
import { Tag } from "antd";

import type { BuildingRecord } from './types';

interface BuildingMobileCardOptions {
  selected?: boolean;
  onSelect?: (selected: boolean) => void;
}

/**
 * 渲染楼栋卡片
 * @param {Object} record - 楼栋数据记录
 * @param {number} index - 索引（未使用但保留接口一致性）
 * @param {Object} options - 选择相关选项
 * @param {boolean} options.selected - 是否选中
 * @param {Function} options.onSelect - 选中回调
 */
export function BuildingMobileCard(
  record: BuildingRecord,
  index: number,
  { selected = false, onSelect }: BuildingMobileCardOptions,
) {
  const getTypeColor = (type?: string) => {
    if (type === "男") return "blue";
    if (type === "女") return "magenta";
    return "purple";
  };

  return (
    <div
      className={`mobile-compact-card relative overflow-hidden transition-all duration-300 ${
        selected ? "selected ring-2 ring-ios-blue ring-offset-2" : "hover:shadow-md"
      }`}
      onClick={() => onSelect && onSelect(!selected)}
      style={{ marginBottom: 12, borderRadius: "16px" }}
    >
      <div className="compact-card-header">
        <div className="compact-header-left">
          <div className="compact-title font-bold text-gray-800 dark:text-gray-100">
            {record.name}
          </div>
          <div className="compact-subtitle text-gray-400">{record.campus}</div>
        </div>
        <div className="compact-header-right">
          <Tag
            className="rounded-full border-none px-2.5"
            color={getTypeColor(record.type)}
          >
            {record.type || "-"}
          </Tag>
        </div>
      </div>
      <div className="compact-card-grid mt-3">
        <div className="compact-info-item">
          <span className="compact-label text-gray-400">楼层</span>
          <span className="compact-value font-medium">{record.floors} 层</span>
        </div>
        <div className="compact-info-item">
          <span className="compact-label text-gray-400">电梯</span>
          <span className="compact-value font-medium">
            {record.hasElevator ? "有" : "无"}
          </span>
        </div>
        <div className="compact-info-item" style={{ gridColumn: "span 2" }}>
          <span className="compact-label text-gray-400">关联宿舍</span>
          <span className="compact-value font-medium">{record.dormCount || 0} 间</span>
        </div>
      </div>
    </div>
  );
}

export default BuildingMobileCard;
