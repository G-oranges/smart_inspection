import { DatePicker } from 'antd';
import type { Dispatch, SetStateAction } from 'react';
import type { Dayjs } from 'dayjs';

import type { EntityId } from '../../types/service';
import type {
  DormFiltersState,
  TaskFilterConfigItem,
  TaskFilterOption,
  TaskFiltersState,
  TaskPublishFormState,
} from './types';

export const INITIAL_FORM: TaskPublishFormState = {
  title: '',
  startAt: null,
  deadline: null,
  notes: '',
};

export const INITIAL_TASK_FILTERS: TaskFiltersState = {
  status: '',
  timeRange: '',
  customRange: [],
  executorId: '',
};

export const DORM_FILTER_KEYS: Array<keyof DormFiltersState> = [
  'campus',
  'building',
  'floor',
  'grade',
  'college',
];

export function createEmptyDormFilters(): DormFiltersState {
  return {
    campus: [],
    building: [],
    floor: [],
    grade: [],
    college: [],
  };
}

export const INITIAL_FILTERS: DormFiltersState = createEmptyDormFilters();

export const TASK_FILTER_KEYS: Array<keyof Omit<TaskFiltersState, 'customRange'>> = [
  'status',
  'timeRange',
  'executorId',
];

export const EXECUTOR_PAGE_SIZE = 10;
export const ROLE_NAME_MAP: Record<string, string> = {
  ADMIN: '管理员',
  COUNSELOR: '辅导员',
  LEADER: '学生干部',
  STUDENT: '学生',
};

export const EXECUTOR_ROLES: TaskFilterOption[] = [
  { value: 'ADMIN', label: '管理员' },
  { value: 'COUNSELOR', label: '辅导员' },
  { value: 'LEADER', label: '学生干部' },
];

export const MAX_TITLE_LENGTH = 20;
export const MAX_NOTES_LENGTH = 50;

const TASK_TIME_RANGE_OPTIONS: TaskFilterOption[] = [
  { value: 'week', label: '近一周' },
  { value: 'month', label: '近一月' },
  { value: 'custom', label: '自定义范围' },
];

export function createTaskFilterConfig({
  draftTaskFilters,
  setDraftTaskFilters,
  executorOptions,
}: {
  draftTaskFilters: TaskFiltersState;
  setDraftTaskFilters: Dispatch<SetStateAction<TaskFiltersState>>;
  executorOptions: TaskFilterOption[];
}): TaskFilterConfigItem[] {
  const pickSingleValue = (values: Array<string | number>): EntityId | '' =>
    Array.isArray(values) && values.length ? values[values.length - 1] : '';

  const handleTimeRangeSelect = (value: string): void => {
    setDraftTaskFilters((prev) => {
      const nextValue = prev.timeRange === value ? '' : (value as TaskFiltersState['timeRange']);
      return {
        ...prev,
        timeRange: nextValue,
        customRange: nextValue === 'custom' ? prev.customRange : [],
      };
    });
  };

  const customRangeValue: [Dayjs, Dayjs] | null =
    draftTaskFilters.timeRange === 'custom' && draftTaskFilters.customRange.length === 2
      ? [
          draftTaskFilters.customRange[0] as Dayjs,
          draftTaskFilters.customRange[1] as Dayjs,
        ]
      : null;

  const timeRangeRender = (
    <div className="space-y-3">
      <div className="filter-options-grid">
        {TASK_TIME_RANGE_OPTIONS.map((option) => {
          const isSelected = draftTaskFilters.timeRange === option.value;
          return (
            <button
              key={option.value}
              className={`filter-option-btn ${isSelected ? 'selected' : ''}`}
              onClick={() => handleTimeRangeSelect(String(option.value))}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      {draftTaskFilters.timeRange === 'custom' && (
        <DatePicker.RangePicker
          variant="filled"
          className="apple-input w-full"
          classNames={{ popup: { root: 'task-time-range-popup' } }}
          getPopupContainer={() => document.body}
          value={customRangeValue}
          onChange={(values) => {
            const nextRange =
              values && values[0] && values[1]
                ? [values[0], values[1]]
                : [];
            setDraftTaskFilters((prev) => ({
              ...prev,
              timeRange: 'custom',
              customRange: nextRange,
            }));
          }}
          allowClear
        />
      )}
    </div>
  );

  return [
    {
      key: 'status',
      label: '任务状态',
      options: [
        { value: 'upcoming', label: '待开启' },
        { value: 'inProgress', label: '进行中' },
        { value: 'ended', label: '已结束' },
      ],
      value: draftTaskFilters.status ? [draftTaskFilters.status] : [],
      onChange: (values) =>
        setDraftTaskFilters((prev) => ({
          ...prev,
          status: pickSingleValue(values) as TaskFiltersState['status'],
        })),
      multiple: false,
      searchable: false,
    },
    {
      key: 'timeRange',
      label: '时间范围',
      options: TASK_TIME_RANGE_OPTIONS,
      value: draftTaskFilters.timeRange ? [draftTaskFilters.timeRange] : [],
      onChange: (values) => {
        const nextValue = pickSingleValue(values) as TaskFiltersState['timeRange'];
        setDraftTaskFilters((prev) => ({
          ...prev,
          timeRange: nextValue,
          customRange: nextValue === 'custom' ? prev.customRange : [],
        }));
      },
      multiple: false,
      searchable: false,
      customRender: timeRangeRender,
    },
    {
      key: 'executor',
      label: '检查人',
      options: executorOptions,
      value: draftTaskFilters.executorId ? [draftTaskFilters.executorId] : [],
      onChange: (values) =>
        setDraftTaskFilters((prev) => ({
          ...prev,
          executorId: pickSingleValue(values),
        })),
      multiple: false,
      searchable: true,
    },
  ];
}

export function getTaskFilterCount(draftTaskFilters: TaskFiltersState): number {
  let count = 0;
  if (draftTaskFilters.status) {
    count += 1;
  }
  if (
    draftTaskFilters.timeRange &&
    (draftTaskFilters.timeRange !== 'custom' || draftTaskFilters.customRange.length === 2)
  ) {
    count += 1;
  }
  if (draftTaskFilters.executorId) {
    count += 1;
  }
  return count;
}
