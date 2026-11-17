import type { GradingRule } from '../../types/app';

import type {
  ResultEntryDeductionItem,
  ResultEntryFormState,
} from './types';

export const INITIAL_FORM: ResultEntryFormState = {
  dormId: '',
  totalScore: '',
  comments: '',
  photoUrls: [],
};

export const DEFAULT_DEDUCTIONS: ResultEntryDeductionItem[] = [
  { name: '垃圾未倒', code: 'A', points: 2, enabled: true },
  { name: '桌面杂乱', code: 'B', points: 3, enabled: true },
  { name: '违规电器', code: 'C', points: 10, enabled: true },
];

export const DEFAULT_SCORE_RULES: GradingRule[] = [
  { label: '不合格', min: null, max: 60 },
  { label: '一般', min: 60, max: 75 },
  { label: '良好', min: 75, max: 90 },
  { label: '优秀', min: 90, max: null },
];

export const DEFAULT_LOCATION_OPTIONS: string[] = [
  '通用',
  '床位1',
  '床位2',
  '床位3',
  '床位4',
  '书桌区',
  '卫生间',
  '阳台',
];

export const STORAGE_KEY_PREFIX = 'checkResultSelectedTask_';
