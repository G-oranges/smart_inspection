import { EditOutlined, DeleteOutlined } from "@ant-design/icons";
import IOSActionSheet from "../../components/common/IOSActionSheet";
import type {
  TaskPublishActionSheetItem,
  TaskPublishActionSheetProps,
} from "./types";

export const TaskPublishActionSheet = ({
  canEditTasks,
  canDeleteTasks,
  open,
  onClose,
  selectedTaskIds,
  sortedTasks,
  handleOpenEditModal,
  handleDeleteTask,
  handleBulkDeleteTasks,
}: TaskPublishActionSheetProps) => {
  const getActions = (): TaskPublishActionSheetItem[] => {
    if (!canEditTasks && !canDeleteTasks) {
      return [];
    }

    if (selectedTaskIds.length === 1) {
      const task = sortedTasks.find((item) => item.id === selectedTaskIds[0]);
      if (!task) return [];
      const singleActions: TaskPublishActionSheetItem[] = [
        {
          key: "edit",
          label: "编辑任务",
          icon: <EditOutlined />,
          type: "primary",
          onClick: () => {
            onClose();
            handleOpenEditModal(task);
          },
        },
        {
          key: "delete",
          label: "删除任务",
          icon: <DeleteOutlined />,
          type: "danger",
          onClick: () => {
            onClose();
            handleDeleteTask(task);
          },
        },
      ];
      return singleActions.filter((item) => (item.key === "edit" ? canEditTasks : canDeleteTasks));
    } else {
      if (!canDeleteTasks) {
        return [];
      }
      return [
        {
          key: "batch-delete",
          label: `删除任务 (${selectedTaskIds.length} 项)`,
          icon: <DeleteOutlined />,
          type: "danger",
          onClick: () => {
            onClose();
            handleBulkDeleteTasks(selectedTaskIds);
          },
        },
      ];
    }
  };

  const title = selectedTaskIds.length === 1 ? "任务操作" : `批量操作 (${selectedTaskIds.length} 项)`;
  const subtitle = selectedTaskIds.length === 1
    ? sortedTasks.find((t) => t.id === selectedTaskIds[0])?.title
    : undefined;

  return (
    <IOSActionSheet
      open={open}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      actions={getActions()}
    />
  );
};
