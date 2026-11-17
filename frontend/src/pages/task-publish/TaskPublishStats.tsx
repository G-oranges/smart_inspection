/* eslint-disable react-refresh/only-export-components */
import { Col } from "antd";
import { ClusterOutlined, SyncOutlined, CalendarOutlined, LineChartOutlined } from "@ant-design/icons";
import AppleStatCard from "../../components/common/AppleStatCard";
import type { StatSegment } from "../../components/stats/CollapsibleStatsBoard";

import type { TaskPublishStatsProps } from "./types";

export const TaskPublishStats = ({ taskStats }: TaskPublishStatsProps) => {
  const coverageLabel = taskStats.totalDorms
    ? `总检查完成比 ${taskStats.inspected}/${taskStats.totalDorms}`
    : "总检查完成比";
    
  return (
    <>
      <Col xs={12} sm={12} md={6}>
        <AppleStatCard
          icon={<ClusterOutlined />}
          value={taskStats.total}
          label="累计任务"
          dotColor="blue"
          trend={taskStats.momGrowth}
        />
      </Col>
      <Col xs={12} sm={12} md={6}>
        <AppleStatCard
          icon={
            taskStats.inProgress > 0 ? (
              <SyncOutlined className="task-sync-spin" />
            ) : (
              <SyncOutlined />
            )
          }
          value={taskStats.inProgress}
          label="活跃任务"
          dotColor="green"
        />
      </Col>
      <Col xs={12} sm={12} md={6}>
        <AppleStatCard
          icon={<CalendarOutlined />}
          value={taskStats.upcoming}
          label="计划任务"
          dotColor="orange"
        />
      </Col>
      <Col xs={12} sm={12} md={6}>
        <AppleStatCard
          icon={<LineChartOutlined />}
          value={taskStats.coverageRate}
          unit="%"
          label={coverageLabel}
          dotColor="purple"
        />
      </Col>
    </>
  );
};

export const mapTaskPublishStatsToSegments = (
  taskStats: TaskPublishStatsProps["taskStats"],
): StatSegment[] => [
  {
    id: "task-total",
    icon: <ClusterOutlined />,
    value: taskStats.total,
    label: "累计",
    tone: "blue",
  },
  {
    id: "task-progress",
    icon: taskStats.inProgress > 0 ? <SyncOutlined className="task-sync-spin" /> : <SyncOutlined />,
    value: taskStats.inProgress,
    label: "活跃",
    tone: "green",
  },
  {
    id: "task-upcoming",
    icon: <CalendarOutlined />,
    value: taskStats.upcoming,
    label: "计划",
    tone: "orange",
  },
  {
    id: "task-coverage",
    icon: <LineChartOutlined />,
    value: taskStats.coverageRate,
    label: "完成比",
    unit: "%",
    tone: "purple",
  },
];
