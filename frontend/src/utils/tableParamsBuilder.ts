// src/utils/tableParamsBuilder.js
// 表格参数构建工具 - 从各管理页面抽取的通用参数构建逻辑

type FilterValue = string | number | boolean | null | undefined;
type TableFilters = Record<string, FilterValue[]>;
type TablePagination = {
  current: number;
  pageSize: number;
};
type TableParamBuilderConfig = {
  filterKeys: string[];
  normalizers?: Record<string, (value: string) => string>;
};
type TableParams = Record<string, string | string[] | number | undefined>;

/**
 * 创建表格参数构建函数
 * @param {Object} config
 * @param {string[]} config.filterKeys - 筛选字段列表
 * @param {Record<string, (v: unknown) => string>} [config.normalizers] - 字段值归一化器，输入为 unknown
 * @returns {Function}
 */
export function createBuildTableParams(config: TableParamBuilderConfig) {
  const { filterKeys, normalizers = {} } = config;

  /**
   * @param {Record<string, unknown[]>} appliedFilters
   * @param {string} appliedSearchTerm
   * @param {{current: number, pageSize: number}} pagination
   * @param {string} sortField
   * @param {'asc'|'desc'} sortOrder
   * @param {boolean} [withPaging=true]
   * @returns {Record<string, unknown>}
   */
  return function buildTableParams(
    appliedFilters: TableFilters,
    appliedSearchTerm: string,
    pagination: TablePagination,
    sortField: string,
    sortOrder: 'asc' | 'desc',
    withPaging = true,
  ): TableParams {
    const params: TableParams = {};

    // 处理筛选参数
    filterKeys.forEach((key) => {
      const values = appliedFilters[key];
      if (values?.length) {
        // 先统一转 string，再应用 normalizer
        const stringValues = values.map((v) => String(v));
        params[key] = normalizers[key]
          ? stringValues.map((value) => normalizers[key](value))
          : stringValues;
      }
    });

    // 搜索词
    if (appliedSearchTerm?.trim()) {
      params.search = appliedSearchTerm.trim();
    }

    // 排序（总是带）
    params.sortField = sortField;
    params.sortOrder = sortOrder;

    // 分页（可选）
    if (withPaging) {
      params.page = pagination.current;
      params.pageSize = pagination.pageSize;
    }

    return params;
  };
}
