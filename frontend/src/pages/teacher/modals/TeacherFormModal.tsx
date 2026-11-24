/**
 * 教职工表单弹窗组件
 * @module pages/teacher/modals/TeacherFormModal
 */

import { Modal, Form, Input, Select, Drawer, Button } from "antd";
import PanelSelect from '../../../components/common/PanelSelect';

import type { FormInstance } from 'antd';
import type { EntityId } from '../../../types/service';
import type { TeacherFormValues } from '../types';
import { MODAL_WIDTH } from "../../../components/common/modalSizes";

interface TeacherFormModalProps {
  open: boolean;
  isMobile: boolean;
  editingId: EntityId | null;
  form: FormInstance<TeacherFormValues>;
  onClose: () => void;
  onSubmit: (values: TeacherFormValues) => void | Promise<void>;
}

/**
 * 教职工表单弹窗
 * @param {Object} props - 组件属性
 * @param {boolean} props.open - 是否打开
 * @param {boolean} props.isMobile - 是否移动端
 * @param {number|null} props.editingId - 编辑中的 ID（新增时为 null）
 * @param {Object} props.form - AntD Form 实例
 * @param {Function} props.onClose - 关闭回调
 * @param {Function} props.onSubmit - 提交回调
 */
export default function TeacherFormModal({
  open,
  isMobile,
  editingId,
  form,
  onClose,
  onSubmit,
}: TeacherFormModalProps) {
  const isEditing = editingId !== null;
  const title = isEditing ? "编辑教职工" : "新增教职工";

  const formContent = (
    <Form
      form={form}
      layout="vertical"
      onFinish={onSubmit}
      initialValues={{ gender: "男" }}
      className={isMobile ? "apple-form px-1" : "apple-form pt-4"}
    >
      {isMobile ? (
        // 移动端：单列布局
        <>
          <Form.Item
            name="employeeNo"
            label="工号"
            rules={[{ required: true, message: "请输入工号" }]}
          >
            <Input className="apple-input-ios" placeholder="如 T2024001" />
          </Form.Item>
          <Form.Item
            name="fullName"
            label="姓名"
            rules={[{ required: true, message: "请输入姓名" }]}
          >
            <Input className="apple-input-ios" />
          </Form.Item>
          <Form.Item name="gender" label="性别">
            <PanelSelect
              className="apple-select-ios"
              classNames={{ popup: { root: "apple-dropdown" } }}
            >
              <Select.Option value="男">男</Select.Option>
              <Select.Option value="女">女</Select.Option>
            </PanelSelect>
          </Form.Item>
          <Form.Item name="department" label="院系/部门">
            <Input className="apple-input-ios" placeholder="如 计算机学院" />
          </Form.Item>
          <Form.Item name="mobile" label="手机号">
            <Input className="apple-input-ios" placeholder="11 位手机号" />
          </Form.Item>
          <Form.Item name="classes" label="负责班级">
            <Input
              className="apple-input-ios"
              placeholder="如 软件 2201、软件 2202"
            />
          </Form.Item>
        </>
      ) : (
        // 桌面端：两列布局
        <>
          <div className="grid grid-cols-2 gap-x-6">
            <Form.Item
              name="employeeNo"
              label="工号"
              rules={[{ required: true, message: "请输入工号" }]}
            >
              <Input className="apple-input" placeholder="如 T2024001" />
            </Form.Item>
            <Form.Item
              name="fullName"
              label="姓名"
              rules={[{ required: true, message: "请输入姓名" }]}
            >
              <Input className="apple-input" />
            </Form.Item>
          </div>
          <div className="grid grid-cols-2 gap-x-6">
            <Form.Item name="gender" label="性别">
              <PanelSelect
                className="apple-select"
                classNames={{ popup: { root: "apple-dropdown" } }}
              >
                <Select.Option value="男">男</Select.Option>
                <Select.Option value="女">女</Select.Option>
              </PanelSelect>
            </Form.Item>
            <Form.Item name="mobile" label="手机号">
              <Input className="apple-input" placeholder="11 位手机号" />
            </Form.Item>
          </div>
          <Form.Item name="department" label="院系/部门">
            <Input className="apple-input" placeholder="如 计算机学院" />
          </Form.Item>
          <Form.Item name="classes" label="负责班级">
            <Input
              className="apple-input"
              placeholder="如 软件 2201、软件 2202，多个用逗号分隔"
            />
          </Form.Item>
        </>
      )}
    </Form>
  );

  if (isMobile) {
    return (
      <Drawer
        title={<span className="text-lg font-bold">{title}</span>}
        placement="bottom"
        onClose={onClose}
        open={open}
        style={{ height: "auto" }}
        styles={{ body: { paddingBottom: 80 } }}
        extra={
          <Button
            type="primary"
            className="apple-btn-primary"
            onClick={() => form.submit()}
          >
            {isEditing ? "保存修改" : "新增教职工"}
          </Button>
        }
        className="apple-drawer ios-inset-grouped-drawer"
      >
        {formContent}
      </Drawer>
    );
  }

  return (
    <Modal
      open={open}
      title={isEditing ? "编辑教职工" : "新增教职工"}
      onCancel={onClose}
      footer={
        <div className="co-modal-footer">
          <Button className="apple-btn-secondary" onClick={onClose}>
            取消
          </Button>
          <Button
            type="primary"
            className="apple-btn-primary"
            onClick={() => form.submit()}
          >
            {isEditing ? "保存修改" : "新增教职工"}
          </Button>
        </div>
      }
      width={MODAL_WIDTH.md}
      destroyOnHidden
      className="co-modal"
      centered
    >
      {formContent}
    </Modal>
  );
}
