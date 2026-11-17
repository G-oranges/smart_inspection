/**
 * 学生管理移动端筛选组件
 * @module pages/student/StudentMobileFilters
 */

import { Button, Input } from "antd";
import {
  SearchOutlined,
  FilterOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import MobileAdvancedFilter from "../../components/common/MobileAdvancedFilter";
import CollegeMajorClassCascader from "../../components/common/CollegeMajorClassCascader";

import type {
  MobileSearchBarProps,
  StudentMobileAdvancedFilterProps,
} from "./types";

/**
 * 移动端搜索栏
 */
export function MobileSearchBar({
  draftSearchTerm,
  setDraftSearchTerm,
  isDirty,
  loading,
  onSearch,
  activeFilterCount,
  onOpenFilter,
  onReset,
}: MobileSearchBarProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Input
          placeholder="搜索学生..."
          prefix={<SearchOutlined className="text-gray-400" />}
          className="apple-search-input !rounded-xl !bg-gray-100/60 dark:!bg-white/5 border-none h-10 flex-1"
          value={draftSearchTerm}
          onChange={(e) => setDraftSearchTerm(e.target.value)}
          onPressEnter={onSearch}
          allowClear
        />
        <Button
          type="primary"
          icon={<SearchOutlined />}
          onClick={onSearch}
          disabled={!isDirty}
          loading={loading}
          className="apple-btn-primary h-10 rounded-xl px-4 active:scale-95 transition-all border-none"
        >
          搜索
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <Button
          onClick={onOpenFilter}
          className="h-10 min-w-[44px] rounded-xl border-none bg-gray-100/60 dark:bg-white/5 active:scale-95 transition-all flex items-center justify-center gap-1.5 px-3"
          icon={<FilterOutlined className="text-gray-500 dark:text-gray-400" />}
        >
          {activeFilterCount > 0 ? (
            <span className="px-1.5 py-0.5 text-[11px] bg-ios-blue text-white rounded-full min-w-[18px] text-center font-medium">
              {activeFilterCount}
            </span>
          ) : (
            <span className="text-gray-600 dark:text-gray-300 text-[13px]">
              筛选
            </span>
          )}
        </Button>
        <Button
          onClick={onReset}
          className="h-10 rounded-xl border-none bg-red-50 dark:bg-red-500/10 text-red-500 active:scale-95 transition-all px-4"
          icon={<ReloadOutlined />}
        >
          重置
        </Button>
      </div>
    </div>
  );
}

/**
 * 移动端高级筛选面板
 */
export function StudentMobileAdvancedFilter({
  open,
  onClose,
  onReset,
  draftFilters,
  setDraftFilters,
  uniqueGrades,
  buildings,
  dynamicFloors,
  dynamicRooms,
}: StudentMobileAdvancedFilterProps) {
  return (
    <MobileAdvancedFilter
      open={open}
      onClose={onClose}
      onReset={onReset}
      onConfirm={onClose}
      filters={[
        {
          key: "college_major_class",
          label: "学院专业班级",
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
                  college: val.college ?? [],
                  major: val.major ?? [],
                  className: val.className ?? [],
                }));
              }}
            />
          ),
          onChange: () => {},
        },
        {
          key: "grade",
          label: "年级",
          options: uniqueGrades.map((g) => ({ label: g, value: g })),
          value: draftFilters.grade,
          onChange: (val) =>
            setDraftFilters((prev) => ({ ...prev, grade: val })),
        },
        {
          key: "gender",
          label: "性别",
          options: [
            { label: "男", value: "男" },
            { label: "女", value: "女" },
            { label: "未指定", value: "未指定" },
          ],
          value: draftFilters.gender,
          onChange: (val) =>
            setDraftFilters((prev) => ({ ...prev, gender: val })),
        },
        {
          key: "building",
          label: "宿舍楼栋",
          options: buildings
            .map((building) => building.name)
            .filter((name): name is string => Boolean(name))
            .map((name) => ({ label: name, value: name })),
          value: draftFilters.building,
          onChange: (val) =>
            setDraftFilters((prev) => ({
              ...prev,
              building: val,
              floor: [],
              roomNo: [],
            })),
        },
        {
          key: "floor",
          label: "宿舍楼层",
          options: dynamicFloors.map((f) => ({
            label: `${f}层`,
            value: String(f),
          })),
          value: draftFilters.floor,
          onChange: (val) =>
            setDraftFilters((prev) => ({
              ...prev,
              floor: val,
              roomNo: [],
            })),
        },
        {
          key: "roomNo",
          label: "宿舍号",
          options: dynamicRooms.map((r) => ({ label: r, value: r })),
          value: draftFilters.roomNo,
          onChange: (val) =>
            setDraftFilters((prev) => ({ ...prev, roomNo: val })),
        },
      ]}
    />
  );
}
