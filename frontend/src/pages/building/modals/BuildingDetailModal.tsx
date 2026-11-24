/**
 * BuildingDetailModal.jsx - 楼栋详情模态框
 * 
 * 展示楼栋详细信息
 */
import { Modal, Button, Descriptions } from "antd";

import type { BuildingRecord } from '../types';
import { MODAL_WIDTH } from "../../../components/common/modalSizes";

interface BuildingDetailModalProps {
  open: boolean;
  onClose: () => void;
  building: BuildingRecord | null;
  onEdit: (record: BuildingRecord) => void;
}

/**
 * 楼栋详情模态框
 * @param {Object} props
 * @param {boolean} props.open - 是否打开
 * @param {Function} props.onClose - 关闭回调
 * @param {Object} props.building - 楼栋数据
 * @param {Function} props.onEdit - 编辑回调
 */
export function BuildingDetailModal({
  open,
  onClose,
  building,
  onEdit,
}: BuildingDetailModalProps) {
  return (
    <Modal
      open={open}
      title="楼栋详情"
      onCancel={onClose}
      footer={[
        <Button key="close" onClick={onClose}>
          关闭
        </Button>,
        <Button
          key="edit"
          type="primary"
          onClick={() => {
            onClose();
            if (building) onEdit(building);
          }}
        >
          编辑
        </Button>,
      ]}
      centered
      width={MODAL_WIDTH.md}
      className="co-modal"
    >
      {building && (
        <Descriptions bordered size="small" column={2}>
          <Descriptions.Item label="楼栋名称" span={2}>
            {building.name}
          </Descriptions.Item>
          <Descriptions.Item label="校区">{building.campus}</Descriptions.Item>
          <Descriptions.Item label="类型">{building.type || "-"}</Descriptions.Item>
          <Descriptions.Item label="楼层数">{building.floors} 层</Descriptions.Item>
          <Descriptions.Item label="电梯">
            {building.hasElevator ? "有" : "无"}
          </Descriptions.Item>
          <Descriptions.Item label="关联宿舍" span={2}>
            {building.dormCount || 0} 间
          </Descriptions.Item>
          <Descriptions.Item label="联系方式" span={2}>
            {building.contactInfo || "-"}
          </Descriptions.Item>
        </Descriptions>
      )}
    </Modal>
  );
}

export default BuildingDetailModal;
