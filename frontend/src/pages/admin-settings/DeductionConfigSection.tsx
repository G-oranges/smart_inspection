import { Row, Col, Typography, Input, Switch, Button, Empty } from "antd";
import { PlusOutlined, TagOutlined, NumberOutlined, DeleteOutlined, ControlOutlined, DashboardOutlined } from "@ant-design/icons";

import type { DeductionItem } from '../../types/app';

const { Title, Text } = Typography;

interface DeductionConfigSectionProps {
  deductionItems: DeductionItem[];
  handleAddDeduction: () => void;
  handleDeductionChange: (
    index: number,
    field: keyof DeductionItem | 'maxPoints',
    value: unknown,
  ) => void;
  handleDeductionToggle: (index: number, checked: boolean) => void;
  handleRemoveDeduction: (index: number) => void;
}

export const DeductionConfigSection = ({ 
  deductionItems, 
  handleAddDeduction, 
  handleDeductionChange, 
  handleDeductionToggle, 
  handleRemoveDeduction 
}: DeductionConfigSectionProps) => {
  const readNonNegativeInteger = (value: string): string => value.replace(/[^\d]/g, '');

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <Text type="secondary" className="text-xs opacity-70">
          管理查寝录入页的扣分选项，从左到右依次是扣分项名称，扣分项代码，扣分值，扣分上限，是否启用，删除
        </Text>
        <Button 
          type="primary" 
          icon={<PlusOutlined />} 
          onClick={handleAddDeduction}
          className="apple-btn-primary dorm-toolbar-button dorm-toolbar-button-primary active:scale-95 transition-all border-none"
        >
          新增扣分项
        </Button>
      </div>

      {deductionItems.length === 0 && <Empty description="暂无扣分项" image={Empty.PRESENTED_IMAGE_SIMPLE} />}

      <div className="space-y-2">
        {deductionItems.map((item, index) => (
          <div 
            key={item.code || index} 
            className="deduction-item-row"
          >
            <Row gutter={12} align="middle">
              <Col span={7}>
                <Input
                  prefix={<TagOutlined style={{ color: 'var(--co-text-muted)', fontSize: '14px' }} />}
                  value={item.name || ""}
                  onChange={(e) => handleDeductionChange(index, "name", e.target.value)}
                  placeholder="项目名称"
                  className="apple-search-input h-10 !bg-gray-100/50 dark:!bg-white/5 border-none"
                />
              </Col>
              <Col span={5}>
                <Input
                  prefix={<NumberOutlined style={{ color: 'var(--co-text-muted)', fontSize: '14px' }} />}
                  value={item.code || ""}
                  onChange={(e) => handleDeductionChange(index, "code", e.target.value)}
                  placeholder="项目代码"
                  className="apple-search-input h-10 !bg-gray-100/50 dark:!bg-white/5 border-none"
                />
              </Col>
              <Col span={4}>
                <Input
                  prefix={<ControlOutlined style={{ color: 'var(--co-text-muted)', fontSize: '14px' }} />}
                  value={String(item.points ?? 0)}
                  onChange={(e) => {
                    const nextValue = readNonNegativeInteger(e.target.value);
                    handleDeductionChange(index, "points", nextValue === "" ? 0 : Number(nextValue));
                  }}
                  placeholder="分值"
                  inputMode="numeric"
                  className="apple-search-input h-10 !bg-gray-100/50 dark:!bg-white/5 border-none"
                />
              </Col>
              <Col span={4}>
                <Input
                  prefix={<DashboardOutlined style={{ color: 'var(--co-text-muted)', fontSize: '14px' }} />}
                  value={item.maxPoints ?? ""}
                  onChange={(e) => {
                    const nextValue = readNonNegativeInteger(e.target.value);
                    handleDeductionChange(
                      index,
                      "maxPoints",
                      nextValue === "" ? "" : Number(nextValue),
                    );
                  }}
                  placeholder="无限"
                  inputMode="numeric"
                  className="apple-search-input h-10 !bg-gray-100/50 dark:!bg-white/5 border-none"
                />
              </Col>
              <Col span={4} className="flex items-center justify-end gap-3 px-2">
                <Switch
                  size="small"
                  checked={item.enabled !== false}
                  onChange={(checked) => handleDeductionToggle(index, checked)}
                  className="apple-switch"
                />
                <Button 
                  type="text" 
                  danger 
                  icon={<DeleteOutlined />} 
                  onClick={() => handleRemoveDeduction(index)} 
                  className="co-press opacity-40 hover:opacity-100 transition-opacity"
                  size="small"
                />
              </Col>
            </Row>
          </div>
        ))}
      </div>
      
      <div>
        <Text type="secondary" style={{ fontSize: '11px' }}>
          提示：扣分上限为空时表示不限制该项单次录入总分。
        </Text>
      </div>
    </div>
  );
};
