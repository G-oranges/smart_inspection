/**
 * 账号与权限管理模块 - 账户单独授权区块
 * @module pages/account-permission/BatchAuthSection
 */

import { useEffect, useMemo, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { Button, Card, Input, Select, Tag, message } from 'antd';
import type { TableColumnsType } from 'antd';
import { ReloadOutlined, SearchOutlined, SettingOutlined } from '@ant-design/icons';

import GlassTable from '../../components/GlassTable';
import TableFieldSettings from '../../components/TableFieldSettings';
import { useMobile } from '../../hooks/useMobile';
import { useResizableColumns } from '../../hooks/useResizableColumns';
import { useTableColumns } from '../../hooks/useTableColumns';
import { commonService } from '../../services/commonService';
import type { PermissionDefinition, EntityId, RoleDataScope } from '../../types/service';
import DataScopeEditor from './DataScopeEditor';
import { DesktopFilters } from './UserFilters';
import { useScopeOptions } from './useScopeOptions';
import { normalizeScope } from './scopeUtils';
import {
  BATCH_AUTH_USER_DEFAULT_COLUMNS,
  BATCH_AUTH_USER_TABLE_KEY,
  type UserColumnConfig,
} from './accountPermissionSchema';
import type {
  AccountUser,
  BatchPermissionState,
  PermissionMode,
  TableListState,
  UserFilters,
} from './types';

interface BatchAuthSectionProps {
  searchTerm: string;
  setSearchTerm: Dispatch<SetStateAction<string>>;
  filters: UserFilters;
  setFilters: Dispatch<SetStateAction<UserFilters>>;
  setPage: Dispatch<SetStateAction<number>>;
  onSearch: () => void;
  onReset: () => void;
  onRefresh: () => void;
  tableData: TableListState<AccountUser>;
  loading: boolean;
  page: number;
  sortField?: string;
  sortOrder?: 'asc' | 'desc';
  onSortChange?: (field: string, order: 'asc' | 'desc' | null) => void;
  selectedUserIds: EntityId[];
  setSelectedUserIds: Dispatch<SetStateAction<EntityId[]>>;
  permissions?: PermissionDefinition[];
  batchPermissions: BatchPermissionState;
  setBatchPermissions: Dispatch<SetStateAction<BatchPermissionState>>;
  fetchTableConfig?: (tableKey: string) => Promise<{ config?: UserColumnConfig[] } | null | undefined>;
  saveTableConfig?: (tableKey: string, columns: UserColumnConfig[]) => Promise<unknown>;
  /** baseline：单选账号时该账号已有的例外，用于只提交改动过的功能点 */
  onSave: (baseline: BatchPermissionState) => void | Promise<void>;
}

function overridesToState(result: unknown): BatchPermissionState {
  const list = (result as { overrides?: Array<{ permissionId?: EntityId; grant?: boolean }> })?.overrides || [];
  const state: BatchPermissionState = {};
  list.forEach((item) => {
    if (item.permissionId !== undefined && item.permissionId !== null) {
      state[String(item.permissionId)] = item.grant ? 'grant' : 'deny';
    }
  });
  return state;
}

/** 单选账号时：载入其已有例外作为基线，并提供账号数据范围的单独设置。 */
function useSingleAccountState(
  selectedUserIds: EntityId[],
  setBatchPermissions: Dispatch<SetStateAction<BatchPermissionState>>,
) {
  const singleUserId = selectedUserIds.length === 1 ? selectedUserIds[0] : null;
  const [baseline, setBaseline] = useState<BatchPermissionState>({});
  const [scope, setScope] = useState<RoleDataScope>(() => normalizeScope(undefined, { presetCode: 'INHERIT' }));
  const [scopeLoading, setScopeLoading] = useState(false);
  const [scopeSaving, setScopeSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setBaseline({});
    setBatchPermissions({});
    if (singleUserId === null) {
      return undefined;
    }
    setScopeLoading(true);
    Promise.all([commonService.getUserOverrides(singleUserId), commonService.getUserDataScope(singleUserId)])
      .then(([overrides, dataScope]) => {
        if (cancelled) {
          return;
        }
        const loaded = overridesToState(overrides);
        setBaseline(loaded);
        setBatchPermissions(loaded);
        const value = dataScope.dataScope;
        setScope(
          normalizeScope(undefined, {
            presetCode: value?.inherited ? 'INHERIT' : value?.scopeMode,
            rules: value?.rules,
          }),
        );
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          message.error(error instanceof Error ? error.message : '加载用户授权失败');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setScopeLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [singleUserId, setBatchPermissions]);

  const saveScope = async () => {
    if (singleUserId === null) {
      return;
    }
    setScopeSaving(true);
    try {
      if (scope.presetCode === 'INHERIT') {
        await commonService.deleteUserDataScope(singleUserId);
      } else {
        await commonService.saveUserDataScope(singleUserId, {
          scopeMode: scope.presetCode,
          presetCode: scope.presetCode,
          rules: scope.rules,
        });
      }
      message.success('用户数据范围已保存');
    } catch (error) {
      message.error(error instanceof Error ? error.message : '保存数据范围失败');
    } finally {
      setScopeSaving(false);
    }
  };

  return { singleUserId, baseline, scope, setScope, scopeLoading, scopeSaving, saveScope };
}

function buildBatchUserColumns(
  visibleColumns: UserColumnConfig[],
  sortField?: string,
  sortOrder?: 'asc' | 'desc',
): TableColumnsType<AccountUser> {
  const resolveOrder = (key: string) =>
    sortField === key ? (sortOrder === 'asc' ? 'ascend' : 'descend') : null;

  const columnMap: Record<string, TableColumnsType<AccountUser>[number]> = {
    username: {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
      width: 160,
      ellipsis: true,
    },
    fullName: {
      title: '姓名',
      dataIndex: 'fullName',
      key: 'fullName',
      width: 140,
      ellipsis: true,
    },
    roles: {
      title: '角色',
      key: 'roles',
      width: 220,
      ellipsis: true,
      render: (_, user) => user.roles?.map((role) => role.name).join(', ') || user.userType || '-',
    },
    department: {
      title: '学院',
      dataIndex: 'department',
      key: 'department',
      width: 180,
      ellipsis: true,
      render: (value: AccountUser['department']) => value || '-',
    },
  };

  return visibleColumns
    .map((column) => {
      const def = columnMap[column.fieldKey];
      if (!def) {
        return null;
      }
      return {
        ...def,
        title: column.label || def.title,
        key: column.fieldKey,
        align: 'center' as const,
        width: column.width ?? def.width ?? 150,
        sorter: Boolean(column.sortable),
        sortOrder: resolveOrder(column.fieldKey),
      } as TableColumnsType<AccountUser>[number];
    })
    .filter((col): col is TableColumnsType<AccountUser>[number] => Boolean(col));
}

const PERMISSION_MODE_OPTIONS: Array<{ value: PermissionMode; label: string }> = [
  { value: 'inherit', label: '继承角色' },
  { value: 'grant', label: '强制允许' },
  { value: 'deny', label: '强制禁止' },
];

/**
 * 账户单独授权区块组件
 */
export default function BatchAuthSection({
  searchTerm,
  setSearchTerm,
  filters,
  setFilters,
  setPage,
  onSearch,
  onReset,
  onRefresh,
  tableData,
  loading,
  page,
  sortField,
  sortOrder,
  onSortChange,
  selectedUserIds,
  setSelectedUserIds,
  permissions,
  batchPermissions,
  setBatchPermissions,
  fetchTableConfig,
  saveTableConfig,
  onSave,
}: BatchAuthSectionProps) {
  const isMobile = useMobile();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const account = useSingleAccountState(selectedUserIds, setBatchPermissions);
  const { options: scopeOptions, error: scopeOptionsError } = useScopeOptions(account.singleUserId !== null);
  const {
    columns: batchUserColumns,
    visibleColumns: visibleBatchUserColumns,
    save: saveBatchUserColumns,
    resetToDefault: resetBatchUserColumns,
    saving: savingBatchUserColumns,
  } = useTableColumns<UserColumnConfig>({
    tableKey: BATCH_AUTH_USER_TABLE_KEY,
    defaultColumns: BATCH_AUTH_USER_DEFAULT_COLUMNS,
    fetchConfig: fetchTableConfig
      ? async (tableKey) => fetchTableConfig(tableKey)
      : undefined,
    saveConfig: saveTableConfig
      ? async (tableKey, columns) => saveTableConfig(tableKey, columns)
      : undefined,
  });
  const baseUserColumns = useMemo(
    () => buildBatchUserColumns(visibleBatchUserColumns, sortField, sortOrder),
    [sortField, sortOrder, visibleBatchUserColumns],
  );
  const { columns: resizableUserColumns } = useResizableColumns(
    baseUserColumns as Array<Record<string, unknown>>,
    { minWidth: 80, maxWidth: 460 },
  );
  const permissionDataSource = useMemo(
    () =>
      (permissions || []).map((permission) => ({
        key: String(permission.id ?? permission.code ?? permission.name ?? Math.random()),
        permissionId: permission.id,
        permissionName: permission.name || '-',
      })),
    [permissions],
  );

  const permissionColumns = useMemo<
    TableColumnsType<{
      key: string;
      permissionId?: EntityId;
      permissionName: string;
    }>
  >(
    () => [
      {
        title: '功能点',
        dataIndex: 'permissionName',
        key: 'permissionName',
        align: 'center',
        width: 280,
        sorter: (left, right) =>
          left.permissionName.localeCompare(right.permissionName, 'zh-CN'),
        render: (value: string) => <span className="font-medium">{value}</span>,
      },
      {
        title: '授权状态',
        key: 'mode',
        align: 'center',
        width: 180,
        render: (_, record) => {
          const optionKey =
            record.permissionId === undefined ? undefined : String(record.permissionId);

          return (
            <Select
              value={optionKey ? batchPermissions[optionKey] || 'inherit' : 'inherit'}
              onChange={(value: PermissionMode) => {
                if (!optionKey) {
                  return;
                }

                setBatchPermissions((prev) => ({
                  ...prev,
                  [optionKey]: value,
                }));
              }}
              options={PERMISSION_MODE_OPTIONS}
              style={{ width: 132 }}
              disabled={!optionKey}
            />
          );
        },
      },
    ],
    [batchPermissions, setBatchPermissions],
  );
  const { columns: resizablePermissionColumns } = useResizableColumns(
    permissionColumns as Array<Record<string, unknown>>,
    { minWidth: 120, maxWidth: 500 },
  );

  const userTable = (
    <>
      <div className="flex flex-col gap-3 mb-4">
        <div className="dorm-toolbar-shell">
          <div className="dorm-toolbar-row dorm-toolbar-row-main">
            <Input
              placeholder="搜索用户名/姓名"
              prefix={<SearchOutlined className="text-gray-400" />}
              className="apple-search-input dorm-toolbar-search !bg-gray-100/50 dark:!bg-white/5 border-none flex-1 min-w-[240px]"
              value={searchTerm}
              onChange={(event) => {
                setSearchTerm(event.target.value);
                setPage(1);
              }}
              onPressEnter={onSearch}
              allowClear
            />
            <Button
              type="primary"
              icon={<SearchOutlined />}
              onClick={onSearch}
              loading={loading}
              className="apple-btn-primary dorm-toolbar-button dorm-toolbar-button-primary active:scale-95 transition-all border-none"
            >
              搜索
            </Button>
            <Button
              icon={<ReloadOutlined />}
              onClick={onReset}
              className="dorm-toolbar-button dorm-toolbar-button-subtle active:scale-95 transition-all"
            >
              重置
            </Button>
          </div>
          <div className="dorm-toolbar-row dorm-toolbar-row-actions">
            <Button
              icon={<ReloadOutlined />}
              onClick={onRefresh}
              className="dorm-toolbar-button dorm-toolbar-button-subtle active:scale-95 transition-all"
            >
              刷新
            </Button>
            <Button
              icon={<SettingOutlined className="text-gray-600 dark:text-gray-300" />}
              onClick={() => setSettingsOpen(true)}
              className="dorm-toolbar-button dorm-toolbar-button-subtle active:scale-95 transition-all"
            >
              字段设置
            </Button>
          </div>
        </div>
        <div className="dorm-toolbar-row dorm-toolbar-row-filters">
          <div className="flex-1">
            <DesktopFilters
              filters={filters}
              setFilters={setFilters}
              setPage={setPage}
              onReset={onReset}
            />
          </div>
        </div>
      </div>
      <div className="table-wrapper dorm-table-wrapper">
        <GlassTable
          className="dorm-table"
          dataSource={tableData.items}
          loading={loading}
          rowKey="id"
          size="middle"
          rowSelection={{
            selectedRowKeys: selectedUserIds,
            onChange: (keys) => setSelectedUserIds(keys as EntityId[]),
          }}
          columns={resizableUserColumns as unknown as TableColumnsType<AccountUser>}
          pagination={{
            current: page,
            pageSize: 10,
            total: tableData.total,
            showSizeChanger: false,
          }}
          onChange={(nextPagination, _filters, sorter) => {
            if (nextPagination.current && nextPagination.current !== page) {
              setPage(nextPagination.current);
            }
            if (!onSortChange) {
              return;
            }
            const activeSorter = Array.isArray(sorter) ? sorter[0] : sorter;
            const field =
              activeSorter?.columnKey !== undefined && activeSorter?.columnKey !== null
                ? String(activeSorter.columnKey)
                : activeSorter?.field !== undefined && activeSorter?.field !== null
                  ? String(activeSorter.field)
                  : '';
            if (!activeSorter?.order || !field) {
              onSortChange('', null);
            } else {
              onSortChange(field, activeSorter.order === 'ascend' ? 'asc' : 'desc');
            }
          }}
          scroll={{ x: 760 }}
          useSkeleton={false}
          resizable={true}
        />
      </div>
    </>
  );

  const permissionTable = selectedUserIds.length > 0 ? (
    <>
      <div className="table-head dorm-table-head mb-4">
        <div className="flex items-center gap-2">
          <div className="dorm-table-head-accent" />
          <h3 className="dorm-table-head-title">授权配置</h3>
        </div>
        <div className="table-head-actions">
          <Tag color="blue">已选 {selectedUserIds.length} 个用户</Tag>
          <Button
            type="primary"
            onClick={() => onSave(account.baseline)}
            disabled={!selectedUserIds.length}
            className="apple-btn-primary dorm-toolbar-button dorm-toolbar-button-primary active:scale-95 transition-all"
          >
            保存授权
          </Button>
        </div>
      </div>

      <div className="table-wrapper dorm-table-wrapper">
        <GlassTable
          className="dorm-table"
          columns={
            resizablePermissionColumns as unknown as TableColumnsType<{
              key: string;
              permissionId?: EntityId;
              permissionName: string;
            }>
          }
          dataSource={permissionDataSource}
          rowKey="key"
          pagination={false}
          scroll={{ x: 520 }}
          useSkeleton={false}
          resizable={true}
        />
      </div>
    </>
  ) : null;

  // 单选账号时可单独设置数据范围（覆盖角色范围）
  const scopeSection =
    account.singleUserId !== null ? (
      <>
        <div className="table-head dorm-table-head mb-4">
          <div className="flex items-center gap-2">
            <div className="dorm-table-head-accent" />
            <h3 className="dorm-table-head-title">数据范围</h3>
          </div>
          <div className="table-head-actions">
            <Button
              type="primary"
              loading={account.scopeSaving}
              onClick={() => void account.saveScope()}
              className="apple-btn-primary dorm-toolbar-button dorm-toolbar-button-primary active:scale-95 transition-all"
            >
              保存数据范围
            </Button>
          </div>
        </div>
        <DataScopeEditor
          value={account.scope}
          onChange={account.setScope}
          options={scopeOptions}
          optionsError={scopeOptionsError}
          loading={account.scopeLoading}
          allowInherit
        />
      </>
    ) : null;

  const fieldSettingsModal = (
    <TableFieldSettings
      open={settingsOpen}
      columns={batchUserColumns}
      onClose={() => setSettingsOpen(false)}
      onSave={async (columns) => {
        await saveBatchUserColumns(
          columns.map((column) => ({
            ...column,
            fieldKey: column.fieldKey,
            label: column.label || column.fieldKey,
          })) as UserColumnConfig[],
        );
        setSettingsOpen(false);
      }}
      onReset={resetBatchUserColumns}
      saving={savingBatchUserColumns}
      title="用户例外授权列表字段设置"
    />
  );

  if (!isMobile) {
    return (
      <>
        <div className="mb-6">
          <div className="table-head dorm-table-head mb-4">
            <div className="flex items-center gap-2">
              <div className="dorm-table-head-accent" />
              <h3 className="dorm-table-head-title">用户列表</h3>
            </div>
            <div className="table-head-actions">
              {selectedUserIds.length ? <Tag color="blue">已选 {selectedUserIds.length} 个用户</Tag> : null}
            </div>
          </div>
          {userTable}
        </div>
        {permissionTable ? <div className="mb-6">{permissionTable}</div> : null}
        {scopeSection ? <div className="mb-6">{scopeSection}</div> : null}
        {fieldSettingsModal}
      </>
    );
  }

  return (
    <Card className="table-card glass-card" variant="borderless">
      <div className="table-head">
        <div>
          <h3 className="section-title">用户例外授权</h3>
        </div>
        <div className="table-head-actions">
          {selectedUserIds.length ? <Tag color="blue">已选 {selectedUserIds.length} 个用户</Tag> : null}
        </div>
      </div>
      {userTable}
      {permissionTable ? <div className="pt-2">{permissionTable}</div> : null}
      {scopeSection ? <div className="pt-2">{scopeSection}</div> : null}
      {fieldSettingsModal}
    </Card>
  );
}
