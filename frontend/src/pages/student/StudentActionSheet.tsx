/**
 * 学生管理移动端操作菜单 (iOS Action Sheet)
 * @module pages/student/StudentActionSheet
 */

import {
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
} from "@ant-design/icons";
import IOSActionSheet from "../../components/common/IOSActionSheet";

import type {
  StudentActionSheetConfig,
  StudentActionSheetProps,
} from "./types";

/**
 * 学生操作菜单
 * @param {Object} props
 * @param {boolean} props.open - 是否打开
 * @param {Function} props.onClose - 关闭回调
 * @param {string[]} props.selectedIds - 选中的学生 ID 列表
 * @param {Array} props.tableItems - 当前表格数据项
 * @param {boolean} props.canEdit - 是否有编辑权限
 * @param {boolean} props.batchLoading - 批量操作加载状态
 * @param {Function} props.onViewDetail - 查看详情回调
 * @param {Function} props.onEdit - 编辑回调
 * @param {Function} props.onBulkDelete - 批量删除回调
 */
export default function StudentActionSheet({
  open,
  onClose,
  selectedIds,
  tableItems,
  canEdit,
  batchLoading,
  onViewDetail,
  onEdit,
  onBulkDelete,
}: StudentActionSheetProps) {
  const selectedStudent = selectedIds.length === 1
    ? tableItems.find((s) => s.id === selectedIds[0])
    : null;

  const actions: StudentActionSheetConfig[] = [
    {
      key: "view",
      label: "查看详情",
      icon: <EyeOutlined />,
      type: "default",
      hidden: selectedIds.length !== 1,
      onClick: () => {
        if (selectedStudent) {
          onViewDetail(selectedStudent);
        }
        onClose();
      },
    },
    {
      key: "edit",
      label: "编辑学生",
      icon: <EditOutlined />,
      type: "primary",
      hidden: selectedIds.length !== 1 || !canEdit,
      onClick: () => {
        if (selectedStudent) {
          onEdit(selectedStudent);
        }
        onClose();
      },
    },
    {
      key: "delete",
      label: `删除 (${selectedIds.length} 人)`,
      icon: <DeleteOutlined />,
      type: "danger",
      hidden: !canEdit,
      loading: batchLoading,
      onClick: () => {
        onClose();
        onBulkDelete();
      },
    },
  ];

  return (
    <IOSActionSheet
      open={open}
      onClose={onClose}
      title={`已选择 ${selectedIds.length} 名学生`}
      subtitle={
        selectedIds.length === 1 ? selectedStudent?.fullName : undefined
      }
      actions={actions}
    />
  );
}
