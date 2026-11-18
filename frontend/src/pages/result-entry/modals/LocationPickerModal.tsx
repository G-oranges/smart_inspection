import { Button, Modal, Tag } from "antd";
import type { LocationPickerModalProps } from "../types";
import { MODAL_WIDTH } from "../../../components/common/modalSizes";

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
      title="选择发现位置"
      onCancel={onClose}
      footer={[
        <Button key="done" type="primary" className="apple-btn-primary" onClick={onClose}>
          完成
        </Button>,
      ]}
      centered
      width={MODAL_WIDTH.md}
      className="co-modal"
    >
      <div className="flex flex-wrap gap-2.5">
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
