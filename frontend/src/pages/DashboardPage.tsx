import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Col, Row, Tag } from 'antd';
import {
  AlertOutlined,
  ArrowRightOutlined,
  BarChartOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  FormOutlined,
  HomeOutlined,
  PlusSquareOutlined,
  RocketOutlined,
  ScheduleOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import {
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import dayjs from 'dayjs';

import { useAppContext } from '../context/AppContext';
import { useDashboardSummary } from '../hooks/useDashboardQuery';
import { StatCardSkeletonGroup } from '../components/Skeletons';
import AppleStatCard from '../components/common/AppleStatCard';
import PageLayout from '../components/PageLayout';

import type {
  DashboardDistributionItem,
  DashboardRecentInspection,
  DashboardTrendPoint,
} from '../hooks/useDashboardQuery';

interface DashboardStatSnapshot {
  totalDorms: number;
  totalBeds: number;
  occupiedBeds: number;
  activeTasks: number;
  pendingAppeals: number;
  avgScore: string;
}

interface DashboardTrendItem {
  month: string;
  score: number;
}

interface QuickActionItem {
  color: string;
  desc: string;
  icon: ReactNode;
  label: string;
  path: string;
}

const COLORS = ['#34C759', '#007AFF', '#FF9500', '#FF3B30'];
const QUICK_ACTIONS: QuickActionItem[] = [
  {
    label: '发布任务',
    icon: <PlusSquareOutlined />,
    color: 'bg-ios-blue',
    path: '/tasks/publish',
    desc: '新开查寝',
  },
  {
    label: '结果录入',
    icon: <FormOutlined />,
    color: 'bg-ios-green',
    path: '/tasks/entry',
    desc: '分值上报',
  },
  {
    label: '教师库',
    icon: <TeamOutlined />,
    color: 'bg-ios-indigo',
    path: '/teachers',
    desc: '人员统筹',
  },
];

function toFiniteNumber(value: number | string | null | undefined): number {
  const nextValue = Number(value);
  return Number.isFinite(nextValue) ? nextValue : 0;
}

function formatRecentInspectionTime(createdAt?: string): string {
  if (!createdAt) {
    return '--';
  }

  const parsed = dayjs(createdAt);
  return parsed.isValid() ? parsed.format('MM-DD HH:mm') : '--';
}

function DashboardStats({
  activeTasks,
  avgScore,
  pendingAppeals,
  totalBeds,
  totalDorms,
}: DashboardStatSnapshot) {
  return (
    <>
      <Col xs={12} sm={12} md={6}>
        <AppleStatCard
          icon={<HomeOutlined />}
          value={totalDorms}
          subValue={totalBeds}
          label="管理宿舍 / 床位"
          dotColor="blue"
        />
      </Col>
      <Col xs={12} sm={12} md={6}>
        <AppleStatCard
          icon={<BarChartOutlined />}
          value={avgScore}
          label="全校卫生均分"
          dotColor={parseFloat(avgScore) >= 90 ? 'green' : 'orange'}
          unit="分"
        />
      </Col>
      <Col xs={12} sm={12} md={6}>
        <AppleStatCard
          icon={<ScheduleOutlined />}
          value={activeTasks}
          label="当前进行任务"
          dotColor="blue"
        />
      </Col>
      <Col xs={12} sm={12} md={6}>
        <AppleStatCard
          icon={<AlertOutlined />}
          value={pendingAppeals}
          label="待处理申诉"
          dotColor={pendingAppeals > 0 ? 'red' : 'gray'}
        />
      </Col>
    </>
  );
}

function TrendPanel({
  currentTheme,
  trendData,
}: {
  currentTheme: string;
  trendData: DashboardTrendItem[];
}) {
  return (
    <div className="glass-panel p-6 h-full rounded-[32px] border border-white/20 shadow-sm transition-all hover:shadow-md">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
            <ThunderboltOutlined className="text-blue-500" /> 卫生得分趋势
          </h3>
          <p className="text-xs text-gray-400 mt-1 italic tracking-wide">
            Dynamic Hygiene Score Metrics
          </p>
        </div>
        <Tag className="rounded-full bg-blue-50 text-blue-500 border-none px-3">
          实时同步中
        </Tag>
      </div>
      <div className="h-[320px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={trendData}>
            <defs>
              <linearGradient id="lineGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#007AFF" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#007AFF" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={
                currentTheme === 'dark'
                  ? 'rgba(255,255,255,0.05)'
                  : 'rgba(0,0,0,0.05)'
              }
              vertical={false}
            />
            <XAxis
              dataKey="month"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#8E8E93', fontSize: 11, fontWeight: 500 }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              domain={[0, 100]}
              tick={{ fill: '#8E8E93', fontSize: 11, fontWeight: 500 }}
            />
            <RechartsTooltip
              contentStyle={{
                borderRadius: '16px',
                border: 'none',
                boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
                backdropFilter: 'blur(20px)',
                background:
                  currentTheme === 'dark'
                    ? 'rgba(28,28,30,0.8)'
                    : 'rgba(255,255,255,0.8)',
              }}
            />
            <Line
              type="monotone"
              dataKey="score"
              name="均分"
              stroke="#007AFF"
              strokeWidth={4}
              dot={{ r: 4, strokeWidth: 2, fill: '#FFFFFF', stroke: '#007AFF' }}
              activeDot={{ r: 8, strokeWidth: 0, fill: '#007AFF' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function DistributionPanel({ distributionData }: { distributionData: DashboardDistributionItem[] }) {
  return (
    <div className="glass-panel p-6 h-full rounded-[32px] border border-white/20 shadow-sm transition-all hover:shadow-md">
      <div className="mb-8">
        <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
          <RocketOutlined className="text-green-500" /> 结果权重分布
        </h3>
        <p className="text-xs text-gray-400 mt-1 italic tracking-wide">
          Distribution of Inspection Results
        </p>
      </div>
      <div className="h-[320px] w-full flex flex-col items-center">
        <ResponsiveContainer width="100%" height="80%">
          <PieChart>
            <Pie
              data={distributionData}
              cx="50%"
              cy="50%"
              innerRadius={70}
              outerRadius={95}
              paddingAngle={5}
              dataKey="value"
            >
              {distributionData.map((entry, index) => (
                <Cell
                  key={`${entry.name || 'distribution'}-${index}`}
                  fill={COLORS[index % COLORS.length]}
                />
              ))}
            </Pie>
            <Legend />
            <RechartsTooltip
              contentStyle={{
                borderRadius: '12px',
                border: 'none',
                background: 'rgba(0,0,0,0.8)',
                color: '#fff',
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="grid grid-cols-2 gap-x-8 gap-y-2 mt-2">
          {distributionData.map((item, idx) => (
            <div
              key={`${item.name || 'distribution'}-${idx}`}
              className="flex items-center gap-2"
            >
              <div
                className="w-2 h-2 rounded-full"
                style={{ background: COLORS[idx % COLORS.length] }}
              />
              <span className="text-xs font-medium text-gray-500">{item.name || '--'}</span>
              <span className="text-xs font-bold text-gray-800 dark:text-white">
                {toFiniteNumber(item.value)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function QuickActionsPanel({ navigate }: { navigate: ReturnType<typeof useNavigate> }) {
  return (
    <div className="glass-panel p-6 h-full rounded-[32px] border border-white/20 shadow-sm">
      <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-6 px-2">
        快捷操作通道
      </h3>
      <div className="grid grid-cols-3 gap-4">
        {QUICK_ACTIONS.map((action, idx) => (
          <div
            key={action.label}
            onClick={() => navigate(action.path)}
            className="flex flex-col items-center gap-3 p-5 rounded-[24px] bg-white/50 dark:bg-white/5 border border-white dark:border-white/5 hover:bg-white dark:hover:bg-white/10 transition-all cursor-pointer apple-shadow-sm hover:apple-shadow-md active-press group animate-apple-in"
            style={{ animationDelay: `${idx * 100}ms` }}
          >
            <div
              className={`w-12 h-12 ${action.color} rounded-2xl flex items-center justify-center text-white shadow-xl shadow-black/10 transition-transform group-hover:scale-110`}
            >
              {action.icon}
            </div>
            <div className="text-center">
              <div className="text-[13px] font-bold text-gray-800 dark:text-white leading-tight">
                {action.label}
              </div>
              <div className="text-[10px] text-gray-400 mt-1.5 font-medium tracking-tight">
                {action.desc}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 p-4 bg-blue-50/50 dark:bg-blue-900/10 rounded-2xl border border-blue-100 dark:border-blue-900/20">
        <div className="flex gap-3">
          <div className="p-2 bg-blue-500 text-white rounded-lg h-fit">
            <CalendarOutlined />
          </div>
          <div>
            <div className="text-sm font-bold text-blue-800 dark:text-blue-300">
              系统维护提醒
            </div>
            <div className="text-xs text-blue-600/70 dark:text-blue-400/70 mt-1">
              本周日凌晨 02:00 - 04:00 将进行弹性算力升级，期间录入功能可能短暂受限。
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RecentInspectionPanel({
  navigate,
  recentInspections,
}: {
  navigate: ReturnType<typeof useNavigate>;
  recentInspections: DashboardRecentInspection[];
}) {
  return (
    <div className="glass-panel p-6 h-full rounded-[32px] border border-white/20 shadow-sm">
      <div className="flex justify-between items-center mb-6 px-2">
        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest">
          实时核查动态
        </h3>
        <Button
          type="link"
          size="small"
          onClick={() => navigate('/results')}
          className="text-blue-500 flex items-center gap-1 group font-bold"
        >
          浏览全部
          <ArrowRightOutlined className="text-[10px] group-hover:translate-x-1 transition-transform" />
        </Button>
      </div>

      <div className="space-y-4">
        {recentInspections.map((item, idx) => {
          const totalScore = toFiniteNumber(item.totalScore);
          const isWarning = totalScore < 60;

          return (
            <div
              key={`${item.dormName || 'inspection'}-${item.createdAt || idx}`}
              className="flex items-center gap-4 p-4 rounded-3xl bg-white/40 dark:bg-white/5 border border-white/50 dark:border-white/5 hover:border-blue-500/30 transition-all"
            >
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${isWarning ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-500'}`}
              >
                {isWarning ? (
                  <WarningOutlined className="text-xl" />
                ) : (
                  <CheckCircleOutlined className="text-xl" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-gray-800 dark:text-white truncate">
                    {item.dormName || '未知考点'}
                  </span>
                  <span
                    className={`font-black text-lg ${isWarning ? 'text-red-500' : 'text-green-600'}`}
                  >
                    {totalScore}
                    <small className="text-[10px] ml-0.5 opacity-60">pts</small>
                  </span>
                </div>
                <div className="flex justify-between text-[11px] text-gray-400 mt-1">
                  <span>
                    {item.inspectorName || '系统流水'} · {item.taskTitle?.slice(0, 10) || '常规检查'}
                  </span>
                  <span>{formatRecentInspectionTime(item.createdAt)}</span>
                </div>
              </div>
            </div>
          );
        })}
        {recentInspections.length === 0 ? (
          <div className="py-20 text-center text-gray-300">
            <ScheduleOutlined className="text-5xl mb-3 opacity-20" />
            <p className="text-sm font-medium tracking-wide">暂无近期录入数据</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user, activeTheme: currentTheme } = useAppContext();
  const navigate = useNavigate();
  const { data: summary, isLoading: summaryLoading } = useDashboardSummary();

  const statsData = useMemo<DashboardStatSnapshot>(() => {
    if (!summary) {
      return {
        totalDorms: 0,
        totalBeds: 0,
        occupiedBeds: 0,
        activeTasks: 0,
        pendingAppeals: 0,
        avgScore: '0.0',
      };
    }

    return {
      totalDorms: toFiniteNumber(summary.totalDorms),
      totalBeds: toFiniteNumber(summary.totalBeds),
      occupiedBeds: toFiniteNumber(summary.occupiedBeds),
      activeTasks: toFiniteNumber(summary.activeTasks),
      pendingAppeals: toFiniteNumber(summary.pendingAppeals),
      avgScore: toFiniteNumber(summary.averageScore).toFixed(1),
    };
  }, [summary]);

  const trendData = useMemo<DashboardTrendItem[]>(
    () =>
      (summary?.trendData || []).map((item: DashboardTrendPoint) => ({
        month: item.label || '--',
        score: Number(toFiniteNumber(item.score).toFixed(1)),
      })),
    [summary?.trendData],
  );

  const distributionData = useMemo<DashboardDistributionItem[]>(
    () => summary?.distribution || [],
    [summary?.distribution],
  );

  const recentInspections = useMemo<DashboardRecentInspection[]>(
    () => summary?.recentInspections || [],
    [summary?.recentInspections],
  );

  const stats = useMemo<ReactNode>(() => <DashboardStats {...statsData} />, [statsData]);

  return (
    <PageLayout
      stats={summaryLoading ? <StatCardSkeletonGroup /> : stats}
    >
      <div className="animate-apple-in" key={String(user?.id || 'dashboard')}>
        <Row gutter={[24, 24]} className="mb-8">
          <Col xs={24} xl={16}>
            <TrendPanel currentTheme={currentTheme} trendData={trendData} />
          </Col>

          <Col xs={24} xl={8}>
            <DistributionPanel distributionData={distributionData} />
          </Col>
        </Row>

        <Row gutter={[24, 24]}>
          <Col xs={24} lg={12}>
            <QuickActionsPanel navigate={navigate} />
          </Col>

          <Col xs={24} lg={12}>
            <RecentInspectionPanel
              navigate={navigate}
              recentInspections={recentInspections}
            />
          </Col>
        </Row>
      </div>
    </PageLayout>
  );
}
