import {
  AlertOutlined,
  ArrowRightOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { Button, Segmented } from 'antd';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import type {
  DashboardLowScoreDorm,
  DashboardPendingAppeal,
} from '../../hooks/useDashboardQuery';
import { formatInspectionTime } from './dashboardUtils';

interface DashboardAlertsPanelProps {
  pendingAppeals: DashboardPendingAppeal[];
  lowScoreDorms: DashboardLowScoreDorm[];
  isMobile: boolean;
  canViewResults: boolean;
  canViewAppeals?: boolean;
}

export default function DashboardAlertsPanel({
  pendingAppeals,
  lowScoreDorms,
  isMobile,
  canViewResults,
  canViewAppeals,
}: DashboardAlertsPanelProps) {
  const navigate = useNavigate();
  const canOpenAppeals = canViewAppeals ?? canViewResults;
  const [tab, setTab] = useState<'appeals' | 'lowScore'>(() =>
    pendingAppeals.length > 0 ? 'appeals' : 'lowScore',
  );

  useEffect(() => {
    if (pendingAppeals.length === 0 && lowScoreDorms.length > 0) {
      setTab('lowScore');
    } else if (pendingAppeals.length > 0 && lowScoreDorms.length === 0) {
      setTab('appeals');
    }
  }, [lowScoreDorms.length, pendingAppeals.length]);

  const limit = isMobile ? 3 : 4;

  const openAppeal = (appeal: DashboardPendingAppeal) => {
    if (!canOpenAppeals) return;
    navigate(`/appeals?appealId=${encodeURIComponent(appeal.id)}`);
  };

  const openLowScore = (item: DashboardLowScoreDorm) => {
    if (!canViewResults) return;
    const params = new URLSearchParams();
    params.set('keyword', item.dormName);
    params.set('sort', 'score_asc');
    if (item.taskId) {
      params.append('taskId', item.taskId);
    }
    navigate(`/results?${params.toString()}`);
  };

  return (
    <section
      className={`co-glass-panel dashboard-panel h-full flex flex-col ${isMobile ? 'dashboard-panel--mobile' : ''}`}
    >
      <header className="dashboard-panel-header">
        <Segmented
          size="small"
          value={tab}
          onChange={(val) => setTab(val as 'appeals' | 'lowScore')}
          options={[
            {
              label: `待处理申诉 (${pendingAppeals.length})`,
              value: 'appeals',
            },
            {
              label: `低分预警 (${lowScoreDorms.length})`,
              value: 'lowScore',
            },
          ]}
        />
        {(tab === 'appeals' ? canOpenAppeals : canViewResults) ? (
          <Button
            type="link"
            size="small"
            onClick={() =>
              navigate(
                tab === 'appeals'
                  ? '/appeals?status=pending'
                  : '/results?sort=score_asc',
              )
            }
            className="dashboard-link-btn"
          >
            {tab === 'appeals' ? '去处理' : '查看全部'}
            <ArrowRightOutlined />
          </Button>
        ) : null}
      </header>

      {tab === 'appeals' ? (
        pendingAppeals.length === 0 ? (
          <div className="dashboard-empty-state dashboard-empty-state--sm">
            <AlertOutlined className="dashboard-empty-icon" />
            <span>没有待处理申诉</span>
          </div>
        ) : (
          <div className={isMobile ? 'mobile-card-list' : 'dashboard-alert-list'}>
            {pendingAppeals.slice(0, limit).map((item) =>
              isMobile ? (
                <div
                  key={item.id}
                  className="mobile-compact-card co-press"
                  onClick={() => openAppeal(item)}
                  role={canOpenAppeals ? 'button' : undefined}
                  tabIndex={canOpenAppeals ? 0 : undefined}
                >
                  <div className="compact-card-header">
                    <div className="compact-header-left">
                      <span className="compact-title">{item.dormName}</span>
                      <span className="compact-subtitle">{item.studentName}</span>
                    </div>
                    {item.totalScore !== null && item.totalScore !== undefined ? (
                      <span className="dashboard-score-badge" data-tone="error">
                        {item.totalScore} 分
                      </span>
                    ) : null}
                  </div>
                  <div className="dashboard-mobile-recent-meta">
                    <span className="truncate pr-2">{item.content || '成绩复核申诉'}</span>
                    <span className="shrink-0">{formatInspectionTime(item.createdAt)}</span>
                  </div>
                </div>
              ) : (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => openAppeal(item)}
                  disabled={!canOpenAppeals}
                  className="dashboard-alert-row co-press"
                >
                  <div className="dashboard-alert-row__main">
                    <div className="dashboard-alert-row__head">
                      <span className="dashboard-alert-row__title">
                        {item.dormName}
                      </span>
                      <span className="dashboard-alert-row__sub">
                        {item.studentName}
                      </span>
                    </div>
                    <span className="dashboard-alert-row__desc">
                      {item.content || '成绩复核申诉'}
                    </span>
                  </div>
                  <div className="dashboard-alert-row__right">
                    {item.totalScore !== null && item.totalScore !== undefined ? (
                      <span className="dashboard-score-badge" data-tone="error">
                        {item.totalScore} 分
                      </span>
                    ) : null}
                    <span className="dashboard-recent-row__time">
                      {formatInspectionTime(item.createdAt)}
                    </span>
                  </div>
                </button>
              ),
            )}
          </div>
        )
      ) : lowScoreDorms.length === 0 ? (
        <div className="dashboard-empty-state dashboard-empty-state--sm">
          <WarningOutlined className="dashboard-empty-icon" />
          <span>当前时间段没有低于 60 分的宿舍</span>
        </div>
      ) : (
        <div className={isMobile ? 'mobile-card-list' : 'dashboard-alert-list'}>
          {lowScoreDorms.slice(0, limit).map((item) =>
            isMobile ? (
              <div
                key={item.inspectionId}
                className="mobile-compact-card co-press"
                onClick={() => openLowScore(item)}
                role={canViewResults ? 'button' : undefined}
                tabIndex={canViewResults ? 0 : undefined}
              >
                <div className="compact-card-header">
                  <div className="compact-header-left">
                    <span className="compact-title">{item.dormName}</span>
                    <span className="compact-subtitle">{item.taskTitle}</span>
                  </div>
                  <span className="dashboard-score-badge" data-tone="error">
                    {item.totalScore} 分
                  </span>
                </div>
                <div className="dashboard-mobile-recent-meta">
                  <span>{formatInspectionTime(item.createdAt)}</span>
                </div>
              </div>
            ) : (
              <button
                key={item.inspectionId}
                type="button"
                onClick={() => openLowScore(item)}
                disabled={!canViewResults}
                className="dashboard-alert-row co-press"
              >
                <div className="dashboard-alert-row__main">
                  <div className="dashboard-alert-row__head">
                    <span className="dashboard-alert-row__title">
                      {item.dormName}
                    </span>
                  </div>
                  <span className="dashboard-alert-row__desc">
                    {item.taskTitle}
                  </span>
                </div>
                <div className="dashboard-alert-row__right">
                  <span className="dashboard-score-badge" data-tone="error">
                    {item.totalScore} 分
                  </span>
                  <span className="dashboard-recent-row__time">
                    {formatInspectionTime(item.createdAt)}
                  </span>
                </div>
              </button>
            ),
          )}
        </div>
      )}
    </section>
  );
}
