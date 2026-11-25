import { Tag, Typography } from 'antd';
import { SwapOutlined } from '@ant-design/icons';

import type { AuditLogColumnConfig, AuditLogRecord } from './types';

export const AUDIT_LOG_TABLE_KEY = 'auditLogList';

export const AUDIT_LOG_COLUMN_WIDTHS: Record<string, number> = {
  createdAt: 180,
  action: 110,
  module: 110,
  description: 240,
  targetName: 130,
  operatorName: 130,
  ipAddress: 140,
};

export const AUDIT_LOG_DEFAULT_COLUMNS: AuditLogColumnConfig[] = [
  { fieldKey: 'createdAt', label: '时间', visible: true, sortable: true, order: 0 },
  { fieldKey: 'action', label: '操作类型', visible: true, sortable: true, order: 1 },
  { fieldKey: 'module', label: '模块', visible: true, sortable: true, order: 2 },
  { fieldKey: 'description', label: '操作描述', visible: true, sortable: false, order: 3 },
  { fieldKey: 'targetName', label: '目标', visible: true, sortable: true, order: 4 },
  { fieldKey: 'operatorName', label: '操作者', visible: true, sortable: true, order: 5 },
  { fieldKey: 'ipAddress', label: 'IP 地址', visible: true, sortable: true, order: 6 },
];

const { Text } = Typography;

export const ACTION_COLORS: Record<string, string> = {
  CREATE: 'green',
  UPDATE: 'blue',
  DELETE: 'red',
  LOGIN: 'cyan',
  LOGOUT: 'default',
  LOGIN_FAILED: 'orange',
  PERMISSION_CHANGE: 'purple',
  PASSWORD_RESET: 'gold',
  DISABLE: 'volcano',
  ENABLE: 'lime',
  IMPORT: 'geekblue',
  EXPORT: 'magenta',
};

export const MODULE_COLORS: Record<string, string> = {
  USER: '#1890ff',
  DORM: '#52c41a',
  STUDENT: '#722ed1',
  TEACHER: '#eb2f96',
  TASK: '#fa8c16',
  INSPECTION: '#13c2c2',
  PERMISSION: '#f5222d',
  ROLE: '#2f54eb',
  SETTINGS: '#faad14',
  AUTH: '#a0d911',
};

export const FIELD_LABELS: Record<string, string> = {
  title: '任务名称',
  date: '日期',
  deadline: '截止时间',
  timeSlot: '时间段',
  notes: '备注',
  description: '描述',
  dormCount: '宿舍数量',
  dorms: '宿舍列表',
  executorCount: '执行人数量',
  executors: '执行人列表',
};

export function formatDateTime(value: string | null | undefined): string {
  if (!value) {
    return '-';
  }
  const date = new Date(value);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function formatFieldValue(key: string, value: unknown): string {
  if (value === null || value === undefined) {
    return '未设置';
  }

  if (key === 'date' || key === 'deadline') {
    const date = new Date(String(value));
    if (key === 'date') {
      return date.toLocaleDateString('zh-CN');
    }
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return '无';
    }
    return value
      .map((item) => {
        if (item && typeof item === 'object' && 'name' in item) {
          return String((item as { name?: unknown }).name ?? '');
        }
        return String(item);
      })
      .join(', ');
  }

  if (typeof value === 'string') {
    return value || '未设置';
  }

  return String(value);
}

export function getLogTitle(log: AuditLogRecord): string {
  return log.description || `${log.action || ''} ${log.targetName || ''}`.trim();
}
