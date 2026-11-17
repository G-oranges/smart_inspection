import { Tag, Tooltip, Typography, Divider } from "antd";
import type { ColumnsType } from 'antd/es/table';
import { UserOutlined, SwapOutlined, InfoCircleOutlined } from "@ant-design/icons";
import GlassTable from "../../components/GlassTable";
import { formatDateTime, formatFieldValue, FIELD_LABELS } from "./auditLogSchema";

import type {
  AuditLogOptions,
  AuditLogRecord,
  AuditLogTablePagination,
} from './types';

const { Text } = Typography;

interface AuditLogTableProps {
  logs: AuditLogRecord[];
  loading: boolean;
  pagination: AuditLogTablePagination;
  handleTableChange: (paginationConfig: {
    current?: number;
    pageSize?: number;
  }) => void;
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
        <div style={{ padding: "12px 24px", color: "#666" }}>
          <InfoCircleOutlined style={{ marginRight: 8 }} />
          暂无详细变更信息
        </div>
      );
    }

    return (
      <div style={{ padding: "16px 24px", background: "var(--info-bg)", borderRadius: 8 }}>
        <div style={{ marginBottom: 12, fontWeight: 500, color: "#333" }}>
          <SwapOutlined style={{ marginRight: 8, color: "#1890ff" }} />
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
                  <Text strong style={{ minWidth: 100, color: "#666" }}>{label}:</Text>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
                    <Tag color="red" style={{ margin: 0 }}>
                      {formatFieldValue(field, oldVal)}
                    </Tag>
                    <SwapOutlined style={{ color: "#999" }} />
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
                  <Text type="secondary">宿舍列表变更:</Text>
                  <span style={{ marginLeft: 8 }}>
                    <Text delete>{readArrayLength(oldValue, 'dorms') || 0} 个</Text>
                    <SwapOutlined style={{ margin: "0 8px", color: "#999" }} />
                    <Text mark>{readArrayLength(newValue, 'dorms') || 0} 个</Text>
                  </span>
                </div>
              ) : null}
              {changedFields.has("executors") &&
              readArrayLength(oldValue, 'executors') !== null &&
              readArrayLength(newValue, 'executors') !== null ? (
                <div>
                  <Text type="secondary">执行人变更:</Text>
                  <span style={{ marginLeft: 8 }}>
                    <Text delete>{readArrayLength(oldValue, 'executors') || 0} 人</Text>
                    <SwapOutlined style={{ margin: "0 8px", color: "#999" }} />
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

  const columns: ColumnsType<AuditLogRecord> = [
    {
      title: "时间",
      dataIndex: "createdAt",
      key: "createdAt",
      width: 180,
      render: (value: AuditLogRecord['createdAt']) => (
        <span className="text-gray-500 dark:text-gray-400 font-mono text-xs">
          {formatDateTime(value)}
        </span>
      ),
    },
    {
      title: "操作",
      dataIndex: "action",
      key: "action",
      width: 110,
      render: (action: AuditLogRecord['action']) => {
        const actionValue = action || '';
        const actionOption = options.actions.find((item) => item.value === actionValue);
        const label = actionOption?.label || actionValue || '-';
        let colorClass = "bg-gray-50 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
        
        // 根据操作类型分配颜色类 (Tailwind)
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
    {
      title: "模块",
      dataIndex: "module",
      key: "module",
      width: 100,
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
    {
      title: "操作描述",
      dataIndex: "description",
      key: "description",
      ellipsis: true,
      render: (text: AuditLogRecord['description'], record) => (
        <Tooltip title={text || `${record.action} ${record.targetName || ""}`}>
          <span>{text || `${record.action} ${record.targetName || ""}`}</span>
        </Tooltip>
      ),
    },
    {
      title: "目标",
      dataIndex: "targetName",
      key: "targetName",
      width: 120,
      ellipsis: true,
      render: (text: AuditLogRecord['targetName']) => text || "-",
    },
    {
      title: "操作者",
      dataIndex: "operatorName",
      key: "operatorName",
      width: 120,
      render: (text: AuditLogRecord['operatorName'], record) => (
        <span className="font-medium text-gray-700 dark:text-gray-300">
          <UserOutlined style={{ marginRight: 4, opacity: 0.6 }} />
          {text || record.operator?.fullName || record.operator?.username || "系统"}
        </span>
      ),
    },
    {
      title: "IP地址",
      dataIndex: "ipAddress",
      key: "ipAddress",
      width: 130,
      render: (text: AuditLogRecord['ipAddress']) => text || "-",
    },
  ];

  return (
    <GlassTable
      columns={columns}
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
      onChange={handleTableChange}
      scroll={{ x: 1000 }}
      className="dorm-table"
    />
  );
};

