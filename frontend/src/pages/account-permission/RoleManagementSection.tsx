import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Empty,
  Input,
  Modal,
  Space,
  Spin,
  Switch,
  Tag,
  message,
} from 'antd';
import PanelSelect from '../../components/common/PanelSelect';
import {
  DownOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
} from '@ant-design/icons';

import PermissionDeniedState from '../../components/common/PermissionDeniedState';
import DataScopeEditor from './DataScopeEditor';
import { useScopeOptions } from './useScopeOptions';
import { createDefaultScope, normalizeScope, permissionModuleLabel } from './scopeUtils';
import type { RoleLike } from '../../types/app';
import type {
  EntityId,
  PermissionDefinition,
  RoleDataScope,
  RoleMatrixResponse,
  RoleType,
} from '../../types/service';
import type { AccountPermissionActions, AccountPermissionData } from './types';
import { MODAL_WIDTH } from "../../components/common/modalSizes";

const ROLE_CODE_PATTERN = /^[A-Z][A-Z0-9_]*$/;

type RoleFormState = {
  name: string;
  code: string;
  typeCode: string;
  description: string;
  status: string;
  sort: number;
};

type RoleTypeFormState = {
  name: string;
  code: string;
  description: string;
  status: string;
  sort: number;
};

function makeRoleForm(role?: RoleLike | null): RoleFormState {
  return {
    name: String(role?.name || ''),
    code: String(role?.code || ''),
    typeCode: String(role?.typeCode || 'CUSTOM'),
    description: String(role?.description || ''),
    status: String(role?.status || 'ACTIVE'),
    sort: Number(role?.sort || 100),
  };
}

function makeRoleTypeForm(roleType?: RoleType | null): RoleTypeFormState {
  return {
    name: String(roleType?.name || ''),
    code: String(roleType?.code || ''),
    description: String(roleType?.description || ''),
    status: String(roleType?.status || 'ACTIVE'),
    sort: Number(roleType?.sort || 100),
  };
}

function normalizeRoleCodeInput(code: string) {
  return code.toUpperCase();
}

function normalizeRoleOption(role: RoleLike, index: number): RoleLike {
  const systemOrder = ['ADMIN', 'COUNSELOR', 'LEADER', 'STUDENT'];
  const code = String(role.code || '');
  const systemIndex = systemOrder.indexOf(code);
  return {
    ...role,
    name: role.name || code || `角色 ${index + 1}`,
    typeCode: role.typeCode || (systemIndex >= 0 ? 'SYSTEM' : 'CUSTOM'),
    isSystem: Boolean(role.isSystem ?? systemIndex >= 0),
    sort: Number(role.sort || (systemIndex >= 0 ? (systemIndex + 1) * 10 : 100)),
    status: String(role.status || 'ACTIVE'),
  };
}

function sortRoles(roles: RoleLike[]): RoleLike[] {
  const systemOrder = ['ADMIN', 'COUNSELOR', 'LEADER', 'STUDENT'];
  return [...roles]
    .map(normalizeRoleOption)
    .sort((left, right) => {
      const leftIndex = systemOrder.indexOf(String(left.code || ''));
      const rightIndex = systemOrder.indexOf(String(right.code || ''));
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

function normalizeRoleTypeOption(roleType: RoleType, index: number): RoleType {
  const systemDefaults: Record<string, { name: string; sort: number }> = {
    SYSTEM: { name: '系统角色', sort: 10 },
    BUSINESS: { name: '业务角色', sort: 20 },
    CUSTOM: { name: '自定义角色', sort: 30 },
  };
  const code = String(roleType.code || '').toUpperCase();
  const meta = systemDefaults[code];
  return {
    ...roleType,
    code,
    name: roleType.name || meta?.name || `角色类型 ${index + 1}`,
    isSystem: Boolean(roleType.isSystem ?? Boolean(meta)),
    sort: Number(roleType.sort || meta?.sort || 100),
    status: String(roleType.status || 'ACTIVE'),
  };
}

function sortRoleTypes(roleTypes: RoleType[]): RoleType[] {
  return [...roleTypes]
    .map(normalizeRoleTypeOption)
    .sort((left, right) => {
      const systemDiff = Number(Boolean(right.isSystem)) - Number(Boolean(left.isSystem));
      if (systemDiff !== 0) {
        return systemDiff;
      }
      const sortDiff = Number(left.sort || 100) - Number(right.sort || 100);
      if (sortDiff !== 0) {
        return sortDiff;
      }
      return String(left.name || '').localeCompare(String(right.name || ''), 'zh-CN');
    });
}

function groupPermissions(permissions: PermissionDefinition[] = []) {
  const groups = new Map<string, PermissionDefinition[]>();
  permissions.forEach((permission) => {
    const key = String(permission.module || 'OTHER');
    const bucket = groups.get(key) || [];
    bucket.push(permission);
    groups.set(key, bucket);
  });
  return Array.from(groups.entries())
    .map(([module, items]) => ({
      module,
      label: permissionModuleLabel(module),
      items: [...items].sort((left, right) =>
        String(left.name || left.code || '').localeCompare(String(right.name || right.code || ''), 'zh-CN'),
      ),
    }))
    .sort((left, right) => left.label.localeCompare(right.label, 'zh-CN'));
}

interface RoleManagementSectionProps {
  canManagePermissions: boolean;
  matrixLoading: boolean;
  matrix: RoleMatrixResponse | null;
  roleOptions: RoleLike[];
  rolesLoading: boolean;
  permissionMessage: string;
  setPermissionMessage: (message: string) => void;
  accountActions: AccountPermissionActions;
  accountData: AccountPermissionData;
  refreshRoles: () => Promise<void>;
  refreshMatrix: () => Promise<void>;
}

export default function RoleManagementSection({
  canManagePermissions,
  matrixLoading,
  matrix,
  roleOptions,
  rolesLoading,
  permissionMessage,
  setPermissionMessage,
  accountActions,
  refreshRoles,
  refreshMatrix,
}: RoleManagementSectionProps) {
  const roles = useMemo(() => sortRoles(roleOptions), [roleOptions]);
  const [selectedRoleId, setSelectedRoleId] = useState<EntityId | null>(null);
  const [roleFormOpen, setRoleFormOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleLike | null>(null);
  const [roleForm, setRoleForm] = useState<RoleFormState>(makeRoleForm());
  const [saving, setSaving] = useState(false);
  const [roleTypesLoading, setRoleTypesLoading] = useState(false);
  const [roleTypeModalOpen, setRoleTypeModalOpen] = useState(false);
  const [roleTypeFormOpen, setRoleTypeFormOpen] = useState(false);
  const [editingRoleType, setEditingRoleType] = useState<RoleType | null>(null);
  const [roleTypeForm, setRoleTypeForm] = useState<RoleTypeFormState>(makeRoleTypeForm());
  const [roleTypes, setRoleTypes] = useState<RoleType[]>([]);
  const [dataScopeLoading, setDataScopeLoading] = useState(false);
  const [originalPermissionIds, setOriginalPermissionIds] = useState<EntityId[]>([]);
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<EntityId[]>([]);
  const [originalScope, setOriginalScope] = useState<RoleDataScope>(createDefaultScope());
  const [draftScope, setDraftScope] = useState<RoleDataScope>(createDefaultScope());
  const [pendingRoleCodeSelection, setPendingRoleCodeSelection] = useState<string | null>(null);
  const [permissionsExpanded, setPermissionsExpanded] = useState(true);
  const [scopeExpanded, setScopeExpanded] = useState(true);

  const { options: scopeOptions, error: scopeOptionsError } = useScopeOptions(canManagePermissions);
  const permissionGroups = useMemo(
    () => groupPermissions(matrix?.permissions || []),
    [matrix?.permissions],
  );
  const sortedRoleTypes = useMemo(() => sortRoleTypes(roleTypes), [roleTypes]);
  const roleTypeMap = useMemo(
    () =>
      new Map(
        sortedRoleTypes.map((roleType) => [String(roleType.code || '').toUpperCase(), roleType]),
      ),
    [sortedRoleTypes],
  );
  const roleTypeOptions = useMemo(() => {
    const options = sortedRoleTypes
      .filter((roleType) => roleType.status !== 'INACTIVE')
      .map((roleType) => ({
        value: String(roleType.code || ''),
        label: roleType.name || roleType.code,
      }));
    const selectedTypeCode = String(roleForm.typeCode || '').toUpperCase();
    const selectedRoleType = roleTypeMap.get(selectedTypeCode);
    if (selectedRoleType && selectedRoleType.status === 'INACTIVE') {
      options.push({
        value: selectedTypeCode,
        label: `${selectedRoleType.name || selectedTypeCode}（历史引用，已停用）`,
      });
    }
    return options;
  }, [roleForm.typeCode, roleTypeMap, sortedRoleTypes]);

  useEffect(() => {
    if (!roles.length) {
      setSelectedRoleId(null);
      return;
    }
    setSelectedRoleId((prev) => {
      if (prev && roles.some((role) => role.id === prev)) {
        return prev;
      }
      return roles[0].id ?? null;
    });
  }, [roles]);

  useEffect(() => {
    if (!pendingRoleCodeSelection) {
      return;
    }
    const matchedRole = roles.find((role) => String(role.code || '') === pendingRoleCodeSelection);
    if (matchedRole?.id !== undefined && matchedRole?.id !== null) {
      setSelectedRoleId(matchedRole.id);
      setPendingRoleCodeSelection(null);
    }
  }, [pendingRoleCodeSelection, roles]);

  useEffect(() => {
    if (!selectedRoleId || !matrix) {
      setOriginalPermissionIds([]);
      setSelectedPermissionIds([]);
      return;
    }
    const nextPermissionIds = matrix.rolePermissions
      .filter((item) => item.roleId === selectedRoleId && item.permissionId !== undefined && item.permissionId !== null)
      .map((item) => item.permissionId as EntityId);
    setOriginalPermissionIds(nextPermissionIds);
    setSelectedPermissionIds(nextPermissionIds);
  }, [matrix, selectedRoleId]);

  useEffect(() => {
    if (!accountActions.fetchRoleTypes) {
      setRoleTypes([]);
      return;
    }

    let cancelled = false;
    setRoleTypesLoading(true);
    accountActions
      .fetchRoleTypes()
      .then((response) => {
        if (!cancelled) {
          setRoleTypes(Array.isArray(response?.roleTypes) ? response.roleTypes : []);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setPermissionMessage(error instanceof Error ? error.message : '加载角色类型失败');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setRoleTypesLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [accountActions, setPermissionMessage]);

  useEffect(() => {
    if (!selectedRoleId || !accountActions.fetchRoleDataScope) {
      setOriginalScope(createDefaultScope(selectedRoleId ?? undefined));
      setDraftScope(createDefaultScope(selectedRoleId ?? undefined));
      return;
    }

    let cancelled = false;
    setDataScopeLoading(true);
    accountActions
      .fetchRoleDataScope(selectedRoleId)
      .then((response) => {
        if (cancelled) {
          return;
        }
        const nextScope = normalizeScope(selectedRoleId, response?.dataScope || null);
        setOriginalScope(nextScope);
        setDraftScope(nextScope);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setPermissionMessage(error instanceof Error ? error.message : '加载角色数据范围失败');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setDataScopeLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [accountActions, selectedRoleId, setPermissionMessage]);

  const currentRole = useMemo(
    () => roles.find((role) => role.id === selectedRoleId) || null,
    [roles, selectedRoleId],
  );
  const currentRoleType = useMemo(
    () => roleTypeMap.get(String(currentRole?.typeCode || '').toUpperCase()) || null,
    [currentRole?.typeCode, roleTypeMap],
  );

  const codeHasWhitespace = /\s/.test(roleForm.code);
  const normalizedRoleCode = roleForm.code.trim().toUpperCase();
  const codeFormatInvalid =
    normalizedRoleCode.length > 0 && !ROLE_CODE_PATTERN.test(normalizedRoleCode);
  const roleFormInvalid =
    !roleForm.name.trim() ||
    !normalizedRoleCode ||
    codeHasWhitespace ||
    codeFormatInvalid;
  const roleTypeCodeHasWhitespace = /\s/.test(roleTypeForm.code);
  const normalizedRoleTypeCode = roleTypeForm.code.trim().toUpperCase();
  const roleTypeCodeFormatInvalid =
    normalizedRoleTypeCode.length > 0 && !ROLE_CODE_PATTERN.test(normalizedRoleTypeCode);
  const roleTypeFormInvalid =
    !roleTypeForm.name.trim() ||
    !normalizedRoleTypeCode ||
    roleTypeCodeHasWhitespace ||
    roleTypeCodeFormatInvalid;

  const hasPermissionChanges = useMemo(() => {
    const left = [...selectedPermissionIds].map(String).sort();
    const right = [...originalPermissionIds].map(String).sort();
    return JSON.stringify(left) !== JSON.stringify(right);
  }, [originalPermissionIds, selectedPermissionIds]);

  const hasScopeChanges = useMemo(
    () => JSON.stringify(draftScope) !== JSON.stringify(originalScope),
    [draftScope, originalScope],
  );

  const openCreateRole = () => {
    setEditingRole(null);
    setRoleForm(makeRoleForm());
    setRoleFormOpen(true);
  };

  const refreshRoleTypes = async () => {
    if (!accountActions.fetchRoleTypes) {
      return;
    }
    setRoleTypesLoading(true);
    try {
      const response = await accountActions.fetchRoleTypes();
      setRoleTypes(Array.isArray(response?.roleTypes) ? response.roleTypes : []);
    } finally {
      setRoleTypesLoading(false);
    }
  };

  const openEditRole = (role: RoleLike) => {
    setEditingRole(role);
    setRoleForm(makeRoleForm(role));
    setRoleFormOpen(true);
  };

  const openCreateRoleType = () => {
    setEditingRoleType(null);
    setRoleTypeForm(makeRoleTypeForm());
    setRoleTypeFormOpen(true);
  };

  const openEditRoleType = (roleType: RoleType) => {
    setEditingRoleType(roleType);
    setRoleTypeForm(makeRoleTypeForm(roleType));
    setRoleTypeFormOpen(true);
  };

  const handleSubmitRole = async () => {
    if (!roleForm.name.trim() || !roleForm.code.trim()) {
      message.warning('请填写完整的角色名称和编码');
      return;
    }
    if (codeHasWhitespace) {
      message.warning('角色编码不能包含空格');
      return;
    }
    if (!ROLE_CODE_PATTERN.test(normalizedRoleCode)) {
      message.warning('角色编码仅支持大写字母、数字和下划线，且必须以字母开头');
      return;
    }
    setSaving(true);
    try {
      if (editingRole?.id !== undefined && editingRole?.id !== null && accountActions.updateRole) {
        await accountActions.updateRole(editingRole.id, {
          name: roleForm.name.trim(),
          code: normalizedRoleCode,
          typeCode: roleForm.typeCode,
          description: roleForm.description.trim() || null,
          status: roleForm.status,
          sort: roleForm.sort,
        });
        setPermissionMessage('角色更新成功');
      } else if (accountActions.createRole) {
        const result = await accountActions.createRole({
          name: roleForm.name.trim(),
          code: normalizedRoleCode,
          typeCode: roleForm.typeCode,
          description: roleForm.description.trim() || null,
          status: roleForm.status,
          sort: roleForm.sort,
        });
        const createdId = (result as { role?: { id?: EntityId } })?.role?.id;
        if (createdId !== undefined && createdId !== null) {
          setSelectedRoleId(createdId);
        }
        setPendingRoleCodeSelection(normalizedRoleCode);
        setPermissionMessage('角色创建成功');
      }
      await Promise.all([refreshRoles(), refreshMatrix(), refreshRoleTypes()]);
      setRoleFormOpen(false);
    } catch (error) {
      setPermissionMessage(error instanceof Error ? error.message : '保存角色失败');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitRoleType = async () => {
    if (!roleTypeForm.name.trim() || !roleTypeForm.code.trim()) {
      message.warning('请填写完整的角色类型名称和编码');
      return;
    }
    if (roleTypeCodeHasWhitespace) {
      message.warning('角色类型编码不能包含空格');
      return;
    }
    if (!ROLE_CODE_PATTERN.test(normalizedRoleTypeCode)) {
      message.warning('角色类型编码仅支持大写字母、数字和下划线，且必须以字母开头');
      return;
    }
    setSaving(true);
    try {
      if (editingRoleType?.id !== undefined && editingRoleType?.id !== null && accountActions.updateRoleType) {
        await accountActions.updateRoleType(editingRoleType.id, {
          name: roleTypeForm.name.trim(),
          code: normalizedRoleTypeCode,
          description: roleTypeForm.description.trim() || null,
          status: roleTypeForm.status,
          sort: roleTypeForm.sort,
        });
        setPermissionMessage('角色类型更新成功');
      } else if (accountActions.createRoleType) {
        await accountActions.createRoleType({
          name: roleTypeForm.name.trim(),
          code: normalizedRoleTypeCode,
          description: roleTypeForm.description.trim() || null,
          status: roleTypeForm.status,
          sort: roleTypeForm.sort,
        });
        setPermissionMessage('角色类型创建成功');
      }
      await Promise.all([refreshRoleTypes(), refreshRoles(), refreshMatrix()]);
      setRoleTypeFormOpen(false);
    } catch (error) {
      setPermissionMessage(error instanceof Error ? error.message : '保存角色类型失败');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRole = async (role: RoleLike) => {
    if (!role.id || !accountActions.deleteRole) {
      return;
    }
    Modal.confirm({
      title: '确认删除角色',
      content: `即将删除角色「${role.name}」，确认继续？`,
      okText: '确认删除',
      okType: 'danger',
      onOk: async () => {
        try {
          await accountActions.deleteRole?.(role.id as EntityId);
          setPermissionMessage('角色删除成功');
          if (selectedRoleId === role.id) {
            setSelectedRoleId(null);
          }
          await Promise.all([refreshRoles(), refreshMatrix()]);
        } catch (error) {
          setPermissionMessage(error instanceof Error ? error.message : '删除角色失败');
        }
      },
    });
  };

  const handleToggleRoleStatus = async (role: RoleLike, nextChecked: boolean) => {
    if (!role.id || !accountActions.updateRoleStatus || role.isSystem) {
      return;
    }
    const nextStatus = nextChecked ? 'ACTIVE' : 'INACTIVE';
    setSaving(true);
    try {
      await accountActions.updateRoleStatus(role.id, nextStatus);
      setPermissionMessage(nextStatus === 'INACTIVE' ? '角色已停用' : '角色已启用');
      await Promise.all([
        refreshRoles(),
        refreshMatrix(),
        accountActions.refreshPermissions?.() || Promise.resolve(),
      ]);
    } catch (error) {
      setPermissionMessage(error instanceof Error ? error.message : '更新角色状态失败');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleRoleTypeStatus = async (roleType: RoleType, nextStatus: string) => {
    if (!roleType.id || !accountActions.updateRoleTypeStatus) {
      return;
    }
    setSaving(true);
    try {
      await accountActions.updateRoleTypeStatus(roleType.id, nextStatus);
      setPermissionMessage(nextStatus === 'INACTIVE' ? '角色类型已停用' : '角色类型已启用');
      await Promise.all([refreshRoleTypes(), refreshRoles(), refreshMatrix()]);
    } catch (error) {
      setPermissionMessage(error instanceof Error ? error.message : '更新角色类型状态失败');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRoleType = async (roleType: RoleType) => {
    if (!roleType.id || !accountActions.deleteRoleType) {
      return;
    }
    Modal.confirm({
      title: '确认删除角色类型',
      content: `即将删除角色类型「${roleType.name}」，确认继续？`,
      okText: '确认删除',
      okType: 'danger',
      onOk: async () => {
        try {
          await accountActions.deleteRoleType?.(roleType.id as EntityId);
          setPermissionMessage('角色类型删除成功');
          await Promise.all([refreshRoleTypes(), refreshRoles(), refreshMatrix()]);
        } catch (error) {
          setPermissionMessage(error instanceof Error ? error.message : '删除角色类型失败');
        }
      },
    });
  };

  const handleSaveAll = async () => {
    if (!selectedRoleId || !currentRole) {
      return;
    }
    if (!hasPermissionChanges && !hasScopeChanges) {
      message.info('当前没有可保存的变更');
      return;
    }

    setSaving(true);
    try {
      if (hasPermissionChanges && accountActions.updateRolePermissions) {
        await accountActions.updateRolePermissions(selectedRoleId, selectedPermissionIds);
      }
      if (hasScopeChanges && accountActions.saveRoleDataScope) {
        await accountActions.saveRoleDataScope(selectedRoleId, {
          roleId: selectedRoleId,
          scopeMode: draftScope.scopeMode,
          presetCode: draftScope.presetCode,
          rules: draftScope.rules,
        });
      }
      await Promise.all([refreshMatrix(), refreshRoles(), accountActions.refreshPermissions?.() || Promise.resolve()]);
      setPermissionMessage(`角色「${currentRole.name}」配置已保存`);
      setOriginalPermissionIds(selectedPermissionIds);
      setOriginalScope(draftScope);
    } catch (error) {
      setPermissionMessage(error instanceof Error ? error.message : '保存角色配置失败');
    } finally {
      setSaving(false);
    }
  };

  if (!canManagePermissions) {
    return (
      <PermissionDeniedState mode="section" message="暂无角色管理权限。" />
    );
  }

  return (
    <div className="role-management-shell">
      {permissionMessage ? <Alert type="info" showIcon message={permissionMessage} className="mb-4" /> : null}

      <div className="role-management-layout">
        <Card className="role-list-card glass-card" variant="borderless">
          <div className="role-list-header">
            <div className="role-list-header__copy">
              <h3 className="section-title">角色列表</h3>
            </div>
            <div className="role-list-toolbar" role="toolbar" aria-label="角色列表操作">
              <Button size="small" onClick={() => setRoleTypeModalOpen(true)}>类型</Button>
              <Button
                size="small"
                icon={<ReloadOutlined />}
                aria-label="刷新角色列表"
                onClick={() => void Promise.all([refreshRoles(), refreshMatrix()])}
              />
              <Button size="small" type="primary" icon={<PlusOutlined />} onClick={openCreateRole}>
                添加
              </Button>
            </div>
          </div>

          {rolesLoading ? (
            <div className="role-list-empty">
              <Spin />
            </div>
          ) : roles.length ? (
            <div className="role-list">
              {roles.map((role) => {
                const selected = role.id === selectedRoleId;
                return (
                  // 外层用 div + role="button"：内部还有开关和按钮，<button> 不能嵌套 <button>
                  <div
                    key={String(role.id ?? role.code)}
                    role="button"
                    tabIndex={0}
                    aria-pressed={selected}
                    className={`role-list-item${selected ? ' role-list-item--active' : ''}`}
                    onClick={() => setSelectedRoleId(role.id ?? null)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setSelectedRoleId(role.id ?? null);
                      }
                    }}
                  >
                    <div className="role-list-item__content">
                      <div className="role-list-item__title">
                        <span>{role.name}</span>
                        {role.isSystem ? <Tag color="blue">系统</Tag> : null}
                        {role.status === 'INACTIVE' ? <Tag color="default">停用</Tag> : null}
                      </div>
                      <div className="role-list-item__meta">
                        <span>{role.code}</span>
                      </div>
                    </div>
                    <div className="role-list-item__actions" onClick={(event) => event.stopPropagation()}>
                      {!role.isSystem ? (
                        <Switch
                          size="small"
                          checked={role.status !== 'INACTIVE'}
                          loading={saving}
                          onChange={(checked) => void handleToggleRoleStatus(role, checked)}
                        />
                      ) : null}
                      <Button size="small" type="text" icon={<EditOutlined />} onClick={() => openEditRole(role)} />
                      <Button
                        size="small"
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        disabled={Boolean(role.isSystem)}
                        onClick={() => void handleDeleteRole(role)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <Empty description="暂无角色" />
          )}
        </Card>

        <div className="role-detail-column">
          {!currentRole ? (
            <Card className="glass-card" variant="borderless">
              <Empty description="请选择一个角色" />
            </Card>
          ) : (
            <>
            <Card className="glass-card role-config-card" variant="borderless" loading={matrixLoading}>
              {/* === 权限设置 · {角色名} 标题行 === */}
              <div className="role-config-card__header">
                <div>
                  <h3 className="section-title">
                    权限配置
                  </h3>
                </div>
                <Button
                  type="text"
                  size="small"
                  className={`role-collapse-toggle${permissionsExpanded ? ' role-collapse-toggle--expanded' : ''}`}
                  icon={<DownOutlined />}
                  onClick={() => setPermissionsExpanded((prev) => !prev)}
                  aria-expanded={permissionsExpanded}
                />
              </div>
              <div className={`role-config-panel${permissionsExpanded ? ' role-config-panel--expanded' : ''}`}>
                <div className="role-config-panel__inner">
                  {permissionGroups.length ? (
                    <div className="role-module-list">
                      {permissionGroups.map((group) => (
                        <div key={group.module} className="role-module-card">
                          <div className="role-module-card__title">{group.label}</div>
                          <div className="role-module-card__grid">
                            {group.items.map((permission) => {
                              const checked = permission.id !== undefined && permission.id !== null
                                ? selectedPermissionIds.some((item) => String(item) === String(permission.id))
                                : false;
                              return (
                                <label key={String(permission.id ?? permission.code)} className="role-permission-toggle">
                                  <span>{permission.name || permission.code}</span>
                                  <Switch
                                    checked={checked}
                                    onChange={(nextChecked) => {
                                      if (permission.id === undefined || permission.id === null) {
                                        return;
                                      }
                                      setSelectedPermissionIds((prev) => {
                                        const next = new Set(prev.map(String));
                                        if (nextChecked) {
                                          next.add(String(permission.id));
                                        } else {
                                          next.delete(String(permission.id));
                                        }
                                        return matrix?.permissions
                                          ?.filter((item) => item.id !== undefined && next.has(String(item.id)))
                                          .map((item) => item.id as EntityId) || [];
                                      });
                                    }}
                                  />
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Empty description="暂无权限定义" />
                  )}
                </div>
              </div>

              {/* === 分隔线 === */}
              <hr className="role-config-divider" />

              {/* === 数据范围配置（同一Card内续接） === */}
                <div className="role-config-card__header">
                  <div>
                    <h3 className="section-title">
                      数据范围配置
                    </h3>
                  </div>
                  <Button
                    type="text"
                    size="small"
                    className={`role-collapse-toggle${scopeExpanded ? ' role-collapse-toggle--expanded' : ''}`}
                    icon={<DownOutlined />}
                    onClick={() => setScopeExpanded((prev) => !prev)}
                    aria-expanded={scopeExpanded}
                  />
                </div>

                <div className={`role-config-panel${scopeExpanded ? ' role-config-panel--expanded' : ''}`}>
                  <div className="role-config-panel__inner">
                    <DataScopeEditor
                      value={draftScope}
                      onChange={setDraftScope}
                      options={scopeOptions}
                      optionsError={scopeOptionsError}
                      loading={dataScopeLoading}
                    />
                  </div>
                </div>
              </Card>

              <div className="role-management-sticky">
                <Button
                  type="primary"
                  size="large"
                  loading={saving}
                  disabled={!hasPermissionChanges && !hasScopeChanges}
                  onClick={() => void handleSaveAll()}
                >
                  保存更改
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      <Modal
        open={roleFormOpen}
        title={editingRole ? '编辑角色' : '新增角色'}
        onCancel={() => setRoleFormOpen(false)}
        onOk={() => void handleSubmitRole()}
        okText="保存"
        confirmLoading={saving}
        okButtonProps={{ disabled: roleFormInvalid }}
        centered
        width={MODAL_WIDTH.md}
        className="co-modal"
      >
        <div className="stack modal-form">
          <label className="field-block">
            <span className="field-label">角色名称</span>
            <Input value={roleForm.name} onChange={(event) => setRoleForm((prev) => ({ ...prev, name: event.target.value }))} />
          </label>
          <label className="field-block">
            <span className="field-label">角色编码</span>
            <Input
              value={roleForm.code}
              status={codeHasWhitespace || codeFormatInvalid ? 'error' : ''}
              readOnly={Boolean(editingRole)}
              onChange={(event) => setRoleForm((prev) => ({ ...prev, code: normalizeRoleCodeInput(event.target.value) }))}
            />
            {codeHasWhitespace ? (
              <span className="field-hint field-hint--error">角色编码不能包含空格。</span>
            ) : null}
            {!codeHasWhitespace && codeFormatInvalid ? (
              <span className="field-hint field-hint--error">
                角色编码仅支持大写字母、数字和下划线，且必须以字母开头。
              </span>
            ) : null}
          </label>
          <label className="field-block">
            <span className="field-label">角色类型</span>
            <PanelSelect
              value={roleForm.typeCode}
              options={roleTypeOptions}
              disabled={Boolean(editingRole?.isSystem)}
              onChange={(value) => setRoleForm((prev) => ({ ...prev, typeCode: value }))}
            />
          </label>
          <label className="field-block">
            <span className="field-label">排序</span>
            <Input
              type="number"
              value={roleForm.sort}
              onChange={(event) => setRoleForm((prev) => ({ ...prev, sort: Number(event.target.value || 100) }))}
            />
          </label>
          <label className="field-block">
            <span className="field-label">状态</span>
            <PanelSelect
              value={roleForm.status}
              disabled={Boolean(editingRole?.isSystem)}
              options={[
                { value: 'ACTIVE', label: '启用' },
                { value: 'INACTIVE', label: '停用' },
              ]}
              onChange={(value) => setRoleForm((prev) => ({ ...prev, status: value }))}
            />
          </label>
          <label className="field-block">
            <span className="field-label">描述</span>
            <Input.TextArea
              rows={4}
              value={roleForm.description}
              onChange={(event) => setRoleForm((prev) => ({ ...prev, description: event.target.value }))}
            />
          </label>
        </div>
      </Modal>

      <Modal
        open={roleTypeModalOpen}
        title="角色类型管理"
        onCancel={() => setRoleTypeModalOpen(false)}
        footer={null}
        centered
        width={MODAL_WIDTH.lg}
        className="co-modal"
      >
        <div className="stack">
          <div className="flex items-center justify-between">
            <div className="hero-hint">内置类型不可删除，不可停用。</div>
            <Space>
              <Button icon={<ReloadOutlined />} onClick={() => void refreshRoleTypes()} />
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreateRoleType}>
                添加类型
              </Button>
            </Space>
          </div>
          {roleTypesLoading ? (
            <div className="role-list-empty">
              <Spin />
            </div>
          ) : sortedRoleTypes.length ? (
            <div className="role-list">
              {sortedRoleTypes.map((roleType) => (
                <div key={String(roleType.id ?? roleType.code)} className="role-list-item">
                  <div className="role-list-item__content">
                    <div className="role-list-item__title">
                      <span>{roleType.name}</span>
                      {roleType.isSystem ? <Tag color="blue">系统</Tag> : <Tag color="purple">自定义</Tag>}
                      {roleType.status === 'INACTIVE' ? <Tag color="default">停用</Tag> : <Tag color="green">启用</Tag>}
                    </div>
                    <div className="role-list-item__meta">
                      <span>{roleType.code}</span>
                      <span>{roleType.description || '未填写描述'}</span>
                    </div>
                  </div>
                  <Space>
                    <Switch
                      size="small"
                      checked={roleType.status !== 'INACTIVE'}
                      disabled={Boolean(roleType.isSystem)}
                      onChange={(checked) => void handleToggleRoleTypeStatus(roleType, checked ? 'ACTIVE' : 'INACTIVE')}
                    />
                    <Button size="small" type="text" icon={<EditOutlined />} onClick={() => openEditRoleType(roleType)} />
                    <Button
                      size="small"
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      disabled={Boolean(roleType.isSystem)}
                      onClick={() => void handleDeleteRoleType(roleType)}
                    />
                  </Space>
                </div>
              ))}
            </div>
          ) : (
            <Empty description="暂无角色类型" />
          )}
        </div>
      </Modal>

      <Modal
        open={roleTypeFormOpen}
        title={editingRoleType ? '编辑角色类型' : '新增角色类型'}
        onCancel={() => setRoleTypeFormOpen(false)}
        onOk={() => void handleSubmitRoleType()}
        okText="保存"
        confirmLoading={saving}
        okButtonProps={{ disabled: roleTypeFormInvalid }}
        centered
        width={MODAL_WIDTH.md}
        className="co-modal"
      >
        <div className="stack modal-form">
          <label className="field-block">
            <span className="field-label">类型名称</span>
            <Input value={roleTypeForm.name} onChange={(event) => setRoleTypeForm((prev) => ({ ...prev, name: event.target.value }))} />
          </label>
          <label className="field-block">
            <span className="field-label">类型编码</span>
            <Input
              value={roleTypeForm.code}
              status={roleTypeCodeHasWhitespace || roleTypeCodeFormatInvalid ? 'error' : ''}
              readOnly={Boolean(editingRoleType)}
              onChange={(event) => setRoleTypeForm((prev) => ({ ...prev, code: normalizeRoleCodeInput(event.target.value) }))}
            />
          </label>
          <label className="field-block">
            <span className="field-label">排序</span>
            <Input
              type="number"
              value={roleTypeForm.sort}
              onChange={(event) => setRoleTypeForm((prev) => ({ ...prev, sort: Number(event.target.value || 100) }))}
            />
          </label>
          <label className="field-block">
            <span className="field-label">状态</span>
            <PanelSelect
              value={roleTypeForm.status}
              disabled={Boolean(editingRoleType?.isSystem)}
              options={[
                { value: 'ACTIVE', label: '启用' },
                { value: 'INACTIVE', label: '停用' },
              ]}
              onChange={(value) => setRoleTypeForm((prev) => ({ ...prev, status: value }))}
            />
          </label>
          <label className="field-block">
            <span className="field-label">描述</span>
            <Input.TextArea
              rows={4}
              value={roleTypeForm.description}
              onChange={(event) => setRoleTypeForm((prev) => ({ ...prev, description: event.target.value }))}
            />
          </label>
        </div>
      </Modal>
    </div>
  );
}
