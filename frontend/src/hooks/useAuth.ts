import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useQueryClient } from '@tanstack/react-query';

import { authService } from '../services/authService';
import { permissionKeys, useMyPermissions, useRoleMatrix } from './usePermissionsQuery';
import { setOnTokenExpired, tokenManager } from '../utils/api';

import type { RoleLike, UserLike } from '../types/app';
import type { RoleMatrixResponse } from '../types/service';

function readStoredUser(): UserLike | null {
  const raw = localStorage.getItem('user');
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as UserLike;
  } catch {
    localStorage.removeItem('user');
    return null;
  }
}

function resolveInitialRole(user: UserLike): RoleLike | null {
  if (Array.isArray(user.roles) && user.roles.length > 0) {
    const storedCode = localStorage.getItem('active_role_code');
    const storedRole = storedCode
      ? user.roles.find((role) => role.code === storedCode)
      : null;

    if (storedRole) {
      return storedRole;
    }

    return user.roles.find((role) => role.code === user.role) || user.roles[0];
  }

  if (user.role) {
    return { code: user.role, name: user.role };
  }

  return null;
}

function persistStoredUser(user: UserLike | null): void {
  if (user) {
    localStorage.setItem('user', JSON.stringify(user));
    return;
  }

  localStorage.removeItem('user');
}

function persistActiveRole(role: RoleLike | null): void {
  if (role?.code) {
    localStorage.setItem('active_role_code', role.code);
    return;
  }

  localStorage.removeItem('active_role_code');
}

function clearResultSelection(userId?: UserLike['id']): void {
  if (!userId) {
    return;
  }

  try {
    sessionStorage.removeItem(`checkResultSelectedTask_${userId}`);
  } catch {
    // Ignore session storage cleanup failures.
  }
}

function hasScopedPermission(
  code: string,
  permissions: string[],
  user: UserLike | null,
  roleMatrix: RoleMatrixResponse | null | undefined,
  activeRole: RoleLike | null,
): boolean {
  if (!permissions.includes(code)) {
    return false;
  }

  if (!user?.roles || user.roles.length <= 1) {
    return true;
  }

  if (!roleMatrix || !activeRole) {
    return true;
  }

  const permission = roleMatrix.permissions.find((item) => item.code === code);
  if (!permission) {
    return false;
  }

  const roleId = activeRole.id;
  if (!roleId) {
    return true;
  }

  return roleMatrix.rolePermissions.some(
    (item) => item.roleId === roleId && item.permissionId === permission.id,
  );
}

export interface UseAuthResult {
  token: string | null;
  user: UserLike | null;
  permissions: string[];
  loading: boolean;
  error: string;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  changePassword: (oldPassword: string, newPassword: string) => Promise<unknown>;
  hasPermission: (code: string) => boolean;
  refreshPermissions: () => Promise<unknown>;
  refreshUser: () => Promise<UserLike | null>;
  activeRole: RoleLike | null;
  setActiveRole: (role: RoleLike | null) => void;
  userRoles: RoleLike[];
  permissionsReady: boolean;
}

const EMPTY_ROLES: RoleLike[] = [];
const EMPTY_PERMISSIONS: string[] = [];

export function useAuth(): UseAuthResult {
  const queryClient = useQueryClient();
  const [token, setToken] = useState<string | null>(() =>
    tokenManager.getAccessToken(),
  );
  const [user, setUser] = useState<UserLike | null>(() => readStoredUser());
  const [activeRole, setActiveRoleState] = useState<RoleLike | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 使用 ref 追踪最新 token/user，避免 refreshUser 的 callback 依赖链
  // 导致登录后重复网络请求
  const tokenRef = useRef(token);
  tokenRef.current = token;
  const userRef = useRef(user);
  userRef.current = user;

  const {
    data: permissionsData,
    isSuccess: permissionsReady,
    refetch: refetchPermissions,
  } = useMyPermissions({
    enabled: Boolean(token),
  });

  const { data: roleMatrix } = useRoleMatrix({
    enabled: Boolean(token && user?.roles && user.roles.length > 1),
  });

  const permissions = useMemo(
    () => permissionsData?.permissions || EMPTY_PERMISSIONS,
    [permissionsData],
  );

  const handleLogout = useCallback(() => {
    // 通过 ref 读取 user.id，避免 user 变化导致 callback 重建
    clearResultSelection(userRef.current?.id);
    if (tokenManager.hasTokens()) {
      authService.logout().catch(() => {});
    }

    setToken(null);
    setUser(null);
    setActiveRoleState(null);
    tokenManager.clearTokens();
    persistStoredUser(null);
    persistActiveRole(null);
    queryClient.removeQueries({ queryKey: permissionKeys.all });
  }, [queryClient]);

  useEffect(() => {
    setOnTokenExpired(handleLogout);
    return () => setOnTokenExpired(null);
  }, [handleLogout]);

  const refreshUser = useCallback(async (): Promise<UserLike | null> => {
    // 通过 ref 读取 token，避免 token 变化 → refreshUser 重建 → effect 再次触发
    if (!tokenRef.current) {
      return null;
    }

    try {
      const data = await authService.getCurrentUser();
      const fetchedUser = data.user;
      setUser(fetchedUser);
      persistStoredUser(fetchedUser);
      setActiveRoleState(resolveInitialRole(fetchedUser));
      return fetchedUser;
    } catch {
      handleLogout();
      return null;
    }
  }, [handleLogout]);

  useEffect(() => {
    if (!token) {
      return;
    }

    void refreshUser();
    // token 是唯一的触发条件；refreshUser 通过 ref 读取最新 token
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleLogin = useCallback(
    async (username: string, password: string): Promise<void> => {
      setLoading(true);
      setError('');

      try {
        const data = await authService.login(username, password);
        const accessToken = data.accessToken || data.token || null;
        const refreshToken = data.refreshToken || null;
        const nextUser = data.user || null;

        tokenManager.setTokens(accessToken, refreshToken);
        setToken(accessToken);
        setUser(nextUser);
        setActiveRoleState(nextUser ? resolveInitialRole(nextUser) : null);
        persistStoredUser(nextUser);
      } catch (caughtError) {
        const nextError =
          caughtError instanceof Error ? caughtError.message : '登录失败';
        setError(nextError);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const hasPermission = useCallback(
    (code: string): boolean =>
      hasScopedPermission(code, permissions, user, roleMatrix, activeRole),
    [activeRole, permissions, roleMatrix, user],
  );

  const setActiveRole = useCallback((role: RoleLike | null): void => {
    setActiveRoleState(role);
    persistActiveRole(role);
  }, []);

  const refreshPermissions = useCallback(async (): Promise<unknown> => {
    await queryClient.invalidateQueries({ queryKey: permissionKeys.me() });
    return refetchPermissions();
  }, [queryClient, refetchPermissions]);

  const changePassword = useCallback(
    async (oldPassword: string, newPassword: string): Promise<unknown> => {
      if (!token) {
        throw new Error('尚未登录');
      }

      return authService.changePassword(oldPassword, newPassword);
    },
    [token],
  );

  return {
    token,
    user,
    permissions,
    loading,
    error,
    login: handleLogin,
    logout: handleLogout,
    changePassword,
    hasPermission,
    refreshPermissions,
    refreshUser,
    activeRole,
    setActiveRole,
    userRoles: user?.roles || EMPTY_ROLES,
    permissionsReady,
  };
}
