/**
 * 账号与权限管理模块 - 用户操作菜单
 * @module pages/account-permission/UserActionSheet
 */

import { LockOutlined, DeleteOutlined } from '@ant-design/icons';
import IOSActionSheet from '../../components/common/IOSActionSheet';

interface UserActionSheetProps {
  open: boolean;
  onClose: () => void;
  selectedCount: number;
  onResetPassword: () => void;
  onBulkDelete: () => void;
}

/**
 * 用户操作菜单组件
 * 移动端底部操作面板，点击后由 handleBulkDelete / handleResetPassword 内部控制确认流程
 */
export default function UserActionSheet({
  open,
  onClose,
  selectedCount,
  onResetPassword,
  onBulkDelete,
}: UserActionSheetProps) {
  return (
    <IOSActionSheet
      open={open}
      onClose={onClose}
      title={`已选择 ${selectedCount} 个账号`}
      subtitle="可执行批量管理操作"
      actions={[
        {
          key: "reset",
          label: "密码初始化",
          icon: <LockOutlined />,
          type: "default",
          onClick: () => {
            onClose();
            onResetPassword();
          },
        },
        {
          key: "delete",
          label: "彻底删除账号",
          icon: <DeleteOutlined />,
          type: "danger",
          onClick: () => {
            onClose();
            onBulkDelete();
          },
        },
      ]}
    />
  );
}
