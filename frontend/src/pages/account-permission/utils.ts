/**
 * 账号与权限管理模块 - 工具函数
 * @module pages/account-permission/utils
 */

import type {
  EntityId,
  ServiceQueryParams,
  ServiceRecord,
} from '../../types/service';
import type { RolePermissionMap, UserFilters } from './types';

interface FlattenedRolePermissionRecord extends ServiceRecord {
  id: string;
  roleId: EntityId;
  permissionId: EntityId;
}

interface UserTableParamsInput extends UserFilters {
  appliedSearchTerm?: string;
  page: number;
  pageSize: number;
}

/**
 * 将 rolePermissionMap 展平为 records 数组
 * @param {Map} map - roleId => Set<permissionId>
 * @returns {Array} 展平后的记录数组
 */
export function flattenRoleMap(
  map: RolePermissionMap,
): FlattenedRolePermissionRecord[] {
  const records: FlattenedRolePermissionRecord[] = [];
  map.forEach((set, roleId) => {
    Array.from(set).forEach((permissionId) => {
      records.push({ id: `${roleId}-${permissionId}`, roleId, permissionId });
    });
  });
  return records;
}

/**
 * 构建用户表格请求参数
 * @param {Object} params - 参数对象
 * @returns {Object} 构建后的请求参数
 */
export function buildUserTableParams({
  department,
  userType,
  isDisabled,
  appliedSearchTerm,
  page,
  pageSize,
}: UserTableParamsInput): ServiceQueryParams {
  const params: ServiceQueryParams = { department, userType, isDisabled };
  if (appliedSearchTerm) params.search = appliedSearchTerm;
  params.page = page;
  params.pageSize = pageSize;
  return params;
}
