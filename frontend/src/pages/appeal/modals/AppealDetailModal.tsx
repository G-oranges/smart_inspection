import { useMemo } from 'react';
import {
  Alert,
  Button,
  Descriptions,
  Drawer,
  Image,
  Modal,
  Skeleton,
  Tag,
} from 'antd';

import AuthPhotoImage from '../../../components/common/AuthPhotoImage';
import { MODAL_WIDTH } from '../../../components/common/modalSizes';
import { diffDeductionSnapshots, type DeductionDiffRow } from '../appealScore';
import {
  APPEAL_STATUS_META,
  formatAppealDormName,
  formatAppealTime,
} from '../appealSchema';
import type { AppSettings } from '../../../types/app';
import type { AppealRecord } from '../../../types/service';

export interface AppealDetailModalProps {
  open: boolean;
  loading?: boolean;
  appeal: AppealRecord | null;
  isMobile: boolean;
  canHandle: boolean;
  isStudent: boolean;
  settings: AppSettings | null;
  onClose: () => void;
  onOpenHandle?: (appeal: AppealRecord) => void;
  onWithdraw?: (appeal: AppealRecord) => void;
}

interface AppealDetailBodyProps {
  loading: boolean;
  appeal: AppealRecord | null;
  isMobile: boolean;
  diffRows: DeductionDiffRow[];
  photos: string[];
  inspectionPhotos: string[];
}

function AppealDetailBody({
  loading,
  appeal,
  isMobile,
  diffRows,
  photos,
  inspectionPhotos,
}: AppealDetailBodyProps) {
  if (loading) {
    return <Skeleton active paragraph={{ rows: 6 }} />;
  }

  if (!appeal) {
    return (
      <div
        className="py-10 text-center text-sm"
        style={{ color: 'var(--co-text-muted)' }}
      >
        未找到申诉详情
      </div>
    );
  }

  const statusMeta =
    APPEAL_STATUS_META[appeal.status] || APPEAL_STATUS_META.pending;
  const baseScore =
    appeal.originalScore ?? appeal.inspection?.totalScore ?? null;
  const hasScoreComparison =
    appeal.status === 'approved' &&
    appeal.adjustedScore !== null &&
    appeal.adjustedScore !== undefined &&
    baseScore !== null;

  return (
    <div className="space-y-4">
      {appeal.inspectionChanged ? (
        <Alert
          type="warning"
          showIcon
          message="关联的查寝记录在申诉提交后发生过变更"
        />
      ) : null}

      <Descriptions bordered size="small" column={isMobile ? 1 : 2}>
        <Descriptions.Item label="宿舍">
          {formatAppealDormName(appeal.inspection?.dorm)}
        </Descriptions.Item>
        <Descriptions.Item label="状态">
          <Tag
            color={statusMeta.tagColor}
            className="rounded-full px-2.5 border-none !m-0"
          >
            {statusMeta.label}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="申诉学生">
          {appeal.student?.fullName || '-'}
          {appeal.student?.studentNo ? ` (${appeal.student.studentNo})` : ''}
        </Descriptions.Item>
        <Descriptions.Item label="查寝任务">
          {appeal.inspection?.task?.title || '-'}
        </Descriptions.Item>
        <Descriptions.Item label="查寝得分">
          {hasScoreComparison ? (
            <span className="font-semibold">
              {baseScore} 分 → {appeal.adjustedScore} 分
            </span>
          ) : baseScore !== null ? (
            `${baseScore} 分`
          ) : (
            '-'
          )}
        </Descriptions.Item>
        <Descriptions.Item label="提交时间">
          {formatAppealTime(appeal.createdAt)}
        </Descriptions.Item>
      </Descriptions>

      <div>
        <div
          className="text-xs font-semibold mb-1.5"
          style={{ color: 'var(--co-text-secondary)' }}
        >
          申诉理由
        </div>
        <div
          className="appeal-timeline-card text-sm"
          style={{ color: 'var(--co-text)' }}
        >
          {appeal.content || '-'}
        </div>
      </div>

      {photos.length > 0 ? (
        <div>
          <div
            className="text-xs font-semibold mb-1.5"
            style={{ color: 'var(--co-text-secondary)' }}
          >
            申诉举证照片
          </div>
          <Image.PreviewGroup>
            <div className="flex flex-wrap gap-2.5">
              {photos.map((url, index) => (
                <AuthPhotoImage
                  key={`${appeal.id}-photo-${index}`}
                  src={url}
                  width={96}
                  height={96}
                  className="rounded-lg object-cover"
                />
              ))}
            </div>
          </Image.PreviewGroup>
        </div>
      ) : null}

      {diffRows.length > 0 ? (
        <div>
          <div
            className="text-xs font-semibold mb-1.5"
            style={{ color: 'var(--co-text-secondary)' }}
          >
            {appeal.status === 'approved' ? '扣分项修正对比' : '查寝扣分明细'}
          </div>
          <div
            className="rounded-xl overflow-hidden divide-y"
            style={{
              border: '1px solid var(--co-glass-border)',
              borderColor: 'var(--co-glass-border)',
            }}
          >
            {diffRows.map((row) => {
              const isRemoved = row.kind === 'removed';
              const isAdded = row.kind === 'added';
              const isUpdated = row.kind === 'updated';

              return (
                <div
                  key={row.code}
                  className="px-3.5 py-2.5 flex items-center justify-between gap-3 text-sm"
                  style={{ borderColor: 'var(--co-glass-border)' }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {row.disputed ? <span className="appeal-disputed-dot" /> : null}
                      <span
                        className={
                          isRemoved ? 'line-through opacity-55' : 'font-medium'
                        }
                        style={{ color: 'var(--co-text)' }}
                      >
                        {row.name}
                      </span>
                      {row.disputed ? (
                        <span className="appeal-inline-pill appeal-inline-pill--warning">
                          学生异议
                        </span>
                      ) : null}
                      {isRemoved ? (
                        <span className="appeal-inline-pill appeal-inline-pill--muted">
                          已撤销
                        </span>
                      ) : null}
                      {isAdded ? (
                        <span className="appeal-inline-pill appeal-inline-pill--warning">
                          新增
                        </span>
                      ) : null}
                      {isUpdated ? (
                        <span className="appeal-inline-pill appeal-inline-pill--primary">
                          次数已调
                        </span>
                      ) : null}
                    </div>
                    {row.locations.length > 0 ? (
                      <div
                        className="text-xs mt-0.5"
                        style={{ color: 'var(--co-text-muted)' }}
                      >
                        位置：{row.locations.join('、')}
                      </div>
                    ) : null}
                  </div>

                  <div
                    className="text-right font-mono text-xs flex-shrink-0"
                    style={{ color: 'var(--co-text-secondary)' }}
                  >
                    {isRemoved ? (
                      <span className="line-through opacity-55">
                        -{row.points * (row.beforeCount || 1)} 分 ({row.beforeCount}次)
                      </span>
                    ) : isUpdated ? (
                      <span>
                        {row.beforeCount} → {row.afterCount} 次 (-
                        {row.points * (row.afterCount || 1)}分)
                      </span>
                    ) : (
                      <span>
                        -{row.points * (row.afterCount || 1)} 分 ({row.afterCount}次)
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {inspectionPhotos.length > 0 ? (
        <div>
          <div
            className="text-xs font-semibold mb-1.5"
            style={{ color: 'var(--co-text-secondary)' }}
          >
            原查寝现场照片
          </div>
          <Image.PreviewGroup>
            <div className="flex flex-wrap gap-2.5">
              {inspectionPhotos.map((url, idx) => (
                <AuthPhotoImage
                  key={`insp-photo-${idx}`}
                  src={url}
                  width={84}
                  height={84}
                  className="rounded-lg object-cover"
                />
              ))}
            </div>
          </Image.PreviewGroup>
        </div>
      ) : null}

      <div>
        <div
          className="text-xs font-semibold mb-1.5"
          style={{ color: 'var(--co-text-secondary)' }}
        >
          处理进度
        </div>
        <div className="appeal-timeline-card space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span style={{ color: 'var(--co-text)' }}>1. 学生提交申诉</span>
            <span className="font-mono" style={{ color: 'var(--co-text-muted)' }}>
              {formatAppealTime(appeal.createdAt)}
            </span>
          </div>
          {appeal.status !== 'pending' ? (
            <div
              className="pt-2 space-y-1"
              style={{ borderTop: '1px solid var(--co-glass-border)' }}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium" style={{ color: 'var(--co-text)' }}>
                  2. {statusMeta.label}
                  {appeal.handledBy
                    ? `（处理人：${appeal.handledBy.fullName || appeal.handledBy.username}）`
                    : ''}
                </span>
                <span
                  className="font-mono"
                  style={{ color: 'var(--co-text-muted)' }}
                >
                  {formatAppealTime(appeal.handledAt || appeal.updatedAt)}
                </span>
              </div>
              {appeal.reply ? (
                <div style={{ color: 'var(--co-text-secondary)' }}>
                  回复：{appeal.reply}
                </div>
              ) : null}
            </div>
          ) : (
            <div style={{ color: 'var(--co-text-muted)' }}>2. 等待审核处理</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AppealDetailModal({
  open,
  loading = false,
  appeal,
  isMobile,
  canHandle,
  isStudent,
  settings,
  onClose,
  onOpenHandle,
  onWithdraw,
}: AppealDetailModalProps) {
  const diffRows = useMemo(
    () =>
      appeal
        ? diffDeductionSnapshots(
            appeal.originalDetail ?? appeal.inspection?.detail,
            appeal.status === 'approved' ? appeal.adjustedDetail : null,
            appeal.disputedCodes,
            settings?.deductionItems || [],
          )
        : [],
    [appeal, settings?.deductionItems],
  );

  const photos = useMemo(
    () =>
      Array.isArray(appeal?.photos) ? appeal.photos.filter(Boolean) : [],
    [appeal?.photos],
  );

  const inspectionPhotos = useMemo(() => {
    const raw = appeal?.inspection?.photoUrls || appeal?.inspection?.photos;
    return Array.isArray(raw) ? raw.filter(Boolean) : [];
  }, [appeal?.inspection?.photoUrls, appeal?.inspection?.photos]);

  const contentNode = (
    <AppealDetailBody
      loading={loading}
      appeal={appeal}
      isMobile={isMobile}
      diffRows={diffRows}
      photos={photos}
      inspectionPhotos={inspectionPhotos}
    />
  );

  const canTriggerHandle =
    canHandle && appeal?.status === 'pending' && Boolean(onOpenHandle);
  const canTriggerWithdraw =
    isStudent && appeal?.status === 'pending' && Boolean(onWithdraw);

  if (isMobile) {
    return (
      <Drawer
        open={open}
        title="申诉详情"
        placement="bottom"
        height="88vh"
        onClose={onClose}
        className="apple-drawer ios-action-sheet"
        footer={
          <div className="flex gap-3">
            <Button className="apple-btn-secondary flex-1" onClick={onClose}>
              关闭
            </Button>
            {canTriggerWithdraw && appeal ? (
              <Button
                type="primary"
                danger
                className="flex-1"
                onClick={() => {
                  onClose();
                  onWithdraw?.(appeal);
                }}
              >
                撤回申诉
              </Button>
            ) : null}
            {canTriggerHandle && appeal ? (
              <Button
                type="primary"
                className="apple-btn-primary flex-1"
                onClick={() => {
                  onClose();
                  onOpenHandle?.(appeal);
                }}
              >
                去处理
              </Button>
            ) : null}
          </div>
        }
      >
        {contentNode}
      </Drawer>
    );
  }

  const footerButtons = [
    <Button key="close" className="apple-btn-secondary" onClick={onClose}>
      关闭
    </Button>,
  ];

  if (canTriggerWithdraw && appeal) {
    footerButtons.push(
      <Button
        key="withdraw"
        type="primary"
        danger
        onClick={() => {
          onClose();
          onWithdraw?.(appeal);
        }}
      >
        撤回申诉
      </Button>,
    );
  } else if (canTriggerHandle && appeal) {
    footerButtons.push(
      <Button
        key="handle"
        type="primary"
        className="apple-btn-primary"
        onClick={() => {
          onClose();
          onOpenHandle?.(appeal);
        }}
      >
        去处理
      </Button>,
    );
  }

  return (
    <Modal
      open={open}
      title="申诉详情"
      centered
      width={MODAL_WIDTH.md}
      className="co-modal"
      onCancel={onClose}
      footer={footerButtons}
    >
      {contentNode}
    </Modal>
  );
}
