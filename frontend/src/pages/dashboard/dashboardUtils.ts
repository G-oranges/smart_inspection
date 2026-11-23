import dayjs from 'dayjs';

import type {
  DashboardDistributionItem,
  DashboardRecentInspection,
  DashboardSummary,
  DashboardTrendPoint,
} from '../../hooks/useDashboardQuery';

export type DashboardViewMode = 'manager' | 'inspector' | 'student';

export type ScoreTone = 'success' | 'primary' | 'warning' | 'error';

export interface DashboardStatSnapshot {
  totalStudents: number;
  totalDorms: number;
  totalBeds: number;
  occupiedBeds: number;
  occupancyRate: number;
  activeTasks: number;
  pendingAppeals: number;
  avgScoreValue: number;
  avgScoreText: string;
}

export interface DashboardTrendItem {
  month: string;
  score: number;
}

export interface NormalizedDistributionItem {
  name: string;
  value: number;
  percent: number;
  tone: ScoreTone;
  [key: string]: string | number;
}

export interface NormalizedInspectionItem {
  id: string;
  dormLabel: string;
  inspectorLabel: string;
  taskLabel: string;
  totalScore: number;
  scoreTone: ScoreTone;
  timeText: string;
}

export interface QuickActionConfig {
  key: string;
  label: string;
  path: string;
  tone: ScoreTone;
  badge?: number;
}

export function toFiniteNumber(value: number | string | null | undefined): number {
  const nextValue = Number(value);
  return Number.isFinite(nextValue) ? nextValue : 0;
}

export function resolveDashboardViewMode(
  hasPermission: (code: string) => boolean,
): DashboardViewMode {
  const hasManagementPermission =
    hasPermission('DORM_VIEW') ||
    hasPermission('STUDENT_VIEW') ||
    hasPermission('TASK_PUBLISH') ||
    hasPermission('TASK_EDIT') ||
    hasPermission('TEACHER_MANAGE') ||
    hasPermission('PERMISSION_MANAGE') ||
    hasPermission('SYSTEM_SETTINGS');

  if (hasManagementPermission) {
    return 'manager';
  }

  if (hasPermission('RESULT_RECORD')) {
    return 'inspector';
  }

  return 'student';
}

export function buildStatSnapshot(
  summary: DashboardSummary | null | undefined,
): DashboardStatSnapshot {
  const totalStudents = toFiniteNumber(summary?.totalStudents);
  const totalDorms = toFiniteNumber(summary?.totalDorms);
  const totalBeds = toFiniteNumber(summary?.totalBeds);
  const occupiedBeds = toFiniteNumber(summary?.occupiedBeds);
  const occupancyRate =
    totalBeds > 0 ? Math.min(100, Math.round((occupiedBeds / totalBeds) * 100)) : 0;
  const activeTasks = toFiniteNumber(summary?.activeTasks);
  const pendingAppeals = toFiniteNumber(summary?.pendingAppeals);
  const avgScoreValue = toFiniteNumber(summary?.averageScore);

  return {
    totalStudents,
    totalDorms,
    totalBeds,
    occupiedBeds,
    occupancyRate,
    activeTasks,
    pendingAppeals,
    avgScoreValue,
    avgScoreText: avgScoreValue.toFixed(1),
  };
}

export function normalizeTrendData(
  trendData?: DashboardTrendPoint[],
): DashboardTrendItem[] {
  return (trendData || []).map((item) => ({
    month: item.label || '--',
    score: Number(toFiniteNumber(item.score).toFixed(1)),
  }));
}

const DISTRIBUTION_ORDER: Array<{ name: string; tone: ScoreTone }> = [
  { name: '优秀', tone: 'success' },
  { name: '良好', tone: 'primary' },
  { name: '及格', tone: 'warning' },
  { name: '不及格', tone: 'error' },
];

export function normalizeDistributionData(
  distribution?: DashboardDistributionItem[],
): NormalizedDistributionItem[] {
  const rawList = (distribution || []).map((item) => ({
    name: String(item.name || '').trim() || '其他',
    value: toFiniteNumber(item.value),
  }));
  const total = rawList.reduce((acc, item) => acc + item.value, 0);

  const toneByName = new Map<string, ScoreTone>(
    DISTRIBUTION_ORDER.map((item) => [item.name, item.tone]),
  );
  const orderByName = new Map<string, number>(
    DISTRIBUTION_ORDER.map((item, idx) => [item.name, idx]),
  );

  return rawList
    .sort(
      (a, b) =>
        (orderByName.get(a.name) ?? 99) - (orderByName.get(b.name) ?? 99),
    )
    .map((item, index) => ({
      name: item.name,
      value: item.value,
      percent: total > 0 ? Math.round((item.value / total) * 100) : 0,
      tone:
        toneByName.get(item.name) ??
        DISTRIBUTION_ORDER[index % DISTRIBUTION_ORDER.length].tone,
    }));
}

export function getScoreTone(score: number): ScoreTone {
  if (score >= 90) return 'success';
  if (score >= 80) return 'primary';
  if (score >= 60) return 'warning';
  return 'error';
}

export function formatDormLabel(item: DashboardRecentInspection): string {
  if (item.dormName && item.dormName.trim()) {
    return item.dormName.trim();
  }

  const building = item.dorm?.building?.trim() || '';
  const roomNo = item.dorm?.roomNo?.trim() || '';
  if (building && roomNo) {
    return `${building}-${roomNo}`;
  }
  if (item.dorm?.name?.trim()) {
    return item.dorm.name.trim();
  }
  return building || roomNo || '未命名宿舍';
}

export function formatInspectorLabel(item: DashboardRecentInspection): string {
  if (item.inspectorName && item.inspectorName.trim()) {
    return item.inspectorName.trim();
  }
  const fullName = item.createdBy?.fullName?.trim();
  if (fullName) {
    return fullName;
  }
  const username = item.createdBy?.username?.trim();
  if (username) {
    return username;
  }
  return '查寝员';
}

export function formatTaskLabel(item: DashboardRecentInspection): string {
  if (item.taskTitle && item.taskTitle.trim()) {
    return item.taskTitle.trim();
  }
  if (item.task?.title?.trim()) {
    return item.task.title.trim();
  }
  return '日常查寝';
}

export function formatInspectionTime(createdAt?: string): string {
  if (!createdAt) {
    return '--';
  }
  const parsed = dayjs(createdAt);
  if (!parsed.isValid()) {
    return '--';
  }
  const diffMinutes = dayjs().diff(parsed, 'minute');
  if (diffMinutes >= 0 && diffMinutes < 60) {
    return diffMinutes <= 1 ? '刚刚' : `${diffMinutes} 分钟前`;
  }
  if (parsed.isSame(dayjs(), 'day')) {
    return `今天 ${parsed.format('HH:mm')}`;
  }
  return parsed.format('MM-DD HH:mm');
}

export function normalizeRecentInspections(
  list?: DashboardRecentInspection[],
): NormalizedInspectionItem[] {
  return (list || []).map((item, idx) => {
    const totalScore = toFiniteNumber(item.totalScore);
    return {
      id: item.id || `${formatDormLabel(item)}-${item.createdAt || idx}`,
      dormLabel: formatDormLabel(item),
      inspectorLabel: formatInspectorLabel(item),
      taskLabel: formatTaskLabel(item),
      totalScore,
      scoreTone: getScoreTone(totalScore),
      timeText: formatInspectionTime(item.createdAt),
    };
  });
}

export function buildQuickActions(
  hasPermission: (code: string) => boolean,
  stats: DashboardStatSnapshot,
  activeRoleCode?: string | null,
): QuickActionConfig[] {
  const candidates: Array<QuickActionConfig & { visible: boolean }> = [
    {
      key: 'entry',
      label: '分数录入',
      path: '/tasks/entry',
      tone: 'primary',
      badge: stats.activeTasks > 0 ? stats.activeTasks : undefined,
      visible: hasPermission('RESULT_RECORD'),
    },
    {
      key: 'publish',
      label: '发布任务',
      path: '/tasks/publish',
      tone: 'primary',
      visible: hasPermission('TASK_PUBLISH'),
    },
    {
      key: 'results',
      label: stats.pendingAppeals > 0 ? '处理申诉' : '查寝结果',
      path: '/results',
      tone: stats.pendingAppeals > 0 ? 'error' : 'success',
      badge: stats.pendingAppeals > 0 ? stats.pendingAppeals : undefined,
      visible: hasPermission('RESULT_VIEW'),
    },
    {
      key: 'occupancy',
      label: '入住管理',
      path: '/occupancy',
      tone: 'success',
      visible: hasPermission('DORM_VIEW'),
    },
    {
      key: 'students',
      label: '学生管理',
      path: '/students',
      tone: 'warning',
      visible: hasPermission('STUDENT_VIEW'),
    },
    {
      key: 'dorms',
      label: '宿舍管理',
      path: '/dorms',
      tone: 'primary',
      visible: hasPermission('DORM_VIEW') && activeRoleCode !== 'LEADER',
    },
    {
      key: 'teachers',
      label: '教师管理',
      path: '/teachers',
      tone: 'primary',
      visible: hasPermission('TEACHER_MANAGE'),
    },
    {
      key: 'audit',
      label: '审计日志',
      path: '/audit-logs',
      tone: 'warning',
      visible: hasPermission('PERMISSION_MANAGE'),
    },
  ];

  return candidates.filter((item) => item.visible).slice(0, 6);
}
