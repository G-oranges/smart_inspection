/**
 * 账号与权限管理模块 - 账户单独授权区块
 * @module pages/account-permission/BatchAuthSection
 */

import { useMemo } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { Button, Card, Input, Select, Tag } from 'antd';
import type { TableColumnsType } from 'antd';
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons';

import GlassTable from '../../components/GlassTable';
import { useMobile } from '../../hooks/useMobile';
import type { PermissionDefinition, EntityId } from '../../types/service';
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
  onSave: () => void | Promise<void>;
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
    title: '部门',
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
            className="dorm-toolbar-button dorm-toolbar-button-subtle"
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
          <Tag color="blue">已选择 {selectedUserIds.length} 个账号</Tag>
          <Button
            type="primary"
            onClick={onSave}
            disabled={!selectedUserIds.length}
            className="apple-btn-primary dorm-toolbar-button dorm-toolbar-button-primary"
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

  if (!isMobile) {
    return (
      <>
        <div className="mb-6">
          <div className="table-head dorm-table-head mb-4">
            <div className="flex items-center gap-2">
              <div className="dorm-table-head-accent" />
              <h3 className="dorm-table-head-title">账户列表</h3>
            </div>
            <div className="table-head-actions">
              {selectedUserIds.length ? <Tag color="blue">已选择 {selectedUserIds.length} 个账号</Tag> : null}
            </div>
          </div>
          {userTable}
        </div>
        {permissionTable ? <div className="mb-6">{permissionTable}</div> : null}
      </>
    );
  }

  return (
    <Card className="table-card glass-card" variant="borderless">
      <div className="table-head">
        <div>
          <h3 className="section-title">账户单独授权</h3>
        </div>
        <div className="table-head-actions">
          {selectedUserIds.length ? <Tag color="blue">已选择 {selectedUserIds.length} 个账号</Tag> : null}
        </div>
      </div>
      {userTable}
      {permissionTable ? <div className="pt-2">{permissionTable}</div> : null}
    </Card>
  );
}
