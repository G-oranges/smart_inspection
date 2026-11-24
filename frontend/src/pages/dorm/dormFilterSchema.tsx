/**
 * dormFilterSchema.jsx - 宿舍管理筛选 Schema 与常量定义
 * 
 * SSOT: 筛选字段定义、默认值、归一化函数
 */

import type { DormBedRecord, DormColumnConfig, DormFiltersState, DormRecord, DormStatsState } from './types';

// ===== 表格配置常量 =====
export const DORM_TABLE_KEY = "dormList";

// ===== 默认列配置 =====
export const DORM_DEFAULT_COLUMNS: DormColumnConfig[] = [
  { fieldKey: "campus", label: "校区", visible: true, sortable: true, order: 0 },
  { fieldKey: "building", label: "楼栋", visible: true, sortable: true, order: 1 },
  { fieldKey: "floor", label: "楼层", visible: true, sortable: true, order: 2 },
  { fieldKey: "roomNo", label: "房号", visible: true, sortable: true, order: 3 },
  { fieldKey: "college", label: "所属学院", visible: true, sortable: false, order: 4 },
  { fieldKey: "capacity", label: "可住人数", visible: true, sortable: true, order: 5 },
  { fieldKey: "occupancy", label: "占用情况", visible: true, sortable: false, order: 6 },
  { fieldKey: "availableBeds", label: "空余床位", visible: false, sortable: true, order: 7 },
  { fieldKey: "gender", label: "宿舍性别", visible: true, sortable: true, order: 8 },
  { fieldKey: "grade", label: "年级", visible: true, sortable: true, order: 9 },
  { fieldKey: "studentList", label: "入住学生", visible: false, sortable: false, order: 10 },
  { fieldKey: "monitorName", label: "寝室长", visible: false, sortable: false, order: 11 },
];

// ===== 筛选字段定义 =====
export const DORM_FILTER_KEYS = [
  "building",
  "floor",
  "grade",
  "gender",
  "college",
  "major",
  "className",
  "occupancyStatus",
];

// ===== 性别归一化函数 =====
export const normalizeDormGender = (value = ""): string => {
  const normalized = value?.trim();
  if (!normalized) return "";
  if (["男生宿舍", "男生", "男", "♂"].includes(normalized)) return "男";
  if (["女生宿舍", "女生", "女", "♀"].includes(normalized)) return "女";
  return normalized;
};

// ===== 筛选选项定义（用于桌面/移动端筛选器） =====
export const GENDER_OPTIONS: Array<{ label: string; value: string }> = [
  { label: "男", value: "男" },
  { label: "女", value: "女" },
  { label: "混合", value: "混合" },
  { label: "未指定", value: "未指定" },
];

export const OCCUPANCY_STATUS_OPTIONS: Array<{ label: string; value: string }> = [
  { label: "无空床", value: "full" },
  { label: "有空床", value: "partial" },
  { label: "全空", value: "empty" },
];

// ===== 统计计算工具 =====
export const calculateDormStats = (dorms: DormRecord[] = []): DormStatsState => {
  const total = dorms.length;
  const capacitySum = dorms.reduce((sum, item) => sum + (Number(item.capacity) || 0), 0);
  const occupiedSum = dorms.reduce((sum, item) => sum + (Number(item.occupiedCount) || 0), 0);
  const maleDorms = dorms.filter((item) => normalizeDormGender(item.gender) === "男").length;
  const femaleDorms = dorms.filter((item) => normalizeDormGender(item.gender) === "女").length;
  return { total, capacitySum, occupiedSum, maleDorms, femaleDorms };
};

// ===== 床位数据映射工具 =====
export const mapRoomToBeds = (room: DormRecord) => {
  const roomId = room.id;
  
  // 优先使用后端聚合的 beds/dormBeds 字段
  const dormBeds = room.beds || room.dormBeds || null;
  if (Array.isArray(dormBeds) && dormBeds.length) {
    return dormBeds.map((bed: DormBedRecord) => ({
      key: `${roomId}-${bed.bedNo}`,
      dormId: roomId,
      bedNo: bed.bedNo,
      status: (bed.studentId || bed.student?.id) ? "OCCUPIED" : "VACANT",
      studentId: bed.studentId || bed.student?.id,
      studentName: bed.studentName || bed.student?.fullName || bed.student?.name || null,
      studentNo: bed.studentNo || bed.student?.studentNo || null,
      gender: bed.gender || bed.student?.gender,
    }));
  }

  // 其次按 capacity 生成空床位
  const cap = Number(room.capacity || 0);
  if (cap > 0) {
    return Array.from({ length: cap }, (_, i) => {
      const bedNo = String(i + 1);
      return {
        key: `${roomId}-${bedNo}`,
        dormId: roomId,
        bedNo,
        status: "VACANT",
        studentId: null,
        studentName: null,
        gender: null,
      };
    });
  }

  return [];
};
