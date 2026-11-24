/**
 * 账号与权限管理模块 - 权限矩阵展示
 * @module pages/account-permission/PermissionMatrix
 */

import { useMemo } from 'react';
import { Checkbox } from 'antd';
import type { ColumnsType } from 'antd/es/table';

import GlassTable from '../../components/GlassTable';
import { useMobile } from '../../hooks/useMobile';
import type { RoleLike } from '../../types/app';
import type { EntityId, RoleMatrixResponse } from '../../types/service';
import type { RolePermissionMap } from './types';

interface PermissionMatrixProps {
  loading: boolean;
  matrix: RoleMatrixResponse | null;
  matrixRoles: RoleLike[];
  rolePermissionMap: RolePermissionMap;
  onToggle: (roleId: EntityId, permissionId: EntityId) => void | Promise<void>;
}

/**
 * 权限矩阵组件
 * @param {Object} props
 * @param {boolean} props.loading - 加载状态
 * @param {Object} props.matrix - 权限矩阵数据
 * @param {Array} props.matrixRoles - 角色列表（已排序）
 * @param {Map} props.rolePermissionMap - 角色权限映射
 * @param {Function} props.onToggle - 切换权限回调
 */
export default function PermissionMatrix({
  loading,
  matrix,
  matrixRoles,
  rolePermissionMap,
  onToggle,
}: PermissionMatrixProps) {
  const isMobile = useMobile();

  const dataSource = useMemo(
    () =>
      (matrix?.permissions || []).map((permission) => ({
        key: String(permission.id ?? permission.code ?? permission.name ?? Math.random()),
        permissionId: permission.id,
        permissionName: permission.name || '-',
      })),
    [matrix],
  );

  const columns = useMemo<ColumnsType<{ key: string; permissionId?: EntityId; permissionName: string }>>(
    () => [
      {
        title: '功能点',
        dataIndex: 'permissionName',
        key: 'permissionName',
        width: 220,
        fixed: 'left',
        render: (value: string) => <span className="font-medium">{value}</span>,
      },
      ...matrixRoles.map((role) => ({
        title: role.name || '角色',
        key: `role-${String(role.id)}`,
        width: 120,
        align: 'center' as const,
        render: (_value: unknown, record: { permissionId?: EntityId }) => {
          if (role.id === undefined || record.permissionId === undefined) {
            return null;
          }

          return (
            <Checkbox
              checked={rolePermissionMap.get(role.id)?.has(record.permissionId)}
              onChange={() => {
                void onToggle(role.id as EntityId, record.permissionId as EntityId);
              }}
            />
          );
        },
      })),
    ],
    [matrixRoles, onToggle, rolePermissionMap],
  );

  return (
    <div className="mb-6">
      <div className="table-head dorm-table-head mb-4">
        <div className="flex items-center gap-2">
          <div className="dorm-table-head-accent" />
          <h3 className="dorm-table-head-title">角色权限矩阵</h3>
        </div>
      </div>
      {matrix ? (
        <div className={`table-wrapper${isMobile ? '' : ' dorm-table-wrapper'}`}>
          <GlassTable
            className="dorm-table"
            columns={columns}
            dataSource={dataSource}
            rowKey="key"
            pagination={false}
            scroll={{ x: Math.max(720, 220 + matrixRoles.length * 120) }}
            loading={loading}
            useSkeleton={false}
          />
        </div>
      ) : (
        <p className="muted">暂无权限矩阵</p>
      )}
    </div>
  );
}
