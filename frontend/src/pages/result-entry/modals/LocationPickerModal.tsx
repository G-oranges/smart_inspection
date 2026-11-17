import { Button, Modal, Tag } from "antd";
import type { LocationPickerModalProps } from "../types";

export default function LocationPickerModal({
  open,
  locations,
  currentEditingRowId,
  appliedDeductions,
  onToggleLocation,
  onClose,
}: LocationPickerModalProps) {
  return (
    <Modal
      open={open}
      title={<span className="text-lg font-black tracking-tight">选择发现位置</span>}
      onCancel={onClose}
      footer={[
        <Button
          key="done"
          type="primary"
          shape="round"
          block
          size="large"
          onClick={onClose}
          className="h-12 bg-ios-blue font-bold"
        >
          完成
        </Button>,
      ]}
      centered
      className="ios-modal-custom"
    >
      <div className="flex flex-wrap gap-2.5 py-4">
        {locations.map((loc) => {
          const currentRow = appliedDeductions.find(
            (r) => r.id === currentEditingRowId
          );
          const isSelected = Boolean(currentRow?.locations?.includes(loc));
          return (
            <Tag.CheckableTag
              key={loc}
              checked={isSelected}
              onChange={() => onToggleLocation(currentEditingRowId, loc)}
              className={`ios-checkable-tag ${isSelected ? "selected" : ""}`}
            >
              {loc}
            </Tag.CheckableTag>
          );
        })}
      </div>
    </Modal>
  );
}
