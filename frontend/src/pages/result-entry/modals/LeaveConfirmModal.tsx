import { Button, Modal } from "antd";
import type { LeaveConfirmModalProps } from "../types";
import { MODAL_WIDTH } from "../../../components/common/modalSizes";

export default function LeaveConfirmModal({
  open,
  onCancel,
  onConfirm,
}: LeaveConfirmModalProps) {
  return (
    <Modal
      open={open}
      title="确认离开"
      centered
      closable={false}
      maskClosable={false}
      width={MODAL_WIDTH.sm}
      className="co-modal"
      footer={[
        <Button key="cancel" className="apple-btn-secondary" onClick={onCancel}>
          继续编辑
        </Button>,
        <Button key="confirm" type="primary" danger onClick={onConfirm}>
          放弃更改
        </Button>,
      ]}
    >
      <p className="m-0">
        您有未保存的扣分录入，离开后将丢失这些更改。
      </p>
    </Modal>
  );
}
