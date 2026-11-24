/**
 * buildingSchema.jsx - 楼栋管理 Schema 与常量定义
 *
 * SSOT: 筛选字段定义、默认值、归一化函数、统计计算
 */

import type { UploadResolution } from '../../types/service';
import type {
  BuildingFiltersState,
  BuildingRecord,
  BuildingStatsState,
} from './types';

export interface BuildingOption {
  label: string;
  value: string;
}

// ===== 表格配置常量 =====
export const BUILDING_TABLE_KEY = "building_management_columns";

// ===== 筛选字段定义 =====
export const BUILDING_FILTER_KEYS = ["campus", "type"];

// ===== 默认筛选值 =====
export function createDefaultBuildingFilters(): BuildingFiltersState {
  return {
    campus: [],
    type: [],
  };
}

// ===== 表单默认值 =====
export const BUILDING_FORM_DEFAULTS = {
  floors: 6,
  hasElevator: false,
  type: "混合",
  campus: "本部",
};

// ===== 类型选项定义 =====
export const BUILDING_TYPE_OPTIONS: BuildingOption[] = [
  { label: "男生楼", value: "男" },
  { label: "女生楼", value: "女" },
  { label: "混合楼", value: "混合" },
];

// ===== 导入冲突处理选项 =====
export const IMPORT_RESOLUTION_OPTIONS: Array<{
  label: string;
  value: UploadResolution;
}> = [
  { label: "覆盖现有数据（推荐）", value: "overwrite" },
  { label: "跳过重复项", value: "skip" },
];

// ===== 工具函数：筛选值归一化 =====
export function normalizeFilterValues(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return values.map((value) => String(value)).sort();
}

// ===== 工具函数：数组相等比较 =====
export function areArraysEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  for (let i = 0; i < left.length; i += 1) {
    if (left[i] !== right[i]) return false;
  }
  return true;
}

// ===== 工具函数：筛选条件相等比较 =====
export function areBuildingFiltersEqual(
  left: Partial<BuildingFiltersState> | undefined,
  right: Partial<BuildingFiltersState> | undefined,
): boolean {
  return BUILDING_FILTER_KEYS.every((key) =>
    areArraysEqual(
      normalizeFilterValues(left?.[key]),
      normalizeFilterValues(right?.[key]),
    ),
  );
}

// ===== 统计计算工具 =====
export function calculateBuildingStats(
  buildings: BuildingRecord[] = [],
): BuildingStatsState {
  const total = buildings.length;
  const totalDorms = buildings.reduce(
    (sum, building) => sum + (building.dormCount || 0),
    0,
  );
  const maleBuildings = buildings.filter((building) => building.type === "男").length;
  const femaleBuildings = buildings.filter((building) => building.type === "女").length;
  const mixedBuildings = buildings.filter((building) => building.type === "混合").length;
  const withElevator = buildings.filter((building) => building.hasElevator).length;
  return {
    total,
    totalDorms,
    maleBuildings,
    femaleBuildings,
    mixedBuildings,
    withElevator,
  };
}

// ===== 校区唯一值提取 =====
export function extractUniqueCampuses(buildings: BuildingRecord[] = []): string[] {
  return [
    ...new Set(
      buildings
        .map((building) => building.campus)
        .filter((campus): campus is string => Boolean(campus)),
    ),
  ].sort();
}
