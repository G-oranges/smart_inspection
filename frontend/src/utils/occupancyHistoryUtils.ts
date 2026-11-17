/**
 * 入住异动记录筛选工具函数
 * OccupancyManagementPage 模块化
 */

type HistoryFilters = {
  action?: string;
  keyword?: string;
  dateRange?: unknown[] | null;
};

export function normalizeDateRange(
  range: unknown,
): string[] {
  if (!Array.isArray(range) || range.length !== 2) return [];
  return range
    .map((value) => {
      if (!value) {
        return '';
      }
      if (typeof value === 'object' && 'toISOString' in value && typeof value.toISOString === 'function') {
        return value.toISOString();
      }
      return String(value);
    })
    .filter(Boolean);
}

export function areHistoryFiltersEqual(
  left: HistoryFilters | null | undefined,
  right: HistoryFilters | null | undefined,
): boolean {
  if ((left?.action || '') !== (right?.action || '')) return false;
  if ((left?.keyword || '').trim() !== (right?.keyword || '').trim()) return false;
  const normLeft = normalizeDateRange(left?.dateRange);
  const normRight = normalizeDateRange(right?.dateRange);
  if (normLeft.length !== normRight.length) return false;
  for (let i = 0; i < normLeft.length; i++) {
    if (normLeft[i] !== normRight[i]) return false;
  }
  return true;
}
