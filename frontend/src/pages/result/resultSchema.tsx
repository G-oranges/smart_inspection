import type { ResultFiltersState } from './types';

export const RESULT_FILTER_KEYS = ["taskId", "grade", "college", "level", "gender"];

export const RESULT_SORT_VALUES = {
  TIME_DESC: "time_desc",
  TIME_ASC: "time_asc",
  SCORE_DESC: "score_desc",
  SCORE_ASC: "score_asc",
};

export const RESULT_DEFAULT_SORT = RESULT_SORT_VALUES.TIME_DESC;

export const INITIAL_FILTERS: ResultFiltersState = {
  keyword: "",
  taskId: [],
  grade: [],
  college: [],
  level: [],
  gender: [],
  dateRange: [],
  sort: RESULT_DEFAULT_SORT,
};

export const RESULT_FILTER_LABELS: Record<keyof ResultFiltersState, string> = {
  keyword: "关键词",
  taskId: "任务",
  grade: "年级",
  college: "学院",
  level: "等级",
  gender: "宿舍性别",
  dateRange: "日期范围",
  sort: "排序方式",
};

export const RESULT_GENDER_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "男生宿舍", label: "男生宿舍" },
  { value: "女生宿舍", label: "女生宿舍" },
  { value: "未指定", label: "未指定" },
];

export const RESULT_SORT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: RESULT_SORT_VALUES.TIME_DESC, label: "时间从新到旧" },
  { value: RESULT_SORT_VALUES.TIME_ASC, label: "时间从旧到新" },
  { value: RESULT_SORT_VALUES.SCORE_DESC, label: "分数从高到低" },
  { value: RESULT_SORT_VALUES.SCORE_ASC, label: "分数从低到高" },
];

export const GRADE_COLORS: Record<string, string> = {
  优秀: "green",
  良好: "blue",
  合格: "gold",
  不合格: "red",
  未评分: "default",
};

export const INITIAL_REVIEW_FORM = {
  inspectionId: "",
  totalScore: "",
  comments: "",
  photoUrls: [],
};
