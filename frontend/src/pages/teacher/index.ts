/**
 * 教职工管理模块导出
 * @module pages/teacher
 */

// 筛选 Schema 与配置
export {
  TEACHER_TABLE_KEY,
  TEACHER_FILTER_KEYS,
  TEACHER_DEFAULT_COLUMNS,
  TEACHER_COLUMN_WIDTHS,
  TEACHER_RENDERERS,
  buildTeacherTableParams,
  initialTeacherForm,
  renderTeacherCell,
  getUniqueDepartments,
} from './teacherSchema';

// 列定义
export {
  createBaseColumns,
  createActionColumn,
  useTeacherColumns,
} from './TeacherColumns';

// 移动端卡片
export { default as TeacherMobileCard } from './TeacherMobileCard';

// 操作菜单
export { default as TeacherActionSheet } from './TeacherActionSheet';

// 操作 Hook
export { useTeacherActions } from './useTeacherActions';

// 弹窗组件
export { default as TeacherFormModal } from './modals/TeacherFormModal';
export { default as TeacherImportPreviewModal } from './modals/TeacherImportPreviewModal';
