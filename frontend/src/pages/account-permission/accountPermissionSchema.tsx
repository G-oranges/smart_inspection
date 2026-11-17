/**
 * 账号与权限管理模块 - Schema 定义与常量
 * @module pages/account-permission/accountPermissionSchema
 */

import { Tag } from 'antd';
import UserAvatar from '../../components/common/UserAvatar';

import type { RoleLike } from '../../types/app';
import type { AccountUser, UserFormState } from './types';

export interface UserColumnConfig {
  fieldKey: string;
  label: string;
  visible: boolean;
  sortable: boolean;
  order: number;
  width?: number;
  align?: 'left' | 'center' | 'right';
  render?: (user: AccountUser) => React.ReactNode;
  [key: string]: unknown;
}

type UserRendererMap = Record<string, (user: AccountUser) => React.ReactNode>;
type UserOption = { value: string; label: string };

// 角色固定 ID
export const ROLE_IDS = {
  ADMIN: "00000000-0000-0000-0000-000000000001",
  COUNSELOR: "00000000-0000-0000-0000-000000000002",
  LEADER: "00000000-0000-0000-0000-000000000003",
  STUDENT: "00000000-0000-0000-0000-000000000004",
};

// 标准角色代码顺序
export const STANDARD_ROLE_CODES = ["ADMIN", "COUNSELOR", "LEADER", "STUDENT"];

// 默认角色列表
export const DEFAULT_ROLES: Array<Required<Pick<RoleLike, 'id' | 'code' | 'name'>>> = [
  { id: ROLE_IDS.ADMIN, code: "ADMIN", name: "管理员" },
  { id: ROLE_IDS.COUNSELOR, code: "COUNSELOR", name: "辅导员" },
  { id: ROLE_IDS.LEADER, code: "LEADER", name: "学生干部" },
  { id: ROLE_IDS.STUDENT, code: "STUDENT", name: "学生" },
];

// 用户表单初始值
export const initialUserForm: UserFormState = {
  username: "",
  fullName: "",
  email: "",
  phone: "",
  department: "",
  userType: "",
  isDisabled: false,
  role: "",
  roles: [],
  avatarUrl: "",
};

// 用户表格键
export const USER_TABLE_KEY = "userList";

// 用户表格默认列配置
export const USER_DEFAULT_COLUMNS: UserColumnConfig[] = [
  {
    fieldKey: "avatarUrl",
    label: "头像",
    visible: true,
    sortable: false,
    order: -1,
  },
  {
    fieldKey: "username",
    label: "用户名",
    visible: true,
    sortable: false,
    order: 0,
  },
  {
    fieldKey: "fullName",
    label: "姓名",
    visible: true,
    sortable: false,
    order: 1,
  },
  {
    fieldKey: "phone",
    label: "联系电话",
    visible: true,
    sortable: false,
    order: 2,
  },
  {
    fieldKey: "email",
    label: "电子邮箱",
    visible: true,
    sortable: false,
    order: 3,
  },
  {
    fieldKey: "department",
    label: "部门",
    visible: true,
    sortable: false,
    order: 4,
  },
  {
    fieldKey: "roles",
    label: "角色",
    visible: true,
    sortable: false,
    order: 5,
  },
  {
    fieldKey: "isDisabled",
    label: "启用状态",
    visible: true,
    sortable: false,
    order: 6,
  },
];

// 用户表格字段渲染器
export const USER_RENDERERS: UserRendererMap = {
  avatarUrl: (user) => (
    <UserAvatar
      avatarUrl={user.avatarUrl}
      name={user.fullName || user.username}
      size={32}
    />
  ),
  phone: (user) => user.phone || "-",
  email: (user) => user.email || "-",
  department: (user) => user.department || "-",
  roles: (user) =>
    user.roles && user.roles.length > 0 ? (
      <div className="flex flex-wrap gap-1">
        {user.roles.map((role) => (
          <Tag
            key={role.id}
            className="rounded-full border-none bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 px-2 m-0 text-[11px] font-medium"
          >
            {role.name}
          </Tag>
        ))}
      </div>
    ) : (
      <span className="text-gray-400">{user.userType || "-"}</span>
    ),
  isDisabled: (user) => (
    <Tag
      className={`rounded-full border-none px-3 m-0 text-xs font-bold ${!user.isDisabled ? "bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400" : "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400"}`}
    >
      {!user.isDisabled ? "活跃" : "已停用"}
    </Tag>
  ),
};

// 用户类型选项
export const USER_TYPE_OPTIONS: UserOption[] = [
  { value: "ADMIN", label: "管理员" },
  { value: "TEACHER", label: "教师" },
  { value: "STUDENT", label: "学生" },
];

// 用户状态选项
export const USER_STATUS_OPTIONS: UserOption[] = [
  { value: "false", label: "启用" },
  { value: "true", label: "停用" },
];
