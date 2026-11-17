import type { Dispatch, SetStateAction } from 'react';

import type { RoleLike, UserLike } from '../../types/app';
import type {
  EntityId,
  RoleDataScope,
  RoleMatrixResponse,
  RoleTypesResponse,
  RolesResponse,
  ServiceQueryParams,
  ServiceRecord,
  ServiceTableResponse,
  TemporaryPasswordResponse,
} from '../../types/service';

export type AccountPermissionTab = 'users' | 'permissions' | 'overrides' | 'monitors';
export type PermissionMode = 'inherit' | 'grant' | 'deny';
export type BatchPermissionState = Record<string, PermissionMode>;
export type RolePermissionMap = Map<EntityId, Set<EntityId>>;
export type SetState<T> = Dispatch<SetStateAction<T>>;

export interface AccountUser extends UserLike {
  id?: EntityId;
  department?: string;
  userType?: string;
  isDisabled?: boolean;
  building?: string;
  roomNo?: string;
  major?: string;
  className?: string;
  isMonitor?: boolean;
  avatarUrl?: string;
  [key: string]: unknown;
}

// useTableState stores every filter as string[], so department holds 0 or 1 entry.
// A type alias (not an interface) stays assignable to SearchFilters.
export type UserFilters = {
  department: string[];
  userType: string[];
  isDisabled: string[];
};

export interface UserFormState extends ServiceRecord {
  username: string;
  fullName: string;
  email: string;
  phone: string;
  department: string;
  userType: string;
  isDisabled: boolean;
  role: string;
  roles: EntityId[];
  avatarUrl: string;
}

export interface TableListState<T> {
  items: T[];
  total: number;
}

export interface MonitorFilters {
  building: string[];
  floor: string[];
  major: string[];
  className: string[];
}

export interface MonitorConflictEntry extends ServiceRecord {
  studentId?: EntityId;
  dormName?: string;
  existingMonitorName?: string;
  studentName?: string;
}

export interface MonitorConflictModalState {
  visible: boolean;
  conflicts: MonitorConflictEntry[];
  nonConflicts: MonitorConflictEntry[];
}

export interface TempPasswordModalState {
  visible: boolean;
  password: string;
  username: string;
}

export interface BatchSetMonitorResult extends ServiceRecord {
  hasConflicts?: boolean;
  conflicts?: MonitorConflictEntry[];
  nonConflicts?: MonitorConflictEntry[];
  message?: string;
}

export interface AccountPermissionData {
  dorms?: ServiceRecord[];
  students?: AccountUser[];
}

export interface AccountPermissionActions {
  loadUsers?: (params?: ServiceQueryParams) => Promise<ServiceTableResponse>;
  createUser?: (payload: ServiceRecord) => Promise<unknown>;
  updateUser?: (id: EntityId, payload: ServiceRecord) => Promise<unknown>;
  deleteUsers?: (payload: { ids: EntityId[] }) => Promise<unknown>;
  resetUserPassword?: (id: EntityId) => Promise<unknown>;
  generateTemporaryPassword?: (
    id: EntityId,
  ) => Promise<TemporaryPasswordResponse>;
  fetchRoleMatrix?: () => Promise<RoleMatrixResponse>;
  updateRolePermissions?: (
    roleId: EntityId,
    permissionIds: EntityId[],
  ) => Promise<unknown>;
  updateUserOverrides?: (
    userId: EntityId,
    overrides: Array<{ permissionId: string; grant: boolean }>,
  ) => Promise<unknown>;
  fetchRoles?: () => Promise<RolesResponse>;
  fetchRoleTypes?: () => Promise<RoleTypesResponse>;
  createRole?: (payload: ServiceRecord) => Promise<unknown>;
  updateRole?: (roleId: EntityId, payload: ServiceRecord) => Promise<unknown>;
  updateRoleStatus?: (roleId: EntityId, status: string) => Promise<unknown>;
  deleteRole?: (roleId: EntityId) => Promise<unknown>;
  createRoleType?: (payload: ServiceRecord) => Promise<unknown>;
  updateRoleType?: (roleTypeId: EntityId, payload: ServiceRecord) => Promise<unknown>;
  updateRoleTypeStatus?: (roleTypeId: EntityId, status: string) => Promise<unknown>;
  deleteRoleType?: (roleTypeId: EntityId) => Promise<unknown>;
  fetchRoleDataScope?: (roleId: EntityId) => Promise<{ dataScope?: RoleDataScope | null }>;
  saveRoleDataScope?: (roleId: EntityId, payload: RoleDataScope) => Promise<unknown>;
  loadDorms?: (force?: boolean) => Promise<unknown>;
  loadStudents?: (force?: boolean) => Promise<unknown>;
  batchUpdateUserOverrides?: (
    userIds: EntityId[],
    overrides: Array<{ permissionId: string; grant: boolean }>,
  ) => Promise<ServiceRecord>;
  batchSetMonitor?: (
    studentIds: EntityId[],
    replaceExisting?: boolean,
  ) => Promise<BatchSetMonitorResult>;
  fetchStudentTable?: (
    params?: ServiceQueryParams,
  ) => Promise<ServiceTableResponse>;
  fetchTableConfig?: (tableKey: string) => Promise<{ config?: unknown }>;
  saveTableConfig?: (tableKey: string, config: unknown) => Promise<unknown>;
  refreshPermissions?: () => Promise<unknown>;
}
