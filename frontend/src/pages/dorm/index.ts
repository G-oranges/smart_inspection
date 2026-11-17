/**
 * src/pages/dorm/index.js - 宿舍管理模块导出
 * 
 * Barrel export for dorm management module
 */

// ===== Schema 和常量 =====
export {
  DORM_TABLE_KEY,
  DORM_DEFAULT_COLUMNS,
  DORM_FILTER_KEYS,
  GENDER_OPTIONS,
  OCCUPANCY_STATUS_OPTIONS,
  normalizeDormGender,
  calculateDormStats,
  mapRoomToBeds,
} from "./dormFilterSchema";

// ===== 表格列定义 =====
export {
  COLUMN_WIDTHS,
  occupancyMeter,
  renderDormCell,
  createBaseColumns,
  createActionColumn,
} from "./DormColumns";

// ===== 移动端卡片 =====
export { default as DormMobileCard } from "./DormMobileCard";

// ===== 筛选配置 =====
export {
  createDesktopFilterConfig,
  createMobileFilterConfig,
  getFilterCount,
} from "./DormFilters";

// ===== 操作 Hook =====
export {
  buildDormTableParams,
  useDormActions,
} from "./useDormActions";

// ===== Modal 组件 =====
export { default as DormFormModal } from "./modals/DormFormModal";
export { default as DormEditModal } from "./modals/DormEditModal";
export { default as DormDetailModal } from "./modals/DormDetailModal";
export { default as DormImportPreviewModal } from "./modals/DormImportPreviewModal";
export { default as DormActionSheet } from "./modals/DormActionSheet";
