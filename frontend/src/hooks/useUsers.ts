import { useCallback, useRef, useState } from 'react';

import { userService } from '../services/userService';
import { tokenManager } from '../utils/api';

import type { RoleLike, UserLike } from '../types/app';
import type {
  DeleteByIdsPayload,
  EntityId,
  ExecutorListResponse,
  ServiceQueryParams,
  ServiceRecord,
  ServiceTableResponse,
  TemporaryPasswordResponse,
} from '../types/service';

export function useUsers(
  user?: UserLike | null,
  activeRole?: RoleLike | null,
) {
  const [users, setUsers] = useState<ServiceRecord[]>([]);
  // 使用 ref 追踪加载状态，避免 loaded 翻转导致 callback 重建
  const usersLoadedRef = useRef(false);

  const fetchUsers = useCallback(
    async (force = false): Promise<void> => {
      if (!tokenManager.hasTokens()) {
        return;
      }

      const currentRole = activeRole?.code || user?.role;
      if (currentRole !== 'ADMIN') {
        if (!usersLoadedRef.current || force) {
          setUsers([]);
          usersLoadedRef.current = true;
        }
        return;
      }

      if (usersLoadedRef.current && !force) {
        return;
      }

      try {
        const data = await userService.getUsers();
        setUsers(data.items || []);
        usersLoadedRef.current = true;
      } catch (error) {
        console.error('Failed to fetch users', error);
      }
    },
    [activeRole?.code, user?.role],
  );

  const loadUsers = useCallback(
    async (params: ServiceQueryParams = {}): Promise<ServiceTableResponse> => {
      if (!tokenManager.hasTokens()) {
        return { items: [], total: 0 };
      }

      return userService.getUsers(params);
    },
    [],
  );

  const createUser = async (payload: ServiceRecord): Promise<void> => {
    await userService.createUser(payload);
    await fetchUsers(true);
  };

  const updateUser = async (
    id: EntityId,
    payload: ServiceRecord,
  ): Promise<void> => {
    await userService.updateUser(id, payload);
  };

  const deleteUsers = async (
    payload: DeleteByIdsPayload = {},
  ): Promise<void> => {
    await userService.deleteUsers(payload.ids || []);
  };

  const resetUserPassword = async (id: EntityId): Promise<void> => {
    await userService.resetPassword(id);
  };

  const generateTemporaryPassword = async (
    id: EntityId,
  ): Promise<TemporaryPasswordResponse> => {
    return userService.generateTemporaryPassword(id);
  };

  const updateMe = async (payload: ServiceRecord): Promise<unknown> => {
    return userService.updateMe(payload);
  };

  const fetchExecutors = async (
    params: ServiceQueryParams = {},
  ): Promise<ExecutorListResponse> => {
    return userService.getExecutors(params);
  };

  return {
    users,
    fetchUsers,
    loadUsers,
    createUser,
    updateUser,
    deleteUsers,
    resetUserPassword,
    generateTemporaryPassword,
    updateMe,
    fetchExecutors,
  };
}
