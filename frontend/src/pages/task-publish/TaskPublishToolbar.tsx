/**
 * 任务发布工具栏
 */

import { Button, Input } from "antd";
import {
  SearchOutlined,
  FilterOutlined,
  ReloadOutlined,
  PlusOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import FilterDropdownPanel from "../../components/common/FilterDropdownPanel";

import type { TaskPublishToolbarProps } from "./types";

export const TaskPublishToolbar = ({
  canCreateTasks,
  isMobile,
  draftTaskSearch,
  setDraftTaskSearch,
  onSearch,
  onReset,
  isDirty,
  taskFilterCount,
  onOpenFilter,
  onCreateTask,
  onOpenSettings,
  taskFilterConfig,
}: TaskPublishToolbarProps) => {
  const desktopFilterConfig = taskFilterConfig.map((filter) => ({
    ...filter,
    options: filter.options?.map((option) => ({
      label: option.label,
      value: String(option.value),
    })),
    value: filter.value.map((value) => String(value)),
    onChange: (values: string[]) => {
      filter.onChange(values);
    },
  }));

  return (
    <div className="flex flex-col gap-3">
      {isMobile ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Input
              placeholder="搜索任务名称、备注或检查人"
              prefix={<SearchOutlined className="text-gray-400" />}
              className="apple-search-input !rounded-xl !bg-gray-100/60 dark:!bg-white/5 border-none h-10 flex-1"
              value={draftTaskSearch}
              onChange={(e) => setDraftTaskSearch(e.target.value)}
              onPressEnter={onSearch}
              allowClear
            />
            <Button
              type="primary"
              icon={<SearchOutlined />}
              onClick={onSearch}
              disabled={!isDirty}
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
              {taskFilterCount > 0 ? (
                <span className="px-1.5 py-0.5 text-[11px] bg-ios-blue text-white rounded-full min-w-[18px] text-center font-medium">
                  {taskFilterCount}
                </span>
              ) : (
                <span className="text-gray-600 dark:text-gray-300 text-[13px]">
                  筛选
                </span>
              )}
            </Button>
            <Button
              onClick={onReset}
              icon={<ReloadOutlined />}
              className="h-10 rounded-xl border-none bg-gray-100/60 dark:bg-white/5 text-gray-600 dark:text-gray-300 active:scale-95 transition-all px-4"
            >
              重置
            </Button>
            {canCreateTasks ? (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={onCreateTask}
                className="apple-btn-primary flex-1 h-10 rounded-xl px-6 active:scale-95 transition-all border-none"
              >
                发布新任务
              </Button>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="dorm-toolbar-shell">
          <div className="dorm-toolbar-row dorm-toolbar-row-main">
            <Input
              placeholder="搜索任务名称、备注或检查人"
              prefix={<SearchOutlined className="text-gray-400" />}
              className="apple-search-input dorm-toolbar-search !bg-gray-100/50 dark:!bg-white/5 border-none flex-1 min-w-[240px]"
              value={draftTaskSearch}
              onChange={(e) => setDraftTaskSearch(e.target.value)}
              onPressEnter={onSearch}
              allowClear
            />
            <Button
              type="primary"
              icon={<SearchOutlined />}
              onClick={onSearch}
              disabled={!isDirty}
              className="apple-btn-primary dorm-toolbar-button dorm-toolbar-button-primary active:scale-95 transition-all border-none"
            >
              搜索
            </Button>
            <Button
              onClick={onReset}
              icon={<ReloadOutlined />}
              className="dorm-toolbar-button dorm-toolbar-button-subtle active:scale-95 transition-all"
            >
              重置
            </Button>
          </div>
          <div className="dorm-toolbar-row dorm-toolbar-row-actions">
            {canCreateTasks ? (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={onCreateTask}
                className="apple-btn-primary dorm-toolbar-button dorm-toolbar-button-primary active:scale-95 transition-all border-none"
              >
                发布新任务
              </Button>
            ) : null}
            {onOpenSettings ? (
              <Button
                className="dorm-toolbar-button dorm-toolbar-button-subtle active:scale-95 transition-all"
                icon={<SettingOutlined className="text-gray-600 dark:text-gray-300" />}
                onClick={onOpenSettings}
              >
                字段设置
              </Button>
            ) : null}
          </div>
        </div>
      )}

      {!isMobile && (
        <div className="dorm-toolbar-row dorm-toolbar-row-filters">
          <div className="flex-1">
            <FilterDropdownPanel
              filters={desktopFilterConfig}
              onReset={onReset}
            />
          </div>
        </div>
      )}
    </div>
  );
}
