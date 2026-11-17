import type { QueryParams } from './api';
import type {
  AppSettings,
  PermissionCode,
  RoleLike,
  UserLike,
} from './app';
import type { TableResponse } from './table';

export type EntityId = string | number;
export type ServiceRecord = Record<string, unknown>;
export type UploadResolution = 'overwrite' | 'skip' | (string & {});

export interface BatchDeleteFilterPayload {
  filter: ServiceRecord;
}

export interface DeleteByIdsPayload {
  ids?: EntityId[];
  filter?: ServiceRecord;
}

export interface StudentsListResponse {
  students?: ServiceRecord[];
}

export interface StudentProfileResponse {
  student?: ServiceRecord | null;
}

export interface DormListResponse {
  dormitories?: ServiceRecord[];
}

export interface DormBedsResponse {
  dormBeds?: ServiceRecord[];
}

export interface DormMembersResponse {
  members: ServiceRecord[];
}

export interface TasksListResponse {
  tasks?: ServiceRecord[];
}

export interface InspectionsListResponse {
  inspections?: ServiceRecord[];
}

export interface AppealsListResponse {
  appeals?: ServiceRecord[];
}

export interface AssignedDormsResponse {
  dorms?: ServiceRecord[];
  total?: number;
}

export interface ScoreSubmissionPayload extends ServiceRecord {
  taskId?: EntityId;
  inspectionId?: EntityId;
  totalScore?: number | string | null;
  comments?: string;
  photoUrls?: unknown[];
}

export interface ScoreAdjustmentPayload extends ServiceRecord {
  inspectionId?: EntityId;
  totalScore?: number | string | null;
  comments?: string;
  photoUrls?: unknown[];
}

export interface AppealHandlePayload extends ServiceRecord {
  appealId?: EntityId;
  status?: string;
  reply?: string;
}

export interface PermissionDefinition extends ServiceRecord {
  id?: EntityId;
  code?: string;
  name?: string;
  module?: string;
}

export interface RolePermissionLink extends ServiceRecord {
  roleId?: EntityId;
  permissionId?: EntityId;
}

export interface AuthLoginResponse {
  accessToken?: string;
  token?: string;
  refreshToken?: string;
  user?: UserLike | null;
}

export interface AuthRefreshResponse {
  accessToken?: string;
  token?: string;
  refreshToken?: string;
}

export interface CurrentUserResponse {
  user: UserLike;
}

export interface CheckUserEmailResponse {
  maskedEmail?: string;
}

export interface SettingsResponse {
  settings?: AppSettings;
}

export interface PermissionListResponse {
  permissions?: PermissionCode[];
}

export interface RoleMatrixResponse {
  roles: RoleLike[];
  permissions: PermissionDefinition[];
  rolePermissions: RolePermissionLink[];
}

export interface RolesResponse {
  roles?: RoleLike[];
}

export interface RoleType extends ServiceRecord {
  id?: EntityId;
  code?: string;
  name?: string;
  description?: string | null;
  isSystem?: boolean;
  sort?: number;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface RoleTypesResponse {
  roleTypes?: RoleType[];
}

export interface RoleTypeMutationPayload extends ServiceRecord {
  name?: string;
  code?: string;
  description?: string | null;
  status?: string;
  sort?: number;
}

export type ScopePresetCode = 'ALL' | 'ACADEMIC' | 'DORMITORY' | 'CUSTOM' | 'SELF' | 'OWN_COLLEGE';

export interface RoleDataScopeRules {
  academic?: {
    college?: string[];
    major?: string[];
    className?: string[];
  };
  dormitory?: {
    building?: string[];
    floor?: string[];
    room?: string[];
  };
}

export interface RoleDataScope extends ServiceRecord {
  id?: EntityId;
  roleId?: EntityId;
  scopeMode?: string;
  presetCode?: ScopePresetCode | string;
  rules?: RoleDataScopeRules;
  updatedBy?: string;
}

export interface RoleDataScopeResponse {
  dataScope?: RoleDataScope | null;
}

export interface UserDataScopeResponse {
  dataScope?: {
    userId?: EntityId;
    /** true 表示账号未单独设置，按角色计算 */
    inherited?: boolean;
    scopeMode?: ScopePresetCode | string;
    rules?: RoleDataScopeRules;
  } | null;
}

export interface ScopeOptionsResponse {
  academic?: Array<{ college: string; major: string; className: string }>;
  dorms?: Array<{ building: string; floor: number | null; roomNo: string }>;
}

export interface RoleMutationPayload extends ServiceRecord {
  name?: string;
  code?: string;
  typeCode?: string;
  description?: string | null;
  status?: string;
  sort?: number;
}

export interface TableConfigResponse {
  tableKey?: string;
  config?: unknown;
}

export interface ExecutorListResponse {
  users?: ServiceRecord[];
  total?: number;
}

export interface TemporaryPasswordResponse {
  temporaryPassword?: string;
}

export type ServiceTableResponse = TableResponse<ServiceRecord>;
export type ServiceQueryParams = QueryParams;
