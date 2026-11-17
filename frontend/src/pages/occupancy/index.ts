/**
 * 入住管理模块导出
 * @module pages/occupancy
 */

// 列定义
export { createBaseColumns, createActionColumn } from './OccupancyColumns';

// 移动端卡片
export { default as OccupancyMobileCard } from './OccupancyMobileCard';

// 统计卡片
export {
  OverviewStats,
  HistoryStats,
  mapOverviewStatsToSegments,
  mapHistoryStatsToSegments,
} from './OccupancyStats';

// 操作 Hook
export { useOccupancyActions } from './useOccupancyActions';

// 筛选 Schema
export { 
  createOverviewFilterSchema, 
  createHistoryFilterSchema,
  getActiveFilterCount,
} from './occupancyFilterSchema';

// 批量入住弹窗
export { default as BatchCheckInModal } from './BatchCheckInModal';

// 操作菜单
export { default as OccupancyActionSheet } from './OccupancyActionSheet';

// 工具栏
export { MobileToolbar, DesktopToolbar } from './OccupancyToolbar';

// 筛选区组件
export { OverviewFiltersSection, HistoryFiltersSection } from './OccupancyFilters';
