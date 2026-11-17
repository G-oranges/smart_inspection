/**
 * 学生管理模块导出
 * @module pages/student
 */

// 筛选 Schema 与配置
export {
  STUDENT_FILTER_KEYS,
  STUDENT_TABLE_KEY,
  STUDENT_DEFAULT_COLUMNS,
  normalizeStudentGender,
  buildStudentTableParams,
  getActiveFilterCount,
  pinyinSort,
  createFilterOptions,
  initialStudentForm,
} from './studentFilterSchema';

// 列定义
export {
  STUDENT_RENDERERS,
  renderStudentCell,
  createBaseColumns,
  createActionColumn,
} from './StudentColumns';

// 移动端卡片
export { default as StudentMobileCard } from './StudentMobileCard';

// 操作菜单
export { default as StudentActionSheet } from './StudentActionSheet';

// 操作 Hook
export { useStudentActions } from './useStudentActions';

// 弹窗组件
export { default as StudentFormModal } from './modals/StudentFormModal';
export { default as StudentDetailModal } from './modals/StudentDetailModal';
export { default as StudentImportPreviewModal } from './modals/StudentImportPreviewModal';

// 统计与工具栏组件
export { default as StudentStats, mapStudentStatsToSegments } from './StudentStats';
export { default as StudentToolbar } from './StudentToolbar';
export { MobileSearchBar, StudentMobileAdvancedFilter } from './StudentMobileFilters';

