/**
 * 教职工管理表格列定义
 * @module pages/teacher/TeacherColumns
 */

import { useMemo } from "react";
import { Button, Space, Popconfirm, Tooltip } from "antd";
import type { ColumnsType } from 'antd/es/table';
import { EditOutlined, DeleteOutlined } from "@ant-design/icons";
import { TEACHER_COLUMN_WIDTHS, renderTeacherCell } from "./teacherSchema";

import type { TeacherColumnConfig, TeacherRecord } from './types';

interface CreateBaseColumnsOptions {
  visibleColumns: TeacherColumnConfig[];
  sortField: string;
  sortOrder: string;
}

interface CreateActionColumnOptions {
  canEdit: boolean;
  onEdit: (record: TeacherRecord) => void;
  onDelete: (record: TeacherRecord) => void | Promise<void>;
  batchLoading: boolean;
}

/**
 * 创建基础列定义
 * @param {Object} options - 配置选项
 * @param {Array} options.visibleColumns - 可见列配置
 * @param {string} options.sortField - 当前排序字段
 * @param {string} options.sortOrder - 当前排序方向
 * @returns {Array} 基础列定义
 */
export const createBaseColumns = ({
  visibleColumns,
  sortField,
  sortOrder,
}: CreateBaseColumnsOptions): ColumnsType<TeacherRecord> => {
  return visibleColumns.map((column) => ({
    title: column.label,
    dataIndex: column.fieldKey,
    key: column.fieldKey,
    width: TEACHER_COLUMN_WIDTHS[column.fieldKey] || 120,
    sorter: column.sortable,
    sortOrder:
      sortField === column.fieldKey
        ? sortOrder === "asc"
          ? "ascend"
          : "descend"
        : null,
    ellipsis: true,
    render: (_, record) => renderTeacherCell(record, column),
  }));
};

/**
 * 创建操作列定义
 * @param {Object} options - 配置选项
 * @param {Function} options.onEdit - 编辑回调
 * @param {Function} options.onDelete - 删除回调
 * @param {boolean} options.batchLoading - 批量操作加载状态
 * @returns {Object} 操作列定义
 */
export const createActionColumn = ({
  canEdit,
  onEdit,
  onDelete,
  batchLoading,
}: CreateActionColumnOptions): ColumnsType<TeacherRecord>[number] => ({
  title: "操作",
  key: "action",
  width: canEdit ? 76 : 0,
  fixed: "right",
  className: "table-action-column",
  render: (_, record) => (
    canEdit ? (
      <Space size={8} className="table-action-buttons dorm-table-action-group">
        <Tooltip title="编辑教职工">
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            onClick={() => onEdit(record)}
            className="dorm-table-action-btn is-edit"
            aria-label="编辑教职工"
          />
        </Tooltip>
        <Popconfirm
          title="确定删除吗？"
          description="删除后无法恢复"
          onConfirm={() => onDelete(record)}
        >
          <Tooltip title="删除教职工">
            <Button
              type="text"
              size="small"
              danger
              icon={<DeleteOutlined />}
              disabled={batchLoading}
              className="dorm-table-action-btn is-danger"
              aria-label="删除教职工"
            />
          </Tooltip>
        </Popconfirm>
      </Space>
    ) : null
  ),
});

/**
 * 使用教职工表格列 Hook
 * @param {Object} options - 配置选项
 * @param {Array} options.visibleColumns - 可见列配置
 * @param {string} options.sortField - 当前排序字段
 * @param {string} options.sortOrder - 当前排序方向
 * @param {Function} options.onEdit - 编辑回调
 * @param {Function} options.onDelete - 删除回调
 * @param {boolean} options.batchLoading - 批量操作加载状态
 * @returns {Array} 完整列定义（含操作列）
 */
export const useTeacherColumns = ({
  visibleColumns,
  sortField,
  sortOrder,
  canEdit,
  onEdit,
  onDelete,
  batchLoading,
}: CreateBaseColumnsOptions & CreateActionColumnOptions): ColumnsType<TeacherRecord> => {
  const baseColumns = useMemo(
    () => createBaseColumns({ visibleColumns, sortField, sortOrder }),
    [visibleColumns, sortField, sortOrder]
  );

  const allColumns = useMemo(
    () => [
      ...baseColumns,
      createActionColumn({ canEdit, onEdit, onDelete, batchLoading }),
    ],
    [baseColumns, canEdit, onEdit, onDelete, batchLoading]
  );

  return allColumns;
};
