/**
 * Excel 导出工具函数
 * 用于防止 CSV/Excel 公式注入攻击
 */

type ExcelCellValue = string | number | boolean | null | undefined;
type ExcelRow = Record<string, ExcelCellValue>;

/**
 * 对 Excel 单元格值进行安全转义
 * 防止以 = + - @ 开头的字符串被 Excel 解析为公式
 * @param {any} value - 单元格值
 * @returns {any} - 转义后的值
 */
export function sanitizeExcelCell(value: ExcelCellValue): ExcelCellValue {
  if (typeof value !== "string") {
    return value;
  }
  // 检查是否以危险字符开头
  if (/^[=+\-@]/.test(value)) {
    return "'" + value;
  }
  return value;
}

/**
 * 对对象中的所有字符串值进行 Excel 安全转义
 * @param {Object} row - 数据行对象
 * @returns {Object} - 转义后的对象
 */
export function sanitizeExcelRow(row: ExcelRow): ExcelRow {
  const sanitized: ExcelRow = {};
  for (const [key, value] of Object.entries(row)) {
    sanitized[key] = sanitizeExcelCell(value);
  }
  return sanitized;
}
