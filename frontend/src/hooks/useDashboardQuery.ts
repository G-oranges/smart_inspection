import { useQuery, useQueryClient } from '@tanstack/react-query';

import { request, tokenManager } from '../utils/api';

export interface DashboardTrendPoint {
  label?: string;
  score?: number | string | null;
}

export interface DashboardDistributionItem {
  name?: string;
  value?: number | string | null;
  [key: string]: string | number | null | undefined;
}

export interface DashboardRecentInspection {
  totalScore?: number | string | null;
  dormName?: string;
  inspectorName?: string;
  taskTitle?: string;
  createdAt?: string;
  [key: string]: unknown;
}

export interface DashboardSummary {
  totalDorms?: number;
  totalBeds?: number;
  occupiedBeds?: number;
  activeTasks?: number;
  pendingAppeals?: number;
  averageScore?: number | null;
  trendData?: DashboardTrendPoint[];
  distribution?: DashboardDistributionItem[];
  recentInspections?: DashboardRecentInspection[];
  [key: string]: unknown;
}

const DASHBOARD_SUMMARY_QUERY_KEY = ['dashboard', 'summary'] as const;

export function useDashboardSummary() {
  const hasToken = tokenManager.hasTokens();

  return useQuery<DashboardSummary | null>({
    queryKey: DASHBOARD_SUMMARY_QUERY_KEY,
    queryFn: async () => {
      if (!hasToken) {
        return null;
      }

      return request<DashboardSummary>('/api/dashboard/summary');
    },
    enabled: hasToken,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
  });
}

export function useInvalidateDashboard() {
  const queryClient = useQueryClient();

  return {
    invalidateSummary: () =>
      queryClient.invalidateQueries({ queryKey: DASHBOARD_SUMMARY_QUERY_KEY }),
  };
}
