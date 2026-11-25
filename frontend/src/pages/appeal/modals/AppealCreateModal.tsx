import type { ChangeEvent, Dispatch, RefObject, SetStateAction } from 'react';
import { useMemo, useRef, useState } from 'react';
import { Button, Checkbox, Drawer, Form, Input, Modal, Select, message } from 'antd';
import { CloseOutlined, PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

import DeductionRowItem from '../../../components/common/DeductionRowItem';
import { MODAL_WIDTH } from '../../../components/common/modalSizes';
import PanelSelect from '../../../components/common/PanelSelect';
import { appealService } from '../../../services/appealService';
import type { AppSettings, DeductionItem } from '../../../types/app';
import type {
  AppealDeductionSnapshotRow,
  AppealRecord,
  EntityId,
} from '../../../types/service';
import type { AppealCreateFormState } from '../types';

const { Option } = Select;
const MAX_APPEAL_PHOTOS = 6;

export interface AppealCandidateInspection {
  id?: EntityId;
  totalScore?: number | null;
  createdAt?: string;
  detail?: AppealDeductionSnapshotRow[];
  task?: {
    id?: EntityId;
    title?: string;
  } | null;
  dorm?: {
    building?: string;
    roomNo?: string;
  } | null;
}

export interface AppealCreateModalProps {
  open: boolean;
  isMobile: boolean;
  submitting: boolean;
  inspections: AppealCandidateInspection[];
  existingAppeals: AppealRecord[];
  settings: AppSettings | null;
  form: AppealCreateFormState;
  setForm: Dispatch<SetStateAction<AppealCreateFormState>>;
  onClose: () => void;
  onSubmit: () => Promise<void>;
}

interface AppealCreateFormContentProps {
  form: AppealCreateFormState;
  setForm: Dispatch<SetStateAction<AppealCreateFormState>>;
  scoredInspections: AppealCandidateInspection[];
  pendingInspectionIds: Set<string>;
  windowDays: number;
  selectedDetailRows: AppealDeductionSnapshotRow[];
  deductionMap: Map<string, DeductionItem>;
  uploading: boolean;
  fileInputRef: RefObject<HTMLInputElement>;
  onToggleDisputedCode: (code: string) => void;
  onRemovePhoto: (photoId: string) => void;
  onUploadFiles: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
}

function AppealCreateFormContent({
  form,
  setForm,
  scoredInspections,
  pendingInspectionIds,
  windowDays,
  selectedDetailRows,
  deductionMap,
  uploading,
  fileInputRef,
  onToggleDisputedCode,
  onRemovePhoto,
  onUploadFiles,
}: AppealCreateFormContentProps) {
  return (
    <Form layout="vertical" className="apple-form apple-form-compact">
      <Form.Item label="查寝记录" required>
        <PanelSelect
          value={form.inspectionId || undefined}
          placeholder="选择需要申诉的本宿舍查寝记录"
          className="apple-select"
          onChange={(inspectionId: EntityId) =>
            setForm((prev) => ({
              ...prev,
              inspectionId,
              disputedCodes: [],
            }))
          }
        >
          {scoredInspections.map((item) => {
            const idStr = String(item.id);
            const hasPending = pendingInspectionIds.has(idStr);
            const isExpired = item.createdAt
              ? dayjs().isAfter(dayjs(item.createdAt).add(windowDays, 'day'))
              : false;
            const disabled = hasPending || isExpired;
            const dateText = item.createdAt
              ? dayjs(item.createdAt).format('MM-DD')
              : '';
            const suffix = hasPending
              ? '（待处理中）'
              : isExpired
                ? `（超 ${windowDays} 天时限）`
                : '';

            return (
              <Option key={idStr} value={item.id} disabled={disabled}>
                {item.task?.title || '日常查寝'} · {item.totalScore} 分
                {dateText ? ` (${dateText})` : ''}
                {suffix}
              </Option>
            );
          })}
        </PanelSelect>
      </Form.Item>

      {selectedDetailRows.length > 0 ? (
        <Form.Item label="有异议的扣分项（可不勾选，默认对整体评分申诉）">
          <div
            className="rounded-xl overflow-hidden"
            style={{ border: '1px solid var(--co-glass-border)' }}
          >
            {selectedDetailRows.map((row, index) => {
              const info = deductionMap.get(row.code);
              const checked = form.disputedCodes.includes(row.code);
              return (
                <DeductionRowItem
                  key={row.code}
                  name={info?.name || row.code}
                  locations={row.locations || []}
                  points={row.points ?? info?.points ?? 0}
                  count={row.count || 1}
                  showDivider={index < selectedDetailRows.length - 1}
                  onClick={() => onToggleDisputedCode(row.code)}
                  leading={
                    <Checkbox
                      checked={checked}
                      onChange={() => onToggleDisputedCode(row.code)}
                    />
                  }
                />
              );
            })}
          </div>
        </Form.Item>
      ) : null}

      <Form.Item label="申诉理由（5–500 字）" required>
        <Input.TextArea
          rows={4}
          maxLength={500}
          showCount
          value={form.content}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, content: event.target.value }))
          }
          placeholder="请客观说明实际情况及复核诉求（至少 5 个字）"
        />
      </Form.Item>

      <Form.Item label={`举证照片（选填，最多 ${MAX_APPEAL_PHOTOS} 张）`}>
        <div className="flex flex-wrap gap-2.5">
          {form.photos.map((photo) => (
            <div
              key={photo.photoId}
              className="relative w-20 h-20 rounded-xl overflow-hidden"
              style={{ border: '1px solid var(--co-glass-border)' }}
            >
              <img
                src={photo.previewUrl}
                alt={photo.name}
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={() => onRemovePhoto(photo.photoId)}
                className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center text-xs"
                style={{
                  background: 'var(--co-bg)',
                  color: 'var(--co-text)',
                }}
                aria-label="删除图片"
              >
                <CloseOutlined />
              </button>
            </div>
          ))}

          {form.photos.length < MAX_APPEAL_PHOTOS ? (
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="w-20 h-20 rounded-xl flex flex-col items-center justify-center gap-1 text-xs co-press"
              style={{
                border: '1px dashed var(--co-glass-border)',
                background: 'var(--co-input-bg)',
                color: 'var(--co-text-muted)',
              }}
            >
              <PlusOutlined />
              <span>{uploading ? '上传中' : '上传'}</span>
            </button>
          ) : null}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(event) => {
            void onUploadFiles(event);
          }}
        />
      </Form.Item>
    </Form>
  );
}

export default function AppealCreateModal({
  open,
  isMobile,
  submitting,
  inspections,
  existingAppeals,
  settings,
  form,
  setForm,
  onClose,
  onSubmit,
}: AppealCreateModalProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  const windowDays = settings?.appealWindowDays ?? 7;

  const pendingInspectionIds = useMemo(() => {
    const set = new Set<string>();
    existingAppeals.forEach((appeal) => {
      if (appeal.status === 'pending' && appeal.inspectionId) {
        set.add(String(appeal.inspectionId));
      }
    });
    return set;
  }, [existingAppeals]);

  const scoredInspections = useMemo(
    () =>
      inspections.filter(
        (item) =>
          item.id !== undefined &&
          item.id !== null &&
          item.totalScore !== null &&
          item.totalScore !== undefined,
      ),
    [inspections],
  );

  const selectedInspection = useMemo(
    () =>
      scoredInspections.find(
        (item) => String(item.id) === String(form.inspectionId),
      ) || null,
    [form.inspectionId, scoredInspections],
  );

  const selectedDetailRows = useMemo(
    () =>
      Array.isArray(selectedInspection?.detail)
        ? selectedInspection.detail.filter((row) => Boolean(row.code))
        : [],
    [selectedInspection?.detail],
  );

  const deductionMap = useMemo(
    () =>
      new Map(
        (settings?.deductionItems || []).map((item) => [item.code, item]),
      ),
    [settings?.deductionItems],
  );

  const toggleDisputedCode = (code: string) => {
    setForm((prev) => ({
      ...prev,
      disputedCodes: prev.disputedCodes.includes(code)
        ? prev.disputedCodes.filter((item) => item !== code)
        : [...prev.disputedCodes, code],
    }));
  };

  const handleUploadFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (files.length === 0) {
      return;
    }

    const remaining = MAX_APPEAL_PHOTOS - form.photos.length;
    if (remaining <= 0) {
      message.warning(`最多上传 ${MAX_APPEAL_PHOTOS} 张照片`);
      return;
    }

    const slice = files.slice(0, remaining);
    setUploading(true);
    try {
      for (const file of slice) {
        const uploaded = await appealService.uploadAppealPhoto(file);
        const previewUrl = URL.createObjectURL(file);
        setForm((prev) => ({
          ...prev,
          photos: [
            ...prev.photos,
            {
              photoId: uploaded.photoId,
              previewUrl,
              name: file.name,
            },
          ],
        }));
      }
    } catch (error) {
      message.error(
        error instanceof Error && error.message
          ? error.message
          : '上传证据图片失败',
      );
    } finally {
      setUploading(false);
    }
  };

  const handleRemovePhoto = (photoId: string) => {
    setForm((prev) => {
      const removed = prev.photos.find((item) => item.photoId === photoId);
      if (removed?.previewUrl) {
        URL.revokeObjectURL(removed.previewUrl);
      }
      return {
        ...prev,
        photos: prev.photos.filter((item) => item.photoId !== photoId),
      };
    });
  };

  const trimmedLen = form.content.trim().length;
  const canSubmit =
    Boolean(form.inspectionId) &&
    trimmedLen >= 5 &&
    trimmedLen <= 500 &&
    !uploading;

  const formNode = (
    <AppealCreateFormContent
      form={form}
      setForm={setForm}
      scoredInspections={scoredInspections}
      pendingInspectionIds={pendingInspectionIds}
      windowDays={windowDays}
      selectedDetailRows={selectedDetailRows}
      deductionMap={deductionMap}
      uploading={uploading}
      fileInputRef={fileInputRef}
      onToggleDisputedCode={toggleDisputedCode}
      onRemovePhoto={handleRemovePhoto}
      onUploadFiles={handleUploadFiles}
    />
  );

  if (isMobile) {
    return (
      <Drawer
        open={open}
        title="发起申诉"
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
              className="apple-btn-primary flex-1"
              disabled={!canSubmit}
              loading={submitting}
              onClick={() => {
                void onSubmit();
              }}
            >
              提交申诉
            </Button>
          </div>
        }
      >
        {formNode}
      </Drawer>
    );
  }

  return (
    <Modal
      open={open}
      title="发起申诉"
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
          className="apple-btn-primary"
          disabled={!canSubmit}
          loading={submitting}
          onClick={() => {
            void onSubmit();
          }}
        >
          提交申诉
        </Button>,
      ]}
    >
      {formNode}
    </Modal>
  );
}
