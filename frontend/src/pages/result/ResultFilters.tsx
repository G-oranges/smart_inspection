/**
 * 查寝结果筛选区组件
 */

import type { Dispatch, SetStateAction } from 'react';
import type { Dayjs } from 'dayjs';
import { useMemo, useState } from "react";
import { Button, DatePicker, Input } from "antd";
import {
  DeleteOutlined,
  ExportOutlined,
  FilterOutlined,
  ReloadOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import FilterDropdownPanel from "../../components/common/FilterDropdownPanel";
import MobileAdvancedFilter from "../../components/common/MobileAdvancedFilter";
import {
  INITIAL_FILTERS,
  RESULT_FILTER_LABELS,
  RESULT_GENDER_OPTIONS,
  RESULT_SORT_OPTIONS,
} from "./resultSchema";

import type { EntityId } from '../../types/service';
import type { ResultFiltersState, ResultTaskRecord } from './types';

const { RangePicker } = DatePicker;

type SetResultFilters = Dispatch<SetStateAction<ResultFiltersState>>;

interface ResultFiltersProps {
  isMobile: boolean;
  tasks?: ResultTaskRecord[];
  gradeOptions: string[];
  collegeOptions: string[];
  levelOptions: string[];
  draftFilters: ResultFiltersState;
  setDraftFilters: Dispatch<SetStateAction<ResultFiltersState>>;
  isDirty: boolean;
  handleSearch: () => void;
  handleResetFilters: () => void;
  handleRefresh: () => void | Promise<void>;
  handleExport?: () => void | Promise<void>;
  exporting: boolean;
  totalCount: number;
  canAdjust: boolean;
  selectedResultIds: EntityId[];
  handleDeleteResults: (ids: EntityId[]) => void;
}

function normalizeDateRange(
  values: [Dayjs | null, Dayjs | null] | null,
): Dayjs[] {
  if (!values || !values[0] || !values[1]) {
    return [];
  }

  return [values[0], values[1]];
}

function normalizeEntityIds(values: string[]): EntityId[] {
  return values;
}

function createDateRangeFilter(
  draftFilters: ResultFiltersState,
  setDraftFilters: SetResultFilters,
) {
  const dateRangeValue =
    draftFilters.dateRange?.length === 2
      ? ([draftFilters.dateRange[0], draftFilters.dateRange[1]] as [Dayjs, Dayjs])
      : null;

  return {
    key: "dateRange",
    label: RESULT_FILTER_LABELS.dateRange,
    options: [],
    value: [],
    onChange: () => undefined,
    multiple: false,
    searchable: false,
    customRender: (
      <RangePicker
        value={dateRangeValue}
        onChange={(values) =>
          setDraftFilters((prev) => ({
            ...prev,
            dateRange: normalizeDateRange(values),
          }))
        }
        className="apple-select w-full"
        placeholder={["开始日期", "结束日期"]}
      />
    ),
  };
}

function createResultFilterConfig(
  tasks: ResultTaskRecord[] | undefined,
  gradeOptions: string[],
  collegeOptions: string[],
  levelOptions: string[],
  draftFilters: ResultFiltersState,
  setDraftFilters: SetResultFilters,
) {
  const pickSingleValue = (values: string[]) =>
    Array.isArray(values) && values.length ? values[values.length - 1] : "";

  return [
    {
      key: "taskId",
      label: RESULT_FILTER_LABELS.taskId,
      options: (tasks || []).map((task) => ({
        label: task.title || "未命名任务",
        value: String(task.id),
      })),
      value: draftFilters.taskId.map(String),
      onChange: (values: string[]) =>
        setDraftFilters((prev) => ({
          ...prev,
          taskId: normalizeEntityIds(values || []),
        })),
      multiple: true,
      searchable: true,
    },
    {
      key: "grade",
      label: RESULT_FILTER_LABELS.grade,
      options: gradeOptions.map((grade) => ({ label: grade, value: grade })),
      value: draftFilters.grade,
      onChange: (values: string[]) =>
        setDraftFilters((prev) => ({ ...prev, grade: values || [] })),
      multiple: true,
      searchable: true,
    },
    {
      key: "college",
      label: RESULT_FILTER_LABELS.college,
      options: collegeOptions.map((college) => ({ label: college, value: college })),
      value: draftFilters.college,
      onChange: (values: string[]) =>
        setDraftFilters((prev) => ({ ...prev, college: values || [] })),
      multiple: true,
      searchable: true,
    },
    {
      key: "level",
      label: RESULT_FILTER_LABELS.level,
      options: levelOptions.map((level) => ({ label: level, value: level })),
      value: draftFilters.level,
      onChange: (values: string[]) =>
        setDraftFilters((prev) => ({ ...prev, level: values || [] })),
      multiple: true,
      searchable: true,
    },
    {
      key: "gender",
      label: RESULT_FILTER_LABELS.gender,
      options: RESULT_GENDER_OPTIONS,
      value: draftFilters.gender,
      onChange: (values: string[]) =>
        setDraftFilters((prev) => ({ ...prev, gender: values || [] })),
      multiple: true,
      searchable: false,
    },
    createDateRangeFilter(draftFilters, setDraftFilters),
    {
      key: "sort",
      label: RESULT_FILTER_LABELS.sort,
      options: RESULT_SORT_OPTIONS,
      value:
        draftFilters.sort && draftFilters.sort !== INITIAL_FILTERS.sort
          ? [draftFilters.sort]
          : [],
      onChange: (values: string[]) =>
        setDraftFilters((prev) => ({
          ...prev,
          sort: pickSingleValue(values) || INITIAL_FILTERS.sort,
        })),
      multiple: false,
      searchable: false,
    },
  ];
}

interface ResultFilterActionBarProps {
  activeFilterCount: number;
  canAdjust: boolean;
  draftFilters: ResultFiltersState;
  exporting: boolean;
  handleDeleteResults: (ids: EntityId[]) => void;
  handleExport?: () => void | Promise<void>;
  handleRefresh: () => void | Promise<void>;
  handleResetFilters: () => void;
  handleSearch: () => void;
  isDirty: boolean;
  isMobile: boolean;
  selectedResultIds: EntityId[];
  setDraftFilters: Dispatch<SetStateAction<ResultFiltersState>>;
  setFilterOpen: Dispatch<SetStateAction<boolean>>;
  totalCount: number;
}

function ResultFilterActionBar({
  activeFilterCount,
  canAdjust,
  draftFilters,
  exporting,
  handleDeleteResults,
  handleExport,
  handleRefresh,
  handleResetFilters,
  handleSearch,
  isDirty,
  isMobile,
  selectedResultIds,
  setDraftFilters,
  setFilterOpen,
  totalCount,
}: ResultFilterActionBarProps) {
  if (isMobile) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Input
            placeholder="搜索任务、宿舍、记录人..."
            prefix={<SearchOutlined className="text-gray-400" />}
            className="apple-search-input !rounded-xl !bg-gray-100/60 dark:!bg-white/5 border-none h-10 flex-1"
            value={draftFilters.keyword}
            onChange={(event) =>
              setDraftFilters((prev) => ({
                ...prev,
                keyword: event.target.value,
              }))
            }
            onPressEnter={handleSearch}
            allowClear
          />
          <Button
            type="primary"
            icon={<SearchOutlined />}
            onClick={handleSearch}
            disabled={!isDirty}
            className="apple-btn-primary h-10 rounded-xl px-6 active:scale-95 transition-all border-none"
          >
            搜索
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() => setFilterOpen(true)}
            className="h-10 min-w-[44px] rounded-xl border-none bg-gray-100/60 dark:bg-white/5 active:scale-95 transition-all flex items-center justify-center gap-1.5 px-3"
            icon={<FilterOutlined className="text-gray-500 dark:text-gray-400" />}
          >
            {activeFilterCount > 0 ? (
              <span className="px-1.5 py-0.5 text-[11px] bg-ios-blue text-white rounded-full min-w-[18px] text-center font-medium">
                {activeFilterCount}
              </span>
            ) : (
              <span className="text-gray-600 dark:text-gray-300 text-[13px]">筛选</span>
            )}
          </Button>
          <Button
            onClick={handleResetFilters}
            icon={<ReloadOutlined />}
            className="h-10 rounded-xl border-none bg-gray-100/60 dark:bg-white/5 text-gray-600 dark:text-gray-300 active:scale-95 transition-all px-4"
          >
            重置
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={handleRefresh}
            icon={<ReloadOutlined className="text-gray-500 dark:text-gray-400" />}
            className="h-10 w-10 rounded-xl border-none bg-gray-100/60 dark:bg-white/5 active:scale-95 transition-all"
          />
          {canAdjust && selectedResultIds.length > 0 && (
            <Button
              danger
              onClick={() => handleDeleteResults(selectedResultIds)}
              icon={<DeleteOutlined />}
              className="h-10 w-10 rounded-xl border-none bg-red-50 dark:bg-red-500/10 text-red-500 active:scale-95 transition-all"
            />
          )}
          {handleExport ? (
            <Button
              type="primary"
              icon={<ExportOutlined />}
              onClick={handleExport}
              loading={exporting}
              disabled={totalCount === 0}
              className="apple-btn-primary flex-1 h-10 rounded-xl px-6 active:scale-95 transition-all border-none"
            >
              导出
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="dorm-toolbar-shell">
      <div className="dorm-toolbar-row dorm-toolbar-row-main">
        <Input
          placeholder="搜索任务、宿舍、记录人..."
          prefix={<SearchOutlined className="text-gray-400" />}
          className="apple-search-input dorm-toolbar-search !rounded-2xl !bg-gray-100/50 dark:!bg-white/5 border-none h-11 flex-1 min-w-[220px]"
          value={draftFilters.keyword}
          onChange={(event) =>
            setDraftFilters((prev) => ({
              ...prev,
              keyword: event.target.value,
            }))
          }
          onPressEnter={handleSearch}
          allowClear
        />
        <Button
          type="primary"
          icon={<SearchOutlined />}
          onClick={handleSearch}
          disabled={!isDirty}
          className="apple-btn-primary dorm-toolbar-button dorm-toolbar-button-primary h-11 rounded-xl px-6 active:scale-95 transition-all border-none"
        >
          搜索
        </Button>
        <Button
          onClick={handleResetFilters}
          icon={<ReloadOutlined />}
          className="dorm-toolbar-button dorm-toolbar-button-subtle h-11 rounded-2xl border-none bg-gray-100/80 dark:bg-white/10 active:scale-95 transition-all px-5"
        >
          重置
        </Button>
      </div>
      <div className="dorm-toolbar-row dorm-toolbar-row-actions">
        <Button
          icon={<ReloadOutlined />}
          onClick={handleRefresh}
          className="dorm-toolbar-button dorm-toolbar-button-subtle h-11 rounded-2xl border-none bg-gray-100/80 dark:bg-white/10 active:scale-95 transition-all px-5"
        >
          刷新
        </Button>
        {handleExport ? (
          <Button
            type="primary"
            icon={<ExportOutlined />}
            onClick={handleExport}
            loading={exporting}
            disabled={totalCount === 0}
            className="apple-btn-primary dorm-toolbar-button dorm-toolbar-button-primary h-11 rounded-xl px-6 active:scale-95 transition-all border-none"
          >
            导出数据
          </Button>
        ) : null}
        {canAdjust && selectedResultIds.length > 0 ? (
          <Button
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDeleteResults(selectedResultIds)}
            className="dorm-toolbar-button dorm-toolbar-button-danger h-11 rounded-2xl border-none bg-red-50 dark:bg-red-500/10 text-red-500 active:scale-95 transition-all px-5"
          >
            删除 ({selectedResultIds.length})
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export default function ResultFilters({
  isMobile,
  tasks,
  gradeOptions,
  collegeOptions,
  levelOptions,
  draftFilters,
  setDraftFilters,
  isDirty,
  handleSearch,
  handleResetFilters,
  handleRefresh,
  handleExport,
  exporting,
  totalCount,
  canAdjust,
  selectedResultIds,
  handleDeleteResults,
}: ResultFiltersProps) {
  const [filterOpen, setFilterOpen] = useState(false);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (draftFilters.taskId?.length) count += 1;
    if (draftFilters.grade?.length) count += 1;
    if (draftFilters.college?.length) count += 1;
    if (draftFilters.level?.length) count += 1;
    if (draftFilters.gender?.length) count += 1;
    if (draftFilters.dateRange?.length === 2) count += 1;
    if (draftFilters.sort && draftFilters.sort !== INITIAL_FILTERS.sort) {
      count += 1;
    }
    return count;
  }, [draftFilters]);

  const resultFilterConfig = useMemo(() => createResultFilterConfig(
    tasks,
    gradeOptions,
    collegeOptions,
    levelOptions,
    draftFilters,
    setDraftFilters,
  ), [
    tasks,
    gradeOptions,
    collegeOptions,
    levelOptions,
    draftFilters,
    setDraftFilters,
  ]);

  return (
    <>
      <div className="flex flex-col gap-3">
        <ResultFilterActionBar
          activeFilterCount={activeFilterCount}
          canAdjust={canAdjust}
          draftFilters={draftFilters}
          exporting={exporting}
          handleDeleteResults={handleDeleteResults}
          handleExport={handleExport}
          handleRefresh={handleRefresh}
          handleResetFilters={handleResetFilters}
          handleSearch={handleSearch}
          isDirty={isDirty}
          isMobile={isMobile}
          selectedResultIds={selectedResultIds}
          setDraftFilters={setDraftFilters}
          setFilterOpen={setFilterOpen}
          totalCount={totalCount}
        />

        {!isMobile && (
          <div className="dorm-toolbar-row dorm-toolbar-row-filters">
            <div className="flex-1">
              <FilterDropdownPanel
                filters={resultFilterConfig}
                onReset={handleResetFilters}
              />
            </div>
          </div>
        )}
      </div>

      <MobileAdvancedFilter
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        title="筛选结果"
        filters={resultFilterConfig}
        onReset={handleResetFilters}
        onConfirm={() => setFilterOpen(false)}
      />
    </>
  );
}
