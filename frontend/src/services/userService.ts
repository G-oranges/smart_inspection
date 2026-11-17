import { buildQueryString, request } from '../utils/api';

import type {
  EntityId,
  ExecutorListResponse,
  ServiceQueryParams,
  ServiceRecord,
  ServiceTableResponse,
  TemporaryPasswordResponse,
} from '../types/service';

export const userService = {
  getUsers: async (
    params: ServiceQueryParams = {},
  ): Promise<ServiceTableResponse> => {
    const queryString = buildQueryString(params);
    return request<ServiceTableResponse>(
      `/api/users${queryString ? `?${queryString}` : ''}`,
    );
  },

  createUser: async (payload: ServiceRecord): Promise<unknown> => {
    return request('/api/users', {
      method: 'POST',
      body: payload,
    });
  },

  updateUser: async (
    id: EntityId,
    payload: ServiceRecord,
  ): Promise<unknown> => {
    return request(`/api/users/${id}`, {
      method: 'PUT',
      body: payload,
    });
  },

  resetPassword: async (id: EntityId): Promise<unknown> => {
    return request(`/api/users/${id}/reset-password`, {
      method: 'PUT',
    });
  },

  generateTemporaryPassword: async (
    id: EntityId,
  ): Promise<TemporaryPasswordResponse> => {
    return request<TemporaryPasswordResponse>(`/api/users/${id}/temporary-password`, {
      method: 'POST',
    });
  },

  deleteUsers: async (ids: EntityId[] = []): Promise<unknown> => {
    return request('/api/users', {
      method: 'DELETE',
      body: { ids },
    });
  },

  getExecutors: async (
    params: ServiceQueryParams = {},
  ): Promise<ExecutorListResponse> => {
    const queryString = buildQueryString(params);
    return request<ExecutorListResponse>(
      `/api/users/executors${queryString ? `?${queryString}` : ''}`,
    );
  },

  updateMe: async (payload: ServiceRecord): Promise<unknown> => {
    return request('/api/users/me', {
      method: 'PUT',
      body: payload,
    });
  },
};
