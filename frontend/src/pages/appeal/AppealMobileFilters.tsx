import type { Dispatch, SetStateAction } from 'react';
import { Button, DatePicker, Input, Segmented } from 'antd';
import {
  FilterOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons';

import MobileAdvancedFilter from '../../components/common/MobileAdvancedFilter';
import {
  APPEAL_STATUS_OPTIONS,
  STUDENT_STATUS_SEGMENT_OPTIONS,
} from './appealSchema';
import type {
  AppealBuildingOption,
  AppealFiltersState,
  AppealTaskOption,
} from './types';
import type { AppealStatus } from '../../types/service';

const { RangePicker } = DatePicker;

export interface AppealMobileSearchBarProps {
  draftKeyword: string;
  setDraftKeyword: Dispatch<SetStateAction<string>>;
  currentStatus: AppealStatus | '';
  onStatusChange: (status: AppealStatus | '') => void;
  isDirty: boolean;
  loading: boolean;
  activeFilterCount: number;
  onSearch: () => void;
  onOpenFilter: () => void;
  onReset: () => void;
}

export function AppealMobileSearchBar({
  draftKeyword,
  setDraftKeyword,
  currentStatus,
  onStatusChange,
  isDirty,
  loading,
  activeFilterCount,
  onSearch,
  onOpenFilter,
  onReset,
}: AppealMobileSearchBarProps) {
  return (
    <div className="flex flex-col gap-2.5">
      <Segmented
        block
        value={currentStatus}
        onChange={(value) => onStatusChange(value as AppealStatus | '')}
        options={STUDENT_STATUS_SEGMENT_OPTIONS}
      />

      <div className="flex items-center gap-2">
        <Input
          placeholder="搜索学生或房号..."
          prefix={<SearchOutlined className="text-gray-400" />}
          className="apple-search-input !rounded-xl !bg-gray-100/60 dark:!bg-white/5 border-none h-10 flex-1"
          value={draftKeyword}
          onChange={(event) => setDraftKeyword(event.target.value)}
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

export interface AppealMobileAdvancedFilterProps {
  open: boolean;
  onClose: () => void;
  onReset: () => void;
  onConfirm: () => void;
  draftFilters: AppealFiltersState;
  setDraftFilters: Dispatch<SetStateAction<AppealFiltersState>>;
  tasks: AppealTaskOption[];
  buildings: AppealBuildingOption[];
}

export function AppealMobileAdvancedFilter({
  open,
  onClose,
  onReset,
  onConfirm,
  draftFilters,
  setDraftFilters,
  tasks,
  buildings,
}: AppealMobileAdvancedFilterProps) {
  const dateRangeValue =
    draftFilters.dateRange && draftFilters.dateRange[0] && draftFilters.dateRange[1]
      ? ['selected']
      : [];

  return (
    <MobileAdvancedFilter
      open={open}
      onClose={onClose}
      onReset={onReset}
      onConfirm={onConfirm}
      filters={[
        {
          key: 'status',
          label: '状态',
          searchable: false,
          options: APPEAL_STATUS_OPTIONS,
          value: draftFilters.status ? [draftFilters.status] : [],
          onChange: (values) =>
            setDraftFilters((prev) => ({
              ...prev,
              status: (values[values.length - 1] as AppealStatus | undefined) || '',
            })),
        },
        {
          key: 'taskId',
          label: '查寝任务',
          options: tasks.map((task) => ({
            label: task.title,
            value: String(task.id),
          })),
          value: draftFilters.taskId ? [draftFilters.taskId] : [],
          onChange: (values) =>
            setDraftFilters((prev) => ({
              ...prev,
              taskId: values[values.length - 1] || '',
            })),
        },
        {
          key: 'buildingId',
          label: '宿舍楼栋',
          options: buildings.map((building) => ({
            label: building.name,
            value: String(building.id),
          })),
          value: draftFilters.buildingId ? [draftFilters.buildingId] : [],
          onChange: (values) =>
            setDraftFilters((prev) => ({
              ...prev,
              buildingId: values[values.length - 1] || '',
            })),
        },
        {
          key: 'dateRange',
          label: '提交日期',
          searchable: false,
          value: dateRangeValue,
          customRender: (
            <div className="py-2">
              <RangePicker
                value={draftFilters.dateRange}
                onChange={(dates) =>
                  setDraftFilters((prev) => ({
                    ...prev,
                    dateRange:
                      dates && dates[0] && dates[1] ? [dates[0], dates[1]] : null,
                  }))
                }
                allowClear
                placeholder={['开始日期', '结束日期']}
                getPopupContainer={() => document.body}
                className="apple-rangepicker w-full"
                classNames={{
                  popup: { root: 'apple-rangepicker-dropdown' },
                }}
              />
            </div>
          ),
          onChange: () => {
            setDraftFilters((prev) => ({ ...prev, dateRange: null }));
          },
        },
      ]}
    />
  );
}
