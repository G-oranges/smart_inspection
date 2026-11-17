/**
 * 账号与权限管理模块 - 用户表单弹窗
 * @module pages/account-permission/UserFormModal
 */

import type { Dispatch, FormEvent, SetStateAction } from 'react';
import { Modal, Input, Select, Switch, Button, Space } from 'antd';

import type { RoleLike } from '../../types/app';
import type { EntityId } from '../../types/service';
import type { UserFormState } from './types';

interface UserFormModalProps {
  open: boolean;
  editingId: EntityId | null;
  form: UserFormState;
  setForm: Dispatch<SetStateAction<UserFormState>>;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
  roleOptions: RoleLike[];
  rolesLoading: boolean;
  rolesError: string;
}

/**
 * 用户表单弹窗组件
 * @param {Object} props
 * @param {boolean} props.open - 是否打开
 * @param {string|null} props.editingId - 编辑用户ID
 * @param {Object} props.form - 表单数据
 * @param {Function} props.setForm - 设置表单数据
 * @param {Function} props.onSubmit - 提交回调
 * @param {Function} props.onCancel - 取消回调
 * @param {Array} props.roleOptions - 角色选项
 * @param {boolean} props.rolesLoading - 角色加载中
 * @param {string} props.rolesError - 角色加载错误
 */
export default function UserFormModal({
  open,
  editingId,
  form,
  setForm,
  onSubmit,
  onCancel,
  roleOptions,
  rolesLoading,
  rolesError,
}: UserFormModalProps) {
  return (
    <Modal
      open={open}
      title={editingId ? "编辑用户" : "新增用户"}
      onCancel={onCancel}
      footer={
        <Space>
          <Button onClick={onCancel}>取消</Button>
          <Button type="primary" htmlType="submit" form="user-form">
            保存
          </Button>
        </Space>
      }
      width={640}
    >
      <form
        id="user-form"
        className="stack modal-form"
        onSubmit={onSubmit}
      >
        <div className="modal-grid">
          <label className="field-block">
            <span className="field-label">用户名</span>
            <Input
              value={form.username}
              onChange={(e) =>
                setForm({ ...form, username: e.target.value })
              }
              required
              readOnly={!!editingId}
            />
          </label>
          <label className="field-block">
            <span className="field-label">姓名</span>
            <Input
              value={form.fullName}
              onChange={(e) =>
                setForm({ ...form, fullName: e.target.value })
              }
              required
            />
          </label>
          <label className="field-block">
            <span className="field-label">电子邮箱</span>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </label>
          <label className="field-block">
            <span className="field-label">联系电话</span>
            <Input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </label>
          <label className="field-block">
            <span className="field-label">部门</span>
            <Input
              value={form.department}
              onChange={(e) =>
                setForm({ ...form, department: e.target.value })
              }
            />
          </label>
          <label className="field-block">
            <span className="field-label">主角色</span>
            <Select
              value={form.role || undefined}
              onChange={(selectedCode) => {
                const primaryRole = roleOptions.find((role) => role.code === selectedCode);
                const nextRoles = new Set(form.roles);
                if (primaryRole?.id !== undefined && primaryRole?.id !== null) {
                  nextRoles.add(primaryRole.id);
                }
                setForm({
                  ...form,
                  role: selectedCode,
                  roles: Array.from(nextRoles),
                });
              }}
              options={roleOptions
                .filter((role) => role.code)
                .map((role) => ({
                  value: role.code,
                  label: role.name,
                  disabled: role.status === 'INACTIVE',
                }))}
              placeholder="选择主角色"
              style={{ width: "100%" }}
            />
          </label>
          <label className="field-block full-row">
            <span className="field-label">附加角色</span>
            {rolesLoading && <p className="muted">加载角色中...</p>}
            {rolesError && <p className="error">{rolesError}</p>}
            <Select
              mode="multiple"
              value={form.roles}
              onChange={(selected) => {
                const nextSelected = selected as EntityId[];
                const primaryRole = roleOptions.find((role) => role.code === form.role);
                const hasPrimary =
                  primaryRole?.id !== undefined && primaryRole?.id !== null
                    ? nextSelected.includes(primaryRole.id)
                    : false;

                setForm({
                  ...form,
                  role: hasPrimary ? form.role : '',
                  roles: nextSelected,
                });
              }}
              options={roleOptions.map((role) => ({
                value: role.id,
                label: role.name,
                disabled: role.status === 'INACTIVE',
              }))}
              placeholder="选择角色（可多选）"
              style={{ width: "100%" }}
            />
          </label>
          <div className="field-block">
            <span className="field-label">启用状态</span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Switch
                checked={!form.isDisabled}
                onChange={(checked) =>
                  setForm({ ...form, isDisabled: !checked })
                }
              />
              <span className="muted">
                {!form.isDisabled ? "启用中" : "已停用"}
              </span>
            </div>
          </div>
        </div>
      </form>
    </Modal>
  );
}
