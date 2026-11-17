/**
 * 账号与权限管理模块导出
 * @module pages/account-permission
 */

// Schema 与常量
export {
  ROLE_IDS,
  STANDARD_ROLE_CODES,
  DEFAULT_ROLES,
  initialUserForm,
  USER_TABLE_KEY,
  USER_DEFAULT_COLUMNS,
  USER_RENDERERS,
  USER_TYPE_OPTIONS,
  USER_STATUS_OPTIONS,
} from './accountPermissionSchema';

// 工具函数
export { flattenRoleMap, buildUserTableParams } from './utils';

// 列定义
export { renderUserCell, buildAntTableColumns } from './UserColumns';

// 移动端卡片
export { default as UserMobileCard } from './UserMobileCard';

// 筛选组件
export {
  DesktopFilters,
  MobileFilterTrigger,
  MobileFilterDrawer,
} from './UserFilters';

// 用户表单弹窗
export { default as UserFormModal } from './UserFormModal';

// 操作菜单
export { default as UserActionSheet } from './UserActionSheet';

// 临时密码弹窗
export { default as TempPasswordModal } from './TempPasswordModal';

// 权限矩阵
export { default as PermissionMatrix } from './PermissionMatrix';

// 批量授权区块
export { default as BatchAuthSection } from './BatchAuthSection';

// 寝室长设置区块
export { default as MonitorSetupSection } from './MonitorSetupSection';

// 操作 Hook
export { useAccountActions } from './useAccountActions';
