import { buildQueryString, request } from '../utils/api';

import type {
  AppealsListResponse,
  AppealHandlePayload,
  AssignedDormsResponse,
  EntityId,
  InspectionsListResponse,
  ScoreAdjustmentPayload,
  ScoreSubmissionPayload,
  ServiceQueryParams,
  ServiceRecord,
  TasksListResponse,
} from '../types/service';

function normalizeNumericScore(value: number | string | null | undefined) {
  if (value === '' || value === null || value === undefined) {
    return undefined;
  }

  return Number(value);
}

export const taskService = {
  getTasks: async (): Promise<TasksListResponse> => {
    return request<TasksListResponse>('/api/tasks');
  },

  createTask: async (payload: ServiceRecord): Promise<unknown> => {
    return request('/api/tasks', {
      method: 'POST',
      body: payload,
    });
  },

  updateTask: async (
    taskId: EntityId,
    payload: ServiceRecord,
  ): Promise<unknown> => {
    return request(`/api/tasks/${taskId}`, {
      method: 'PUT',
      body: payload,
    });
  },

  deleteTask: async (taskId: EntityId): Promise<unknown> => {
    return request(`/api/tasks/${taskId}`, {
      method: 'DELETE',
    });
  },

  deleteInspection: async (inspectionId: EntityId): Promise<unknown> => {
    return request(`/api/inspections/${inspectionId}`, {
      method: 'DELETE',
    });
  },

  deleteInspections: async (ids: EntityId[] = []): Promise<unknown> => {
    return request('/api/inspections', {
      method: 'DELETE',
      body: { ids },
    });
  },

  getInspections: async (): Promise<InspectionsListResponse> => {
    return request<InspectionsListResponse>('/api/inspections');
  },

  getMyInspections: async (): Promise<InspectionsListResponse> => {
    return request<InspectionsListResponse>('/api/inspections/mine');
  },

  getAppeals: async (): Promise<AppealsListResponse> => {
    return request<AppealsListResponse>('/api/appeals');
  },

  getMyAppeals: async (): Promise<AppealsListResponse> => {
    return request<AppealsListResponse>('/api/appeals/mine');
  },

  submitScore: async (payload: ScoreSubmissionPayload): Promise<unknown> => {
    const { taskId, inspectionId, ...rest } = payload;
    const body = {
      ...rest,
      totalScore: normalizeNumericScore(rest.totalScore),
    };

    if (inspectionId) {
      return request(`/api/inspections/${inspectionId}`, {
        method: 'PUT',
        body,
      });
    }

    return request(`/api/tasks/${taskId}/inspections`, {
      method: 'POST',
      body,
    });
  },

  adjustScore: async (payload: ScoreAdjustmentPayload): Promise<unknown> => {
    return request(`/api/inspections/${payload.inspectionId}`, {
      method: 'PUT',
      body: {
        totalScore: normalizeNumericScore(payload.totalScore),
        comments: payload.comments,
        photoUrls: payload.photoUrls,
      },
    });
  },

  loadInspectionRecord: async (
    taskId?: EntityId,
    dormId?: EntityId,
  ): Promise<InspectionsListResponse> => {
    if (!taskId || !dormId) {
      return { inspections: [] };
    }

    const queryString = buildQueryString({ taskId, dormId });
    return request<InspectionsListResponse>(
      `/api/inspections${queryString ? `?${queryString}` : ''}`,
    );
  },

  handleAppeal: async (payload: AppealHandlePayload): Promise<unknown> => {
    return request(`/api/appeals/${payload.appealId}`, {
      method: 'PUT',
      body: { status: payload.status, reply: payload.reply },
    });
  },

  createAppeal: async (payload: ServiceRecord): Promise<unknown> => {
    return request('/api/appeals', {
      method: 'POST',
      body: payload,
    });
  },

  fetchAssignedDorms: async (
    taskId?: EntityId,
    params: ServiceQueryParams = {},
  ): Promise<AssignedDormsResponse> => {
    if (!taskId) {
      return { dorms: [], total: 0 };
    }

    const queryString = buildQueryString(params);
    return request<AssignedDormsResponse>(
      `/api/tasks/${taskId}/dorms/my${queryString ? `?${queryString}` : ''}`,
    );
  },

  exportResults: async (params: ServiceQueryParams = {}): Promise<Blob> => {
    const queryString = buildQueryString(params);
    return request<Blob>(
      `/api/inspections/export${queryString ? `?${queryString}` : ''}`,
      {
        responseType: 'blob',
      },
    );
  },
};
