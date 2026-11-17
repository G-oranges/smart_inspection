import { buildQueryString, request } from '../utils/api';

import type { RequestOptions } from '../types/api';
import type {
  DeleteByIdsPayload,
  DormBedsResponse,
  DormListResponse,
  DormMembersResponse,
  EntityId,
  ServiceQueryParams,
  ServiceRecord,
  ServiceTableResponse,
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

function normalizeDeleteDormPayload(
  ids: EntityId[] | DeleteByIdsPayload | undefined,
): { path: string; method: 'DELETE' | 'POST'; body: ServiceRecord } {
  if (Array.isArray(ids)) {
    return {
      path: '/api/dorms',
      method: 'DELETE',
      body: { ids },
    };
  }

  if (isBatchDeleteFilterPayload(ids)) {
    return {
      path: '/api/dorms/batch-delete',
      method: 'POST',
      body: { filter: ids.filter },
    };
  }

  return {
    path: '/api/dorms',
    method: 'DELETE',
    body: { ids: ids?.ids || [] },
  };
}

export const dormService = {
  getDorms: async (): Promise<DormListResponse> => {
    return request<DormListResponse>('/api/dorms');
  },

  getDormTable: async (
    params: ServiceQueryParams = {},
    options: RequestOptions = {},
  ): Promise<ServiceTableResponse> => {
    const queryString = buildQueryString(params);
    return request<ServiceTableResponse>(
      `/api/dorms/table${queryString ? `?${queryString}` : ''}`,
      options,
    );
  },

  createDorm: async (payload: unknown): Promise<unknown> => {
    return request('/api/dorms', {
      method: 'POST',
      body: payload,
    });
  },

  updateDorm: async (
    id: EntityId,
    payload: unknown,
  ): Promise<unknown> => {
    return request(`/api/dorms/${id}`, {
      method: 'PUT',
      body: payload,
    });
  },

  deleteDorms: async (
    ids?: EntityId[] | DeleteByIdsPayload,
  ): Promise<unknown> => {
    const normalized = normalizeDeleteDormPayload(ids);
    return request(normalized.path, {
      method: normalized.method,
      body: normalized.body,
    });
  },

  getBuildings: async (
    params: ServiceQueryParams = {},
    options: RequestOptions = {},
  ): Promise<unknown> => {
    const queryString = buildQueryString(params);
    return request(
      `/api/dorms/buildings${queryString ? `?${queryString}` : ''}`,
      options,
    );
  },

  getFloors: async (
    params: ServiceQueryParams = {},
    options: RequestOptions = {},
  ): Promise<unknown> => {
    const queryString = buildQueryString(params);
    return request(
      `/api/dorms/floors${queryString ? `?${queryString}` : ''}`,
      options,
    );
  },

  getRooms: async (
    params: ServiceQueryParams = {},
    options: RequestOptions = {},
  ): Promise<unknown> => {
    const queryString = buildQueryString(params);
    return request(
      `/api/dorms/rooms${queryString ? `?${queryString}` : ''}`,
      options,
    );
  },

  findDorm: async (
    params: ServiceQueryParams = {},
    options: RequestOptions = {},
  ): Promise<unknown> => {
    const queryString = buildQueryString(params);
    return request(
      `/api/dorms/find${queryString ? `?${queryString}` : ''}`,
      options,
    );
  },

  getDormMembers: async (dormId?: EntityId): Promise<DormMembersResponse> => {
    if (!dormId) {
      return { members: [] };
    }

    return request<DormMembersResponse>(`/api/dorms/${dormId}/members`);
  },

  getDormBeds: async (dormId?: EntityId): Promise<DormBedsResponse> => {
    const query = dormId
      ? `?${new URLSearchParams({ dormId: String(dormId) }).toString()}`
      : '';
    return request<DormBedsResponse>(`/api/dorm-beds${query}`);
  },

  importDorms: async (
    file: File,
    resolution = 'overwrite',
  ): Promise<unknown> => {
    const formData = new FormData();
    formData.append('file', file);
    return request(`/api/dorms/import?resolution=${resolution}`, {
      method: 'POST',
      body: formData,
    });
  },

  previewImportDorms: async (file: File): Promise<unknown> => {
    const formData = new FormData();
    formData.append('file', file);
    return request('/api/dorms/import/preview', {
      method: 'POST',
      body: formData,
    });
  },

  exportDorms: async (params: ServiceQueryParams = {}): Promise<Blob> => {
    const queryString = buildQueryString(params);
    return request<Blob>(`/api/dorms/export${queryString ? `?${queryString}` : ''}`, {
      responseType: 'blob',
    });
  },

  batchCheckout: async (dormIds: EntityId[]): Promise<unknown> => {
    return request('/api/dorms/batch-checkout', {
      method: 'POST',
      body: { dormIds },
    });
  },

  batchCheckIn: async (assignments: ServiceRecord[]): Promise<unknown> => {
    return request('/api/dorms/batch-checkin', {
      method: 'POST',
      body: { assignments },
    });
  },

  batchCheckoutStudents: async (studentIds: EntityId[]): Promise<unknown> => {
    return request('/api/dorms/batch-checkout-students', {
      method: 'POST',
      body: { studentIds },
    });
  },

  importCheckIn: async (file: File): Promise<unknown> => {
    const formData = new FormData();
    formData.append('file', file);
    return request('/api/dorms/import-checkin', {
      method: 'POST',
      body: formData,
    });
  },

  getOccupancyStats: async (): Promise<unknown> => {
    return request('/api/occupancy/stats');
  },

  assignOccupancy: async (payload: unknown): Promise<unknown> => {
    return request('/api/occupancy/assign', {
      method: 'POST',
      body: payload,
    });
  },

  moveBed: async (payload: unknown): Promise<unknown> => {
    return request('/api/occupancy/move', {
      method: 'POST',
      body: payload,
    });
  },

  swapBedOccupancy: async (payload: unknown): Promise<unknown> => {
    return request('/api/occupancy/swap', {
      method: 'POST',
      body: payload,
    });
  },

  checkoutStudent: async (studentId: EntityId): Promise<unknown> => {
    return request('/api/occupancy/checkout', {
      method: 'POST',
      body: { studentId },
    });
  },

  getOccupancyHistory: async (
    params: ServiceQueryParams = {},
  ): Promise<ServiceTableResponse> => {
    const queryString = buildQueryString({ ...params, module: 'DORM' });
    return request<ServiceTableResponse>(`/api/audit-logs?${queryString}`);
  },

  deleteOccupancyHistory: async (ids: EntityId[]): Promise<unknown> => {
    return request('/api/audit-logs', {
      method: 'DELETE',
      body: { ids },
    });
  },
};
