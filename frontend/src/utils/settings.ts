import type { GradingRule } from '../types/app';

export const DEFAULT_GRADING_RULES = [
  { label: '不合格', min: null, max: 60 },
  { label: '一般', min: 60, max: 75 },
  { label: '良好', min: 75, max: 90 },
  { label: '优秀', min: 90, max: null },
] satisfies GradingRule[];

export function gradeLabelFromRules(
  score: number | string | null | undefined,
  rules: GradingRule[] = DEFAULT_GRADING_RULES,
): string {
  if (score === null || score === undefined || score === '') {
    return '未评分';
  }
  const numeric = Number(score);
  if (Number.isNaN(numeric)) {
    return '未评分';
  }
  const normalized = (
    rules && rules.length ? rules : DEFAULT_GRADING_RULES
  ).map((rule) => ({
    label: rule.label,
    min:
      rule.min === null || rule.min === undefined
        ? -Infinity
        : Number(rule.min),
    max:
      rule.max === null || rule.max === undefined ? Infinity : Number(rule.max),
  }));
  normalized.sort((a, b) => a.min - b.min);
  const found = normalized.find(
    (rule) => numeric >= rule.min && numeric < rule.max,
  );
  return found?.label || normalized[normalized.length - 1]?.label || '未评分';
}
