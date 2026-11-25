import { useMemo } from 'react';
import {
  AuditOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  EyeOutlined,
  RollbackOutlined,
} from '@ant-design/icons';

import IOSActionSheet from '../../components/common/IOSActionSheet';
import type { IOSActionSheetAction } from '../../components/common/IOSActionSheet';
import { formatAppealDormName } from './appealSchema';
import type { AppealRecord } from '../../types/service';

export interface AppealActionSheetProps {
  open: boolean;
  onClose: () => void;
  selectedIds: string[];
  items: AppealRecord[];
  canHandle: boolean;
  isStudent: boolean;
  onOpenDetail: (record: AppealRecord) => void;
  onOpenHandle: (record: AppealRecord) => void;
  onBatchApprove?: () => void;
  onBatchReject?: () => void;
  onWithdraw?: (record: AppealRecord) => void;
}

export default function AppealActionSheet({
  open,
  onClose,
  selectedIds,
  items,
  canHandle,
  isStudent,
  onOpenDetail,
  onOpenHandle,
  onBatchApprove,
  onBatchReject,
  onWithdraw,
}: AppealActionSheetProps) {
  const selectedRecord = useMemo(() => {
    if (selectedIds.length !== 1) return null;
    return items.find((item) => String(item.id) === selectedIds[0]) || null;
  }, [items, selectedIds]);

  const pendingSelectedCount = useMemo(
    () =>
      items.filter(
        (item) =>
          selectedIds.includes(String(item.id)) && item.status === 'pending',
      ).length,
    [items, selectedIds],
  );

  const actions = useMemo<IOSActionSheetAction[]>(
    () => [
      {
        key: 'detail',
        label: '查看申诉详情',
        icon: <EyeOutlined />,
        type: 'primary',
        hidden: selectedIds.length !== 1 || !selectedRecord,
        onClick: () => {
          if (selectedRecord) {
            onOpenDetail(selectedRecord);
          }
          onClose();
        },
      },
      {
        key: 'handle',
        label: '审批处理（支持改扣分）',
        icon: <AuditOutlined />,
        type: 'default',
        hidden:
          !canHandle ||
          selectedIds.length !== 1 ||
          selectedRecord?.status !== 'pending',
        onClick: () => {
          if (selectedRecord) {
            onOpenHandle(selectedRecord);
          }
          onClose();
        },
      },
      {
        key: 'batchApprove',
        label: `批量通过 (${pendingSelectedCount})`,
        icon: <CheckCircleOutlined />,
        type: 'default',
        hidden: !canHandle || selectedIds.length <= 1 || pendingSelectedCount === 0,
        onClick: () => {
          onClose();
          onBatchApprove?.();
        },
      },
      {
        key: 'batchReject',
        label: `批量驳回 (${pendingSelectedCount})`,
        icon: <CloseCircleOutlined />,
        type: 'danger',
        hidden: !canHandle || selectedIds.length <= 1 || pendingSelectedCount === 0,
        onClick: () => {
          onClose();
          onBatchReject?.();
        },
      },
      {
        key: 'withdraw',
        label: '撤回申诉',
        icon: <RollbackOutlined />,
        type: 'danger',
        hidden:
          !isStudent ||
          selectedIds.length !== 1 ||
          selectedRecord?.status !== 'pending',
        onClick: () => {
          onClose();
          if (selectedRecord) {
            onWithdraw?.(selectedRecord);
          }
        },
      },
    ],
    [
      canHandle,
      isStudent,
      onBatchApprove,
      onBatchReject,
      onClose,
      onOpenDetail,
      onOpenHandle,
      onWithdraw,
      pendingSelectedCount,
      selectedIds.length,
      selectedRecord,
    ],
  );

  return (
    <IOSActionSheet
      open={open}
      onClose={onClose}
      title={`已选择 ${selectedIds.length} 条申诉`}
      subtitle={
        selectedRecord
          ? `${formatAppealDormName(selectedRecord.inspection?.dorm)} · ${selectedRecord.student?.fullName || ''}`
          : undefined
      }
      actions={actions}
    />
  );
}
