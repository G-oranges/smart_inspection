import { buildQueryString, request } from '../utils/api';

import type { RequestOptions } from '../types/api';
import type {
  DeleteByIdsPayload,
  EntityId,
  ServiceQueryParams,
  ServiceRecord,
  ServiceTableResponse,
  StudentsListResponse,
  StudentProfileResponse,
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

function normalizeDeleteStudentPayload(
  ids: EntityId[] | DeleteByIdsPayload | undefined,
): { path: string; method: 'DELETE' | 'POST'; body: ServiceRecord } {
  if (Array.isArray(ids)) {
    return {
      path: '/api/students',
      method: 'DELETE',
      body: { ids },
    };
  }

  if (isBatchDeleteFilterPayload(ids)) {
    return {
      path: '/api/students/batch-delete',
      method: 'POST',
      body: { filter: ids.filter },
    };
  }

  return {
    path: '/api/students',
    method: 'DELETE',
    body: { ids: ids?.ids || [] },
  };
}

export const studentService = {
  getStudents: async (): Promise<StudentsListResponse> => {
    return request<StudentsListResponse>('/api/students');
  },

  getFilterOptions: async (): Promise<ServiceRecord> => {
    return request<ServiceRecord>('/api/students/filter-options');
  },

  getStudentTable: async (
    params: ServiceQueryParams = {},
    options: RequestOptions = {},
  ): Promise<ServiceTableResponse> => {
    const queryString = buildQueryString(params);
    return request<ServiceTableResponse>(
      `/api/students/table${queryString ? `?${queryString}` : ''}`,
      options,
    );
  },

  createStudent: async (payload: ServiceRecord): Promise<unknown> => {
    return request('/api/students', {
      method: 'POST',
      body: payload,
    });
  },

  updateStudent: async (
    id: EntityId,
    payload: ServiceRecord,
  ): Promise<unknown> => {
    return request(`/api/students/${id}`, {
      method: 'PUT',
      body: payload,
    });
  },

  deleteStudents: async (
    ids?: EntityId[] | DeleteByIdsPayload,
  ): Promise<unknown> => {
    const normalized = normalizeDeleteStudentPayload(ids);
    return request(normalized.path, {
      method: normalized.method,
      body: normalized.body,
    });
  },

  getMyProfile: async (): Promise<StudentProfileResponse> => {
    return request<StudentProfileResponse>('/api/students/me');
  },

  updateMyContact: async (payload: ServiceRecord): Promise<unknown> => {
    return request('/api/students/me/contact', {
      method: 'PUT',
      body: payload,
    });
  },

  previewImportStudents: async (file: File): Promise<unknown> => {
    const formData = new FormData();
    formData.append('file', file);
    return request('/api/students/import/preview', {
      method: 'POST',
      body: formData,
    });
  },

  importStudents: async (
    file: File,
    resolution = 'overwrite',
  ): Promise<unknown> => {
    const formData = new FormData();
    formData.append('file', file);
    return request(`/api/students/import?resolution=${resolution}`, {
      method: 'POST',
      body: formData,
    });
  },

  exportStudents: async (params: ServiceQueryParams = {}): Promise<Blob> => {
    const queryString = buildQueryString(params);
    return request<Blob>(
      `/api/students/export${queryString ? `?${queryString}` : ''}`,
      {
        responseType: 'blob',
      },
    );
  },
};
