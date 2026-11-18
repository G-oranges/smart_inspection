import { Row, Col, Typography, Space, Slider, Badge, Button } from "antd";
import { FontSizeOutlined } from "@ant-design/icons";

import type { Dispatch, SetStateAction } from 'react';

const { Title, Text } = Typography;

interface DisplayConfigSectionProps {
  fontSizeScale: number;
  setFontSizeScale: Dispatch<SetStateAction<number>>;
}

export const DisplayConfigSection = ({
  fontSizeScale,
  setFontSizeScale,
}: DisplayConfigSectionProps) => {
  return (
    <div className="space-y-4">
      <Row gutter={24} align="middle">
        <Col span={10}>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <FontSizeOutlined className="text-primary text-base" />
              <Text className="text-[13px] font-medium">全局字体缩放系数</Text>
            </div>
            <Text type="secondary" className="text-[11px] opacity-60">
              统一调整界面文字大小（0.8x - 1.2x）
            </Text>
          </div>
        </Col>
        <Col span={14}>
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <Slider 
                  min={0.8} 
                  max={1.2} 
                  step={0.05} 
                  value={fontSizeScale} 
                  onChange={setFontSizeScale}
                  className="apple-slider font-scale-slider m-0"
                  tooltip={{ open: false }}
                />
              </div>
              <div className="shrink-0 flex justify-end">
                 <span className="px-2 py-1 bg-primary/10 text-primary text-xs font-bold rounded-lg min-w-[50px] text-center">
                    {Math.round(fontSizeScale * 100)}%
                 </span>
              </div>
            </div>
            <div className="flex justify-end">
               <Button 
                onClick={() => setFontSizeScale(1.0)}
                disabled={fontSizeScale === 1.0}
                className="dorm-toolbar-button dorm-toolbar-button-subtle flex items-center justify-center active:scale-95 transition-all"
              >
                重置
              </Button>
            </div>
          </div>
        </Col>
      </Row>
      
      <div>
        <Text type="secondary" className="text-[11px] leading-relaxed">
          该修改即时生效并同步到本地存储。如果界面出现排版错乱，请尝试点击“重置”按钮恢复标准 100% 缩放系数。
        </Text>
      </div>
    </div>
  );
};
