/**
 * 入住管理页面常量和配置
 * OccupancyManagementPage 模块化 - SSOT
 */

// ✅ PR#10: 入住管理筛选字段（含 status 特殊字段）
export const OCCUPANCY_FILTER_KEYS = [
  "building",
  "floor",
  "grade",
  "college",
  "className",
  "status", // 特殊字段：入住状态
];

// 玻璃拟态卡片内部样式
export const statCardStyle = {
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  padding: '16px'
} as const;

// 历史记录 Tab 专用默认筛选
export function createDefaultHistoryFilters() {
  return {
    action: undefined as string | undefined,
    keyword: "",
    dateRange: null as [Dayjs, Dayjs] | null,
  };
}
import type { Dayjs } from 'dayjs';
