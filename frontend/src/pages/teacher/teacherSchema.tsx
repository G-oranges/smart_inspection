/**
 * 教职工管理模块 Schema 与常量
 * @module pages/teacher/teacherSchema
 * 
 * SSOT：常量、默认值、filterKeys、枚举、渲染器等
 */

import { Tag } from "antd";
import { createBuildTableParams } from "../../utils/tableParamsBuilder";

import type { TeacherColumnConfig, TeacherFormValues, TeacherRecord, TeacherTableParams } from './types';

// ===================== 表格配置常量 =====================

/**
 * 表格配置存储 Key
 */
export const TEACHER_TABLE_KEY = "teacherList";

/**
 * 筛选字段 Keys
 */
export const TEACHER_FILTER_KEYS = ["department"];

/**
 * 默认列配置
 */
export const TEACHER_DEFAULT_COLUMNS: TeacherColumnConfig[] = [
  {
    fieldKey: "employeeNo",
    label: "工号",
    visible: true,
    sortable: true,
    order: 0,
  },
  {
    fieldKey: "fullName",
    label: "姓名",
    visible: true,
    sortable: true,
    order: 1,
  },
  {
    fieldKey: "gender",
    label: "性别",
    visible: true,
    sortable: false,
    order: 2,
  },
  {
    fieldKey: "department",
    label: "院系/部门",
    visible: true,
    sortable: true,
    order: 3,
  },
  {
    fieldKey: "mobile",
    label: "手机号",
    visible: true,
    sortable: false,
    order: 4,
  },
  {
    fieldKey: "classes",
    label: "所带班级",
    visible: true,
    sortable: false,
    order: 5,
  },
];

/**
 * 列宽配置
 */
export const TEACHER_COLUMN_WIDTHS: Record<string, number> = {
  employeeNo: 120,
  fullName: 100,
  gender: 70,
  department: 150,
  mobile: 130,
  classes: 200,
};

// ===================== 单元格渲染器 =====================

/**
 * 教职工表格单元格渲染器
 */
export const TEACHER_RENDERERS: Record<string, (teacher: TeacherRecord) => React.ReactNode> = {
  gender: (teacher) => {
    const val = teacher.gender || "-";
    if (val === "-") return val;
    let colorClass = "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400";
    if (val === "女") colorClass = "bg-pink-50 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400";
    
    return (
      <Tag className={`rounded-full border-none px-3 m-0 ${colorClass}`}>
        {val}
      </Tag>
    );
  },
  department: (teacher) => {
    const val = teacher.department || "-";
    if (val === "-") return val;
    return (
      <Tag className="rounded-full border-none px-3 m-0 bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
        {val}
      </Tag>
    );
  },
  mobile: (teacher) => teacher.mobile || "-",
  classes: (teacher) => teacher.classes || "-",
};

// ===================== 参数构建器 =====================

/**
 * 教职工表格参数构建器
 * 使用 tableParamsBuilder 创建
 */
export const buildTeacherTableParams = createBuildTableParams({
  filterKeys: TEACHER_FILTER_KEYS,
  normalizers: {},
});

// ===================== 表单初始值 =====================

/**
 * 教职工表单初始值
 */
export const initialTeacherForm: TeacherFormValues = {
  employeeNo: "",
  fullName: "",
  gender: "男",
  department: "",
  mobile: "",
  classes: "",
};

// ===================== 工具函数 =====================

/**
 * 渲染教职工单元格
 * @param {Object} teacher - 教职工对象
 * @param {Object} column - 列配置
 * @returns {React.ReactNode} 渲染结果
 */
export const renderTeacherCell = (
  teacher: TeacherRecord,
  column: TeacherColumnConfig,
): React.ReactNode => {
  if (typeof column.render === "function") {
    return column.render(teacher);
  }
  if (TEACHER_RENDERERS[column.fieldKey]) {
    return TEACHER_RENDERERS[column.fieldKey](teacher);
  }
  const value = teacher[column.fieldKey];
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return '-';
};

/**
 * 获取唯一院系/部门列表
 * @param {Array} items - 教职工列表
 * @returns {string[]} 唯一院系列表
 */
export const getUniqueDepartments = (items: TeacherRecord[]): string[] => {
  return [
    ...new Set(
      (items || [])
        .map((item) => item.department)
        .filter((department): department is string => Boolean(department))
    ),
  ].sort();
};
