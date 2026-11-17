import { request } from '../utils/api';

export async function downloadTemplate(type: string): Promise<Blob> {
  return request<Blob>(`/api/templates/${type}`, {
    responseType: 'blob',
  });
}

export const templateService = {
  downloadTemplate,
};
