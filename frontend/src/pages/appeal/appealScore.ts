import type { DeductionItem } from '../../types/app';
import type {
  AppealDeductionAdjustment,
  AppealDeductionItemRow,
  AppealDeductionSnapshotRow,
} from '../../types/service';

export interface EditableDeductionDraft {
  code: string;
  name: string;
  points: number;
  maxCount: number | null;
  initialCount: number | null;
  count: number;
  initialLocations: string[];
  locations: string[];
  disputed: boolean;
  removed: boolean;
  isAdded: boolean;
}

export interface ScorePreviewResult {
  originalScore: number;
  nextScore: number;
  delta: number;
  oldDeductionTotal: number;
  newDeductionTotal: number;
}

export type DeductionDiffKind = 'added' | 'removed' | 'updated' | 'unchanged';

export interface DeductionDiffRow {
  code: string;
  name: string;
  points: number;
  kind: DeductionDiffKind;
  beforeCount: number | null;
  afterCount: number | null;
  locations: string[];
  disputed: boolean;
}

export function resolveMaxCountForItem(
  points: number,
  maxPoints?: number | string | null,
): number | null {
  if (points <= 0 || maxPoints === null || maxPoints === undefined || maxPoints === '') {
    return null;
  }
  const numericMax = Number(maxPoints);
  if (!Number.isFinite(numericMax) || numericMax <= 0) {
    return null;
  }
  return Math.max(1, Math.floor(numericMax / points));
}

export function createEditableDeductionDrafts(
  rows: AppealDeductionItemRow[],
  deductionItems: DeductionItem[] = [],
): EditableDeductionDraft[] {
  const byCode = new Map(deductionItems.map((item) => [item.code, item]));

  return [...rows]
    .sort((left, right) => {
      if (left.disputed === right.disputed) {
        return 0;
      }
      return left.disputed ? -1 : 1;
    })
    .map((row) => {
      const config = byCode.get(row.code);
      const points = Number(row.points ?? config?.points ?? 0) || 0;
      const locations = Array.isArray(row.locations) ? [...row.locations] : [];
      return {
        code: row.code,
        name: row.name || config?.name || row.code,
        points,
        maxCount: resolveMaxCountForItem(points, config?.maxPoints),
        initialCount: row.count || 1,
        count: row.count || 1,
        initialLocations: locations,
        locations: [...locations],
        disputed: Boolean(row.disputed),
        removed: false,
        isAdded: false,
      };
    });
}

function areStringArraysEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  return left.every((item, idx) => item === right[idx]);
}

export function buildDeductionAdjustments(
  drafts: EditableDeductionDraft[],
): AppealDeductionAdjustment[] {
  const adjustments: AppealDeductionAdjustment[] = [];

  for (const draft of drafts) {
    if (draft.isAdded) {
      if (!draft.removed) {
        adjustments.push({
          code: draft.code,
          action: 'add',
          count: Math.max(1, draft.count),
          locations: draft.locations,
        });
      }
      continue;
    }

    if (draft.removed) {
      adjustments.push({
        code: draft.code,
        action: 'remove',
      });
      continue;
    }

    const countChanged = draft.count !== draft.initialCount;
    const locationsChanged = !areStringArraysEqual(
      draft.locations,
      draft.initialLocations,
    );

    if (countChanged || locationsChanged) {
      adjustments.push({
        code: draft.code,
        action: 'update',
        count: Math.max(1, draft.count),
        ...(locationsChanged ? { locations: draft.locations } : {}),
      });
    }
  }

  return adjustments;
}

export function previewAdjustedScore(
  drafts: EditableDeductionDraft[],
  totalScore: number | null | undefined,
): ScorePreviewResult {
  const originalScore = typeof totalScore === 'number' ? totalScore : 100;

  const oldDeductionTotal = drafts.reduce((sum, item) => {
    if (item.isAdded || item.initialCount === null) {
      return sum;
    }
    return sum + item.points * item.initialCount;
  }, 0);

  const newDeductionTotal = drafts.reduce((sum, item) => {
    if (item.removed) {
      return sum;
    }
    return sum + item.points * Math.max(1, item.count);
  }, 0);

  const rawNext = originalScore + oldDeductionTotal - newDeductionTotal;
  const nextScore = Math.max(0, Math.min(100, rawNext));

  return {
    originalScore,
    nextScore,
    delta: nextScore - originalScore,
    oldDeductionTotal,
    newDeductionTotal,
  };
}

export function diffDeductionSnapshots(
  originalDetail: AppealDeductionSnapshotRow[] | null | undefined,
  adjustedDetail: AppealDeductionSnapshotRow[] | null | undefined,
  disputedCodes: string[] | null | undefined,
  deductionItems: DeductionItem[] = [],
): DeductionDiffRow[] {
  const beforeRows = Array.isArray(originalDetail) ? originalDetail : [];
  const afterRows = Array.isArray(adjustedDetail) ? adjustedDetail : null;
  const disputedSet = new Set(Array.isArray(disputedCodes) ? disputedCodes : []);
  const configMap = new Map(deductionItems.map((item) => [item.code, item]));

  if (!afterRows) {
    return beforeRows.map((row) => {
      const config = configMap.get(row.code);
      return {
        code: row.code,
        name: config?.name || row.code,
        points: Number(row.points ?? config?.points ?? 0) || 0,
        kind: 'unchanged',
        beforeCount: row.count || 1,
        afterCount: row.count || 1,
        locations: Array.isArray(row.locations) ? row.locations : [],
        disputed: disputedSet.has(row.code),
      };
    });
  }

  const beforeByCode = new Map(beforeRows.map((row) => [row.code, row]));
  const afterByCode = new Map(afterRows.map((row) => [row.code, row]));
  const orderedCodes = [
    ...beforeRows.map((row) => row.code),
    ...afterRows.map((row) => row.code).filter((code) => !beforeByCode.has(code)),
  ];

  return orderedCodes.map((code) => {
    const before = beforeByCode.get(code);
    const after = afterByCode.get(code);
    const config = configMap.get(code);
    const points = Number(after?.points ?? before?.points ?? config?.points ?? 0) || 0;
    const name = config?.name || code;

    if (!before && after) {
      return {
        code,
        name,
        points,
        kind: 'added',
        beforeCount: null,
        afterCount: after.count || 1,
        locations: Array.isArray(after.locations) ? after.locations : [],
        disputed: disputedSet.has(code),
      };
    }

    if (before && !after) {
      return {
        code,
        name,
        points,
        kind: 'removed',
        beforeCount: before.count || 1,
        afterCount: null,
        locations: Array.isArray(before.locations) ? before.locations : [],
        disputed: disputedSet.has(code),
      };
    }

    const beforeCount = before?.count || 1;
    const afterCount = after?.count || 1;
    return {
      code,
      name,
      points,
      kind: beforeCount !== afterCount ? 'updated' : 'unchanged',
      beforeCount,
      afterCount,
      locations: Array.isArray(after?.locations)
        ? after.locations
        : Array.isArray(before?.locations)
          ? before.locations
          : [],
      disputed: disputedSet.has(code),
    };
  });
}
