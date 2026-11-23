import {
  ArrowRightOutlined,
  CheckCircleOutlined,
  ScheduleOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { Button } from 'antd';
import { useNavigate } from 'react-router-dom';

import type { NormalizedInspectionItem } from './dashboardUtils';

interface DashboardRecentListProps {
  items: NormalizedInspectionItem[];
  isMobile: boolean;
  canViewResults: boolean;
}

export default function DashboardRecentList({
  items,
  isMobile,
  canViewResults,
}: DashboardRecentListProps) {
  const navigate = useNavigate();
  const visibleItems = isMobile ? items.slice(0, 5) : items.slice(0, 6);

  const handleOpenResults = () => {
    if (canViewResults) {
      navigate('/results');
    }
  };

  return (
    <section
      className={`co-glass-panel dashboard-panel h-full ${isMobile ? 'dashboard-panel--mobile' : ''}`}
    >
      <header className="dashboard-panel-header">
        <h3 className="dashboard-panel-title">最近查寝动态</h3>
        {canViewResults ? (
          <Button
            type="link"
            size="small"
            onClick={handleOpenResults}
            className="dashboard-link-btn"
          >
            全部结果
            <ArrowRightOutlined />
          </Button>
        ) : null}
      </header>

      {visibleItems.length === 0 ? (
        <div className="dashboard-empty-state">
          <ScheduleOutlined className="dashboard-empty-icon" />
          <span>暂无近期查寝记录</span>
        </div>
      ) : isMobile ? (
        <div className="mobile-card-list">
          {visibleItems.map((item) => (
            <div
              key={item.id}
              className="mobile-compact-card co-press"
              onClick={handleOpenResults}
              role={canViewResults ? 'button' : undefined}
              tabIndex={canViewResults ? 0 : undefined}
              onKeyDown={(event) => {
                if (
                  canViewResults &&
                  (event.key === 'Enter' || event.key === ' ')
                ) {
                  event.preventDefault();
                  handleOpenResults();
                }
              }}
            >
              <div className="compact-card-header">
                <div className="compact-header-left">
                  <span className="compact-title">{item.dormLabel}</span>
                  <span className="compact-subtitle">{item.taskLabel}</span>
                </div>
                <span
                  className="dashboard-score-badge"
                  data-tone={item.scoreTone}
                >
                  {item.totalScore} 分
                </span>
              </div>
              <div className="dashboard-mobile-recent-meta">
                <span>{item.inspectorLabel}</span>
                <span>{item.timeText}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="dashboard-recent-list">
          {visibleItems.map((item) => {
            const isWarning = item.scoreTone === 'error';
            return (
              <div
                key={item.id}
                className={`dashboard-recent-row ${canViewResults ? 'is-clickable' : ''}`}
                onClick={handleOpenResults}
                role={canViewResults ? 'button' : undefined}
                tabIndex={canViewResults ? 0 : undefined}
                onKeyDown={(event) => {
                  if (
                    canViewResults &&
                    (event.key === 'Enter' || event.key === ' ')
                  ) {
                    event.preventDefault();
                    handleOpenResults();
                  }
                }}
              >
                <span
                  className="dashboard-recent-row__icon"
                  data-tone={item.scoreTone}
                >
                  {isWarning ? <WarningOutlined /> : <CheckCircleOutlined />}
                </span>
                <div className="dashboard-recent-row__main">
                  <span className="dashboard-recent-row__dorm">
                    {item.dormLabel}
                  </span>
                  <span className="dashboard-recent-row__meta">
                    {item.inspectorLabel} · {item.taskLabel}
                  </span>
                </div>
                <div className="dashboard-recent-row__right">
                  <span
                    className="dashboard-recent-row__score"
                    data-tone={item.scoreTone}
                  >
                    {item.totalScore}
                    <span className="dashboard-recent-row__unit">分</span>
                  </span>
                  <span className="dashboard-recent-row__time">
                    {item.timeText}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
