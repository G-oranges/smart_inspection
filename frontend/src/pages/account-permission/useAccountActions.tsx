import type { FormEvent, ReactNode } from 'react';
import { useCallback } from 'react';
import { Modal, message } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';

import { flattenRoleMap } from './utils';
import { buildOverrides } from './overrideUtils';
import { getLinkedProfileLabel } from './accountPermissionSchema';
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

interface GeneratedPasswordItem {
  label: string;
  password: string;
}

function readGeneratedPassword(result: unknown, field: 'newPassword' | 'initialPassword'): string {
  if (result && typeof result === 'object' && field in result) {
    const value = (result as Record<string, unknown>)[field];
    return typeof value === 'string' ? value : '';
  }
  return '';
}

function userLabel(user: AccountUser | undefined, fallback: EntityId): string {
  if (!user) {
    return String(fallback);
  }
  return user.fullName ? `${user.fullName}（${user.username}）` : String(user.username || fallback);
}

/** 展示后端生成的一次性密码。弹窗关闭后无法再次查看，需要管理员当场转交。 */
function showGeneratedPasswords(title: string, items: GeneratedPasswordItem[], failures: string[] = []) {
  Modal.success({
    title,
    width: 520,
    content: (
      <div>
        {items.length ? (
          <>
            <p>以下密码只显示这一次，请立即转交给对应用户。用户登录后会被要求修改密码。</p>
            <table style={{ width: '100%', margin: '8px 0', fontSize: '13px' }}>
              <tbody>
                {items.map((item) => (
                  <tr key={item.label}>
                    <td style={{ padding: '4px 8px 4px 0' }}>{item.label}</td>
                    <td style={{ padding: '4px 0', fontFamily: 'monospace', fontWeight: 600, userSelect: 'all' }}>
                      {item.password}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : null}
        {failures.length ? (
          <p style={{ color: 'var(--co-error)', fontSize: '12px' }}>
            以下用户重置失败：{failures.join('；')}
          </p>
        ) : null}
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
    message.warning('批量操作仅支持当前页勾选的用户');
    return;
  }

  const finalConfirmed = await confirmDangerCountdown({
    title: `确定删除选中的 ${selectionCount} 个用户吗？`,
    content: '删除后无法恢复，将清除所选用户的关联权限；已关联的学生或教职工档案将保留并解除绑定。',
    okText: '删除用户',
  });
  if (!finalConfirmed) {
    return;
  }

  setBatchLoading(true);
  try {
    await deleteUsers({ ids: selectedIds });
    setUserMessage('');
    message.success('已删除所选用户');
    setSelectedIds([]);
    setSelectAcrossPages(false);
    setReloadFlag((prev) => prev + 1);
  } catch (error) {
    message.error(error instanceof Error ? error.message : '批量删除失败');
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
  users: AccountUser[];
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
    users,
  } = params;
  const selectionCount = selectAcrossPages ? tableDataTotal : selectedIds.length;
  if (!selectionCount || !resetUserPassword) {
    return;
  }

  if (selectAcrossPages && selectedIds.length === 0) {
    message.warning('批量操作仅支持当前页勾选的用户');
    return;
  }

  Modal.confirm({
    title: '确定重置密码吗？',
    icon: <ReloadOutlined style={{ color: 'var(--co-primary)' }} />,
    content: (
      <div>
        <p>确定重置选中的 {selectionCount} 个用户的密码吗？</p>
        <p style={{ color: 'var(--co-text-secondary)', fontSize: '12px' }}>
          系统会为每个用户生成新的随机密码，旧密码和已登录会话将立即失效，用户下次登录时需修改密码。
        </p>
      </div>
    ),
    okText: '重置密码',
    cancelText: '取消',
    onOk: async () => {
      setBatchLoading(true);
      try {
        const outcomes = await Promise.allSettled(selectedIds.map((id) => resetUserPassword(id)));
        const generated: GeneratedPasswordItem[] = [];
        const failures: string[] = [];
        outcomes.forEach((outcome, index) => {
          const id = selectedIds[index];
          const label = userLabel(users.find((user) => user.id === id), id);
          if (outcome.status === 'fulfilled') {
            generated.push({ label, password: readGeneratedPassword(outcome.value, 'newPassword') });
          } else {
            const reason = outcome.reason instanceof Error ? outcome.reason.message : '重置失败';
            failures.push(`${label}：${reason}`);
          }
        });
        setUserMessage('');
        showGeneratedPasswords(failures.length ? '密码重置部分完成' : '密码重置成功', generated, failures);
        setSelectedIds([]);
        setSelectAcrossPages(false);
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
    title: '确定生成临时密码吗？',
    content: `即将为用户「${user.fullName || user.username}」生成 12 小时内有效的一次性临时密码。用户用它登录后，临时密码会替换原密码，并被要求立即设置新密码。`,
    okText: '生成临时密码',
  });
  if (!confirmed) {
    return;
  }

  try {
    const result = await generateTemporaryPassword(user.id);
    setUserMessage('');
    setTempPasswordModal({
      visible: true,
      password: result.temporaryPassword || '',
      username: user.username,
    });
  } catch (error) {
    message.error(error instanceof Error ? error.message : '生成临时密码失败');
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
  const actionLabel = user.isDisabled ? '启用' : '停用';
  Modal.confirm({
    title: `确定${actionLabel}用户吗？`,
    content: `确定${actionLabel}用户「${user.fullName || user.username}（${user.username}）」吗？${user.isDisabled ? '' : '停用后该用户将无法登录。'}`,
    okText: actionLabel,
    cancelText: '取消',
    onOk: async () => {
      try {
        await updateUser(userId, { isDisabled: !user.isDisabled });
        setUserMessage('');
        message.success(`用户已${actionLabel}`);
        setReloadFlag((prev) => prev + 1);
      } catch (error) {
        message.error(error instanceof Error ? error.message : '更新状态失败');
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

  const profileLabel = getLinkedProfileLabel(user.profileType);
  const finalConfirmed = await confirmDangerCountdown({
    title: `确定删除用户「${user.fullName}（${user.username}）」吗？`,
    content: profileLabel
      ? `删除后无法恢复，将清除该用户的关联权限，并解除与${profileLabel}的绑定（档案本身保留）。`
      : '删除后无法恢复，将同时清除该用户的关联权限和数据。',
    okText: '删除用户',
  });
  if (!finalConfirmed) {
    return;
  }

  setBatchLoading(true);
  try {
    await deleteUsers({ ids: [user.id] });
    setUserMessage('');
    message.success('用户已删除');
    setReloadFlag((prev) => prev + 1);
  } catch (error) {
    message.error(error instanceof Error ? error.message : '删除失败');
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
    title: '确定变更角色权限吗？',
    content: willEnable
      ? `确定为「${roleName}」授予「${permissionName}」权限吗？`
      : `确定取消「${roleName}」的「${permissionName}」权限吗？`,
    okText: willEnable ? '授予' : '取消权限',
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
    setPermissionMessage('');
    message.success('角色权限已更新');
  } catch (error) {
    message.error(error instanceof Error ? error.message : '更新角色权限失败');
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
    setPermissionMessage('');
    message.success('用户权限已更新');
  } catch (error) {
    message.error(error instanceof Error ? error.message : '更新失败');
  }
}

async function runBatchSaveOverrides({
  batchPermissions,
  baseline,
  batchUpdateUserOverrides,
  batchUserIds,
  setPermissionMessage,
}: {
  batchPermissions: BatchPermissionState;
  baseline?: BatchPermissionState;
  batchUpdateUserOverrides: AccountPermissionActions['batchUpdateUserOverrides'];
  batchUserIds: EntityId[];
  setPermissionMessage: SetState<string>;
}) {
  if (!batchUpdateUserOverrides) {
    return false;
  }

  if (!batchUserIds.length) {
    message.warning('请至少选择一个用户后再执行批量更新');
    return false;
  }

  const overrides = buildOverrides(batchPermissions, baseline);
  if (!overrides.length) {
    message.info('没有需要保存的变更');
    return false;
  }

  const confirmed = await confirmModal({
    title: '确定更新例外授权吗？',
    content: `确定为 ${batchUserIds.length} 个用户修改 ${overrides.length} 个功能点的授权吗？其他功能点的已有设置保持不变。`,
    okText: '保存授权',
  });
  if (!confirmed) {
    return false;
  }

  try {
    const result = await batchUpdateUserOverrides(batchUserIds, overrides);
    setPermissionMessage('');
    message.success(readMessage(result, `已为 ${batchUserIds.length} 个用户更新权限`));
    return true;
  } catch (error) {
    message.error(error instanceof Error ? error.message : '批量授权失败');
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
    title: '确定批量设置寝室长吗？',
    content: `确定将选中的 ${selectedStudentIds.length} 名学生设为寝室长吗？`,
    okText: '设为寝室长',
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
    setPermissionMessage('');
    message.success(readMessage(executeResult, '寝室长设置成功'));
    setSelectedStudentIds([]);
    await loadStudentList();
  } catch (error) {
    message.error(error instanceof Error ? error.message : '检测冲突失败');
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
    setPermissionMessage('');
    message.success(readMessage(result, '寝室长设置成功'));
    setSelectedStudentIds([]);
    setMonitorConflictModal({ visible: false, conflicts: [], nonConflicts: [] });
    await loadStudentList();
  } catch (error) {
    message.error(error instanceof Error ? error.message : '设置寝室长失败');
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
    setPermissionMessage('');
    message.success(readMessage(result, '寝室长设置成功'));
    setSelectedStudentIds([]);
    setMonitorConflictModal({ visible: false, conflicts: [], nonConflicts: [] });
    await loadStudentList();
  } catch (error) {
    message.error(error instanceof Error ? error.message : '设置寝室长失败');
  }
}

async function runFormSubmit({
  createUser,
  editingId,
  editingUser,
  event,
  form,
  onSuccess,
  setReloadFlag,
  setUserMessage,
  updateUser,
}: {
  createUser: AccountPermissionActions['createUser'];
  editingId: EntityId | null;
  editingUser?: AccountUser | null;
  event: FormEvent<HTMLFormElement>;
  form: UserFormState;
  onSuccess?: () => void;
  setReloadFlag: SetState<number>;
  setUserMessage: SetState<string>;
  updateUser: AccountPermissionActions['updateUser'];
}) {
  event.preventDefault();

  if (!form.role) {
    message.warning('请选择主角色');
    return;
  }
  if (!form.roles.length) {
    message.warning('请至少选择一个角色');
    return;
  }

  const isEdit = Boolean(editingId);
  const profileLabel = getLinkedProfileLabel(editingUser?.profileType);
  const confirmed = await confirmModal({
    title: isEdit ? '确定更新用户吗？' : '确定新增用户吗？',
    content: isEdit
      ? profileLabel
        ? `确定更新用户「${form.fullName || form.username || '未命名'}」的信息吗？姓名、学院、联系电话将同步更新至关联的${profileLabel}。`
        : `确定更新用户「${form.fullName || form.username || '未命名'}」的信息吗？`
      : `确定新增用户「${form.fullName || form.username || '未命名'}」吗？`,
    okText: isEdit ? '保存' : '新增用户',
  });
  if (!confirmed) {
    return;
  }

  try {
    if (editingId && updateUser) {
      await updateUser(editingId, form);
      setUserMessage('');
      message.success('用户信息已更新');
    } else if (!editingId && createUser) {
      const created = await createUser(form);
      setUserMessage('');
      message.success('用户已新增');
      const initialPassword = readGeneratedPassword(created, 'initialPassword');
      if (initialPassword) {
        showGeneratedPasswords('用户已创建', [
          { label: form.fullName ? `${form.fullName}（${form.username}）` : form.username, password: initialPassword },
        ]);
      }
    }
    onSuccess?.();
    setReloadFlag((prev) => prev + 1);
  } catch (error) {
    message.error(error instanceof Error ? error.message : '提交失败');
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
        users: tableData.items,
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
      tableData.items,
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
      baseline?: BatchPermissionState,
    ): Promise<boolean> =>
      runBatchSaveOverrides({
        batchPermissions,
        baseline,
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
        editingUser: editingId
          ? tableData.items.find((item) => item.id === editingId) ?? null
          : null,
        event,
        form,
        onSuccess,
        setReloadFlag,
        setUserMessage,
        updateUser,
      }),
    [createUser, setReloadFlag, setUserMessage, tableData.items, updateUser],
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
