import { Tooltip, Tag, Space, Button } from "antd";
import { DeleteOutlined, EditOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import GlassTable from "../../components/GlassTable";
import { getTaskStatusConfig } from "./utils";

import type { EntityId } from "../../types/service";
import type { TaskExecutor, TaskPublishTableProps, TaskPublishTask } from "./types";
import type { TableProps } from "antd";

export const TaskPublishTable = ({
  canEditTasks,
  canDeleteTasks,
  filteredTasks,
  userLookup,
  handleOpenEditModal,
  handleDeleteTask,
}: TaskPublishTableProps) => {
  const columns: TableProps<TaskPublishTask>["columns"] = [
    {
      title: "任务名称",
      key: "metadata",
      render: (_value: unknown, r: TaskPublishTask) => (
        <div className="flex flex-col gap-1">
          <div className="font-bold text-gray-800 dark:text-gray-100">
            {r.title || "未命名任务"}
          </div>
          <Tooltip
            title={`执行时间 ${dayjs(r.date).format(
              "YYYY.MM.DD HH:mm"
            )} ~ ${dayjs(r.deadline).format(
              "YYYY.MM.DD HH:mm"
            )}`}
          >
            <span className="text-xs text-gray-400">
              发布者 {r.createdByName || "未知"}
            </span>
          </Tooltip>
        </div>
      ),
    },
    {
      title: "状态",
      key: "status",
      align: "center",
      render: (_value: unknown, r: TaskPublishTask) => {
        const status = getTaskStatusConfig(r);
        return (
          <Tag
            color={status.color}
            className={status.className}
          >
            {status.label}
          </Tag>
        );
      },
    },
    {
      title: "检查进度",
      key: "completion",
      align: "center",
      render: (_value: unknown, r: TaskPublishTask) => {
        const inspected = Number(
          r.inspectionCount || r.inspectedCount || 0
        );
        const total = r.dormIds?.length || 0;
        const percent = total
          ? Math.min(100, Math.round((inspected / total) * 100))
          : 0;
        return (
          <Tooltip
            title={
              total ? `完成度 ${percent}%` : "暂无检查范围"
            }
          >
            <div className="task-progress-cell">
              <div className="task-progress-value">
                {inspected} / {total}
              </div>
              <div className="task-progress-track">
                <span
                  className="task-progress-fill"
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          </Tooltip>
        );
      },
    },
    {
      title: "检查人",
      key: "executors",
      align: "center",
      render: (_value: unknown, r: TaskPublishTask) => {
        const executorList = (r.executors && r.executors.length > 0)
          ? r.executors
          : (r.executorIds || []).map((id) =>
              userLookup[String(id)] ? { ...userLookup[String(id)], id } : { id }
            );

        const getLabel = (executor: TaskExecutor & { id?: EntityId }) =>
          executor.fullName ||
          executor.username ||
          "未知用户";

        const executorNames = executorList.map((executor) => getLabel(executor));
        if (!executorList.length) {
          return (
            <span className="text-xs text-gray-400">未指派</span>
          );
        }
        return (
          <Tooltip title={executorNames.join("、")}>
            <Space size={4} wrap>
              {executorList.slice(0, 3).map((executor) => (
                <Tag
                  key={executor.id}
                  className="ant-tag-blue !m-0"
                >
                  {getLabel(executor)}
                </Tag>
              ))}
              {executorList.length > 3 && (
                <Tag className="apple-tag-gray !m-0">
                  +{executorList.length - 3}
                </Tag>
              )}
            </Space>
          </Tooltip>
        );
      },
    },
    ...(canEditTasks || canDeleteTasks
      ? [
          {
            title: "操作",
            key: "actions",
            fixed: "right" as const,
            width: 76,
            className: "table-action-column",
            render: (_value: unknown, r: TaskPublishTask) => (
              <Space size={8} className="table-action-buttons dorm-table-action-group">
                {canEditTasks ? (
                <Tooltip title="编辑任务">
                  <Button
                    type="text"
                    size="small"
                    icon={<EditOutlined />}
                    className="dorm-table-action-btn is-edit"
                    onClick={() => handleOpenEditModal(r)}
                    aria-label="编辑任务"
                  />
                </Tooltip>
                ) : null}
                {canDeleteTasks ? (
                <Tooltip title="删除任务">
                  <Button
                    type="text"
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    className="dorm-table-action-btn is-danger"
                    onClick={() => {
                      void handleDeleteTask(r);
                    }}
                    aria-label="删除任务"
                  />
                </Tooltip>
                ) : null}
              </Space>
            ),
          },
        ]
      : []),
  ];

  return (
    <GlassTable
      dataSource={filteredTasks}
      rowKey="id"
      pagination={{
        defaultPageSize: 10,
        showSizeChanger: false,
        showQuickJumper: false,
      }}
      className="dorm-table"
      columns={columns}
    />
  );
};
