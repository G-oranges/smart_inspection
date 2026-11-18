/**
 * DormColumns.jsx - 宿舍表格列定义
 * 
 * 包含基础列定义、单元格渲染器、操作列工厂
 */
import { Button, Space, Tag, Tooltip } from "antd";
import type { ColumnsType } from 'antd/es/table';
import { EditOutlined, DeleteOutlined, EyeOutlined } from "@ant-design/icons";

import type { EntityId } from '../../types/service';
import type { DormBedRecord, DormColumnConfig, DormRecord } from './types';

// ===== 列宽配置 =====
export const COLUMN_WIDTHS: Record<string, number> = {
  campus: 100,
  building: 120,
  floor: 80,
  roomNo: 100,
  bedCount: 80,
  occupancy: 150,
  gender: 80,
  roomType: 100,
  studentList: 200,
  monitorName: 120,
};

// ===== 入住率进度条渲染器 =====
export const occupancyMeter = (occupied: number, capacity: number) => {
  const safeCap = capacity || 0;
  if (safeCap <= 0) {
    return <span className="text-black/35 dark:text-white/35">-</span>;
  }

  return (
    <div
      className="dorm-occupancy-dots"
      aria-label={`已入住 ${occupied} / ${safeCap}`}
      title={`已入住 ${occupied} / ${safeCap}`}
    >
      {Array.from({ length: safeCap }, (_, index) => {
        const isOccupied = index < occupied;
        return (
          <span
            key={`${safeCap}-${occupied}-${index}`}
            className={`dorm-occupancy-dot ${isOccupied ? 'is-occupied' : 'is-empty'}`}
          />
        );
      })}
    </div>
  );
};

// ===== 单元格渲染器 =====
export const renderDormCell = (dorm: DormRecord, column: DormColumnConfig): React.ReactNode => {
  if (column.fieldKey === "occupancy") {
    return occupancyMeter(dorm.occupiedCount ?? 0, dorm.capacity ?? 0);
  }
  if (column.fieldKey === "availableBeds") {
    const available = (dorm.capacity ?? 0) - (dorm.occupiedCount ?? 0);
    return (
      <Tag 
        color={available > 0 ? "success" : "error"} 
        className="rounded-full px-3 border-none font-bold scale-90"
      >
        {available}
      </Tag>
    );
  }
  if (column.fieldKey === "college") {
    // 聚合舍内学生的学院信息
    const beds = dorm.beds || dorm.dormBeds || [];
    const colleges = [...new Set((beds as DormBedRecord[])
      .map((bed) => bed.college || bed.student?.college)
      .filter((value): value is string => Boolean(value)))];
    
    if (colleges.length === 0) return "-";
    return (
      <Space size={4} wrap>
        {colleges.slice(0, 2).map((college, index) => (
          <Tag key={index} className="ant-tag-blue !m-0">{college}</Tag>
        ))}
        {colleges.length > 2 && <Tag className="apple-tag-gray !m-0">+{colleges.length - 2}</Tag>}
      </Space>
    );
  }
  if (column.fieldKey === "grade") {
    // 聚合舍内学生的年级信息
    const beds = dorm.beds || dorm.dormBeds || [];
    const studentGrades = [...new Set((beds as DormBedRecord[])
      .map((bed) => bed.grade || bed.student?.grade)
      .filter((value): value is string => Boolean(value)))];
    
    const displayGrades = studentGrades.length > 0 ? studentGrades : (dorm.grade ? [dorm.grade] : []);

    if (displayGrades.length === 0) return "-";
    return (
      <div className="flex flex-wrap gap-1">
        {displayGrades.map((grade, index) => (
          <span key={index} className="text-[13px] text-gray-600 dark:text-gray-400 font-medium">
            {grade}{index < displayGrades.length - 1 ? "," : ""}
          </span>
        ))}
      </div>
    );
  }
  if (column.fieldKey === "studentList") {
    // 从 beds 数组中提取已入住学生信息（后端返回的是 beds 而非 students）
    const beds = dorm.beds || dorm.dormBeds || [];
    const occupiedStudents = beds
      .filter((bed: DormBedRecord) => bed.studentId || bed.student?.id)
      .map((bed: DormBedRecord) => ({
        name: bed.studentName || bed.student?.fullName || bed.student?.name,
        studentNo: bed.studentNo || bed.student?.studentNo,
      }))
      .filter((student) => student.name || student.studentNo);
    
    if (occupiedStudents.length === 0) {
      return <span style={{ color: 'var(--co-text-muted)' }}>暂无入住</span>;
    }
    return (
      <Space size={4} wrap>
        {occupiedStudents.slice(0, 4).map((student, index) => (
          <Tag key={index} color="blue">{student.name || student.studentNo}</Tag>
        ))}
        {occupiedStudents.length > 4 && <Tag>+{occupiedStudents.length - 4}</Tag>}
      </Space>
    );
  }
  if (column.fieldKey === "monitorName") {
    // 从 beds 数组中查找寝室长（isMonitor 为 true 的学生）
    const beds = dorm.beds || dorm.dormBeds || [];
    const monitor = (beds as DormBedRecord[]).find((bed) => bed.student?.isMonitor || bed.isMonitor);
    if (monitor) {
      const monitorName = monitor.studentName || monitor.student?.fullName || monitor.student?.name;
      return <Tag color="purple">{monitorName || '未命名'}</Tag>;
    }
    // 如果后端直接返回了 monitorName 字段
    if (dorm.monitorName) {
      return <Tag color="purple">{dorm.monitorName}</Tag>;
    }
    return <span style={{ color: 'var(--co-text-muted)' }}>未设置</span>;
  }
  const value = dorm[column.fieldKey];
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return "-";
};

// ===== 创建基础列定义 =====
export const createBaseColumns = (
  visibleColumns: DormColumnConfig[],
  sortField: string,
  sortOrder: 'asc' | 'desc',
): ColumnsType<DormRecord> => {
  return visibleColumns.map((column) => ({
    title: column.label,
    dataIndex: column.fieldKey,
    key: column.fieldKey,
    width: COLUMN_WIDTHS[column.fieldKey] || 120,
    sorter: column.sortable,
    sortOrder: sortField === column.fieldKey ? (sortOrder === "asc" ? "ascend" : "descend") : null,
    ellipsis: column.fieldKey !== "occupancy",
    render: (_, record) => renderDormCell(record, column),
  }));
};

// ===== 创建操作列 =====
export const createActionColumn = ({ 
  canEdit, 
  onView, 
  onEdit, 
  onDelete 
}: {
  canEdit: boolean;
  onView: (record: DormRecord) => void;
  onEdit: (record: DormRecord) => void;
  onDelete: (id: EntityId) => Promise<void>;
}) => ({
  title: "操作",
  key: "action",
  width: 108,
  fixed: "right",
  className: "table-action-column",
  render: (_: unknown, record: DormRecord) => (
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
      <Tooltip title="编辑宿舍">
        <Button
          type="text"
          size="small"
          icon={<EditOutlined />}
          disabled={!canEdit}
          onClick={() => onEdit(record)}
          className="dorm-table-action-btn is-edit"
          aria-label="编辑宿舍"
        />
      </Tooltip>
      <Tooltip title="删除宿舍">
        <Button
          type="text"
          size="small"
          danger
          icon={<DeleteOutlined />}
          disabled={!canEdit}
          onClick={() => {
            if (record.id !== undefined && record.id !== null) {
              void onDelete(record.id);
            }
          }}
          className="dorm-table-action-btn is-danger"
          aria-label="删除宿舍"
        />
      </Tooltip>
    </Space>
  ),
});
