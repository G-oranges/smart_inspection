import dayjs from 'dayjs';

import type {
  AppealDormSummary,
  AppealQueryParams,
  AppealStatsResponse,
  AppealStatus,
} from '../../types/service';
import type {
  AppealColumnConfig,
  AppealCreateFormState,
  AppealFiltersState,
  AppealHandleFormState,
  AppealQueryBuilderInput,
} from './types';

export const APPEAL_TABLE_KEY = 'appeal_management';

export const APPEAL_STATUS_META: Record<
  AppealStatus,
  {
    label: string;
    tagColor: string;
    pillClass: string;
  }
> = {
  pending: {
    label: '待处理',
    tagColor: 'orange',
    pillClass: 'appeal-inline-pill--warning',
  },
  approved: {
    label: '已通过',
    tagColor: 'green',
    pillClass: 'appeal-inline-pill--success',
  },
  rejected: {
    label: '已驳回',
    tagColor: 'red',
    pillClass: 'appeal-inline-pill--error',
  },
  withdrawn: {
    label: '已撤回',
    tagColor: 'default',
    pillClass: 'appeal-inline-pill--muted',
  },
};

export const APPEAL_STATUS_OPTIONS: Array<{ value: AppealStatus; label: string }> = [
  { value: 'pending', label: '待处理' },
  { value: 'approved', label: '已通过' },
  { value: 'rejected', label: '已驳回' },
  { value: 'withdrawn', label: '已撤回' },
];

export const STUDENT_STATUS_SEGMENT_OPTIONS: Array<{
  value: AppealStatus | '';
  label: string;
}> = [
  { value: '', label: '全部' },
  { value: 'pending', label: '待处理' },
  { value: 'approved', label: '已通过' },
  { value: 'rejected', label: '已驳回' },
  { value: 'withdrawn', label: '已撤回' },
];

export const INITIAL_APPEAL_FILTERS: AppealFiltersState = {
  status: '',
  taskId: '',
  buildingId: '',
  dateRange: null,
};

export const INITIAL_APPEAL_STATS: AppealStatsResponse = {
  pending: 0,
  approved: 0,
  rejected: 0,
  withdrawn: 0,
  total: 0,
  avgHandleHours: 0,
};

export const INITIAL_APPEAL_CREATE_FORM: AppealCreateFormState = {
  inspectionId: '',
  content: '',
  disputedCodes: [],
  photos: [],
};

export const INITIAL_APPEAL_HANDLE_FORM: AppealHandleFormState = {
  appealId: '',
  status: 'approved',
  reply: '',
};

export const APPEAL_DEFAULT_COLUMNS: AppealColumnConfig[] = [
  { fieldKey: 'student', label: '申诉学生', visible: true, locked: true, order: 0 },
  { fieldKey: 'dorm', label: '宿舍', visible: true, order: 1 },
  { fieldKey: 'task', label: '查寝任务', visible: true, order: 2 },
  { fieldKey: 'score', label: '分数变化', visible: true, sortable: true, order: 3 },
  { fieldKey: 'content', label: '申诉理由', visible: true, order: 4 },
  { fieldKey: 'status', label: '状态', visible: true, sortable: true, order: 5 },
  { fieldKey: 'createdAt', label: '提交时间', visible: true, sortable: true, order: 6 },
  { fieldKey: 'handler', label: '处理信息', visible: true, sortable: true, order: 7 },
];

export function isValidAppealStatus(value: string | null | undefined): value is AppealStatus {
  return (
    value === 'pending' ||
    value === 'approved' ||
    value === 'rejected' ||
    value === 'withdrawn'
  );
}

export function formatAppealDormName(dorm?: AppealDormSummary | null): string {
  if (!dorm) {
    return '-';
  }
  const building = dorm.building || dorm.buildingRef?.name || '';
  const roomNo = dorm.roomNo || '';
  if (building && roomNo) {
    return `${building}-${roomNo}`;
  }
  return building || roomNo || '-';
}

export function formatAppealTime(value?: string | null): string {
  if (!value) {
    return '-';
  }
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format('YYYY-MM-DD HH:mm') : '-';
}

export function getActiveAppealFilterCount(filters: AppealFiltersState): number {
  let count = 0;
  if (filters.status) count += 1;
  if (filters.taskId) count += 1;
  if (filters.buildingId) count += 1;
  if (filters.dateRange && filters.dateRange[0] && filters.dateRange[1]) count += 1;
  return count;
}

export function buildAppealQueryParams({
  filters,
  keyword,
  page,
  pageSize,
  sortField,
  sortOrder,
}: AppealQueryBuilderInput): AppealQueryParams {
  const params: AppealQueryParams = {
    page,
    pageSize,
    sortBy: sortField || 'createdAt',
    sortOrder: sortOrder || 'desc',
  };

  const trimmedKeyword = keyword.trim();
  if (trimmedKeyword) {
    params.keyword = trimmedKeyword;
  }
  if (filters.status) {
    params.status = filters.status;
  }
  if (filters.taskId) {
    params.taskId = filters.taskId;
  }
  if (filters.buildingId) {
    params.buildingId = filters.buildingId;
  }
  if (filters.dateRange && filters.dateRange[0] && filters.dateRange[1]) {
    params.startAt = filters.dateRange[0].startOf('day').toISOString();
    params.endAt = filters.dateRange[1].endOf('day').toISOString();
  }

  return params;
}
