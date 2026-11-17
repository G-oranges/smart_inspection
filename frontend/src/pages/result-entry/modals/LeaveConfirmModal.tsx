import { Button, Modal } from "antd";
import type { LeaveConfirmModalProps } from "../types";

export default function LeaveConfirmModal({
  open,
  onCancel,
  onConfirm,
}: LeaveConfirmModalProps) {
  return (
    <Modal
      open={open}
      title={<span className="text-lg font-bold">确认离开</span>}
      centered
      closable={false}
      maskClosable={false}
      className="ios-modal-custom"
      footer={[
        <Button
          key="cancel"
          size="large"
          className="rounded-xl"
          onClick={onCancel}
        >
          继续编辑
        </Button>,
        <Button
          key="confirm"
          type="primary"
          danger
          size="large"
          className="rounded-xl"
          onClick={onConfirm}
        >
          放弃更改
        </Button>,
      ]}
    >
      <p className="text-ios-gray-label py-4">
        您有未保存的扣分录入，离开后将丢失这些更改。
      </p>
    </Modal>
  );
}
