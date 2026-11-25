import { useQuery, useQueryClient } from '@tanstack/react-query';

import { appealService } from '../services/appealService';
import { tokenManager } from '../utils/api';

import type {
  AppealDeductionsResponse,
  AppealQueryParams,
  AppealRecord,
  AppealStatsResponse,
} from '../types/service';

export const APPEALS_BASE_KEY = ['appeals'] as const;
const DASHBOARD_SUMMARY_KEY = ['dashboard', 'summary'] as const;

export interface AppealsListQueryData {
  appeals: AppealRecord[];
  total: number;
}

export function useAppealsListQuery(
  params: AppealQueryParams,
  options: {
    isStudent: boolean;
    enabled?: boolean;
    roleKey?: string | number | null;
  },
) {
  const hasToken = tokenManager.hasTokens();
  const isEnabled = hasToken && (options.enabled ?? true);

  return useQuery<AppealsListQueryData>({
    queryKey: [
      ...APPEALS_BASE_KEY,
      options.isStudent ? 'mine' : 'list',
      options.roleKey ?? 'default',
      params,
    ] as const,
    queryFn: async ({ signal }) => {
      const response = options.isStudent
        ? await appealService.getMyAppeals(params, { signal })
        : await appealService.getAppeals(params, { signal });
      const appeals = Array.isArray(response?.appeals) ? response.appeals : [];
      return {
        appeals,
        total: typeof response?.total === 'number' ? response.total : appeals.length,
      };
    },
    enabled: isEnabled,
    staleTime: 30 * 1000,
    placeholderData: (previousData) => previousData,
  });
}

export function useAppealStatsQuery(
  params: AppealQueryParams,
  options: {
    enabled?: boolean;
    roleKey?: string | number | null;
  } = {},
) {
  const hasToken = tokenManager.hasTokens();
  const isEnabled = hasToken && (options.enabled ?? true);
  const { keyword, taskId, buildingId, startAt, endAt } = params;
  const statsParams: AppealQueryParams = {
    keyword,
    taskId,
    buildingId,
    startAt,
    endAt,
  };

  return useQuery<AppealStatsResponse>({
    queryKey: [
      ...APPEALS_BASE_KEY,
      'stats',
      options.roleKey ?? 'default',
      statsParams,
    ] as const,
    queryFn: ({ signal }) => appealService.getAppealStats(statsParams, { signal }),
    enabled: isEnabled,
    staleTime: 30 * 1000,
    placeholderData: (previousData) => previousData,
  });
}

export function useAppealDetailQuery(
  appealId: string | null | undefined,
  options: { enabled?: boolean } = {},
) {
  const hasToken = tokenManager.hasTokens();
  const normalizedId = appealId ? String(appealId).trim() : '';

  return useQuery<AppealRecord | null>({
    queryKey: [...APPEALS_BASE_KEY, 'detail', normalizedId] as const,
    queryFn: ({ signal }) =>
      normalizedId
        ? appealService.getAppealDetail(normalizedId, { signal })
        : Promise.resolve(null),
    enabled: hasToken && Boolean(normalizedId) && (options.enabled ?? true),
    staleTime: 15 * 1000,
  });
}

export function useAppealDeductionsQuery(
  appealId: string | null | undefined,
  options: { enabled?: boolean } = {},
) {
  const hasToken = tokenManager.hasTokens();
  const normalizedId = appealId ? String(appealId).trim() : '';

  return useQuery<AppealDeductionsResponse | null>({
    queryKey: [...APPEALS_BASE_KEY, 'deductions', normalizedId] as const,
    queryFn: ({ signal }) =>
      normalizedId
        ? appealService.getAppealDeductions(normalizedId, { signal })
        : Promise.resolve(null),
    enabled: hasToken && Boolean(normalizedId) && (options.enabled ?? true),
    staleTime: 0,
    gcTime: 60 * 1000,
    refetchOnMount: 'always',
  });
}

export function useInvalidateAppeals() {
  const queryClient = useQueryClient();

  return {
    invalidateAllAppeals: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: APPEALS_BASE_KEY }),
        queryClient.invalidateQueries({ queryKey: DASHBOARD_SUMMARY_KEY }),
      ]);
    },
    invalidateDeductions: async (appealId: string) => {
      await queryClient.invalidateQueries({
        queryKey: [...APPEALS_BASE_KEY, 'deductions', appealId],
      });
    },
  };
}
