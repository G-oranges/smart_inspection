/**
 * DormFormModal.jsx - 新增宿舍弹窗
 * 
 * 支持桌面端 Modal 和移动端 Drawer 两种形态
 */
import { Modal, Drawer, Form, Input, Select, InputNumber, Space, Button } from "antd";
import PanelSelect from '../../../components/common/PanelSelect';
import type { FormInstance } from 'antd';

import { normalizeDormGender } from "../dormFilterSchema";
import type { DormFormPayload } from '../types';
import { MODAL_WIDTH } from "../../../components/common/modalSizes";

interface DormBuildingOption {
  value?: string;
  label?: string;
  campus?: string;
  floors?: number;
}

interface DormFormModalProps {
  open: boolean;
  onClose: () => void;
  form: FormInstance<DormFormPayload>;
  onSubmit: (payload: DormFormPayload) => void | Promise<void>;
  buildingOptions?: DormBuildingOption[];
  isMobile?: boolean;
}

/**
 * 新增宿舍弹窗/抽屉
 * @param {Object} props
 * @param {boolean} props.open - 是否打开
 * @param {Function} props.onClose - 关闭回调
 * @param {Object} props.form - Form 实例
 * @param {Function} props.onSubmit - 表单提交回调
 * @param {Array} props.buildingOptions - 楼栋选项
 * @param {boolean} props.isMobile - 是否移动端
 */
export default function DormFormModal({
  open,
  onClose,
  form,
  onSubmit,
  buildingOptions = [],
  isMobile = false,
}: DormFormModalProps) {
  const handleClose = () => {
    onClose();
    form.resetFields();
  };

  const handleFormSubmit = async (values: DormFormPayload) => {
    const payload: DormFormPayload = {
      campus: values.campus,
      building: values.building,
      floor: values.floor ? Number(values.floor) : undefined,
      roomNo: values.roomNo,
      capacity: values.capacity !== undefined && values.capacity !== null && values.capacity !== '' ? Number(values.capacity) : undefined,
      gender: normalizeDormGender(values.gender || ""),
      grade: values.grade,
    };
    await onSubmit(payload);
  };

  const formContent = (
    <Form
      form={form}
      layout="vertical"
      onFinish={handleFormSubmit}
      initialValues={{ gender: "未指定" }}
      className="apple-form"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
        <Form.Item name="campus" label="校区" rules={[{ required: true, message: '请输入校区' }]}>
          <Input className="apple-input" />
        </Form.Item>
        <Form.Item name="building" label="楼栋" rules={[{ required: true, message: '请选择楼栋' }]}>
          <PanelSelect 
            placeholder="请选择楼栋" 
            className="apple-select"
            classNames={{ popup: { root: "apple-dropdown" } }}
            onChange={(val) => {
              const found = buildingOptions.find((building) => building.value === val);
              if (found) form.setFieldsValue({ campus: found.campus });
            }}
            options={buildingOptions}
          />
        </Form.Item>
        <Form.Item dependencies={['building']} noStyle>
          {({ getFieldValue }) => {
            const selectedBuildingName = getFieldValue('building');
            const buildingInfo = buildingOptions.find((building) => building.value === selectedBuildingName);
            const maxFloor = buildingInfo ? buildingInfo.floors : 99;
            return (
              <Form.Item name="floor" label="楼层" rules={[{ required: true, message: "请输入楼层" }, { type: 'number', max: maxFloor, message: `该楼栋最高 ${maxFloor} 层` }]}>
                <InputNumber min={1} max={maxFloor} className="apple-input-number w-full" />
              </Form.Item>
            );
          }}
        </Form.Item>
        <Form.Item name="roomNo" label="房号" rules={[{ required: true, message: '请输入房号' }]}>
          <Input className="apple-input" />
        </Form.Item>
        <Form.Item name="capacity" label="可住人数">
          <InputNumber min={1} className="apple-input-number w-full" />
        </Form.Item>
        <Form.Item name="gender" label="宿舍性别">
          <PanelSelect className="apple-select" classNames={{ popup: { root: "apple-dropdown" } }}>
            <Select.Option value="未指定">未指定</Select.Option>
            <Select.Option value="男">男</Select.Option>
            <Select.Option value="女">女</Select.Option>
            <Select.Option value="混合">混合</Select.Option>
          </PanelSelect>
        </Form.Item>
        <Form.Item name="grade" label="适用年级" className="md:col-span-2">
          <Input className="apple-input" placeholder="例如：2023 级" />
        </Form.Item>
        <Form.Item name="remark" label="备注" className="md:col-span-2">
          <Input.TextArea rows={3} className="apple-input h-24 p-2" />
        </Form.Item>
      </div>
    </Form>
  );

  if (isMobile) {
    return (
      <Drawer
        title={<span className="text-lg font-bold">新增宿舍</span>}
        placement="bottom"
        onClose={handleClose}
        open={open}
        style={{ height: '80vh' }}
        extra={
          <Space>
            <Button className="apple-btn-secondary" onClick={handleClose}>取消</Button>
            <Button type="primary" className="apple-btn-primary" onClick={() => form.submit()}>新增宿舍</Button>
          </Space>
        }
        className="apple-drawer ios-action-sheet"
      >
        {formContent}
      </Drawer>
    );
  }

  return (
    <Modal
      open={open}
      title="新增宿舍"
      onCancel={handleClose}
      footer={
        <div className="co-modal-footer">
          <Button className="apple-btn-secondary" onClick={handleClose}>取消</Button>
          <Button type="primary" className="apple-btn-primary" onClick={() => form.submit()}>新增宿舍</Button>
        </div>
      }
      destroyOnHidden
      className="co-modal"
      centered
      width={MODAL_WIDTH.md}
    >
      {formContent}
    </Modal>
  );
}
