/* eslint-disable react-refresh/only-export-components */
/**
 * BuildingStats.jsx - 楼栋统计卡片组件
 * 
 * 渲染统计概览区域
 */
import { Col } from "antd";
import {
  BankOutlined,
  HomeOutlined,
  TeamOutlined,
  RiseOutlined,
} from "@ant-design/icons";
import AppleStatCard from "../../components/common/AppleStatCard";
import type { StatSegment } from "../../components/stats/CollapsibleStatsBoard";

import type { BuildingStatsState } from './types';

interface BuildingStatsProps {
  stats: BuildingStatsState;
}

/**
 * 楼栋统计卡片
 * @param {Object} props
 * @param {Object} props.stats - 统计数据
 * @param {number} props.stats.total - 楼栋总数
 * @param {number} props.stats.totalDorms - 关联宿舍数
 * @param {number} props.stats.maleBuildings - 男楼栋数
 * @param {number} props.stats.femaleBuildings - 女楼栋数
 * @param {number} props.stats.withElevator - 配备电梯数
 */
export function BuildingStats({ stats }: BuildingStatsProps) {
  return (
    <>
      <Col xs={12} sm={12} md={6}>
        <AppleStatCard
          icon={<BankOutlined />}
          value={stats.total}
          label="楼栋总数"
          dotColor="blue"
        />
      </Col>
      <Col xs={12} sm={12} md={6}>
        <AppleStatCard
          icon={<HomeOutlined />}
          value={stats.totalDorms}
          label="关联宿舍"
          dotColor="green"
        />
      </Col>
      <Col xs={12} sm={12} md={6}>
        <AppleStatCard
          icon={<TeamOutlined />}
          value={stats.maleBuildings}
          subValue={stats.femaleBuildings}
          label="男/女楼栋"
          dotColor="purple"
        />
      </Col>
      <Col xs={12} sm={12} md={6}>
        <AppleStatCard
          icon={<RiseOutlined />}
          value={stats.withElevator}
          label="配备电梯"
          dotColor="orange"
        />
      </Col>
    </>
  );
}

export function mapBuildingStatsToSegments(
  stats: BuildingStatsState,
): StatSegment[] {
  return [
    {
      id: "building-total",
      icon: <BankOutlined />,
      value: stats.total,
      label: "楼栋",
      tone: "blue",
    },
    {
      id: "building-dorms",
      icon: <HomeOutlined />,
      value: stats.totalDorms,
      label: "宿舍",
      tone: "green",
    },
    {
      id: "building-gender",
      icon: <TeamOutlined />,
      value: stats.maleBuildings,
      secondary: stats.femaleBuildings,
      label: "男/女",
      tone: "purple",
    },
    {
      id: "building-elevator",
      icon: <RiseOutlined />,
      value: stats.withElevator,
      label: "电梯",
      tone: "orange",
    },
  ];
}

export default BuildingStats;
