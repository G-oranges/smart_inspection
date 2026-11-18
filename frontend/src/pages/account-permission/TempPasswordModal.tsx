/**
 * 账号与权限管理模块 - 临时密码弹窗
 * @module pages/account-permission/TempPasswordModal
 */

import { Modal, Button } from 'antd';
import { MODAL_WIDTH } from "../../components/common/modalSizes";

interface TempPasswordModalProps {
  visible: boolean;
  username: string;
  password: string;
  onClose: () => void;
  onCopySuccess?: () => void;
}

/**
 * 临时密码弹窗组件
 */
export default function TempPasswordModal({
  visible,
  username,
  password,
  onClose,
  onCopySuccess,
}: TempPasswordModalProps) {
  return (
    <Modal
      title="临时密码"
      open={visible}
      onOk={onClose}
      onCancel={onClose}
      centered
      width={MODAL_WIDTH.sm}
      className="co-modal"
      footer={[
        <Button
          key="copy"
          onClick={() => {
            navigator.clipboard.writeText(password);
            onCopySuccess?.();
          }}
        >
          复制密码
        </Button>,
        <Button
          key="close"
          type="primary"
          onClick={onClose}
        >
          关闭
        </Button>,
      ]}
    >
      <div style={{ padding: "20px 0", textAlign: "center" }}>
        <p>
          用户 <strong>{username}</strong> 的临时密码为：
        </p>
        <div
          style={{
            fontSize: "24px",
            fontWeight: 600,
            color: "var(--co-primary)",
            margin: "20px 0",
            padding: "10px",
            background: "var(--info-bg)",
            borderRadius: "8px",
            fontFamily: "monospace",
          }}
        >
          {password}
        </div>
        <p style={{ color: "var(--co-error)" }}>
          该密码有效期为 12 小时，仅可使用一次，请尽快告知用户。
        </p>
      </div>
    </Modal>
  );
}
