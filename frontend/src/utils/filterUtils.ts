// src/utils/filterUtils.js
// 筛选工具函数 - 从各管理页面抽取的通用筛选逻辑

type FilterValue = string | number | boolean | Date | null | undefined;
type FilterMap = Record<string, unknown>;
type ResultFilterMap = FilterMap & {
  dateRange?: unknown[];
  keyword?: string;
  sort?: string;
};

/**
 * 将筛选值数组归一化为可比较的字符串数组
 * @param {unknown[]} values
 * @returns {string[]}
 */
export function normalizeFilterValues(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return values.map((v) => String(v)).sort();
}

/**
 * 两个字符串数组是否完全相等
 * @param {string[]} a
 * @param {string[]} b
 * @returns {boolean}
 */
export function areArraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * 两个筛选对象是否相等
 * @param {Record<string, unknown[]>} left
 * @param {Record<string, unknown[]>} right
 * @param {string[]} filterKeys - 需要比较的 key 列表
 * @returns {boolean}
 */
export function areFiltersEqual(
  left: FilterMap | null | undefined,
  right: FilterMap | null | undefined,
  filterKeys: string[],
): boolean {
  return filterKeys.every((key) =>
    areArraysEqual(
      normalizeFilterValues(left?.[key]),
      normalizeFilterValues(right?.[key]),
    ),
  );
}

/**
 * 创建默认空筛选对象
 * @param {string[]} filterKeys
 * @returns {Record<string, string[]>}
 */
export function createDefaultFilters(filterKeys: string[]): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  filterKeys.forEach((key) => {
    result[key] = [];
  });
  return result;
}

/**
 * 从 URL 参数创建初始筛选对象
 * @param {URLSearchParams} searchParams
 * @param {string[]} filterKeys
 * @returns {Record<string, string[]>}
 */
export function createInitialFilters(
  searchParams: URLSearchParams,
  filterKeys: string[],
): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  filterKeys.forEach((key) => {
    result[key] = searchParams.getAll(key) || [];
  });
  return result;
}

// ========== Result 页面专用工具函数 ==========

/**
 * 归一化日期范围为可比较的时间戳数组
 * 支持 dayjs 对象、Date 对象、字符串
 * @param {unknown[]} range - 日期范围 [start, end]
 * @returns {number[]} - 时间戳数组，无效时返回空数组
 */
export function normalizeDateRange(range: unknown): number[] {
  if (!Array.isArray(range) || range.length !== 2) return [];
  return range
    .map((value) => {
      if (!value) return null;
      // dayjs / moment 对象有 valueOf 方法
      if (
        typeof value === 'object' &&
        value !== null &&
        'valueOf' in value &&
        typeof (value as { valueOf: unknown }).valueOf === 'function'
      ) {
        return Number((value as { valueOf: () => unknown }).valueOf());
      }
      // Date 对象
      if (value instanceof Date) return value.getTime();
      // 字符串尝试解析
      const parsed = Date.parse(String(value));
      return isNaN(parsed) ? null : parsed;
    })
    .filter((v): v is number => v !== null);
}

/**
 * 比较两个日期范围是否相等
 * @param {unknown[]} left
 * @param {unknown[]} right
 * @returns {boolean}
 */
export function areDateRangesEqual(
  left: unknown,
  right: unknown,
): boolean {
  const normalizedLeft = normalizeDateRange(left);
  const normalizedRight = normalizeDateRange(right);
  return areArraysEqual(
    normalizedLeft.map(String),
    normalizedRight.map(String)
  );
}

/**
 * Result 页面专用：比较两个筛选对象是否相等
 * 支持普通数组筛选、日期范围、排序字段
 * @param {Object} left
 * @param {Object} right
 * @param {string[]} filterKeys - 普通筛选字段
 * @param {Object} options - 额外比较选项
 * @param {string} [options.defaultSort] - 默认排序值
 * @returns {boolean}
 */
export function areResultFiltersEqual(
  left: ResultFilterMap | null | undefined,
  right: ResultFilterMap | null | undefined,
  filterKeys: string[],
  options: { defaultSort?: string } = {},
): boolean {
  const defaultSort = options.defaultSort || '';

  // 1. 比较普通筛选字段
  const filtersEqual = areFiltersEqual(left, right, filterKeys);
  if (!filtersEqual) return false;

  // 2. 比较排序字段
  const leftSort = left?.sort || defaultSort;
  const rightSort = right?.sort || defaultSort;
  if (leftSort !== rightSort) return false;

  // 3. 比较关键词
  const leftKeyword = String(left?.keyword || '').trim();
  const rightKeyword = String(right?.keyword || '').trim();
  if (leftKeyword !== rightKeyword) return false;

  // 4. 比较日期范围
  if (!areDateRangesEqual(left?.dateRange, right?.dateRange)) {
    return false;
  }

  return true;
}

/**
 * 生成 Result 筛选对象的稳定 key（用于依赖比较）
 * @param {Object} filters
 * @param {string[]} filterKeys
 * @param {string} defaultSort
 * @returns {string}
 */
export function generateResultFiltersKey(
  filters: ResultFilterMap,
  filterKeys: string[],
  defaultSort?: string,
): string {
  const normalizedDefaultSort = defaultSort || '';
  const parts: string[] = [];
  
  // 普通筛选字段
  filterKeys.forEach((key) => {
    const values = Array.isArray(filters[key]) ? filters[key] : [];
    parts.push(`${key}:${values.map(String).sort().join(',')}`);
  });
  
  // 日期范围
  const dateRange = normalizeDateRange(filters?.dateRange);
  parts.push(`dateRange:${dateRange.join('-')}`);
  
  // 排序
  parts.push(`sort:${filters?.sort || normalizedDefaultSort}`);

  // 关键词
  parts.push(`keyword:${String(filters?.keyword || '').trim()}`);
  
  return parts.join('|');
}
