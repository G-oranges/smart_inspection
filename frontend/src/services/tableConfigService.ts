import { buildQueryString, request } from '../utils/api';

import type { TableConfigResponse } from '../types/service';

export const tableConfigService = {
  getTableConfig: async (tableKey: string): Promise<TableConfigResponse> => {
    const queryString = buildQueryString({ tableKey });
    return request<TableConfigResponse>(
      `/api/table-config${queryString ? `?${queryString}` : ''}`,
    );
  },

  saveTableConfig: async (
    tableKey: string,
    config: unknown,
  ): Promise<TableConfigResponse> => {
    return request<TableConfigResponse>('/api/table-config', {
      method: 'PUT',
      body: { tableKey, config },
    });
  },
};
