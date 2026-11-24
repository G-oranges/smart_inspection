/**
 * 导入数据预处理模块
 * 用于解决 Excel 解析类型与后端 DTO 类型不匹配问题
 * 
 * 主要功能：
 * 1. string 字段：number → string 自动转换
 * 2. number/int 字段：string → number 自动转换
 * 3. 边界校验：科学计数法、小数、范围检查
 * 
 * 设计原则：
 * - codeFields 由调用方（config）传入，不在本文件硬编码
 * - 保持纯函数特性，不依赖外部状态
 */

// 预处理错误码常量
export const PreprocessErrorCodes = {
  TYPE_COERCION_FAILED: 'TYPE_COERCION_FAILED',       // 无法转换为目标类型
  INVALID_INTEGER_VALUE: 'INVALID_INTEGER_VALUE',     // 必须为整数但包含小数
  VALUE_OUT_OF_RANGE: 'VALUE_OUT_OF_RANGE',           // 超出范围
  INVALID_SCI_NOTATION: 'INVALID_SCI_NOTATION',       // 科学计数法或小数（编码字段）
  INVALID_ENUM_VALUE: 'INVALID_ENUM_VALUE',           // 枚举值不合法
};

type PreprocessErrorCode =
  (typeof PreprocessErrorCodes)[keyof typeof PreprocessErrorCodes];

type PreprocessErrorType = 'A' | 'B' | 'C' | 'E';

export interface ImportFieldDefinition {
  key: string;
  label?: string;
  type?: string;
  enum?: string[];
  min?: number;
  max?: number;
}

export interface ImportRow extends Record<string, unknown> {
  rowNo: number;
}

export interface PreprocessIssue {
  rowNo: number;
  errorType: PreprocessErrorType;
  errorCode: PreprocessErrorCode;
  reason: string;
  suggestion: string;
  affectedFields: string[];
}

export interface PreprocessStats {
  totalRows: number;
  coercedCells: number;
  numberToString: number;
  stringToNumber: number;
  normalizedCells: number;
}

interface CoerceResult {
  value: unknown;
  coerced: boolean;
  normalized?: boolean;
  coercionType?: 'number→string' | 'string→number' | 'other→string' | 'trim';
  issue?: PreprocessIssue;
}

/**
 * 预处理导入数据行
 * @param {Array<Object>} rows - 原始映射行 [{ rowNo, campus, building, ... }]
 * @param {Array<Object>} fields - config.fields 字段定义
 * @param {Array<string>} codeFields - 编码类字段列表（由 config.codeFields 传入）
 * @param {Object} normalizers - 字段归一化映射 { fieldKey: { '原值': '标准值' } }
 * @returns {{ rows: Array, issues: Array, stats: Object }}
 */
export function preprocessRows(
  rows: ImportRow[],
  fields: ImportFieldDefinition[],
  codeFields: string[] = [],
  normalizers: Record<string, Record<string, unknown>> = {},
): {
  rows: ImportRow[];
  issues: PreprocessIssue[];
  stats: PreprocessStats;
} {
  const processedRows: ImportRow[] = [];
  const issues: PreprocessIssue[] = [];
  const stats: PreprocessStats = {
    totalRows: rows.length,
    coercedCells: 0,      // 类型转换成功的单元格数
    numberToString: 0,    // number→string 转换数
    stringToNumber: 0,    // string→number 转换数
    normalizedCells: 0,   // 归一化处理的单元格数
  };

  // 构建字段类型映射 { fieldKey: { type, required, enum, min, max, ... } }
  const fieldMap = new Map(fields.map(f => [f.key, f]));
  // 将 codeFields 转为 Set 以提升查询性能
  const codeFieldSet = new Set(codeFields);

  for (const row of rows) {
    const processed: ImportRow = { rowNo: row.rowNo };

    for (const [key, value] of Object.entries(row)) {
      if (key === 'rowNo') continue;
      
      const fieldDef = fieldMap.get(key);
      if (!fieldDef) {
        // 未配置字段，透传
        processed[key] = value;
        continue;
      }

      // 将 codeFieldSet 和 normalizers 传入 coerceValue
      const result = coerceValue(value, fieldDef, row.rowNo, codeFieldSet, normalizers);
      
      if (result.issue) {
        issues.push(result.issue);
      }
      
      if (result.coerced) {
        stats.coercedCells++;
        if (result.coercionType === 'number→string') stats.numberToString++;
        if (result.coercionType === 'string→number') stats.stringToNumber++;
      }
      
      if (result.normalized) {
        stats.normalizedCells++;
      }
      
      processed[key] = result.value;
    }

    processedRows.push(processed);
  }

  return { rows: processedRows, issues, stats };
}

/**
 * 单值类型归一化
 * @param {any} value - 原始值
 * @param {Object} fieldDef - 字段定义 { key, type, required, enum, min, max }
 * @param {number} rowNo - 行号
 * @param {Set<string>} codeFieldSet - 编码类字段集合
 * @param {Object} normalizers - 字段归一化映射
 * @returns {{ value: any, coerced: boolean, normalized: boolean, coercionType?: string, issue?: Object }}
 */
function coerceValue(
  value: unknown,
  fieldDef: ImportFieldDefinition,
  rowNo: number,
  codeFieldSet: Set<string>,
  normalizers: Record<string, Record<string, unknown>> = {},
): CoerceResult {
  const { key, type, enum: enumValues, min, max } = fieldDef;
  const label = fieldDef.label || key;

  // 空值处理：保持为空（由后端必填校验处理）
  if (value === null || value === undefined || value === '') {
    return { value: value, coerced: false, normalized: false };
  }

  // ============ STRING 类型处理 ============
  if (type === 'string') {
    const result = coerceToString(value, key, label, rowNo, codeFieldSet);
    let normalized = false;
    let normalizedValue = result.value;
    
    // 应用归一化映射（如 "男性" → "男"）
    const fieldNormalizer = normalizers[key];
    if (
      fieldNormalizer &&
      typeof result.value === 'string' &&
      fieldNormalizer[result.value] !== undefined
    ) {
      normalizedValue = fieldNormalizer[result.value];
      normalized = true;
    }
    
    // 如果是 string 且有枚举定义，进行枚举校验
    if (!result.issue && enumValues && enumValues.length > 0) {
      if (typeof normalizedValue === 'string' && !enumValues.includes(normalizedValue)) {
        return {
          ...result,
          value: normalizedValue,
          normalized,
          issue: {
            rowNo,
            errorType: 'B', // 枚举不合法为 B 类
            errorCode: PreprocessErrorCodes.INVALID_ENUM_VALUE,
            reason: `${label}「${result.value}」不在允许范围内`,
            suggestion: `请填写以下选项之一：${enumValues.join('、')}`,
            affectedFields: [key],
          }
        };
      }
    }
    
    return { ...result, value: normalizedValue, normalized };
  }

  // ============ ENUM 类型处理（显式枚举字段）============
  if (type === 'enum') {
    const result = coerceToString(value, key, label, rowNo, codeFieldSet);
    let normalized = false;
    let normalizedValue = result.value;
    
    // 应用归一化映射
    const fieldNormalizer = normalizers[key];
    if (
      fieldNormalizer &&
      typeof result.value === 'string' &&
      fieldNormalizer[result.value] !== undefined
    ) {
      normalizedValue = fieldNormalizer[result.value];
      normalized = true;
    }
    
    // 枚举校验
    if (!result.issue && enumValues && enumValues.length > 0) {
      if (typeof normalizedValue === 'string' && !enumValues.includes(normalizedValue)) {
        return {
          ...result,
          value: normalizedValue,
          normalized,
          issue: {
            rowNo,
            errorType: 'A', // 明确的枚举类型，校验失败为 A 类
            errorCode: PreprocessErrorCodes.INVALID_ENUM_VALUE,
            reason: `${label}「${result.value}」不在允许范围内`,
            suggestion: `请填写以下选项之一：${enumValues.join('、')}`,
            affectedFields: [key],
          }
        };
      }
    }
    
    return { ...result, value: normalizedValue, normalized };
  }

  // ============ NUMBER/INT 类型处理 ============
  if (type === 'number' || type === 'int') {
    return coerceToNumber(value, key, label, rowNo, type === 'int', min, max);
  }

  // 未知类型，透传
  return { value, coerced: false };
}

/**
 * 转换为 string
 * @param {Set<string>} codeFieldSet - 编码类字段集合（由 config 驱动）
 */
function coerceToString(
  value: unknown,
  fieldKey: string,
  label: string,
  rowNo: number,
  codeFieldSet: Set<string>,
): CoerceResult {
  const isCodeField = codeFieldSet.has(fieldKey);

  // 已是 string
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return { 
      value: trimmed, 
      coerced: trimmed !== value,
      coercionType: 'trim'
    };
  }

  // number → string
  if (typeof value === 'number') {
    // 编码类字段边界检查
    if (isCodeField) {
      // 检查是否为小数
      if (!Number.isInteger(value)) {
        return {
          value: value,
          coerced: false,
          issue: {
            rowNo,
            errorType: 'A',
            errorCode: PreprocessErrorCodes.INVALID_SCI_NOTATION,
            reason: `${label}「${value}」包含小数，请填写完整编号`,
            suggestion: '请将该单元格设为文本格式后重新填写',
            affectedFields: [fieldKey],
          }
        };
      }
      
      // 检查科学计数法（超大数字转字符串时会变成科学计数法）
      const strValue = String(value);
      if (strValue.includes('e') || strValue.includes('E')) {
        return {
          value: value,
          coerced: false,
          issue: {
            rowNo,
            errorType: 'A',
            errorCode: PreprocessErrorCodes.INVALID_SCI_NOTATION,
            reason: `${label}「${strValue}」被表格转为科学计数法，可能丢失数字`,
            suggestion: '请将该单元格设为文本格式后重新填写完整内容',
            affectedFields: [fieldKey],
          }
        };
      }
    }

    // 正常转换：number → string
    return {
      value: String(value),
      coerced: true,
      coercionType: 'number→string'
    };
  }

  // 其他类型尝试转换
  return { value: String(value), coerced: true, coercionType: 'other→string' };
}

/**
 * 转换为 number
 */
function coerceToNumber(
  value: unknown,
  fieldKey: string,
  label: string,
  rowNo: number,
  requireInt: boolean,
  min?: number,
  max?: number,
): CoerceResult {
  let numValue: number;
  let wasCoerced = false;

  if (typeof value === 'number') {
    numValue = value;
  } else if (typeof value === 'string') {
    // 清理：去掉首尾空格、千分位逗号
    const cleaned = value.trim().replace(/,/g, '');
    if (cleaned === '') {
      return { value: null, coerced: false };
    }
    numValue = Number(cleaned);
    wasCoerced = true;
  } else {
    numValue = Number(value);
    wasCoerced = true;
  }

  // 转换失败
  if (!Number.isFinite(numValue)) {
    return {
      value: value,
      coerced: false,
      issue: {
        rowNo,
        errorType: 'A',
        errorCode: PreprocessErrorCodes.TYPE_COERCION_FAILED,
        reason: `${label}「${value}」不是有效数字`,
        suggestion: '请输入有效数字',
        affectedFields: [fieldKey],
      }
    };
  }

  // 要求整数
  if (requireInt && !Number.isInteger(numValue)) {
    return {
      value: value,
      coerced: false,
      issue: {
        rowNo,
        errorType: 'A',
        errorCode: PreprocessErrorCodes.INVALID_INTEGER_VALUE,
        reason: `${label}「${numValue}」必须为整数`,
        suggestion: '请输入整数（不含小数）',
        affectedFields: [fieldKey],
      }
    };
  }

  // 范围校验（仅当配置了 min/max 时）
  if (min !== undefined && numValue < min) {
    return {
      value: value,
      coerced: false,
      issue: {
        rowNo,
        errorType: 'A',
        errorCode: PreprocessErrorCodes.VALUE_OUT_OF_RANGE,
        reason: `${label}「${numValue}」不能小于 ${min}`,
        suggestion: `请输入不小于 ${min} 的数值`,
        affectedFields: [fieldKey],
      }
    };
  }
  if (max !== undefined && numValue > max) {
    return {
      value: value,
      coerced: false,
      issue: {
        rowNo,
        errorType: 'A',
        errorCode: PreprocessErrorCodes.VALUE_OUT_OF_RANGE,
        reason: `${label}「${numValue}」不能大于 ${max}`,
        suggestion: `请输入不大于 ${max} 的数值`,
        affectedFields: [fieldKey],
      }
    };
  }

  return {
    value: numValue,
    coerced: wasCoerced,
    coercionType: wasCoerced ? 'string→number' : undefined
  };
}

/**
 * 检查 issues 中是否存在阻断级错误（A 类或 B 类）
 * @param {Array} issues 
 * @returns {boolean}
 */
export function hasBlockingIssues(issues: PreprocessIssue[]): boolean {
  return issues.some(issue => issue.errorType === 'A' || issue.errorType === 'B');
}

/**
 * 获取阻断级 issues（A 类）
 * @param {Array} issues 
 * @returns {Array}
 */
export function getBlockingIssues(issues: PreprocessIssue[]): PreprocessIssue[] {
  return issues.filter(issue => issue.errorType === 'A');
}
