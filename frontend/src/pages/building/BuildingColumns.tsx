/**
 * BuildingColumns.jsx - 楼栋表格列定义
 * 
 * 包含基础列和操作列的创建函数
 */
import { Button, Space, Tag, Tooltip } from "antd";
import type { ReactNode } from 'react';
import type { ColumnType, ColumnsType } from 'antd/es/table';
import { EyeOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";

import type { BuildingRecord } from './types';

export interface BuildingColumnConfig extends ColumnType<BuildingRecord> {
  title?: string;
  dataIndex?: string;
  key?: string;
  fieldKey: string;
  width?: number;
  ellipsis?: boolean;
  fixed?: 'left' | 'right';
  render?: (value: unknown, record: BuildingRecord) => ReactNode;
  sorter?: (left: BuildingRecord, right: BuildingRecord) => number;
}

interface BuildingActionColumnOptions {
  onView: (record: BuildingRecord) => void;
  onEdit: (record: BuildingRecord) => void;
  onDelete: (record: BuildingRecord) => Promise<void>;
}

// ===== 列宽度配置 =====
export const COLUMN_WIDTHS = {
  name: 150,
  campus: 120,
  type: 100,
  floors: 90,
  hasElevator: 80,
  dormCount: 100,
  contactInfo: 150,
  action: 230,
};

// ===== 类型颜色映射 =====
const getTypeColorClass = (type?: string) => {
  if (type === "男") return "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400";
  if (type === "女") return "bg-pink-50 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400";
  return "bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400";
};

// ===== 创建基础列配置 =====
export function createBaseColumns(): BuildingColumnConfig[] {
  return [
    {
      title: "楼栋名称",
      dataIndex: "name",
      key: "name",
      fieldKey: "name",
      width: COLUMN_WIDTHS.name,
      render: (text: unknown) => <span style={{ fontWeight: 600 }}>{String(text || "-")}</span>,
    },
    {
      title: "校区",
      dataIndex: "campus",
      key: "campus",
      fieldKey: "campus",
      width: COLUMN_WIDTHS.campus,
      render: (text: unknown) => (
        <Tag color="blue" className="rounded-full border-none px-3 bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
          {String(text || "-")}
        </Tag>
      ),
    },
    {
      title: "类型",
      dataIndex: "type",
      key: "type",
      fieldKey: "type",
      width: COLUMN_WIDTHS.type,
      render: (text: unknown) => (
        <Tag className={`rounded-full border-none px-3 ${getTypeColorClass(typeof text === 'string' ? text : undefined)}`}>
          {String(text || "-")}
        </Tag>
      ),
    },
    {
      title: "楼层数",
      dataIndex: "floors",
      key: "floors",
      fieldKey: "floors",
      width: COLUMN_WIDTHS.floors,
      sorter: (left, right) => (left.floors || 0) - (right.floors || 0),
      render: (floors: unknown) =>
        floors !== null && floors !== undefined ? `${floors} 层` : "-",
    },
    {
      title: "电梯",
      dataIndex: "hasElevator",
      key: "hasElevator",
      fieldKey: "hasElevator",
      width: COLUMN_WIDTHS.hasElevator,
      render: (has: unknown) =>
        has ? (
          <Tag className="rounded-full border-none px-3 bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400">
            有
          </Tag>
        ) : (
          <Tag className="rounded-full border-none px-3 bg-gray-50 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
            无
          </Tag>
        ),
    },
    {
      title: "关联宿舍",
      dataIndex: "dormCount",
      key: "dormCount",
      fieldKey: "dormCount",
      width: COLUMN_WIDTHS.dormCount,
      render: (count: unknown) => (
        <span className="font-medium text-gray-700 dark:text-gray-300">
          {String(count || 0)} <span className="text-xs font-normal text-gray-400">间</span>
        </span>
      ),
    },
    {
      title: "联系方式",
      dataIndex: "contactInfo",
      key: "contactInfo",
      fieldKey: "contactInfo",
      width: COLUMN_WIDTHS.contactInfo,
      ellipsis: true,
      render: (text: unknown) =>
        typeof text === 'string' && text.trim()
          ? text
          : <span className="text-gray-400">-</span>,
    },
  ];
}

// ===== 创建操作列配置 =====
export function createActionColumn({
  onView,
  onEdit,
  onDelete,
}: BuildingActionColumnOptions): ColumnsType<BuildingRecord>[number] {
  return {
    title: "操作",
    key: "action",
    width: 108,
    fixed: "right",
    className: "table-action-column",
    render: (_, record) => (
      <Space size={8} className="table-action-buttons dorm-table-action-group">
        <Tooltip title="查看详情">
          <Button
            type="text"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => onView(record)}
            className="dorm-table-action-btn is-view"
            aria-label="查看详情"
          />
        </Tooltip>
        <Tooltip title="编辑楼栋">
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            onClick={() => onEdit(record)}
            className="dorm-table-action-btn is-edit"
            aria-label="编辑楼栋"
          />
        </Tooltip>
        <Tooltip title="删除楼栋">
          <Button
            type="text"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => {
              void onDelete(record);
            }}
            className="dorm-table-action-btn is-danger"
            aria-label="删除楼栋"
          />
        </Tooltip>
      </Space>
    ),
  };
}

// ===== 合并列配置（基础列 + 操作列） =====
export function mergeColumnsWithAction(
  baseColumns: BuildingColumnConfig[],
  actionCallbacks: BuildingActionColumnOptions,
): ColumnsType<BuildingRecord> {
  const actionColumn = createActionColumn(actionCallbacks);
  return [...baseColumns, actionColumn];
}
