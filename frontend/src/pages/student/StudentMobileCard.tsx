/**
 * 学生管理移动端卡片组件
 * @module pages/student/StudentMobileCard
 */

import { Space, Tag } from "antd";

import type { StudentMobileCardProps } from "./types";

/**
 * 学生移动端紧凑卡片
 * @param {Object} props
 * @param {Object} props.student - 学生数据对象
 * @param {number} props.index - 卡片索引
 * @param {boolean} props.selected - 是否选中
 * @param {Function} props.onSelect - 选中回调
 */
export default function StudentMobileCard({
  student,
  selected,
  onSelect,
}: StudentMobileCardProps) {
  return (
    <div
      className={`mobile-compact-card ${selected ? "selected" : ""}`}
      onClick={() => onSelect && onSelect(!selected)}
    >
      {/* Header */}
      <div className="compact-card-header">
        <div className="compact-header-left">
          <div className="compact-title">{student.fullName || "-"}</div>
          <div className="compact-subtitle">{student.studentNo}</div>
        </div>
        <div className="compact-header-right">
          <Space size={4}>
            {student.gender && (
              <Tag
                color={
                  student.gender === "男"
                    ? "blue"
                    : student.gender === "女"
                    ? "magenta"
                    : "default"
                }
                style={{ margin: 0, fontSize: 10 }}
              >
                {student.gender}
              </Tag>
            )}
            {student.status && (
              <Tag
                color={
                  student.status === "在读"
                    ? "green"
                    : student.status === "休学"
                    ? "orange"
                    : student.status === "退学"
                    ? "red"
                    : "default"
                }
                style={{ margin: 0, fontSize: 10 }}
              >
                {student.status}
              </Tag>
            )}
          </Space>
        </div>
      </div>

      {/* Grid */}
      <div className="compact-card-grid">
        <div className="compact-info-item">
          <span className="compact-label">年级</span>
          <span className="compact-value">{student.grade || "-"}</span>
        </div>
        <div className="compact-info-item">
          <span className="compact-label">专业</span>
          <span className="compact-value">{student.major || "-"}</span>
        </div>
        <div className="compact-info-item">
          <span className="compact-label">班级</span>
          <span className="compact-value">{student.className || "-"}</span>
        </div>
        <div className="compact-info-item">
          <span className="compact-label">宿舍</span>
          <span className="compact-value">
            {student.roomNo
              ? `${student.building || ""} ${student.roomNo}`
              : "-"}
          </span>
        </div>
        <div className="compact-info-item" style={{ gridColumn: "span 2" }}>
          <span className="compact-label">手机号</span>
          <span className="compact-value">
            {student.mobile || "-"}
          </span>
        </div>
      </div>
    </div>
  );
}
