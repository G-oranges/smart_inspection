import {
  BarChartOutlined,
  PieChartOutlined,
  RiseOutlined,
  TrophyOutlined,
} from '@ant-design/icons';
import { Segmented } from 'antd';
import { useEffect, useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { useAppContext } from '../../context/AppContext';
import type {
  DashboardFullScoreDorm,
  DashboardRangeKey,
} from '../../hooks/useDashboardQuery';
import {
  DASHBOARD_RANGE_OPTIONS,
  formatInspectionTime,
  getRangeLabel,
  type DashboardTrendItem,
  type NormalizedDistributionItem,
  type ScoreTone,
} from './dashboardUtils';

interface ChartPalette {
  primary: string;
  success: string;
  warning: string;
  error: string;
  muted: string;
  border: string;
  bg: string;
}

function readToken(name: string, fallback: string): string {
  if (typeof window === 'undefined') {
    return fallback;
  }
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return value || fallback;
}

function useChartPalette(): ChartPalette {
  const { activeTheme } = useAppContext();
  const [palette, setPalette] = useState<ChartPalette>(() => ({
    primary: readToken('--co-primary', 'currentColor'),
    success: readToken('--co-success', 'currentColor'),
    warning: readToken('--co-warning', 'currentColor'),
    error: readToken('--co-error', 'currentColor'),
    muted: readToken('--co-text-muted', 'currentColor'),
    border: readToken('--co-glass-border', 'currentColor'),
    bg: readToken('--co-bg', 'transparent'),
  }));

  useEffect(() => {
    setPalette({
      primary: readToken('--co-primary', 'currentColor'),
      success: readToken('--co-success', 'currentColor'),
      warning: readToken('--co-warning', 'currentColor'),
      error: readToken('--co-error', 'currentColor'),
      muted: readToken('--co-text-muted', 'currentColor'),
      border: readToken('--co-glass-border', 'currentColor'),
      bg: readToken('--co-bg', 'transparent'),
    });
  }, [activeTheme]);

  return palette;
}

const TOOLTIP_STYLE = {
  borderRadius: 'var(--co-radius-md)',
  border: '1px solid var(--co-glass-border)',
  boxShadow: 'var(--co-glass-shadow)',
  backdropFilter: 'blur(var(--co-glass-blur-sm))',
  background: 'var(--co-glass-bg-heavy)',
  color: 'var(--co-text)',
};

function TrendChartCanvas({
  trendData,
  height,
  range,
  onRangeChange,
  palette,
}: {
  trendData: DashboardTrendItem[];
  height: number;
  range: DashboardRangeKey;
  onRangeChange: (next: DashboardRangeKey) => void;
  palette: ChartPalette;
}) {
  const gradientId = useId();
  const hasAnyScore = trendData.some(
    (item) => item.score > 0 || item.count > 0,
  );

  if (!hasAnyScore) {
    return (
      <div className="dashboard-empty-state" style={{ height }}>
        <BarChartOutlined className="dashboard-empty-icon" />
        <span>{getRangeLabel(range)}没有查寝记录</span>
        {range !== 'all' ? (
          <button
            type="button"
            onClick={() => onRangeChange('all')}
            className="apple-btn-secondary dashboard-inline-cta co-press"
          >
            查看全部记录
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart
          data={trendData}
          margin={{ top: 12, right: 16, left: -16, bottom: 4 }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={palette.primary} stopOpacity={0.28} />
              <stop offset="95%" stopColor={palette.primary} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={palette.border}
            vertical={false}
          />
          <XAxis
            dataKey="month"
            axisLine={false}
            tickLine={false}
            tick={{ fill: palette.muted, fontSize: 11, fontWeight: 500 }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            domain={[0, 100]}
            tick={{ fill: palette.muted, fontSize: 11, fontWeight: 500 }}
          />
          <RechartsTooltip
            contentStyle={TOOLTIP_STYLE}
            labelStyle={{ color: 'var(--co-text-secondary)', fontWeight: 600 }}
            formatter={(value, _name, item) => {
              const count = (item?.payload as DashboardTrendItem | undefined)
                ?.count;
              const scoreText = `${value} 分`;
              return count
                ? [`${scoreText}（${count} 条）`, '卫生得分']
                : [scoreText, '卫生得分'];
            }}
          />
          <Area
            type="monotone"
            dataKey="score"
            name="卫生得分"
            stroke={palette.primary}
            strokeWidth={3}
            fill={`url(#${gradientId})`}
            dot={{
              r: 3.5,
              strokeWidth: 2,
              fill: palette.bg,
              stroke: palette.primary,
            }}
            activeDot={{ r: 6, strokeWidth: 0, fill: palette.primary }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function DistributionChartCanvas({
  distributionData,
  height,
  compact = false,
  range,
  onRangeChange,
  palette,
}: {
  distributionData: NormalizedDistributionItem[];
  height: number;
  compact?: boolean;
  range: DashboardRangeKey;
  onRangeChange: (next: DashboardRangeKey) => void;
  palette: ChartPalette;
}) {
  const totalCount = distributionData.reduce((sum, item) => sum + item.value, 0);
  const rangeLabel = getRangeLabel(range);

  if (totalCount === 0) {
    return (
      <div className="dashboard-empty-state" style={{ height }}>
        <PieChartOutlined className="dashboard-empty-icon" />
        <span>{rangeLabel}没有得分分布</span>
        {range !== 'all' ? (
          <button
            type="button"
            onClick={() => onRangeChange('all')}
            className="apple-btn-secondary dashboard-inline-cta co-press"
          >
            查看全部记录
          </button>
        ) : null}
      </div>
    );
  }

  const toneColor: Record<ScoreTone, string> = {
    success: palette.success,
    primary: palette.primary,
    warning: palette.warning,
    error: palette.error,
  };

  const ringHeight = compact ? 156 : 196;
  const innerRadius = compact ? 46 : 58;
  const outerRadius = compact ? 66 : 82;

  return (
    <div className="dashboard-dist-layout">
      <div className="dashboard-dist-ring" style={{ height: ringHeight }}>
        <ResponsiveContainer width="100%" height={ringHeight}>
          <PieChart>
            <Pie
              data={distributionData}
              cx="50%"
              cy="50%"
              innerRadius={innerRadius}
              outerRadius={outerRadius}
              paddingAngle={4}
              dataKey="value"
            >
              {distributionData.map((entry) => (
                <Cell key={entry.name} fill={toneColor[entry.tone]} />
              ))}
            </Pie>
            <RechartsTooltip
              contentStyle={TOOLTIP_STYLE}
              formatter={(value, name) => [`${value} 条`, String(name)]}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="dashboard-dist-center">
          <span className="dashboard-dist-total">{totalCount}</span>
          <span className="dashboard-dist-unit">条查寝记录</span>
        </div>
      </div>

      <div className="dashboard-dist-legend">
        {distributionData.map((item) => (
          <div key={item.name} className="dashboard-dist-legend-item">
            <span
              className="dashboard-tone-dot"
              data-tone={item.tone}
              aria-hidden="true"
            />
            <span className="dashboard-dist-name">{item.name}</span>
            <span className="dashboard-dist-value">
              {item.value}
              <span className="dashboard-dist-percent">{item.percent}%</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FullScoreDormList({
  dorms,
  canViewResults,
  compact = false,
}: {
  dorms: DashboardFullScoreDorm[];
  canViewResults: boolean;
  compact?: boolean;
}) {
  const navigate = useNavigate();

  const handleOpenDorm = (item: DashboardFullScoreDorm) => {
    if (!canViewResults) return;
    const params = new URLSearchParams();
    params.set('keyword', item.dormName);
    if (item.taskId) {
      params.append('taskId', item.taskId);
    }
    navigate(`/results?${params.toString()}`);
  };

  return (
    <div
      className={`dashboard-fullscore-pane ${compact ? 'dashboard-fullscore-pane--mobile' : ''}`}
    >
      <div className="dashboard-fullscore-head">
        <span className="dashboard-fullscore-title">
          <TrophyOutlined className="dashboard-fullscore-icon" />
          满分宿舍
        </span>
        <span className="dashboard-fullscore-count">{dorms.length} 条</span>
      </div>

      {dorms.length === 0 ? (
        <div className="dashboard-empty-state dashboard-empty-state--sm">
          <span>当前时间段没有满分宿舍</span>
        </div>
      ) : (
        <div className="dashboard-fullscore-list">
          {dorms.map((item) => (
            <button
              key={item.inspectionId}
              type="button"
              disabled={!canViewResults}
              onClick={() => handleOpenDorm(item)}
              className="dashboard-fullscore-row co-press"
            >
              <div className="dashboard-fullscore-row__main">
                <span className="dashboard-fullscore-row__dorm">
                  {item.dormName}
                </span>
                <span className="dashboard-fullscore-row__task">
                  {item.taskTitle}
                </span>
              </div>
              <div className="dashboard-fullscore-row__right">
                <span className="dashboard-score-badge" data-tone="success">
                  {item.totalScore} 分
                </span>
                <span className="dashboard-recent-row__time">
                  {formatInspectionTime(item.createdAt)}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function TrendChartPanel({
  trendData,
  range,
  onRangeChange,
}: {
  trendData: DashboardTrendItem[];
  range: DashboardRangeKey;
  onRangeChange: (next: DashboardRangeKey) => void;
}) {
  const palette = useChartPalette();

  return (
    <section className="co-glass-panel dashboard-panel h-full flex flex-col justify-between">
      <header className="dashboard-panel-header">
        <h3 className="dashboard-panel-title">
          <RiseOutlined className="dashboard-panel-icon" />
          卫生得分趋势
        </h3>
        <Segmented
          size="small"
          value={range}
          onChange={(val) => onRangeChange(val as DashboardRangeKey)}
          options={DASHBOARD_RANGE_OPTIONS}
        />
      </header>
      <TrendChartCanvas
        trendData={trendData}
        height={286}
        range={range}
        onRangeChange={onRangeChange}
        palette={palette}
      />
    </section>
  );
}

export function DistributionPanel({
  distributionData,
  fullScoreDorms,
  range,
  onRangeChange,
  canViewResults,
}: {
  distributionData: NormalizedDistributionItem[];
  fullScoreDorms: DashboardFullScoreDorm[];
  range: DashboardRangeKey;
  onRangeChange: (next: DashboardRangeKey) => void;
  canViewResults: boolean;
}) {
  const palette = useChartPalette();
  const rangeLabel = getRangeLabel(range);

  return (
    <section className="co-glass-panel dashboard-panel h-full flex flex-col">
      <header className="dashboard-panel-header">
        <h3 className="dashboard-panel-title">
          <PieChartOutlined className="dashboard-panel-icon" />
          得分分布
        </h3>
        <span className="dashboard-panel-meta">{rangeLabel}</span>
      </header>

      <div className="dashboard-dist-split">
        <div className="dashboard-dist-split__chart">
          <DistributionChartCanvas
            distributionData={distributionData}
            height={286}
            range={range}
            onRangeChange={onRangeChange}
            palette={palette}
          />
        </div>
        <FullScoreDormList
          dorms={fullScoreDorms}
          canViewResults={canViewResults}
        />
      </div>
    </section>
  );
}

export function MobileInsightsPanel({
  trendData,
  distributionData,
  fullScoreDorms,
  range,
  onRangeChange,
  canViewResults,
}: {
  trendData: DashboardTrendItem[];
  distributionData: NormalizedDistributionItem[];
  fullScoreDorms: DashboardFullScoreDorm[];
  range: DashboardRangeKey;
  onRangeChange: (next: DashboardRangeKey) => void;
  canViewResults: boolean;
}) {
  const palette = useChartPalette();
  const [activeTab, setActiveTab] = useState<'trend' | 'distribution'>('trend');

  return (
    <section className="co-glass-panel dashboard-panel dashboard-panel--mobile">
      <header className="dashboard-panel-header dashboard-panel-header--wrap">
        <Segmented
          size="small"
          value={activeTab}
          onChange={(val) => setActiveTab(val as 'trend' | 'distribution')}
          options={[
            { label: '得分趋势', value: 'trend' },
            { label: '得分分布', value: 'distribution' },
          ]}
        />
        <Segmented
          size="small"
          value={range}
          onChange={(val) => onRangeChange(val as DashboardRangeKey)}
          options={DASHBOARD_RANGE_OPTIONS}
        />
      </header>
      {activeTab === 'trend' ? (
        <TrendChartCanvas
          trendData={trendData}
          height={200}
          range={range}
          onRangeChange={onRangeChange}
          palette={palette}
        />
      ) : (
        <div className="space-y-4">
          <DistributionChartCanvas
            distributionData={distributionData}
            height={200}
            compact
            range={range}
            onRangeChange={onRangeChange}
            palette={palette}
          />
          <FullScoreDormList
            dorms={fullScoreDorms}
            canViewResults={canViewResults}
            compact
          />
        </div>
      )}
    </section>
  );
}
