/**
 * 学生详情弹窗
 * @module pages/student/modals/StudentDetailModal
 */

import { Modal, Descriptions, Button } from "antd";

import type { StudentDetailModalProps } from "../types";

/**
 * 学生详情弹窗
 * @param {Object} props
 * @param {boolean} props.open - 是否打开
 * @param {Object} props.student - 学生数据
 * @param {boolean} props.canEdit - 是否有编辑权限
 * @param {Function} props.onClose - 关闭回调
 * @param {Function} props.onEdit - 编辑回调
 */
export default function StudentDetailModal({
  open,
  student,
  canEdit,
  onClose,
  onEdit,
}: StudentDetailModalProps) {
  return (
    <Modal
      open={open}
      title="学生详情"
      onCancel={onClose}
      footer={[
        <Button key="close" onClick={onClose}>
          关闭
        </Button>,
        canEdit && student && (
          <Button
            key="edit"
            type="primary"
            onClick={() => {
              onClose();
              onEdit(student);
            }}
          >
            编辑
          </Button>
        ),
      ]}
      width={700}
      className="glass-modal"
    >
      {student && (
        <Descriptions bordered size="small" column={2}>
          <Descriptions.Item label="学号">
            {student.studentNo || "-"}
          </Descriptions.Item>
          <Descriptions.Item label="姓名">
            {student.fullName || "-"}
          </Descriptions.Item>
          <Descriptions.Item label="性别">
            {student.gender || "-"}
          </Descriptions.Item>
          <Descriptions.Item label="年级">
            {student.grade || "-"}
          </Descriptions.Item>
          <Descriptions.Item label="培养层次">
            {student.educationLevel || "-"}
          </Descriptions.Item>
          <Descriptions.Item label="学籍状态">
            {student.status || "-"}
          </Descriptions.Item>
          <Descriptions.Item label="学院" span={2}>
            {student.college || "-"}
          </Descriptions.Item>
          <Descriptions.Item label="专业">
            {student.major || "-"}
          </Descriptions.Item>
          <Descriptions.Item label="班级">
            {student.className || "-"}
          </Descriptions.Item>
          <Descriptions.Item label="宿舍楼栋">
            {student.building || "-"}
          </Descriptions.Item>
          <Descriptions.Item label="房间号">
            {student.roomNo || "-"}
          </Descriptions.Item>
          <Descriptions.Item label="床位号">
            {student.bedNo || "-"}
          </Descriptions.Item>
          <Descriptions.Item label="是否寝室长">
            {student.isMonitor ? "是" : "否"}
          </Descriptions.Item>
          <Descriptions.Item label="手机号">
            {student.mobile || "-"}
          </Descriptions.Item>
          <Descriptions.Item label="QQ号">
            {student.qq || "-"}
          </Descriptions.Item>
          <Descriptions.Item label="民族">
            {student.ethnicity || "-"}
          </Descriptions.Item>
          <Descriptions.Item label="籍贯">
            {student.nativePlace || "-"}
          </Descriptions.Item>
          <Descriptions.Item label="政治面貌" span={2}>
            {student.politicalStatus || "-"}
          </Descriptions.Item>
          <Descriptions.Item label="家庭住址" span={2}>
            {student.homeAddress || "-"}
          </Descriptions.Item>
        </Descriptions>
      )}
    </Modal>
  );
}
