import { Button, Input, Modal } from "antd";
import type { ScoreEditModalProps } from "../types";
import { MODAL_WIDTH } from "../../../components/common/modalSizes";

export default function ScoreEditModal({
  open,
  baseScore,
  onChange,
  onClose,
}: ScoreEditModalProps) {
  return (
    <Modal
      open={open}
      title="基础分"
      onCancel={onClose}
      footer={[
        <Button key="ok" type="primary" className="apple-btn-primary" onClick={onClose}>
          确定
        </Button>,
      ]}
      centered
      width={MODAL_WIDTH.sm}
      className="co-modal"
    >
      <div>
        <Input
          type="tel"
          inputMode="numeric"
          value={baseScore}
          onChange={(event) => onChange(event.target.value)}
          className="text-center text-4xl font-bold bg-ios-gray/40 border-none rounded-2xl py-4 !text-black dark:!text-white"
          autoFocus
        />
      </div>
    </Modal>
  );
}
