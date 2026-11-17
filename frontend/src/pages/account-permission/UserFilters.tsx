/**
 * 账号与权限管理模块 - 用户筛选区
 * @module pages/account-permission/UserFilters
 */

import type { Dispatch, SetStateAction } from 'react';
import { Input, Select, Button, Drawer, Badge, Space } from 'antd';
import { SearchOutlined, FilterOutlined, ReloadOutlined } from '@ant-design/icons';
import FilterDropdownPanel from '../../components/common/FilterDropdownPanel';
import { USER_TYPE_OPTIONS, USER_STATUS_OPTIONS } from './accountPermissionSchema';

import type { UserFilters as UserFilterState } from './types';

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
  const departmentText = department?.[0] ?? '';

  return (
    <FilterDropdownPanel
      filters={[
        {
          key: 'department',
          label: '部门',
          options: [],
          value: departmentText ? [departmentText] : [],
          onChange: () => undefined,
          multiple: false,
          searchable: false,
          customRender: (
            <Input
              placeholder="部门"
              value={departmentText}
              onChange={(e) => {
                const { value } = e.target;
                setFilters((prev) => ({
                  ...prev,
                  department: value ? [value] : [],
                }));
                setPage(1);
              }}
              allowClear
              className="apple-input w-full"
            />
          ),
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
          customRender: (
            <Select
              mode="multiple"
              value={userType || []}
              onChange={(val) => {
                setFilters((prev) => ({ ...prev, userType: val || [] }));
                setPage(1);
              }}
              options={USER_TYPE_OPTIONS}
              maxTagCount="responsive"
              placeholder="用户类型"
              style={{ width: '100%' }}
              allowClear
              className="apple-select"
              classNames={{ popup: { root: 'apple-dropdown' } }}
            />
          ),
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
          customRender: (
            <Select
              mode="multiple"
              value={isDisabled || []}
              onChange={(val) => {
                setFilters((prev) => ({ ...prev, isDisabled: val || [] }));
                setPage(1);
              }}
              options={USER_STATUS_OPTIONS}
              maxTagCount="responsive"
              placeholder="状态"
              style={{ width: '100%' }}
              allowClear
              className="apple-select"
              classNames={{ popup: { root: 'apple-dropdown' } }}
            />
          ),
        },
      ]}
      onReset={onReset}
    />
  );
}

/**
 * 移动端筛选触发器
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
    <div
      style={{
        display: "flex",
        gap: 8,
        width: "100%",
        flexWrap: "wrap",
      }}
    >
      <div style={{ display: "flex", gap: 8, width: "100%" }}>
        <Input
          placeholder="搜索用户名/姓名"
          prefix={<SearchOutlined />}
          style={{ flex: "1 1 120px", minWidth: 120 }}
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
        >
          搜索
        </Button>
      </div>
      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
        <Button
          icon={<FilterOutlined />}
          onClick={onOpenDrawer}
        >
          筛选
          {filterCount > 0 && (
            <Badge
              count={filterCount}
              offset={[5, -5]}
              color="blue"
            />
          )}
        </Button>
        <Button
          icon={<ReloadOutlined />}
          onClick={onReset}
        >
          重置
        </Button>
      </div>
    </div>
  );
}

/**
 * 移动端筛选抽屉
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
  const departmentText = department?.[0] ?? '';
  
  return (
    <Drawer
      title="用户筛选"
      placement="bottom"
      open={open}
      onClose={onClose}
      style={{ height: "auto" }}
      styles={{ body: { paddingBottom: 80 } }}
      extra={
        <Button type="link" onClick={onReset}>
          重置
        </Button>
      }
    >
      <Space direction="vertical" style={{ width: "100%" }} size="middle">
        <div>
          <div style={{ marginBottom: 8, fontWeight: 500 }}>部门</div>
          <Input
            placeholder="部门"
            value={departmentText}
            onChange={(e) => {
              const { value } = e.target;
              setFilters((prev) => ({
                ...prev,
                department: value ? [value] : [],
              }));
              setPage(1);
            }}
            allowClear
          />
        </div>
        <div>
          <div style={{ marginBottom: 8, fontWeight: 500 }}>用户类型</div>
          <Select
            mode="multiple"
            value={userType && userType.length > 0 ? userType : []}
            onChange={(val) => {
              setFilters((prev) => ({ ...prev, userType: val || [] }));
              setPage(1);
            }}
            options={USER_TYPE_OPTIONS}
            placeholder="选择类型"
            style={{ width: "100%" }}
            allowClear
          />
        </div>
        <div>
          <div style={{ marginBottom: 8, fontWeight: 500 }}>状态</div>
          <Select
            mode="multiple"
            value={isDisabled && isDisabled.length > 0 ? isDisabled : []}
            onChange={(val) => {
              setFilters((prev) => ({ ...prev, isDisabled: val || [] }));
              setPage(1);
            }}
            options={USER_STATUS_OPTIONS}
            placeholder="选择状态"
            style={{ width: "100%" }}
            allowClear
          />
        </div>
      </Space>
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          padding: "12px 24px",
          background: "var(--color-surface)",
          borderTop: "1px solid var(--color-border)",
          display: "flex",
          gap: 12,
        }}
      >
        <Button block onClick={onClose}>
          取消
        </Button>
        <Button
          type="primary"
          block
          onClick={onClose}
        >
          确认
        </Button>
      </div>
    </Drawer>
  );
}
