/**
 * 入住管理工具栏组件
 * 包含搜索框、筛选按钮、操作按钮
 */

import type { Dispatch, SetStateAction } from "react";
import { Input, Button } from "antd";
import {
  SearchOutlined,
  FilterOutlined,
  ReloadOutlined,
  UserAddOutlined,
  LogoutOutlined,
  FileExcelOutlined,
} from "@ant-design/icons";
import { getActiveFilterCount } from "./occupancyFilterSchema";
import { prefetchImportWizardModal } from "../../components/common/importWizardPrefetch";

import type {
  OccupancyOverviewFilters,
  OverviewFiltersSectionProps,
} from "./types";

interface MobileToolbarProps {
  draftSearchTerm: string;
  setDraftSearchTerm: Dispatch<SetStateAction<string>>;
  handleSearch: () => void;
  handleResetFilters: () => void;
  isDirty: boolean;
  loading: boolean;
  draftFilters: OccupancyOverviewFilters;
  onOpenFilter: () => void;
}

type DesktopToolbarProps = Pick<
  OverviewFiltersSectionProps,
  | 'draftSearchTerm'
  | 'setDraftSearchTerm'
  | 'handleSearch'
  | 'handleResetFilters'
  | 'isDirty'
  | 'loading'
  | 'canEdit'
  | 'batchLoading'
  | 'validateBatchOperation'
  | 'openBatchCheckInModal'
  | 'handleBatchCheckout'
  | 'onOpenImport'
>;

/**
 * 移动端工具栏
 */
export function MobileToolbar({
  draftSearchTerm,
  setDraftSearchTerm,
  handleSearch,
  handleResetFilters,
  isDirty,
  loading,
  draftFilters,
  onOpenFilter,
}: MobileToolbarProps) {
  const filterCount = getActiveFilterCount(draftFilters);

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
          onClick={onOpenFilter}
          className="h-10 min-w-[44px] rounded-xl border-none bg-gray-100/60 dark:bg-white/5 active:scale-95 transition-all flex items-center justify-center gap-1.5 px-3"
          icon={<FilterOutlined className="text-gray-500 dark:text-gray-400" />}
        >
          {filterCount > 0 ? (
            <span className="px-1.5 py-0.5 text-[11px] bg-ios-blue text-white rounded-full min-w-[18px] text-center font-medium">
              {filterCount}
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

/**
 * 桌面端工具栏
 */
export function DesktopToolbar({
  draftSearchTerm,
  setDraftSearchTerm,
  handleSearch,
  handleResetFilters,
  isDirty,
  loading,
  canEdit,
  batchLoading,
  validateBatchOperation,
  openBatchCheckInModal,
  handleBatchCheckout,
  onOpenImport,
}: DesktopToolbarProps) {
  return (
    <div className="flex flex-row gap-4 items-center justify-between">
      <div className="flex flex-1 flex-wrap items-center gap-2">
        <Input
          placeholder="搜索学号、姓名、房号..."
          prefix={<SearchOutlined className="text-gray-400" />}
          className="apple-search-input !rounded-2xl !bg-gray-100/50 dark:!bg-white/5 border-none h-11 flex-1 min-w-[220px]"
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
          className="apple-btn-primary h-11 rounded-xl px-6 active:scale-95 transition-all border-none"
        >
          搜索
        </Button>
        <Button
          onClick={handleResetFilters}
          className="h-11 rounded-2xl border-none bg-gray-100/80 dark:bg-white/10 active:scale-95 transition-all px-5"
          icon={<ReloadOutlined />}
        >
          重置
        </Button>
      </div>

      {/* 操作按钮组 */}
      {canEdit && (
        <div className="flex flex-wrap gap-2 items-center">
          <Button 
            type="primary" 
            className="apple-btn-primary h-11 rounded-xl px-6 active:scale-95 transition-all"
            icon={<UserAddOutlined />} 
            onClick={openBatchCheckInModal}
            disabled={!validateBatchOperation('checkin').valid}
            loading={batchLoading}
          >
            批量入住
          </Button>
          
          <Button 
            danger
            className="h-11 rounded-2xl border-none bg-red-50 dark:bg-red-500/10 text-red-500 active:scale-95 transition-all px-5"
            icon={<LogoutOutlined />}
            disabled={!validateBatchOperation('checkout').valid}
            loading={batchLoading}
            onClick={handleBatchCheckout}
          >
            批量退宿
          </Button>

          <Button 
            className="h-11 rounded-2xl border-none bg-gray-100/80 dark:bg-white/10 active:scale-95 transition-all px-5" 
            icon={<FileExcelOutlined />}
            onClick={onOpenImport}
            onMouseEnter={prefetchImportWizardModal}
            onFocus={prefetchImportWizardModal}
            onTouchStart={prefetchImportWizardModal}
          >
            导入
          </Button>
        </div>
      )}
    </div>
  );
}
