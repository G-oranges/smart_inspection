import { buildQueryString, request, tokenManager } from '../utils/api';

import type {
  AppealBatchPayload,
  AppealBatchResponse,
  AppealCreatePayload,
  AppealDeductionsResponse,
  AppealHandlePayload,
  AppealPhotoUploadResponse,
  AppealQueryParams,
  AppealRecord,
  AppealsListResponse,
  AppealStatsResponse,
  AppealStatus,
  EntityId,
  ServiceRecord,
} from '../types/service';

export const appealService = {
  getAppeals: async (
    params: AppealQueryParams = {},
    options?: { signal?: AbortSignal },
  ): Promise<AppealsListResponse> => {
    const queryString = buildQueryString(params);
    return request<AppealsListResponse>(
      `/api/appeals${queryString ? `?${queryString}` : ''}`,
      { signal: options?.signal },
    );
  },

  getMyAppeals: async (
    params: AppealQueryParams = {},
    options?: { signal?: AbortSignal },
  ): Promise<AppealsListResponse> => {
    const queryString = buildQueryString(params);
    return request<AppealsListResponse>(
      `/api/appeals/mine${queryString ? `?${queryString}` : ''}`,
      { signal: options?.signal },
    );
  },

  getAppealStats: async (
    params: AppealQueryParams = {},
    options?: { signal?: AbortSignal },
  ): Promise<AppealStatsResponse> => {
    const queryString = buildQueryString(params);
    return request<AppealStatsResponse>(
      `/api/appeals/stats${queryString ? `?${queryString}` : ''}`,
      { signal: options?.signal },
    );
  },

  getAppealDetail: async (
    id: EntityId,
    options?: { signal?: AbortSignal },
  ): Promise<AppealRecord> => {
    return request<AppealRecord>(
      `/api/appeals/${encodeURIComponent(String(id))}`,
      { signal: options?.signal },
    );
  },

  getAppealDeductions: async (
    id: EntityId,
    options?: { signal?: AbortSignal },
  ): Promise<AppealDeductionsResponse> => {
    return request<AppealDeductionsResponse>(
      `/api/appeals/${encodeURIComponent(String(id))}/deductions`,
      { signal: options?.signal },
    );
  },

  createAppeal: async (
    payload: AppealCreatePayload | ServiceRecord,
  ): Promise<AppealRecord> => {
    return request<AppealRecord>('/api/appeals', {
      method: 'POST',
      body: payload,
    });
  },

  handleAppeal: async (payload: AppealHandlePayload): Promise<AppealRecord> => {
    return request<AppealRecord>(
      `/api/appeals/${encodeURIComponent(String(payload.appealId ?? ''))}/status`,
      {
        method: 'PUT',
        body: {
          status: payload.status,
          reply: payload.reply,
          inspectionVersion: payload.inspectionVersion,
          deductionAdjustments: payload.deductionAdjustments,
        },
      },
    );
  },

  batchHandleAppeals: async (
    payload: AppealBatchPayload,
  ): Promise<AppealBatchResponse> => {
    return request<AppealBatchResponse>('/api/appeals/batch/status', {
      method: 'PUT',
      body: payload,
    });
  },

  withdrawAppeal: async (id: EntityId): Promise<{ status: AppealStatus }> => {
    return request<{ status: AppealStatus }>(
      `/api/appeals/${encodeURIComponent(String(id))}/withdraw`,
      {
        method: 'PUT',
      },
    );
  },

  uploadAppealPhoto: async (file: File): Promise<AppealPhotoUploadResponse> => {
    if (!tokenManager.hasTokens()) {
      throw new Error('未登录或登录已过期，请重新登录');
    }

    const formData = new FormData();
    formData.append('file', file);

    return request<AppealPhotoUploadResponse>('/api/appeals/photos', {
      method: 'POST',
      body: formData,
    });
  },

  fetchAppealPhotoBlob: async (
    photoUrl: string,
    signal?: AbortSignal,
  ): Promise<Blob> => {
    return request<Blob>(photoUrl, {
      responseType: 'blob',
      signal,
    });
  },
};
