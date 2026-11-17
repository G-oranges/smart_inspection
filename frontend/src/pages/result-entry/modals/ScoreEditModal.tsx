import { Button, Input, Modal } from "antd";
import type { ScoreEditModalProps } from "../types";

export default function ScoreEditModal({
  open,
  baseScore,
  onChange,
  onClose,
}: ScoreEditModalProps) {
  return (
    <Modal
      open={open}
      title={<span className="text-lg font-black tracking-tight">输入基础分</span>}
      onCancel={onClose}
      footer={[
        <Button
          key="ok"
          type="primary"
          shape="round"
          block
          size="large"
          onClick={onClose}
          className="bg-ios-blue"
        >
          确定
        </Button>,
      ]}
      centered
      width={300}
      className="ios-modal-custom"
    >
      <div className="py-6">
        <Input
          type="tel"
          inputMode="numeric"
          value={baseScore}
          onChange={(event) => onChange(event.target.value)}
          className="text-center text-4xl font-black bg-ios-gray/40 border-none rounded-2xl py-4 !text-black dark:!text-white"
          autoFocus
        />
      </div>
    </Modal>
  );
}
