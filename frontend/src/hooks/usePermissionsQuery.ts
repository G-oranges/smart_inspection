import { useQuery, useQueryClient } from '@tanstack/react-query';

import { commonService } from '../services/commonService';
import { tokenManager } from '../utils/api';

import type {
  PermissionListResponse,
  RoleMatrixResponse,
} from '../types/service';

interface PermissionQueryOptions {
  enabled?: boolean;
}

export const permissionKeys = {
  all: ['permissions'] as const,
  me: () => [...permissionKeys.all, 'me'] as const,
  matrix: () => [...permissionKeys.all, 'matrix'] as const,
};

export function useMyPermissions(options: PermissionQueryOptions = {}) {
  const hasToken = tokenManager.hasTokens();

  return useQuery({
    queryKey: permissionKeys.me(),
    queryFn: async (): Promise<PermissionListResponse> => {
      if (!hasToken) {
        return { permissions: [] };
      }

      return commonService.getMyPermissions();
    },
    enabled: hasToken && (options.enabled ?? true),
    staleTime: 30 * 60 * 1000,
  });
}

export function useRoleMatrix(options: PermissionQueryOptions = {}) {
  const hasToken = tokenManager.hasTokens();

  return useQuery({
    queryKey: permissionKeys.matrix(),
    queryFn: async (): Promise<RoleMatrixResponse | null> => {
      if (!hasToken) {
        return null;
      }

      return commonService.getRoleMatrix();
    },
    enabled: hasToken && (options.enabled ?? true),
    staleTime: 30 * 60 * 1000,
  });
}

export function useInvalidatePermissions() {
  const queryClient = useQueryClient();

  return {
    invalidateAll: () =>
      queryClient.invalidateQueries({ queryKey: permissionKeys.all }),
    invalidateMyPermissions: () =>
      queryClient.invalidateQueries({ queryKey: permissionKeys.me() }),
    invalidateMatrix: () =>
      queryClient.invalidateQueries({ queryKey: permissionKeys.matrix() }),
    clearAll: () => queryClient.removeQueries({ queryKey: permissionKeys.all }),
  };
}
