/**
 * 学生管理筛选 Schema
 * 集中管理筛选字段定义、默认值、归一化函数等
 * @module pages/student/studentFilterSchema
 */

import { createBuildTableParams } from "../../utils/tableParamsBuilder";

import type {
  StudentColumnConfig,
  StudentFilterOptionsData,
  StudentFilterOptionsResult,
  StudentFilters,
  StudentFormState,
  StudentTableParams,
} from "./types";

/**
 * 学生管理筛选字段键值列表
 */
export const STUDENT_FILTER_KEYS = [
  "grade",
  "gender",
  "building",
  "floor",
  "roomNo",
  "college",
  "className",
];

/**
 * 性别归一化函数 - Student 特有
 * 将各种性别表示方式统一为标准格式
 * @param {string} value - 原始性别值
 * @returns {string} 归一化后的性别值
 */
export const normalizeStudentGender = (value = ""): string => {
  const normalized = value?.toString().trim();
  if (!normalized) return "";
  if (["男", "M", "m", "♂"].includes(normalized)) return "男";
  if (["女", "F", "f", "♀"].includes(normalized)) return "女";
  if (["未指定", "未知", "未选择"].includes(normalized)) return "未指定";
  return normalized;
};

/**
 * 使用 tableParamsBuilder 创建参数构建函数
 */
export const buildStudentTableParams = createBuildTableParams({
  filterKeys: STUDENT_FILTER_KEYS,
  normalizers: {
    gender: normalizeStudentGender,
  },
}) as (
  appliedFilters: StudentFilters,
  appliedSearchTerm: string,
  pagination: { current: number; pageSize: number },
  sortField: string,
  sortOrder: 'asc' | 'desc',
  withPaging?: boolean,
) => StudentTableParams;

/**
 * 学生表格字段配置
 */
export const STUDENT_TABLE_KEY = "studentList";

/**
 * 学生表格默认列配置
 */
export const STUDENT_DEFAULT_COLUMNS: StudentColumnConfig[] = [
  {
    fieldKey: "studentNo",
    label: "学号",
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
  { fieldKey: "grade", label: "年级", visible: true, sortable: true, order: 2 },
  {
    fieldKey: "educationLevel",
    label: "培养层次",
    visible: true,
    sortable: true,
    order: 3,
  },
  {
    fieldKey: "college",
    label: "学院",
    visible: true,
    sortable: true,
    order: 4,
  },
  { fieldKey: "major", label: "专业", visible: true, sortable: true, order: 5 },
  {
    fieldKey: "className",
    label: "班级",
    visible: true,
    sortable: true,
    order: 6,
  },
  {
    fieldKey: "gender",
    label: "性别",
    visible: true,
    sortable: true,
    order: 7,
  },
  {
    fieldKey: "status",
    label: "学籍状态",
    visible: true,
    sortable: true,
    order: 8,
  },
  {
    fieldKey: "building",
    label: "宿舍楼栋",
    visible: true,
    sortable: true,
    order: 9,
  },
  {
    fieldKey: "roomNo",
    label: "宿舍号",
    visible: true,
    sortable: true,
    order: 10,
  },
  {
    fieldKey: "bedNo",
    label: "床位号",
    visible: true,
    sortable: true,
    order: 11,
  },
  {
    fieldKey: "mobile",
    label: "手机号",
    visible: true,
    sortable: false,
    order: 12,
  },
  { fieldKey: "qq", label: "QQ号", visible: true, sortable: false, order: 13 },
  {
    fieldKey: "isMonitor",
    label: "是否寝室长",
    visible: true,
    sortable: false,
    order: 14,
  },
];

/**
 * 计算已激活的筛选条件数量
 * @param {Object} draftFilters - 草稿筛选器状态
 * @returns {number} 已激活的筛选项数量
 */
export function getActiveFilterCount(draftFilters: StudentFilters | null | undefined): number {
  if (!draftFilters) return 0;
  return (
    (draftFilters.grade?.length || 0) +
    (draftFilters.gender?.length || 0) +
    (draftFilters.building?.length || 0) +
    (draftFilters.floor?.length || 0) +
    (draftFilters.roomNo?.length || 0) +
    (draftFilters.college?.length || 0) +
    (draftFilters.major?.length || 0) +
    (draftFilters.className?.length || 0)
  );
}

/**
 * 中文拼音排序辅助函数
 */
export const pinyinSort = (a: string, b: string): number =>
  a.localeCompare(b, 'zh-CN', { sensitivity: 'base' });

/**
 * 创建筛选选项（从 filterOptionsData 派生）
 * @param {Object} filterOptions - API 返回的筛选选项数据
 * @param {Object} draftFilters - 草稿筛选器状态
 * @returns {Object} 处理后的唯一值列表
 */
export function createFilterOptions(
  filterOptions: StudentFilterOptionsData | null | undefined,
  draftFilters: StudentFilters | null | undefined,
): StudentFilterOptionsResult {
  // 年级按降序排列（最新年级在前）
  const uniqueGrades = [...(filterOptions?.grades || [])].sort((a, b) => b.localeCompare(a));

  // 学院按拼音排序
  const uniqueColleges = [...(filterOptions?.colleges || [])].sort(pinyinSort);

  // 专业：支持级联过滤（如果选了学院，只显示该学院下的专业）
  const allMajors = filterOptions?.majors || [];
  let uniqueMajors: string[];
  if (!draftFilters?.college?.length) {
    // 未选学院时，返回所有专业名称（去重并按拼音排序）
    uniqueMajors = [...new Set(allMajors.map((m) => m.name))].sort(pinyinSort);
  } else {
    // 选了学院时，过滤出该学院下的专业
    uniqueMajors = allMajors
      .filter((m) => draftFilters.college.includes(m.college))
      .map((m) => m.name)
      .filter((value, index, values) => values.indexOf(value) === index)
      .sort(pinyinSort);
  }

  // 班级：支持级联过滤
  const allClasses = filterOptions?.classNames || [];
  let filteredClasses = allClasses;

  // 如果选了专业，按专业过滤
  if (draftFilters?.major?.length) {
    filteredClasses = filteredClasses.filter((c) =>
      draftFilters.major.includes(c.major)
    );
  }
  // 如果只选了学院但未选专业，需要先找出该学院下的所有专业，再过滤班级
  else if (draftFilters?.college?.length) {
    const majorsInCollege = allMajors
      .filter((m) => draftFilters.college.includes(m.college))
      .map((m) => m.name);
    filteredClasses = filteredClasses.filter((c) => majorsInCollege.includes(c.major));
  }

  const uniqueClassNames = filteredClasses
    .map((c) => c.name)
    .filter((value, index, values) => values.indexOf(value) === index)
    .sort(pinyinSort);

  return {
    uniqueGrades,
    uniqueColleges,
    uniqueMajors,
    uniqueClassNames,
  };
}

/**
 * 初始表单数据
 */
export const initialStudentForm: StudentFormState = {
  studentNo: "",
  fullName: "",
  grade: "",
  gender: "男",
  educationLevel: "",
  college: "",
  major: "",
  className: "",
  status: "",
  mobile: "",
  qq: "",
  idType: "",
  idNumber: "",
  politicalStatus: "",
  birthDate: "",
  ethnicity: "",
  nativePlace: "",
  sourcePlace: "",
  homeAddress: "",
  isMonitor: false,
};
