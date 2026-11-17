import type { FormEvent, ReactNode } from 'react';
import { useCallback } from 'react';
import { Modal, message } from 'antd';
import { DeleteOutlined, ReloadOutlined } from '@ant-design/icons';

import { flattenRoleMap } from './utils';
import { confirmDangerCountdown } from '../../utils/confirm';

import type {
  AccountPermissionActions,
  AccountUser,
  BatchPermissionState,
  MonitorConflictModalState,
  RolePermissionMap,
  SetState,
  TableListState,
  TempPasswordModalState,
  UserFormState,
} from './types';
import type { EntityId, RoleMatrixResponse } from '../../types/service';

interface UseAccountActionsProps {
  actions: AccountPermissionActions;
  tableData: TableListState<AccountUser>;
  selectedIds: EntityId[];
  setSelectedIds: SetState<EntityId[]>;
  selectAcrossPages: boolean;
  setSelectAcrossPages: SetState<boolean>;
  setUserMessage: SetState<string>;
  setPermissionMessage: SetState<string>;
  setReloadFlag: SetState<number>;
  setBatchLoading: SetState<boolean>;
  matrix: RoleMatrixResponse | null;
  setMatrix: SetState<RoleMatrixResponse | null>;
  rolePermissionMap: RolePermissionMap;
  selectedStudentIds: EntityId[];
  setSelectedStudentIds: SetState<EntityId[]>;
  setMonitorConflictModal: SetState<MonitorConflictModalState>;
  loadStudentList: () => Promise<void>;
  setTempPasswordModal: SetState<TempPasswordModalState>;
}

function confirmModal(options: {
  title: string;
  content: ReactNode;
  okText: string;
  cancelText?: string;
  okType?: 'danger' | 'primary' | 'default';
  icon?: ReactNode;
}): Promise<boolean> {
  return new Promise((resolve) => {
    Modal.confirm({
      title: options.title,
      content: options.content,
      okText: options.okText,
      cancelText: options.cancelText || '取消',
      okType: options.okType,
      icon: options.icon,
      maskClosable: false,
      keyboard: false,
      onOk: () => resolve(true),
      onCancel: () => resolve(false),
    });
  });
}

function readMessage(value: unknown, fallback: string): string {
  if (value && typeof value === 'object' && 'message' in value) {
    const messageValue = (value as { message?: unknown }).message;
    if (typeof messageValue === 'string' && messageValue.trim()) {
      return messageValue;
    }
  }

  return fallback;
}

function buildOverrides(batchPermissions: BatchPermissionState) {
  return Object.entries(batchPermissions)
    .filter(([, mode]) => mode !== 'inherit')
    .map(([permissionId, mode]) => ({
      permissionId,
      grant: mode === 'grant',
    }));
}

function showResetPasswordSuccess(selectedIds: EntityId[]) {
  Modal.success({
    title: '密码重置成功',
    content: (
      <div>
        <p>选中的 {selectedIds.length} 个用户密码已初始化为：</p>
        <div
          style={{
            fontSize: '20px',
            fontWeight: 'bold',
            color: '#1890ff',
            margin: '10px 0',
            padding: '8px',
            background: 'var(--info-bg)',
            borderRadius: '4px',
            textAlign: 'center',
            fontFamily: 'monospace',
          }}
        >
          系统配置的默认初始密码（DEFAULT_INITIAL_PASSWORD）
        </div>
        <p style={{ color: '#666', fontSize: '12px' }}>
          该密码符合复杂度要求（含大小写字母、数字及标点）。
        </p>
      </div>
    ),
  });
}

async function runBulkDelete({
  deleteUsers,
  selectAcrossPages,
  selectedIds,
  setBatchLoading,
  setReloadFlag,
  setSelectedIds,
  setSelectAcrossPages,
  setUserMessage,
  tableDataTotal,
}: {
  deleteUsers: AccountPermissionActions['deleteUsers'];
  selectAcrossPages: boolean;
  selectedIds: EntityId[];
  setBatchLoading: SetState<boolean>;
  setReloadFlag: SetState<number>;
  setSelectedIds: SetState<EntityId[]>;
  setSelectAcrossPages: SetState<boolean>;
  setUserMessage: SetState<string>;
  tableDataTotal: number;
}) {
  const selectionCount = selectAcrossPages ? tableDataTotal : selectedIds.length;
  if (!selectionCount || !deleteUsers) {
    return;
  }

  if (selectAcrossPages && selectedIds.length === 0) {
    setUserMessage('暂不支持跨页全选批量操作，请先勾选具体用户。');
    return;
  }

  const firstConfirmed = await confirmModal({
    title: '确认批量删除用户',
    icon: <DeleteOutlined style={{ color: '#ff4d4f' }} />,
    content: (
      <div>
        <p>您确定要删除选中的 {selectionCount} 个用户吗？</p>
        <p style={{ color: '#ff4d4f', fontSize: '12px' }}>
          警告：此操作不可撤销，且会清除该用户的所有关联权限和数据。
        </p>
      </div>
    ),
    okText: '确认删除',
    okType: 'danger',
  });
  if (!firstConfirmed) {
    return;
  }

  const finalConfirmed = await confirmDangerCountdown({
    title: '是否确认 — 批量删除用户',
    content: `将永久删除选中的 ${selectionCount} 个用户及其所有关联权限和数据，确认继续？`,
    okText: '确认删除',
  });
  if (!finalConfirmed) {
    return;
  }

  setBatchLoading(true);
  try {
    await deleteUsers({ ids: selectedIds });
    setUserMessage('批量删除成功');
    setSelectedIds([]);
    setSelectAcrossPages(false);
    setReloadFlag((prev) => prev + 1);
  } catch (error) {
    setUserMessage(error instanceof Error ? error.message : '批量删除失败');
  } finally {
    setBatchLoading(false);
  }
}

function runResetPassword(params: {
  resetUserPassword: AccountPermissionActions['resetUserPassword'];
  selectAcrossPages: boolean;
  selectedIds: EntityId[];
  setBatchLoading: SetState<boolean>;
  setSelectedIds: SetState<EntityId[]>;
  setSelectAcrossPages: SetState<boolean>;
  setUserMessage: SetState<string>;
  tableDataTotal: number;
}) {
  const {
    resetUserPassword,
    selectAcrossPages,
    selectedIds,
    setBatchLoading,
    setSelectedIds,
    setSelectAcrossPages,
    setUserMessage,
    tableDataTotal,
  } = params;
  const selectionCount = selectAcrossPages ? tableDataTotal : selectedIds.length;
  if (!selectionCount || !resetUserPassword) {
    return;
  }

  if (selectAcrossPages && selectedIds.length === 0) {
    setUserMessage('暂不支持跨页全选批量操作，请先勾选具体用户。');
    return;
  }

  Modal.confirm({
    title: '确认重置密码',
    icon: <ReloadOutlined style={{ color: '#1890ff' }} />,
    content: (
      <div>
        <p>您确定要重置选中的 {selectionCount} 个用户的密码吗？</p>
        <p style={{ color: '#666', fontSize: '12px' }}>
          重置后密码将恢复为系统预设的复杂度初始密码。
        </p>
      </div>
    ),
    okText: '确认重置',
    cancelText: '取消',
    onOk: async () => {
      setBatchLoading(true);
      try {
        await Promise.all(selectedIds.map((id) => resetUserPassword(id)));
        showResetPasswordSuccess(selectedIds);
        setSelectedIds([]);
        setSelectAcrossPages(false);
      } catch (error) {
        setUserMessage(error instanceof Error ? error.message : '重置密码失败');
      } finally {
        setBatchLoading(false);
      }
    },
  });
}

async function runGenerateTempPassword({
  generateTemporaryPassword,
  setTempPasswordModal,
  setUserMessage,
  user,
}: {
  generateTemporaryPassword: AccountPermissionActions['generateTemporaryPassword'];
  setTempPasswordModal: SetState<TempPasswordModalState>;
  setUserMessage: SetState<string>;
  user: AccountUser;
}) {
  if (!generateTemporaryPassword) {
    return;
  }

  if (!user.id || !user.username) {
    message.error('用户信息缺失，无法生成临时密码，请刷新后重试');
    return;
  }

  const confirmed = await confirmModal({
    title: '确认生成临时密码',
    content: `即将为用户「${user.fullName || user.username}」生成临时密码。临时密码生成后将立即生效，可用于登录系统。原密码保持不变，请及时将临时密码告知用户并提醒修改。`,
    okText: '确认生成',
  });
  if (!confirmed) {
    return;
  }

  try {
    const result = await generateTemporaryPassword(user.id);
    setTempPasswordModal({
      visible: true,
      password: result.temporaryPassword || '',
      username: user.username,
    });
  } catch (error) {
    setUserMessage(error instanceof Error ? error.message : '生成临时密码失败');
  }
}

function runToggleStatus({
  setReloadFlag,
  setUserMessage,
  updateUser,
  user,
}: {
  setReloadFlag: SetState<number>;
  setUserMessage: SetState<string>;
  updateUser: AccountPermissionActions['updateUser'];
  user: AccountUser;
}) {
  if (!updateUser || user.id === undefined || user.id === null) {
    return;
  }

  const userId = user.id;
  const actionLabel = user.isDisabled ? '激活' : '停用';
  Modal.confirm({
    title: `确认${actionLabel}账号`,
    content: `您确定要${actionLabel}用户 "${user.fullName}(${user.username})" 的账号吗？${user.isDisabled ? '' : '停用后该用户将无法正常登录。'}`,
    okText: '确认',
    cancelText: '取消',
    onOk: async () => {
      try {
        await updateUser(userId, { isDisabled: !user.isDisabled });
        setReloadFlag((prev) => prev + 1);
      } catch (error) {
        setUserMessage(error instanceof Error ? error.message : '更新状态失败');
      }
    },
  });
}

async function runDeleteSingleUser({
  deleteUsers,
  setBatchLoading,
  setReloadFlag,
  setUserMessage,
  user,
}: {
  deleteUsers: AccountPermissionActions['deleteUsers'];
  setBatchLoading: SetState<boolean>;
  setReloadFlag: SetState<number>;
  setUserMessage: SetState<string>;
  user: AccountUser;
}) {
  if (!deleteUsers) {
    return;
  }

  if (!user.fullName || !user.username || !user.id) {
    message.error('用户信息缺失，无法删除，请刷新后重试');
    return;
  }

  const finalConfirmed = await confirmDangerCountdown({
    title: '是否确认 — 删除用户',
    content: `即将永久删除用户「${user.fullName}」(${user.username})及其所有关联数据，确认继续？`,
    okText: '确认删除',
  });
  if (!finalConfirmed) {
    return;
  }

  setBatchLoading(true);
  try {
    await deleteUsers({ ids: [user.id] });
    setUserMessage('删除成功');
    setReloadFlag((prev) => prev + 1);
  } catch (error) {
    setUserMessage(error instanceof Error ? error.message : '删除失败');
  } finally {
    setBatchLoading(false);
  }
}

async function runToggleRolePermission({
  matrix,
  permissionId,
  roleId,
  rolePermissionMap,
  setMatrix,
  setPermissionMessage,
  updateRolePermissions,
}: {
  matrix: RoleMatrixResponse | null;
  permissionId: EntityId;
  roleId: EntityId;
  rolePermissionMap: RolePermissionMap;
  setMatrix: SetState<RoleMatrixResponse | null>;
  setPermissionMessage: SetState<string>;
  updateRolePermissions: AccountPermissionActions['updateRolePermissions'];
}) {
  if (!matrix || !updateRolePermissions) {
    return;
  }

  const nextMap = new Map(rolePermissionMap);
  const rolePermissions = new Set(nextMap.get(roleId) || []);
  const willEnable = !rolePermissions.has(permissionId);
  const roleName = matrix.roles.find((role) => role.id === roleId)?.name || '角色';
  const permissionName =
    matrix.permissions.find((permission) => permission.id === permissionId)?.name ||
    '权限';

  const confirmed = await confirmModal({
    title: '确认权限变更',
    content: willEnable
      ? `即将为「${roleName}」授予「${permissionName}」权限，确认继续？`
      : `即将取消「${roleName}」的「${permissionName}」权限，确认继续？`,
    okText: willEnable ? '确认授予' : '确认取消',
  });
  if (!confirmed) {
    return;
  }

  if (willEnable) {
    rolePermissions.add(permissionId);
  } else {
    rolePermissions.delete(permissionId);
  }
  nextMap.set(roleId, rolePermissions);

  setMatrix((prev) =>
    prev
      ? {
          ...prev,
          rolePermissions: flattenRoleMap(nextMap),
        }
      : prev,
  );

  try {
    await updateRolePermissions(roleId, Array.from(rolePermissions));
  } catch (error) {
    setPermissionMessage(error instanceof Error ? error.message : '更新角色权限失败');
  }
}

async function runSaveOverrides({
  selectedUserId,
  setPermissionMessage,
  updateUserOverrides,
  userOverrides,
}: {
  selectedUserId: EntityId | '';
  setPermissionMessage: SetState<string>;
  updateUserOverrides: AccountPermissionActions['updateUserOverrides'];
  userOverrides: BatchPermissionState;
}) {
  if (!selectedUserId || !updateUserOverrides) {
    return;
  }

  const overrides = Object.entries(userOverrides).map(([permissionId, mode]) => ({
    permissionId,
    grant: mode === 'grant',
  }));

  try {
    await updateUserOverrides(selectedUserId, overrides);
    setPermissionMessage('账号权限已更新');
  } catch (error) {
    setPermissionMessage(error instanceof Error ? error.message : '更新失败');
  }
}

async function runBatchSaveOverrides({
  batchPermissions,
  batchUpdateUserOverrides,
  batchUserIds,
  setPermissionMessage,
}: {
  batchPermissions: BatchPermissionState;
  batchUpdateUserOverrides: AccountPermissionActions['batchUpdateUserOverrides'];
  batchUserIds: EntityId[];
  setPermissionMessage: SetState<string>;
}) {
  if (!batchUpdateUserOverrides) {
    return false;
  }

  if (!batchUserIds.length) {
    message.warning('请选择至少一个用户后再执行批量更新');
    return false;
  }

  const confirmed = await confirmModal({
    title: '确认批量更新权限',
    content: `即将为 ${batchUserIds.length} 个用户批量更新权限覆盖设置。该操作将直接覆盖现有权限配置，确认继续？`,
    okText: '确认更新',
    okType: 'danger',
  });
  if (!confirmed) {
    return false;
  }

  try {
    const result = await batchUpdateUserOverrides(
      batchUserIds,
      buildOverrides(batchPermissions),
    );
    setPermissionMessage(readMessage(result, `已为 ${batchUserIds.length} 个用户更新权限`));
    return true;
  } catch (error) {
    setPermissionMessage(error instanceof Error ? error.message : '批量授权失败');
    return false;
  }
}

async function runBatchSetMonitorCheck({
  batchSetMonitor,
  loadStudentList,
  selectedStudentIds,
  setMonitorConflictModal,
  setPermissionMessage,
  setSelectedStudentIds,
}: {
  batchSetMonitor: AccountPermissionActions['batchSetMonitor'];
  loadStudentList: () => Promise<void>;
  selectedStudentIds: EntityId[];
  setMonitorConflictModal: SetState<MonitorConflictModalState>;
  setPermissionMessage: SetState<string>;
  setSelectedStudentIds: SetState<EntityId[]>;
}) {
  if (!selectedStudentIds.length || !batchSetMonitor) {
    return;
  }

  const confirmed = await confirmModal({
    title: '确认批量设置寝室长',
    content: `即将为 ${selectedStudentIds.length} 名学生批量设置寝室长，确认继续？`,
    okText: '确认设置',
  });
  if (!confirmed) {
    return;
  }

  try {
    const result = await batchSetMonitor(selectedStudentIds, undefined);
    if (result.hasConflicts) {
      setMonitorConflictModal({
        visible: true,
        conflicts: result.conflicts || [],
        nonConflicts: result.nonConflicts || [],
      });
      return;
    }

    const executeResult = await batchSetMonitor(selectedStudentIds, true);
    setPermissionMessage(readMessage(executeResult, '寝室长设置成功'));
    setSelectedStudentIds([]);
    await loadStudentList();
  } catch (error) {
    setPermissionMessage(error instanceof Error ? error.message : '检测冲突失败');
  }
}

async function runBatchSetMonitorExecute({
  batchSetMonitor,
  loadStudentList,
  replaceExisting,
  selectedStudentIds,
  setMonitorConflictModal,
  setPermissionMessage,
  setSelectedStudentIds,
}: {
  batchSetMonitor: AccountPermissionActions['batchSetMonitor'];
  loadStudentList: () => Promise<void>;
  replaceExisting: boolean;
  selectedStudentIds: EntityId[];
  setMonitorConflictModal: SetState<MonitorConflictModalState>;
  setPermissionMessage: SetState<string>;
  setSelectedStudentIds: SetState<EntityId[]>;
}) {
  if (!selectedStudentIds.length || !batchSetMonitor) {
    return;
  }

  try {
    const result = await batchSetMonitor(selectedStudentIds, replaceExisting);
    setPermissionMessage(readMessage(result, '寝室长设置成功'));
    setSelectedStudentIds([]);
    setMonitorConflictModal({ visible: false, conflicts: [], nonConflicts: [] });
    await loadStudentList();
  } catch (error) {
    setPermissionMessage(error instanceof Error ? error.message : '设置寝室长失败');
  }
}

async function runContinueNonConflicts({
  batchSetMonitor,
  loadStudentList,
  monitorConflictModal,
  setMonitorConflictModal,
  setPermissionMessage,
  setSelectedStudentIds,
}: {
  batchSetMonitor: AccountPermissionActions['batchSetMonitor'];
  loadStudentList: () => Promise<void>;
  monitorConflictModal: MonitorConflictModalState;
  setMonitorConflictModal: SetState<MonitorConflictModalState>;
  setPermissionMessage: SetState<string>;
  setSelectedStudentIds: SetState<EntityId[]>;
}) {
  if (!monitorConflictModal.nonConflicts.length || !batchSetMonitor) {
    setMonitorConflictModal({ visible: false, conflicts: [], nonConflicts: [] });
    return;
  }

  const nonConflictIds = monitorConflictModal.nonConflicts
    .map((entry) => entry.studentId)
    .filter((id): id is EntityId => id !== undefined && id !== null);

  try {
    const result = await batchSetMonitor(nonConflictIds, false);
    setPermissionMessage(readMessage(result, '寝室长设置成功'));
    setSelectedStudentIds([]);
    setMonitorConflictModal({ visible: false, conflicts: [], nonConflicts: [] });
    await loadStudentList();
  } catch (error) {
    setPermissionMessage(error instanceof Error ? error.message : '设置寝室长失败');
  }
}

async function runFormSubmit({
  createUser,
  editingId,
  event,
  form,
  onSuccess,
  setReloadFlag,
  setUserMessage,
  updateUser,
}: {
  createUser: AccountPermissionActions['createUser'];
  editingId: EntityId | null;
  event: FormEvent<HTMLFormElement>;
  form: UserFormState;
  onSuccess?: () => void;
  setReloadFlag: SetState<number>;
  setUserMessage: SetState<string>;
  updateUser: AccountPermissionActions['updateUser'];
}) {
  event.preventDefault();

  if (!form.role) {
    message.warning('请选择主角色后再提交');
    return;
  }
  if (!form.roles.length) {
    message.warning('请至少分配一个角色后再提交');
    return;
  }

  const isEdit = Boolean(editingId);
  const confirmed = await confirmModal({
    title: isEdit ? '确认更新账号' : '确认新增账号',
    content: isEdit
      ? `即将更新账号「${form.fullName || form.username || '未命名'}」的信息，确认继续？`
      : `即将新增账号「${form.fullName || form.username || '未命名'}」，确认继续？`,
    okText: isEdit ? '确认更新' : '确认新增',
  });
  if (!confirmed) {
    return;
  }

  try {
    if (editingId && updateUser) {
      await updateUser(editingId, form);
      setUserMessage('更新用户信息成功');
    } else if (!editingId && createUser) {
      await createUser(form);
      setUserMessage('新增用户成功');
    }
    onSuccess?.();
    setReloadFlag((prev) => prev + 1);
  } catch (error) {
    setUserMessage(error instanceof Error ? error.message : '提交失败');
  }
}

export function useAccountActions({
  actions,
  tableData,
  selectedIds,
  setSelectedIds,
  selectAcrossPages,
  setSelectAcrossPages,
  setUserMessage,
  setPermissionMessage,
  setReloadFlag,
  setBatchLoading,
  matrix,
  setMatrix,
  rolePermissionMap,
  selectedStudentIds,
  setSelectedStudentIds,
  setMonitorConflictModal,
  loadStudentList,
  setTempPasswordModal,
}: UseAccountActionsProps) {
  const {
    deleteUsers,
    resetUserPassword,
    generateTemporaryPassword,
    updateRolePermissions,
    updateUserOverrides,
    batchUpdateUserOverrides,
    batchSetMonitor,
    createUser,
    updateUser,
  } = actions;

  const handleBulkDelete = useCallback(
    async (): Promise<void> =>
      runBulkDelete({
        deleteUsers,
        selectAcrossPages,
        selectedIds,
        setBatchLoading,
        setReloadFlag,
        setSelectedIds,
        setSelectAcrossPages,
        setUserMessage,
        tableDataTotal: tableData.total,
      }),
    [
      deleteUsers,
      selectAcrossPages,
      selectedIds,
      setBatchLoading,
      setReloadFlag,
      setSelectedIds,
      setSelectAcrossPages,
      setUserMessage,
      tableData.total,
    ],
  );

  const handleResetPassword = useCallback(
    async (): Promise<void> =>
      runResetPassword({
        resetUserPassword,
        selectAcrossPages,
        selectedIds,
        setBatchLoading,
        setSelectedIds,
        setSelectAcrossPages,
        setUserMessage,
        tableDataTotal: tableData.total,
      }),
    [
      resetUserPassword,
      selectAcrossPages,
      selectedIds,
      setBatchLoading,
      setSelectedIds,
      setSelectAcrossPages,
      setUserMessage,
      tableData.total,
    ],
  );

  const handleGenerateTempPassword = useCallback(
    async (user: AccountUser): Promise<void> =>
      runGenerateTempPassword({
        generateTemporaryPassword,
        setTempPasswordModal,
        setUserMessage,
        user,
      }),
    [generateTemporaryPassword, setTempPasswordModal, setUserMessage],
  );

  const handleToggleStatus = useCallback(
    (user: AccountUser): void =>
      runToggleStatus({
        setReloadFlag,
        setUserMessage,
        updateUser,
        user,
      }),
    [setReloadFlag, setUserMessage, updateUser],
  );

  const handleDeleteSingleUser = useCallback(
    async (user: AccountUser): Promise<void> =>
      runDeleteSingleUser({
        deleteUsers,
        setBatchLoading,
        setReloadFlag,
        setUserMessage,
        user,
      }),
    [deleteUsers, setBatchLoading, setReloadFlag, setUserMessage],
  );

  const handleToggleRolePermission = useCallback(
    async (roleId: EntityId, permissionId: EntityId): Promise<void> =>
      runToggleRolePermission({
        matrix,
        permissionId,
        roleId,
        rolePermissionMap,
        setMatrix,
        setPermissionMessage,
        updateRolePermissions,
      }),
    [matrix, rolePermissionMap, setMatrix, setPermissionMessage, updateRolePermissions],
  );

  const handleSaveOverrides = useCallback(
    async (
      selectedUserId: EntityId | '',
      userOverrides: BatchPermissionState,
    ): Promise<void> =>
      runSaveOverrides({
        selectedUserId,
        setPermissionMessage,
        updateUserOverrides,
        userOverrides,
      }),
    [setPermissionMessage, updateUserOverrides],
  );

  const handleBatchSaveOverrides = useCallback(
    async (
      batchUserIds: EntityId[],
      batchPermissions: BatchPermissionState,
    ): Promise<boolean> =>
      runBatchSaveOverrides({
        batchPermissions,
        batchUpdateUserOverrides,
        batchUserIds,
        setPermissionMessage,
      }),
    [batchUpdateUserOverrides, setPermissionMessage],
  );

  const handleBatchSetMonitorCheck = useCallback(
    async (): Promise<void> =>
      runBatchSetMonitorCheck({
        batchSetMonitor,
        loadStudentList,
        selectedStudentIds,
        setMonitorConflictModal,
        setPermissionMessage,
        setSelectedStudentIds,
      }),
    [
      batchSetMonitor,
      loadStudentList,
      selectedStudentIds,
      setMonitorConflictModal,
      setPermissionMessage,
      setSelectedStudentIds,
    ],
  );

  const handleBatchSetMonitorExecute = useCallback(
    async (replaceExisting: boolean): Promise<void> =>
      runBatchSetMonitorExecute({
        batchSetMonitor,
        loadStudentList,
        replaceExisting,
        selectedStudentIds,
        setMonitorConflictModal,
        setPermissionMessage,
        setSelectedStudentIds,
      }),
    [
      batchSetMonitor,
      loadStudentList,
      selectedStudentIds,
      setMonitorConflictModal,
      setPermissionMessage,
      setSelectedStudentIds,
    ],
  );

  const handleContinueNonConflicts = useCallback(
    async (monitorConflictModal: MonitorConflictModalState): Promise<void> =>
      runContinueNonConflicts({
        batchSetMonitor,
        loadStudentList,
        monitorConflictModal,
        setMonitorConflictModal,
        setPermissionMessage,
        setSelectedStudentIds,
      }),
    [
      batchSetMonitor,
      loadStudentList,
      setMonitorConflictModal,
      setPermissionMessage,
      setSelectedStudentIds,
    ],
  );

  const handleFormSubmit = useCallback(
    async (
      event: FormEvent<HTMLFormElement>,
      editingId: EntityId | null,
      form: UserFormState,
      onSuccess?: () => void,
    ): Promise<void> =>
      runFormSubmit({
        createUser,
        editingId,
        event,
        form,
        onSuccess,
        setReloadFlag,
        setUserMessage,
        updateUser,
      }),
    [createUser, setReloadFlag, setUserMessage, updateUser],
  );

  return {
    handleBulkDelete,
    handleResetPassword,
    handleGenerateTempPassword,
    handleToggleStatus,
    handleDeleteSingleUser,
    handleFormSubmit,
    handleToggleRolePermission,
    handleSaveOverrides,
    handleBatchSaveOverrides,
    handleBatchSetMonitorCheck,
    handleBatchSetMonitorExecute,
    handleContinueNonConflicts,
  };
}
