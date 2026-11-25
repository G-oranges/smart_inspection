import type { ColumnsType } from 'antd/es/table';
import { Button, Space, Tag, Tooltip } from 'antd';
import { AuditOutlined, EyeOutlined, PictureOutlined } from '@ant-design/icons';

import {
  APPEAL_STATUS_META,
  formatAppealDormName,
  formatAppealTime,
} from './appealSchema';
import type { AppealRecord } from '../../types/service';

function renderScoreCell(record: AppealRecord) {
  const baseScore =
    record.originalScore ?? record.inspection?.totalScore ?? null;

  if (
    record.status === 'approved' &&
    record.adjustedScore !== null &&
    record.adjustedScore !== undefined &&
    baseScore !== null
  ) {
    const delta =
      record.scoreDelta ?? record.adjustedScore - baseScore;
    const deltaText =
      delta > 0 ? `+${delta}` : delta < 0 ? `${delta}` : '不变';
    const deltaClass =
      delta > 0
        ? 'appeal-score-delta--up'
        : delta < 0
          ? 'appeal-score-delta--down'
          : 'appeal-score-delta--same';

    return (
      <div className="flex flex-col items-center leading-tight">
        <span className="font-semibold" style={{ color: 'var(--co-text)' }}>
          {baseScore} → {record.adjustedScore}
        </span>
        <span className={`text-xs ${deltaClass}`}>({deltaText})</span>
      </div>
    );
  }

  return (
    <span className="font-semibold" style={{ color: 'var(--co-primary)' }}>
      {baseScore !== null ? `${baseScore} 分` : '-'}
    </span>
  );
}

export function createAppealColumns(): ColumnsType<AppealRecord> {
  return [
    {
      title: '申诉学生',
      key: 'student',
      width: 160,
      render: (_, record) => (
        <div className="flex flex-col">
          <span className="font-semibold" style={{ color: 'var(--co-text)' }}>
            {record.student?.fullName || '-'}
          </span>
          <span className="text-xs" style={{ color: 'var(--co-text-muted)' }}>
            {record.student?.studentNo || '-'}
            {record.student?.college ? ` · ${record.student.college}` : ''}
          </span>
        </div>
      ),
    },
    {
      title: '宿舍',
      key: 'dorm',
      width: 130,
      render: (_, record) => (
        <span className="font-medium" style={{ color: 'var(--co-text)' }}>
          {formatAppealDormName(record.inspection?.dorm)}
        </span>
      ),
    },
    {
      title: '查寝任务',
      key: 'task',
      width: 160,
      render: (_, record) => (
        <span className="truncate block max-w-[160px]" style={{ color: 'var(--co-text)' }}>
          {record.inspection?.task?.title || '-'}
        </span>
      ),
    },
    {
      title: '分数变化',
      key: 'score',
      dataIndex: 'scoreDelta',
      width: 120,
      align: 'center',
      sorter: true,
      render: (_, record) => renderScoreCell(record),
    },
    {
      title: '申诉理由',
      key: 'content',
      width: 260,
      render: (_, record) => {
        const disputedCount = Array.isArray(record.disputedCodes)
          ? record.disputedCodes.length
          : 0;
        const photoCount = Array.isArray(record.photos) ? record.photos.length : 0;

        return (
          <div className="flex flex-col gap-1 min-w-0">
            <Tooltip title={record.content}>
              <span
                className="truncate block max-w-[240px]"
                style={{ color: 'var(--co-text)' }}
              >
                {record.content || '-'}
              </span>
            </Tooltip>
            {disputedCount > 0 || photoCount > 0 || record.inspectionChanged ? (
              <div className="flex items-center gap-1.5 flex-wrap">
                {disputedCount > 0 ? (
                  <span className="appeal-inline-pill appeal-inline-pill--warning">
                    异议 {disputedCount} 项
                  </span>
                ) : null}
                {photoCount > 0 ? (
                  <span className="appeal-inline-pill appeal-inline-pill--primary gap-1">
                    <PictureOutlined /> {photoCount}
                  </span>
                ) : null}
                {record.inspectionChanged ? (
                  <span className="appeal-inline-pill appeal-inline-pill--error">
                    记录已变更
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      },
    },
    {
      title: '状态',
      key: 'status',
      dataIndex: 'status',
      width: 110,
      align: 'center',
      sorter: true,
      render: (status: AppealRecord['status']) => {
        const meta = APPEAL_STATUS_META[status] || APPEAL_STATUS_META.pending;
        return (
          <Tag color={meta.tagColor} className="rounded-full px-2.5 border-none font-medium !m-0">
            {meta.label}
          </Tag>
        );
      },
    },
    {
      title: '提交时间',
      key: 'createdAt',
      dataIndex: 'createdAt',
      width: 155,
      sorter: true,
      render: (value: string) => (
        <span className="font-mono text-xs" style={{ color: 'var(--co-text-secondary)' }}>
          {formatAppealTime(value)}
        </span>
      ),
    },
    {
      title: '处理信息',
      key: 'handler',
      dataIndex: 'handledAt',
      width: 165,
      sorter: true,
      render: (_, record) => {
        if (!record.handledAt && !record.handledBy) {
          return <span className="text-xs" style={{ color: 'var(--co-text-muted)' }}>-</span>;
        }
        return (
          <div className="flex flex-col leading-tight">
            <span className="text-xs font-medium" style={{ color: 'var(--co-text)' }}>
              {record.handledBy?.fullName || record.handledBy?.username || '-'}
            </span>
            <span className="text-[11px] font-mono" style={{ color: 'var(--co-text-muted)' }}>
              {formatAppealTime(record.handledAt)}
            </span>
          </div>
        );
      },
    },
  ];
}

export function createAppealActionColumn({
  canHandle,
  onOpenDetail,
  onOpenHandle,
}: {
  canHandle: boolean;
  onOpenDetail: (record: AppealRecord) => void;
  onOpenHandle: (record: AppealRecord) => void;
}): ColumnsType<AppealRecord>[number] {
  return {
    title: '操作',
    key: 'actions',
    fixed: 'right',
    width: canHandle ? 88 : 52,
    className: 'table-action-column',
    render: (_, record) => (
      <Space size={6} className="table-action-buttons dorm-table-action-group">
        <Tooltip title="查看详情">
          <Button
            type="text"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => onOpenDetail(record)}
            className="dorm-table-action-btn is-view"
            aria-label="查看详情"
          />
        </Tooltip>
        {canHandle && record.status === 'pending' ? (
          <Tooltip title="处理申诉">
            <Button
              type="text"
              size="small"
              icon={<AuditOutlined />}
              onClick={() => onOpenHandle(record)}
              className="dorm-table-action-btn is-edit"
              aria-label="处理申诉"
            />
          </Tooltip>
        ) : null}
      </Space>
    ),
  };
}
