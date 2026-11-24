import { useQuery, useQueryClient } from '@tanstack/react-query';

import { request, tokenManager } from '../utils/api';

export type DashboardRangeKey = 'month' | '3m' | '6m' | 'all';

export interface DashboardTrendPoint {
  label?: string;
  score?: number | string | null;
  count?: number | string | null;
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

export interface DashboardActiveTask {
  id: string;
  title: string;
  deadline?: string | null;
  totalDorms: number;
  completedDorms: number;
  myTotalDorms: number;
  myPendingDorms: number;
}

export interface DashboardLowScoreDorm {
  inspectionId: string;
  dormId: string;
  dormName: string;
  totalScore: number;
  taskId?: string;
  taskTitle: string;
  createdAt: string;
}

export interface DashboardFullScoreDorm {
  inspectionId: string;
  dormId: string;
  dormName: string;
  totalScore: number;
  taskId?: string;
  taskTitle: string;
  createdAt: string;
}

export interface DashboardPendingAppeal {
  id: string;
  inspectionId: string;
  dormName: string;
  studentName: string;
  totalScore?: number | null;
  content: string;
  createdAt: string;
}

export interface DashboardMyDormSummary {
  dormId: string;
  dormName: string;
  latestScore?: number | null;
  latestTime?: string | null;
  avgScore?: number | null;
  myPendingAppeals: number;
  hasActiveTask: boolean;
}

export interface DashboardSummary {
  range?: DashboardRangeKey;
  scopeLabel?: string;
  totalStudents?: number;
  totalDorms?: number;
  totalBeds?: number;
  occupiedBeds?: number;
  activeTasks?: number;
  pendingAppeals?: number;
  averageScore?: number | null;
  scoreDelta?: number | null;
  trendData?: DashboardTrendPoint[];
  distribution?: DashboardDistributionItem[];
  recentInspections?: DashboardRecentInspection[];
  activeTaskList?: DashboardActiveTask[];
  lowScoreDorms?: DashboardLowScoreDorm[];
  fullScoreDorms?: DashboardFullScoreDorm[];
  pendingAppealList?: DashboardPendingAppeal[];
  myDormSummary?: DashboardMyDormSummary | null;
  [key: string]: unknown;
}

const DASHBOARD_SUMMARY_BASE_KEY = ['dashboard', 'summary'] as const;

export function useDashboardSummary(
  roleKey?: string | number | null,
  range: DashboardRangeKey = '6m',
) {
  const hasToken = tokenManager.hasTokens();
  const scopedKey = [
    ...DASHBOARD_SUMMARY_BASE_KEY,
    roleKey ?? 'default',
    range,
  ] as const;

  return useQuery<DashboardSummary | null>({
    queryKey: scopedKey,
    queryFn: async () => {
      if (!hasToken) {
        return null;
      }

      return request<DashboardSummary>(
        `/api/dashboard/summary?range=${encodeURIComponent(range)}`,
      );
    },
    enabled: hasToken,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
    placeholderData: (previousData) => previousData,
  });
}

export function useInvalidateDashboard() {
  const queryClient = useQueryClient();

  return {
    invalidateSummary: () =>
      queryClient.invalidateQueries({ queryKey: DASHBOARD_SUMMARY_BASE_KEY }),
  };
}
