/**
 * BuildingFilters.jsx - 楼栋筛选配置
 * 
 * 桌面端和移动端筛选器配置生成函数
 */
import type { Dispatch, SetStateAction } from 'react';

import { BUILDING_TYPE_OPTIONS } from "./buildingSchema";

import type { BuildingFiltersState } from './types';

interface BuildingFilterOption {
  label: string;
  value: string;
}

interface FilterConfig {
  key: string;
  label: string;
  type?: 'select';
  options: BuildingFilterOption[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
}

interface CreateFilterConfigOptions {
  campusOptions: string[];
  draftFilters: BuildingFiltersState;
  setDraftFilters: Dispatch<SetStateAction<BuildingFiltersState>>;
}

/**
 * 创建桌面端筛选配置
 * @param {Object} params
 * @param {Array} params.campusOptions - 校区选项列表
 * @param {Object} params.draftFilters - 草稿筛选状态
 * @param {Function} params.setDraftFilters - 设置草稿筛选状态
 */
export function createDesktopFilterConfig({
  campusOptions,
  draftFilters,
  setDraftFilters,
}: CreateFilterConfigOptions): FilterConfig[] {
  return [
    {
      key: "campus",
      label: "校区",
      options: campusOptions.map((c) => ({ label: c, value: c })),
      value: draftFilters.campus || [],
      onChange: (val: string[]) =>
        setDraftFilters((prev) => ({
          ...prev,
          campus: val,
        })),
    },
    {
      key: "type",
      label: "类型",
      options: BUILDING_TYPE_OPTIONS,
      value: draftFilters.type || [],
      onChange: (val: string[]) =>
        setDraftFilters((prev) => ({
          ...prev,
          type: val,
        })),
    },
  ];
}

/**
 * 创建移动端筛选配置
 * @param {Object} params
 * @param {Array} params.campusOptions - 校区选项列表
 * @param {Object} params.draftFilters - 草稿筛选状态
 * @param {Function} params.setDraftFilters - 设置草稿筛选状态
 */
export function createMobileFilterConfig({
  campusOptions,
  draftFilters,
  setDraftFilters,
}: CreateFilterConfigOptions): FilterConfig[] {
  return [
    {
      key: "campus",
      label: "校区",
      type: "select",
      options: campusOptions.map((c) => ({ label: c, value: c })),
      value: draftFilters.campus || [],
      onChange: (val: string[]) =>
        setDraftFilters((prev) => ({ ...prev, campus: val })),
      placeholder: "选择校区",
    },
    {
      key: "type",
      label: "类型",
      type: "select",
      options: BUILDING_TYPE_OPTIONS,
      value: draftFilters.type || [],
      onChange: (val: string[]) =>
        setDraftFilters((prev) => ({ ...prev, type: val })),
      placeholder: "选择类型",
    },
  ];
}

/**
 * 获取筛选条件数量
 * @param {Object} filters - 筛选条件对象
 * @returns {number} 筛选条件数量
 */
export function getFilterCount(filters: BuildingFiltersState): number {
  return (filters.campus?.length || 0) + (filters.type?.length || 0);
}
