import { useCallback, useState } from 'react';
import { Modal, message } from 'antd';

import { useInvalidateAppeals } from '../../hooks/useAppealsQuery';
import { appealService } from '../../services/appealService';
import { ApiError } from '../../utils/api';
import {
  INITIAL_APPEAL_CREATE_FORM,
  INITIAL_APPEAL_HANDLE_FORM,
} from './appealSchema';
import type {
  AppealDeductionAdjustment,
  AppealRecord,
  EntityId,
} from '../../types/service';
import type {
  AppealBatchModalState,
  AppealCreateFormState,
  AppealHandleFormState,
} from './types';

function readErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
}

export interface UseAppealActionsOptions {
  onSyncLegacyCollections?: () => Promise<void> | void;
  onClearSelection?: () => void;
}

export function useAppealActions({
  onSyncLegacyCollections,
  onClearSelection,
}: UseAppealActionsOptions = {}) {
  const { invalidateAllAppeals, invalidateDeductions } = useInvalidateAppeals();

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<AppealCreateFormState>(
    INITIAL_APPEAL_CREATE_FORM,
  );
  const [createSubmitting, setCreateSubmitting] = useState(false);

  const [handlingAppeal, setHandlingAppeal] = useState<AppealRecord | null>(null);
  const [handleForm, setHandleForm] = useState<AppealHandleFormState>(
    INITIAL_APPEAL_HANDLE_FORM,
  );
  const [handleSubmitting, setHandleSubmitting] = useState(false);
  const [deductionResetSignal, setDeductionResetSignal] = useState(0);

  const [batchModal, setBatchModal] = useState<AppealBatchModalState>({
    open: false,
    status: 'approved',
    reply: '',
  });
  const [batchSubmitting, setBatchSubmitting] = useState(false);

  const refreshAfterMutation = useCallback(async () => {
    await invalidateAllAppeals();
    await onSyncLegacyCollections?.();
  }, [invalidateAllAppeals, onSyncLegacyCollections]);

  const releasePhotoPreviews = useCallback((form: AppealCreateFormState) => {
    form.photos.forEach((photo) => {
      if (photo.previewUrl) {
        URL.revokeObjectURL(photo.previewUrl);
      }
    });
  }, []);

  const openCreateModal = useCallback((initialInspectionId?: EntityId) => {
    setCreateForm({
      ...INITIAL_APPEAL_CREATE_FORM,
      inspectionId: initialInspectionId ?? '',
    });
    setCreateOpen(true);
  }, []);

  const closeCreateModal = useCallback(() => {
    setCreateForm((prev) => {
      releasePhotoPreviews(prev);
      return INITIAL_APPEAL_CREATE_FORM;
    });
    setCreateOpen(false);
  }, [releasePhotoPreviews]);

  const submitCreateAppeal = useCallback(async () => {
    if (!createForm.inspectionId || createForm.content.trim().length < 5) {
      return;
    }

    setCreateSubmitting(true);
    try {
      await appealService.createAppeal({
        inspectionId: createForm.inspectionId,
        content: createForm.content.trim(),
        disputedCodes: createForm.disputedCodes,
        photos: createForm.photos.map((item) => item.photoId),
      });
      releasePhotoPreviews(createForm);
      setCreateForm(INITIAL_APPEAL_CREATE_FORM);
      setCreateOpen(false);
      message.success('已提交申诉');
      await refreshAfterMutation();
    } catch (error) {
      message.error(readErrorMessage(error, '提交申诉失败'));
    } finally {
      setCreateSubmitting(false);
    }
  }, [createForm, refreshAfterMutation, releasePhotoPreviews]);

  const openHandleModal = useCallback((appeal: AppealRecord) => {
    setHandlingAppeal(appeal);
    setHandleForm({
      appealId: appeal.id,
      status: 'approved',
      reply: '',
    });
  }, []);

  const closeHandleModal = useCallback(() => {
    setHandlingAppeal(null);
    setHandleForm(INITIAL_APPEAL_HANDLE_FORM);
  }, []);

  const submitHandleAppeal = useCallback(
    async ({
      inspectionVersion,
      adjustments,
      scoreDelta,
    }: {
      inspectionVersion: string;
      adjustments: AppealDeductionAdjustment[];
      scoreDelta: number;
    }) => {
      if (!handlingAppeal) {
        return;
      }

      if (handleForm.status === 'approved' && scoreDelta < 0) {
        const confirmed = await new Promise<boolean>((resolve) => {
          Modal.confirm({
            title: '确认调低分数',
            content: `通过后该宿舍分数将下降 ${Math.abs(scoreDelta)} 分，确认？`,
            okText: '确认通过',
            cancelText: '取消',
            okType: 'danger',
            maskClosable: false,
            onOk: () => resolve(true),
            onCancel: () => resolve(false),
          });
        });
        if (!confirmed) {
          return;
        }
      }

      setHandleSubmitting(true);
      try {
        await appealService.handleAppeal({
          appealId: handlingAppeal.id,
          status: handleForm.status,
          reply: handleForm.reply.trim(),
          inspectionVersion,
          deductionAdjustments:
            handleForm.status === 'approved' ? adjustments : [],
        });
        message.success(
          handleForm.status === 'approved' ? '已通过该申诉' : '已驳回该申诉',
        );
        closeHandleModal();
        await refreshAfterMutation();
      } catch (error) {
        if (error instanceof ApiError && error.code === 'INSPECTION_CHANGED') {
          message.warning('查寝记录已变更，已刷新');
          setDeductionResetSignal((prev) => prev + 1);
          await Promise.all([
            invalidateDeductions(handlingAppeal.id),
            invalidateAllAppeals(),
          ]);
          return;
        }
        message.error(readErrorMessage(error, '处理申诉失败'));
      } finally {
        setHandleSubmitting(false);
      }
    },
    [
      closeHandleModal,
      handleForm.reply,
      handleForm.status,
      handlingAppeal,
      invalidateAllAppeals,
      invalidateDeductions,
      refreshAfterMutation,
    ],
  );

  const openBatchModal = useCallback((status: 'approved' | 'rejected') => {
    setBatchModal({
      open: true,
      status,
      reply: '',
    });
  }, []);

  const closeBatchModal = useCallback(() => {
    setBatchModal((prev) => ({ ...prev, open: false, reply: '' }));
  }, []);

  const submitBatchHandle = useCallback(
    async (selectedIds: string[]) => {
      if (selectedIds.length === 0) {
        return;
      }

      setBatchSubmitting(true);
      try {
        const response = await appealService.batchHandleAppeals({
          ids: selectedIds,
          status: batchModal.status,
          reply: batchModal.reply.trim(),
        });

        const failedCount = response.failed?.length || 0;
        if (failedCount === 0) {
          message.success(`成功处理 ${response.success} 条申诉`);
        } else {
          message.warning(
            `已处理 ${response.success} 条，${failedCount} 条因状态或记录变更跳过`,
          );
        }

        closeBatchModal();
        onClearSelection?.();
        await refreshAfterMutation();
      } catch (error) {
        message.error(readErrorMessage(error, '批量处理失败'));
      } finally {
        setBatchSubmitting(false);
      }
    },
    [
      batchModal.reply,
      batchModal.status,
      closeBatchModal,
      onClearSelection,
      refreshAfterMutation,
    ],
  );

  const handleWithdrawAppeal = useCallback(
    async (appeal: AppealRecord) => {
      const confirmed = await new Promise<boolean>((resolve) => {
        Modal.confirm({
          title: '撤回申诉',
          content: '撤回后该条申诉将不再进入审核流程，确认撤回？',
          okText: '确认撤回',
          cancelText: '取消',
          okType: 'danger',
          maskClosable: false,
          onOk: () => resolve(true),
          onCancel: () => resolve(false),
        });
      });

      if (!confirmed) {
        return;
      }

      try {
        await appealService.withdrawAppeal(appeal.id);
        message.success('已撤回申诉');
        await refreshAfterMutation();
      } catch (error) {
        message.error(readErrorMessage(error, '撤回申诉失败'));
      }
    },
    [refreshAfterMutation],
  );

  return {
    createOpen,
    createForm,
    setCreateForm,
    createSubmitting,
    openCreateModal,
    closeCreateModal,
    submitCreateAppeal,
    handlingAppeal,
    handleForm,
    setHandleForm,
    handleSubmitting,
    deductionResetSignal,
    openHandleModal,
    closeHandleModal,
    submitHandleAppeal,
    batchModal,
    setBatchModal,
    batchSubmitting,
    openBatchModal,
    closeBatchModal,
    submitBatchHandle,
    handleWithdrawAppeal,
  };
}
