/**
 * 查寝结果移动端操作菜单
 */

import { useMemo } from "react";
import {
  DeleteOutlined,
  EyeOutlined,
  MessageOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import IOSActionSheet from "../../components/common/IOSActionSheet";

import type { IOSActionSheetAction } from '../../components/common/IOSActionSheet';
import type { EntityId } from '../../types/service';
import type { ResultAppealRecord, ResultInspectionRecord } from './types';

interface ResultActionSheetProps {
  open: boolean;
  onClose: () => void;
  selectedIds: EntityId[];
  filteredInspections: ResultInspectionRecord[];
  canAdjust: boolean;
  canViewAppeals?: boolean;
  activeRoleCode?: string;
  appealByInspectionId?: Map<string, ResultAppealRecord>;
  onOpenDetail: (inspection: ResultInspectionRecord) => void | Promise<void>;
  onDeleteResults: (ids: EntityId[]) => void | Promise<void>;
  onOpenAppealCreate?: (inspection: ResultInspectionRecord) => void;
  onViewAppeal?: (appealId: EntityId) => void;
}

export default function ResultActionSheet({
  open,
  onClose,
  selectedIds,
  filteredInspections,
  canAdjust,
  canViewAppeals,
  activeRoleCode,
  appealByInspectionId,
  onOpenDetail,
  onDeleteResults,
  onOpenAppealCreate,
  onViewAppeal,
}: ResultActionSheetProps) {
  const selectedRecord = useMemo(() => {
    if (selectedIds.length !== 1) return null;
    return filteredInspections.find((r) => r.id === selectedIds[0]) || null;
  }, [filteredInspections, selectedIds]);

  const matchedAppeal = useMemo(() => {
    if (!selectedRecord || selectedRecord.id === undefined || selectedRecord.id === null) {
      return undefined;
    }
    return appealByInspectionId?.get(String(selectedRecord.id));
  }, [appealByInspectionId, selectedRecord]);

  const isStudent = activeRoleCode === "STUDENT";
  const canSeeAppeal =
    matchedAppeal?.id !== undefined &&
    matchedAppeal?.id !== null &&
    (isStudent || Boolean(canViewAppeals));
  const canCreateAppeal =
    isStudent &&
    !canSeeAppeal &&
    selectedRecord?.totalScore !== null &&
    selectedRecord?.totalScore !== undefined;

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
            void onOpenDetail(selectedRecord);
          }
          onClose();
        },
      },
      {
        key: "viewAppeal",
        label: "查看申诉详情",
        icon: <MessageOutlined />,
        type: "default",
        hidden: selectedIds.length !== 1 || !canSeeAppeal,
        onClick: () => {
          onClose();
          if (matchedAppeal?.id !== undefined) {
            onViewAppeal?.(matchedAppeal.id);
          }
        },
      },
      {
        key: "appeal",
        label: "提交申诉",
        icon: <WarningOutlined />,
        type: "default",
        hidden: selectedIds.length !== 1 || !canCreateAppeal,
        onClick: () => {
          onClose();
          if (selectedRecord) {
            onOpenAppealCreate?.(selectedRecord);
          }
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
          void onDeleteResults(selectedIds);
        },
      },
    ],
    [
      canAdjust,
      canCreateAppeal,
      canSeeAppeal,
      matchedAppeal,
      onClose,
      onDeleteResults,
      onOpenAppealCreate,
      onOpenDetail,
      onViewAppeal,
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
