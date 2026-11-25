import type { Dispatch, SetStateAction } from 'react';
import { Button, DatePicker, Input } from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  ReloadOutlined,
  SearchOutlined,
  SettingOutlined,
} from '@ant-design/icons';

import FilterDropdownPanel from '../../components/common/FilterDropdownPanel';
import { APPEAL_STATUS_OPTIONS } from './appealSchema';
import type {
  AppealBuildingOption,
  AppealFiltersState,
  AppealTaskOption,
} from './types';
import type { AppealStatus } from '../../types/service';

const { RangePicker } = DatePicker;

export interface AppealToolbarProps {
  draftKeyword: string;
  setDraftKeyword: Dispatch<SetStateAction<string>>;
  draftFilters: AppealFiltersState;
  setDraftFilters: Dispatch<SetStateAction<AppealFiltersState>>;
  isDirty: boolean;
  loading: boolean;
  canHandle: boolean;
  tasks: AppealTaskOption[];
  buildings: AppealBuildingOption[];
  selectedCount: number;
  batchLoading: boolean;
  onSearch: () => void;
  onReset: () => void;
  onRefresh: () => void;
  onOpenSettings: () => void;
  onBatchApprove: () => void;
  onBatchReject: () => void;
  onClearSelection: () => void;
}

export default function AppealToolbar({
  draftKeyword,
  setDraftKeyword,
  draftFilters,
  setDraftFilters,
  isDirty,
  loading,
  canHandle,
  tasks,
  buildings,
  selectedCount,
  batchLoading,
  onSearch,
  onReset,
  onRefresh,
  onOpenSettings,
  onBatchApprove,
  onBatchReject,
  onClearSelection,
}: AppealToolbarProps) {
  const dateRangeValue =
    draftFilters.dateRange && draftFilters.dateRange[0] && draftFilters.dateRange[1]
      ? [`${draftFilters.dateRange[0].format('YYYY-MM-DD')}~${draftFilters.dateRange[1].format('YYYY-MM-DD')}`]
      : [];

  return (
    <div className="flex flex-col gap-3">
      <div className="dorm-toolbar-shell">
        <div className="dorm-toolbar-row dorm-toolbar-row-main">
          <Input
            placeholder="搜索学生姓名、学号、宿舍房号..."
            prefix={<SearchOutlined className="text-gray-400" />}
            className="apple-search-input dorm-toolbar-search !bg-gray-100/50 dark:!bg-white/5 border-none flex-1 min-w-[220px]"
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
            className="apple-btn-primary dorm-toolbar-button dorm-toolbar-button-primary active:scale-95 transition-all border-none"
          >
            搜索
          </Button>
          <Button
            onClick={onReset}
            className="dorm-toolbar-button dorm-toolbar-button-subtle active:scale-95 transition-all"
            icon={<ReloadOutlined />}
          >
            重置
          </Button>
        </div>

        <div className="dorm-toolbar-row dorm-toolbar-row-actions">
          <Button
            className="dorm-toolbar-button dorm-toolbar-button-subtle active:scale-95 transition-all"
            icon={<ReloadOutlined spin={loading} />}
            onClick={onRefresh}
          >
            刷新
          </Button>
          <Button
            className="dorm-toolbar-button dorm-toolbar-button-subtle active:scale-95 transition-all"
            icon={<SettingOutlined className="text-gray-600 dark:text-gray-300" />}
            onClick={onOpenSettings}
          >
            字段设置
          </Button>
          {canHandle && selectedCount > 0 ? (
            <>
              <Button
                type="primary"
                className="apple-btn-primary dorm-toolbar-button dorm-toolbar-button-primary active:scale-95 transition-all"
                icon={<CheckCircleOutlined />}
                loading={batchLoading}
                onClick={onBatchApprove}
              >
                批量通过 ({selectedCount})
              </Button>
              <Button
                danger
                className="dorm-toolbar-button dorm-toolbar-button-danger active:scale-95 transition-all"
                icon={<CloseCircleOutlined />}
                loading={batchLoading}
                onClick={onBatchReject}
              >
                批量驳回 ({selectedCount})
              </Button>
            </>
          ) : null}
        </div>
      </div>

      <div className="dorm-toolbar-row dorm-toolbar-row-filters">
        <div className="flex-1">
          <FilterDropdownPanel
            filters={[
              {
                key: 'status',
                label: '申诉状态',
                multiple: false,
                searchable: false,
                options: APPEAL_STATUS_OPTIONS,
                value: draftFilters.status ? [draftFilters.status] : [],
                onChange: (values) =>
                  setDraftFilters((prev) => ({
                    ...prev,
                    status: (values[0] as AppealStatus | undefined) || '',
                  })),
              },
              {
                key: 'taskId',
                label: '查寝任务',
                multiple: false,
                options: tasks.map((task) => ({
                  label: task.title,
                  value: String(task.id),
                })),
                value: draftFilters.taskId ? [draftFilters.taskId] : [],
                onChange: (values) =>
                  setDraftFilters((prev) => ({
                    ...prev,
                    taskId: values[0] || '',
                  })),
              },
              {
                key: 'buildingId',
                label: '宿舍楼栋',
                multiple: false,
                options: buildings.map((building) => ({
                  label: building.name,
                  value: String(building.id),
                })),
                value: draftFilters.buildingId ? [draftFilters.buildingId] : [],
                onChange: (values) =>
                  setDraftFilters((prev) => ({
                    ...prev,
                    buildingId: values[0] || '',
                  })),
              },
              {
                key: 'dateRange',
                label: '提交日期',
                value: dateRangeValue,
                multiple: false,
                searchable: false,
                customRender: (
                  <RangePicker
                    value={draftFilters.dateRange}
                    onChange={(dates) =>
                      setDraftFilters((prev) => ({
                        ...prev,
                        dateRange:
                          dates && dates[0] && dates[1]
                            ? [dates[0], dates[1]]
                            : null,
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
                ),
                onChange: (values) => {
                  if (values.length === 0) {
                    setDraftFilters((prev) => ({ ...prev, dateRange: null }));
                  }
                },
              },
            ]}
          />
        </div>
      </div>

      {selectedCount > 0 ? (
        <div
          className="flex items-center justify-between p-3 rounded-2xl"
          style={{
            background: 'color-mix(in srgb, var(--co-primary) 10%, transparent)',
            border: '1px solid color-mix(in srgb, var(--co-primary) 22%, transparent)',
          }}
        >
          <span
            className="font-medium text-sm"
            style={{ color: 'var(--co-primary)' }}
          >
            已选择 {selectedCount} 条待处理申诉（批量通过不修改扣分明细，需改分请单条处理）
          </span>
          <Button
            type="link"
            size="small"
            className="p-0 h-auto"
            style={{ color: 'var(--co-text-secondary)' }}
            onClick={onClearSelection}
          >
            取消选择
          </Button>
        </div>
      ) : null}
    </div>
  );
}
