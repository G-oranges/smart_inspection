import type {
  Dispatch,
  FormEvent,
  Key,
  ReactNode,
  SetStateAction,
} from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Col,
  Empty,
  FloatButton,
  Input,
  Tabs,
  Tag,
} from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  DeleteOutlined,
  LockOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  SafetyOutlined,
  SettingOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons';

import { useAppContext } from '../context/AppContext';
import TableFieldSettings from '../components/TableFieldSettings';
import ResponsiveDataView from '../components/ResponsiveDataView';
import PageLayout from '../components/PageLayout';
import AppleStatCard from '../components/common/AppleStatCard';
import PermissionDeniedState from '../components/common/PermissionDeniedState';
import { accountPermissionAccessPreset } from '../components/common/permissionDeniedPresets';
import CollapsibleStatsBoard, {
  type StatSegment,
} from '../components/stats/CollapsibleStatsBoard';
import { useTableColumns } from '../hooks/useTableColumns';
import useTableState from '../hooks/useTableState';
import { useMobile } from '../hooks/useMobile';
import {
  BatchAuthSection,
  DEFAULT_ROLES,
  DesktopFilters,
  MobileFilterDrawer,
  MobileFilterTrigger,
  MonitorSetupSection,
  PermissionMatrix,
  STANDARD_ROLE_CODES,
  TempPasswordModal,
  USER_DEFAULT_COLUMNS,
  USER_TABLE_KEY,
  UserActionSheet,
  UserFormModal,
  UserMobileCard,
  buildAntTableColumns,
  buildUserTableParams,
  initialUserForm,
} from './account-permission';
import RoleManagementSection from './account-permission/RoleManagementSection';
import { useAccountActions } from './account-permission/useAccountActions';

import type { AppActions, RoleLike } from '../types/app';
import type {
  EntityId,
  RoleMatrixResponse,
  ServiceQueryParams,
  ServiceRecord,
  ServiceTableResponse,
} from '../types/service';
import type {
  AccountPermissionActions,
  AccountPermissionData,
  AccountPermissionTab,
  AccountUser,
  BatchPermissionState,
  MonitorConflictModalState,
  MonitorFilters,
  RolePermissionMap,
  TableListState,
  TempPasswordModalState,
  UserFilters,
  UserFormState,
} from './account-permission/types';
import type { UserColumnConfig } from './account-permission/accountPermissionSchema';
import type { UseTableStateResult } from '../types/table';
const initialUserFormState = initialUserForm;
const USER_FILTER_KEYS = ['department', 'userType', 'isDisabled'] as const;

const DEFAULT_MONITOR_FILTERS: MonitorFilters = {
  building: [],
  floor: [],
  major: [],
  className: [],
};

const DEFAULT_MONITOR_CONFLICT_MODAL: MonitorConflictModalState = {
  visible: false,
  conflicts: [],
  nonConflicts: [],
};

const DEFAULT_TEMP_PASSWORD_MODAL: TempPasswordModalState = {
  visible: false,
  password: '',
  username: '',
};

function pickAction<T extends (...args: never[]) => unknown>(
  source: AppActions,
  key: string,
): T | undefined {
  const value = source[key];
  return typeof value === 'function' ? (value as T) : undefined;
}

function createAccountPermissionActions(
  source: AppActions,
): AccountPermissionActions {
  return {
    loadUsers: pickAction<NonNullable<AccountPermissionActions['loadUsers']>>(
      source,
      'loadUsers',
    ),
    createUser: pickAction<NonNullable<AccountPermissionActions['createUser']>>(
      source,
      'createUser',
    ),
    updateUser: pickAction<NonNullable<AccountPermissionActions['updateUser']>>(
      source,
      'updateUser',
    ),
    deleteUsers: pickAction<NonNullable<AccountPermissionActions['deleteUsers']>>(
      source,
      'deleteUsers',
    ),
    resetUserPassword: pickAction<
      NonNullable<AccountPermissionActions['resetUserPassword']>
    >(source, 'resetUserPassword'),
    generateTemporaryPassword: pickAction<
      NonNullable<AccountPermissionActions['generateTemporaryPassword']>
    >(source, 'generateTemporaryPassword'),
    fetchRoleMatrix: pickAction<
      NonNullable<AccountPermissionActions['fetchRoleMatrix']>
    >(source, 'fetchRoleMatrix'),
    updateRolePermissions: pickAction<
      NonNullable<AccountPermissionActions['updateRolePermissions']>
    >(source, 'updateRolePermissions'),
    updateUserOverrides: pickAction<
      NonNullable<AccountPermissionActions['updateUserOverrides']>
    >(source, 'updateUserOverrides'),
    fetchRoles: pickAction<NonNullable<AccountPermissionActions['fetchRoles']>>(
      source,
      'fetchRoles',
    ),
    fetchRoleTypes: pickAction<NonNullable<AccountPermissionActions['fetchRoleTypes']>>(
      source,
      'fetchRoleTypes',
    ),
    createRole: pickAction<NonNullable<AccountPermissionActions['createRole']>>(
      source,
      'createRole',
    ),
    updateRole: pickAction<NonNullable<AccountPermissionActions['updateRole']>>(
      source,
      'updateRole',
    ),
    updateRoleStatus: pickAction<
      NonNullable<AccountPermissionActions['updateRoleStatus']>
    >(source, 'updateRoleStatus'),
    deleteRole: pickAction<NonNullable<AccountPermissionActions['deleteRole']>>(
      source,
      'deleteRole',
    ),
    createRoleType: pickAction<NonNullable<AccountPermissionActions['createRoleType']>>(
      source,
      'createRoleType',
    ),
    updateRoleType: pickAction<NonNullable<AccountPermissionActions['updateRoleType']>>(
      source,
      'updateRoleType',
    ),
    updateRoleTypeStatus: pickAction<NonNullable<AccountPermissionActions['updateRoleTypeStatus']>>(
      source,
      'updateRoleTypeStatus',
    ),
    deleteRoleType: pickAction<NonNullable<AccountPermissionActions['deleteRoleType']>>(
      source,
      'deleteRoleType',
    ),
    fetchRoleDataScope: pickAction<
      NonNullable<AccountPermissionActions['fetchRoleDataScope']>
    >(source, 'fetchRoleDataScope'),
    saveRoleDataScope: pickAction<
      NonNullable<AccountPermissionActions['saveRoleDataScope']>
    >(source, 'saveRoleDataScope'),
    loadDorms: pickAction<NonNullable<AccountPermissionActions['loadDorms']>>(
      source,
      'loadDorms',
    ),
    loadStudents: pickAction<
      NonNullable<AccountPermissionActions['loadStudents']>
    >(source, 'loadStudents'),
    batchUpdateUserOverrides: pickAction<
      NonNullable<AccountPermissionActions['batchUpdateUserOverrides']>
    >(source, 'batchUpdateUserOverrides'),
    batchSetMonitor: pickAction<
      NonNullable<AccountPermissionActions['batchSetMonitor']>
    >(source, 'batchSetMonitor'),
    fetchStudentTable: pickAction<
      NonNullable<AccountPermissionActions['fetchStudentTable']>
    >(source, 'fetchStudentTable'),
    fetchTableConfig: pickAction<
      NonNullable<AccountPermissionActions['fetchTableConfig']>
    >(source, 'fetchTableConfig'),
    saveTableConfig: pickAction<
      NonNullable<AccountPermissionActions['saveTableConfig']>
    >(source, 'saveTableConfig'),
    refreshPermissions: pickAction<
      NonNullable<AccountPermissionActions['refreshPermissions']>
    >(source, 'refreshPermissions'),
  };
}

function createEmptyTableState<T>(): TableListState<T> {
  return { items: [], total: 0 };
}

function hasEntityId(value: EntityId | undefined | null): value is EntityId {
  return value !== undefined && value !== null;
}

function toAccountUsers(items: unknown): AccountUser[] {
  return Array.isArray(items) ? (items as AccountUser[]) : [];
}

interface UserTableStateResult
  extends Omit<UseTableStateResult, 'draftFilters' | 'appliedFilters' | 'setDraftFilters'> {
  draftFilters: UserFilters;
  appliedFilters: UserFilters;
  setDraftFilters: Dispatch<SetStateAction<UserFilters>>;
}

function toUserTableStateResult(state: UseTableStateResult): UserTableStateResult {
  return {
    ...state,
    draftFilters: state.draftFilters as UserFilters,
    appliedFilters: state.appliedFilters as UserFilters,
    setDraftFilters: state.setDraftFilters as Dispatch<SetStateAction<UserFilters>>,
  };
}

function sortRoleOptions(roles: RoleLike[]): RoleLike[] {
  return [...roles].sort((left, right) => {
    const leftCode = typeof left.code === 'string' ? left.code : '';
    const rightCode = typeof right.code === 'string' ? right.code : '';
    const leftIndex = STANDARD_ROLE_CODES.indexOf(leftCode);
    const rightIndex = STANDARD_ROLE_CODES.indexOf(rightCode);
    const leftPriority = leftIndex >= 0 ? leftIndex : 1000;
    const rightPriority = rightIndex >= 0 ? rightIndex : 1000;

    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority;
    }

    const sortDiff = Number(left.sort || 100) - Number(right.sort || 100);
    if (sortDiff !== 0) {
      return sortDiff;
    }

    return String(left.name || '').localeCompare(String(right.name || ''), 'zh-CN');
  });
}

function buildRolePermissionMap(
  matrix: RoleMatrixResponse | null,
  matrixRoles: RoleLike[],
): RolePermissionMap {
  const map: RolePermissionMap = new Map();
  if (!matrix) {
    return map;
  }

  matrixRoles.forEach((role) => {
    if (!hasEntityId(role.id)) {
      return;
    }

    const permissions = matrix.rolePermissions
      .filter((item) => item.roleId === role.id && hasEntityId(item.permissionId))
      .map((item) => item.permissionId as EntityId);

    map.set(role.id, new Set(permissions));
  });

  return map;
}

function buildSelectionLabel(
  selectAcrossPages: boolean,
  tableData: TableListState<AccountUser>,
  selectedIds: EntityId[],
): string {
  if (selectAcrossPages) {
    return tableData.total
      ? `已选择当前筛选的全部 ${tableData.total} 条记录`
      : '已选择全部结果';
  }

  if (selectedIds.length) {
    return `已选择 ${selectedIds.length} 条记录`;
  }

  return '未选择记录';
}

function AccountPermissionStats({
  activeCount,
  roleCount,
  studentTotal,
  totalUsers,
}: {
  activeCount: number;
  roleCount: number;
  studentTotal: number;
  totalUsers: number;
}) {
  return (
    <>
      <Col xs={12} sm={12} md={6}>
        <AppleStatCard
          icon={<UserOutlined />}
          value={totalUsers}
          label="注册用户总数"
          dotColor="blue"
        />
      </Col>
      <Col xs={12} sm={12} md={6}>
        <AppleStatCard
          icon={<CheckCircleOutlined />}
          value={activeCount}
          label="活跃账号"
          unit="人"
          dotColor="green"
        />
      </Col>
      <Col xs={12} sm={12} md={6}>
        <AppleStatCard
          icon={<SafetyOutlined />}
          value={roleCount}
          label="预设系统角色"
          dotColor="orange"
        />
      </Col>
      <Col xs={12} sm={12} md={6}>
        <AppleStatCard
          icon={<TeamOutlined />}
          value={studentTotal}
          label="寝室长覆盖"
          unit="名"
          dotColor="purple"
        />
      </Col>
    </>
  );
}

interface UserManagementSectionProps {
  canManageUsers: boolean;
  isMobile: boolean;
  isDirty: boolean;
  loading: boolean;
  searchTerm: string;
  setSearchTerm: Dispatch<SetStateAction<string>>;
  filters: UserFilters;
  setFilters: Dispatch<SetStateAction<UserFilters>>;
  setPage: Dispatch<SetStateAction<number>>;
  page: number;
  pageSize: number;
  setPageSize: Dispatch<SetStateAction<number>>;
  tableData: TableListState<AccountUser>;
  fetchError: string;
  selectedIds: EntityId[];
  setSelectedIds: Dispatch<SetStateAction<EntityId[]>>;
  selectAcrossPages: boolean;
  setSelectAcrossPages: Dispatch<SetStateAction<boolean>>;
  batchLoading: boolean;
  userMessage: string;
  visibleUserColumns: UserColumnConfig[];
  userColumns: UserColumnConfig[];
  columnLoading: boolean;
  columnSaving: boolean;
  columnError: string;
  settingsOpen: boolean;
  setSettingsOpen: Dispatch<SetStateAction<boolean>>;
  saveUserColumns: (columns: UserColumnConfig[]) => Promise<unknown>;
  resetUserColumns: () => Promise<unknown>;
  modalOpen: boolean;
  editingId: EntityId | null;
  form: UserFormState;
  setForm: Dispatch<SetStateAction<UserFormState>>;
  roleOptions: RoleLike[];
  rolesLoading: boolean;
  rolesError: string;
  filterDrawerOpen: boolean;
  setFilterDrawerOpen: Dispatch<SetStateAction<boolean>>;
  actionSheetOpen: boolean;
  setActionSheetOpen: Dispatch<SetStateAction<boolean>>;
  onResetFilters: () => void;
  onSearchNow: () => void;
  onOpenModal: (user?: AccountUser | null) => void;
  onCloseModal: () => void;
  onSelectPage: () => void;
  onSelectAllResults: () => void;
  onClearSelection: () => void;
  onRetryLoad: () => void;
  onToggleStatus: (user: AccountUser) => void;
  onGenerateTempPassword: (user: AccountUser) => Promise<void>;
  onDeleteSingleUser: (user: AccountUser) => Promise<void>;
  onBulkDelete: () => Promise<void>;
  onResetPassword: () => Promise<void>;
  onFormSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

interface UserManagementToolbarProps {
  batchLoading: boolean;
  filters: UserFilters;
  isMobile: boolean;
  isDirty: boolean;
  loading: boolean;
  onBulkDelete: () => Promise<void>;
  onClearSelection: () => void;
  onOpenModal: (user?: AccountUser | null) => void;
  onOpenSettings: () => void;
  onResetFilters: () => void;
  onResetPassword: () => Promise<void>;
  onSearchNow: () => void;
  onSelectAllResults: () => void;
  onSelectPage: () => void;
  searchTerm: string;
  selectedCount: number;
  selectAcrossPages: boolean;
  selectedIds: EntityId[];
  setFilterDrawerOpen: Dispatch<SetStateAction<boolean>>;
  setFilters: Dispatch<SetStateAction<UserFilters>>;
  setPage: Dispatch<SetStateAction<number>>;
  setSearchTerm: Dispatch<SetStateAction<string>>;
  tableData: TableListState<AccountUser>;
  tableItems: AccountUser[];
  userMessage: string;
}

interface UserManagementTableCardProps {
  columnError: string;
  columnLoading: boolean;
  fetchError: string;
  isMobile: boolean;
  loading: boolean;
  onRetryLoad: () => void;
  page: number;
  pageSize: number;
  renderUserCard: (
    user: AccountUser,
    index: number,
    options: { selected: boolean; onSelect?: (selected: boolean) => void },
  ) => JSX.Element;
  rowSelection: {
    selectedRowKeys: EntityId[];
    onChange: (keys: Key[]) => void;
    getCheckboxProps: () => { disabled: boolean };
  };
  selectedRowKeys: EntityId[];
  setPage: Dispatch<SetStateAction<number>>;
  setPageSize: Dispatch<SetStateAction<number>>;
  setSelectedIds: Dispatch<SetStateAction<EntityId[]>>;
  setSelectAcrossPages: Dispatch<SetStateAction<boolean>>;
  setSettingsOpen: Dispatch<SetStateAction<boolean>>;
  tableColumns: ReturnType<typeof buildAntTableColumns>;
  tableData: TableListState<AccountUser>;
  tableItems: AccountUser[];
}

interface UserManagementOverlaysProps {
  actionSheetOpen: boolean;
  columnSaving: boolean;
  editingId: EntityId | null;
  filterDrawerOpen: boolean;
  filters: UserFilters;
  form: UserFormState;
  isMobile: boolean;
  modalOpen: boolean;
  onBulkDelete: () => Promise<void>;
  onCloseModal: () => void;
  onOpenModal: (user?: AccountUser | null) => void;
  onFormSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onResetFilters: () => void;
  onResetPassword: () => Promise<void>;
  resetUserColumns: () => Promise<unknown>;
  roleOptions: RoleLike[];
  rolesError: string;
  rolesLoading: boolean;
  saveUserColumns: (columns: UserColumnConfig[]) => Promise<unknown>;
  selectAcrossPages: boolean;
  selectedIds: EntityId[];
  setActionSheetOpen: Dispatch<SetStateAction<boolean>>;
  setFilterDrawerOpen: Dispatch<SetStateAction<boolean>>;
  setFilters: Dispatch<SetStateAction<UserFilters>>;
  setForm: Dispatch<SetStateAction<UserFormState>>;
  setPage: Dispatch<SetStateAction<number>>;
  setSettingsOpen: Dispatch<SetStateAction<boolean>>;
  settingsOpen: boolean;
  tableData: TableListState<AccountUser>;
  userColumns: UserColumnConfig[];
}

function UserManagementToolbar({
  batchLoading,
  filters,
  isMobile,
  isDirty,
  loading,
  onBulkDelete,
  onClearSelection,
  onOpenModal,
  onOpenSettings,
  onResetFilters,
  onResetPassword,
  onSearchNow,
  onSelectAllResults,
  onSelectPage,
  searchTerm,
  selectedCount,
  selectAcrossPages,
  selectedIds,
  setFilterDrawerOpen,
  setFilters,
  setPage,
  setSearchTerm,
  tableData,
  tableItems,
  userMessage,
}: UserManagementToolbarProps) {
  const selectionSummary = (selectAcrossPages || selectedIds.length > 0) ? (
    <div
      style={{
        marginTop: 12,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexWrap: 'wrap',
      }}
    >
      <Tag color="blue" style={{ margin: 0 }}>
        {buildSelectionLabel(selectAcrossPages, tableData, selectedIds)}
      </Tag>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        <Button type="link" size="small" onClick={onSelectPage} disabled={!tableItems.length}>
          全选当前页
        </Button>
        <Button type="link" size="small" onClick={onSelectAllResults} disabled={!tableData.total}>
          全选筛选结果
        </Button>
        <Button type="link" size="small" onClick={onClearSelection}>
          清空选择
        </Button>
      </div>
    </div>
  ) : null;

  const helperMessage = userMessage ? (
    <p className="muted hero-hint" style={{ marginTop: 8 }}>
      {userMessage}
    </p>
  ) : null;

  if (!isMobile) {
    return (
      <div className="flex flex-col gap-3 mb-4">
        <div className="dorm-toolbar-shell">
          <div className="dorm-toolbar-row dorm-toolbar-row-main">
            <Input
              placeholder="搜索用户名/姓名"
              prefix={<SearchOutlined className="text-gray-400" />}
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              onPressEnter={onSearchNow}
              allowClear
              className="apple-search-input dorm-toolbar-search !rounded-2xl !bg-gray-100/50 dark:!bg-white/5 border-none h-11 flex-1 min-w-[220px]"
            />
            <Button
              type="primary"
              icon={<SearchOutlined />}
              onClick={onSearchNow}
              disabled={!isDirty}
              loading={loading}
              className="apple-btn-primary dorm-toolbar-button dorm-toolbar-button-primary h-11 rounded-xl px-6 active:scale-95 transition-all border-none"
            >
              搜索
            </Button>
            <Button
              icon={<ReloadOutlined />}
              onClick={onResetFilters}
              className="dorm-toolbar-button dorm-toolbar-button-subtle h-11 rounded-2xl border-none bg-gray-100/80 dark:bg-white/10 active:scale-95 transition-all px-5"
            >
              重置
            </Button>
          </div>
          <div className="dorm-toolbar-row dorm-toolbar-row-actions">
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => onOpenModal()}
              className="apple-btn-primary dorm-toolbar-button dorm-toolbar-button-primary h-11 rounded-xl px-6 active:scale-95 transition-all border-none"
            >
              新增用户
            </Button>
            <Button
              icon={<LockOutlined />}
              disabled={!selectAcrossPages && selectedIds.length === 0}
              loading={batchLoading}
              onClick={() => {
                void onResetPassword();
              }}
              className="dorm-toolbar-button dorm-toolbar-button-subtle h-11 rounded-2xl border-none bg-gray-100/80 dark:bg-white/10 active:scale-95 transition-all px-5"
            >
              密码初始化
            </Button>
            <Button
              className="dorm-toolbar-button dorm-toolbar-button-subtle h-11 rounded-2xl border-none bg-gray-200/60 dark:bg-white/15 active:scale-95 transition-all px-5"
              icon={<SettingOutlined className="text-gray-600 dark:text-gray-300" />}
              onClick={onOpenSettings}
              disabled={loading}
            >
              字段管理
            </Button>
            {selectedCount > 0 ? (
              <Button
                danger
                icon={<DeleteOutlined />}
                loading={batchLoading}
                onClick={() => {
                  void onBulkDelete();
                }}
                className="dorm-toolbar-button dorm-toolbar-button-danger h-11 rounded-2xl border-none bg-red-50 dark:bg-red-500/10 text-red-500 active:scale-95 transition-all px-5"
              >
                {`删除 (${selectedCount})`}
              </Button>
            ) : null}
          </div>
        </div>
        <div className="dorm-toolbar-row dorm-toolbar-row-filters">
          <div className="flex-1">
            <DesktopFilters
              filters={filters}
              setFilters={setFilters}
              setPage={setPage}
              onReset={onResetFilters}
            />
          </div>
        </div>
        {selectionSummary}
        {helperMessage}
      </div>
    );
  }

  return (
    <Card className="control-card glass-card" variant="borderless" style={{ marginBottom: '1rem' }}>
      <div
        className="filter-bar"
        style={{
          display: 'flex',
          gap: 12,
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {isMobile ? (
          <MobileFilterTrigger
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            setPage={setPage}
            filters={filters}
            isDirty={isDirty}
            loading={loading}
            onSearch={onSearchNow}
            onOpenDrawer={() => setFilterDrawerOpen(true)}
            onReset={onResetFilters}
          />
        ) : (
          <DesktopFilters
            filters={filters}
            setFilters={setFilters}
            setPage={setPage}
            onReset={onResetFilters}
          />
        )}
        {!isMobile ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => onOpenModal()}>
              新增用户
            </Button>
            <Button
              danger
              icon={<DeleteOutlined />}
              disabled={!selectAcrossPages && selectedIds.length === 0}
              loading={batchLoading}
              onClick={() => {
                void onBulkDelete();
              }}
            >
              删除
            </Button>
            <Button
              icon={<LockOutlined />}
              disabled={!selectAcrossPages && selectedIds.length === 0}
              loading={batchLoading}
              onClick={() => {
                void onResetPassword();
              }}
            >
              密码初始化
            </Button>
          </div>
        ) : null}
      </div>
      {selectionSummary}
      {helperMessage}
    </Card>
  );
}

function UserManagementTableCard({
  columnError,
  columnLoading,
  fetchError,
  isMobile,
  loading,
  onRetryLoad,
  page,
  pageSize,
  renderUserCard,
  rowSelection,
  selectedRowKeys,
  setPage,
  setPageSize,
  setSelectedIds,
  setSelectAcrossPages,
  setSettingsOpen,
  tableColumns,
  tableData,
  tableItems,
}: UserManagementTableCardProps) {
  const tableContent = fetchError ? (
    <div className="error" style={{ padding: 24, textAlign: 'center' }}>
      <p>{fetchError}</p>
      <Button onClick={onRetryLoad}>重新加载</Button>
    </div>
  ) : (
    <ResponsiveDataView<AccountUser>
      className="dorm-table"
      isMobile={isMobile}
      dataSource={tableItems}
      loading={loading}
      rowKey="id"
      columns={tableColumns}
      rowSelection={rowSelection}
      size="middle"
      emptyText={
        <div className="py-20 text-center">
          <UserOutlined className="text-5xl text-gray-200 mb-3" />
          <p className="text-gray-400 text-sm font-medium tracking-wide">
            未找到匹配的用户记录
          </p>
        </div>
      }
      pagination={{
        current: page,
        pageSize,
        total: tableData.total,
      }}
      onPaginationChange={(nextPage: number, nextPageSize?: number) => {
        setPage(nextPage);
        setPageSize(nextPageSize || pageSize);
      }}
      renderCard={renderUserCard}
      selectedKeys={selectedRowKeys}
      onSelectChange={(keys: Key[]) => {
        setSelectAcrossPages(false);
        setSelectedIds(keys as EntityId[]);
      }}
    />
  );

  if (!isMobile) {
    return (
      <div className="mb-6">
        <div className="table-head dorm-table-head mb-4">
          <div className="flex items-center gap-2">
            <div className="dorm-table-head-accent" />
            <h3 className="dorm-table-head-title">用户列表</h3>
          </div>
          <div className="table-head-actions">
            {columnError ? (
              <span className="error" style={{ fontSize: '0.9rem' }}>
                {columnError}
              </span>
            ) : null}
          </div>
        </div>
        <div className="table-wrapper dorm-table-wrapper">{tableContent}</div>
      </div>
    );
  }

  return (
    <Card className="table-card glass-card" variant="borderless">
      <div className="table-head">
        <div>
          <h3 className="section-title">用户列表</h3>
        </div>
        <div className="table-head-actions">
          {columnError ? (
            <span className="error" style={{ fontSize: '0.9rem' }}>
              {columnError}
            </span>
          ) : null}
          <Button
            type="text"
            icon={<SettingOutlined />}
            onClick={() => setSettingsOpen(true)}
            disabled={columnLoading}
          >
            字段设置
          </Button>
        </div>
      </div>
      <div className="table-wrapper">{tableContent}</div>
    </Card>
  );
}

function UserManagementOverlays({
  actionSheetOpen,
  columnSaving,
  editingId,
  filterDrawerOpen,
  filters,
  form,
  isMobile,
  modalOpen,
  onBulkDelete,
  onCloseModal,
  onOpenModal,
  onFormSubmit,
  onResetFilters,
  onResetPassword,
  resetUserColumns,
  roleOptions,
  rolesError,
  rolesLoading,
  saveUserColumns,
  selectAcrossPages,
  selectedIds,
  setActionSheetOpen,
  setFilterDrawerOpen,
  setFilters,
  setForm,
  setPage,
  setSettingsOpen,
  settingsOpen,
  tableData,
  userColumns,
}: UserManagementOverlaysProps) {
  return (
    <>
      <UserFormModal
        open={modalOpen}
        editingId={editingId}
        form={form}
        setForm={setForm}
        onSubmit={onFormSubmit}
        onCancel={onCloseModal}
        roleOptions={roleOptions}
        rolesLoading={rolesLoading}
        rolesError={rolesError}
      />

      <TableFieldSettings
        open={settingsOpen}
        columns={userColumns}
        onClose={() => setSettingsOpen(false)}
        onSave={async (columns: unknown) => {
          await saveUserColumns(columns as UserColumnConfig[]);
          setSettingsOpen(false);
        }}
        onReset={resetUserColumns}
        saving={columnSaving}
        title="用户列表字段设置"
      />

      <MobileFilterDrawer
        open={filterDrawerOpen}
        onClose={() => setFilterDrawerOpen(false)}
        filters={filters}
        setFilters={setFilters}
        setPage={setPage}
        onReset={onResetFilters}
      />

      <UserActionSheet
        open={actionSheetOpen}
        onClose={() => setActionSheetOpen(false)}
        selectedCount={selectAcrossPages ? tableData.total : selectedIds.length}
        onResetPassword={() => {
          void onResetPassword();
        }}
        onBulkDelete={() => {
          void onBulkDelete();
        }}
      />

      {isMobile ? (
        <>
          <FloatButton.BackTop
            style={{ bottom: selectedIds.length > 0 ? 100 : 80, right: 24 }}
          />
          {selectedIds.length === 0 ? (
            <FloatButton
              icon={<PlusOutlined />}
              type="primary"
              onClick={() => onOpenModal()}
              style={{ right: 24, bottom: 24 }}
            />
          ) : null}
        </>
      ) : null}
    </>
  );
}

function UserManagementSection({
  canManageUsers,
  isMobile,
  isDirty,
  searchTerm,
  setSearchTerm,
  filters,
  setFilters,
  setPage,
  page,
  pageSize,
  setPageSize,
  tableData,
  loading,
  fetchError,
  selectedIds,
  setSelectedIds,
  selectAcrossPages,
  setSelectAcrossPages,
  batchLoading,
  userMessage,
  visibleUserColumns,
  userColumns,
  columnLoading,
  columnSaving,
  columnError,
  settingsOpen,
  setSettingsOpen,
  saveUserColumns,
  resetUserColumns,
  modalOpen,
  editingId,
  form,
  setForm,
  roleOptions,
  rolesLoading,
  rolesError,
  filterDrawerOpen,
  setFilterDrawerOpen,
  actionSheetOpen,
  setActionSheetOpen,
  onResetFilters,
  onSearchNow,
  onOpenModal,
  onCloseModal,
  onSelectPage,
  onSelectAllResults,
  onClearSelection,
  onRetryLoad,
  onToggleStatus,
  onGenerateTempPassword,
  onDeleteSingleUser,
  onBulkDelete,
  onResetPassword,
  onFormSubmit,
}: UserManagementSectionProps) {
  const tableItems = tableData.items || [];
  const selectedCount = selectAcrossPages ? tableData.total : selectedIds.length;
  const selectedRowKeys = selectAcrossPages
    ? tableItems.map((item) => item.id).filter(hasEntityId)
    : selectedIds;

  const rowSelection = useMemo(
    () => ({
      selectedRowKeys,
      onChange: (keys: Key[]) => {
        setSelectAcrossPages(false);
        setSelectedIds(keys as EntityId[]);
      },
      getCheckboxProps: () => ({ disabled: selectAcrossPages }),
    }),
    [selectAcrossPages, selectedRowKeys, setSelectAcrossPages, setSelectedIds],
  );

  const columnHandlers = useMemo(
    () => ({
      onToggleStatus,
      onEdit: onOpenModal,
      onGenerateTempPassword,
      onDelete: onDeleteSingleUser,
      batchLoading,
    }),
    [
      batchLoading,
      onDeleteSingleUser,
      onGenerateTempPassword,
      onOpenModal,
      onToggleStatus,
    ],
  );

  const tableColumns = useMemo(
    () => buildAntTableColumns(visibleUserColumns, columnHandlers),
    [columnHandlers, visibleUserColumns],
  );

  const renderUserCard = useCallback(
    (
      user: AccountUser,
      index: number,
      options: { selected: boolean; onSelect?: (selected: boolean) => void },
    ) => (
      <UserMobileCard
        user={user}
        selected={options.selected}
        onSelect={options.onSelect}
      />
    ),
    [],
  );

  if (!canManageUsers) {
    return (
      <PermissionDeniedState
        mode="section"
        message="暂无用户管理权限。"
        className="mb-4"
      />
    );
  }

  return (
    <>
      <UserManagementToolbar
        batchLoading={batchLoading}
        filters={filters}
        isMobile={isMobile}
        isDirty={isDirty}
        loading={loading}
        onBulkDelete={onBulkDelete}
        onClearSelection={onClearSelection}
        onOpenModal={onOpenModal}
        onOpenSettings={() => setSettingsOpen(true)}
        onResetFilters={onResetFilters}
        onSearchNow={onSearchNow}
        onResetPassword={onResetPassword}
        onSelectAllResults={onSelectAllResults}
        onSelectPage={onSelectPage}
        searchTerm={searchTerm}
        selectedCount={selectedCount}
        selectAcrossPages={selectAcrossPages}
        selectedIds={selectedIds}
        setFilterDrawerOpen={setFilterDrawerOpen}
        setFilters={setFilters}
        setPage={setPage}
        setSearchTerm={setSearchTerm}
        tableData={tableData}
        tableItems={tableItems}
        userMessage={userMessage}
      />

      <UserManagementTableCard
        columnError={columnError}
        columnLoading={columnLoading}
        fetchError={fetchError}
        isMobile={isMobile}
        loading={loading}
        onRetryLoad={onRetryLoad}
        page={page}
        pageSize={pageSize}
        renderUserCard={renderUserCard}
        rowSelection={rowSelection}
        selectedRowKeys={selectedRowKeys}
        setPage={setPage}
        setPageSize={setPageSize}
        setSelectedIds={setSelectedIds}
        setSelectAcrossPages={setSelectAcrossPages}
        setSettingsOpen={setSettingsOpen}
        tableColumns={tableColumns}
        tableData={tableData}
        tableItems={tableItems}
      />

      <UserManagementOverlays
        actionSheetOpen={actionSheetOpen}
        columnSaving={columnSaving}
        editingId={editingId}
        filterDrawerOpen={filterDrawerOpen}
        filters={filters}
        form={form}
        isMobile={isMobile}
        modalOpen={modalOpen}
        onBulkDelete={onBulkDelete}
        onCloseModal={onCloseModal}
        onOpenModal={onOpenModal}
        onFormSubmit={onFormSubmit}
        onResetFilters={onResetFilters}
        onResetPassword={onResetPassword}
        resetUserColumns={resetUserColumns}
        roleOptions={roleOptions}
        rolesError={rolesError}
        rolesLoading={rolesLoading}
        saveUserColumns={saveUserColumns}
        selectAcrossPages={selectAcrossPages}
        selectedIds={selectedIds}
        setActionSheetOpen={setActionSheetOpen}
        setFilterDrawerOpen={setFilterDrawerOpen}
        setFilters={setFilters}
        setForm={setForm}
        setPage={setPage}
        setSettingsOpen={setSettingsOpen}
        settingsOpen={settingsOpen}
        tableData={tableData}
        userColumns={userColumns}
      />
    </>
  );
}
interface PermissionManagementSectionProps {
  canManagePermissions: boolean;
  matrixLoading: boolean;
  matrix: RoleMatrixResponse | null;
  matrixRoles: RoleLike[];
  rolePermissionMap: RolePermissionMap;
  onToggleRolePermission: (roleId: EntityId, permissionId: EntityId) => Promise<void>;
  permissionMessage: string;
}

function PermissionManagementSection({
  canManagePermissions,
  matrixLoading,
  matrix,
  matrixRoles,
  rolePermissionMap,
  onToggleRolePermission,
  permissionMessage,
}: PermissionManagementSectionProps) {
  if (!canManagePermissions) {
    return (
      <PermissionDeniedState
        mode="section"
        message="暂无角色权限配置权限。"
        className="mb-4"
      />
    );
  }

  return (
    <>
      <PermissionMatrix
        loading={matrixLoading}
        matrix={matrix}
        matrixRoles={matrixRoles}
        rolePermissionMap={rolePermissionMap}
        onToggle={(roleId: EntityId, permissionId: EntityId) => {
          void onToggleRolePermission(roleId, permissionId);
        }}
      />

      {permissionMessage ? <p className="muted hero-hint">{permissionMessage}</p> : null}
    </>
  );
}

function mapAccountPermissionStatsToSegments({
  activeCount,
  roleCount,
  studentTotal,
  totalUsers,
}: {
  activeCount: number;
  roleCount: number;
  studentTotal: number;
  totalUsers: number;
}): StatSegment[] {
  return [
    {
      id: 'account-total-users',
      icon: <UserOutlined />,
      value: totalUsers,
      label: '用户',
      tone: 'blue',
    },
    {
      id: 'account-active-users',
      icon: <CheckCircleOutlined />,
      value: activeCount,
      label: '活跃',
      unit: '人',
      tone: 'green',
    },
    {
      id: 'account-role-count',
      icon: <SafetyOutlined />,
      value: roleCount,
      label: '角色',
      tone: 'orange',
    },
    {
      id: 'account-monitor-coverage',
      icon: <TeamOutlined />,
      value: studentTotal,
      label: '寝室长',
      unit: '名',
      tone: 'purple',
    },
  ];
}

function PermissionAccessFallback({ message }: { message: string }) {
  return <PermissionDeniedState mode="section" message={message} className="mb-4" />;
}

function useUserTableSettings(accountActions: AccountPermissionActions) {
  return useTableColumns<UserColumnConfig>({
    tableKey: USER_TABLE_KEY,
    defaultColumns: USER_DEFAULT_COLUMNS,
    fetchConfig: accountActions.fetchTableConfig
      ? async (tableKey) =>
          (await accountActions.fetchTableConfig?.(tableKey)) as
            | { config?: UserColumnConfig[] }
            | null
            | undefined
      : undefined,
    saveConfig: accountActions.saveTableConfig
      ? async (tableKey, columns) =>
          accountActions.saveTableConfig?.(tableKey, columns)
      : undefined,
  });
}

function useAccountPermissionRoles({
  accountActions,
  canManagePermissions,
  canManageUsers,
}: {
  accountActions: AccountPermissionActions;
  canManagePermissions: boolean;
  canManageUsers: boolean;
}) {
  const [roleOptions, setRoleOptions] = useState<RoleLike[]>(DEFAULT_ROLES as RoleLike[]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [rolesError, setRolesError] = useState('');

  const loadRoles = useCallback(async (): Promise<void> => {
    if (!accountActions.fetchRoles || (!canManageUsers && !canManagePermissions)) {
      return;
    }

    setRolesLoading(true);
    setRolesError('');
    try {
      const response = await accountActions.fetchRoles();
      const nextRoles = sortRoleOptions((response?.roles || []) as RoleLike[]);
      if (nextRoles.length) {
        setRoleOptions(nextRoles);
      }
    } catch (error: unknown) {
      const nextMessage = error instanceof Error ? error.message : '加载角色失败';
      setRolesError(nextMessage);
    } finally {
      setRolesLoading(false);
    }
  }, [accountActions, canManagePermissions, canManageUsers]);

  useEffect(() => {
    void loadRoles();
  }, [loadRoles]);

  return {
    loadRoles,
    roleOptions,
    rolesError,
    rolesLoading,
  };
}

function useAccountPermissionUserState({
  accountActions,
  activeTab,
  canManageUsers,
  isMobile,
  setSelection,
}: {
  accountActions: AccountPermissionActions;
  activeTab: AccountPermissionTab;
  canManageUsers: boolean;
  isMobile: boolean;
  setSelection: ReturnType<typeof useAppContext>['setSelection'];
}) {
  const [form, setForm] = useState<UserFormState>(initialUserFormState);
  const [editingId, setEditingId] = useState<EntityId | null>(null);
  const [selectedIds, setSelectedIds] = useState<EntityId[]>([]);
  const [selectAcrossPages, setSelectAcrossPages] = useState(false);
  const {
    draftFilters: filters,
    appliedFilters,
    pagination,
    draftSearchTerm: searchTerm,
    appliedSearchTerm,
    isDirty,
    appliedFiltersKey,
    setDraftFilters: setFilters,
    setDraftSearchTerm: setSearchTerm,
    setPagination,
    applyFilters: handleSearchNow,
    resetAll: resetTableState,
  } = toUserTableStateResult(
    useTableState({
      filterKeys: [...USER_FILTER_KEYS],
      defaultPageSize: 10,
      syncUrl: true,
      onApply: () => {
        setSelectAcrossPages(false);
        setSelectedIds([]);
      },
      onReset: () => {
        setSelectAcrossPages(false);
        setSelectedIds([]);
      },
    }),
  );
  const [tableData, setTableData] = useState<TableListState<AccountUser>>(() =>
    createEmptyTableState<AccountUser>(),
  );
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [reloadFlag, setReloadFlag] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [userMessage, setUserMessage] = useState('');
  const [batchLoading, setBatchLoading] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [actionSheetOpen, setActionSheetOpen] = useState(false);

  const {
    columns: userColumns,
    visibleColumns: visibleUserColumns,
    loading: columnLoading,
    saving: columnSaving,
    error: columnError,
    save: saveUserColumns,
    resetToDefault: resetUserColumns,
  } = useUserTableSettings(accountActions);

  const handleClearSelection = useCallback((): void => {
    setSelectAcrossPages(false);
    setSelectedIds([]);
  }, []);

  const handleResetFilters = useCallback((): void => {
    resetTableState();
  }, [resetTableState]);

  const handleRetryLoad = useCallback((): void => {
    setReloadFlag((prev) => prev + 1);
  }, []);

  const openModal = useCallback((user?: AccountUser | null): void => {
    if (user) {
      setEditingId(user.id || null);
      setForm({
        username: user.username || '',
        fullName: user.fullName || '',
        email: user.email || '',
        phone: user.phone || '',
        department: user.department || '',
        userType: user.userType || '',
        isDisabled: Boolean(user.isDisabled),
        role: user.role || '',
        roles: Array.isArray(user.roles)
          ? user.roles.map((role) => role.id).filter(hasEntityId)
          : [],
        avatarUrl: user.avatarUrl || '',
      });
    } else {
      setEditingId(null);
      setForm(initialUserFormState);
    }

    setModalOpen(true);
  }, []);

  const closeModal = useCallback((): void => {
    setModalOpen(false);
    setForm(initialUserFormState);
    setEditingId(null);
  }, []);

  const handleSelectPage = useCallback((): void => {
    const pageIds = tableData.items.map((item) => item.id).filter(hasEntityId);
    setSelectAcrossPages(false);
    setSelectedIds((prev) => Array.from(new Set([...prev, ...pageIds])));
  }, [tableData.items]);

  const handleSelectAllResults = useCallback((): void => {
    setSelectAcrossPages(true);
    setSelectedIds([]);
  }, []);

  useEffect(() => {
    if (!isMobile || activeTab !== 'users') {
      return;
    }

    setSelection({
      count: selectAcrossPages ? tableData.total : selectedIds.length,
      onClear: handleClearSelection,
      onAction: () => setActionSheetOpen(true),
      actionLabel: '操作',
    });
  }, [
    activeTab,
    handleClearSelection,
    isMobile,
    selectAcrossPages,
    selectedIds.length,
    setSelection,
    tableData.total,
  ]);

  useEffect(() => {
    if (!canManageUsers || !accountActions.loadUsers) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    setFetchError('');
    const requestParams = buildUserTableParams({
      ...appliedFilters,
      appliedSearchTerm,
      page: pagination.current,
      pageSize: pagination.pageSize,
    });

    accountActions
      .loadUsers(requestParams)
      .then((response: ServiceTableResponse) => {
        if (cancelled) {
          return;
        }
        setPagination((prev) => ({ ...prev, total: response?.total || 0 }));
        setTableData({
          items: toAccountUsers(response?.items),
          total: response?.total || 0,
        });
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        const nextMessage =
          error instanceof Error ? error.message : '获取用户列表失败';
        setFetchError(nextMessage);
        setTableData(createEmptyTableState<AccountUser>());
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    accountActions,
    appliedFiltersKey,
    appliedSearchTerm,
    canManageUsers,
    pagination.current,
    pagination.pageSize,
    reloadFlag,
    setPagination,
  ]);

  const setPage = useCallback(
    (value: SetStateAction<number>): void => {
      setPagination((prev) => ({
        ...prev,
        current: typeof value === 'function' ? value(prev.current) : value,
      }));
    },
    [setPagination],
  );

  const setPageSize = useCallback(
    (value: SetStateAction<number>): void => {
      setPagination((prev) => ({
        ...prev,
        pageSize: typeof value === 'function' ? value(prev.pageSize) : value,
      }));
    },
    [setPagination],
  );

  return {
    actionSheetOpen,
    batchLoading,
    closeModal,
    columnError,
    columnLoading,
    columnSaving,
    editingId,
    fetchError,
    filterDrawerOpen,
    filters,
    form,
    handleClearSelection,
    handleResetFilters,
    handleSearchNow,
    handleRetryLoad,
    handleSelectAllResults,
    handleSelectPage,
    isDirty,
    loading,
    modalOpen,
    openModal,
    page: pagination.current,
    pageSize: pagination.pageSize,
    reloadFlag,
    resetUserColumns,
    saveUserColumns,
    searchTerm,
    selectAcrossPages,
    selectedIds,
    setActionSheetOpen,
    setBatchLoading,
    setEditingId,
    setFilterDrawerOpen,
    setFilters,
    setForm,
    setPage,
    setPageSize,
    setReloadFlag,
    setSearchTerm,
    setSelectedIds,
    setSelectAcrossPages,
    setSettingsOpen,
    settingsOpen,
    tableData,
    userColumns,
    userMessage,
    userColumnsVisible: visibleUserColumns,
    setUserMessage,
  };
}

function useAccountPermissionPermissionState({
  accountActions,
  activeTab,
  canManagePermissions,
}: {
  accountActions: AccountPermissionActions;
  activeTab: AccountPermissionTab;
  canManagePermissions: boolean;
}) {
  const [matrix, setMatrix] = useState<RoleMatrixResponse | null>(null);
  const [matrixLoading, setMatrixLoading] = useState(false);
  const [permissionMessage, setPermissionMessage] = useState('');
  const [batchUserIds, setBatchUserIds] = useState<EntityId[]>([]);
  const [batchPermissions, setBatchPermissions] = useState<BatchPermissionState>({});
  const [batchUserSearchTerm, setBatchUserSearchTerm] = useState('');
  const [batchUserPage, setBatchUserPage] = useState(1);
  const [batchUserData, setBatchUserData] = useState<TableListState<AccountUser>>(() =>
    createEmptyTableState<AccountUser>(),
  );
  const [batchUserLoading, setBatchUserLoading] = useState(false);
  const [monitorFilters, setMonitorFilters] = useState<MonitorFilters>(DEFAULT_MONITOR_FILTERS);
  const [monitorSearchTerm, setMonitorSearchTerm] = useState('');
  const [selectedStudentIds, setSelectedStudentIds] = useState<EntityId[]>([]);
  const [studentPage, setStudentPage] = useState(1);
  const [studentData, setStudentData] = useState<TableListState<AccountUser>>(() =>
    createEmptyTableState<AccountUser>(),
  );
  const [studentLoading, setStudentLoading] = useState(false);
  const [monitorConflictModal, setMonitorConflictModal] = useState<MonitorConflictModalState>(
    DEFAULT_MONITOR_CONFLICT_MODAL,
  );
  const [tempPasswordModal, setTempPasswordModal] = useState<TempPasswordModalState>(
    DEFAULT_TEMP_PASSWORD_MODAL,
  );

  const loadMatrix = useCallback(async (): Promise<void> => {
    if (!canManagePermissions || !accountActions.fetchRoleMatrix) {
      return;
    }

    setMatrixLoading(true);
    setPermissionMessage('');
    try {
      const response = await accountActions.fetchRoleMatrix();
      setMatrix(response);
    } catch (error: unknown) {
      const nextMessage =
        error instanceof Error ? error.message : '获取权限矩阵失败';
      setPermissionMessage(nextMessage);
    } finally {
      setMatrixLoading(false);
    }
  }, [accountActions, canManagePermissions]);

  useEffect(() => {
    void loadMatrix();
  }, [loadMatrix]);

  useEffect(() => {
    if (!canManagePermissions) {
      return;
    }

    void accountActions.loadDorms?.();
    void accountActions.loadStudents?.();
  }, [accountActions, canManagePermissions]);

  const loadBatchUsers = useCallback(async (): Promise<void> => {
    if (!accountActions.loadUsers) {
      return;
    }

    setBatchUserLoading(true);
    try {
      const result = await accountActions.loadUsers({
        page: batchUserPage,
        pageSize: 10,
        search: batchUserSearchTerm,
      });
      setBatchUserData({
        items: toAccountUsers(result?.items),
        total: result?.total || 0,
      });
    } catch (error) {
      const nextMessage =
        error instanceof Error ? error.message : '加载用户列表失败';
      setPermissionMessage(nextMessage);
    } finally {
      setBatchUserLoading(false);
    }
  }, [accountActions, batchUserPage, batchUserSearchTerm]);

  useEffect(() => {
    if (activeTab !== 'overrides' || !canManagePermissions) {
      return;
    }

    void loadBatchUsers();
  }, [activeTab, canManagePermissions, loadBatchUsers]);

  const loadStudentList = useCallback(async (): Promise<void> => {
    if (!accountActions.fetchStudentTable) {
      return;
    }

    setStudentLoading(true);
    try {
      const result = await accountActions.fetchStudentTable({
        page: studentPage,
        pageSize: 10,
        search: monitorSearchTerm,
        building: monitorFilters.building,
        floor: monitorFilters.floor,
        major: monitorFilters.major,
        className: monitorFilters.className,
      });
      setStudentData({
        items: toAccountUsers(result?.items),
        total: result?.total || 0,
      });
    } catch (error) {
      const nextMessage =
        error instanceof Error ? error.message : '加载学生列表失败';
      setPermissionMessage(nextMessage);
    } finally {
      setStudentLoading(false);
    }
  }, [accountActions, monitorFilters, monitorSearchTerm, studentPage]);

  useEffect(() => {
    if (activeTab !== 'monitors' || !canManagePermissions) {
      return;
    }

    void loadStudentList();
  }, [activeTab, canManagePermissions, loadStudentList]);

  return {
    batchPermissions,
    batchUserData,
    batchUserIds,
    batchUserLoading,
    batchUserPage,
    batchUserSearchTerm,
    loadBatchUsers,
    loadMatrix,
    loadStudentList,
    matrix,
    matrixLoading,
    monitorConflictModal,
    monitorFilters,
    monitorSearchTerm,
    permissionMessage,
    selectedStudentIds,
    setBatchPermissions,
    setBatchUserIds,
    setBatchUserPage,
    setBatchUserSearchTerm,
    setMatrix,
    setMonitorConflictModal,
    setMonitorFilters,
    setMonitorSearchTerm,
    setPermissionMessage,
    setSelectedStudentIds,
    setStudentPage,
    setTempPasswordModal,
    studentData,
    studentLoading,
    studentPage,
    tempPasswordModal,
  };
}

// Page-level orchestrator keeps tab state, data loading, and modal wiring in one place.
export default function AccountPermissionPage() {
  const { data, actions, hasPermission, permissionsReady, setSelection } = useAppContext();
  const accountActions = useMemo(() => createAccountPermissionActions(actions), [actions]);
  const accountData = data as AccountPermissionData;
  const isMobile = useMobile();
  const [activeTab, setActiveTab] = useState<AccountPermissionTab>('users');

  const canManageUsers = hasPermission('USER_MANAGE');
  const canManagePermissions = hasPermission('PERMISSION_MANAGE');
  const userState = useAccountPermissionUserState({
    accountActions,
    activeTab,
    canManageUsers,
    isMobile,
    setSelection,
  });
  const permissionState = useAccountPermissionPermissionState({
    accountActions,
    activeTab,
    canManagePermissions,
  });
  const roleState = useAccountPermissionRoles({
    accountActions,
    canManagePermissions,
    canManageUsers,
  });

  const handleTabChange = useCallback((key: string): void => {
    const nextKey: AccountPermissionTab =
      key === 'permissions' || key === 'overrides' || key === 'monitors' ? key : 'users';
    setActiveTab(nextKey);
    if (nextKey === 'users') {
      permissionState.setPermissionMessage('');
      return;
    }
    userState.setUserMessage('');
  }, [permissionState, userState]);

  const matrixRoles = useMemo(() => {
    if (!permissionState.matrix) {
      return [];
    }

    const roleOrderMap = new Map(
      sortRoleOptions(roleState.roleOptions)
        .filter(
          (role): role is RoleLike & { id: EntityId; code: string } =>
            hasEntityId(role.id) && typeof role.code === 'string',
        )
        .map((role, index) => [role.code, index]),
    );

    return permissionState.matrix.roles
      .filter(
        (role): role is RoleLike & { id: EntityId; code: string } =>
          hasEntityId(role.id) && typeof role.code === 'string',
      )
      .sort(
        (left, right) =>
          (roleOrderMap.get(left.code) || 1000) - (roleOrderMap.get(right.code) || 1000),
      );
  }, [permissionState.matrix, roleState.roleOptions]);

  const rolePermissionMap = useMemo(
    () => buildRolePermissionMap(permissionState.matrix, matrixRoles),
    [permissionState.matrix, matrixRoles],
  );

  const accountActionHandlers = useAccountActions({
    actions: accountActions,
    tableData: userState.tableData,
    selectedIds: userState.selectedIds,
    setSelectedIds: userState.setSelectedIds,
    selectAcrossPages: userState.selectAcrossPages,
    setSelectAcrossPages: userState.setSelectAcrossPages,
    setUserMessage: userState.setUserMessage,
    setPermissionMessage: permissionState.setPermissionMessage,
    setReloadFlag: userState.setReloadFlag,
    setBatchLoading: userState.setBatchLoading,
    matrix: permissionState.matrix,
    setMatrix: permissionState.setMatrix,
    rolePermissionMap,
    selectedStudentIds: permissionState.selectedStudentIds,
    setSelectedStudentIds: permissionState.setSelectedStudentIds,
    setMonitorConflictModal: permissionState.setMonitorConflictModal,
    loadStudentList: permissionState.loadStudentList,
    setTempPasswordModal: permissionState.setTempPasswordModal,
  });

  const handleBatchSaveOverrides = useCallback(async (baseline?: BatchPermissionState): Promise<void> => {
    const success = await accountActionHandlers.handleBatchSaveOverrides(
      permissionState.batchUserIds,
      permissionState.batchPermissions,
      baseline,
    );
    if (!success) {
      return;
    }

    permissionState.setBatchUserIds([]);
    permissionState.setBatchPermissions({});
  }, [accountActionHandlers, permissionState]);

  const handleContinueNonConflicts = useCallback(async (): Promise<void> => {
    await accountActionHandlers.handleContinueNonConflicts(permissionState.monitorConflictModal);
  }, [accountActionHandlers, permissionState.monitorConflictModal]);

  const handleSubmitForm = useCallback(
    (event: FormEvent<HTMLFormElement>): void => {
      void accountActionHandlers.handleFormSubmit(
        event,
        userState.editingId,
        userState.form,
        userState.closeModal,
      );
    },
    [accountActionHandlers, userState.closeModal, userState.editingId, userState.form],
  );

  if (permissionsReady && !canManageUsers && !canManagePermissions) { // 权限加载完成前不显示“访问受限”
    return (
      <div className="account-permission-page management-theme-page">
        <PermissionDeniedState {...accountPermissionAccessPreset} />
      </div>
    );
  }

  return (
    <div className="account-permission-page management-theme-page">
      <PageLayout
        statsLayout="custom"
        stats={
          <CollapsibleStatsBoard
            expandedContent={
              <AccountPermissionStats
                totalUsers={userState.tableData.total}
                activeCount={userState.tableData.items.filter((user) => !user.isDisabled).length}
                roleCount={roleState.roleOptions.length}
                studentTotal={permissionState.studentData.total}
              />
            }
            segments={mapAccountPermissionStatsToSegments({
              totalUsers: userState.tableData.total,
              activeCount: userState.tableData.items.filter((user) => !user.isDisabled).length,
              roleCount: roleState.roleOptions.length,
              studentTotal: permissionState.studentData.total,
            })}
          />
        }
      >
        <Tabs
          activeKey={activeTab}
          onChange={handleTabChange}
          className="apple-tabs"
          destroyInactiveTabPane
          items={[
            {
              key: 'users',
              label: (
                <span className="flex items-center gap-2">
                  <UserOutlined />用户管理
                </span>
              ),
              children:
                activeTab === 'users' ? (
                  <UserManagementSection
                    canManageUsers={canManageUsers}
                    isMobile={isMobile}
                    isDirty={userState.isDirty}
                    searchTerm={userState.searchTerm}
                    setSearchTerm={userState.setSearchTerm}
                    filters={userState.filters}
                    setFilters={userState.setFilters}
                    setPage={userState.setPage}
                    page={userState.page}
                    pageSize={userState.pageSize}
                    setPageSize={userState.setPageSize}
                    tableData={userState.tableData}
                    loading={userState.loading}
                    fetchError={userState.fetchError}
                    selectedIds={userState.selectedIds}
                    setSelectedIds={userState.setSelectedIds}
                    selectAcrossPages={userState.selectAcrossPages}
                    setSelectAcrossPages={userState.setSelectAcrossPages}
                    batchLoading={userState.batchLoading}
                    userMessage={userState.userMessage}
                    visibleUserColumns={userState.userColumnsVisible}
                    userColumns={userState.userColumns}
                    columnLoading={userState.columnLoading}
                    columnSaving={userState.columnSaving}
                    columnError={userState.columnError}
                    settingsOpen={userState.settingsOpen}
                    setSettingsOpen={userState.setSettingsOpen}
                    saveUserColumns={userState.saveUserColumns}
                    resetUserColumns={userState.resetUserColumns}
                    modalOpen={userState.modalOpen}
                    editingId={userState.editingId}
                    form={userState.form}
                    setForm={userState.setForm}
                    roleOptions={roleState.roleOptions}
                    rolesLoading={roleState.rolesLoading}
                    rolesError={roleState.rolesError}
                    filterDrawerOpen={userState.filterDrawerOpen}
                    setFilterDrawerOpen={userState.setFilterDrawerOpen}
                    actionSheetOpen={userState.actionSheetOpen}
                    setActionSheetOpen={userState.setActionSheetOpen}
                    onResetFilters={userState.handleResetFilters}
                    onSearchNow={userState.handleSearchNow}
                    onOpenModal={userState.openModal}
                    onCloseModal={userState.closeModal}
                    onSelectPage={userState.handleSelectPage}
                    onSelectAllResults={userState.handleSelectAllResults}
                    onClearSelection={userState.handleClearSelection}
                    onRetryLoad={userState.handleRetryLoad}
                    onToggleStatus={accountActionHandlers.handleToggleStatus}
                    onGenerateTempPassword={accountActionHandlers.handleGenerateTempPassword}
                    onDeleteSingleUser={accountActionHandlers.handleDeleteSingleUser}
                    onBulkDelete={accountActionHandlers.handleBulkDelete}
                    onResetPassword={accountActionHandlers.handleResetPassword}
                    onFormSubmit={handleSubmitForm}
                  />
                ) : null,
            },
            {
              key: 'permissions',
              label: (
                <span className="flex items-center gap-2">
                  <SafetyOutlined />角色管理
                </span>
              ),
              children:
                activeTab === 'permissions' ? (
                  <RoleManagementSection
                    canManagePermissions={canManagePermissions}
                    matrixLoading={permissionState.matrixLoading}
                    matrix={permissionState.matrix}
                    roleOptions={roleState.roleOptions}
                    rolesLoading={roleState.rolesLoading}
                    permissionMessage={permissionState.permissionMessage}
                    setPermissionMessage={permissionState.setPermissionMessage}
                    accountActions={accountActions}
                    accountData={accountData}
                    refreshRoles={roleState.loadRoles}
                    refreshMatrix={permissionState.loadMatrix}
                  />
                ) : null,
            },
            {
              key: 'overrides',
              label: (
                <span className="flex items-center gap-2">
                  <SettingOutlined />账号例外授权
                </span>
              ),
              children:
                activeTab === 'overrides' ? (
                  canManagePermissions ? (
                    <>
                      <BatchAuthSection
                        searchTerm={permissionState.batchUserSearchTerm}
                        setSearchTerm={permissionState.setBatchUserSearchTerm}
                        setPage={permissionState.setBatchUserPage}
                        onRefresh={() => {
                          void permissionState.loadBatchUsers();
                        }}
                        tableData={permissionState.batchUserData}
                        loading={permissionState.batchUserLoading}
                        page={permissionState.batchUserPage}
                        selectedUserIds={permissionState.batchUserIds}
                        setSelectedUserIds={permissionState.setBatchUserIds}
                        permissions={permissionState.matrix?.permissions}
                        batchPermissions={permissionState.batchPermissions}
                        setBatchPermissions={permissionState.setBatchPermissions}
                        onSave={(baseline) => void handleBatchSaveOverrides(baseline)}
                      />
                      {permissionState.permissionMessage ? (
                        <p className="muted hero-hint">{permissionState.permissionMessage}</p>
                      ) : null}
                    </>
                  ) : (
                    <PermissionAccessFallback message="暂无账户单独授权权限。" />
                  )
                ) : null,
            },
            {
              key: 'monitors',
              label: (
                <span className="flex items-center gap-2">
                  <TeamOutlined />寝室长批量设置
                </span>
              ),
              children:
                activeTab === 'monitors' ? (
                  canManagePermissions ? (
                    <>
                      <MonitorSetupSection
                        dormsData={accountData.dorms}
                        studentsData={accountData.students}
                        searchTerm={permissionState.monitorSearchTerm}
                        setSearchTerm={permissionState.setMonitorSearchTerm}
                        monitorFilters={permissionState.monitorFilters}
                        setMonitorFilters={permissionState.setMonitorFilters}
                        studentPage={permissionState.studentPage}
                        setStudentPage={permissionState.setStudentPage}
                        studentData={permissionState.studentData}
                        studentLoading={permissionState.studentLoading}
                        selectedStudentIds={permissionState.selectedStudentIds}
                        setSelectedStudentIds={permissionState.setSelectedStudentIds}
                        onRefresh={() => {
                          void permissionState.loadStudentList();
                        }}
                        onBatchSetMonitorCheck={() => {
                          void accountActionHandlers.handleBatchSetMonitorCheck();
                        }}
                        conflictModal={permissionState.monitorConflictModal}
                        setConflictModal={permissionState.setMonitorConflictModal}
                        onContinueNonConflicts={() => {
                          void handleContinueNonConflicts();
                        }}
                        onBatchSetMonitorExecute={(replaceExisting: boolean) => {
                          void accountActionHandlers.handleBatchSetMonitorExecute(replaceExisting);
                        }}
                      />
                      {permissionState.permissionMessage ? (
                        <p className="muted hero-hint">{permissionState.permissionMessage}</p>
                      ) : null}
                    </>
                  ) : (
                    <PermissionAccessFallback message="暂无寝室长批量设置权限。" />
                  )
                ) : null,
            },
          ]}
        />

        <TempPasswordModal
          visible={permissionState.tempPasswordModal.visible}
          username={permissionState.tempPasswordModal.username}
          password={permissionState.tempPasswordModal.password}
          onClose={() =>
            permissionState.setTempPasswordModal((prev) => ({ ...prev, visible: false }))
          }
          onCopySuccess={() => userState.setUserMessage('密码已复制到剪贴板')}
        />
      </PageLayout>
    </div>
  );
}
