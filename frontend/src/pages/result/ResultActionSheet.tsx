/**
 * 查寝结果移动端操作菜单
 */

import { useMemo } from "react";
import { DeleteOutlined, EyeOutlined, WarningOutlined } from "@ant-design/icons";
import IOSActionSheet from "../../components/common/IOSActionSheet";

import type { IOSActionSheetAction } from '../../components/common/IOSActionSheet';
import type { EntityId } from '../../types/service';
import type { ResultInspectionRecord } from './types';

interface ResultActionSheetProps {
  open: boolean;
  onClose: () => void;
  selectedIds: EntityId[];
  filteredInspections: ResultInspectionRecord[];
  canAdjust: boolean;
  activeRoleCode?: string;
  onOpenDetail: (inspection: ResultInspectionRecord) => void | Promise<void>;
  onDeleteResults: (ids: EntityId[]) => void | Promise<void>;
  onSelectAppealInspection?: (inspectionId: EntityId) => void;
}

export default function ResultActionSheet({
  open,
  onClose,
  selectedIds,
  filteredInspections,
  canAdjust,
  activeRoleCode,
  onOpenDetail,
  onDeleteResults,
  onSelectAppealInspection,
}: ResultActionSheetProps) {
  const selectedRecord = useMemo(() => {
    if (selectedIds.length !== 1) return null;
    return filteredInspections.find((r) => r.id === selectedIds[0]) || null;
  }, [filteredInspections, selectedIds]);

  const actions = useMemo<IOSActionSheetAction[]>(
    () => [
      {
        key: "detail",
        label: "查阅详细报告",
        icon: <EyeOutlined />,
        type: "primary",
        hidden: selectedIds.length !== 1,
        onClick: () => {
          if (selectedRecord) {
            onOpenDetail(selectedRecord);
          }
          onClose();
        },
      },
      {
        key: "appeal",
        label: "提交申诉",
        icon: <WarningOutlined />,
        type: "default",
        hidden: selectedIds.length !== 1 || activeRoleCode !== "STUDENT",
        onClick: () => {
          if (selectedIds[0] !== undefined) {
            onSelectAppealInspection?.(selectedIds[0]);
          }
          onClose();
          document
            .getElementById("appeal-section")
            ?.scrollIntoView({ behavior: "smooth" });
        },
      },
      {
        key: "delete",
        label:
          selectedIds.length > 1 ? `删除 ${selectedIds.length} 条` : "删除",
        icon: <DeleteOutlined />,
        type: "danger",
        hidden: !canAdjust || selectedIds.length === 0,
        onClick: () => {
          onClose();
          onDeleteResults(selectedIds);
        },
      },
    ],
    [
      activeRoleCode,
      canAdjust,
      onClose,
      onDeleteResults,
      onOpenDetail,
      onSelectAppealInspection,
      selectedIds,
      selectedRecord,
    ],
  );

  return (
    <IOSActionSheet
      open={open}
      onClose={onClose}
      title={`已选择 ${selectedIds.length} 条记录`}
      subtitle={
        selectedIds.length === 1
          ? selectedRecord?.task?.title
          : undefined
      }
      actions={actions}
    />
  );
}
