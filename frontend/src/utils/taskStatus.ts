export const TASK_STATUS_LABELS = {
  NOT_STARTED: '未开始',
  ONGOING: '进行中',
  FINISHED: '已结束',
} as const;

export const TASK_STATUS_COLORS = {
  NOT_STARTED: '#6c757d',
  ONGOING: '#28a745',
  FINISHED: '#6f42c1',
} as const;

type TaskStatus = keyof typeof TASK_STATUS_LABELS;

export function getTaskStatusLabel(status: string | null | undefined): string {
  return TASK_STATUS_LABELS[status as TaskStatus] || '未知';
}

export function getTaskStatusColor(status: string | null | undefined): string {
  return TASK_STATUS_COLORS[status as TaskStatus] || '#000';
}
