import {
  BarChartOutlined,
  PieChartOutlined,
  RiseOutlined,
} from '@ant-design/icons';
import { Segmented } from 'antd';
import { useState } from 'react';
import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type {
  DashboardTrendItem,
  NormalizedDistributionItem,
  ScoreTone,
} from './dashboardUtils';

const TONE_COLOR_VAR: Record<ScoreTone, string> = {
  success: 'var(--co-success)',
  primary: 'var(--co-primary)',
  warning: 'var(--co-warning)',
  error: 'var(--co-error)',
};

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
}: {
  trendData: DashboardTrendItem[];
  height: number;
}) {
  const hasAnyScore = trendData.some((item) => item.score > 0);

  if (!hasAnyScore) {
    return (
      <div className="dashboard-empty-state" style={{ height }}>
        <BarChartOutlined className="dashboard-empty-icon" />
        <span>近 6 个月暂无评分记录</span>
      </div>
    );
  }

  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={trendData}
          margin={{ top: 8, right: 12, left: -18, bottom: 0 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--co-glass-border)"
            vertical={false}
          />
          <XAxis
            dataKey="month"
            axisLine={false}
            tickLine={false}
            tick={{ fill: 'var(--co-text-muted)', fontSize: 11, fontWeight: 500 }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            domain={[0, 100]}
            tick={{ fill: 'var(--co-text-muted)', fontSize: 11, fontWeight: 500 }}
          />
          <RechartsTooltip
            contentStyle={TOOLTIP_STYLE}
            labelStyle={{ color: 'var(--co-text-secondary)', fontWeight: 600 }}
            formatter={(value) => [`${value} 分`, '均分']}
          />
          <Line
            type="monotone"
            dataKey="score"
            name="均分"
            stroke="var(--co-primary)"
            strokeWidth={3}
            dot={{
              r: 3.5,
              strokeWidth: 2,
              fill: 'var(--co-bg)',
              stroke: 'var(--co-primary)',
            }}
            activeDot={{ r: 6, strokeWidth: 0, fill: 'var(--co-primary)' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function DistributionChartCanvas({
  distributionData,
  height,
  compact = false,
}: {
  distributionData: NormalizedDistributionItem[];
  height: number;
  compact?: boolean;
}) {
  const totalCount = distributionData.reduce((sum, item) => sum + item.value, 0);

  if (totalCount === 0) {
    return (
      <div className="dashboard-empty-state" style={{ height }}>
        <PieChartOutlined className="dashboard-empty-icon" />
        <span>本月暂无成绩分布数据</span>
      </div>
    );
  }

  const innerRadius = compact ? 46 : 62;
  const outerRadius = compact ? 66 : 86;

  return (
    <div className="dashboard-dist-layout">
      <div className="dashboard-dist-ring" style={{ height: compact ? 156 : 204 }}>
        <ResponsiveContainer width="100%" height="100%">
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
                <Cell key={entry.name} fill={TONE_COLOR_VAR[entry.tone]} />
              ))}
            </Pie>
            <RechartsTooltip
              contentStyle={TOOLTIP_STYLE}
              formatter={(value, name) => [`${value} 间`, String(name)]}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="dashboard-dist-center">
          <span className="dashboard-dist-total">{totalCount}</span>
          <span className="dashboard-dist-unit">本月已查</span>
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

export function TrendChartPanel({
  trendData,
}: {
  trendData: DashboardTrendItem[];
}) {
  return (
    <section className="co-glass-panel dashboard-panel h-full">
      <header className="dashboard-panel-header">
        <h3 className="dashboard-panel-title">
          <RiseOutlined className="dashboard-panel-icon" />
          卫生得分趋势
        </h3>
        <span className="dashboard-panel-meta">近 6 个月</span>
      </header>
      <TrendChartCanvas trendData={trendData} height={248} />
    </section>
  );
}

export function DistributionPanel({
  distributionData,
}: {
  distributionData: NormalizedDistributionItem[];
}) {
  return (
    <section className="co-glass-panel dashboard-panel h-full">
      <header className="dashboard-panel-header">
        <h3 className="dashboard-panel-title">
          <PieChartOutlined className="dashboard-panel-icon" />
          本月成绩分布
        </h3>
      </header>
      <DistributionChartCanvas distributionData={distributionData} height={248} />
    </section>
  );
}

export function MobileInsightsPanel({
  trendData,
  distributionData,
}: {
  trendData: DashboardTrendItem[];
  distributionData: NormalizedDistributionItem[];
}) {
  const [activeTab, setActiveTab] = useState<'trend' | 'distribution'>('trend');

  return (
    <section className="co-glass-panel dashboard-panel dashboard-panel--mobile">
      <header className="dashboard-panel-header">
        <h3 className="dashboard-panel-title">数据概览</h3>
        <Segmented
          size="small"
          value={activeTab}
          onChange={(val) => setActiveTab(val as 'trend' | 'distribution')}
          options={[
            { label: '得分趋势', value: 'trend' },
            { label: '成绩分布', value: 'distribution' },
          ]}
        />
      </header>
      {activeTab === 'trend' ? (
        <TrendChartCanvas trendData={trendData} height={190} />
      ) : (
        <DistributionChartCanvas
          distributionData={distributionData}
          height={190}
          compact
        />
      )}
    </section>
  );
}
