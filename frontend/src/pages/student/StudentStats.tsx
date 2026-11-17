/* eslint-disable react-refresh/only-export-components */
/**
 * 学生管理统计卡片区域
 * @module pages/student/StudentStats
 */

import { Col } from "antd";
import {
  UserOutlined,
  ManOutlined,
  BankOutlined,
  FilterOutlined,
} from "@ant-design/icons";
import AppleStatCard from "../../components/common/AppleStatCard";
import type { StatSegment } from "../../components/stats/CollapsibleStatsBoard";

import type { StudentStatsProps } from "./types";

/**
 * 学生统计卡片
 * @param {Object} props - 组件属性
 * @param {Object} props.stats - 统计数据
 * @param {number} props.stats.total - 学生总数
 * @param {number} props.stats.maleCount - 男生人数
 * @param {number} props.stats.femaleCount - 女生人数
 * @param {number} props.stats.dormsCount - 已分楼栋数
 * @param {number} props.filteredTotal - 筛选结果数量
 */
export default function StudentStats({ stats, filteredTotal }: StudentStatsProps) {
  return (
    <>
      <Col xs={12} sm={12} md={6}>
        <AppleStatCard
          icon={<UserOutlined />}
          value={stats.total}
          label="学生总数"
          unit="人"
          dotColor="blue"
        />
      </Col>
      <Col xs={12} sm={12} md={6}>
        <AppleStatCard
          icon={<ManOutlined />}
          value={stats.maleCount}
          subValue={stats.femaleCount}
          label="男/女分布"
          unit="人"
          dotColor="purple"
        />
      </Col>
      <Col xs={12} sm={12} md={6}>
        <AppleStatCard
          icon={<BankOutlined />}
          value={stats.dormsCount}
          label="已分楼栋"
          unit="栋"
          dotColor="green"
        />
      </Col>
      <Col xs={12} sm={12} md={6}>
        <AppleStatCard
          icon={<FilterOutlined />}
          value={filteredTotal}
          label="筛选结果"
          unit="人"
          dotColor="orange"
        />
      </Col>
    </>
  );
}

export function mapStudentStatsToSegments(
  stats: StudentStatsProps["stats"],
  filteredTotal: number,
): StatSegment[] {
  return [
    {
      id: "student-total",
      icon: <UserOutlined />,
      value: stats.total,
      label: "学生",
      unit: "人",
      tone: "blue",
    },
    {
      id: "student-gender",
      icon: <ManOutlined />,
      value: stats.maleCount,
      secondary: stats.femaleCount,
      label: "男/女",
      unit: "人",
      tone: "purple",
    },
    {
      id: "student-building",
      icon: <BankOutlined />,
      value: stats.dormsCount,
      label: "楼栋",
      unit: "栋",
      tone: "green",
    },
    {
      id: "student-filtered",
      icon: <FilterOutlined />,
      value: filteredTotal,
      label: "筛选",
      unit: "人",
      tone: "orange",
    },
  ];
}
