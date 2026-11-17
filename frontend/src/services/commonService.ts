import { request, tokenManager } from '../utils/api';

import type { AppSettings } from '../types/app';
import type {
  EntityId,
  PermissionListResponse,
  RoleDataScope,
  RoleDataScopeResponse,
  RoleMatrixResponse,
  RoleMutationPayload,
  RoleTypeMutationPayload,
  RoleTypesResponse,
  RolesResponse,
  ServiceRecord,
  SettingsResponse,
} from '../types/service';

export const commonService = {
  getSettings: async (): Promise<SettingsResponse> => {
    return request<SettingsResponse>('/api/settings');
  },

  updateSettings: async (
    payload: AppSettings | ServiceRecord,
  ): Promise<SettingsResponse> => {
    return request<SettingsResponse>('/api/settings', {
      method: 'PUT',
      body: payload,
    });
  },

  getMyPermissions: async (): Promise<PermissionListResponse> => {
    return request<PermissionListResponse>('/api/permissions/me');
  },

  getRoleMatrix: async (): Promise<RoleMatrixResponse> => {
    return request<RoleMatrixResponse>('/api/permissions/roles');
  },

  getRoles: async (): Promise<RolesResponse> => {
    return request<RolesResponse>('/api/roles');
  },

  getRoleTypes: async (): Promise<RoleTypesResponse> => {
    return request<RoleTypesResponse>('/api/role-types');
  },

  createRole: async (payload: RoleMutationPayload): Promise<unknown> => {
    return request('/api/roles', {
      method: 'POST',
      body: payload,
    });
  },

  updateRole: async (
    roleId: EntityId,
    payload: RoleMutationPayload,
  ): Promise<unknown> => {
    return request(`/api/roles/${roleId}`, {
      method: 'PUT',
      body: payload,
    });
  },

  updateRoleStatus: async (roleId: EntityId, status: string): Promise<unknown> => {
    return request(`/api/roles/${roleId}/status`, {
      method: 'PUT',
      body: { status },
    });
  },

  deleteRole: async (roleId: EntityId): Promise<unknown> => {
    return request(`/api/roles/${roleId}`, {
      method: 'DELETE',
    });
  },

  createRoleType: async (payload: RoleTypeMutationPayload): Promise<unknown> => {
    return request('/api/role-types', {
      method: 'POST',
      body: payload,
    });
  },

  updateRoleType: async (
    roleTypeId: EntityId,
    payload: RoleTypeMutationPayload,
  ): Promise<unknown> => {
    return request(`/api/role-types/${roleTypeId}`, {
      method: 'PUT',
      body: payload,
    });
  },

  updateRoleTypeStatus: async (roleTypeId: EntityId, status: string): Promise<unknown> => {
    return request(`/api/role-types/${roleTypeId}/status`, {
      method: 'PUT',
      body: { status },
    });
  },

  deleteRoleType: async (roleTypeId: EntityId): Promise<unknown> => {
    return request(`/api/role-types/${roleTypeId}`, {
      method: 'DELETE',
    });
  },

  getRoleDataScope: async (roleId: EntityId): Promise<RoleDataScopeResponse> => {
    return request<RoleDataScopeResponse>(`/api/roles/${roleId}/data-scope`);
  },

  saveRoleDataScope: async (
    roleId: EntityId,
    payload: RoleDataScope,
  ): Promise<unknown> => {
    return request(`/api/roles/${roleId}/data-scope`, {
      method: 'PUT',
      body: payload,
    });
  },

  updateRolePermissions: async (
    roleId: EntityId,
    permissionIds: Array<string | number>,
  ): Promise<unknown> => {
    return request(`/api/permissions/roles/${roleId}`, {
      method: 'PUT',
      body: { permissionIds },
    });
  },

  getUserOverrides: async (userId: EntityId): Promise<unknown> => {
    return request(`/api/permissions/users/${userId}`);
  },

  updateUserOverrides: async (
    userId: EntityId,
    overrides: unknown,
  ): Promise<unknown> => {
    return request(`/api/permissions/users/${userId}`, {
      method: 'PUT',
      body: { overrides },
    });
  },

  batchUpdateUserOverrides: async (
    userIds: EntityId[],
    overrides: unknown,
  ): Promise<unknown> => {
    return request('/api/permissions/batch-overrides', {
      method: 'PUT',
      body: { userIds, overrides },
    });
  },

  batchSetMonitor: async (
    studentIds: EntityId[],
    replaceExisting: boolean,
  ): Promise<unknown> => {
    return request('/api/students/batch-monitor', {
      method: 'PUT',
      body: { studentIds, replaceExisting },
    });
  },

  uploadPhoto: async (file: File): Promise<unknown> => {
    if (!tokenManager.hasTokens()) {
      throw new Error('未登录或登录已过期，请重新登录');
    }

    const formData = new FormData();
    formData.append('file', file);

    return request('/api/uploads', {
      method: 'POST',
      body: formData,
    });
  },

  uploadAvatar: async (file: File): Promise<unknown> => {
    if (!tokenManager.hasTokens()) {
      throw new Error('未登录或登录已过期，请重新登录');
    }

    const formData = new FormData();
    formData.append('file', file);

    return request('/api/uploads/avatar', {
      method: 'POST',
      body: formData,
    });
  },
};
