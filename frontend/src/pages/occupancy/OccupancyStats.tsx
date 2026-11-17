/* eslint-disable react-refresh/only-export-components */
/**
 * 入住管理统计卡片组件
 * OccupancyManagementPage 模块化
 */

import { Col } from "antd";
import {
  TeamOutlined,
  BankOutlined,
  SwapOutlined,
  KeyOutlined,
  HistoryOutlined,
  ClockCircleOutlined,
} from "@ant-design/icons";
import AppleStatCard from "../../components/common/AppleStatCard";
import type { StatSegment } from "../../components/stats/CollapsibleStatsBoard";

import type {
  OccupancyHistoryStatsProps,
  OccupancyOverviewStatsProps,
} from "./types";

/**
 * Overview Tab 统计卡片
 */
export function OverviewStats({ stats }: OccupancyOverviewStatsProps) {
  return (
    <>
      <Col xs={12} sm={12} md={6}>
        <AppleStatCard 
          icon={<BankOutlined />} 
          value={stats.totalBeds} 
          subValue={stats.totalDorms}
          label="总床位数 / 宿舍" 
          dotColor="blue" 
        />
      </Col>
      <Col xs={12} sm={12} md={6}>
        <AppleStatCard 
          icon={<TeamOutlined />} 
          value={`${stats.occupancyRate}%`}
          label="实时入住率" 
          dotColor="green" 
        />
      </Col>
      <Col xs={12} sm={12} md={6}>
        <AppleStatCard 
          icon={<KeyOutlined />} 
          value={stats.availableBeds} 
          label="剩余空床位" 
          dotColor="orange" 
        />
      </Col>
      <Col xs={12} sm={12} md={6}>
        <AppleStatCard 
          icon={<SwapOutlined />} 
          value={stats.monthlyMoves || 0} 
          label="本月异动频率" 
          dotColor="purple" 
        />
      </Col>
    </>
  );
}

export function mapOverviewStatsToSegments(
  stats: OccupancyOverviewStatsProps["stats"],
): StatSegment[] {
  return [
    {
      id: "occupancy-total-beds",
      icon: <BankOutlined />,
      value: stats.totalBeds,
      secondary: stats.totalDorms,
      label: "床位/宿舍",
      tone: "blue",
    },
    {
      id: "occupancy-rate",
      icon: <TeamOutlined />,
      value: stats.occupancyRate,
      label: "入住率",
      unit: "%",
      tone: "green",
    },
    {
      id: "occupancy-available",
      icon: <KeyOutlined />,
      value: stats.availableBeds,
      label: "空床",
      tone: "orange",
    },
    {
      id: "occupancy-moves",
      icon: <SwapOutlined />,
      value: stats.monthlyMoves || 0,
      label: "异动",
      tone: "purple",
    },
  ];
}

/**
 * History Tab 统计卡片
 */
export function HistoryStats({
  historyStats,
  studentDataTotal,
}: OccupancyHistoryStatsProps) {
  return (
    <>
      <Col xs={12} sm={12} md={6}>
        <AppleStatCard 
          icon={<HistoryOutlined />} 
          value={historyStats.total} 
          label="异动总记录" 
          dotColor="blue" 
        />
      </Col>
      <Col xs={12} sm={12} md={6}>
        <AppleStatCard 
          icon={<ClockCircleOutlined />} 
          value={historyStats.todayCount || 0}
          label="今日处理数" 
          dotColor="green" 
        />
      </Col>
      <Col xs={12} sm={12} md={6}>
        <AppleStatCard 
          icon={<TeamOutlined />} 
          value={studentDataTotal} 
          label="涉及学生总数" 
          dotColor="orange" 
        />
      </Col>
      <Col xs={12} sm={12} md={6}>
        <AppleStatCard 
          icon={<SwapOutlined />} 
          value={historyStats.latestTime ? new Date(historyStats.latestTime).toLocaleDateString('zh-CN') : '-'}
          label="最近异动时间" 
          dotColor="purple" 
        />
      </Col>
    </>
  );
}

export function mapHistoryStatsToSegments(
  historyStats: OccupancyHistoryStatsProps["historyStats"],
  studentDataTotal: number,
): StatSegment[] {
  return [
    {
      id: "occupancy-history-total",
      icon: <HistoryOutlined />,
      value: historyStats.total,
      label: "记录",
      tone: "blue",
    },
    {
      id: "occupancy-history-today",
      icon: <ClockCircleOutlined />,
      value: historyStats.todayCount || 0,
      label: "今日",
      tone: "green",
    },
    {
      id: "occupancy-history-students",
      icon: <TeamOutlined />,
      value: studentDataTotal,
      label: "学生",
      tone: "orange",
    },
    {
      id: "occupancy-history-latest",
      icon: <SwapOutlined />,
      value: historyStats.latestTime
        ? new Date(historyStats.latestTime).toLocaleDateString("zh-CN")
        : "-",
      label: "最近异动",
      tone: "purple",
    },
  ];
}
