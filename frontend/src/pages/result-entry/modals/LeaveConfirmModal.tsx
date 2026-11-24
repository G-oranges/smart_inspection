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
      title="放弃未保存的修改吗？"
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
        离开后，你刚填写的评分、照片和备注都会丢失。
      </p>
    </Modal>
  );
}
