import type { AppSettings, GradingRule } from '../../types/app';

import {
  DEFAULT_LOCATION_OPTIONS,
  DEFAULT_SCORE_RULES,
} from './resultEntrySchema';
import type {
  ResultEntryDeductionRow,
  ResultEntryDorm,
  ResultEntryFormState,
  ResultEntryTask,
  ResultEntryWindowInfo,
} from './types';

export function getScoreColor(
  score: number,
  rules?: GradingRule[] | null,
): string {
  const normalized = (rules && rules.length ? rules : DEFAULT_SCORE_RULES).map(
    (rule) => ({
      label: rule.label,
      min:
        rule.min === null || rule.min === undefined
          ? -Infinity
          : Number(rule.min),
      max:
        rule.max === null || rule.max === undefined
          ? Infinity
          : Number(rule.max),
    }),
  );

  normalized.sort((a, b) => a.min - b.min);
  const found = normalized.find((rule) => score >= rule.min && score < rule.max);

  // Hex values mirror --co-* tokens; callers append alpha suffixes, so CSS vars cannot be used here.
  const colorMap: Record<string, string> = {
    优秀: '#34C759',
    良好: '#3c83f6',
    一般: '#FF9500',
    不合格: '#FF3B30',
  };

  return colorMap[found?.label ?? ''] || '#3c83f6';
}

export function computeWindow(task: ResultEntryTask): ResultEntryWindowInfo {
  const now = Date.now();
  const start = task.date ? new Date(task.date).getTime() : null;
  const end = task.deadline ? new Date(task.deadline).getTime() : null;
  const hasStart = typeof start === 'number' && !Number.isNaN(start);
  const hasEnd = typeof end === 'number' && !Number.isNaN(end);
  const inWindow = (!hasStart || now >= start) && (!hasEnd || now <= end);

  return {
    start: hasStart ? start : null,
    end: hasEnd ? end : null,
    inWindow,
    beforeStart: hasStart ? now < start : false,
    afterEnd: hasEnd ? now > end : false,
  };
}

export function createFormSnapshot({
  appliedDeductions,
  form,
  baseScore,
}: {
  appliedDeductions: ResultEntryDeductionRow[];
  form: ResultEntryFormState;
  baseScore: string;
}): string {
  return JSON.stringify({
    deductions: appliedDeductions,
    photos: form.photoUrls,
    comments: form.comments,
    baseScore,
  });
}

export function resolveLocationOrder(
  settings?: AppSettings | null,
): string[] {
  if (!Array.isArray(settings?.locationOptions) || settings.locationOptions.length === 0) {
    return DEFAULT_LOCATION_OPTIONS;
  }

  return settings.locationOptions.filter(
    (value): value is string => typeof value === 'string' && value.trim().length > 0,
  );
}

export function sortDormsByRoomNo(dorms: ResultEntryDorm[]): ResultEntryDorm[] {
  return [...dorms].sort((a, b) =>
    String(a.roomNo ?? '').localeCompare(String(b.roomNo ?? ''), undefined, {
      numeric: true,
    }),
  );
}
