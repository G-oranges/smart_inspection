/**
 * 教职工移动端卡片组件
 * @module pages/teacher/TeacherMobileCard
 */

import { Space, Tag } from "antd";

import type { TeacherRecord } from './types';

interface TeacherMobileCardProps {
  teacher: TeacherRecord;
  index?: number;
  selected?: boolean;
  onSelect?: (selected: boolean) => void;
}

/**
 * 教职工移动端卡片
 * @param {Object} props - 组件属性
 * @param {Object} props.teacher - 教职工数据
 * @param {number} props.index - 索引
 * @param {boolean} props.selected - 是否选中
 * @param {Function} props.onSelect - 选择回调
 */
export default function TeacherMobileCard({
  teacher,
  index: _index,
  selected = false,
  onSelect,
}: TeacherMobileCardProps) {
  return (
    <div
      className={`mobile-compact-card relative overflow-hidden transition-all duration-300 ${
        selected
          ? "selected ring-2 ring-ios-blue ring-offset-2"
          : "hover:shadow-md"
      }`}
      onClick={() => onSelect && onSelect(!selected)}
      style={{ marginBottom: 12, borderRadius: "16px" }}
    >
      {/* Header */}
      <div className="compact-card-header">
        <div className="compact-header-left">
          <div className="compact-title font-bold text-gray-800 dark:text-gray-100">
            {teacher.fullName || "-"}
          </div>
          <div className="compact-subtitle text-gray-400">
            {teacher.employeeNo || teacher.username}
          </div>
        </div>
        <div className="compact-header-right">
          <Space size={4}>
            {teacher.gender && (
              <Tag
                className="rounded-full border-none px-2"
                color={
                  teacher.gender === "男"
                    ? "blue"
                    : teacher.gender === "女"
                    ? "magenta"
                    : "orange"
                }
              >
                {teacher.gender}
              </Tag>
            )}
          </Space>
        </div>
      </div>

      {/* Grid */}
      <div className="compact-card-grid mt-3">
        <div className="compact-info-item">
          <span className="compact-label text-gray-400">院系/部门</span>
          <span className="compact-value font-medium">
            {teacher.department || "-"}
          </span>
        </div>
        <div className="compact-info-item">
          <span className="compact-label text-gray-400">手机号</span>
          <span className="compact-value font-medium">
            {teacher.mobile || "-"}
          </span>
        </div>
        <div className="compact-info-item" style={{ gridColumn: "span 2" }}>
          <span className="compact-label text-gray-400">负责班级</span>
          <span className="compact-value font-medium">
            {teacher.classes || "-"}
          </span>
        </div>
      </div>
    </div>
  );
}
