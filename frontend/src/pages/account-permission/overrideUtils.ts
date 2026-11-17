/**
 * 账号例外授权的请求构造。
 * @module pages/account-permission/overrideUtils
 */

import type { BatchPermissionState } from './types';

/**
 * 只提交相对 baseline（账号已有例外）发生变化的功能点；改回“继承角色”的项用 inherit 删除例外。
 * 未改动的功能点不提交，后端会保留它们原有的例外。
 */
export function buildOverrides(batchPermissions: BatchPermissionState, baseline: BatchPermissionState = {}) {
  const keys = new Set([...Object.keys(batchPermissions), ...Object.keys(baseline)]);
  return Array.from(keys)
    .filter((permissionId) => (batchPermissions[permissionId] || 'inherit') !== (baseline[permissionId] || 'inherit'))
    .map((permissionId) => {
      const mode = batchPermissions[permissionId] || 'inherit';
      return { permissionId, grant: mode === 'grant', inherit: mode === 'inherit' };
    });
}
