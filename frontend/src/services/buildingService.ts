import { buildQueryString, request } from '../utils/api';

import type { RequestOptions } from '../types/api';
import type { EntityId } from '../types/service';
import type {
  BuildingFormPayload,
  BuildingImportPreviewResult,
  BuildingQueryParams,
  BuildingRecord,
  BuildingTableResponse,
} from '../pages/building/types';

export function getBuildings(
  params: BuildingQueryParams = {},
  options: RequestOptions = {},
): Promise<BuildingTableResponse> {
  const queryString = buildQueryString(params);
  return request<BuildingTableResponse>(
    `/api/buildings${queryString ? `?${queryString}` : ''}`,
    {
      method: 'GET',
      ...options,
    },
  );
}

export function getAllBuildings(
  options: RequestOptions = {},
): Promise<BuildingRecord[]> {
  return request<BuildingRecord[]>('/api/buildings/all', {
    method: 'GET',
    ...options,
  });
}

export function createBuilding(data: BuildingFormPayload): Promise<unknown> {
  return request('/api/buildings', {
    method: 'POST',
    body: data,
  });
}

export function updateBuilding(
  id: EntityId,
  data: BuildingFormPayload,
): Promise<unknown> {
  return request(`/api/buildings/${id}`, {
    method: 'PUT',
    body: data,
  });
}

export function deleteBuilding(id: EntityId): Promise<unknown> {
  return request(`/api/buildings/${id}`, {
    method: 'DELETE',
  });
}

export function batchDeleteBuildings(ids: EntityId[]): Promise<unknown> {
  return request('/api/buildings/batch', {
    method: 'DELETE',
    body: { ids },
  });
}

export function exportBuildings(
  params: BuildingQueryParams = {},
): Promise<Blob> {
  const queryString = buildQueryString(params);
  return request<Blob>(
    `/api/buildings/export${queryString ? `?${queryString}` : ''}`,
    {
      method: 'GET',
      responseType: 'blob',
    },
  );
}

export function importBuildings(
  file: File,
  resolution = 'overwrite',
): Promise<{ message?: string; successCount?: number }> {
  const formData = new FormData();
  formData.append('file', file);
  return request(`/api/buildings/import?resolution=${resolution}`, {
    method: 'POST',
    body: formData,
  });
}

export function previewImportBuildings(
  file: File,
): Promise<BuildingImportPreviewResult> {
  const formData = new FormData();
  formData.append('file', file);
  return request<BuildingImportPreviewResult>('/api/buildings/import/preview', {
    method: 'POST',
    body: formData,
  });
}

export function downloadBuildingTemplate(): Promise<Blob> {
  return request<Blob>('/api/templates/buildings', {
    method: 'GET',
    responseType: 'blob',
  });
}
