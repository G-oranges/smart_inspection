/* eslint-disable react-refresh/only-export-components */
import { Col } from "antd";
import { FileTextOutlined, UserOutlined, SwapOutlined, InfoCircleOutlined } from "@ant-design/icons";
import AppleStatCard from "../../components/common/AppleStatCard";
import type { StatSegment } from "../../components/stats/CollapsibleStatsBoard";

import type { AuditLogStatsState } from './types';

interface AuditLogStatsProps {
  stats: AuditLogStatsState;
}

export const AuditLogStats = ({ stats }: AuditLogStatsProps) => {
  return (
    <>
      <Col xs={12} sm={12} md={6}>
        <AppleStatCard 
          icon={<FileTextOutlined />} 
          value={stats.total} 
          label="记录总数" 
          dotColor="blue" 
        />
      </Col>
      <Col xs={12} sm={12} md={6}>
        <AppleStatCard 
          icon={<UserOutlined />} 
          value={stats.byAction?.find(a => a.action === 'LOGIN')?.count || 0} 
          label="登录活动" 
          dotColor="green" 
        />
      </Col>
      <Col xs={12} sm={12} md={6}>
        <AppleStatCard 
          icon={<SwapOutlined />} 
          value={stats.byAction?.find(a => a.action === 'UPDATE')?.count || 0} 
          label="数据变更" 
          dotColor="purple" 
        />
      </Col>
      <Col xs={12} sm={12} md={6}>
        <AppleStatCard 
          icon={<InfoCircleOutlined />} 
          value={stats.byModule?.length || 0} 
          label="涉及模块" 
          dotColor="orange" 
        />
      </Col>
    </>
  );
};

export const mapAuditLogStatsToSegments = (
  stats: AuditLogStatsState,
): StatSegment[] => [
  {
    id: "audit-total",
    icon: <FileTextOutlined />,
    value: stats.total,
    label: "记录",
    tone: "blue",
  },
  {
    id: "audit-login",
    icon: <UserOutlined />,
    value: stats.byAction?.find((item) => item.action === "LOGIN")?.count || 0,
    label: "登录",
    tone: "green",
  },
  {
    id: "audit-update",
    icon: <SwapOutlined />,
    value: stats.byAction?.find((item) => item.action === "UPDATE")?.count || 0,
    label: "变更",
    tone: "purple",
  },
  {
    id: "audit-module",
    icon: <InfoCircleOutlined />,
    value: stats.byModule?.length || 0,
    label: "模块",
    tone: "orange",
  },
];
