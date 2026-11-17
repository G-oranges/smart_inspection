/**
 * BuildingActionSheet.jsx - iOS 风格操作菜单
 * 
 * 用于移动端批量操作的 ActionSheet 组件
 */
import { EyeOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import IOSActionSheet from "../../components/common/IOSActionSheet";

import type { Key } from 'react';
import type { IOSActionSheetAction } from '../../components/common/IOSActionSheet';

import type { BuildingRecord } from './types';

interface BuildingActionSheetProps {
  open: boolean;
  onClose: () => void;
  selectedIds: Key[];
  data: BuildingRecord[];
  onView: (record: BuildingRecord) => void;
  onEdit: (record: BuildingRecord) => void;
  onBulkDelete: () => void | Promise<void>;
}

/**
 * 楼栋操作菜单组件
 * @param {Object} props
 * @param {boolean} props.open - 是否打开
 * @param {Function} props.onClose - 关闭回调
 * @param {Array} props.selectedIds - 选中的 ID 列表
 * @param {Array} props.data - 数据源
 * @param {Function} props.onView - 查看详情回调
 * @param {Function} props.onEdit - 编辑回调
 * @param {Function} props.onBulkDelete - 批量删除回调
 */
export function BuildingActionSheet({
  open,
  onClose,
  selectedIds,
  data,
  onView,
  onEdit,
  onBulkDelete,
}: BuildingActionSheetProps) {
  // 查找选中的单条楼栋记录
  const selectedBuilding =
    selectedIds.length === 1
      ? data.find((building) => String(building.id) === String(selectedIds[0]))
      : null;

  const actions: IOSActionSheetAction[] = [
    {
      key: "view",
      label: "基础详情",
      icon: <EyeOutlined />,
      hidden: selectedIds.length !== 1,
      onClick: () => {
        if (selectedBuilding) {
          onView(selectedBuilding);
        }
        onClose();
      },
    },
    {
      key: "edit",
      label: "编辑资料",
      icon: <EditOutlined />,
      type: "primary",
      hidden: selectedIds.length !== 1,
      onClick: () => {
        if (selectedBuilding) {
          onEdit(selectedBuilding);
        }
        onClose();
      },
    },
    {
      key: "delete",
      label: `确认删除 (${selectedIds.length})`,
      icon: <DeleteOutlined />,
      type: "danger",
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
      title={selectedIds.length > 1 ? `批量操作 (${selectedIds.length})` : "楼栋管理"}
      subtitle={
        selectedIds.length === 1
          ? selectedBuilding?.name
          : "对选中的楼栋执行批量维护或导出"
      }
      actions={actions}
    />
  );
}

export default BuildingActionSheet;
