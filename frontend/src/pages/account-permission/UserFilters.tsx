/**
 * 账号与权限管理模块 - 用户筛选区
 * @module pages/account-permission/UserFilters
 */

import type { Dispatch, SetStateAction } from 'react';
import { Input, Button } from 'antd';
import { SearchOutlined, FilterOutlined, ReloadOutlined } from '@ant-design/icons';
import FilterDropdownPanel from '../../components/common/FilterDropdownPanel';
import MobileAdvancedFilter from '../../components/common/MobileAdvancedFilter';
import { USER_TYPE_OPTIONS, USER_STATUS_OPTIONS } from './accountPermissionSchema';
import { useScopeOptions } from './useScopeOptions';

import type { UserFilters as UserFilterState } from './types';

/** 学院选项来自数据范围可选项；用户的 department 字段存的就是学院名称 */
function useCollegeOptions() {
  const { options } = useScopeOptions();
  const colleges = new Set<string>();
  (options?.academic || []).forEach((item) => {
    if (item.college) colleges.add(item.college);
  });
  return Array.from(colleges)
    .sort((a, b) => a.localeCompare(b, 'zh-CN'))
    .map((college) => ({ label: college, value: college }));
}

interface SharedFilterProps {
  filters: UserFilterState;
  setFilters: Dispatch<SetStateAction<UserFilterState>>;
  setPage: Dispatch<SetStateAction<number>>;
  onReset: () => void;
}

type DesktopFiltersProps = SharedFilterProps;

interface MobileFilterTriggerProps {
  searchTerm: string;
  setSearchTerm: Dispatch<SetStateAction<string>>;
  setPage: Dispatch<SetStateAction<number>>;
  filters: UserFilterState;
  isDirty: boolean;
  loading: boolean;
  onSearch: () => void;
  onOpenDrawer: () => void;
  onReset: () => void;
}

interface MobileFilterDrawerProps extends SharedFilterProps {
  open: boolean;
  onClose: () => void;
}

/**
 * 桌面端筛选组件
 */
export function DesktopFilters({
  filters,
  setFilters,
  setPage,
  onReset,
}: DesktopFiltersProps) {
  const { department, userType, isDisabled } = filters;
  const collegeOptions = useCollegeOptions();

  return (
    <FilterDropdownPanel
      filters={[
        {
          key: 'department',
          label: '学院',
          options: collegeOptions,
          value: department || [],
          onChange: (val: string[]) => {
            setFilters((prev) => ({ ...prev, department: val || [] }));
            setPage(1);
          },
          // 后端按单个学院精确匹配
          multiple: false,
          searchable: true,
        },
        {
          key: 'userType',
          label: '用户类型',
          options: USER_TYPE_OPTIONS.map((option) => ({
            label: String(option.label),
            value: String(option.value),
          })),
          value: userType || [],
          onChange: (val: string[]) => {
            setFilters((prev) => ({ ...prev, userType: val || [] }));
            setPage(1);
          },
          multiple: true,
          searchable: true,
        },
        {
          key: 'isDisabled',
          label: '状态',
          options: USER_STATUS_OPTIONS.map((option) => ({
            label: String(option.label),
            value: String(option.value),
          })),
          value: isDisabled || [],
          onChange: (val: string[]) => {
            setFilters((prev) => ({ ...prev, isDisabled: val || [] }));
            setPage(1);
          },
          multiple: true,
          searchable: false,
        },
      ]}
      onReset={onReset}
    />
  );
}

/**
 * 移动端筛选触发器（与宿舍管理页移动端工具栏一致）
 */
export function MobileFilterTrigger({
  searchTerm,
  setSearchTerm,
  setPage,
  filters,
  isDirty,
  loading,
  onSearch,
  onOpenDrawer,
  onReset,
}: MobileFilterTriggerProps) {
  const { department, userType, isDisabled } = filters;
  const filterCount = (department?.[0] ? 1 : 0) + (userType?.length || 0) + (isDisabled?.length || 0);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Input
          placeholder="搜索用户名/姓名"
          prefix={<SearchOutlined className="text-gray-400" />}
          className="apple-search-input !rounded-xl !bg-gray-100/60 dark:!bg-white/5 border-none h-10 flex-1"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setPage(1);
          }}
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
          onClick={onOpenDrawer}
          className="h-10 min-w-[44px] rounded-xl border-none bg-gray-100/60 dark:bg-white/5 active:scale-95 transition-all flex items-center justify-center gap-1.5 px-3"
          icon={<FilterOutlined className="text-gray-500 dark:text-gray-400" />}
        >
          {filterCount > 0 ? (
            <span className="px-1.5 py-0.5 text-[11px] bg-ios-blue text-white rounded-full min-w-[18px] text-center font-medium">
              {filterCount}
            </span>
          ) : (
            <span className="text-gray-600 dark:text-gray-300 text-[13px]">筛选</span>
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
 * 移动端筛选抽屉（复用 MobileAdvancedFilter）
 */
export function MobileFilterDrawer({
  open,
  onClose,
  filters,
  setFilters,
  setPage,
  onReset,
}: MobileFilterDrawerProps) {
  const { department, userType, isDisabled } = filters;
  const collegeOptions = useCollegeOptions();

  return (
    <MobileAdvancedFilter
      open={open}
      onClose={onClose}
      title="筛选用户"
      onReset={onReset}
      onConfirm={onClose}
      filters={[
        {
          key: 'department',
          label: '学院',
          options: collegeOptions,
          value: department || [],
          onChange: (val: string[]) => {
            // 后端按单个学院精确匹配，只保留最后选中的一项
            setFilters((prev) => ({ ...prev, department: val.length ? [val[val.length - 1]] : [] }));
            setPage(1);
          },
        },
        {
          key: 'userType',
          label: '用户类型',
          options: USER_TYPE_OPTIONS.map((option) => ({
            label: String(option.label),
            value: String(option.value),
          })),
          value: userType || [],
          onChange: (val: string[]) => {
            setFilters((prev) => ({ ...prev, userType: val || [] }));
            setPage(1);
          },
        },
        {
          key: 'isDisabled',
          label: '状态',
          options: USER_STATUS_OPTIONS.map((option) => ({
            label: String(option.label),
            value: String(option.value),
          })),
          value: isDisabled || [],
          onChange: (val: string[]) => {
            setFilters((prev) => ({ ...prev, isDisabled: val || [] }));
            setPage(1);
          },
        },
      ]}
    />
  );
}
