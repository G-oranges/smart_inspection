/**
 * 入住管理 - 筛选区组件
 * 处理 Overview 和 History 两个 tab 的移动端/桌面端筛选 UI
 */
import { Input, Button, DatePicker } from "antd";
import {
  SearchOutlined,
  FilterOutlined,
  ReloadOutlined,
  UserAddOutlined,
  LogoutOutlined,
  ImportOutlined,
  ExportOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import FilterDropdownPanel from "../../components/common/FilterDropdownPanel";
import {
  createOverviewFilterSchema,
  createHistoryFilterSchema,
  getActiveFilterCount,
} from "./occupancyFilterSchema";

import type {
  HistoryFiltersSectionProps,
  OverviewFiltersSectionProps,
} from "./types";

/**
 * Overview Tab 筛选区
 */
export function OverviewFiltersSection({
  isMobile,
  draftSearchTerm,
  setDraftSearchTerm,
  draftFilters,
  setDraftFilters,
  uniqueColleges,
  uniqueBuildings,
  uniqueGrades,
  uniqueFloors,
  loading,
  isDirty,
  handleSearch,
  handleResetFilters,
  setFilterDrawerOpen,
  canEdit,
  openBatchCheckInModal,
  handleBatchCheckout,
  batchLoading,
  validateBatchOperation,
  onOpenImport,
  onExport,
  onOpenSettings,
}: OverviewFiltersSectionProps) {
  // 计算筛选器激活数量
  const activeFilterCount = getActiveFilterCount(draftFilters);

  if (isMobile) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Input
            placeholder="搜索学号、姓名、房号..."
            prefix={<SearchOutlined className="text-gray-400" />}
            className="apple-search-input !rounded-xl !bg-gray-100/60 dark:!bg-white/5 border-none h-10 flex-1"
            value={draftSearchTerm}
            onChange={(e) => setDraftSearchTerm(e.target.value)}
            onPressEnter={handleSearch}
            allowClear
          />
          <Button
            type="primary"
            icon={<SearchOutlined />}
            onClick={handleSearch}
            disabled={!isDirty}
            loading={loading}
            className="apple-btn-primary h-10 rounded-xl px-4 active:scale-95 transition-all border-none"
          >
            搜索
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setFilterDrawerOpen(true)}
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
            onClick={handleResetFilters}
            className="h-10 rounded-xl border-none bg-red-50 dark:bg-red-500/10 text-red-500 active:scale-95 transition-all px-4"
            icon={<ReloadOutlined />}
          >
            重置
          </Button>
        </div>
      </div>
    );
  }

  // 桌面端
  return (
    <div className="flex flex-col gap-4">
      <div className="dorm-toolbar-shell">
        <div className="dorm-toolbar-row dorm-toolbar-row-main">
          <Input
            placeholder="搜索学号、姓名、房号..."
            prefix={<SearchOutlined className="text-gray-400" />}
            className="apple-search-input dorm-toolbar-search !rounded-2xl !bg-gray-100/50 dark:!bg-white/5 border-none h-11 flex-1 min-w-[220px]"
            value={draftSearchTerm}
            onChange={(e) => setDraftSearchTerm(e.target.value)}
            onPressEnter={handleSearch}
            allowClear
          />
          <Button
            type="primary"
            icon={<SearchOutlined />}
            onClick={handleSearch}
            disabled={!isDirty}
            loading={loading}
            className="apple-btn-primary dorm-toolbar-button dorm-toolbar-button-primary h-11 rounded-xl px-6 active:scale-95 transition-all border-none"
          >
            搜索
          </Button>
          <Button
            onClick={handleResetFilters}
            className="dorm-toolbar-button dorm-toolbar-button-subtle h-11 rounded-2xl border-none bg-gray-100/80 dark:bg-white/10 active:scale-95 transition-all px-5"
            icon={<ReloadOutlined />}
          >
            重置
          </Button>
        </div>

        {/* 操作按钮组 */}
        <div className="dorm-toolbar-row dorm-toolbar-row-actions">
          {canEdit && (
            <>
              <Button 
                type="primary" 
                className="apple-btn-primary dorm-toolbar-button dorm-toolbar-button-primary h-11 rounded-xl px-6 active:scale-95 transition-all"
                icon={<UserAddOutlined />} 
                onClick={openBatchCheckInModal}
                disabled={!validateBatchOperation || !validateBatchOperation('checkin').valid}
                loading={batchLoading}
              >
                批量入住
              </Button>
              
              <Button 
                danger
                className="dorm-toolbar-button dorm-toolbar-button-danger h-11 rounded-2xl border-none bg-red-50 dark:bg-red-500/10 text-red-500 active:scale-95 transition-all px-5"
                icon={<LogoutOutlined />}
                disabled={!validateBatchOperation || !validateBatchOperation('checkout').valid}
                loading={batchLoading}
                onClick={handleBatchCheckout}
              >
                批量退宿
              </Button>
            </>
          )}

          <Button 
            className="dorm-toolbar-button dorm-toolbar-button-subtle h-11 rounded-2xl border-none bg-gray-100/80 dark:bg-white/10 active:scale-95 transition-all px-5" 
            icon={<ImportOutlined />}
            onClick={onOpenImport}
          >
            导入
          </Button>

          <Button 
            className="dorm-toolbar-button dorm-toolbar-button-subtle h-11 rounded-2xl border-none bg-gray-100/80 dark:bg-white/10 active:scale-95 transition-all px-5" 
            icon={<ExportOutlined />}
            onClick={onExport}
          >
            导出
          </Button>

          <Button
            className="dorm-toolbar-button dorm-toolbar-button-subtle h-11 rounded-2xl border-none bg-gray-200/60 dark:bg-white/15 active:scale-95 transition-all px-5"
            icon={<SettingOutlined className="text-gray-600 dark:text-gray-300" />}
            onClick={onOpenSettings}
          >
            字段管理
          </Button>
        </div>
      </div>
      
      {/* 桌面端：筛选下拉面板 */}
      <div className="dorm-toolbar-row dorm-toolbar-row-filters">
        <FilterDropdownPanel
          filters={createOverviewFilterSchema({
            draftFilters,
            setDraftFilters,
            uniqueColleges,
            uniqueBuildings,
            uniqueGrades,
            uniqueFloors,
          })}
        />
      </div>
    </div>
  );
}

/**
 * History Tab 筛选区
 */
export function HistoryFiltersSection({
  isMobile,
  historyDraftFilters,
  setHistoryDraftFilters,
  isHistoryDirty,
  loading,
  handleHistorySearch,
  handleResetHistoryFilters,
  setFilterDrawerOpen,
}: HistoryFiltersSectionProps) {
  // 计算激活的历史筛选器数量
  const activeCount = (historyDraftFilters.action ? 1 : 0) + (historyDraftFilters.dateRange ? 1 : 0);

  if (isMobile) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Input
            placeholder="搜索学生、宿舍、操作人..."
            prefix={<SearchOutlined className="text-gray-400" />}
            className="apple-search-input !rounded-xl !bg-gray-100/60 dark:!bg-white/5 border-none h-10 flex-1"
            value={historyDraftFilters.keyword}
            onChange={(e) =>
              setHistoryDraftFilters((prev) => ({
                ...prev,
                keyword: e.target.value,
              }))
            }
            onPressEnter={handleHistorySearch}
            allowClear
          />
          <Button
            type="primary"
            icon={<SearchOutlined />}
            onClick={handleHistorySearch}
            disabled={!isHistoryDirty}
            className="apple-btn-primary h-10 rounded-xl px-4 active:scale-95 transition-all border-none"
          >
            搜索
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setFilterDrawerOpen(true)}
            className="h-10 min-w-[44px] rounded-xl border-none bg-gray-100/60 dark:bg-white/5 active:scale-95 transition-all flex items-center justify-center gap-1.5 px-3"
            icon={<FilterOutlined className="text-gray-500 dark:text-gray-400" />}
          >
            {activeCount > 0 ? (
              <span className="px-1.5 py-0.5 text-[11px] bg-ios-blue text-white rounded-full min-w-[18px] text-center font-medium">
                {activeCount}
              </span>
            ) : (
              <span className="text-gray-600 dark:text-gray-300 text-[13px]">
                筛选
              </span>
            )}
          </Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={handleResetHistoryFilters}
            className="h-10 rounded-xl border-none bg-gray-100/50 dark:bg-white/10"
          >
            重置
          </Button>
        </div>
      </div>
    );
  }

  // 桌面端
  return (
    <div className="flex flex-col gap-4">
      <div className="dorm-toolbar-shell">
        <div className="dorm-toolbar-row dorm-toolbar-row-main">
          <Input
            placeholder="搜索学生、宿舍、操作人..."
            prefix={<SearchOutlined className="text-gray-400" />}
            className="apple-search-input dorm-toolbar-search !rounded-2xl !bg-gray-100/50 dark:!bg-white/5 border-none h-11 flex-1"
            value={historyDraftFilters.keyword}
            onChange={(e) =>
              setHistoryDraftFilters((prev) => ({
                ...prev,
                keyword: e.target.value,
              }))
            }
            onPressEnter={handleHistorySearch}
            allowClear
          />
          <Button
            type="primary"
            icon={<SearchOutlined />}
            onClick={handleHistorySearch}
            disabled={!isHistoryDirty}
            className="apple-btn-primary dorm-toolbar-button dorm-toolbar-button-primary h-11 rounded-xl px-6 active:scale-95 transition-all border-none"
          >
            搜索
          </Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={handleResetHistoryFilters}
            className="dorm-toolbar-button dorm-toolbar-button-subtle h-11 rounded-2xl border-none bg-gray-100/80 dark:bg-white/10 active:scale-95 transition-all px-5"
          >
            重置
          </Button>
        </div>
      </div>
      
      <div className="dorm-toolbar-row dorm-toolbar-row-filters">
        <FilterDropdownPanel
          filters={createHistoryFilterSchema({
            historyDraftFilters,
            setHistoryDraftFilters,
          })}
        />
      </div>
    </div>
  );
}
