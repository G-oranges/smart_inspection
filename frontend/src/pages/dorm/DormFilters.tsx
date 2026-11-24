/**
 * DormFilters.jsx - 宿舍筛选区组件
 * 
 * 包含桌面端筛选下拉面板配置和移动端筛选配置生成器
 */
import type { Dispatch, SetStateAction } from 'react';
import { GENDER_OPTIONS, OCCUPANCY_STATUS_OPTIONS } from "./dormFilterSchema";
import CollegeMajorClassCascader from "../../components/common/CollegeMajorClassCascader";

import type { DormFiltersState } from './types';

interface DormFilterConfigOption {
  key: string;
  label: string;
  options?: Array<{ label: string; value: string }>;
  value: string[];
  onChange?: (values: string[]) => void;
  searchable?: boolean;
  customRender?: React.ReactNode;
}

interface CreateDormFilterConfigOptions {
  draftFilters: DormFiltersState;
  setDraftFilters: Dispatch<SetStateAction<DormFiltersState>>;
  uniqueBuildings: string[];
  uniqueFloors: Array<string | number>;
  uniqueGrades: string[];
}

/**
 * 生成桌面端筛选配置
 * @param {Object} params
 * @param {Object} params.draftFilters - 草稿筛选状态
 * @param {Function} params.setDraftFilters - 更新草稿筛选
 * @param {Array} params.uniqueBuildings - 楼栋选项
 * @param {Array} params.uniqueFloors - 楼层选项
 * @param {Array} params.uniqueGrades - 年级选项
 * @returns {Array} 筛选配置数组
 */
export const createDesktopFilterConfig = ({
  draftFilters,
  setDraftFilters,
  uniqueBuildings,
  uniqueFloors,
  uniqueGrades,
}: CreateDormFilterConfigOptions): DormFilterConfigOption[] => [
  {
    key: 'building',
    label: '楼栋',
    options: uniqueBuildings.map((building) => ({ label: building, value: building })),
    value: draftFilters.building || [],
    onChange: (val: string[]) => {
      setDraftFilters((prev) => ({ ...prev, building: val, floor: [] }));
    },
  },
  {
    key: 'floor',
    label: '楼层',
    options: uniqueFloors.map((floor) => ({ label: `${floor} 层`, value: String(floor) })),
    value: draftFilters.floor || [],
    onChange: (val: string[]) => {
      setDraftFilters((prev) => ({ ...prev, floor: val }));
    },
  },
  {
    key: 'grade',
    label: '年级',
    options: uniqueGrades.map((grade) => ({ label: grade, value: grade })),
    value: draftFilters.grade || [],
    onChange: (val: string[]) => {
      setDraftFilters((prev) => ({ ...prev, grade: val }));
    },
  },
  {
    key: 'gender',
    label: '性别',
    options: GENDER_OPTIONS,
    value: draftFilters.gender || [],
    onChange: (val: string[]) => {
      setDraftFilters((prev) => ({ ...prev, gender: val }));
    },
    searchable: false,
  },
  {
    key: 'occupancyStatus',
    label: '空余情况',
    options: OCCUPANCY_STATUS_OPTIONS,
    value: draftFilters.occupancyStatus || [],
    onChange: (val: string[]) => {
      setDraftFilters((prev) => ({
        ...prev,
        occupancyStatus: val,
      }));
    },
    searchable: false,
  },
  {
    key: 'college_major_class',
    label: '学院 / 专业 / 班级',
    value: [
      ...(draftFilters.college || []),
      ...(draftFilters.major || []),
      ...(draftFilters.className || []),
    ],
    customRender: (
      <CollegeMajorClassCascader
        value={{
          college: draftFilters.college,
          major: draftFilters.major,
          className: draftFilters.className,
        }}
        onChange={(val) => {
          setDraftFilters((prev) => ({
            ...prev,
            college: val.college || [],
            major: val.major || [],
            className: val.className || [],
          }));
        }}
      />
    )
  }
];

/**
 * 生成移动端筛选配置
 * @param {Object} params
 * @param {Object} params.draftFilters - 草稿筛选状态
 * @param {Function} params.setDraftFilters - 更新草稿筛选
 * @param {Array} params.uniqueBuildings - 楼栋选项
 * @param {Array} params.uniqueFloors - 楼层选项
 * @param {Array} params.uniqueGrades - 年级选项
 * @returns {Array} 筛选配置数组
 */
export const createMobileFilterConfig = ({
  draftFilters,
  setDraftFilters,
  uniqueBuildings,
  uniqueFloors,
  uniqueGrades,
}: CreateDormFilterConfigOptions): DormFilterConfigOption[] => [
  {
    key: 'building',
    label: '楼栋',
    options: uniqueBuildings.map((building) => ({ label: building, value: building })),
    value: draftFilters.building || [],
    onChange: (val: string[]) => {
      setDraftFilters((prev) => ({ ...prev, building: val, floor: [] }));
    },
  },
  {
    key: 'floor',
    label: '楼层',
    options: uniqueFloors.map((floor) => ({ label: `${floor} 层`, value: String(floor) })),
    value: draftFilters.floor || [],
    onChange: (val: string[]) => {
      setDraftFilters((prev) => ({ ...prev, floor: val }));
    },
  },
  {
    key: 'grade',
    label: '年级',
    options: uniqueGrades.map((grade) => ({ label: grade, value: grade })),
    value: draftFilters.grade || [],
    onChange: (val: string[]) => {
      setDraftFilters((prev) => ({ ...prev, grade: val }));
    },
  },
  {
    key: 'gender',
    label: '性别',
    options: GENDER_OPTIONS,
    value: draftFilters.gender || [],
    onChange: (val: string[]) => {
      setDraftFilters((prev) => ({ ...prev, gender: val }));
    },
    searchable: false,
  },
  {
    key: 'occupancyStatus',
    label: '空余情况',
    options: OCCUPANCY_STATUS_OPTIONS,
    value: draftFilters.occupancyStatus || [],
    onChange: (val: string[]) => {
      setDraftFilters((prev) => ({
        ...prev,
        occupancyStatus: val,
      }));
    },
    searchable: false,
  },
  {
    key: 'college_major_class',
    label: '学院 / 专业 / 班级',
    value: [
      ...(draftFilters.college || []),
      ...(draftFilters.major || []),
      ...(draftFilters.className || []),
    ],
    customRender: (
      <CollegeMajorClassCascader
        isMobile={true}
        value={{
          college: draftFilters.college,
          major: draftFilters.major,
          className: draftFilters.className,
        }}
        onChange={(val) => {
          setDraftFilters((prev) => ({
            ...prev,
            college: val.college || [],
            major: val.major || [],
            className: val.className || [],
          }));
        }}
      />
    )
  }
];

/**
 * 计算筛选器选中计数（用于移动端筛选按钮 badge）
 * @param {Object} draftFilters - 草稿筛选状态
 * @returns {number} 选中的筛选项总数
 */
export const getFilterCount = (draftFilters: DormFiltersState): number => {
  return (
    (draftFilters.building?.length || 0) +
    (draftFilters.floor?.length || 0) +
    (draftFilters.grade?.length || 0) +
    (draftFilters.gender?.length || 0) +
    (draftFilters.college?.length || 0) +
    (draftFilters.major?.length || 0) +
    (draftFilters.className?.length || 0)
  );
};
