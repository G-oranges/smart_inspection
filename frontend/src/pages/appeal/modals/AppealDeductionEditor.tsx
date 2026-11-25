import type { Dispatch, SetStateAction } from 'react';
import { useMemo, useState } from 'react';
import { Button, InputNumber, Skeleton, Tooltip } from 'antd';
import { DeleteOutlined, PlusOutlined, UndoOutlined } from '@ant-design/icons';

import DeductionRowItem, {
  type DeductionRowStatusTone,
} from '../../../components/common/DeductionRowItem';
import DeductionDrawer from '../../result-entry/modals/DeductionDrawer';
import {
  previewAdjustedScore,
  resolveMaxCountForItem,
  type EditableDeductionDraft,
} from '../appealScore';
import type { AppSettings, DeductionItem } from '../../../types/app';
import type { ResultEntryNewDeductionForm } from '../../result-entry/types';

export interface AppealDeductionEditorProps {
  loading: boolean;
  drafts: EditableDeductionDraft[];
  setDrafts: Dispatch<SetStateAction<EditableDeductionDraft[]>>;
  totalScore: number | null | undefined;
  settings: AppSettings | null;
}

const INITIAL_NEW_DEDUCTION: ResultEntryNewDeductionForm = {
  id: null,
  code: '',
  count: 1,
  locations: [],
};

function resolveRowTone(draft: EditableDeductionDraft): DeductionRowStatusTone {
  if (draft.removed) {
    return 'removed';
  }
  if (draft.isAdded) {
    return 'added';
  }
  if (draft.count !== draft.initialCount) {
    return 'modified';
  }
  return 'default';
}

export default function AppealDeductionEditor({
  loading,
  drafts,
  setDrafts,
  totalScore,
  settings,
}: AppealDeductionEditorProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [newDeductionForm, setNewDeductionForm] =
    useState<ResultEntryNewDeductionForm>(INITIAL_NEW_DEDUCTION);

  const enabledDeductions = useMemo<DeductionItem[]>(
    () =>
      (settings?.deductionItems || []).filter(
        (item) => item && item.enabled !== false && Boolean(item.code),
      ),
    [settings?.deductionItems],
  );

  const activeCodes = useMemo(
    () => drafts.filter((item) => !item.removed).map((item) => item.code),
    [drafts],
  );

  const preview = useMemo(
    () => previewAdjustedScore(drafts, totalScore),
    [drafts, totalScore],
  );

  const handleCountChange = (code: string, nextValue: number | null) => {
    const safeCount = Math.max(1, Math.floor(Number(nextValue) || 1));
    setDrafts((prev) =>
      prev.map((item) => {
        if (item.code !== code) {
          return item;
        }
        const capped =
          item.maxCount !== null ? Math.min(safeCount, item.maxCount) : safeCount;
        return {
          ...item,
          count: capped,
        };
      }),
    );
  };

  const handleRemoveOrRestore = (code: string) => {
    setDrafts((prev) =>
      prev.flatMap((item) => {
        if (item.code !== code) {
          return [item];
        }
        if (item.isAdded) {
          return [];
        }
        return [{ ...item, removed: !item.removed }];
      }),
    );
  };

  const handleToggleNewLocation = (location: string) => {
    setNewDeductionForm((prev) => ({
      ...prev,
      locations: prev.locations.includes(location)
        ? prev.locations.filter((loc) => loc !== location)
        : [...prev.locations, location],
    }));
  };

  const handleConfirmAdd = () => {
    const code = newDeductionForm.code;
    if (!code) {
      return;
    }
    const config = enabledDeductions.find((item) => item.code === code);
    if (!config) {
      return;
    }
    const points = Number(config.points) || 0;
    const maxCount = resolveMaxCountForItem(points, config.maxPoints);
    const count =
      maxCount !== null
        ? Math.min(Math.max(1, newDeductionForm.count || 1), maxCount)
        : Math.max(1, newDeductionForm.count || 1);

    setDrafts((prev) => {
      const existingRemovedIdx = prev.findIndex(
        (item) => item.code === code && item.removed,
      );
      if (existingRemovedIdx >= 0) {
        return prev.map((item, idx) =>
          idx === existingRemovedIdx
            ? {
                ...item,
                removed: false,
                count,
                locations: [...newDeductionForm.locations],
              }
            : item,
        );
      }

      return [
        ...prev,
        {
          code,
          name: config.name || code,
          points,
          maxCount,
          initialCount: null,
          count,
          initialLocations: [],
          locations: [...newDeductionForm.locations],
          disputed: false,
          removed: false,
          isAdded: true,
        },
      ];
    });

    setNewDeductionForm(INITIAL_NEW_DEDUCTION);
    setDrawerOpen(false);
  };

  if (loading) {
    return <Skeleton active paragraph={{ rows: 3 }} />;
  }

  const deltaClass =
    preview.delta > 0
      ? 'appeal-score-delta--up'
      : preview.delta < 0
        ? 'appeal-score-delta--down'
        : 'appeal-score-delta--same';
  const deltaText =
    preview.delta > 0
      ? `+${preview.delta}`
      : preview.delta < 0
        ? `${preview.delta}`
        : '不变';

  return (
    <div className="space-y-3">
      <div
        className="rounded-xl overflow-hidden"
        style={{ border: '1px solid var(--co-glass-border)' }}
      >
        {drafts.length === 0 ? (
          <div
            className="py-6 text-center text-xs"
            style={{ color: 'var(--co-text-muted)' }}
          >
            当前查寝记录无扣分项，可点击下方按钮补充扣分项
          </div>
        ) : (
          <div>
            {drafts.map((draft, index) => {
              const tone = resolveRowTone(draft);
              const totalPoints = draft.points * draft.count;

              return (
                <DeductionRowItem
                  key={draft.code}
                  name={draft.name}
                  locations={draft.locations}
                  points={draft.points}
                  count={draft.count}
                  disputed={draft.disputed}
                  statusTone={tone}
                  showDivider={index < drafts.length - 1}
                  trailing={
                    <div className="flex items-center gap-2">
                      {!draft.removed ? (
                        <InputNumber
                          size="small"
                          min={1}
                          max={draft.maxCount ?? 20}
                          value={draft.count}
                          onChange={(val) => handleCountChange(draft.code, val)}
                          style={{ width: 64 }}
                          aria-label={`${draft.name}次数`}
                        />
                      ) : null}
                      <span
                        className={`re-deduct-total min-w-[34px] text-right ${
                          draft.removed ? 'line-through opacity-45' : ''
                        }`}
                      >
                        -{totalPoints}
                      </span>
                      <Tooltip title={draft.removed ? '恢复该项' : '撤销该项'}>
                        <Button
                          type="text"
                          size="small"
                          icon={
                            draft.removed ? (
                              <UndoOutlined style={{ color: 'var(--co-primary)' }} />
                            ) : (
                              <DeleteOutlined style={{ color: 'var(--co-text-muted)' }} />
                            )
                          }
                          onClick={() => handleRemoveOrRestore(draft.code)}
                          aria-label={draft.removed ? '恢复扣分项' : '撤销扣分项'}
                        />
                      </Tooltip>
                    </div>
                  }
                />
              );
            })}
          </div>
        )}

        <div
          className="p-2.5"
          style={{
            borderTop:
              drafts.length > 0 ? '1px solid var(--co-glass-border)' : undefined,
          }}
        >
          <Button
            type="dashed"
            size="small"
            block
            icon={<PlusOutlined />}
            disabled={enabledDeductions.length === 0}
            onClick={() => {
              setNewDeductionForm(INITIAL_NEW_DEDUCTION);
              setDrawerOpen(true);
            }}
          >
            添加扣分项
          </Button>
        </div>
      </div>

      <div className="appeal-score-preview-bar text-sm">
        <span style={{ color: 'var(--co-text-secondary)' }}>修正后总分预览</span>
        <span className="font-semibold" style={{ color: 'var(--co-text)' }}>
          原 {preview.originalScore} 分 → 新 {preview.nextScore} 分{' '}
          <span className={deltaClass}>({deltaText})</span>
        </span>
      </div>

      <DeductionDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        newDeductionForm={newDeductionForm}
        setNewDeductionForm={setNewDeductionForm}
        enabledDeductions={enabledDeductions}
        disabledCodes={activeCodes}
        zIndex={1150}
        settings={settings}
        onToggleLocation={handleToggleNewLocation}
        onConfirm={handleConfirmAdd}
      />
    </div>
  );
}
