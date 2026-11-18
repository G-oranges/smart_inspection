/**
 * BuildingFormModal.jsx - 楼栋新增/编辑表单模态框
 * 
 * 支持桌面端 Modal 和移动端 Drawer 两种形态
 */
import {
  Modal,
  Drawer,
  Form,
  Input,
  InputNumber,
  Select,
  Switch,
  Button,
  Space,
  Row,
  Col,
} from "antd";
import PanelSelect from '../../../components/common/PanelSelect';
import type { FormInstance } from 'antd';

import { BUILDING_FORM_DEFAULTS, BUILDING_TYPE_OPTIONS } from "../buildingSchema";
import type { BuildingFormPayload } from '../types';

const { Option } = Select;

interface BuildingFormModalProps {
  open: boolean;
  onClose: () => void;
  onOk: () => void | Promise<void>;
  form: FormInstance<BuildingFormPayload>;
  isMobile: boolean;
  isEditing: boolean;
}

/**
 * 楼栋表单模态框
 * @param {Object} props
 * @param {boolean} props.open - 是否打开
 * @param {Function} props.onClose - 关闭回调
 * @param {Function} props.onOk - 确认回调
 * @param {Object} props.form - Form 实例
 * @param {boolean} props.isMobile - 是否移动端
 * @param {boolean} props.isEditing - 是否编辑模式
 */
export function BuildingFormModal({
  open,
  onClose,
  onOk,
  form,
  isMobile,
  isEditing,
}: BuildingFormModalProps) {
  const title = isEditing ? "编辑楼栋" : "新增楼栋";

  const formContent = (
    <Form
      form={form}
      layout="vertical"
      className="apple-form"
      initialValues={BUILDING_FORM_DEFAULTS}
    >
      <Form.Item
        name="name"
        label="楼栋名称"
        rules={[{ required: true, message: "请输入楼栋名称" }]}
      >
        <Input className="apple-input" placeholder="例如: 荟园1栋" />
      </Form.Item>

      {isMobile ? (
        <>
          <div className="grid grid-cols-2 gap-4">
            <Form.Item
              name="campus"
              label="校区"
              rules={[{ required: true, message: "请输入校区" }]}
            >
              <Input className="apple-input" placeholder="例如: 本部" />
            </Form.Item>
            <Form.Item name="type" label="类型" rules={[{ required: true }]}>
              <PanelSelect className="apple-select" classNames={{ popup: { root: "apple-dropdown" } }}>
                {BUILDING_TYPE_OPTIONS.map((opt) => (
                  <Option key={opt.value} value={opt.value}>
                    {opt.label}
                  </Option>
                ))}
              </PanelSelect>
            </Form.Item>
          </div>

          <div className="grid grid-cols-2 gap-4 items-end">
            <Form.Item
              name="floors"
              label="楼层数"
              rules={[{ required: true, message: "请输入楼层数" }]}
              className="mb-0"
            >
              <InputNumber min={1} max={50} className="apple-input-number w-full" />
            </Form.Item>
            <Form.Item name="hasElevator" label="是否有电梯" valuePropName="checked" className="mb-0">
              <Switch className="apple-switch" checkedChildren="有" unCheckedChildren="无" />
            </Form.Item>
          </div>

          <Form.Item name="contactInfo" label="联系方式" className="mt-4">
            <Input.TextArea rows={2} className="apple-input pt-2" placeholder="宿管员联系方式等" />
          </Form.Item>
        </>
      ) : (
        <>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="campus"
                label="校区"
                rules={[{ required: true, message: "请输入校区" }]}
              >
                <Input className="apple-input" placeholder="例如: 本部" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="type" label="类型" rules={[{ required: true }]}>
                <PanelSelect className="apple-select" classNames={{ popup: { root: "apple-dropdown" } }}>
                  {BUILDING_TYPE_OPTIONS.map((opt) => (
                    <Option key={opt.value} value={opt.value}>
                      {opt.label}
                    </Option>
                  ))}
                </PanelSelect>
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="floors"
                label="楼层数"
                rules={[{ required: true, message: "请输入楼层数" }]}
              >
                <InputNumber min={1} max={50} className="apple-input-number w-full" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="hasElevator" label="是否有电梯" valuePropName="checked">
                <Switch className="apple-switch" checkedChildren="有" unCheckedChildren="无" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="contactInfo" label="联系方式">
            <Input.TextArea rows={2} className="apple-input pt-2" placeholder="宿管员联系方式等" />
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
        className="apple-drawer ios-action-sheet"
        extra={
          <Space>
            <Button className="apple-btn-secondary" onClick={onClose}>
              取消
            </Button>
            <Button type="primary" className="apple-btn-primary" onClick={onOk}>
              提交
            </Button>
          </Space>
        }
      >
        {formContent}
      </Drawer>
    );
  }

  return (
    <Modal
      title={<span className="text-xl font-bold">{title}</span>}
      open={open}
      onOk={onOk}
      onCancel={onClose}
      forceRender
      className="apple-modal glass-modal"
      footer={[
        <Button key="cancel" className="apple-btn-secondary" onClick={onClose}>
          取消
        </Button>,
        <Button key="ok" type="primary" className="apple-btn-primary" onClick={onOk}>
          确认提交
        </Button>,
      ]}
    >
      {formContent}
    </Modal>
  );
}

export default BuildingFormModal;
