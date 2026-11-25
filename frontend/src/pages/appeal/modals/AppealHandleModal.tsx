import type { Dispatch, SetStateAction } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Drawer, Form, Input, Modal, Segmented } from 'antd';

import { MODAL_WIDTH } from '../../../components/common/modalSizes';
import { useAppealDeductionsQuery } from '../../../hooks/useAppealsQuery';
import {
  buildDeductionAdjustments,
  createEditableDeductionDrafts,
  previewAdjustedScore,
  type EditableDeductionDraft,
} from '../appealScore';
import { formatAppealDormName } from '../appealSchema';
import AppealDeductionEditor from './AppealDeductionEditor';
import type { AppSettings } from '../../../types/app';
import type {
  AppealDeductionAdjustment,
  AppealRecord,
} from '../../../types/service';
import type { AppealBatchModalState, AppealHandleFormState } from '../types';

export interface AppealHandleModalProps {
  open: boolean;
  appeal: AppealRecord | null;
  isMobile: boolean;
  submitting: boolean;
  resetSignal: number;
  settings: AppSettings | null;
  form: AppealHandleFormState;
  setForm: Dispatch<SetStateAction<AppealHandleFormState>>;
  onClose: () => void;
  onSubmit: (payload: {
    inspectionVersion: string;
    adjustments: AppealDeductionAdjustment[];
    scoreDelta: number;
  }) => Promise<void>;
}

export default function AppealHandleModal({
  open,
  appeal,
  isMobile,
  submitting,
  resetSignal,
  settings,
  form,
  setForm,
  onClose,
  onSubmit,
}: AppealHandleModalProps) {
  const appealId = appeal?.id || '';
  const {
    data: deductionsData,
    isLoading: deductionsLoading,
    dataUpdatedAt,
  } = useAppealDeductionsQuery(appealId, {
    enabled: open && Boolean(appealId),
  });

  const [drafts, setDrafts] = useState<EditableDeductionDraft[]>([]);

  useEffect(() => {
    if (!open || !deductionsData) {
      return;
    }
    setDrafts(
      createEditableDeductionDrafts(
        deductionsData.rows || [],
        settings?.deductionItems || [],
      ),
    );
  }, [dataUpdatedAt, deductionsData, open, resetSignal, settings?.deductionItems]);

  const totalScore =
    deductionsData?.totalScore ??
    appeal?.originalScore ??
    appeal?.inspection?.totalScore ??
    null;

  const preview = useMemo(
    () => previewAdjustedScore(drafts, totalScore),
    [drafts, totalScore],
  );

  const isApproved = form.status === 'approved';
  const isScoreDrop = isApproved && preview.delta < 0;
  const inspectionVersion =
    deductionsData?.inspectionVersion || appeal?.inspection?.updatedAt || '';
  const canConfirm =
    Boolean(inspectionVersion) &&
    !deductionsLoading &&
    (isApproved || Boolean(form.reply.trim()));

  const handleConfirm = () => {
    const adjustments = isApproved ? buildDeductionAdjustments(drafts) : [];
    void onSubmit({
      inspectionVersion,
      adjustments,
      scoreDelta: isApproved ? preview.delta : 0,
    });
  };

  const formBody = (
    <Form layout="vertical" className="apple-form apple-form-compact">
      {appeal ? (
        <div
          className="rounded-xl p-3 mb-4 space-y-1 text-xs"
          style={{
            background: 'var(--co-input-bg)',
            border: '1px solid var(--co-glass-border)',
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-sm" style={{ color: 'var(--co-text)' }}>
              {formatAppealDormName(appeal.inspection?.dorm)} ·{' '}
              {appeal.student?.fullName || '-'}
            </span>
            <span style={{ color: 'var(--co-text-muted)' }}>
              {appeal.inspection?.task?.title || '-'}
            </span>
          </div>
          <div style={{ color: 'var(--co-text-secondary)' }}>
            申诉理由：{appeal.content}
          </div>
        </div>
      ) : null}

      {appeal?.inspectionChanged ? (
        <Alert
          type="warning"
          showIcon
          className="mb-4"
          message="该查寝记录在申诉提交后已被修改，请核对最新扣分后再处理"
        />
      ) : null}

      <Form.Item label="处理结果" required>
        <Segmented
          block
          value={form.status}
          onChange={(val) =>
            setForm((prev) => ({
              ...prev,
              status: val as 'approved' | 'rejected',
            }))
          }
          options={[
            { label: '通过（可改扣分）', value: 'approved' },
            { label: '驳回', value: 'rejected' },
          ]}
        />
      </Form.Item>

      {isApproved ? (
        <Form.Item label="扣分项核定">
          <AppealDeductionEditor
            loading={deductionsLoading}
            drafts={drafts}
            setDrafts={setDrafts}
            totalScore={totalScore}
            settings={settings}
          />
        </Form.Item>
      ) : null}

      <Form.Item
        label="回复学生"
        required={!isApproved}
      >
        <Input.TextArea
          rows={3}
          maxLength={300}
          showCount
          value={form.reply}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, reply: event.target.value }))
          }
          placeholder={
            isApproved ? '选填：说明复核情况' : '必填：说明驳回原因'
          }
        />
      </Form.Item>
    </Form>
  );

  if (isMobile) {
    return (
      <Drawer
        open={open}
        title="处理申诉"
        placement="bottom"
        height="88vh"
        onClose={onClose}
        className="apple-drawer ios-action-sheet"
        footer={
          <div className="flex gap-3">
            <Button className="apple-btn-secondary flex-1" onClick={onClose}>
              取消
            </Button>
            <Button
              type="primary"
              danger={isScoreDrop || !isApproved}
              className={
                isScoreDrop || !isApproved ? 'flex-1' : 'apple-btn-primary flex-1'
              }
              disabled={!canConfirm}
              loading={submitting}
              onClick={handleConfirm}
            >
              {isApproved ? '确认通过' : '确认驳回'}
            </Button>
          </div>
        }
      >
        {formBody}
      </Drawer>
    );
  }

  return (
    <Modal
      open={open}
      title="处理申诉"
      centered
      width={MODAL_WIDTH.md}
      className="co-modal"
      onCancel={onClose}
      footer={[
        <Button key="cancel" className="apple-btn-secondary" onClick={onClose}>
          取消
        </Button>,
        <Button
          key="submit"
          type="primary"
          danger={isScoreDrop || !isApproved}
          className={isScoreDrop || !isApproved ? undefined : 'apple-btn-primary'}
          disabled={!canConfirm}
          loading={submitting}
          onClick={handleConfirm}
        >
          {isApproved ? '确认通过' : '确认驳回'}
        </Button>,
      ]}
    >
      {formBody}
    </Modal>
  );
}

export interface AppealBatchModalProps {
  state: AppealBatchModalState;
  setState: Dispatch<SetStateAction<AppealBatchModalState>>;
  selectedCount: number;
  submitting: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export function AppealBatchModal({
  state,
  setState,
  selectedCount,
  submitting,
  onClose,
  onConfirm,
}: AppealBatchModalProps) {
  const isApprove = state.status === 'approved';
  const canSubmit = isApprove || Boolean(state.reply.trim());

  return (
    <Modal
      open={state.open}
      title={isApprove ? '批量通过申诉' : '批量驳回申诉'}
      centered
      width={MODAL_WIDTH.sm}
      className="co-modal"
      onCancel={onClose}
      footer={[
        <Button key="cancel" className="apple-btn-secondary" onClick={onClose}>
          取消
        </Button>,
        <Button
          key="ok"
          type="primary"
          danger={!isApprove}
          className={isApprove ? 'apple-btn-primary' : undefined}
          disabled={!canSubmit}
          loading={submitting}
          onClick={() => {
            void onConfirm();
          }}
        >
          {isApprove ? '确认通过' : '确认驳回'}
        </Button>,
      ]}
    >
      <Form layout="vertical" className="apple-form apple-form-compact">
        <div className="text-sm mb-3" style={{ color: 'var(--co-text-secondary)' }}>
          即将对已选的 <strong>{selectedCount}</strong> 条待处理申诉执行
          {isApprove ? '批量通过（保持当前扣分与总分不变）' : '批量驳回'}。
        </div>
        <Form.Item label="统一回复" required={!isApprove}>
          <Input.TextArea
            rows={3}
            maxLength={300}
            showCount
            value={state.reply}
            onChange={(event) =>
              setState((prev) => ({ ...prev, reply: event.target.value }))
            }
            placeholder={
              isApprove ? '选填：输入统一回复内容' : '必填：输入驳回原因'
            }
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
