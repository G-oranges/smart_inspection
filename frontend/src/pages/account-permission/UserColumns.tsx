/**
 * 账号与权限管理模块 - 用户表格列定义
 * @module pages/account-permission/UserColumns
 */

import type { ReactNode } from 'react';
import { Button, Switch, Space, Tooltip } from 'antd';
import type { TableColumnsType } from 'antd';
import { DeleteOutlined, EditOutlined, KeyOutlined } from '@ant-design/icons';
import { USER_COLUMN_WIDTHS, USER_RENDERERS } from './accountPermissionSchema';

import type { AccountUser } from './types';
import type { UserColumnConfig } from './accountPermissionSchema';

interface UserColumnHandlers {
  onToggleStatus: (user: AccountUser) => void;
  onEdit: (user: AccountUser) => void;
  onGenerateTempPassword: (user: AccountUser) => void | Promise<void>;
  onDelete: (user: AccountUser) => void | Promise<void>;
  batchLoading?: boolean;
  sortField?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * 渲染用户单元格
 * @param {Object} user - 用户数据
 * @param {Object} column - 列配置
 * @param {Function} onToggleStatus - 切换状态回调
 */
export function renderUserCell(
  user: AccountUser,
  column: UserColumnConfig,
  onToggleStatus?: (user: AccountUser) => void,
): ReactNode {
  if (column.fieldKey === "isDisabled") {
    return (
      <label className="switch">
        <input
          type="checkbox"
          checked={!user.isDisabled}
          onChange={() => onToggleStatus && onToggleStatus(user)}
        />
        <span className="slider round"></span>
      </label>
    );
  }
  if (USER_RENDERERS[column.fieldKey]) {
    return USER_RENDERERS[column.fieldKey](user);
  }
  if (column.render) {
    return column.render(user);
  }
  const value = user[column.fieldKey];
  if (value === null || value === undefined || value === "") return "-";
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return String(value);
  }
  return '-';
}

/**
 * 构建 Ant Design Table 的列配置
 * @param {Array} visibleUserColumns - 可见列配置
 * @param {Object} handlers - 事件处理器
 * @returns {Array} 列配置数组
 */
export function buildAntTableColumns(
  visibleUserColumns: UserColumnConfig[],
  handlers: UserColumnHandlers,
): TableColumnsType<AccountUser> {
  const {
    onToggleStatus,
    onEdit,
    onGenerateTempPassword,
    onDelete,
    batchLoading,
    sortField,
    sortOrder,
  } = handlers;

  const cols: TableColumnsType<AccountUser> = visibleUserColumns.map((column) => {
    const col: NonNullable<TableColumnsType<AccountUser>>[number] = {
      title: column.label,
      dataIndex: column.fieldKey,
      key: column.fieldKey as React.Key,
      align: 'center',
      width: column.width ?? USER_COLUMN_WIDTHS[column.fieldKey] ?? 130,
      sorter: Boolean(column.sortable),
      sortOrder:
        sortField === column.fieldKey
          ? sortOrder === 'asc'
            ? 'ascend'
            : 'descend'
          : null,
      ellipsis: column.fieldKey !== 'avatarUrl' && column.fieldKey !== 'isDisabled',
    };

    // 特殊渲染处理
    if (column.fieldKey === "isDisabled") {
      col.render = (_, user) => (
        <Switch
          checked={!user.isDisabled}
          onChange={() => onToggleStatus(user)}
          size="small"
        />
      );
      col.align = 'center';
      col.width = column.width ?? 100;
    } else if (column.fieldKey === "roles") {
      col.render = (_, user) => {
        const rolesText =
          user.roles && user.roles.length > 0
            ? user.roles.map((role) => role.name).join(", ")
            : user.userType || "-";
        return rolesText;
      };
    } else if (USER_RENDERERS[column.fieldKey]) {
      col.render = (_, user) => USER_RENDERERS[column.fieldKey](user);
    }

    // 头像列特殊宽度
    if (column.fieldKey === "avatarUrl") {
      col.width = column.width ?? 64;
      col.align = "center";
    }

    return col;
  });

  // 添加操作列
  cols.push({
    title: "操作",
    key: "action",
    align: "center",
    width: 108,
    fixed: "right",
    className: "table-action-column",
    render: (_, user) => (
      <Space size={8} className="table-action-buttons dorm-table-action-group">
        <Tooltip title="编辑用户">
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            onClick={() => onEdit(user)}
            className="dorm-table-action-btn is-edit"
            aria-label="编辑用户"
          />
        </Tooltip>
        <Tooltip title="生成临时密码">
          <Button
            type="text"
            size="small"
            icon={<KeyOutlined />}
            onClick={() => onGenerateTempPassword(user)}
            className="dorm-table-action-btn is-password"
            aria-label="生成临时密码"
          />
        </Tooltip>
        <Tooltip title="删除用户">
          <Button
            type="text"
            size="small"
            danger
            icon={<DeleteOutlined />}
            disabled={batchLoading}
            onClick={() => void onDelete(user)}
            className="dorm-table-action-btn is-danger"
            aria-label="删除用户"
          />
        </Tooltip>
      </Space>
    ),
  });

  return cols;
}
