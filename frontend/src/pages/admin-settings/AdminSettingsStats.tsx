/* eslint-disable react-refresh/only-export-components */
import { Col } from "antd";
import { TagOutlined, NumberOutlined, EnvironmentOutlined, FontSizeOutlined } from "@ant-design/icons";
import AppleStatCard from "../../components/common/AppleStatCard";
import type { StatSegment } from "../../components/stats/CollapsibleStatsBoard";

import type { AdminSettingsDraft } from './types';

interface AdminSettingsStatsProps {
  draft: AdminSettingsDraft;
  fontSizeScale: number;
}

export const AdminSettingsStats = ({
  draft,
  fontSizeScale,
}: AdminSettingsStatsProps) => {
  const gradeRules = draft.gradingRules || [];
  const deductionItems = Array.isArray(draft.deductionItems) ? draft.deductionItems : [];
  const locationOptions = Array.isArray(draft.locationOptions) ? draft.locationOptions : [];

  return (
    <>
      <Col xs={12} sm={12} md={6}>
        <AppleStatCard 
          icon={<TagOutlined className="text-sm" />} 
          value={gradeRules.length} 
          label="预设评分等级" 
          dotColor="blue" 
          className="premium-glass bg-white/40 dark:bg-white/5 border-none shadow-sm"
        />
      </Col>
      <Col xs={12} sm={12} md={6}>
        <AppleStatCard 
          icon={<NumberOutlined className="text-sm" />} 
          value={deductionItems.filter((item) => item.enabled).length} 
          label="已启用扣分项" 
          dotColor="green" 
          className="premium-glass bg-white/40 dark:bg-white/5 border-none shadow-sm"
        />
      </Col>
      <Col xs={12} sm={12} md={6}>
        <AppleStatCard 
          icon={<EnvironmentOutlined className="text-sm" />} 
          value={locationOptions.length} 
          label="扣分位置" 
          dotColor="orange" 
          className="premium-glass bg-white/40 dark:bg-white/5 border-none shadow-sm"
        />
      </Col>
      <Col xs={12} sm={12} md={6}>
        <AppleStatCard 
          icon={<FontSizeOutlined className="text-sm" />} 
          value={`${Math.round(fontSizeScale * 100)}%`} 
          label="视觉缩放比例" 
          dotColor="purple" 
          className="premium-glass bg-white/40 dark:bg-white/5 border-none shadow-sm"
        />
      </Col>
    </>
  );
};

export const mapAdminSettingsStatsToSegments = (
  draft: AdminSettingsDraft,
  fontSizeScale: number,
): StatSegment[] => {
  const gradeRules = draft.gradingRules || [];
  const deductionItems = Array.isArray(draft.deductionItems) ? draft.deductionItems : [];
  const locationOptions = Array.isArray(draft.locationOptions) ? draft.locationOptions : [];

  return [
    {
      id: "settings-grade-rules",
      icon: <TagOutlined className="text-sm" />,
      value: gradeRules.length,
      label: "等级",
      tone: "blue",
    },
    {
      id: "settings-deduction-items",
      icon: <NumberOutlined className="text-sm" />,
      value: deductionItems.filter((item) => item.enabled).length,
      label: "扣分项",
      tone: "green",
    },
    {
      id: "settings-location-options",
      icon: <EnvironmentOutlined className="text-sm" />,
      value: locationOptions.length,
      label: "位置",
      tone: "orange",
    },
    {
      id: "settings-font-scale",
      icon: <FontSizeOutlined className="text-sm" />,
      value: Math.round(fontSizeScale * 100),
      label: "缩放",
      unit: "%",
      tone: "purple",
    },
  ];
};
