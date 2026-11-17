import dayjs from 'dayjs';

import { DORM_FILTER_KEYS, TASK_FILTER_KEYS } from './taskPublishSchema';
import { areFiltersEqual } from '../../utils/filterUtils';

import type {
  DormFiltersState,
  TaskDorm,
  TaskExecutor,
  TaskFiltersState,
  TaskPublishStatsState,
  TaskPublishTask,
  TaskPublishUserLookup,
  TaskStatusKey,
} from './types';

export function normalizeDateRangeValue(range: TaskFiltersState['customRange'] | unknown): Array<number | string> {
  if (!Array.isArray(range) || range.length !== 2) {
    return [];
  }

  return range
    .map((value) => (value ? (value as { valueOf?: () => number }).valueOf?.() ?? String(value) : ''))
    .filter(Boolean);
}

export function areArraysEqual(
  left: Array<number | string>,
  right: Array<number | string>,
): boolean {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }

  return true;
}

export function areDormFiltersEqual(
  left: DormFiltersState,
  right: DormFiltersState,
): boolean {
  return areFiltersEqual(
    left as unknown as Record<string, unknown>,
    right as unknown as Record<string, unknown>,
    DORM_FILTER_KEYS as string[],
  );
}

export function areTaskFiltersEqual(
  left: TaskFiltersState,
  right: TaskFiltersState,
): boolean {
  for (const key of TASK_FILTER_KEYS) {
    const leftValue = left?.[key] ?? '';
    const rightValue = right?.[key] ?? '';
    if (leftValue !== rightValue) {
      return false;
    }
  }

  return areArraysEqual(
    normalizeDateRangeValue(left?.customRange),
    normalizeDateRangeValue(right?.customRange),
  );
}

export function resolveDormColleges(dorm: TaskDorm): string[] {
  if (Array.isArray(dorm?.dormColleges) && dorm.dormColleges.length > 0) {
    return dorm.dormColleges.filter(Boolean);
  }
  return [];
}

export function resolveDormGrades(dorm: TaskDorm): string[] {
  if (Array.isArray(dorm?.dormGrades) && dorm.dormGrades.length > 0) {
    return dorm.dormGrades.filter(Boolean);
  }
  if (typeof dorm?.grade === 'string' && dorm.grade) {
    return [dorm.grade];
  }
  return [];
}

export function getTaskStatusKey(task: TaskPublishTask): TaskStatusKey {
  const now = dayjs();
  const startAt = task?.date ? dayjs(task.date) : null;
  const endAt = task?.deadline ? dayjs(task.deadline) : null;

  if (endAt?.isValid() && now.isAfter(endAt)) {
    return 'ended';
  }
  if (startAt?.isValid() && now.isBefore(startAt)) {
    return 'upcoming';
  }
  return 'inProgress';
}

export function getTaskStatusConfig(task: TaskPublishTask) {
  const status = getTaskStatusKey(task);
  if (status === 'ended') {
    return {
      label: '已结束',
      color: 'default',
      className: 'task-status-pill task-status-pill-muted',
    };
  }
  if (status === 'upcoming') {
    return {
      label: '待开启',
      color: 'warning',
      className: 'task-status-pill',
    };
  }
  return {
    label: '进行中',
    color: 'success',
    className: 'task-status-pill',
  };
}

export function getTaskStats(tasks: TaskPublishTask[]): TaskPublishStatsState {
  const list = Array.isArray(tasks) ? tasks : [];
  const now = dayjs();
  const total = list.length;
  let upcoming = 0;
  let inProgress = 0;
  let inspected = 0;
  let totalDorms = 0;
  let recentCount = 0;
  let previousCount = 0;
  const recentStart = now.subtract(30, 'day');
  const previousStart = now.subtract(60, 'day');
  const previousEnd = now.subtract(30, 'day');

  list.forEach((task) => {
    const startAt = task?.date ? dayjs(task.date) : null;
    const endAt = task?.deadline ? dayjs(task.deadline) : null;
    if (endAt?.isValid() && now.isAfter(endAt)) {
      // ended
    } else if (startAt?.isValid() && now.isBefore(startAt)) {
      upcoming += 1;
    } else {
      inProgress += 1;
    }

    totalDorms += task?.dormIds?.length || 0;
    inspected += Number(task?.inspectionCount || task?.inspectedCount || 0);

    if (startAt?.isValid()) {
      if (startAt.isAfter(recentStart)) {
        recentCount += 1;
      } else if (startAt.isAfter(previousStart) && startAt.isBefore(previousEnd)) {
        previousCount += 1;
      }
    }
  });

  const coverageRate = totalDorms ? Math.round((inspected / totalDorms) * 100) : 0;
  const momGrowth =
    previousCount > 0
      ? Math.round(((recentCount - previousCount) / previousCount) * 100)
      : null;

  return {
    total,
    upcoming,
    inProgress,
    inspected,
    totalDorms,
    coverageRate,
    momGrowth,
  };
}

export function filterTasks({
  tasks,
  searchTerm,
  filters,
  userLookup,
}: {
  tasks: TaskPublishTask[];
  searchTerm: string;
  filters: TaskFiltersState;
  userLookup: TaskPublishUserLookup;
}): TaskPublishTask[] {
  const keyword = searchTerm.trim().toLowerCase();
  const now = dayjs();
  let rangeStart: dayjs.Dayjs | null = null;
  let rangeEnd: dayjs.Dayjs | null = null;

  if (filters.timeRange === 'week') {
    rangeStart = now.subtract(7, 'day').startOf('day');
    rangeEnd = now.endOf('day');
  } else if (filters.timeRange === 'month') {
    rangeStart = now.subtract(30, 'day').startOf('day');
    rangeEnd = now.endOf('day');
  } else if (filters.timeRange === 'custom' && filters.customRange.length === 2) {
    rangeStart = filters.customRange[0]?.startOf('day') ?? null;
    rangeEnd = filters.customRange[1]?.endOf('day') ?? null;
  }

  return (Array.isArray(tasks) ? tasks : []).filter((task) => {
    if (keyword) {
      const baseText = [
        task?.title,
        task?.notes,
        task?.description,
        task?.createdByName,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      const executorMatch = (task?.executorIds || []).some((id) => {
        const executor = userLookup[String(id)] as TaskExecutor | undefined;
        const name = executor?.fullName || executor?.username || '';
        return name.toLowerCase().includes(keyword);
      });
      if (!baseText.includes(keyword) && !executorMatch) {
        return false;
      }
    }

    if (filters.status) {
      const status = getTaskStatusKey(task);
      if (status !== filters.status) {
        return false;
      }
    }

    if (
      filters.executorId &&
      !(task?.executorIds || []).some((id) => String(id) === String(filters.executorId))
    ) {
      return false;
    }

    if (rangeStart && rangeEnd) {
      const startAt = task?.date ? dayjs(task.date) : null;
      const endAt = task?.deadline ? dayjs(task.deadline) : startAt;
      if (startAt?.isValid() && endAt?.isValid()) {
        const overlaps = startAt.isBefore(rangeEnd) && endAt.isAfter(rangeStart);
        if (!overlaps) {
          return false;
        }
      }
    }

    return true;
  });
}
