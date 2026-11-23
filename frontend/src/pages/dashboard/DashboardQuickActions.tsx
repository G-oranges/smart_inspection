import {
  AlertOutlined,
  AuditOutlined,
  CheckSquareOutlined,
  FormOutlined,
  HomeOutlined,
  PlusSquareOutlined,
  RightOutlined,
  ScheduleOutlined,
  SolutionOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

import type {
  DashboardStatSnapshot,
  DashboardViewMode,
  QuickActionConfig,
} from './dashboardUtils';

const ACTION_ICONS: Record<string, ReactNode> = {
  entry: <FormOutlined />,
  publish: <PlusSquareOutlined />,
  results: <CheckSquareOutlined />,
  occupancy: <HomeOutlined />,
  students: <UserOutlined />,
  dorms: <SolutionOutlined />,
  teachers: <TeamOutlined />,
  audit: <AuditOutlined />,
};

interface QuickActionsProps {
  actions: QuickActionConfig[];
  stats: DashboardStatSnapshot;
  viewMode: DashboardViewMode;
  hasPermission: (code: string) => boolean;
}

function ActionFocusBanner({
  stats,
  hasPermission,
  onNavigate,
}: {
  stats: DashboardStatSnapshot;
  hasPermission: (code: string) => boolean;
  onNavigate: (path: string) => void;
}) {
  if (stats.pendingAppeals > 0 && hasPermission('RESULT_VIEW')) {
    return (
      <button
        type="button"
        onClick={() => onNavigate('/results')}
        className="dashboard-focus-strip co-press"
        data-tone="error"
      >
        <span className="dashboard-focus-strip__icon">
          <AlertOutlined />
        </span>
        <span className="dashboard-focus-strip__text">
          {stats.pendingAppeals} 条申诉待处理
        </span>
        <RightOutlined className="dashboard-focus-strip__arrow" />
      </button>
    );
  }

  if (stats.activeTasks > 0 && hasPermission('RESULT_RECORD')) {
    return (
      <button
        type="button"
        onClick={() => onNavigate('/tasks/entry')}
        className="dashboard-focus-strip co-press"
        data-tone="primary"
      >
        <span className="dashboard-focus-strip__icon">
          <ScheduleOutlined />
        </span>
        <span className="dashboard-focus-strip__text">
          {stats.activeTasks} 项查寝任务进行中
        </span>
        <RightOutlined className="dashboard-focus-strip__arrow" />
      </button>
    );
  }

  return null;
}

export function DesktopQuickActionsPanel({
  actions,
  stats,
  hasPermission,
}: QuickActionsProps) {
  const navigate = useNavigate();

  return (
    <section className="co-glass-panel dashboard-panel h-full flex flex-col justify-between gap-4">
      <div>
        <header className="dashboard-panel-header">
          <h3 className="dashboard-panel-title">快捷通道</h3>
        </header>

        {actions.length > 0 ? (
          <div className="dashboard-actions-grid">
            {actions.map((action) => (
              <button
                key={action.key}
                type="button"
                onClick={() => navigate(action.path)}
                className="dashboard-action-tile co-press"
                data-tone={action.tone}
              >
                <span className="dashboard-action-tile__icon">
                  {ACTION_ICONS[action.key] || <ScheduleOutlined />}
                </span>
                <span className="dashboard-action-tile__label">
                  {action.label}
                </span>
                {action.badge ? (
                  <span className="dashboard-action-tile__badge">
                    {action.badge > 99 ? '99+' : action.badge}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        ) : (
          <div className="dashboard-empty-state dashboard-empty-state--sm">
            <span>暂无可用快捷操作</span>
          </div>
        )}
      </div>

      <ActionFocusBanner
        stats={stats}
        hasPermission={hasPermission}
        onNavigate={(path) => navigate(path)}
      />
    </section>
  );
}

export function MobileTopActions({
  actions,
  stats,
  viewMode,
  hasPermission,
}: QuickActionsProps) {
  const navigate = useNavigate();
  const mobileActions = actions.slice(0, 4);

  if (viewMode === 'inspector' && hasPermission('RESULT_RECORD')) {
    return (
      <section className="co-glass-panel dashboard-hero-action">
        <div className="dashboard-hero-action__head">
          <span className="dashboard-hero-action__title">现场查寝录入</span>
          <span className="dashboard-hero-action__count">
            {stats.activeTasks > 0
              ? `${stats.activeTasks} 项进行中`
              : '暂无进行中任务'}
          </span>
        </div>
        <button
          type="button"
          onClick={() => navigate('/tasks/entry')}
          className="apple-btn-primary dashboard-hero-action__btn co-press"
        >
          <FormOutlined />
          <span>{stats.activeTasks > 0 ? '继续录入' : '进入录入'}</span>
        </button>
      </section>
    );
  }

  return (
    <div className="space-y-3">
      {mobileActions.length > 0 ? (
        <div className="dashboard-mobile-actions">
          {mobileActions.map((action) => (
            <button
              key={action.key}
              type="button"
              onClick={() => navigate(action.path)}
              className="co-glass-card dashboard-mobile-action-pill co-press"
              data-tone={action.tone}
            >
              <span className="dashboard-mobile-action-pill__icon">
                {ACTION_ICONS[action.key] || <ScheduleOutlined />}
              </span>
              <span className="dashboard-mobile-action-pill__label">
                {action.label}
              </span>
              {action.badge ? (
                <span className="dashboard-action-tile__badge">
                  {action.badge > 99 ? '99+' : action.badge}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}

      <ActionFocusBanner
        stats={stats}
        hasPermission={hasPermission}
        onNavigate={(path) => navigate(path)}
      />
    </div>
  );
}
