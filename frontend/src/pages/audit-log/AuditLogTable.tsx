import { useMemo } from "react";
import { Tag, Tooltip, Typography, Divider } from "antd";
import type { ColumnsType } from 'antd/es/table';
import { UserOutlined, SwapOutlined, InfoCircleOutlined } from "@ant-design/icons";
import GlassTable from "../../components/GlassTable";
import { useResizableColumns } from "../../hooks/useResizableColumns";
import {
  AUDIT_LOG_COLUMN_WIDTHS,
  formatDateTime,
  formatFieldValue,
  FIELD_LABELS,
} from "./auditLogSchema";

import type {
  AuditLogColumnConfig,
  AuditLogOptions,
  AuditLogRecord,
  AuditLogSorterInput,
  AuditLogTablePagination,
} from './types';

const { Text } = Typography;

interface AuditLogTableProps {
  logs: AuditLogRecord[];
  loading: boolean;
  pagination: AuditLogTablePagination;
  visibleColumns: AuditLogColumnConfig[];
  sortField: string;
  sortOrder: 'asc' | 'desc';
  handleTableChange: (
    paginationConfig: {
      current?: number;
      pageSize?: number;
    },
    _filters?: unknown,
    sorter?: AuditLogSorterInput | AuditLogSorterInput[],
  ) => void;
  options: AuditLogOptions;
}

function getChangedFields(record: AuditLogRecord): string[] {
  return Array.from(
    new Set([
      ...Object.keys(record.oldValue || {}),
      ...Object.keys(record.newValue || {}),
    ]),
  );
}

function readArrayLength(
  value: Record<string, unknown> | null | undefined,
  key: string,
): number | null {
  const target = value?.[key];
  return Array.isArray(target) ? target.length : null;
}

export const AuditLogTable = ({
  logs,
  loading,
  pagination,
  visibleColumns,
  sortField,
  sortOrder,
  handleTableChange,
  options,
}: AuditLogTableProps) => {
  // 渲染变更详情
  const renderChangesDetail = (record: AuditLogRecord) => {
    const { oldValue, newValue, action } = record;
    
    // 只有 UPDATE 操作且有变更值时才显示详情
    if (action !== "UPDATE" || (!oldValue && !newValue)) {
      return null;
    }
    
    // 获取所有变更的字段
    const changedFields = new Set(getChangedFields(record));
    
    if (changedFields.size === 0) {
      return (
        <div style={{ padding: "12px 24px", color: "var(--co-text-secondary)" }}>
          <InfoCircleOutlined style={{ marginRight: 8 }} />
          暂无详细变更信息
        </div>
      );
    }

    return (
      <div style={{ padding: "16px 24px", background: "var(--info-bg)", borderRadius: 8 }}>
        <div style={{ marginBottom: 12, fontWeight: 500, color: "var(--co-text)" }}>
          <SwapOutlined style={{ marginRight: 8, color: "var(--co-primary)" }} />
          变更详情
        </div>
        <div style={{ display: "grid", gap: 12 }}>
          {Array.from(changedFields)
            .filter((field) => !["dorms", "executors"].includes(field))
            .map((field) => {
              const oldVal = oldValue?.[field];
              const newVal = newValue?.[field];
              const label = FIELD_LABELS[field] || field;
              
              return (
                <div key={field} style={{ 
                  display: "flex", 
                  alignItems: "center",
                  padding: "8px 12px",
                  background: "rgba(255,255,255,0.8)",
                  borderRadius: 6,
                  border: "1px solid #f0f0f0"
                }}>
                  <Text strong style={{ minWidth: 100, color: "var(--co-text-secondary)" }}>{label}：</Text>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
                    <Tag color="red" style={{ margin: 0 }}>
                      {formatFieldValue(field, oldVal)}
                    </Tag>
                    <SwapOutlined style={{ color: "var(--co-text-muted)" }} />
                    <Tag color="green" style={{ margin: 0 }}>
                      {formatFieldValue(field, newVal)}
                    </Tag>
                  </div>
                </div>
              );
            })}
        </div>
        
        {/* 如果有宿舍或执行人变更，额外显示数量变化 */}
        {(changedFields.has("dorms") || changedFields.has("executors")) && (
          <>
            <Divider style={{ margin: "12px 0" }} />
            <div style={{ display: "flex", gap: 24 }}>
              {changedFields.has("dorms") &&
              readArrayLength(oldValue, 'dorms') !== null &&
              readArrayLength(newValue, 'dorms') !== null ? (
                <div>
                  <Text type="secondary">宿舍列表变更：</Text>
                  <span style={{ marginLeft: 8 }}>
                    <Text delete>{readArrayLength(oldValue, 'dorms') || 0} 个</Text>
                    <SwapOutlined style={{ margin: "0 8px", color: "var(--co-text-muted)" }} />
                    <Text mark>{readArrayLength(newValue, 'dorms') || 0} 个</Text>
                  </span>
                </div>
              ) : null}
              {changedFields.has("executors") &&
              readArrayLength(oldValue, 'executors') !== null &&
              readArrayLength(newValue, 'executors') !== null ? (
                <div>
                  <Text type="secondary">执行人变更：</Text>
                  <span style={{ marginLeft: 8 }}>
                    <Text delete>{readArrayLength(oldValue, 'executors') || 0} 人</Text>
                    <SwapOutlined style={{ margin: "0 8px", color: "var(--co-text-muted)" }} />
                    <Text mark>{readArrayLength(newValue, 'executors') || 0} 人</Text>
                  </span>
                </div>
              ) : null}
            </div>
          </>
        )}
      </div>
    );
  };

  const columnMap = useMemo<Record<string, ColumnsType<AuditLogRecord>[number]>>(
    () => ({
      createdAt: {
        title: "时间",
        dataIndex: "createdAt",
        key: "createdAt",
        width: AUDIT_LOG_COLUMN_WIDTHS.createdAt,
        render: (value: AuditLogRecord['createdAt']) => (
          <span className="text-gray-500 dark:text-gray-400 font-mono text-xs">
            {formatDateTime(value)}
          </span>
        ),
      },
      action: {
        title: "操作类型",
        dataIndex: "action",
        key: "action",
        width: AUDIT_LOG_COLUMN_WIDTHS.action,
        render: (action: AuditLogRecord['action']) => {
          const actionValue = action || '';
          const actionOption = options.actions.find((item) => item.value === actionValue);
          const label = actionOption?.label || actionValue || '-';
          let colorClass = "bg-gray-50 text-gray-600 dark:bg-gray-800 dark:text-gray-400";

          if (actionValue === "CREATE") colorClass = "bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400";
          if (actionValue === "UPDATE") colorClass = "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400";
          if (actionValue === "DELETE") colorClass = "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400";
          if (actionValue.includes("LOGIN")) colorClass = "bg-cyan-50 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400";
          if (actionValue.includes("FAILED")) colorClass = "bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400";

          return (
            <Tag className={`rounded-full border-none px-3 m-0 ${colorClass}`}>
              {label}
            </Tag>
          );
        },
      },
      module: {
        title: "模块",
        dataIndex: "module",
        key: "module",
        width: AUDIT_LOG_COLUMN_WIDTHS.module,
        render: (module: AuditLogRecord['module']) => {
          const moduleOption = options.modules.find((item) => item.value === module);
          const label = moduleOption?.label || module || '-';
          return (
            <Tag className="rounded-full border-none px-3 m-0 bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400">
              {label}
            </Tag>
          );
        },
      },
      description: {
        title: "操作描述",
        dataIndex: "description",
        key: "description",
        width: AUDIT_LOG_COLUMN_WIDTHS.description,
        ellipsis: true,
        render: (text: AuditLogRecord['description'], record) => (
          <Tooltip title={text || `${record.action} ${record.targetName || ""}`}>
            <span>{text || `${record.action} ${record.targetName || ""}`}</span>
          </Tooltip>
        ),
      },
      targetName: {
        title: "目标",
        dataIndex: "targetName",
        key: "targetName",
        width: AUDIT_LOG_COLUMN_WIDTHS.targetName,
        ellipsis: true,
        render: (text: AuditLogRecord['targetName']) => text || "-",
      },
      operatorName: {
        title: "操作者",
        dataIndex: "operatorName",
        key: "operatorName",
        width: AUDIT_LOG_COLUMN_WIDTHS.operatorName,
        render: (text: AuditLogRecord['operatorName'], record) => (
          <span className="font-medium text-gray-700 dark:text-gray-300">
            <UserOutlined style={{ marginRight: 4, opacity: 0.6 }} />
            {text || record.operator?.fullName || record.operator?.username || "系统"}
          </span>
        ),
      },
      ipAddress: {
        title: "IP 地址",
        dataIndex: "ipAddress",
        key: "ipAddress",
        width: AUDIT_LOG_COLUMN_WIDTHS.ipAddress,
        render: (text: AuditLogRecord['ipAddress']) => text || "-",
      },
    }),
    [options.actions, options.modules],
  );

  const baseColumns = useMemo<ColumnsType<AuditLogRecord>>(
    () =>
      visibleColumns
        .map((column) => {
          const def = columnMap[column.fieldKey];
          if (!def) {
            return null;
          }
          return {
            ...def,
            title: column.label || def.title,
            key: column.fieldKey,
            width: AUDIT_LOG_COLUMN_WIDTHS[column.fieldKey] || 130,
            sorter: Boolean(column.sortable),
            sortOrder:
              sortField === column.fieldKey
                ? sortOrder === 'asc'
                  ? 'ascend'
                  : 'descend'
                : null,
          } as ColumnsType<AuditLogRecord>[number];
        })
        .filter((column): column is ColumnsType<AuditLogRecord>[number] => Boolean(column)),
    [columnMap, sortField, sortOrder, visibleColumns],
  );

  const { columns: resizableColumns } = useResizableColumns(
    baseColumns as Array<Record<string, unknown>>,
    { minWidth: 80, maxWidth: 500 },
  );

  return (
    <GlassTable
      columns={resizableColumns as unknown as ColumnsType<AuditLogRecord>}
      dataSource={logs}
      rowKey="id"
      loading={loading}
      expandable={{
        expandedRowRender: renderChangesDetail,
        rowExpandable: (record) =>
          record.action === "UPDATE" && Boolean(record.oldValue || record.newValue),
        expandRowByClick: true,
      }}
      pagination={pagination}
      onChange={(nextPagination, filtersArg, sorter) => {
        const activeSorter = Array.isArray(sorter) ? sorter[0] : sorter;
        handleTableChange(
          {
            current: nextPagination.current,
            pageSize: nextPagination.pageSize,
          },
          filtersArg,
          activeSorter
            ? {
                field:
                  activeSorter.field !== undefined && activeSorter.field !== null
                    ? String(activeSorter.field)
                    : undefined,
                columnKey:
                  activeSorter.columnKey !== undefined && activeSorter.columnKey !== null
                    ? String(activeSorter.columnKey)
                    : undefined,
                order: activeSorter.order,
              }
            : undefined,
        );
      }}
      scroll={{ x: 'max-content' }}
      className="dorm-table"
      resizable={true}
    />
  );
};

