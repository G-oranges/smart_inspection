import { buildQueryString, request } from '../utils/api';

import type {
  DeleteByIdsPayload,
  EntityId,
  ServiceQueryParams,
  ServiceRecord,
  ServiceTableResponse,
  UploadResolution,
} from '../types/service';

function isBatchDeleteFilterPayload(
  value: unknown,
): value is Required<Pick<DeleteByIdsPayload, 'filter'>> {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'filter' in value &&
      (value as DeleteByIdsPayload).filter,
  );
}

function normalizeDeleteTeacherPayload(
  payload: EntityId[] | DeleteByIdsPayload | undefined,
): { path: string; method: 'DELETE' | 'POST'; body: ServiceRecord } {
  if (Array.isArray(payload)) {
    return {
      path: '/api/teachers',
      method: 'DELETE',
      body: { ids: payload },
    };
  }

  if (isBatchDeleteFilterPayload(payload)) {
    return {
      path: '/api/teachers/batch-delete',
      method: 'POST',
      body: { filter: payload.filter },
    };
  }

  return {
    path: '/api/teachers',
    method: 'DELETE',
    body: { ids: payload?.ids || [] },
  };
}

export const teacherService = {
  fetchTable: async (
    params: ServiceQueryParams = {},
  ): Promise<ServiceTableResponse> => {
    const queryString = buildQueryString(params);
    return request<ServiceTableResponse>(
      `/api/teachers${queryString ? `?${queryString}` : ''}`,
    );
  },

  create: async (payload: ServiceRecord): Promise<unknown> => {
    return request('/api/teachers', {
      method: 'POST',
      body: payload,
    });
  },

  update: async (
    id: EntityId,
    payload: ServiceRecord,
  ): Promise<unknown> => {
    return request(`/api/teachers/${id}`, {
      method: 'PUT',
      body: payload,
    });
  },

  delete: async (
    payload: EntityId[] | DeleteByIdsPayload = [],
  ): Promise<unknown> => {
    const normalized = normalizeDeleteTeacherPayload(payload);
    return request(normalized.path, {
      method: normalized.method,
      body: normalized.body,
    });
  },

  export: async (params: ServiceQueryParams = {}): Promise<Blob> => {
    const queryString = buildQueryString(params);
    return request<Blob>(`/api/teachers/export${queryString ? `?${queryString}` : ''}`, {
      responseType: 'blob',
    });
  },

  preview: async (file: File): Promise<unknown> => {
    const formData = new FormData();
    formData.append('file', file);
    return request('/api/teachers/import/preview', {
      method: 'POST',
      body: formData,
    });
  },

  import: async (
    file: File,
    resolution: UploadResolution = 'overwrite',
  ): Promise<unknown> => {
    const formData = new FormData();
    formData.append('file', file);
    return request(`/api/teachers/import?resolution=${resolution}`, {
      method: 'POST',
      body: formData,
    });
  },
};
