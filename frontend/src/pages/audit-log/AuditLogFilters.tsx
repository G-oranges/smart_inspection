import type { Dispatch, SetStateAction } from 'react';
import type { Dayjs } from 'dayjs';
import { Select, Input, DatePicker, Button, Badge, Drawer, Space } from "antd";
import {
  SearchOutlined,
  ReloadOutlined,
  FilterOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import FilterDropdownPanel from "../../components/common/FilterDropdownPanel";

import type {
  AuditLogFiltersState,
  AuditLogOptions,
} from './types';

const { RangePicker } = DatePicker;

interface AuditLogFiltersProps {
  isMobile: boolean;
  filters: AuditLogFiltersState;
  setFilters: Dispatch<SetStateAction<AuditLogFiltersState>>;
  options: AuditLogOptions;
  handleSearch: () => void;
  handleReset: () => void;
  filterDrawerOpen: boolean;
  setFilterDrawerOpen: Dispatch<SetStateAction<boolean>>;
  onOpenSettings?: () => void;
}

function normalizeDateRange(
  dates: [Dayjs | null, Dayjs | null] | null,
): [Dayjs, Dayjs] | null {
  if (!dates || !dates[0] || !dates[1]) {
    return null;
  }

  return [dates[0], dates[1]];
}

export const AuditLogFilters = ({
  isMobile,
  filters,
  setFilters,
  options,
  handleSearch,
  handleReset,
  filterDrawerOpen,
  setFilterDrawerOpen,
  onOpenSettings,
}: AuditLogFiltersProps) => {
  if (isMobile) {
    return (
      <>
        <div style={{ display: 'flex', gap: 8, width: '100%' }}>
          <Input
            placeholder="搜索操作者、目标或描述"
            prefix={<SearchOutlined />}
            style={{ flex: 1 }}
            value={filters.keyword}
            onChange={(e) => setFilters((prev) => ({ ...prev, keyword: e.target.value }))}
            onPressEnter={handleSearch}
            allowClear
            className="apple-search-input !rounded-xl !bg-gray-100/60 dark:!bg-white/5 border-none h-10 flex-1"
          />
          <Button 
            icon={<FilterOutlined />} 
            onClick={() => setFilterDrawerOpen(true)}
            className="apple-btn-secondary active-press"
          >
            筛选
            {(filters.action?.length > 0 || filters.module?.length > 0 || filters.dateRange) && (
              <Badge count={(filters.action?.length || 0) + (filters.module?.length || 0) + (filters.dateRange?1:0)} offset={[5, -5]} color="blue" />
            )}
          </Button>
          <Button icon={<ReloadOutlined />} onClick={handleReset} className="apple-btn-secondary active-press">重置</Button>
        </div>

        <Drawer
          title="日志筛选"
          placement="bottom"
          open={filterDrawerOpen}
          onClose={() => setFilterDrawerOpen(false)}
          styles={{ body: { paddingBottom: 80 }, wrapper: { height: 'auto' } }}
          extra={<Button type="link" onClick={handleReset} className="text-ios-blue font-bold">重置</Button>}
          className="apple-drawer ios-action-sheet"
        >
          <Space direction="vertical" style={{ width: '100%' }} size="middle" className="apple-form">
            <div>
              <div className="mb-2 font-medium opacity-60">操作类型</div>
              <Select
                mode="multiple"
                placeholder="选择类型"
                allowClear
                style={{ width: '100%' }}
                value={filters.action}
                onChange={(value: string[]) => setFilters((prev) => ({ ...prev, action: value }))}
                options={options.actions}
                className="apple-select"
                classNames={{ popup: { root: "apple-dropdown" } }}
              />
            </div>
            <div>
              <div className="mb-2 font-medium opacity-60">模块</div>
              <Select
                mode="multiple"
                placeholder="选择模块"
                allowClear
                style={{ width: '100%' }}
                value={filters.module}
                onChange={(value: string[]) => setFilters((prev) => ({ ...prev, module: value }))}
                options={options.modules}
                className="apple-select"
                classNames={{ popup: { root: "apple-dropdown" } }}
              />
            </div>
            <div>
              <div className="mb-2 font-medium opacity-60">时间范围</div>
              <RangePicker
                showTime
                style={{ width: '100%' }}
                value={filters.dateRange}
                onChange={(dates) =>
                  setFilters((prev) => ({
                    ...prev,
                    dateRange: normalizeDateRange(dates),
                  }))
                }
                placeholder={["开始时间", "结束时间"]}
                className="apple-rangepicker"
                classNames={{ popup: { root: "apple-rangepicker-dropdown" } }}
              />
            </div>
          </Space>
          <div style={{ 
            position: 'absolute', bottom: 0, left: 0, right: 0, 
            padding: '12px 24px', background: 'var(--color-surface)', 
            borderTop: '1px solid var(--color-border)',
            display: 'flex', gap: 12
          }}>
            <Button block onClick={() => setFilterDrawerOpen(false)} className="apple-btn-secondary">取消</Button>
            <Button type="primary" block onClick={() => {
              handleSearch();
              setFilterDrawerOpen(false);
            }} className="apple-btn-primary">搜索</Button>
          </div>
        </Drawer>
      </>
    );
  }

  const desktopFilterConfig = [
    {
      key: "action",
      label: "操作类型",
      options: options.actions,
      value: filters.action,
      onChange: (value: string[]) =>
        setFilters((prev) => ({ ...prev, action: value || [] })),
      multiple: true,
      searchable: true,
    },
    {
      key: "module",
      label: "模块",
      options: options.modules,
      value: filters.module,
      onChange: (value: string[]) =>
        setFilters((prev) => ({ ...prev, module: value || [] })),
      multiple: true,
      searchable: true,
    },
    {
      key: "dateRange",
      label: "时间范围",
      options: [],
      value: [],
      onChange: () => undefined,
      multiple: false,
      searchable: false,
      customRender: (
        <RangePicker
          showTime
          style={{ width: '100%' }}
          value={filters.dateRange}
          onChange={(dates) =>
            setFilters((prev) => ({
              ...prev,
              dateRange: normalizeDateRange(dates),
            }))
          }
          placeholder={["开始时间", "结束时间"]}
          className="apple-rangepicker"
          classNames={{ popup: { root: "apple-rangepicker-dropdown" } }}
        />
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="dorm-toolbar-shell">
        <div className="dorm-toolbar-row dorm-toolbar-row-main">
          <Input
            placeholder="搜索操作者、目标或描述"
            prefix={<SearchOutlined className="text-gray-400" />}
            value={filters.keyword}
            onChange={(e) => setFilters((prev) => ({ ...prev, keyword: e.target.value }))}
            onPressEnter={handleSearch}
            className="apple-search-input dorm-toolbar-search !bg-gray-100/50 dark:!bg-white/5 border-none flex-1 min-w-[240px]"
            allowClear
          />
          <Button
            type="primary"
            icon={<SearchOutlined />}
            onClick={handleSearch}
            className="apple-btn-primary dorm-toolbar-button dorm-toolbar-button-primary active:scale-95 transition-all"
          >
            搜索
          </Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={handleReset}
            className="dorm-toolbar-button dorm-toolbar-button-subtle active:scale-95 transition-all"
          >
            重置
          </Button>
        </div>
        {onOpenSettings ? (
          <div className="dorm-toolbar-row dorm-toolbar-row-actions">
            <Button
              className="dorm-toolbar-button dorm-toolbar-button-subtle active:scale-95 transition-all"
              icon={<SettingOutlined className="text-gray-600 dark:text-gray-300" />}
              onClick={onOpenSettings}
            >
              字段设置
            </Button>
          </div>
        ) : null}
      </div>
      <div className="dorm-toolbar-row dorm-toolbar-row-filters">
        <div className="flex-1">
          <FilterDropdownPanel filters={desktopFilterConfig} onReset={handleReset} />
        </div>
      </div>
    </div>
  );
};
