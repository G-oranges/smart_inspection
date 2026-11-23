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

export interface DashboardInspectionDorm {
  id?: string;
  building?: string | null;
  floor?: number | null;
  roomNo?: string | null;
  name?: string | null;
}

export interface DashboardInspectionUser {
  id?: string;
  fullName?: string | null;
  username?: string | null;
}

export interface DashboardInspectionTask {
  id?: string;
  title?: string | null;
}

export interface DashboardRecentInspection {
  id?: string;
  totalScore?: number | string | null;
  dormName?: string | null;
  inspectorName?: string | null;
  taskTitle?: string | null;
  createdAt?: string;
  dorm?: DashboardInspectionDorm | null;
  createdBy?: DashboardInspectionUser | null;
  task?: DashboardInspectionTask | null;
  [key: string]: unknown;
}

export interface DashboardSummary {
  totalStudents?: number;
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

const DASHBOARD_SUMMARY_BASE_KEY = ['dashboard', 'summary'] as const;

export function useDashboardSummary(roleKey?: string | number | null) {
  const hasToken = tokenManager.hasTokens();
  const scopedKey = [...DASHBOARD_SUMMARY_BASE_KEY, roleKey ?? 'default'] as const;

  return useQuery<DashboardSummary | null>({
    queryKey: scopedKey,
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
      queryClient.invalidateQueries({ queryKey: DASHBOARD_SUMMARY_BASE_KEY }),
  };
}
