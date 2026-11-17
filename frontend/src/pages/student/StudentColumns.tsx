/**
 * 学生管理表格列定义
 * StudentManagementPage 模块化
 * @module pages/student/StudentColumns
 */

import { Space, Tag, Button, Popconfirm, Tooltip } from "antd";
import {
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
} from "@ant-design/icons";

import type { StudentColumn, StudentColumnConfig, StudentRecord } from "./types";

/**
 * 学生表格列宽度配置
 */
const COLUMN_WIDTHS = {
  studentNo: 120,
  fullName: 100,
  gender: 70,
  status: 100,
  educationLevel: 100,
  college: 150,
  major: 150,
  className: 120,
  building: 100,
  roomNo: 80,
  bedNo: 70,
  mobile: 130,
  qq: 100,
  isMonitor: 100,
} as const;

/**
 * 学生表格单元格渲染器
 */
export const STUDENT_RENDERERS = {
  mobile: (student: StudentRecord) => student.mobile || "-",
  qq: (student: StudentRecord) => student.qq || "-",
  building: (student: StudentRecord) => student.building || "-",
  roomNo: (student: StudentRecord) => student.roomNo || "-",
  bedNo: (student: StudentRecord) => student.bedNo || "-",
  status: (student: StudentRecord) => {
    const val = student.status || "-";
    if (val === "-") return val;
    let colorClass =
      "bg-gray-50 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
    if (val === "在读")
      colorClass =
        "bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400";
    if (val === "休学")
      colorClass =
        "bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400";
    if (val === "退学")
      colorClass =
        "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400";

    return (
      <Tag className={`rounded-full border-none px-3 m-0 ${colorClass}`}>
        {val}
      </Tag>
    );
  },
  gender: (student: StudentRecord) => {
    const val = student.gender || "-";
    if (val === "-") return val;
    let colorClass =
      "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400";
    if (val === "女")
      colorClass =
        "bg-pink-50 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400";

    return (
      <Tag className={`rounded-full border-none px-3 m-0 ${colorClass}`}>
        {val}
      </Tag>
    );
  },
  educationLevel: (student: StudentRecord) => student.educationLevel || "-",
  isMonitor: (student: StudentRecord) => (student.isMonitor ? "是" : "否"),
};

/**
 * 渲染单元格内容
 * @param {Object} student - 学生对象
 * @param {Object} column - 列配置
 */
export function renderStudentCell(
  student: StudentRecord,
  column: StudentColumnConfig,
): React.ReactNode {
  if (typeof column.render === "function") {
    return column.render(student);
  }
  const renderer = STUDENT_RENDERERS[column.fieldKey as keyof typeof STUDENT_RENDERERS];
  if (renderer) {
    return renderer(student);
  }
  const value = student[column.fieldKey];
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "string" || typeof value === "number") {
    return value;
  }
  return String(value);
}

/**
 * 创建基础列定义（不含操作列）
 * @param {Object} options - 配置项
 * @param {Array} options.visibleColumns - 可见列配置
 * @param {string} options.sortField - 当前排序字段
 * @param {string} options.sortOrder - 当前排序方向 'asc' | 'desc'
 * @returns {Array} 基础列定义数组
 */
export function createBaseColumns({
  visibleColumns,
  sortField,
  sortOrder,
}: {
  visibleColumns: StudentColumnConfig[];
  sortField: string;
  sortOrder: string;
}): StudentColumn[] {
  return visibleColumns.map((column) => ({
    title: column.label,
    dataIndex: column.fieldKey,
    key: column.fieldKey,
    width: COLUMN_WIDTHS[column.fieldKey as keyof typeof COLUMN_WIDTHS] || 120,
    sorter: column.sortable,
    sortOrder:
      sortField === column.fieldKey
        ? sortOrder === "asc"
          ? "ascend"
          : "descend"
        : null,
    ellipsis: true,
    render: (_value, record: StudentRecord) => renderStudentCell(record, column),
  }));
}

/**
 * 创建操作列
 * @param {Object} options - 配置项
 * @param {boolean} options.canEdit - 是否有编辑权限
 * @param {boolean} options.batchLoading - 批量操作加载状态
 * @param {Function} options.onView - 查看详情回调
 * @param {Function} options.onEdit - 编辑回调
 * @param {Function} options.onDelete - 删除回调
 * @returns {Object} 操作列定义
 */
export function createActionColumn({
  canEdit,
  batchLoading,
  onView,
  onEdit,
  onDelete,
}: {
  canEdit: boolean;
  batchLoading: boolean;
  onView: (student: StudentRecord) => void;
  onEdit: (student?: StudentRecord | null) => void;
  onDelete: (student: StudentRecord) => Promise<void> | void;
}): StudentColumn {
  return {
    title: "操作",
    key: "action",
    width: canEdit ? 108 : 44,
    fixed: "right",
    className: "table-action-column",
    render: (_value, record: StudentRecord) => (
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
        {canEdit && (
          <>
            <Tooltip title="编辑学生">
              <Button
                type="text"
                size="small"
                icon={<EditOutlined />}
                onClick={() => onEdit(record)}
                className="dorm-table-action-btn is-edit"
                aria-label="编辑学生"
              />
            </Tooltip>
            <Popconfirm
              title="确定删除吗？"
              description="删除后无法恢复"
              onConfirm={() => onDelete(record)}
            >
              <Tooltip title="删除学生">
                <Button
                  type="text"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  disabled={batchLoading}
                  className="dorm-table-action-btn is-danger"
                  aria-label="删除学生"
                />
              </Tooltip>
            </Popconfirm>
          </>
        )}
      </Space>
    ),
  };
}
