/**
 * src/pages/building/index.js - 楼栋管理模块导出
 * 
 * Barrel export for building management module
 */

// ===== Schema 和常量 =====
export {
  BUILDING_TABLE_KEY,
  BUILDING_FILTER_KEYS,
  BUILDING_TYPE_OPTIONS,
  BUILDING_FORM_DEFAULTS,
  IMPORT_RESOLUTION_OPTIONS,
  createDefaultBuildingFilters,
  normalizeFilterValues,
  areArraysEqual,
  areBuildingFiltersEqual,
  calculateBuildingStats,
  extractUniqueCampuses,
} from "./buildingSchema";

// ===== 表格列定义 =====
export {
  COLUMN_WIDTHS,
  createBaseColumns,
  createActionColumn,
  mergeColumnsWithAction,
} from "./BuildingColumns";

// ===== 移动端卡片 =====
export { default as BuildingMobileCard, BuildingMobileCard as renderBuildingCard } from "./BuildingMobileCard";

// ===== 筛选配置 =====
export {
  createDesktopFilterConfig,
  createMobileFilterConfig,
  getFilterCount,
} from "./BuildingFilters";

// ===== 统计卡片 =====
export { default as BuildingStats, mapBuildingStatsToSegments } from "./BuildingStats";

// ===== 操作 Hook =====
export { useBuildingActions } from "./useBuildingActions";

// ===== ActionSheet =====
export { default as BuildingActionSheet } from "./BuildingActionSheet";

// ===== Modal 组件 =====
export { default as BuildingFormModal } from "./modals/BuildingFormModal";
export { default as BuildingDetailModal } from "./modals/BuildingDetailModal";
export { default as BuildingImportPreviewModal } from "./modals/BuildingImportPreviewModal";
