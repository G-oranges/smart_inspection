import { Space, Tag } from 'antd';

import {
  APPEAL_STATUS_META,
  formatAppealDormName,
  formatAppealTime,
} from './appealSchema';
import type { AppealRecord } from '../../types/service';

export interface AppealMobileCardProps {
  appeal: AppealRecord;
  selected?: boolean;
  onSelect?: (selected: boolean) => void;
  onOpenDetail?: (appeal: AppealRecord) => void;
}

export default function AppealMobileCard({
  appeal,
  selected = false,
  onSelect,
  onOpenDetail,
}: AppealMobileCardProps) {
  const statusMeta =
    APPEAL_STATUS_META[appeal.status] || APPEAL_STATUS_META.pending;
  const baseScore =
    appeal.originalScore ?? appeal.inspection?.totalScore ?? null;
  const hasAdjusted =
    appeal.status === 'approved' &&
    appeal.adjustedScore !== null &&
    appeal.adjustedScore !== undefined &&
    baseScore !== null;

  return (
    <div
      className={`mobile-compact-card co-press ${selected ? 'selected' : ''}`}
      onClick={() => {
        if (onSelect) {
          onSelect(!selected);
        } else if (onOpenDetail) {
          onOpenDetail(appeal);
        }
      }}
    >
      <div className="compact-card-header">
        <div className="compact-header-left">
          <div className="compact-title">
            {formatAppealDormName(appeal.inspection?.dorm)}
          </div>
          <div className="compact-subtitle">
            {appeal.student?.fullName || '-'}
            {appeal.student?.studentNo ? ` (${appeal.student.studentNo})` : ''}
          </div>
        </div>
        <div className="compact-header-right">
          <Space size={4}>
            {appeal.inspectionChanged ? (
              <span className="appeal-inline-pill appeal-inline-pill--error">
                记录已变更
              </span>
            ) : null}
            <Tag
              color={statusMeta.tagColor}
              style={{ margin: 0, fontSize: 11 }}
            >
              {statusMeta.label}
            </Tag>
          </Space>
        </div>
      </div>

      <div className="compact-card-grid">
        <div className="compact-info-item">
          <span className="compact-label">查寝任务</span>
          <span className="compact-value">
            {appeal.inspection?.task?.title || '-'}
          </span>
        </div>
        <div className="compact-info-item">
          <span className="compact-label">分数</span>
          <span className="compact-value">
            {hasAdjusted
              ? `${baseScore} → ${appeal.adjustedScore}`
              : baseScore !== null
                ? `${baseScore} 分`
                : '-'}
          </span>
        </div>
        <div className="compact-info-item" style={{ gridColumn: 'span 2' }}>
          <span className="compact-label">申诉理由</span>
          <span className="compact-value line-clamp-2">
            {appeal.content || '-'}
          </span>
        </div>
        <div className="compact-info-item" style={{ gridColumn: 'span 2' }}>
          <span className="compact-label">提交时间</span>
          <span className="compact-value font-mono text-xs">
            {formatAppealTime(appeal.createdAt)}
          </span>
        </div>
      </div>
    </div>
  );
}
