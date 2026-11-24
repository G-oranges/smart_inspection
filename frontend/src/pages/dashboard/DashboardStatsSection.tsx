import {
  AlertOutlined,
  BarChartOutlined,
  HomeOutlined,
  ScheduleOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { Col } from 'antd';
import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import AppleStatCard from '../../components/common/AppleStatCard';
import CollapsibleStatsBoard from '../../components/stats/CollapsibleStatsBoard';
import type { StatSegment } from '../../components/stats/CollapsibleStatsBoard';
import type { DashboardStatSnapshot, DashboardViewMode } from './dashboardUtils';

interface DashboardStatsSectionProps {
  stats: DashboardStatSnapshot;
  viewMode: DashboardViewMode;
  hasPermission: (code: string) => boolean;
}

interface StatCardSpec {
  id: string;
  icon: ReactNode;
  value: string | number;
  subValue?: string | number;
  unit?: string;
  label: string;
  dotColor: 'blue' | 'green' | 'orange' | 'red' | 'gray';
  path?: string;
}

export default function DashboardStatsSection({
  stats,
  viewMode,
  hasPermission,
}: DashboardStatsSectionProps) {
  const navigate = useNavigate();

  const cards = useMemo<StatCardSpec[]>(() => {
    const canViewOccupancy = hasPermission('DORM_VIEW');
    const canViewStudents = hasPermission('STUDENT_VIEW');
    const canViewResults = hasPermission('RESULT_VIEW');
    const canPublishTask =
      hasPermission('TASK_PUBLISH') ||
      hasPermission('TASK_EDIT') ||
      hasPermission('TASK_DELETE');
    const canRecord = hasPermission('RESULT_RECORD');

    const taskTarget = canRecord
      ? '/tasks/entry'
      : canPublishTask
        ? '/tasks/publish'
        : undefined;

    const firstCard: StatCardSpec =
      stats.totalBeds > 0 || canViewOccupancy
        ? {
            id: 'occupancy',
            icon: <HomeOutlined />,
            value: stats.occupiedBeds,
            subValue: stats.totalBeds,
            label:
              stats.totalBeds > 0
                ? `已入住床位 · ${stats.occupancyRate}%`
                : '已入住 / 总床位',
            dotColor: stats.occupancyRate >= 85 ? 'green' : 'blue',
            path: canViewOccupancy ? '/occupancy' : undefined,
          }
        : {
            id: 'students',
            icon: <TeamOutlined />,
            value: stats.totalStudents,
            label: '负责学生',
            dotColor: 'blue',
            path: canViewStudents ? '/students' : undefined,
          };

    const scoreCard: StatCardSpec = {
      id: 'avg-score',
      icon: <BarChartOutlined />,
      value: stats.avgScoreText,
      unit: '分',
      label: viewMode === 'student' ? '宿舍本月均分' : '本月卫生均分',
      dotColor:
        stats.avgScoreValue >= 90
          ? 'green'
          : stats.avgScoreValue >= 60
            ? 'orange'
            : stats.avgScoreValue > 0
              ? 'red'
              : 'gray',
      path: canViewResults ? '/results' : undefined,
    };

    const taskCard: StatCardSpec = {
      id: 'active-tasks',
      icon: <ScheduleOutlined />,
      value: stats.activeTasks,
      label: '进行中任务',
      dotColor: stats.activeTasks > 0 ? 'blue' : 'gray',
      path: taskTarget,
    };

    const appealCard: StatCardSpec = {
      id: 'pending-appeals',
      icon: <AlertOutlined />,
      value: stats.pendingAppeals,
      label: '待处理申诉',
      dotColor: stats.pendingAppeals > 0 ? 'red' : 'gray',
      path: canViewResults ? '/results?focus=appeals' : undefined,
    };

    if (viewMode === 'inspector') {
      return [taskCard, firstCard, scoreCard, appealCard];
    }

    return [firstCard, scoreCard, taskCard, appealCard];
  }, [hasPermission, stats, viewMode]);

  const segments = useMemo<StatSegment[]>(
    () =>
      cards.map((card) => ({
        id: card.id,
        icon: card.icon,
        value: card.value,
        secondary: card.subValue,
        unit: card.unit,
        label: card.label,
        tone: card.dotColor,
      })),
    [cards],
  );

  const expandedContent = useMemo(
    () => (
      <>
        {cards.map((card) => (
          <Col key={card.id} xs={12} sm={12} md={6}>
            <AppleStatCard
              icon={card.icon}
              value={card.value}
              subValue={card.subValue}
              unit={card.unit}
              label={card.label}
              dotColor={card.dotColor}
              trend={card.id === 'avg-score' ? stats.scoreDelta : undefined}
              onClick={card.path ? () => navigate(card.path!) : undefined}
            />
          </Col>
        ))}
      </>
    ),
    [cards, navigate, stats.scoreDelta],
  );

  return (
    <CollapsibleStatsBoard
      expandedContent={expandedContent}
      segments={segments}
    />
  );
}
