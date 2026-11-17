/**
 * 教职工操作菜单组件 (iOS 风格)
 * @module pages/teacher/TeacherActionSheet
 */

import { EditOutlined, DeleteOutlined } from "@ant-design/icons";
import IOSActionSheet from "../../components/common/IOSActionSheet";

import type { IOSActionSheetAction } from '../../components/common/IOSActionSheet';
import type { EntityId } from '../../types/service';
import type { TeacherRecord } from './types';

interface TeacherActionSheetProps {
  open: boolean;
  onClose: () => void;
  selectedIds: EntityId[];
  items: TeacherRecord[];
  canEdit: boolean;
  batchLoading: boolean;
  onEdit: (teacher: TeacherRecord) => void;
  onBulkDelete: () => void;
}

/**
 * 教职工操作菜单
 * @param {Object} props - 组件属性
 * @param {boolean} props.open - 是否打开
 * @param {Function} props.onClose - 关闭回调
 * @param {string[]} props.selectedIds - 选中的 ID 列表
 * @param {Array} props.items - 数据列表
 * @param {boolean} props.canEdit - 是否有编辑权限
 * @param {boolean} props.batchLoading - 批量操作加载状态
 * @param {Function} props.onEdit - 编辑回调
 * @param {Function} props.onBulkDelete - 批量删除回调
 */
export default function TeacherActionSheet({
  open,
  onClose,
  selectedIds,
  items,
  canEdit,
  batchLoading,
  onEdit,
  onBulkDelete,
}: TeacherActionSheetProps) {
  // 获取单选时的教职工名称
  const selectedTeacher = selectedIds.length === 1
    ? items.find((t) => t.id === selectedIds[0])
    : null;

  const handleDelete = () => {
    onClose();
    onBulkDelete();
  };

  const actions: IOSActionSheetAction[] = [
    {
      key: "edit",
      label: "编辑资料",
      icon: <EditOutlined />,
      type: "primary",
      hidden: selectedIds.length !== 1 || !canEdit,
      onClick: () => {
        if (selectedTeacher) {
          onEdit(selectedTeacher);
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
      onClick: handleDelete,
    },
  ];

  return (
    <IOSActionSheet
      open={open}
      onClose={onClose}
      title={`已选择 ${selectedIds.length} 名教职工`}
      subtitle={
        selectedTeacher
          ? selectedTeacher.fullName
          : "支持批量修改与安全删除"
      }
      actions={actions}
    />
  );
}
