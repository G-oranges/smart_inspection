/**
 * 入住管理筛选表单 Schema
 * 用于 MobileAdvancedFilter 和桌面端筛选组件
 */

import type { Dispatch, SetStateAction } from "react";
import { DatePicker } from "antd";

import type {
  HistoryFiltersState,
  OccupancyFilterConfig,
  OccupancyOverviewFilters,
} from "./types";

/**
 * 创建 Overview Tab 筛选配置
 */
export function createOverviewFilterSchema({
  draftFilters,
  setDraftFilters,
  uniqueColleges,
  uniqueBuildings,
  uniqueGrades,
  uniqueFloors,
}: {
  draftFilters: OccupancyOverviewFilters;
  setDraftFilters: Dispatch<SetStateAction<OccupancyOverviewFilters>>;
  uniqueColleges: string[];
  uniqueBuildings: string[];
  uniqueGrades: string[];
  uniqueFloors: Array<string | number>;
}): OccupancyFilterConfig[] {
  const statusValues = Array.isArray(draftFilters.status)
    ? draftFilters.status
    : [];

  return [
    {
      key: 'status',
      label: '入住状态',
      multiple: false,
      options: [
        { label: '全部状态', value: 'all' },
        { label: '已入住', value: 'occupied' },
        { label: '未入住', value: 'none' }
      ],
      value: statusValues,
      onChange: (val: string[]) => {
        const nextStatus =
          val.length > 0 && val[0] !== "all" ? [val[0]] : [];
        setDraftFilters((prev) => ({
          ...prev,
          status: nextStatus,
        }));
      },
    },
    {
      key: 'college',
      label: '学院',
      options: uniqueColleges.map(c => ({ label: c, value: c })),
      value: draftFilters.college || [],
      onChange: (val: string[]) => {
        setDraftFilters((prev) => ({ ...prev, college: val }));
      },
    },
    {
      key: 'building',
      label: '楼栋',
      options: uniqueBuildings.map(b => ({ label: b, value: b })),
      value: draftFilters.building || [],
      onChange: (val: string[]) => {
        setDraftFilters((prev) => ({ ...prev, building: val }));
      },
    },
    {
      key: 'grade',
      label: '年级',
      options: uniqueGrades.map(g => ({ label: g, value: g })),
      value: draftFilters.grade || [],
      onChange: (val: string[]) => {
        setDraftFilters((prev) => ({ ...prev, grade: val }));
      },
    },
    {
      key: 'floor',
      label: '楼层',
      options: uniqueFloors.map((floor) => ({
        label: `${floor} 层`,
        value: String(floor),
      })),
      value: draftFilters.floor || [],
      onChange: (val: string[]) => {
        setDraftFilters((prev) => ({ ...prev, floor: val }));
      },
    },
  ];
}

/**
 * 创建 History Tab 筛选配置
 */
export function createHistoryFilterSchema({
  historyDraftFilters,
  setHistoryDraftFilters,
}: {
  historyDraftFilters: HistoryFiltersState;
  setHistoryDraftFilters: Dispatch<SetStateAction<HistoryFiltersState>>;
}): OccupancyFilterConfig[] {
  return [
    {
      key: 'action',
      label: '异动类型',
      multiple: false,
      options: [
        { label: '入住', value: 'CREATE' },
        { label: '调宿', value: 'UPDATE' },
        { label: '互换床位', value: 'SWAP' },
        { label: '退宿', value: 'DELETE' },
      ],
      value: historyDraftFilters.action
        ? [historyDraftFilters.action]
        : [],
      onChange: (val: string[]) => {
        setHistoryDraftFilters((prev) => ({
          ...prev,
          action: val[0],
        }));
      },
    },
    {
      key: 'dateRange',
      label: '时间范围',
      customRender: (
        <DatePicker.RangePicker 
          showTime={{ format: 'HH:mm' }}
          variant="filled"
          needConfirm={false}
          placeholder={['开始', '结束']}
          value={historyDraftFilters.dateRange}
          onChange={(dates) =>
            setHistoryDraftFilters((prev) => ({
              ...prev,
              dateRange: dates as HistoryFiltersState['dateRange'],
            }))
          }
          className="w-full apple-range-picker"
          format="YYYY-MM-DD HH:mm"
        />
      ),
      value: historyDraftFilters.dateRange ? ["custom"] : [],
      onChange: () => {},
      searchable: false,
    }
  ];
}

/**
 * 计算筛选条件数量（用于移动端筛选按钮徽标）
 */
export function getActiveFilterCount(draftFilters: OccupancyOverviewFilters): number {
  return (
    (draftFilters.building?.length || 0) +
    (draftFilters.college?.length || 0) +
    (draftFilters.grade?.length || 0) +
    (draftFilters.floor?.length || 0) +
    (draftFilters.status?.length || 0)
  );
}
