/**
 * 账号与权限管理模块 - 账户单独授权区块
 * @module pages/account-permission/BatchAuthSection
 */

import { useEffect, useMemo, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { Button, Card, Input, Select, Tag, message } from 'antd';
import type { TableColumnsType } from 'antd';
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons';

import GlassTable from '../../components/GlassTable';
import { useMobile } from '../../hooks/useMobile';
import { commonService } from '../../services/commonService';
import type { PermissionDefinition, EntityId, RoleDataScope } from '../../types/service';
import DataScopeEditor from './DataScopeEditor';
import { useScopeOptions } from './useScopeOptions';
import { normalizeScope } from './scopeUtils';
import type { BatchPermissionState, PermissionMode, AccountUser, TableListState } from './types';

interface BatchAuthSectionProps {
  searchTerm: string;
  setSearchTerm: Dispatch<SetStateAction<string>>;
  setPage: Dispatch<SetStateAction<number>>;
  onRefresh: () => void;
  tableData: TableListState<AccountUser>;
  loading: boolean;
  page: number;
  selectedUserIds: EntityId[];
  setSelectedUserIds: Dispatch<SetStateAction<EntityId[]>>;
  permissions?: PermissionDefinition[];
  batchPermissions: BatchPermissionState;
  setBatchPermissions: Dispatch<SetStateAction<BatchPermissionState>>;
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

const USER_TABLE_COLUMNS: TableColumnsType<AccountUser> = [
  { title: '用户名', dataIndex: 'username', key: 'username', width: 160 },
  { title: '姓名', dataIndex: 'fullName', key: 'fullName', width: 140 },
  {
    title: '角色',
    key: 'roles',
    width: 220,
    render: (_, user) => user.roles?.map((role) => role.name).join(', ') || user.userType || '-',
  },
  {
    title: '学院',
    dataIndex: 'department',
    key: 'department',
    width: 180,
    render: (value: AccountUser['department']) => value || '-',
  },
];

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
  setPage,
  onRefresh,
  tableData,
  loading,
  page,
  selectedUserIds,
  setSelectedUserIds,
  permissions,
  batchPermissions,
  setBatchPermissions,
  onSave,
}: BatchAuthSectionProps) {
  const isMobile = useMobile();
  const account = useSingleAccountState(selectedUserIds, setBatchPermissions);
  const { options: scopeOptions, error: scopeOptionsError } = useScopeOptions(account.singleUserId !== null);
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
        width: 280,
        render: (value: string) => <span className="font-medium">{value}</span>,
      },
      {
        title: '授权状态',
        key: 'mode',
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

  const userTable = (
    <>
      <div className="dorm-toolbar-shell mb-4">
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
            allowClear
          />
        </div>
        <div className="dorm-toolbar-row dorm-toolbar-row-actions">
          <Button
            icon={<ReloadOutlined />}
            onClick={onRefresh}
            className="dorm-toolbar-button dorm-toolbar-button-subtle active:scale-95 transition-all"
          >
            刷新
          </Button>
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
          columns={USER_TABLE_COLUMNS}
          pagination={{
            current: page,
            pageSize: 10,
            total: tableData.total,
            onChange: (nextPage) => setPage(nextPage),
            showSizeChanger: false,
          }}
          scroll={{ x: 760 }}
          useSkeleton={false}
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
          columns={permissionColumns}
          dataSource={permissionDataSource}
          rowKey="key"
          pagination={false}
          scroll={{ x: 520 }}
          useSkeleton={false}
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
    </Card>
  );
}
