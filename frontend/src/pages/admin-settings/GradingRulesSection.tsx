import { Row, Col, Typography, Input, InputNumber } from "antd";
import { TagOutlined } from "@ant-design/icons";

import type { GradingRule } from '../../types/app';

const { Title, Text } = Typography;

interface GradingRulesSectionProps {
  gradeRules: GradingRule[];
  handleLabelChange: (index: number, label: string) => void;
  handleRuleChange: (
    index: number,
    field: 'min' | 'max',
    value: number | string | null | undefined,
  ) => void;
}

export const GradingRulesSection = ({
  gradeRules,
  handleLabelChange,
  handleRuleChange,
}: GradingRulesSectionProps) => {
  return (
    <div className="space-y-0">
      {gradeRules.map((rule, index) => (
        <div key={index} className="grading-rule-row">
          <Row gutter={16} align="middle">
            <Col span={8}>
              <div style={{ marginBottom: 6 }}><Text type="secondary" className="text-xs uppercase tracking-wider">等级标签</Text></div>
              <Input 
                prefix={<TagOutlined style={{ color: 'var(--co-text-muted)', fontSize: '12px' }} />} 
                value={rule.label || ""} 
                onChange={(e) => handleLabelChange(index, e.target.value)} 
                placeholder="例如：优秀"
                className="apple-search-input h-10 !bg-gray-100/50 dark:!bg-white/5 border-none"
              />
            </Col>
            <Col span={8}>
              <div style={{ marginBottom: 6 }}><Text type="secondary" className="text-xs uppercase tracking-wider">起始分</Text></div>
              <InputNumber 
                style={{ width: '100%' }}
                min={0} max={100}
                value={rule.min} 
                onChange={(val) => handleRuleChange(index, "min", val)} 
                placeholder="0"
                className="apple-input-number h-10 leading-10 !bg-gray-100/50 dark:!bg-white/5 border-none"
              />
            </Col>
            <Col span={8}>
              <div style={{ marginBottom: 6 }}><Text type="secondary" className="text-xs uppercase tracking-wider">结束分</Text></div>
              <InputNumber 
                style={{ width: '100%' }}
                min={0} max={100}
                value={rule.max} 
                onChange={(val) => handleRuleChange(index, "max", val)} 
                placeholder="100"
                className="apple-input-number h-10 leading-10 !bg-gray-100/50 dark:!bg-white/5 border-none"
              />
            </Col>
          </Row>
        </div>
      ))}
      <div>
        <Text type="secondary" style={{ fontSize: '11px' }} className="leading-relaxed">
          说明：区间按从低到高顺序配置，建议覆盖 0-100 全区间。分值判断逻辑为：[起始分, 结束分]。
        </Text>
      </div>
    </div>
  );
};
