/**
 * DormDetailModal.jsx - 宿舍详情弹窗
 */
import { Modal, Button, Descriptions } from "antd";

import type { DormRecord } from '../types';
import { MODAL_WIDTH } from "../../../components/common/modalSizes";

interface DormDetailModalProps {
  open: boolean;
  onClose: () => void;
  dorm: DormRecord | null;
  canEdit?: boolean;
  onEdit?: (dorm: DormRecord) => void;
}

/**
 * 宿舍详情弹窗
 * @param {Object} props
 * @param {boolean} props.open - 是否打开
 * @param {Function} props.onClose - 关闭回调
 * @param {Object} props.dorm - 宿舍数据
 * @param {boolean} props.canEdit - 是否有编辑权限
 * @param {Function} props.onEdit - 编辑回调
 */
export default function DormDetailModal({
  open,
  onClose,
  dorm,
  canEdit = false,
  onEdit,
}: DormDetailModalProps) {
  const handleClose = () => {
    onClose();
  };

  return (
    <Modal
      open={open}
      title="宿舍详情"
      onCancel={handleClose}
      footer={[
        <Button 
          key="close" 
          className="apple-btn-secondary"
          onClick={handleClose}
        >
          关闭
        </Button>,
        canEdit && dorm && (
          <Button 
            key="edit" 
            type="primary" 
            className="apple-btn-primary"
            onClick={() => {
              handleClose();
              onEdit?.(dorm);
            }}
          >
            编辑宿舍
          </Button>
        )
      ]}
      width={MODAL_WIDTH.md}
      className="co-modal"
      centered
    >
      {dorm && (
        <Descriptions bordered size="small" column={2}>
          <Descriptions.Item label="校区">{dorm.campus || '-'}</Descriptions.Item>
          <Descriptions.Item label="楼栋">{dorm.building || '-'}</Descriptions.Item>
          <Descriptions.Item label="楼层">{dorm.floor ? `${dorm.floor}层` : '-'}</Descriptions.Item>
          <Descriptions.Item label="房间号">{dorm.roomNo || '-'}</Descriptions.Item>
          <Descriptions.Item label="可住人数">{dorm.capacity || '-'}</Descriptions.Item>
          <Descriptions.Item label="已入住">{dorm.occupiedCount || 0}</Descriptions.Item>
          <Descriptions.Item label="性别">{dorm.gender || '-'}</Descriptions.Item>
          <Descriptions.Item label="年级">{dorm.grade || '-'}</Descriptions.Item>
          <Descriptions.Item label="寝室长" span={2}>{dorm.monitorName || '未设置'}</Descriptions.Item>
        </Descriptions>
      )}
    </Modal>
  );
}
