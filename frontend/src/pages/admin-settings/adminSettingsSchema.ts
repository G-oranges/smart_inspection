import type { AppSettings, DeductionItem } from '../../types/app';

import type { AdminSettingsDraft, TemplateOption } from './types';

export const DEFAULT_DEDUCTIONS: DeductionItem[] = [];

export const TEMPLATE_OPTIONS: TemplateOption[] = [
  { type: 'dorms', label: '宿舍导入模板' },
  { type: 'buildings', label: '楼栋导入模板' },
  { type: 'students', label: '学生导入模板' },
  { type: 'teachers', label: '教职工导入模板' },
  { type: 'results', label: '查寝结果导入模板' },
];

export function normalizeSettings(
  incoming: AppSettings | Partial<AdminSettingsDraft> | null | undefined,
): AdminSettingsDraft {
  const base = incoming || {};
  const gradingRules = Array.isArray(base.gradingRules) ? base.gradingRules : [];
  const deductionItems =
    base.deductionItems === undefined || base.deductionItems === null
      ? DEFAULT_DEDUCTIONS
      : base.deductionItems;
  const locationOptions = Array.isArray(base.locationOptions)
    ? base.locationOptions.filter(
        (item): item is string => typeof item === 'string' && item.trim().length > 0,
      )
    : [];
  const contactEmailDomains = Array.isArray(base.contactEmailDomains)
    ? base.contactEmailDomains.filter(
        (item): item is string => typeof item === 'string' && item.trim().length > 0,
      )
    : [];

  return {
    ...base,
    gradingRules,
    deductionItems,
    locationOptions,
    contactEmailDomains,
  } as AdminSettingsDraft;
}
