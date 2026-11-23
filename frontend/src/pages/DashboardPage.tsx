import { ReloadOutlined } from '@ant-design/icons';
import { Col, Row } from 'antd';
import dayjs from 'dayjs';
import { useMemo } from 'react';

import { StatCardSkeletonGroup } from '../components/Skeletons';
import { useAppContext } from '../context/AppContext';
import { useDashboardSummary } from '../hooks/useDashboardQuery';
import { useMobile } from '../hooks/useMobile';
import {
  DistributionPanel,
  MobileInsightsPanel,
  TrendChartPanel,
} from './dashboard/DashboardCharts';
import {
  DesktopQuickActionsPanel,
  MobileTopActions,
} from './dashboard/DashboardQuickActions';
import DashboardRecentList from './dashboard/DashboardRecentList';
import DashboardStatsSection from './dashboard/DashboardStatsSection';
import {
  buildQuickActions,
  buildStatSnapshot,
  normalizeDistributionData,
  normalizeRecentInspections,
  normalizeTrendData,
  resolveDashboardViewMode,
} from './dashboard/dashboardUtils';

export default function DashboardPage() {
  const { user, activeRole, hasPermission } = useAppContext();
  const isMobile = useMobile();

  const roleKey = activeRole?.id || activeRole?.code || user?.role || 'default';
  const {
    data: summary,
    isLoading,
    isFetching,
    dataUpdatedAt,
    refetch,
  } = useDashboardSummary(roleKey);

  const viewMode = useMemo(
    () => resolveDashboardViewMode(hasPermission),
    [hasPermission],
  );

  const stats = useMemo(() => buildStatSnapshot(summary), [summary]);

  const trendData = useMemo(
    () => normalizeTrendData(summary?.trendData),
    [summary?.trendData],
  );

  const distributionData = useMemo(
    () => normalizeDistributionData(summary?.distribution),
    [summary?.distribution],
  );

  const recentInspections = useMemo(
    () => normalizeRecentInspections(summary?.recentInspections),
    [summary?.recentInspections],
  );

  const quickActions = useMemo(
    () => buildQuickActions(hasPermission, stats, activeRole?.code),
    [activeRole?.code, hasPermission, stats],
  );

  const canViewResults = hasPermission('RESULT_VIEW');
  const updatedTimeText = dataUpdatedAt
    ? dayjs(dataUpdatedAt).format('HH:mm')
    : '--:--';
  const roleTag = activeRole?.name || user?.role || '当前视角';

  const statsNode = isLoading ? (
    <StatCardSkeletonGroup />
  ) : (
    <DashboardStatsSection
      stats={stats}
      viewMode={viewMode}
      hasPermission={hasPermission}
    />
  );

  return (
    <div
      className={`dashboard-page co-animate-in ${isMobile ? 'dashboard-page--mobile' : ''}`}
      key={String(roleKey)}
    >
      <div className="dashboard-context-bar">
        <span className="dashboard-role-chip">{roleTag}</span>
        <div className="dashboard-context-actions">
          <span className="dashboard-updated-at">更新于 {updatedTimeText}</span>
          <button
            type="button"
            onClick={() => void refetch()}
            disabled={isFetching}
            className="co-glass-btn dashboard-refresh-btn co-press"
            aria-label="刷新数据"
          >
            <ReloadOutlined spin={isFetching} />
            {!isMobile ? <span>刷新</span> : null}
          </button>
        </div>
      </div>

      {isMobile ? (
        <div className="dashboard-mobile-stack">
          <MobileTopActions
            actions={quickActions}
            stats={stats}
            viewMode={viewMode}
            hasPermission={hasPermission}
          />

          <div>{statsNode}</div>

          <MobileInsightsPanel
            trendData={trendData}
            distributionData={distributionData}
          />

          <DashboardRecentList
            items={recentInspections}
            isMobile
            canViewResults={canViewResults}
          />
        </div>
      ) : (
        <div className="dashboard-desktop-stack">
          <div>{statsNode}</div>

          <Row gutter={[20, 20]} className="items-stretch">
            <Col xs={24} xl={16}>
              <TrendChartPanel trendData={trendData} />
            </Col>
            <Col xs={24} xl={8}>
              <DesktopQuickActionsPanel
                actions={quickActions}
                stats={stats}
                viewMode={viewMode}
                hasPermission={hasPermission}
              />
            </Col>
          </Row>

          <Row gutter={[20, 20]} className="items-stretch">
            <Col xs={24} lg={10}>
              <DistributionPanel distributionData={distributionData} />
            </Col>
            <Col xs={24} lg={14}>
              <DashboardRecentList
                items={recentInspections}
                isMobile={false}
                canViewResults={canViewResults}
              />
            </Col>
          </Row>
        </div>
      )}
    </div>
  );
}
