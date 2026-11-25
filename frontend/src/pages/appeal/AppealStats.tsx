/* eslint-disable react-refresh/only-export-components */
import { Col } from 'antd';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  FieldTimeOutlined,
} from '@ant-design/icons';

import AppleStatCard from '../../components/common/AppleStatCard';
import type { StatSegment } from '../../components/stats/CollapsibleStatsBoard';
import type { AppealStatsResponse } from '../../types/service';
import type { AppealStatsProps } from './types';

function formatAvgHours(hours: number): string {
  if (!Number.isFinite(hours) || hours <= 0) {
    return '0.0';
  }
  return hours.toFixed(1);
}

export default function AppealStats({ stats }: AppealStatsProps) {
  return (
    <>
      <Col xs={12} sm={12} md={6}>
        <AppleStatCard
          icon={<ClockCircleOutlined />}
          value={stats.pending}
          label="待处理"
          unit="条"
          dotColor="orange"
        />
      </Col>
      <Col xs={12} sm={12} md={6}>
        <AppleStatCard
          icon={<CheckCircleOutlined />}
          value={stats.approved}
          label="已通过"
          unit="条"
          dotColor="green"
        />
      </Col>
      <Col xs={12} sm={12} md={6}>
        <AppleStatCard
          icon={<CloseCircleOutlined />}
          value={stats.rejected}
          label="已驳回"
          unit="条"
          dotColor="red"
        />
      </Col>
      <Col xs={12} sm={12} md={6}>
        <AppleStatCard
          icon={<FieldTimeOutlined />}
          value={formatAvgHours(stats.avgHandleHours)}
          label="平均处理时长"
          unit="小时"
          dotColor="blue"
        />
      </Col>
    </>
  );
}

export function mapAppealStatsToSegments(
  stats: AppealStatsResponse,
): StatSegment[] {
  return [
    {
      id: 'appeal-pending',
      icon: <ClockCircleOutlined />,
      value: stats.pending,
      label: '待处理',
      unit: '条',
      tone: 'orange',
    },
    {
      id: 'appeal-approved',
      icon: <CheckCircleOutlined />,
      value: stats.approved,
      label: '已通过',
      unit: '条',
      tone: 'green',
    },
    {
      id: 'appeal-rejected',
      icon: <CloseCircleOutlined />,
      value: stats.rejected,
      label: '已驳回',
      unit: '条',
      tone: 'purple',
    },
    {
      id: 'appeal-avg-hours',
      icon: <FieldTimeOutlined />,
      value: formatAvgHours(stats.avgHandleHours),
      label: '平均耗时',
      unit: 'h',
      tone: 'blue',
    },
  ];
}
