import { ReloadOutlined } from '@ant-design/icons';
import { Col, Row } from 'antd';
import dayjs from 'dayjs';
import { useMemo, useState } from 'react';

import { StatCardSkeletonGroup } from '../components/Skeletons';
import { useAppContext } from '../context/AppContext';
import {
  useDashboardSummary,
  type DashboardRangeKey,
} from '../hooks/useDashboardQuery';
import { useMobile } from '../hooks/useMobile';
import DashboardAlertsPanel from './dashboard/DashboardAlertsPanel';
import {
  DistributionPanel,
  MobileInsightsPanel,
  TrendChartPanel,
} from './dashboard/DashboardCharts';
import DashboardMyDormCard from './dashboard/DashboardMyDormCard';
import {
  DesktopQuickActionsPanel,
  MobileTopActions,
} from './dashboard/DashboardQuickActions';
import DashboardStatsSection from './dashboard/DashboardStatsSection';
import {
  buildQuickActions,
  buildStatSnapshot,
  normalizeDistributionData,
  normalizeTrendData,
  resolveDashboardViewMode,
} from './dashboard/dashboardUtils';

export default function DashboardPage() {
  const { user, activeRole, hasPermission } = useAppContext();
  const isMobile = useMobile();
  const [range, setRange] = useState<DashboardRangeKey>('6m');

  const roleKey = activeRole?.id || activeRole?.code || user?.role || 'default';
  const {
    data: summary,
    isLoading,
    isFetching,
    dataUpdatedAt,
    refetch,
  } = useDashboardSummary(roleKey, range);

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

  const lowScoreDorms = useMemo(
    () => summary?.lowScoreDorms || [],
    [summary?.lowScoreDorms],
  );
  const fullScoreDorms = useMemo(
    () => summary?.fullScoreDorms || [],
    [summary?.fullScoreDorms],
  );
  const pendingAppealList = useMemo(
    () => summary?.pendingAppealList || [],
    [summary?.pendingAppealList],
  );
  const myDormSummary = summary?.myDormSummary ?? null;

  const quickActions = useMemo(
    () => buildQuickActions(hasPermission, stats, activeRole?.code),
    [activeRole?.code, hasPermission, stats],
  );

  const canViewResults = hasPermission('RESULT_VIEW');
  const updatedTimeText = dataUpdatedAt
    ? dayjs(dataUpdatedAt).format('HH:mm')
    : '--:--';
  const scopeTag =
    summary?.scopeLabel || activeRole?.name || user?.role || '当前视角';

  const statsNode = isLoading ? (
    <StatCardSkeletonGroup />
  ) : (
    <DashboardStatsSection
      stats={stats}
      viewMode={viewMode}
      hasPermission={hasPermission}
    />
  );

  const showQuickActions = quickActions.length > 0;
  const showAlertsSection =
    viewMode === 'manager' ||
    pendingAppealList.length > 0 ||
    lowScoreDorms.length > 0;

  return (
    <div
      className={`dashboard-page co-animate-in ${isMobile ? 'dashboard-page--mobile' : ''}`}
      key={String(roleKey)}
    >
      <div className="dashboard-context-bar">
        <span className="dashboard-role-chip">{scopeTag}</span>
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
          {viewMode === 'student' && myDormSummary ? (
            <DashboardMyDormCard
              summary={myDormSummary}
              canViewResults={canViewResults}
            />
          ) : (
            <MobileTopActions
              actions={quickActions}
              stats={stats}
              viewMode={viewMode}
              hasPermission={hasPermission}
            />
          )}

          <div>{statsNode}</div>

          <MobileInsightsPanel
            trendData={trendData}
            distributionData={distributionData}
            fullScoreDorms={fullScoreDorms}
            range={range}
            onRangeChange={setRange}
            canViewResults={canViewResults}
          />

          {showAlertsSection &&
          (pendingAppealList.length > 0 || lowScoreDorms.length > 0) ? (
            <DashboardAlertsPanel
              pendingAppeals={pendingAppealList}
              lowScoreDorms={lowScoreDorms}
              isMobile
              canViewResults={canViewResults}
            />
          ) : null}
        </div>
      ) : (
        <div className="dashboard-desktop-stack">
          <div>{statsNode}</div>

          {viewMode === 'student' && myDormSummary ? (
            <DashboardMyDormCard
              summary={myDormSummary}
              canViewResults={canViewResults}
            />
          ) : null}

          <Row gutter={[20, 20]} className="items-stretch">
            <Col xs={24} lg={showQuickActions ? 15 : 24} xl={showQuickActions ? 16 : 24}>
              <TrendChartPanel
                trendData={trendData}
                range={range}
                onRangeChange={setRange}
              />
            </Col>
            {showQuickActions ? (
              <Col xs={24} lg={9} xl={8}>
                <DesktopQuickActionsPanel
                  actions={quickActions}
                  stats={stats}
                  viewMode={viewMode}
                  hasPermission={hasPermission}
                />
              </Col>
            ) : null}
          </Row>

          <Row gutter={[20, 20]} className="items-stretch">
            <Col xs={24} lg={showAlertsSection ? 15 : 24} xl={showAlertsSection ? 16 : 24}>
              <DistributionPanel
                distributionData={distributionData}
                fullScoreDorms={fullScoreDorms}
                range={range}
                onRangeChange={setRange}
                canViewResults={canViewResults}
              />
            </Col>
            {showAlertsSection ? (
              <Col xs={24} lg={9} xl={8}>
                <DashboardAlertsPanel
                  pendingAppeals={pendingAppealList}
                  lowScoreDorms={lowScoreDorms}
                  isMobile={false}
                  canViewResults={canViewResults}
                />
              </Col>
            ) : null}
          </Row>
        </div>
      )}
    </div>
  );
}
