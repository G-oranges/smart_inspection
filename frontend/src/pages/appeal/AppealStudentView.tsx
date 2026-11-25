import { Alert, Button, Empty, Pagination, Segmented, Skeleton, Space, Tag } from 'antd';
import { EyeOutlined, PlusOutlined, PictureOutlined, RollbackOutlined } from '@ant-design/icons';

import {
  APPEAL_STATUS_META,
  STUDENT_STATUS_SEGMENT_OPTIONS,
  formatAppealDormName,
  formatAppealTime,
} from './appealSchema';
import type { AppealRecord, AppealStatus } from '../../types/service';

export interface AppealStudentViewProps {
  items: AppealRecord[];
  total: number;
  loading: boolean;
  errorMessage: string | null;
  statusFilter: AppealStatus | '';
  page: number;
  pageSize: number;
  isMobile: boolean;
  onStatusChange: (status: AppealStatus | '') => void;
  onPageChange: (page: number, pageSize?: number) => void;
  onRetry: () => void;
  onOpenCreate: () => void;
  onOpenDetail: (appeal: AppealRecord) => void;
  onWithdraw: (appeal: AppealRecord) => void;
}

export default function AppealStudentView({
  items,
  total,
  loading,
  errorMessage,
  statusFilter,
  page,
  pageSize,
  isMobile,
  onStatusChange,
  onPageChange,
  onRetry,
  onOpenCreate,
  onOpenDetail,
  onWithdraw,
}: AppealStudentViewProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <Segmented
          block={isMobile}
          value={statusFilter}
          onChange={(val) => onStatusChange(val as AppealStatus | '')}
          options={STUDENT_STATUS_SEGMENT_OPTIONS}
        />
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={onOpenCreate}
          className="apple-btn-primary co-press"
        >
          发起申诉
        </Button>
      </div>

      {errorMessage ? (
        <Alert
          type="error"
          showIcon
          message={errorMessage}
          action={
            <Button size="small" onClick={onRetry}>
              重试
            </Button>
          }
        />
      ) : loading && items.length === 0 ? (
        <div className="space-y-3">
          <Skeleton active className="appeal-student-card" />
          <Skeleton active className="appeal-student-card" />
        </div>
      ) : items.length === 0 ? (
        <div className="co-glass-panel py-16 flex flex-col items-center justify-center gap-3">
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={statusFilter ? '该状态下没有申诉记录' : '还没有提交过申诉'}
          />
          {!statusFilter ? (
            <Button
              type="primary"
              className="apple-btn-primary"
              icon={<PlusOutlined />}
              onClick={onOpenCreate}
            >
              发起第一条申诉
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="space-y-3 co-stagger">
          {items.map((appeal) => {
            const statusMeta =
              APPEAL_STATUS_META[appeal.status] || APPEAL_STATUS_META.pending;
            const baseScore =
              appeal.originalScore ?? appeal.inspection?.totalScore ?? null;
            const hasAdjusted =
              appeal.status === 'approved' &&
              appeal.adjustedScore !== null &&
              appeal.adjustedScore !== undefined &&
              baseScore !== null;
            const photoCount = Array.isArray(appeal.photos)
              ? appeal.photos.length
              : 0;
            const disputedCount = Array.isArray(appeal.disputedCodes)
              ? appeal.disputedCodes.length
              : 0;

            return (
              <div
                key={appeal.id}
                className="appeal-student-card cursor-pointer"
                onClick={() => onOpenDetail(appeal)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="font-semibold text-base"
                        style={{ color: 'var(--co-text)' }}
                      >
                        {appeal.inspection?.task?.title || '日常查寝'}
                      </span>
                      <span
                        className="text-xs"
                        style={{ color: 'var(--co-text-muted)' }}
                      >
                        {formatAppealDormName(appeal.inspection?.dorm)}
                      </span>
                    </div>
                    <div
                      className="text-xs font-mono mt-0.5"
                      style={{ color: 'var(--co-text-muted)' }}
                    >
                      提交于 {formatAppealTime(appeal.createdAt)}
                    </div>
                  </div>

                  <Space size={6}>
                    {appeal.inspectionChanged ? (
                      <span className="appeal-inline-pill appeal-inline-pill--error">
                        记录已变更
                      </span>
                    ) : null}
                    {hasAdjusted ? (
                      <span className="font-semibold text-sm" style={{ color: 'var(--co-text)' }}>
                        {baseScore} → {appeal.adjustedScore} 分
                      </span>
                    ) : baseScore !== null ? (
                      <span className="font-semibold text-sm" style={{ color: 'var(--co-primary)' }}>
                        {baseScore} 分
                      </span>
                    ) : null}
                    <Tag
                      color={statusMeta.tagColor}
                      className="rounded-full px-2.5 border-none font-medium !m-0"
                    >
                      {statusMeta.label}
                    </Tag>
                  </Space>
                </div>

                <div
                  className="mt-3 text-sm line-clamp-2"
                  style={{ color: 'var(--co-text)' }}
                >
                  {appeal.content}
                </div>

                {appeal.reply ? (
                  <div
                    className="mt-2.5 rounded-xl px-3 py-2 text-xs"
                    style={{
                      background: 'var(--co-input-bg)',
                      color: 'var(--co-text-secondary)',
                    }}
                  >
                    审核回复：{appeal.reply}
                  </div>
                ) : null}

                <div
                  className="mt-3 pt-2.5 flex items-center justify-between gap-2"
                  style={{ borderTop: '1px solid var(--co-glass-border)' }}
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {disputedCount > 0 ? (
                      <span className="appeal-inline-pill appeal-inline-pill--warning">
                        异议 {disputedCount} 项
                      </span>
                    ) : null}
                    {photoCount > 0 ? (
                      <span className="appeal-inline-pill appeal-inline-pill--primary gap-1">
                        <PictureOutlined /> {photoCount} 张举证
                      </span>
                    ) : null}
                  </div>

                  <Space size={8}>
                    <Button
                      size="small"
                      className="apple-btn-secondary"
                      icon={<EyeOutlined />}
                      onClick={() => onOpenDetail(appeal)}
                    >
                      详情
                    </Button>
                    {appeal.status === 'pending' ? (
                      <Button
                        size="small"
                        danger
                        icon={<RollbackOutlined />}
                        onClick={() => onWithdraw(appeal)}
                      >
                        撤回
                      </Button>
                    ) : null}
                  </Space>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {total > pageSize ? (
        <div className="flex justify-end pt-2">
          <Pagination
            current={page}
            pageSize={pageSize}
            total={total}
            size={isMobile ? 'small' : 'default'}
            showSizeChanger={!isMobile}
            onChange={onPageChange}
          />
        </div>
      ) : null}
    </div>
  );
}
