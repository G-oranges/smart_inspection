/**
 * 入住管理操作菜单
 * 移动端 iOS 风格 ActionSheet
 */

import { useMemo } from "react";
import { UserAddOutlined, LogoutOutlined, ArrowsAltOutlined } from "@ant-design/icons";
import IOSActionSheet from "../../components/common/IOSActionSheet";

import type {
  OccupancyActionSheetConfig,
  OccupancyActionSheetProps,
} from "./types";

/**
 * 入住管理操作菜单
 */
export default function OccupancyActionSheet({
  open,
  onClose,
  isBatchMode,
  selectedIds,
  selectedStudentId,
  studentData,
  selectedStudentsData,
  canEdit,
  // handlers
  openAdjustModal,
  openBatchCheckInModal,
  handleBatchCheckout,
  handleCheckout,
}: OccupancyActionSheetProps) {
  // 计算操作列表
  const actions = useMemo<OccupancyActionSheetConfig[]>(() => {
    if (isBatchMode) {
      const checkInCount = selectedStudentsData.filter((student) => !student.dormId).length;
      const checkOutCount = selectedStudentsData.filter((student) => student.dormId).length;
      
      return [
        {
          key: 'batch-checkin',
          label: `办理入住 (${checkInCount} 人)`,
          icon: <UserAddOutlined />,
          type: 'primary',
          hidden: !canEdit || checkInCount === 0,
          onClick: () => {
            onClose();
            openBatchCheckInModal();
          }
        },
        {
          key: 'batch-checkout',
          label: `确认退宿 (${checkOutCount} 人)`,
          icon: <LogoutOutlined />,
          type: 'danger',
          hidden: !canEdit || checkOutCount === 0,
          onClick: () => {
            onClose();
            handleBatchCheckout();
          }
        },
      ];
    } else {
      const student = studentData.items.find(
        (item) => String(item.id) === String(selectedStudentId),
      );
      if (!student) return [];
      
      return [
        {
          key: 'assign',
          label: '办理入住',
          icon: <UserAddOutlined />,
          type: 'primary',
          hidden: Boolean(student.dormId) || !canEdit,
          onClick: () => {
            onClose();
            openAdjustModal(student, "assign");
          }
        },
        {
          key: 'move',
          label: '调宿',
          icon: <ArrowsAltOutlined />,
          type: 'primary',
          hidden: !student.dormId || !canEdit,
          onClick: () => {
            onClose();
            openAdjustModal(student, "move");
          }
        },
        {
          key: 'checkout',
          label: '退宿',
          icon: <LogoutOutlined />,
          type: 'danger',
          hidden: !student.dormId || !canEdit,
          onClick: () => {
            onClose();
            if (student.id !== undefined && student.id !== null) {
              handleCheckout(student.id);
            }
          }
        }
      ];
    }
  }, [
    isBatchMode, 
    selectedStudentsData, 
    studentData, 
    selectedStudentId, 
    canEdit,
    onClose,
    openAdjustModal,
    openBatchCheckInModal,
    handleBatchCheckout,
    handleCheckout,
  ]);

  // 计算标题和副标题
  const title = isBatchMode 
    ? `批量操作 (${selectedIds.length} 人)` 
    : `入住管理操作`;
  
  const subtitle = useMemo(() => {
    if (isBatchMode) {
      return "支持批量入住、调放与退宿快捷操作";
    }
    const student = studentData.items.find(
      (item) => String(item.id) === String(selectedStudentId),
    );
    return student?.fullName || "";
  }, [isBatchMode, studentData, selectedStudentId]);

  return (
    <IOSActionSheet
      open={open}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      actions={actions}
    />
  );
}
