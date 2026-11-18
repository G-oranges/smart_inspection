import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type {
  ImportFieldConfig,
  ImportStrategy,
  ImportWizardModalProps,
} from '../../types/import';
import { 
  Modal, Steps, Button, Upload, Select, 
  Typography, Space, Card, Divider, 
  message, Alert, Descriptions, Tag, Badge, 
  Popover, Collapse, Segmented, Tooltip, Progress,
  ConfigProvider, theme as antdTheme, Drawer
} from 'antd';
import { 
  InboxOutlined, 
  DownloadOutlined, 
  FileExcelOutlined,
  ArrowRightOutlined,
  CheckCircleOutlined,
  InfoCircleOutlined,
  ReloadOutlined,
  ClearOutlined,
  QuestionCircleOutlined,
  ExclamationCircleOutlined,
  WarningOutlined,
  CheckCircleFilled
} from '@ant-design/icons';
import { apiRequestWithRefresh } from '../../utils/api';
import {
  preprocessRows,
  type ImportRow,
  type PreprocessIssue,
  type PreprocessStats,
} from '../../utils/importPreprocessor';
import { sanitizeExcelRow } from '../../utils/excelUtils';
import { useAppContext } from '../../context/AppContext';
import { useMobile } from '../../hooks/useMobile';
import { CloseOutlined, LeftOutlined } from '@ant-design/icons';
import type { RcFile, UploadFile } from 'antd/es/upload/interface';
import { MODAL_WIDTH } from "./modalSizes";

type AnyRecord = Record<string, unknown>;
type XlsxModule = typeof import('xlsx');

interface WorkbookLike {
  SheetNames: string[];
  Sheets?: Record<string, AnyRecord>;
}

interface SheetMeta {
  headers: string[];
  dataRows: unknown[][];
  rawRows: unknown[][];
}

interface ImportIssue extends Omit<PreprocessIssue, 'affectedFields'> {
  reason: string;
  suggestion: string;
  errorCode: string;
  errorType: 'A' | 'B' | 'C' | 'E';
  rowNo: number;
  affectedFields?: string[];
}

interface PreviewResult {
  totalCount: number;
  importableRowCount: number;
  errorRowCount: number;
  conflictRowCount: number;
  passCount: number;
  issueCount: number;
  issues: ImportIssue[];
  _preprocessStats: PreprocessStats;
  _scannedRows: number;
}

interface SheetValidationResult {
  valid: boolean;
  message: string | null;
  headers: string[];
}

interface BackendPreviewResult {
  totalCount: number;
  passCount: number;
  issues: ImportIssue[];
}

interface ExecuteResult {
  totalCount: number;
  successCount: number;
  skippedCount: number;
  failedCount: number;
  createdCount?: number;
  updatedCount?: number;
  failedRows?: ImportIssue[];
  _scannedRows?: number;
  _errorRowCount?: number;
  [key: string]: unknown;
}

interface AsyncStartResult {
  jobId?: string;
}

interface AsyncProgressResult extends ExecuteResult {
  status?: 'processing' | 'completed' | 'failed';
  progress?: number;
  result?: ExecuteResult;
}

interface GroupedIssue {
  errorCode: string;
  errorType: 'A' | 'B' | 'C';
  summary: string;
  suggestion: string;
  count: number;
  rowNos: number[];
  items: Array<{ rowNo: number; reason: string }>;
}

type IssueGroups = Record<'A' | 'B' | 'C', Record<string, GroupedIssue>>;
type VisibleIssueType = 'A' | 'B' | 'C';

type ImportField = ImportFieldConfig;
type ImportMapping = Record<string, string>;
type SheetMetaMap = Record<string, SheetMeta>;
type ExportRow = Record<string, string | number>;
type MappingOption = {
  label: React.ReactNode;
  value: string;
  disabled: boolean;
};
type StrategyOption = {
  key: ImportStrategy;
  title: string;
  desc: string;
  detail: string;
  icon: React.ReactNode;
};
type MappingStats = {
  autoMatchCount: number;
  mappedCount: number;
  totalFields: number;
  requiredMissCount: number;
  isComplete: boolean;
};

type ErrorSummaryItem = {
  errorCode: string;
  count: number;
  description: string;
  suggestFix: string;
  affectedFields: string;
};

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function isVisibleIssueType(value: string): value is VisibleIssueType {
  return value === 'A' || value === 'B' || value === 'C';
}

function formatFieldValidation(field: ImportFieldConfig): string | null {
  if (!field.validation) {
    return null;
  }

  if (typeof field.validation.message === 'string' && field.validation.message) {
    return field.validation.message;
  }

  if (typeof field.validation.pattern === 'string' && field.validation.pattern) {
    return field.validation.pattern;
  }

  return null;
}

function buildIssueExportRow(
  issue: ImportIssue,
  originalRow: Record<string, unknown>,
  fields: ImportFieldConfig[],
): ExportRow {
  const row: ExportRow = {};

  fields.forEach((field) => {
    row[field.label] =
      (originalRow[field.key] as string | number | undefined) ?? '';
  });

  row['行号'] = issue.rowNo;
  row['错误类型'] = issue.errorType;
  row['错误代码'] = issue.errorCode || '';
  row['错误原因'] = issue.reason || '';
  row['修复建议'] = issue.suggestion || '';

  return row;
}

function buildFailedRowExportItem(
  issue: ImportIssue,
  originalRow: Record<string, unknown>,
  fields: ImportFieldConfig[],
): ExportRow {
  const exportItem: ExportRow = {};

  fields.forEach((field) => {
    exportItem[field.label] =
      (originalRow[field.key] as string | number | undefined) ?? '';
  });

  exportItem['行号'] = issue.rowNo;
  exportItem['异常类型'] = issue.errorType || 'E';
  exportItem['错误代码'] = issue.errorCode;
  exportItem['错误原因'] = issue.reason;
  exportItem['处理建议'] = issue.suggestion;

  return exportItem;
}


// 手动定义 CloudUploadOutlined 图标 (Lucide 风格)
const CloudUploadOutlined = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
    <path d="M12 12v9" /><path d="m16 16-4-4-4 4" />
  </svg>
);

const MagicWandIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m13.1 8.6 9.5 9.5a2 2 0 0 1-2.8 2.8l-9.5-9.5" />
    <path d="m15 3 2 1" />
    <path d="m11 4 1 2" />
    <path d="m20 10-2 1" />
    <path d="M3 7h1" />
    <path d="M3 11h2" />
    <path d="M3 15h1" />
    <path d="M7 3v1" />
    <path d="M11 3v2" />
    <path d="M15 3v1" />
  </svg>
);

// ========== E. 错误码通用描述映射 ==========
const ERROR_CODE_META = {
  VALUE_OUT_OF_RANGE: '数值超出允许范围',
  INVALID_INTEGER_VALUE: '应为整数格式',
  REQUIRED_FIELD_MISSING: '必填项缺失',
  INVALID_FORMAT: '数据格式非法',
  DUPLICATE_KEY: '唯一键冲突/数据已存在',
  DATA_NOT_FOUND: '关联的基础数据不存在',
  TYPE_MISMATCH: '字段类型不匹配',
} satisfies Record<string, string>;

const { Dragger } = Upload;
const { Text, Title, Paragraph } = Typography;

// ========== D. 修复 Tailwind 动态 class：显式映射 ==========
const STAT_CLASS_MAP = {
  blue: {
    bg: 'bg-blue-50/50 dark:bg-blue-500/10',
    border: 'border-blue-100 dark:border-blue-500/20',
    text: 'text-blue-600 dark:text-[#0A84FF]',
  },
  green: {
    bg: 'bg-green-50/50 dark:bg-green-500/10',
    border: 'border-green-100 dark:border-green-500/20',
    text: 'text-green-600 dark:text-green-400',
  },
  red: {
    bg: 'bg-red-50/50 dark:bg-red-500/10',
    border: 'border-red-100 dark:border-red-500/20',
    text: 'text-red-600 dark:text-red-400',
  },
  orange: {
    bg: 'bg-orange-50/50 dark:bg-orange-500/10',
    border: 'border-orange-100 dark:border-orange-500/20',
    text: 'text-orange-600 dark:text-orange-400',
  },
};

let xlsxModulePromise: Promise<XlsxModule> | null = null;

const EMPTY_SHEET_META: SheetMeta = {
  headers: [],
  dataRows: [],
  rawRows: [],
};

const normalizeImportHeader = (header: unknown): string => {
  if (header === null || header === undefined) return '';
  return String(header)
    .replace(/[\u200B\uFEFF\u00A0\t\r\n]/g, '')
    .trim();
};

const hasRowData = (row: unknown[] = []) =>
  row.some((cell) => {
    if (cell === null || cell === undefined) return false;
    if (typeof cell === 'string') return cell.trim() !== '';
    return true;
  });

const createSheetMeta = (
  xlsx: XlsxModule,
  workbook: WorkbookLike | null,
  sheetName: string,
): SheetMeta => {
  const sheet = workbook?.Sheets?.[sheetName];
  if (!sheet || !sheet['!ref']) {
    return EMPTY_SHEET_META;
  }

  const rawRows = xlsx.utils.sheet_to_json(sheet, {
    header: 1,
    defval: '',
    blankrows: true,
  }) as unknown[][];
  const headerRow = rawRows[0] || [];
  const headers = headerRow
    .map((cell) => normalizeImportHeader(cell))
    .filter(Boolean);
  const dataRows = rawRows.slice(1).filter((row) => hasRowData(row));

  return { headers, dataRows, rawRows };
};

const createSheetMetaMap = (
  xlsx: XlsxModule,
  workbook: WorkbookLike | null,
): SheetMetaMap =>
  Object.fromEntries(
    (workbook?.SheetNames || []).map((sheetName) => [
      sheetName,
      createSheetMeta(xlsx, workbook, sheetName),
    ]),
  );

async function loadXLSX() {
  if (!xlsxModulePromise) {
    xlsxModulePromise = import('xlsx');
  }

  return xlsxModulePromise;
}

/**
 * 导入向导通用弹窗组件
 * @param {boolean} open 是否打开
 * @param {function} onClose 关闭回调
 * @param {object} config 导入配置 (来自 importConfigs.js)
 */
const ImportWizardModal = ({
  open,
  onClose,
  onSuccess,
  config,
}: ImportWizardModalProps) => {
  const { activeTheme: globalTheme } = useAppContext();
  const isMobileMode = useMobile();
  const isDarkMode = globalTheme === 'dark';
  const accentColor = isDarkMode ? '#0A84FF' : '#007AFF';

  const [current, setCurrent] = useState(0);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [workbook, setWorkbook] = useState<WorkbookLike | null>(null);
  const [sheetMetaMap, setSheetMetaMap] = useState<SheetMetaMap>({});
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]); // Excel 表头
  const [mapping, setMapping] = useState<ImportMapping>({}); // 映射关系 { excelHeader: fieldKey }
  const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null); // 预检结果
  const [strategy, setStrategy] = useState<ImportStrategy>('SKIP'); // 冲突处理策略: OVERWRITE | SKIP
  const [executeResult, setExecuteResult] = useState<ExecuteResult | null>(null); // 执行结果
  const [lastExecutedRows, setLastExecutedRows] = useState<ImportRow[]>([]); // 最后执行时的数据镜像
  const [loading, setLoading] = useState(false); // 全局加载状态
  const [sheetValidationError, setSheetValidationError] = useState<string | null>(null);
  const [processedRows, setProcessedRows] = useState<ImportRow[]>([]); // 预处理后的全部数据行
  const [_preprocessStats, setPreprocessStats] = useState<PreprocessStats | null>(null); // 预处理统计信息
  const [importableRows, setImportableRows] = useState<ImportRow[]>([]); // 导入队列（不含 A/B 错误的行）
  const [issueFilter, setIssueFilter] = useState('all'); // 错误筛选: 'all' | 'AB' | 'C'
  const [_issueGroupType, setIssueGroupType] = useState('format'); // 问题分组: 'format' | 'conflict' | 'validation'
  const [importProgress, setImportProgress] = useState(0); // 导入进度 (0-100)
  const [expandedFields, setExpandedFields] = useState<Set<string>>(new Set()); // 移动端展示映射含义的字段集合

  // 使用 ref 同步追踪最新的 mapping，解决 handleNext 闭包问题
  const mappingRef = React.useRef<ImportMapping>(mapping);
  React.useEffect(() => {
    mappingRef.current = mapping;
  }, [mapping]);


  // 重置状态
  useEffect(() => {
    if (!open) {
      setCurrent(0);
      setFileList([]);
      setWorkbook(null);
      setSheetMetaMap({});
      setSheetNames([]);
      setSelectedSheet(null);
      setHeaders([]);
      setMapping({});
      setPreviewResult(null);
      setStrategy('SKIP');
      setExecuteResult(null);
      setLastExecutedRows([]);
      setLoading(false);
      setSheetValidationError(null);
      setProcessedRows([]);
      setPreprocessStats(null);
      setImportableRows([]);
      setIssueFilter('all');
      setIssueGroupType('format');
      setImportProgress(0);
    }
  }, [open]);

  // 步骤定义
  const steps = [
    { title: '下载模板', description: '获取规范格式' },
    { title: '上传文件', description: '解析 Sheet' },
    { title: '字段映射', description: '确认口径' },
    { title: '数据预检', description: '逻辑校验' },
    { title: '确认策略', description: '冲突处理' },
    { title: '执行工作', description: '结果复盘' },
  ];

  // 解析 Excel 文件获取 Sheet 名称
  const parseExcel = (file: RcFile) => {
    const reader = new FileReader();
    reader.onload = async (e: ProgressEvent<FileReader>) => {
      try {
        const XLSX = await loadXLSX();
        const arrayBuffer = e.target?.result;
        if (!(arrayBuffer instanceof ArrayBuffer)) {
          throw new Error('Excel 文件读取失败');
        }
        const data = new Uint8Array(arrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        setWorkbook(wb);
        setSheetMetaMap(createSheetMetaMap(XLSX, wb));
        setSheetNames(wb.SheetNames);
        setSelectedSheet(null);
      } catch (err) {
        message.error(getErrorMessage(err, '解析 Excel 失败，请确保文件格式正确'));
        setFileList([]);
        setWorkbook(null);
        setSheetMetaMap({});
        setSheetNames([]);
        setSelectedSheet(null);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleBeforeUpload = (file: RcFile) => {
    const isExcel = file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
                    file.type === 'application/vnd.ms-excel' ||
                    file.name.endsWith('.xlsx') || 
                    file.name.endsWith('.xls');
    
    if (!isExcel) {
      message.error('仅支持上传 .xls 或 .xlsx 格式的文件');
      return Upload.LIST_IGNORE;
    }

    // Top 3 修复：文件大小上限校验
    const maxFileSize = config?.limits?.maxFileSize || 5 * 1024 * 1024; // 默认 5MB
    if (file.size > maxFileSize) {
      const sizeMB = (maxFileSize / 1024 / 1024).toFixed(0);
      message.error(`文件大小超出限制（最大 ${sizeMB}MB）`);
      return Upload.LIST_IGNORE;
    }

    setFileList([file]);
    setSheetValidationError(null);
    parseExcel(file);
    return false; // 手动上传
  };

  // 自动匹配逻辑
  const autoMatchHeaders = useCallback((excelHeaders: string[]) => {
    const newMapping: Record<string, string> = {};
    const fields = config?.fields || [];
    
    excelHeaders.forEach(header => {
      // 1. 完全匹配 label
      let match = fields.find(f => f.label === header);
      // 2. 模糊匹配 (包含关系)
      if (!match) {
        match = fields.find(f => header.includes(f.label) || f.label.includes(header));
      }
      
      if (match) {
        newMapping[header] = match.key;
      }
    });
    setMapping(newMapping);
  }, [config]);



  // 重置回到第一步
  const handleReset = () => {
    setCurrent(0);
    setFileList([]);
    setWorkbook(null);
    setSheetMetaMap({});
    setSheetNames([]);
    setSelectedSheet(null);
    setHeaders([]);
    setMapping({});
    setPreviewResult(null);
    setStrategy('SKIP');
    setExecuteResult(null);
    setLastExecutedRows([]);
    setSheetValidationError(null);
  };

  /**
   * 归一化表头：去除不可见字符（\u200B, \uFEFF, \u00A0 等）和首尾空格
   */
  const normalizeHeader = useCallback((header: unknown) => {
    return normalizeImportHeader(header);
  }, []);

  const getSheetMeta = useCallback(() => {
    if (!selectedSheet) return EMPTY_SHEET_META;
    return sheetMetaMap[selectedSheet] || EMPTY_SHEET_META;
  }, [selectedSheet, sheetMetaMap]);

  const validateSelectedSheet = useCallback((): SheetValidationResult => {
    if (!workbook || !selectedSheet) {
      setSheetValidationError(null);
      return { valid: false, message: null, headers: [] };
    }

    const { headers, dataRows } = getSheetMeta();
    
    // B5 校验：空表头检测
    if (headers.length === 0) {
      const messageText = '所选工作表缺少表头，请确认第一行表头是否完整。';
      setSheetValidationError(messageText);
      return { valid: false, message: messageText, headers };
    }
    
    // B5 校验：重复表头检测
    const headerCounts: Record<string, number> = {};
    const duplicateHeaders = [];
    for (const h of headers) {
      headerCounts[h] = (headerCounts[h] || 0) + 1;
      if (headerCounts[h] === 2) {
        duplicateHeaders.push(h);
      }
    }
    if (duplicateHeaders.length > 0) {
      const messageText = `表头存在重复列名：「${duplicateHeaders.join('」「')}」，请修正后重新上传。`;
      setSheetValidationError(messageText);
      return { valid: false, message: messageText, headers };
    }
    
    // 空数据行检测
    if (dataRows.length === 0) {
      const messageText = '所选工作表无有效数据行（仅表头或空表），请补充数据或更换 Sheet。';
      setSheetValidationError(messageText);
      return { valid: false, message: messageText, headers };
    }

    setSheetValidationError(null);
    return { valid: true, message: null, headers };
  }, [getSheetMeta, selectedSheet, workbook]);

  useEffect(() => {
    if (current !== 1) return;
    if (!workbook || !selectedSheet) {
      setSheetValidationError(null);
      return;
    }
    validateSelectedSheet();
  }, [current, selectedSheet, validateSelectedSheet, workbook]);

  const getTemplateHeaders = () => (config?.fields || []).map(field => field.label);

  // A1 修复：示例行数据完全由 config 驱动，不再硬编码
  const getTemplateSampleRow = () => {
    return config?.template?.sampleRow || {};
  };

  const handleDownloadTemplate = async (type: 'sample' | 'empty') => {
    const headers = getTemplateHeaders();
    if (headers.length === 0) {
      message.error('模板字段配置缺失，无法生成模板');
      return;
    }

    const XLSX = await loadXLSX();
    const data: unknown[][] = [headers];
    if (type === 'sample') {
      const sampleRow = getTemplateSampleRow() as Record<string, unknown>;
      const rowValues = (config?.fields || []).map(field => sampleRow[field.key] ?? '');
      data.push(rowValues);
    }

    const worksheet = XLSX.utils.aoa_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    const sheetName = config?.template?.sheetName || config?.title || '导入模板';
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

    const fallbackTitle = config?.title || '导入';
    const filename = type === 'sample'
      ? (config?.template?.sampleTemplateName || `${fallbackTitle}_示例模板.xlsx`)
      : (config?.template?.emptyTemplateName || `${fallbackTitle}_空模板.xlsx`);
    XLSX.writeFile(workbook, filename);
  };

  /**
   * 下载失败行数据文件
   * 将失败的 rowNo 与 lastExecutedRows 匹配，还原原始数据列并追加错误列
   */
  const handleDownloadFailedRows = async () => {
    if (!executeResult?.failedRows || executeResult.failedRows.length === 0) return;

    const XLSX = await loadXLSX();
    const data = executeSummary.failedRows.map((issue) => {
      // 找到原始行数据
      const originalRow = lastExecutedRows.find(r => r.rowNo === issue.rowNo) || {};
      
      // Top 1 修复：对导出数据进行 Excel 安全转义，防止公式注入
      return sanitizeExcelRow(
        buildFailedRowExportItem(
          issue,
          originalRow as Record<string, unknown>,
          config.fields,
        ),
      );
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "失败明细");
    XLSX.writeFile(workbook, `${config.title}_失败行导出_${new Date().getTime()}.xlsx`);
  };

  /**
   * 下载异常分析报告
   * 按 errorCode 聚合统计
   */
  const handleDownloadErrorReport = async () => {
    if (!executeResult?.failedRows || executeResult.failedRows.length === 0) return;

    const XLSX = await loadXLSX();
    // 聚合
    const summaryMap: Record<string, ErrorSummaryItem> = {};
    executeSummary.failedRows.forEach((issue) => {
      if (!summaryMap[issue.errorCode]) {
        summaryMap[issue.errorCode] = {
          errorCode: issue.errorCode,
          count: 0,
          description: issue.reason,
          suggestFix: issue.suggestion,
          affectedFields: issue.affectedFields?.join(', ') || '-'
        };
      }
      summaryMap[issue.errorCode].count++;
    });

    const data = Object.values(summaryMap).map(item => sanitizeExcelRow({
      '错误代码': item.errorCode,
      '发生次数': item.count,
      '异常描述': item.description,
      '修复方案': item.suggestFix,
      '涉及字段': item.affectedFields
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "异常分析报告");
    XLSX.writeFile(workbook, `${config.title}_异常分析报告_${new Date().getTime()}.xlsx`);
  };

  const handleNext = async () => {
    if (current === 1 && !selectedSheet) {
      message.warning('请选择需要导入的工作表（Sheet）');
      return;
    }

    // 从 Step 2 进入 Step 3：提取表头并尝试自动匹配
    if (current === 1) {
      const validation = validateSelectedSheet();
      if (!validation.valid) {
        if (validation.message) message.error(validation.message);
        return;
      }
      setHeaders(validation.headers);
      autoMatchHeaders(validation.headers);
    }

    // 从 Step 3 进入 Step 4：执行预处理 + 预检
    if (current === 2) {
      // 使用 mappingRef.current 获取最新的 mapping 值（解决闭包问题）
      const currentMapping = mappingRef.current;
      
      // 校验必填项是否已映射
      const unmappedRequired = config.requiredFields.filter(key => 
        !Object.values(currentMapping).includes(key)
      );
      
      if (unmappedRequired.length > 0) {
        const labels = unmappedRequired.map(key => config.fields.find(f => f.key === key)?.label);
        message.error(`必填字段未映射：${labels.join(', ')}`);
        return;
      }


      setLoading(true);
      try {
        const { rawRows } = getSheetMeta();
        const headerRowData = rawRows[0] || [];
        
        // 归一化表头（与 getSheetMeta 保持一致）
        const normalizedHeaders = headerRowData.map((h) => normalizeHeader(h));
        
        // 过滤有效数据行并保留原始索引
        const dataRowsWithIndex: Array<{ row: unknown[]; excelRowIndex: number }> = [];
        for (let i = 1; i < rawRows.length; i++) {
          const row = rawRows[i];
          if (hasRowData(row)) {
            dataRowsWithIndex.push({ row, excelRowIndex: i + 1 }); // Excel 行号从 1 开始，+1 因为表头占第 1 行
          }
        }
        
        // Top 3 修复：行数上限校验
        const maxRows = config?.limits?.maxRows || 5000;
        if (dataRowsWithIndex.length > maxRows) {
          message.error(`数据行数超出限制（最大 ${maxRows} 行，当前 ${dataRowsWithIndex.length} 行）`);
          setLoading(false);
          return;
        }

        // 第一步：映射原始数据，rowNo 使用 Excel 物理行号
        const rawMappedRows = dataRowsWithIndex.map(({ row, excelRowIndex }) => {
          const item: ImportRow = { rowNo: excelRowIndex };
          Object.entries(currentMapping).forEach(([header, key]) => {
            const headerIndex = normalizedHeaders.indexOf(header);
            if (headerIndex !== -1) {
              item[key] = row[headerIndex];
            }
          });
          return item;
        });


        // 第二步：执行预处理（类型归一化 + 值标准化）
        const { rows: preprocessedRows, issues: preprocessIssues, stats } = 
          preprocessRows(rawMappedRows, config.fields, config.codeFields || [], config.normalizers || {});
        
        // 存储预处理后的全部数据
        setProcessedRows(preprocessedRows);
        setPreprocessStats(stats);

        // 第三步：识别含 A 类错误的 rowNo（这些行不进入导入队列）
        const errorRowNos = new Set(
          preprocessIssues
            .filter(issue => issue.errorType === 'A')
            .map(issue => issue.rowNo)
        );
        
        // 第四步：剔除错误行，得到候选可导入行
        const candidateRows = preprocessedRows.filter(row => !errorRowNos.has(row.rowNo));
        
        let allIssues: ImportIssue[] = [...preprocessIssues];
        let backendResult: BackendPreviewResult = {
          totalCount: 0,
          passCount: 0,
          issues: [],
        };

        // 第五步：仅当有候选行时调用后端 preview
        // Top 2 修复：使用 apiRequestWithRefresh 统一处理认证和错误
        if (candidateRows.length > 0) {
          try {
            backendResult = await apiRequestWithRefresh(config.api.preview, {
              method: 'POST',
              body: { rows: candidateRows }
            }) as BackendPreviewResult;
            
            // 合并后端返回的 issues（可能包含 B 类字典错误、C 类冲突）
            allIssues = [...preprocessIssues, ...(backendResult.issues || [])];
          } catch (err) {
            // apiRequestWithRefresh 会处理 401 自动刷新，403 抛出错误
            message.error(getErrorMessage(err, '预检请求失败'));
            setLoading(false);
            return;
          }
        }

        // 第六步：基于合并后的 issues 重新计算统计口径
        // 含 A/B 错误的 rowNo（需修复行）
        const abErrorRowNos = new Set(
          allIssues
            .filter(issue => issue.errorType === 'A' || issue.errorType === 'B')
            .map(issue => issue.rowNo)
        );
        
        // 仅含 C 类（无 A/B）的 rowNo（有冲突行）
        const cOnlyRowNos = new Set(
          allIssues
            .filter(issue => issue.errorType === 'C')
            .map(issue => issue.rowNo)
            .filter(rowNo => !abErrorRowNos.has(rowNo))
        );

        const totalRows = preprocessedRows.length;
        const errorRowCount = abErrorRowNos.size;
        const importableRowCount = totalRows - errorRowCount;
        const conflictRowCount = cOnlyRowNos.size;

        // 第七步：计算最终导入队列（不含 A/B 错误的行）
        const finalImportableRows = preprocessedRows.filter(row => !abErrorRowNos.has(row.rowNo));
        setImportableRows(finalImportableRows);

        // 设置预检结果
        setPreviewResult({
          totalCount: totalRows,
          importableRowCount,
          errorRowCount,
          conflictRowCount,
          passCount: importableRowCount - conflictRowCount, // 无任何问题的行
          issueCount: allIssues.length,
          issues: allIssues,
          _preprocessStats: stats,
          _scannedRows: totalRows,
        });
      } catch (err) {
        console.error('预检请求失败', err);
        message.error('预检请求失败');
      } finally {
        setLoading(false);
      }
    }

    // Step 4 阻断逻辑：只有可导入行为 0 才阻断
    if (current === 3) {
      const importableCount = previewResult?.importableRowCount ?? 0;
      if (importableCount === 0) {
        message.error('无可导入数据。请下载错误行文件修复后重新上传。');
        return;
      }
    }

    if (current >= 5) return;
    setCurrent(current + 1);
  };

  const handleExecute = async () => {
    setLoading(true);
    try {
      // 使用导入队列（与 preview 保持一致，不含 A/B 错误行）
      const rowsToExecute = importableRows;

      if (rowsToExecute.length === 0) {
        message.error('无可导入数据');
        setLoading(false);
        return;
      }

      // 持久化本次执行的数据，用于后续下载对比
      setLastExecutedRows(rowsToExecute);
      setImportProgress(0);

      // 尝试使用异步执行 API（支持进度轮询）
      const asyncApiUrl = config.api.execute.replace('/execute', '/execute-async');
      let useAsyncMode = false;
      let jobId: string | null = null;

      try {
        // 尝试调用异步 API
        const asyncResult = await apiRequestWithRefresh(asyncApiUrl, {
          method: 'POST',
          body: { 
            strategy,
            rows: rowsToExecute 
          }
        }) as AsyncStartResult;

        // 如果返回 jobId，说明后端支持异步模式
        if (asyncResult.jobId) {
          useAsyncMode = true;
          jobId = asyncResult.jobId;
        }
      } catch (asyncErr) {
        // 异步 API 不可用（404 等），降级为同步模式
        console.log('异步 API 不可用，使用同步模式');
      }

      let result: ExecuteResult;

      if (useAsyncMode && jobId) {
        // 轮询进度直到完成
        result = await pollImportProgress(jobId);
      } else {
        // 降级为同步执行（保留模拟进度，但修复超限 bug）
        let progressTimer: ReturnType<typeof setInterval> | null = null;
        let currentProgress = 0;

        progressTimer = setInterval(() => {
          // 修复：使用 Math.min 确保不超过 95%
          const increment = Math.floor(Math.random() * 10) + 3;
          currentProgress = Math.min(currentProgress + increment, 95);
          setImportProgress(currentProgress);
          
          if (currentProgress >= 95) {
            if (progressTimer !== null) {
              clearInterval(progressTimer);
            }
          }
        }, 300);

        try {
          result = await apiRequestWithRefresh(config.api.execute, {
            method: 'POST',
            body: { 
              strategy,
              rows: rowsToExecute 
            }
          }) as ExecuteResult;
        } finally {
          if (progressTimer) clearInterval(progressTimer);
        }
        
        setImportProgress(100);
      }

      // 延迟进入结果页，让用户看清 100% 状态
      setTimeout(() => {
        // 附加扫描总数信息供 Step6 使用
        setExecuteResult({
          ...result,
          _scannedRows: previewResult?._scannedRows || previewResult?.totalCount || 0,
          _errorRowCount: previewResult?.errorRowCount || 0,
        });
        onSuccess?.();
        message.success('导入执行完毕');
        setCurrent(current + 1);
      }, 500);
    } catch (err) {
      // apiRequestWithRefresh 会处理 401 自动刷新，403 抛出错误
      message.error(getErrorMessage(err, '执行导入失败'));
    } finally {
      setLoading(false);
    }
  };

  // 轮询导入进度
  const pollImportProgress = async (jobId: string): Promise<ExecuteResult> => {
    const maxPollTime = 5 * 60 * 1000; // 最长轮询 5 分钟
    const pollInterval = 800; // 轮询间隔 800ms
    const startTime = Date.now();

    while (Date.now() - startTime < maxPollTime) {
      try {
        const progress = await apiRequestWithRefresh(`/api/import/progress/${jobId}`, {
          method: 'GET'
        }) as AsyncProgressResult;

        // 更新进度条
        const progressPercent = Math.min(progress.progress ?? 0, 100);
        setImportProgress(progressPercent);

        // 检查是否完成
        if (progress.status === 'completed') {
          setImportProgress(100);
          return progress.result ?? progress;
        }

        // 检查是否失败
        if (progress.status === 'failed') {
          throw new Error(String(progress.error || '导入执行失败'));
        }

        // 等待下一次轮询
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      } catch (err) {
        // 如果是网络错误，继续轮询
        if (err instanceof Error && (err.message.includes('fetch') || err.message.includes('network'))) {
          await new Promise(resolve => setTimeout(resolve, pollInterval));
          continue;
        }
        throw err;
      }
    }

    throw new Error('导入超时，请稍后刷新页面查看结果');
  };

  const handlePrev = () => {
    setCurrent(current - 1);
  };

  // 下载错误行 Excel
  const handleDownloadErrorRows = async () => {
    const issues = previewResult?.issues || [];
    const abIssues = issues.filter(i => i.errorType === 'A' || i.errorType === 'B');
    
    if (abIssues.length === 0) {
      message.info('没有需要修复的错误行');
      return;
    }

    // 获取错误行的 rowNo 集合
    const errorRowNos = new Set(abIssues.map(i => i.rowNo));
    
    // 获取原始数据行（用于导出原始列）
    const errorRows = processedRows.filter(row => errorRowNos.has(row.rowNo));
    
    // 构建导出数据：每条 issue 一行
    const exportData = abIssues.map((issue) => {
      const originalRow = errorRows.find(r => r.rowNo === issue.rowNo) || {};
      
      // Top 1 修复：对导出数据进行 Excel 安全转义，防止公式注入
      return sanitizeExcelRow(
        buildIssueExportRow(
          issue,
          originalRow as Record<string, unknown>,
          config.fields,
        ),
      );
    });

    // 创建 Excel
    const XLSX = await loadXLSX();
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '错误明细');
    
    // 下载
    const timestamp = Date.now();
    const fileName = `${config.title}_错误行导出_${timestamp}.xlsx`;
    XLSX.writeFile(wb, fileName);
    
    message.success('错误行文件已下载');
  };

  // 统计变量
  const previewIssues = useMemo(() => previewResult?.issues || [], [previewResult]);
  const importableRowCount = previewResult?.importableRowCount ?? 0;
  const errorRowCount = previewResult?.errorRowCount ?? 0;

  // 根据筛选条件过滤要显示的错误类型组
  const activeIssueTypes = useMemo<VisibleIssueType[]>(() => {
    if (issueFilter === 'AB') return ['A', 'B'];
    if (issueFilter === 'C') return ['C'];
    return ['A', 'B', 'C'];
  }, [issueFilter]);

  // 按 errorType + errorCode 聚合问题
  const groupedIssuesByCode = useMemo<Record<VisibleIssueType, GroupedIssue[]>>(() => {
    const issues = previewIssues;
    const groups: IssueGroups = { A: {}, B: {}, C: {} };
    
    issues.forEach(issue => {
      const type = isVisibleIssueType(issue.errorType) ? issue.errorType : 'A';
      const code = issue.errorCode || 'UNKNOWN';
      if (!groups[type][code]) {
        groups[type][code] = {
          errorCode: code,
          errorType: type,
          summary: ERROR_CODE_META[code as keyof typeof ERROR_CODE_META] || '数据不符合校验规则',
          suggestion: issue.suggestion,
          count: 0,
          rowNos: [],
          items: [] // 收集逐行明细
        };
      }
      groups[type][code].count++;
      groups[type][code].rowNos.push(issue.rowNo);
      groups[type][code].items.push({ rowNo: issue.rowNo, reason: issue.reason });
    });

    const result = { A: [], B: [], C: [] } as Record<VisibleIssueType, GroupedIssue[]>;
    activeIssueTypes.forEach(type => {
      result[type] = Object.values(groups[type]).sort((a, b) => b.count - a.count);
    });
    return result;
  }, [previewIssues, activeIssueTypes]);

  // 统计各类型问题数量
  const issueTypeCounts = useMemo(() => {
    const counts = { A: 0, B: 0, C: 0, total: previewIssues.length };
    previewIssues.forEach(i => {
      if (isVisibleIssueType(i.errorType)) counts[i.errorType]++;
    });
    return counts;
  }, [previewIssues]);

  // 检查是否可以继续导入
  const canContinueImport = importableRowCount > 0;
  const hasErrorRows = errorRowCount > 0;

  // ========== 一、映射统计计算 ==========
  const mappingStats = useMemo<MappingStats>(() => {
    const fields = config?.fields || [];
    const requiredFields = config?.requiredFields || [];
    const mappedKeys = Object.values(mapping).filter(Boolean);
    
    // 自动匹配数：当前映射中与字段 label 完全匹配或模糊匹配的数量
    let autoMatchCount = 0;
    Object.entries(mapping).forEach(([header, key]) => {
      if (!key) return;
      const field = fields.find(f => f.key === key);
      if (field && (field.label === header || header.includes(field.label) || field.label.includes(header))) {
        autoMatchCount++;
      }
    });
    
    const mappedCount = mappedKeys.length;
    const totalFields = fields.length;
    const requiredMissCount = requiredFields.filter(key => !mappedKeys.includes(key)).length;
    
    return {
      autoMatchCount,
      mappedCount,
      totalFields,
      requiredMissCount,
      isComplete: requiredMissCount === 0,
    };
  }, [mapping, config]);

  const groupedIssueEntries = useMemo(
    () =>
      activeIssueTypes
        .map((type) => ({ type, groups: groupedIssuesByCode[type] }))
        .filter((entry) => entry.groups.length > 0),
    [activeIssueTypes, groupedIssuesByCode],
  );

  const buildFieldOptions = useCallback(
    (header: string): MappingOption[] =>
      config.fields.map((field) => ({
        label: (
          <span className="flex items-center gap-1">
            {field.label}
            {config.requiredFields.includes(field.key) && (
              <span className="text-red-500">*</span>
            )}
          </span>
        ),
        value: field.key,
        disabled:
          Object.values(mapping).includes(field.key) && mapping[header] !== field.key,
      })),
    [config.fields, config.requiredFields, mapping],
  );

  const executeSummary = useMemo(
    () => ({
      totalCount: executeResult?.totalCount ?? 0,
      successCount: executeResult?.successCount ?? 0,
      skippedCount: executeResult?.skippedCount ?? 0,
      failedCount: executeResult?.failedCount ?? 0,
      createdCount: executeResult?.createdCount ?? 0,
      updatedCount: executeResult?.updatedCount ?? 0,
      failedRows: executeResult?.failedRows ?? [],
    }),
    [executeResult],
  );

  const canDownloadFailedRows = executeSummary.failedCount > 0;
  const canDownloadErrorReport = executeSummary.failedRows.length > 0;

  const strategyOptions = useMemo<StrategyOption[]>(
    () => [
      {
        key: 'SKIP',
        title: '跳过重复项 (SKIP)',
        desc: '保持系统中已有记录不动，仅导入新条目。',
        detail:
          '安全策略。适用于批量补录场景。如果 Excel 中的信息与系统不一致，系统记录将保持不变。',
        icon: <ClearOutlined className="text-xl" />,
      },
      {
        key: 'OVERWRITE',
        title: '覆盖现有数据 (OVERWRITE)',
        desc: '以 Excel 为准，更新系统中已存在的记录。',
        detail:
          '更新策略。适用于数据清洗或大规模信息修正场景。Excel 中的非空值将强制更新到系统对应字段。',
        icon: <ReloadOutlined className="text-xl" />,
      },
    ],
    [],
  );

  // 重置映射
  const handleResetMapping = useCallback(() => {
    setMapping({});
    message.info('映射已重置');
  }, []);

  // 重新自动匹配
  const handleReAutoMatch = useCallback(() => {
    if (headers.length > 0) {
      autoMatchHeaders(headers);
      if (isMobileMode) {
        const matchCount = headers.filter(h => {
          const fields = config?.fields || [];
          return fields.find(f => f.label === h || h.includes(f.label) || f.label.includes(h));
        }).length;
        message.success(`已自动匹配 ${matchCount} 项字段`);
      } else {
        message.success('已重新执行自动匹配');
      }
    }
  }, [autoMatchHeaders, config, headers, isMobileMode]);

  // ========== 二、Context Summary Bar 渲染 ==========
  const renderContextSummaryBar = () => {
    // 仅保留“上下文”信息，移除结果/状态类信息以减少杂乱
    const items = [];
    
    // 1. 文件名 (Step 2+)
    if (current >= 1 && fileList.length > 0) {
      items.push({
        key: 'file',
        label: '文件',
        children: (
          <Tooltip title={fileList[0]?.name}>
            <span className="text-xs text-gray-500 max-w-[150px] truncate leading-none dark:text-white/60">
              {fileList[0]?.name}
            </span>
          </Tooltip>
        ),
      });
    }
    
    // 2. 工作表名称 (Step 2+)
    if (current >= 1 && selectedSheet) {
      items.push({
        key: 'sheet',
        label: '工作表',
        children: <Tag className="m-0 border-none bg-gray-200/50 text-gray-500 text-[10px] px-1.5 rounded h-4 leading-4 dark:bg-white/10 dark:text-white/60">{selectedSheet}</Tag>,
      });
    }
    
    // 3. 映射进度 (Step 3+)
    if (current >= 2 && headers.length > 0) {
      items.push({
        key: 'mapping',
        label: '映射',
        children: (
          <span className={`text-[11px] font-medium ${mappingStats.isComplete ? 'text-green-600' : 'text-orange-500'}`}>
            {mappingStats.mappedCount}/{mappingStats.totalFields}
          </span>
        ),
      });
    }
    
    if (items.length === 0) return null;

    return (
      <div className="px-10 py-1.5 border-b border-gray-100 bg-gray-50/50 flex items-center h-8 dark:bg-white/5 dark:border-white/10 backdrop-blur-xl">
        <Space size={20} split={<Divider type="vertical" className="m-0 bg-gray-200 h-2.5 dark:bg-white/10" />} className="flex items-center">
          {items.map(item => (
            <div key={item.key} className="flex items-center gap-2 leading-none">
              <span className="text-[10px] text-gray-400 uppercase tracking-tight dark:text-white/30">{item.label}</span>
              {item.children}
            </div>
          ))}
        </Space>
      </div>
    );
  };

  // ========== A. Footer 主操作收敛：统一计算主按钮 ==========
  const getPrimaryAction = (() => {
    switch (current) {
      case 0: // 下载模板
        return {
          text: '下一步',
          onClick: handleNext,
          disabled: false,
          loading: false,
          icon: <ArrowRightOutlined className="text-xs" />,
        };
      case 1: // 上传文件
        return {
          text: '下一步',
          onClick: handleNext,
          disabled: !selectedSheet || !!sheetValidationError,
          loading: false,
          icon: <ArrowRightOutlined className="text-xs" />,
        };
      case 2: // 字段映射
        return {
          text: '下一步',
          onClick: handleNext,
          disabled: false,
          loading: loading,
          icon: <ArrowRightOutlined className="text-xs" />,
        };
      case 3: // 数据预检 (Step 4)
        return {
          text: canContinueImport ? `继续导入（${importableRowCount} 行）` : '无可导入数据',
          onClick: handleNext,
          disabled: !canContinueImport,
          loading: loading,
          icon: canContinueImport ? <ArrowRightOutlined className="text-xs" /> : null,
        };
      case 4: // 确认策略 (Step 5) - 主按钮为"开始导入"
        return {
          text: '开始导入',
          onClick: handleExecute,
          disabled: false,
          loading: loading,
          icon: null,
        };
      case 5: // 执行完成 (Step 6) - 主按钮为"完成退出"
        return {
          text: '完成退出',
          onClick: onClose,
          disabled: false,
          loading: false,
          icon: null,
        };
      default:
        return null;
    }
  })();



  // ========== 三、移动端渲染适配 ==========
  const renderMobileStepContent = () => {
    switch (current) {
      case 0:
        return (
          <div className="space-y-4">
            <Card variant="borderless" className="bg-gray-50/50 border border-gray-100 rounded-2xl dark:bg-[#1C1C1E] dark:border-white/10 active:scale-[0.98] transition-all">
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center dark:bg-blue-500/10">
                    <FileExcelOutlined className="text-blue-500 text-2xl dark:text-[#0A84FF]" />
                  </div>
                  <div className="flex-1">
                    <Text strong className="block text-base dark:text-white/95">{config?.template?.emptyTemplateName || '导入模板.xlsx'}</Text>
                    <Text type="secondary" className="text-xs dark:text-white/30">标准空模板，包含所有必填列头</Text>
                  </div>
                </div>
                <Button 
                  type="default" 
                  block
                  size="large"
                  icon={<DownloadOutlined />} 
                  className="rounded-xl h-[44px] dark:bg-white/5 dark:border-white/10 dark:text-white/60"
                  onClick={() => handleDownloadTemplate('empty')}
                >
                  下载空模板
                </Button>
              </div>
            </Card>

            <Card variant="borderless" className="bg-gray-50/50 border border-gray-100 rounded-2xl dark:bg-[#1C1C1E] dark:border-white/10 active:scale-[0.98] transition-all">
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center dark:bg-green-500/10">
                    <InfoCircleOutlined className="text-green-500 text-2xl" />
                  </div>
                  <div className="flex-1">
                    <Text strong className="block text-base dark:text-white/95">{config?.template?.sampleTemplateName || '示例模板.xlsx'}</Text>
                    <Text type="secondary" className="text-xs dark:text-white/30">包含演示数据，帮助快速理解规范</Text>
                  </div>
                </div>
                <Button 
                  type="default" 
                  block
                  size="large"
                  icon={<DownloadOutlined />}
                  className="rounded-xl h-[44px] dark:bg-white/5 dark:border-white/10 dark:text-white/60"
                  onClick={() => handleDownloadTemplate('sample')}
                >
                  下载示例模板
                </Button>
              </div>
            </Card>

            {config?.notes && config.notes.length > 0 && (
              <div className="mt-6 p-4 rounded-2xl bg-ios-blue/5 border border-ios-blue/10 dark:bg-blue-500/10 dark:border-blue-500/20">
                <span className="text-sm font-bold text-ios-blue dark:text-[#0A84FF] block mb-2">注意事项</span>
                <ul className="pl-4 space-y-1 list-disc text-gray-500 text-[13px] dark:text-white/30">
                  {config.notes.map((note, index) => (
                    <li key={index} dangerouslySetInnerHTML={{ __html: note }} />
                  ))}
                </ul>
              </div>
            )}
          </div>
        );
      case 1:
        return (
          <div className="space-y-6">
            <Dragger
              fileList={fileList}
              beforeUpload={handleBeforeUpload}
              onRemove={() => {
                setFileList([]);
                setWorkbook(null);
                setSheetNames([]);
                setSelectedSheet(null);
                setSheetValidationError(null);
              }}
              maxCount={1}
              className="bg-white border-dashed rounded-[20px] hover:border-ios-blue transition-colors dark:bg-white/5 dark:border-white/10 py-8"
            >
              <p className="ant-upload-drag-icon text-ios-blue mb-4">
                <CloudUploadOutlined />
              </p>
              <p className="ant-upload-text text-base dark:text-white/95">点击上传数据文件</p>
              <p className="ant-upload-hint text-[13px] text-gray-400 px-6 py-2">
                仅支持 .xls, .xlsx 格式文件
              </p>
            </Dragger>

            {sheetNames.length > 0 && (
              <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="flex items-center justify-between px-1">
                  <Text strong className="text-base dark:text-white/95">选择工作表 (Sheet)</Text>
                  <Tag color="success" className="rounded-full px-2 border-none bg-green-500/10 text-green-500">
                    已读到 {sheetNames.length} 个
                  </Tag>
                </div>
                <div className="bg-gray-100/50 p-2 rounded-2xl dark:bg-white/5">
                  <Select
                    autoFocus
                    className="w-full apple-select h-[44px]"
                    placeholder="请选择 Sheet"
                    value={selectedSheet}
                    onChange={setSelectedSheet}
                    options={sheetNames.map(name => ({ label: name, value: name }))}
                  />
                </div>
              </div>
            )}
            
            {sheetValidationError && (
              <Alert
                className="rounded-2xl dark:bg-red-500/10 dark:border-red-500/20"
                type="error"
                showIcon
                message={<span className="font-bold dark:text-red-400">工作表校验未通过</span>}
                description={<span className="text-[13px] dark:text-red-400/80">{sheetValidationError}</span>}
              />
            )}
          </div>
        );
      case 2: {
        const sortedHeaders = [...headers].sort((a, b) => {
          const reqA = Boolean(mapping[a] && config.requiredFields.includes(mapping[a]));
          const reqB = Boolean(mapping[b] && config.requiredFields.includes(mapping[b]));
          return (reqA === reqB) ? 0 : reqA ? -1 : 1;
        });

        const toggleExpand = (header: string) => {
          const newSet = new Set(expandedFields);
          if (newSet.has(header)) newSet.delete(header);
          else newSet.add(header);
          setExpandedFields(newSet);
        };

        return (
          <div className="space-y-4">
            <div className="px-1">
              <Text strong className="text-[17px] dark:text-white/95">字段映射</Text>
            </div>

            <Card 
              variant="borderless" 
              className="rounded-2xl bg-white dark:bg-[#1C1C1E] border border-gray-100 dark:border-white/5 shadow-sm overflow-hidden" 
              bodyStyle={{ padding: '0 16px' }}
            >
              {sortedHeaders.map((header, idx) => {
                const mappedKey = mapping[header];
                const field = config.fields.find(f => f.key === mappedKey);
                const isExpanded = expandedFields.has(header);
                const isMissing = !mappedKey && config.requiredFields.some(rk => config.fields.find(f => f.key === rk)?.label === header);

                return (
                  <div key={idx} className={`py-4 ${idx !== sortedHeaders.length - 1 ? 'border-b border-gray-50 dark:border-white/5' : ''}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-1 min-w-[35%]">
                        <Text className="text-[15px] dark:text-white/95">{header}</Text>
                        {config.requiredFields.some(rk => config.fields.find(f => f.key === rk)?.label === header) && (
                          <span className="text-red-500 font-bold ml-0.5">*</span>
                        )}
                      </div>
                      
                      <div className="flex-1 flex items-center gap-2">
                        <Select
                          size="middle"
                          className={`w-full apple-select h-[40px] text-sm ${isMissing ? 'border border-red-500/50 rounded-xl' : ''}`}
                          placeholder="选择目标字段"
                          allowClear
                          value={mappedKey}
                          onChange={(val) => {
                            if (val === undefined || val === null || val === '') {
                              setMapping(prev => {
                                const next = { ...prev };
                                delete next[header];
                                return next;
                              });
                            } else {
                              setMapping(prev => ({ ...prev, [header]: val }));
                            }
                          }}



                          options={config.fields.map((field) => ({
                            label:
                              field.label +
                              (config.requiredFields.includes(field.key) ? ' *' : ''),
                            value: field.key,
                            disabled:
                              Object.values(mapping).includes(field.key) &&
                              mapping[header] !== field.key,
                          }))}
                        />
                        <Button 
                          type="text" 
                          size="small"
                          icon={<InfoCircleOutlined className={`text-sm transition-colors ${isExpanded ? 'text-ios-blue' : 'text-gray-300'}`} />}
                          onClick={() => toggleExpand(header)}
                          className="p-1 min-w-0"
                        />
                      </div>
                    </div>

                    {(isExpanded || isMissing) && (
                      <div className="mt-2 pl-1 animate-in fade-in slide-in-from-top-1 duration-200">
                        {isMissing && (
                          <div className="flex items-center gap-1.5 mb-1 text-red-500 text-[12px] font-medium">
                            <WarningOutlined style={{ fontSize: '12px' }} />
                            <span>需匹配此字段</span>
                          </div>
                        )}
                        {field?.description && (
                          <Text type="secondary" className="text-[12px] opacity-60 dark:text-white/40 block">
                            含义: {field.description}
                          </Text>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </Card>

            {mappingStats.requiredMissCount > 0 && (
              <div className="mx-1 p-3 bg-red-50/50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 rounded-xl flex items-center gap-2">
                <ExclamationCircleOutlined className="text-red-500 text-sm" />
                <span className="text-[13px] text-red-600 dark:text-red-400">请将所有必填字段映射到目标字段</span>
              </div>
            )}
          </div>
        );
      }
      case 3:
        return (
          <div className="space-y-4">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Progress type="circle" percent={45} size={40} strokeColor={accentColor} />
                <Text className="mt-4 text-gray-500 dark:text-white/60">正在深入解析逻辑...</Text>
              </div>
            ) : previewResult ? (
              <div className="space-y-6">
                <div className="bg-gray-100/50 p-1.5 rounded-2xl dark:bg-white/5">
                  <Segmented
                    block
                    value={issueFilter}
                    onChange={setIssueFilter}
                    options={[
                      { label: `全部 (${previewIssues.length})`, value: 'all' },
                      { label: `需修复 (${issueTypeCounts.A + issueTypeCounts.B})`, value: 'AB' },
                      { label: `冲突 (${issueTypeCounts.C})`, value: 'C' },
                    ]}
                    className="apple-segmented"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3 px-1">
                  <div className="p-4 rounded-2xl bg-green-50/50 border border-green-100/50 dark:bg-green-500/10 dark:border-green-500/20">
                    <div className="text-[11px] text-green-600/60 dark:text-green-400/60 mb-1">可导入行</div>
                    <div className="text-xl font-bold text-green-600 dark:text-green-400">{previewResult.importableRowCount}</div>
                  </div>
                  <div className="p-4 rounded-2xl bg-red-50/50 border border-red-100/50 dark:bg-red-500/10 dark:border-red-500/20">
                    <div className="text-[11px] text-red-600/60 dark:text-red-400/60 mb-1">问题行</div>
                    <div className="text-xl font-bold text-red-600 dark:text-red-400">{previewResult.errorRowCount}</div>
                  </div>
                </div>

                <div className="space-y-4 pb-10">
                  {groupedIssueEntries.map(({ type, groups }) => (
                    <div key={type} className="space-y-2">
                        <div className="px-1 text-[11px] font-bold text-gray-400 dark:text-white/20 uppercase tracking-wider">
                          {type === 'A' ? '格式错误' : type === 'B' ? '业务逻辑' : '数据冲突'}
                        </div>
                        <Collapse 
                          ghost 
                          className="mobile-collapse space-y-2"
                          expandIconPosition="end"
                        >
                          {groups.map((group, idx) => (
                            <Collapse.Panel 
                              key={`${type}-${idx}`}
                              header={
                                <div className="flex flex-col">
                                  <div className="flex items-center gap-2">
                                    <span className="text-red-500 dark:text-red-400 font-bold">!</span>
                                    <span className="text-[15px] font-medium dark:text-white/95">{group.summary}</span>
                                  </div>
                                  <Text type="secondary" className="text-[11px] ml-3 dark:text-white/40">{group.count} 行影响</Text>
                                </div>
                              }
                              className="bg-white rounded-[18px] dark:bg-[#1C1C1E] shadow-sm border border-gray-100 dark:border-white/5"
                            >
                              <div className="pl-3 pb-2 space-y-3">
                                <div className="p-3 rounded-xl bg-blue-50/50 text-[12px] text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 border border-blue-100/50 dark:border-blue-500/20">
                                  <b>修复建议:</b> {group.suggestion}
                                </div>
                                <div className="space-y-1">
                                  {group.items.slice(0, 10).map((item, iIdx) => (
                                    <div key={iIdx} className="flex gap-2 text-[12px] dark:text-white/60">
                                      <span className="font-mono text-gray-300 dark:text-white/20">#{item.rowNo}</span>
                                      <span>{item.reason}</span>
                                    </div>
                                  ))}
                                  {group.items.length > 10 && <div className="text-[10px] text-center py-2 text-gray-300">...</div>}
                                </div>
                              </div>
                            </Collapse.Panel>
                          ))}
                        </Collapse>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        );
      case 4:
        return (
          <div className="space-y-6">
            <Paragraph className="text-gray-500 dark:text-white/40 text-[13px] px-1">
              当导入的数据在系统中已存在（基于唯一键匹配）时，请选择触达逻辑：
            </Paragraph>
            
            <div className="space-y-4">
              {strategyOptions.map(opt => (
                <div 
                  key={opt.key}
                  onClick={() => setStrategy(opt.key)}
                  className={`p-5 rounded-[22px] border-2 transition-all active:scale-[0.98] ${
                    strategy === opt.key 
                      ? 'border-ios-blue bg-blue-50/5 dark:border-[#0A84FF] dark:bg-[#0A84FF]/10' 
                      : 'border-gray-100 bg-white dark:bg-[#1C1C1E] dark:border-white/10'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                      strategy === opt.key ? 'bg-ios-blue text-white' : 'bg-gray-100 text-gray-400 dark:bg-white/5'
                    }`}>
                      {opt.icon}
                    </div>
                    <div className="flex-1">
                      <div className={`text-base font-bold ${strategy === opt.key ? 'text-ios-blue dark:text-[#0A84FF]' : 'dark:text-white/95'}`}>
                        {opt.title}
                      </div>
                      <div className="text-[12px] text-gray-400 dark:text-white/30">{opt.desc}</div>
                    </div>
                    {strategy === opt.key && <CheckCircleFilled className="text-ios-blue dark:text-[#0A84FF] text-xl" />}
                  </div>
                </div>
              ))}
            </div>

            {loading && (
              <div className="pt-10 animate-in fade-in slide-in-from-bottom-5">
                <div className="flex justify-between items-center mb-2 px-1">
                  <Text className="text-sm font-medium dark:text-white/95">正在执行导入工作...</Text>
                  <Text className="text-sm font-mono text-gray-400 dark:text-white/30">{importProgress}%</Text>
                </div>
                <Progress 
                  percent={importProgress} 
                  showInfo={false} 
                  strokeColor={accentColor}
                  className="rounded-full overflow-hidden"
                  strokeWidth={8}
                />
              </div>
            )}
          </div>
        );
      case 5:
        return (
          <div className="space-y-6 animate-in zoom-in-95 duration-500">
            <div className="flex flex-col items-center py-6">
              <div className="w-20 h-20 rounded-full bg-green-50 flex items-center justify-center mb-4 dark:bg-green-500/10">
                <CheckCircleFilled className="text-5xl text-green-500" />
              </div>
              <Title level={3} className="m-0 dark:text-white/95">导入任务已完成</Title>
              <Text type="secondary" className="mt-1 dark:text-white/40">数据处理结果如下</Text>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Card variant="borderless" className="bg-gray-50/50 dark:bg-white/5 rounded-2xl p-0" bodyStyle={{ padding: '20px' }}>
                <div className="text-[11px] text-gray-400 mb-1">总处理行数</div>
                <div className="text-2xl font-bold dark:text-white/95">{executeSummary.totalCount}</div>
              </Card>
              <Card variant="borderless" className="bg-green-50/50 dark:bg-green-500/5 rounded-2xl p-0" bodyStyle={{ padding: '20px' }}>
                <div className="text-[11px] text-green-600/60 dark:text-green-400/60 mb-1">成功导入</div>
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">{executeSummary.successCount}</div>
              </Card>
            </div>

            <div className="space-y-3">
              <div 
                onClick={() => canDownloadFailedRows && handleDownloadFailedRows()}
                className={`flex items-center p-4 rounded-2xl border ${
                  canDownloadFailedRows ? 'bg-white dark:bg-[#1C1C1E] border-gray-100 dark:border-white/10' : 'opacity-40 border-dashed dark:border-white/5'
                }`}
              >
                <DownloadOutlined className="text-xl text-gray-400 mr-4" />
                <div className="flex-1">
                  <Text strong className="block dark:text-white/95">下载失败行明细</Text>
                  <Text type="secondary" className="text-[11px] dark:text-white/40">包含报错原因，修正后可重新导入</Text>
                </div>
                <Badge count={executeSummary.failedCount} style={{ backgroundColor: '#FF3B30' }} />
              </div>

              <div 
                onClick={() => canDownloadErrorReport && handleDownloadErrorReport()}
                className={`flex items-center p-4 rounded-2xl border ${
                  canDownloadErrorReport ? 'bg-white dark:bg-[#1C1C1E] border-gray-100 dark:border-white/10' : 'opacity-40 border-dashed dark:border-white/5'
                }`}
              >
                <FileExcelOutlined className="text-xl text-gray-400 mr-4" />
                <div className="flex-1">
                  <Text strong className="block dark:text-white/95">异常汇总报告</Text>
                  <Text type="secondary" className="text-[11px] dark:text-white/40">聚合后的错误分布情况</Text>
                </div>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  const renderMobileWizard = () => {
    const primaryAction = getPrimaryAction;

    return (
      <Drawer
        open={open}
        onClose={onClose}
        placement="bottom"
        height="100%"
        closable={false}
        styles={{ 
          body: { padding: 0, backgroundColor: isDarkMode ? '#1C1C1E' : '#fafafa', overflow: 'hidden' },
          mask: { backdropFilter: 'blur(10px)' }
        }}
        className={`mobile-import-drawer ${isDarkMode ? 'dark' : ''}`}
      >
        <ConfigProvider
          theme={{
            algorithm: isDarkMode ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
            token: { colorPrimary: accentColor }
          }}
        >
          <div className="flex flex-col h-full overflow-hidden text-[#1C1C1E] dark:text-white/95">
            {/* Header */}
            <div className="shrink-0 pt-[env(safe-area-inset-top,20px)] bg-white/80 dark:bg-black/80 backdrop-blur-xl border-b border-gray-100/10 dark:border-white/5 z-10">
              <div className="px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {current > 0 && current < 5 ? (
                    <div 
                      onClick={handlePrev}
                      className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-100 dark:bg-white/10 active:scale-90 transition-transform"
                    >
                      <LeftOutlined style={{ fontSize: '14px' }} />
                    </div>
                  ) : (
                    <div 
                      onClick={onClose}
                      className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-100 dark:bg-white/10 active:scale-90 transition-transform"
                    >
                      <CloseOutlined style={{ fontSize: '14px' }} />
                    </div>
                  )}
                  <div className="flex flex-col">
                    <span className="text-[17px] font-bold tracking-tight leading-tight">{config?.title || '数据导入'}</span>
                    <span className="text-[11px] opacity-40 uppercase tracking-widest leading-tight">{steps[current].title} · 第 {current + 1}/{steps.length} 步</span>
                  </div>
                </div>
                {current === 2 && (
                  <Button 
                    type="text" 
                    icon={<MagicWandIcon />} 
                    className="text-ios-blue dark:text-[#0A84FF] active:scale-90 transition-transform" 
                    onClick={handleReAutoMatch}
                  />
                )}
              </div>
              <div className="px-5 pb-1">
                <Progress 
                  percent={(current + 1) / steps.length * 100} 
                  showInfo={false} 
                  strokeWidth={2} 
                  strokeColor={accentColor}
                  className="m-0"
                />
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto px-5 py-4 custom-scrollbar">
              {renderMobileStepContent()}
            </div>

            {/* Sticky Footer */}
            <div className="shrink-0 p-4 bg-white/80 dark:bg-black/80 backdrop-blur-xl border-t border-gray-100/10 dark:border-white/5 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
              <div className="flex flex-col gap-3">
                {primaryAction && (
                  <Button 
                    type="primary" 
                    size="large"
                    block
                    onClick={primaryAction.onClick}
                    loading={primaryAction.loading}
                    disabled={primaryAction.disabled}
                    className="rounded-[14px] h-[50px] text-base font-bold shadow-xl shadow-blue-500/20 active:scale-[0.98] transition-all border-none"
                    style={{ background: primaryAction.disabled ? undefined : accentColor }}
                  >
                    {primaryAction.text}
                  </Button>
                )}
                {current === 5 && (
                  <Button 
                    block 
                    size="large" 
                    onClick={handleReset}
                    className="rounded-[14px] h-[48px] bg-gray-100 dark:bg-white/5 dark:text-white/60 border-none active:scale-[0.98]"
                  >
                    再次导入新文件
                  </Button>
                )}
              </div>
            </div>
          </div>
        </ConfigProvider>
        
        <style>{`
          .mobile-import-drawer .ant-drawer-content {
            border-radius: 24px 24px 0 0 !important;
            overflow: hidden;
          }
          .mobile-collapse .ant-collapse-item {
            border-bottom: 0 !important;
          }
          .mobile-collapse .ant-collapse-header {
            padding: 16px !important;
            align-items: center !important;
          }
          .apple-select .ant-select-selector {
            border-radius: 12px !important;
            border: none !important;
            background: rgba(0,0,0,0.05) !important;
          }
          .dark .apple-select .ant-select-selector {
            background: rgba(255,255,255,0.08) !important;
            color: rgba(255,255,255,0.9) !important;
          }
          .apple-segmented {
            background: transparent !important;
          }
          .apple-segmented .ant-segmented-item-selected {
            border-radius: 8px !important;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1) !important;
          }
          .dark .apple-segmented .ant-segmented-item-selected {
            background: rgba(255,255,255,0.15) !important;
          }
        `}</style>
      </Drawer>
    );
  };

  const renderStepContent = () => {
    switch (current) {
      case 0:
        return (
          <div className="py-4">
            <Card variant="borderless" className="bg-gray-50/50 border border-gray-100 rounded-xl dark:bg-[#2C2C2E] dark:border-white/10">
              <Space direction="vertical" className="w-full">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center dark:bg-blue-500/10">
                      <FileExcelOutlined className="text-blue-500 text-xl dark:text-[#0A84FF]" />
                    </div>
                    <div>
                      <Text strong className="dark:text-white/95">{config?.template?.emptyTemplateName || '导入模板.xlsx'}</Text>
                      <br />
                      <Text type="secondary" className="dark:text-white/60">标准空模板，包含所有必填列头</Text>
                    </div>
                  </div>
                  <Button 
                    type="default"
                    size="middle"
                    icon={<DownloadOutlined />} 
                    className="h-9 px-5 rounded-full min-w-[104px] border-gray-200 hover:border-gray-300 dark:border-white/20 dark:text-white/60 dark:hover:border-white/30 dark:hover:bg-white/5"
                    onClick={() => handleDownloadTemplate('empty')}
                  >
                    下载空模板
                  </Button>
                </div>
                <Divider className="my-2 dark:border-white/5" />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center dark:bg-green-500/10">
                      <InfoCircleOutlined className="text-green-500 text-xl" />
                    </div>
                    <div>
                      <Text strong className="dark:text-white/95">{config?.template?.sampleTemplateName || '示例模板.xlsx'}</Text>
                      <br />
                      <Text type="secondary" className="dark:text-white/60">包含演示数据，帮助您快速理解填写规范</Text>
                    </div>
                  </div>
                  <Button 
                    type="default"
                    size="middle"
                    icon={<DownloadOutlined />}
                    className="h-9 px-5 rounded-full min-w-[104px] border-gray-200 hover:border-gray-300 dark:border-white/20 dark:text-white/60 dark:hover:border-white/30 dark:hover:bg-white/5"
                    onClick={() => handleDownloadTemplate('sample')}
                  >
                    示例模板
                  </Button>
                </div>
              </Space>
            </Card>
            {/* 注意事项由 config.notes 驱动 */}
            {config?.notes && config.notes.length > 0 && (
              <Alert
                className="mt-6 rounded-lg dark:bg-blue-500/10 dark:border-blue-500/20"
                message={<span className="dark:text-blue-400">注意事项</span>}
                description={
                  <ul className="pl-4 mb-0 list-disc text-gray-500 text-sm dark:text-white/30">
                    {config.notes.map((note, index) => (
                      <li key={index} dangerouslySetInnerHTML={{ __html: note }} />
                    ))}
                  </ul>
                }
                type="info"
                showIcon
              />
            )}
          </div>
        );
      case 1:
        return (
          <div className="py-4">
            {/* <Title level={5} className="mb-4">第二步：上传数据文件</Title> */}
            <Dragger
              fileList={fileList}
              beforeUpload={handleBeforeUpload}
              onRemove={() => {
                setFileList([]);
                setWorkbook(null);
                setSheetNames([]);
                setSelectedSheet(null);
                setSheetValidationError(null);
              }}
              maxCount={1}
              className="bg-white border-dashed rounded-2xl hover:border-blue-400 transition-colors dark:bg-white/5 dark:border-white/10"
            >
              <p className="ant-upload-drag-icon text-ios-blue">
                <InboxOutlined />
              </p>
              <p className="ant-upload-text">点击或将文件拖拽到此区域上传</p>
              <p className="ant-upload-hint text-gray-400 px-4">
                仅支持 .xls, .xlsx 格式文件。解析成功后请在下方选择对应的工作表。
              </p>
            </Dragger>

            {sheetNames.length > 0 && (
              <div className="mt-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <Text strong className="block mb-2">
                  选择工作表 (Workbook Sheet) <Text type="danger">*</Text>
                </Text>
                <Select
                  className="w-full"
                  placeholder="请选择 Sheet"
                  value={selectedSheet}
                  onChange={setSelectedSheet}
                  options={sheetNames.map(name => ({ label: name, value: name }))}
                />
                <Text type="secondary" className="text-xs mt-2 block">
                  <CheckCircleOutlined className="text-green-500 mr-1" />
                  已识别到 {sheetNames.length} 个工作表，请确保选择包含导入数据的 Sheet。
                </Text>
              </div>
            )}
            {sheetValidationError && (
              <Alert
                className="mt-4 rounded-lg"
                type="error"
                showIcon
                message="工作表校验未通过"
                description={sheetValidationError}
              />
            )}
          </div>
        );
      case 2: {
        // 计算必填字段和可选字段
        const requiredFieldKeys = config?.requiredFields || [];
        const sortedHeaders = [...headers].sort((a, b) => {
          const aIsRequired = requiredFieldKeys.includes(mapping[a]);
          const bIsRequired = requiredFieldKeys.includes(mapping[b]);
          if (aIsRequired && !bIsRequired) return -1;
          if (!aIsRequired && bIsRequired) return 1;
          return 0;
        });
        
        return (
          <div className="py-2">
            {/* 映射状态行 + 次操作按钮 */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Title level={5} className="mb-0">字段映射</Title>
                {/* <Space size={4}>
                  <Tag color="blue" className="text-[11px]">
                    自动匹配 {mappingStats.autoMatchCount} 项
                  </Tag>
                  <Tag color={mappingStats.isComplete ? 'green' : 'gold'} className="text-[11px]">
                    已映射 {mappingStats.mappedCount}/{mappingStats.totalFields}
                  </Tag>
                  {mappingStats.requiredMissCount > 0 && (
                    <Tag color="red" className="text-[11px]">
                      必填缺失 {mappingStats.requiredMissCount}
                    </Tag>
                  )}
                </Space> */}
              </div>
              <Space size={8}>
                <Button 
                  size="small" 
                  icon={<ReloadOutlined />}
                  onClick={handleReAutoMatch}
                  className="text-xs rounded-full border-gray-200 hover:border-ios-blue hover:text-ios-blue"
                >
                  重新匹配
                </Button>
                <Button 
                  size="small" 
                  icon={<ClearOutlined />}
                  onClick={handleResetMapping}
                  className="text-xs rounded-full border-gray-200 hover:border-gray-400"
                >
                  重置
                </Button>
              </Space>
            </div>
            
            {/* 映射表格 */}
            <div className="bg-gray-50/50 border border-gray-100 rounded-xl overflow-hidden dark:bg-[#2C2C2E] dark:border-white/10">
              {/* 表头区 */}
              <div className="flex items-center bg-white border-b border-gray-100 px-4 py-2.5 dark:bg-[#1C1C1E] dark:border-white/10">
                <div className="w-[35%] text-[11px] font-semibold text-gray-400 uppercase tracking-wider dark:text-white/30">
                  Excel 来源列
                </div>
                <div className="w-[45%] text-[11px] font-semibold text-gray-400 uppercase tracking-wider dark:text-white/30">
                  系统目标字段
                </div>
                <div className="w-[20%] text-[11px] font-semibold text-gray-400 uppercase tracking-wider text-center dark:text-white/30">
                  含义及校验
                </div>
              </div>
              
              {/* 映射行列表 */}
              <div className="max-h-[340px] overflow-y-auto bg-white dark:bg-[#1C1C1E]">
                {sortedHeaders.map((header, idx) => {
                  const mappedFieldKey = mapping[header];
                  const field = config.fields.find(f => f.key === mappedFieldKey);
                  const isRequired = field && requiredFieldKeys.includes(field.key);
                  
                  return (
                    <div 
                      key={idx} 
                      className={`flex items-center px-4 py-2.5 border-b border-gray-50 hover:bg-gray-50/60 transition-colors dark:border-white/5 dark:hover:bg-white/5 ${isRequired ? 'bg-blue-50/20 dark:bg-[#0A84FF]/5' : ''}`}
                    >
                      {/* Excel 来源列 */}
                      <div className="w-[35%] flex items-center gap-2">
                        <Text strong className="text-[13px] dark:text-white/95">{header}</Text>
                      </div>
                      
                      {/* 系统目标字段 */}
                      <div className="w-[45%] pr-4">
                        <Select
                          size="small"
                          className="w-full apple-select"
                          placeholder="选择目标字段"
                          allowClear
                          value={mappedFieldKey}
                          onChange={(val) => {
                            if (val === undefined || val === null || val === '') {
                              setMapping(prev => {
                                const next = { ...prev };
                                delete next[header];
                                return next;
                              });
                            } else {
                              setMapping(prev => ({ ...prev, [header]: val }));
                            }
                          }}




                          options={buildFieldOptions(header)}
                        />
                      </div>
                      
                      {/* 含义及校验：Info 图标 + Popover */}
                      <div className="w-[20%] flex justify-center">
                        {field ? (
                          <Popover
                            trigger="hover"
                            placement="left"
                            content={
                              <div className="max-w-[240px]">
                                <div className="font-semibold text-sm mb-1 flex items-center gap-1">
                                  {field.label}
                                  {isRequired && <Tag color="red" className="text-[10px] ml-1">必填</Tag>}
                                </div>
                                <Text className="text-xs text-gray-500 block">{field.description}</Text>
                                {formatFieldValidation(field) && (
                                  <div className="mt-2 pt-2 border-t border-gray-100">
                                    <Text className="text-[10px] text-gray-400">
                                      校验规则: {formatFieldValidation(field)}
                                    </Text>
                                  </div>
                                )}
                              </div>
                            }
                          >
                            <span className={`cursor-pointer flex items-center gap-1 ${isRequired ? 'text-ios-blue' : 'text-gray-400'}`}>
                              {isRequired ? (
                                <ExclamationCircleOutlined className="text-sm" />
                              ) : (
                                <InfoCircleOutlined className="text-sm" />
                              )}
                              {isRequired && <span className="text-[10px]">必填</span>}
                            </span>
                          </Popover>
                        ) : (
                          <Tooltip title="未映射，该列数据将被忽略">
                            <span className="text-gray-300 cursor-help">
                              <QuestionCircleOutlined className="text-sm" />
                            </span>
                          </Tooltip>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            
            {/* 底部提示 */}
            {mappingStats.requiredMissCount > 0 && (
              <Alert
                type="warning"
                showIcon
                icon={<WarningOutlined />}
                message={`还有 ${mappingStats.requiredMissCount} 个必填字段未映射`}
                className="mt-4 rounded-lg border-yellow-100"
              />
            )}
          </div>
        );
      }
      case 3:
        return (
          <div className="py-2 h-full flex flex-col">


            {loading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-ios-blue mb-4"></div>
                <Text type="secondary">正在解析数据逻辑，请稍候...</Text>
              </div>
            ) : previewResult ? (
              <div className="space-y-4 flex-1 flex flex-col min-h-0">
                {/* 统计筛选区：Segmented 样式 */}
                <div className="flex items-center justify-between mb-2">
                  <Segmented
                    value={issueFilter}
                    onChange={setIssueFilter}
                    options={[
                      { label: `全部 (${previewIssues.length})`, value: 'all' },
                      { label: `需修复 (${issueTypeCounts.A + issueTypeCounts.B})`, value: 'AB' },
                      { label: `数据冲突 (${issueTypeCounts.C})`, value: 'C' },
                    ]}
                    className="p-1 bg-gray-100/50 rounded-lg apple-segmented dark:bg-white/5"
                  />
                  <div className="flex items-center justify-between">
                    {/* <Title level={5} className="m-0">第四步：逻辑预检发现 {previewIssues.length} 个问题</Title> */}
                    <Space size={8}>
                      {hasErrorRows && (
                        <Button 
                          size="small"
                          onClick={handleDownloadErrorRows}
                          icon={<DownloadOutlined className="text-[10px]" />}
                          className="rounded-full text-[11px] h-7 px-3 border-gray-200"
                        >
                          下载错误行
                        </Button>
                      )}
                      {previewIssues.length > 0 && (
                        <Button 
                          size="small"
                          onClick={handleDownloadErrorReport}
                          icon={<FileExcelOutlined className="text-[10px]" />}
                          className="rounded-full text-[11px] h-7 px-3 border-gray-200"
                        >
                          异常分析报告
                        </Button>
                      )}
                    </Space>
                  </div>
                </div>

                {/* 预处理提示 */}
                {previewResult._preprocessStats && previewResult._preprocessStats.coercedCells > 0 && (
                  <div className="bg-blue-50/50 px-4 py-2 rounded-xl flex items-start gap-2 border border-blue-100/50 dark:bg-blue-500/10 dark:border-blue-500/20">
                    <InfoCircleOutlined className="mt-1 text-blue-500 text-xs dark:text-[#0A84FF]" />
                    <div className="text-[11px] text-blue-700 leading-normal dark:text-blue-400">
                      已自动规范化 <b>{previewResult._preprocessStats.coercedCells}</b> 个单元格格式（数字↔文本）。提示：编码类字段建议在 Excel 中设为“文本”格式以保留前导 0。
                    </div>
                  </div>
                )}
                
                {/* 问题分组展示 */}
                <div className="flex-1 overflow-y-auto min-h-0 space-y-4 pr-1">
                  {groupedIssueEntries.map(({ type, groups }) => (
                      <div key={type} className="group-container">
                        <div className="flex items-center gap-2 mb-2 px-1">
                          <Badge 
                            status={type === 'C' ? 'warning' : 'error'} 
                            className="scale-75"
                          />
                          <span className="text-xs font-bold text-gray-500 dark:text-white/30">
                            {type === 'A' ? '格式性错误' : type === 'B' ? '业务逻辑校验' : '基础冲突'}
                            <span className="ml-1 font-normal opacity-50">({groups.length} 种)</span>
                          </span>
                        </div>
                        
                        <Collapse 
                          ghost 
                          size="small"
                          className="issue-collapse"
                          expandIcon={({ isActive }) => <ArrowRightOutlined rotate={isActive ? 90 : 0} className="text-[10px] text-gray-300" />}
                        >
                          {groups.map((group, idx) => (
                            <Collapse.Panel 
                              key={`${type}-${idx}`}
                              header={
                                <div className="flex items-center justify-between w-full">
                                  <div className="flex items-center gap-4 flex-1">
                                    <span className="bg-gray-100 text-gray-500 text-[10px] font-mono px-1.5 py-0.5 rounded border border-gray-200 dark:bg-white/10 dark:border-white/10 dark:text-white/60">
                                      {group.errorCode}
                                    </span>
                                    <span className="text-[13px] font-medium text-gray-700 dark:text-white/95">{group.summary}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Text type="secondary" className="text-[11px] dark:text-white/60">{group.count} 行受影响</Text>
                                  </div>
                                </div>
                              }
                              className="mb-2 bg-white border border-gray-100 rounded-xl overflow-hidden transition-all hover:border-gray-200 dark:bg-[#2C2C2E] dark:border-white/10 dark:hover:border-white/20"
                            >
                              <div className="pl-6 pr-2 py-2 pb-4">
                                {/* 通用建议 */}
                                <div className="flex items-start gap-2 mb-4 bg-blue-50/40 p-3 rounded-lg border border-blue-50 dark:bg-blue-500/10 dark:border-blue-500/20">
                                  <span className="text-[10px] text-white bg-blue-400 px-1.5 py-0.5 rounded-sm shrink-0">修复建议</span>
                                  <span className="text-[12px] text-blue-800 leading-tight dark:text-blue-400">{group.suggestion}</span>
                                </div>
                                
                                {/* 逐行明细 */}
                                <div className="space-y-1.5 max-h-[260px] overflow-y-auto pr-2 custom-scrollbar">
                                  {group.items.map((item, itemIdx) => (
                                    <div key={itemIdx} className="flex items-start gap-3 group/item">
                                      <div className="w-12 shrink-0 flex items-center gap-1.5">
                                        <Text type="secondary" className="text-[10px] opacity-40 dark:text-white/30">#{itemIdx + 1}</Text>
                                        <span className="bg-gray-50 text-gray-400 px-1.5 py-0.5 rounded text-[10px] font-mono border border-gray-100 group-hover/item:border-gray-300 group-hover/item:text-gray-600 transition-colors dark:bg-white/5 dark:border-white/10 dark:text-white/30">
                                          {item.rowNo}
                                        </span>
                                      </div>
                                      <span className="text-[12px] text-gray-500 py-0.5 break-all dark:text-white/60">{item.reason}</span>
                                    </div>
                                  ))}
                                  {group.items.length > 20 && (
                                    <div className="pt-2 text-center">
                                      <Text type="secondary" className="text-[10px]">仅展示前 {group.items.length} 条明细</Text>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </Collapse.Panel>
                          ))}
                        </Collapse>
                      </div>
                  ))}
                  
                  {previewIssues.length === 0 && (
                    <div className="py-20 flex flex-col items-center justify-center grayscale opacity-30">
                      <div className="w-16 h-10 bg-green-50 rounded-full flex items-center justify-center mb-4">
                        <CheckCircleOutlined className="text-3xl text-green-500" />
                      </div>
                      <Text strong className="text-gray-900">检查通过</Text>
                      <Text className="text-[11px] mt-1">您可以放心执行后续操作</Text>
                    </div>
                  )}
                </div>

                {/* 底部最终提醒 */}
                {hasErrorRows && canContinueImport && (
                  <div className="mt-auto px-4 py-3 bg-orange-50/30 rounded-2xl border border-orange-100/50 flex items-center justify-between dark:bg-orange-500/10 dark:border-orange-500/20">
                    <div className="flex items-center gap-2">
                      <WarningOutlined className="text-orange-500 text-sm" />
                      <span className="text-xs text-orange-700 dark:text-orange-400">其中 <b>{errorRowCount}</b> 行需修复，剩余 <b>{importableRowCount}</b> 行可先行导入。</span>
                    </div>
                    <Text className="text-[10px] text-orange-400 cursor-pointer hover:underline dark:text-orange-500" onClick={handleDownloadErrorRows}>获取修复清单</Text>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 opacity-30">
                <Text>等待数据解析...</Text>
              </div>
            )}
          </div>
        );
      case 4:
        return (
          <div className="py-4 h-full flex flex-col">
            {/* <div className="flex items-center justify-between mb-2">
              <Title level={5} className="m-0">第五步：冲突处理与补齐</Title>
            </div> */}
            <Paragraph className="text-gray-400 mb-8 text-[13px] dark:text-white/30">
              当导入的数据在系统中已存在（基于唯一键匹配）时，请选择执行策略。
            </Paragraph>
            
            <div className="grid grid-cols-2 gap-6 mb-8">
              {strategyOptions.map(opt => (
                <Popover key={opt.key} placement="bottom" content={<div className="max-w-[200px] text-xs text-gray-500">{opt.detail}</div>}>
                  <div 
                    onClick={() => setStrategy(opt.key)}
                    className={`relative p-6 rounded-2xl border-2 transition-all cursor-pointer group hover:shadow-md dark:hover:shadow-none ${
                      strategy === opt.key 
                        ? 'border-ios-blue bg-blue-50/5 ring-1 ring-ios-blue/20 dark:border-[#0A84FF] dark:bg-[#0A84FF]/10 dark:ring-[#0A84FF]/30' 
                        : 'border-gray-100 bg-white hover:border-gray-200 dark:bg-[#2C2C2E] dark:border-white/10 dark:hover:border-white/20'
                    }`}
                  >
                    <div className={`mb-4 w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
                      strategy === opt.key ? 'bg-ios-blue text-white dark:bg-[#0A84FF]' : 'bg-gray-50 text-gray-400 group-hover:bg-gray-100 dark:bg-white/10 dark:text-white/30'
                    }`}>
                      {opt.icon}
                    </div>
                    <div className="space-y-1">
                      <div className={`text-[15px] font-bold ${strategy === opt.key ? 'text-ios-blue dark:text-[#0A84FF]' : 'text-gray-900 dark:text-white/95'}`}>
                        {opt.title}
                      </div>
                      <div className="text-[12px] text-gray-400 leading-snug dark:text-white/30">
                        {opt.desc}
                      </div>
                    </div>
                    {strategy === opt.key && (
                      <div className="absolute top-4 right-4 text-ios-blue">
                        <CheckCircleOutlined />
                      </div>
                    )}
                  </div>
                </Popover>
              ))}
            </div>

            {/* 导入进度展示区：仅在点击开始导入后显示 */}
            {loading && current === 4 && (
              <div className="mt-auto animate-in fade-in slide-in-from-bottom-2 duration-500">
                <div className="flex justify-between items-end mb-2">
                  <Text className="text-[15px] font-medium text-gray-900 dark:text-white/95">正在导入...</Text>
                  <Text className="text-[13px] font-mono text-gray-400 dark:text-white/60">{importProgress}%</Text>
                </div>
                <Progress 
                  percent={importProgress} 
                  showInfo={false} 
                  strokeColor={accentColor}
                  trailColor={isDarkMode ? "rgba(255,255,255,0.1)" : "#F2F2F7"}
                  strokeWidth={8}
                  className="m-0"
                />
              </div>
            )}
          </div>
        );
      case 5:
        return (
          <div className="py-2 animate-in fade-in duration-500">
            {/* 紧凑型完成态 Header */}
            <div className="flex items-center gap-3 mb-2 bg-green-50/30 p-4 rounded-2xl border border-green-100/50 dark:bg-white/5 dark:border-white/10">
              <CheckCircleFilled className="text-green-500 text-xl" />
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-bold text-gray-900 dark:text-white/95">导入完成</span>
                <Space split={<Divider type="vertical" className="bg-gray-300 h-3 dark:bg-white/10" />} className="text-gray-500 text-[13px] ml-2 dark:text-white/30">
                  <span>共 {executeSummary.totalCount} 行</span>
                  <span>成功 <Text strong className="text-green-600 dark:text-green-400">{executeSummary.successCount}</Text></span>
                  <span>跳过 <Text strong className="text-gray-600 dark:text-white/60">{executeSummary.skippedCount}</Text></span>
                  <span>失败 <Text strong className="text-red-500 dark:text-red-400">{executeSummary.failedCount}</Text></span>
                </Space>
              </div>
            </div>
            
            {/* 密集统计说明 */}
            <div className="space-y-3 mb-2 px-1">
              <div className="flex items-center gap-2">
                <Text type="secondary" className="text-[13px] w-16 dark:text-white/30">处理总数:</Text>
                <Text strong className="text-[13px] dark:text-white/95">{executeSummary.totalCount}</Text>
              </div>
              <div className="flex items-center gap-2">
                <Text type="secondary" className="text-[13px] w-16 dark:text-white/30">成功导入:</Text>
                <Text strong className="text-[13px] text-green-600 dark:text-green-400">{executeSummary.successCount}</Text>
                <Text type="secondary" className="text-[11px] opacity-60 ml-1 dark:text-white/30">(新增 {executeSummary.createdCount} | 更新 {executeSummary.updatedCount})</Text>
              </div>
              <div className="flex items-center gap-2">
                <Text type="secondary" className="text-[13px] w-16 dark:text-white/30">选择跳过:</Text>
                <Text strong className="text-[13px] dark:text-white/95">{executeSummary.skippedCount}</Text>
              </div>
              {executeSummary.skippedCount > 0 && (
                <div className="flex items-center gap-1.5 py-1 px-3 bg-gray-50 rounded-lg border border-gray-100 w-fit dark:bg-white/5 dark:border-white/10">
                   <Text type="secondary" className="text-[11px] dark:text-white/30">跳过原因：由于系统已存在相同唯一键记录，系统自动去重</Text>
                   <Tooltip title="数据未发生变更或已存在主键冲突，跳过以避免覆盖已有数据（取决于冲突策略）">
                     <InfoCircleOutlined className="text-[10px] text-gray-300 cursor-help dark:text-white/20" />
                   </Tooltip>
                </div>
              )}
            </div>

            {/* 资产下载区 (列表化) */}
            <div className="mt-8">
              <Title level={5} className="text-[13px] text-gray-400 mb-4 font-normal dark:text-white/30">后续操作与资产</Title>
              <div className="space-y-2">
                <div 
                  onClick={() => canDownloadFailedRows && handleDownloadFailedRows()}
                  className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all ${
                    canDownloadFailedRows 
                      ? 'border-gray-100 hover:border-blue-200 hover:bg-blue-50/20 cursor-pointer group dark:border-white/10 dark:hover:bg-white/5' 
                      : 'border-gray-50 bg-gray-50/30 opacity-60 cursor-not-allowed dark:bg-white/5 dark:border-white/5 dark:opacity-40'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${canDownloadFailedRows ? 'bg-red-50 text-red-500 dark:bg-red-500/10 dark:text-red-400' : 'bg-gray-100 text-gray-300 dark:bg-white/10 dark:text-white/20'}`}>
                      <DownloadOutlined />
                    </div>
                    <div>
                      <Text strong className={`block text-[13px] ${canDownloadFailedRows ? 'text-gray-700 dark:text-white/95' : 'text-gray-400 dark:text-white/30'}`}>
                        下载失败行数据 <span className="font-normal opacity-50 ml-1">({executeSummary.failedCount} 行)</span>
                      </Text>
                      <Text type="secondary" className="text-[11px] dark:text-white/60">导出原始数据并追加错误原因，支持离线修正后重新上传</Text>
                    </div>
                  </div>
                  {canDownloadFailedRows && <ArrowRightOutlined className="text-gray-300 text-xs group-hover:text-ios-blue transition-colors dark:group-hover:text-[#0A84FF]" />}
                </div>

                <div 
                  onClick={() => canDownloadErrorReport && handleDownloadErrorReport()}
                  className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all ${
                    canDownloadErrorReport 
                      ? 'border-gray-100 hover:border-blue-200 hover:bg-blue-50/20 cursor-pointer group dark:border-white/10 dark:hover:bg-white/5' 
                      : 'border-gray-50 bg-gray-50/30 opacity-60 cursor-not-allowed dark:bg-white/5 dark:border-white/5 dark:opacity-40'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${canDownloadErrorReport ? 'bg-orange-50 text-orange-500 dark:bg-orange-500/10 dark:text-orange-400' : 'bg-gray-100 text-gray-300 dark:bg-white/10 dark:text-white/20'}`}>
                      <FileExcelOutlined />
                    </div>
                    <div>
                      <Text strong className={`block text-[13px] ${canDownloadErrorReport ? 'text-gray-700 dark:text-white/95' : 'text-gray-400 dark:text-white/30'}`}>
                        下载异常分析报告 <span className="font-normal opacity-50 ml-1">({executeSummary.failedRows.length} 条)</span>
                      </Text>
                      <Text type="secondary" className="text-[11px] dark:text-white/60">按错误代码聚合的统计分析，用于定位系统性数据偏差</Text>
                    </div>
                  </div>
                  {canDownloadErrorReport && <ArrowRightOutlined className="text-gray-300 text-xs group-hover:text-ios-blue transition-colors dark:group-hover:text-[#0A84FF]" />}
                </div>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  if (isMobileMode) {
    return renderMobileWizard();
  }

  return (
    <Modal
      title={config?.title || '数据导入'}
      open={open}
      onCancel={onClose}
      width={MODAL_WIDTH.lg}
      footer={null}
      centered
      styles={{ body: { height: 'min(600px, calc(100vh - 10rem))' } }}
      className="co-modal co-modal--flush"
    >
      <ConfigProvider
        theme={{
          algorithm: isDarkMode ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
          token: {
            colorPrimary: accentColor,
            colorBgContainer: isDarkMode ? '#1C1C1E' : '#ffffff',
            colorBorder: isDarkMode ? 'rgba(255,255,255,0.1)' : '#f0f0f0',
          }
        }}
      >
        <div className={`flex h-full ${isDarkMode ? 'dark' : ''}`}>
          {/* C. 左侧 Steps 降噪：缩窄宽度、移除英文标题、弱化描述 */}
          <div className="w-56 bg-gray-50/60 border-r border-gray-100/80 p-5 flex flex-col justify-between dark:bg-[#161617] dark:border-white/5">
            <div>
              <Steps
                direction="vertical"
                current={current}
                size="small"
                className="import-wizard-steps"
                items={steps.map((s, idx) => ({
                  title: (
                    <span className={`text-[13px] ${
                      current === idx 
                        ? (isDarkMode ? 'font-semibold text-white/95' : 'font-semibold text-gray-900') 
                        : (isDarkMode ? 'text-white/60' : 'text-gray-500')
                    }`}>
                      {s.title}
                    </span>
                  ),
                  description: (
                    <span className={`text-[10px] ${isDarkMode ? 'text-white/30' : 'text-gray-300'}`}>
                      {s.description}
                    </span>
                  )
                }))}
              />
            </div>
          </div>

          {/* 右侧内容 */}
          <div className="flex-1 flex flex-col relative bg-white dark:bg-[#1C1C1E]">
            {/* 顶部摘要条：在上传文件步骤（Step 2）隐藏 */}
            {current !== 1 && current !== 5 && renderContextSummaryBar()}
            
            <div className="flex-1 overflow-y-auto px-10 py-6 custom-scrollbar dark:text-white/95">
              {renderStepContent()}
            </div>

            {/* A. Footer 主操作收敛：任何步骤右侧只有一个主按钮 */}
            <div className="px-10 py-5 border-t border-gray-100 flex items-center justify-between bg-white/80 backdrop-blur-md dark:bg-[#1C1C1E]/80 dark:border-white/10">
              {/* 左侧：上一步按钮（Step 6 不显示） */}
              <div>
                {current > 0 && current < 5 && (
                  <Button 
                    type="default"
                    onClick={handlePrev} 
                    className="rounded-full px-6 border border-gray-300 hover:border-gray-400 hover:bg-gray-50 text-gray-600 transition-colors dark:border-white/20 dark:text-white/60 dark:hover:border-white/30 dark:hover:bg-white/5"
                  >
                    上一步
                  </Button>
                )}
              </div>
              
              {/* 右侧：取消 + 继续导入（仅 Step 6） + 唯一主按钮 */}
              <Space size="middle">
                {/* Step 6 显示“继续导入”次要按钮 */}
                {current === 5 && (
                  <Button 
                    onClick={handleReset}
                    className="rounded-full px-8 border-gray-200 hover:border-gray-300 dark:border-white/20 dark:text-white/60 dark:hover:border-white/30 dark:hover:bg-white/5"
                  >
                    继续导入
                  </Button>
                )}
                             
                {/* 唯一主按钮：由 getPrimaryAction 统一计算 */}
                {getPrimaryAction && (
                  <Button 
                    type="primary" 
                    onClick={getPrimaryAction.onClick}
                    loading={getPrimaryAction.loading}
                    disabled={getPrimaryAction.disabled}
                    className={`rounded-full px-8 flex items-center gap-2 ${
                      getPrimaryAction.disabled ? '' : 'apple-button-blue shadow-lg shadow-blue-100'
                    }`}
                  >
                    {getPrimaryAction.text}
                    {getPrimaryAction.icon}
                  </Button>
                )}
              </Space>
            </div>
          </div>
        </div>
      </ConfigProvider>

      <style>{`
        .import-wizard-steps .ant-steps-item-container {
          padding-bottom: 24px !important;
        }
        .import-wizard-steps .ant-steps-item-subtitle {
          display: none;
        }
        .import-wizard-steps .ant-steps-item-process .ant-steps-item-icon {
          background-color: ${accentColor} !important;
          border-color: ${accentColor} !important;
          ${isDarkMode ? 'box-shadow: 0 0 0 3px rgba(10, 132, 255, 0.25) !important;' : ''}
        }
        .import-wizard-steps .ant-steps-item-finish .ant-steps-item-icon {
          border-color: ${accentColor} !important;
        }
        .import-wizard-steps .ant-steps-item-finish .ant-steps-item-icon .ant-steps-icon {
          color: ${accentColor} !important;
        }
        /* 子步骤折叠面板样式适配 */
        .dark .issue-collapse .ant-collapse-header {
          padding: 12px 16px !important;
        }
        .dark .issue-collapse .ant-collapse-content-box {
          background-color: #1C1C1E !important;
          padding: 0 !important;
        }
        
        .apple-button-blue {
          background: ${accentColor} !important;
          ${isDarkMode ? 'box-shadow: 0 4px 12px rgba(10, 132, 255, 0.3) !important;' : ''}
        }
        /* 自定义滚动条深色模式 */
        .dark .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.2) !important;
        }
        .dark .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent !important;
        }
      `}</style>
    </Modal>
  );
};

export default ImportWizardModal;

