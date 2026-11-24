/**
 * 学生新增/编辑表单弹窗
 * @module pages/student/modals/StudentFormModal
 */

import {
  Modal,
  Drawer,
  Form,
  Input,
  Select,
  Switch,
  Button,
  Space,
} from "antd";
import PanelSelect from '../../../components/common/PanelSelect';

import type { StudentFormModalProps } from "../types";
import { MODAL_WIDTH } from "../../../components/common/modalSizes";

/**
 * 学生表单弹窗（响应式：桌面用 Modal，移动端用 Drawer）
 * @param {Object} props
 * @param {boolean} props.open - 是否打开
 * @param {boolean} props.isMobile - 是否移动端
 * @param {boolean} props.isEditing - 是否编辑模式
 * @param {Object} props.form - 表单数据
 * @param {Function} props.setForm - 设置表单数据
 * @param {Function} props.onClose - 关闭回调
 * @param {Function} props.onSubmit - 提交回调
 */
export default function StudentFormModal({
  open,
  isMobile,
  isEditing,
  form,
  setForm,
  onClose,
  onSubmit,
}: StudentFormModalProps) {
  const title = (
    <span className="text-lg font-bold">
      {isEditing ? "编辑学生" : "新增学生"}
    </span>
  );

  const formContent = (
    <Form layout="vertical" className="apple-form apple-form-compact">
      <div className={`grid ${isMobile ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2 compact-grid'} gap-x-4`}>
        {/* 核心必填字段 */}
        <Form.Item label="学号" required>
          <Input
            className="apple-input"
            placeholder="如 20240001"
            value={form.studentNo}
            onChange={(e) =>
              setForm({ ...form, studentNo: e.target.value })
            }
          />
        </Form.Item>
        <Form.Item label="姓名" required>
          <Input
            className="apple-input"
            value={form.fullName}
            onChange={(e) =>
              setForm({ ...form, fullName: e.target.value })
            }
          />
        </Form.Item>
        <Form.Item label="年级">
          <Input
            className="apple-input"
            placeholder="如 2024"
            value={form.grade}
            onChange={(e) => setForm({ ...form, grade: e.target.value })}
          />
        </Form.Item>
        <Form.Item label="性别">
          <PanelSelect
            className="apple-select"
            size="middle"
            classNames={{ popup: { root: "apple-dropdown" } }}
            placeholder="请选择"
            value={form.gender}
            onChange={(val) => setForm({ ...form, gender: val })}
          >
            <Select.Option value="男">男</Select.Option>
            <Select.Option value="女">女</Select.Option>
            <Select.Option value="未指定">未指定</Select.Option>
          </PanelSelect>
        </Form.Item>
        {/* 学籍/院系信息 */}
        <Form.Item label="培养层次">
          <Input
            className="apple-input"
            placeholder="如 本科/硕士"
            value={form.educationLevel}
            onChange={(e) =>
              setForm({ ...form, educationLevel: e.target.value })
            }
          />
        </Form.Item>
        <Form.Item label="学院">
          <Input
            className="apple-input"
            value={form.college}
            onChange={(e) =>
              setForm({ ...form, college: e.target.value })
            }
          />
        </Form.Item>
        <Form.Item label="专业">
          <Input
            className="apple-input"
            value={form.major}
            onChange={(e) => setForm({ ...form, major: e.target.value })}
          />
        </Form.Item>
        <Form.Item label="班级">
          <Input
            className="apple-input"
            placeholder="如 计科 2401"
            value={form.className}
            onChange={(e) =>
              setForm({ ...form, className: e.target.value })
            }
          />
        </Form.Item>
        <Form.Item label="学籍状态">
          <Input
            className="apple-input"
            placeholder="如 在读/休学"
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
          />
        </Form.Item>
        {/* 联系信息 */}
        <Form.Item label="手机号">
          <Input
            className="apple-input"
            placeholder="11 位手机号"
            value={form.mobile}
            onChange={(e) => setForm({ ...form, mobile: e.target.value })}
          />
        </Form.Item>
        <Form.Item label="QQ 号">
          <Input
            className="apple-input"
            value={form.qq}
            onChange={(e) => setForm({ ...form, qq: e.target.value })}
          />
        </Form.Item>
        <Form.Item label="民族">
          <Input
            className="apple-input"
            placeholder="如 汉族"
            value={form.ethnicity}
            onChange={(e) =>
              setForm({ ...form, ethnicity: e.target.value })
            }
          />
        </Form.Item>
        {/* 背景信息 */}
        <Form.Item label="籍贯">
          <Input
            className="apple-input"
            placeholder="省/市"
            value={form.nativePlace}
            onChange={(e) =>
              setForm({ ...form, nativePlace: e.target.value })
            }
          />
        </Form.Item>
        <Form.Item label="生源地">
          <Input
            className="apple-input"
            placeholder="省/市"
            value={form.sourcePlace}
            onChange={(e) =>
              setForm({ ...form, sourcePlace: e.target.value })
            }
          />
        </Form.Item>
        {/* 家庭住址 + 是否寝室长 */}
        <Form.Item label="家庭住址">
          <Input
            className="apple-input"
            placeholder="省/市/详细地址"
            value={form.homeAddress}
            onChange={(e) =>
              setForm({ ...form, homeAddress: e.target.value })
            }
          />
        </Form.Item>
        <Form.Item label="是否寝室长" className="form-item-inline-switch">
          <Switch
            className="apple-switch"
            checked={form.isMonitor}
            onChange={(checked) =>
              setForm({ ...form, isMonitor: checked })
            }
          />
        </Form.Item>
      </div>
    </Form>
  );

  if (isMobile) {
    return (
      <Drawer
        title={title}
        placement="bottom"
        onClose={onClose}
        open={open}
        style={{ height: "85vh" }}
        extra={
          <Space>
            <Button className="apple-btn-secondary" onClick={onClose}>
              取消
            </Button>
            <Button
              type="primary"
              className="apple-btn-primary"
              onClick={onSubmit}
            >
              {isEditing ? "保存修改" : "新增学生"}
            </Button>
          </Space>
        }
        className="apple-drawer ios-action-sheet"
        styles={{ body: { padding: '12px 16px' } }}
      >
        {formContent}
      </Drawer>
    );
  }

  return (
    <Modal
      open={open}
      title={title}
      onCancel={onClose}
      footer={
        <div className="co-modal-footer">
          <Button className="apple-btn-secondary" onClick={onClose}>
            取消
          </Button>
          <Button
            type="primary"
            className="apple-btn-primary"
            onClick={onSubmit}
          >
            {isEditing ? "保存修改" : "新增学生"}
          </Button>
        </div>
      }
      destroyOnHidden
      className="co-modal"
      centered
      width={MODAL_WIDTH.lg}
    >
      {formContent}
    </Modal>
  );
}
