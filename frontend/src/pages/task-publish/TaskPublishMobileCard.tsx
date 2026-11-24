import { Tag } from "antd";
import dayjs from "dayjs";
import { getTaskStatusConfig } from "./utils";

import type { TaskPublishMobileCardProps } from "./types";

export const TaskPublishMobileCard = ({
  task,
  selected,
  onSelect,
}: TaskPublishMobileCardProps) => {
  const statusConfig = getTaskStatusConfig(task);
  const totalDorms = task.dormIds?.length || 0;
  const inspected = Number(
    task.inspectionCount || task.inspectedCount || 0
  );
  const progressPercent = totalDorms
    ? Math.min(100, Math.round((inspected / totalDorms) * 100))
    : 0;

  return (
    <div
      className={`mobile-compact-card relative overflow-hidden transition-all duration-300 ${
        selected
          ? "selected ring-2 ring-ios-blue ring-offset-2"
          : "hover:shadow-md"
      }`}
      onClick={() => onSelect && onSelect(!selected)}
      style={{ marginBottom: 12, borderRadius: "16px" }}
    >
      {/* Header */}
      <div className="compact-card-header">
        <div className="compact-header-left">
          <div className="compact-title font-bold text-gray-800 dark:text-gray-100">
            {task.title || "未命名任务"}
          </div>
          <div className="compact-subtitle text-gray-400">
            发布者 {task.createdByName || "未知"}
          </div>
        </div>
        <div className="compact-header-right">
          <Tag
            color={statusConfig.color}
            className={statusConfig.className}
          >
            {statusConfig.label}
          </Tag>
        </div>
      </div>

      {/* Grid */}
      <div className="compact-card-grid mt-3">
        <div className="compact-info-item">
          <span className="compact-label text-gray-400">
            覆盖寝室数
          </span>
          <span className="compact-value font-semibold text-blue-600 dark:text-blue-400">
            {totalDorms} 间
          </span>
        </div>
        <div className="compact-info-item">
          <span className="compact-label text-gray-400">
            完成度
          </span>
          <span className="compact-value font-medium">
            {totalDorms ? `${progressPercent}%` : "—"}
          </span>
        </div>
        <div className="compact-info-item">
          <span className="compact-label text-gray-400">
            检查人
          </span>
          <span className="compact-value font-medium">
            {task.executorIds?.length || 0} 人
          </span>
        </div>
        <div
          className="compact-info-item"
          style={{ gridColumn: "span 2" }}
        >
          <span className="compact-label text-gray-400">
            执行时间
          </span>
          <span className="compact-value font-medium">
            {dayjs(task.date).format("MM-DD HH:mm")} ~{" "}
            {dayjs(task.deadline).format("MM-DD HH:mm")}
          </span>
        </div>
      </div>
    </div>
  );
};
