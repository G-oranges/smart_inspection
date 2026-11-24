import { Typography, Input, Button, Empty } from "antd";
import { PlusOutlined, EnvironmentOutlined, DeleteOutlined } from "@ant-design/icons";

const { Text } = Typography;

interface LocationConfigSectionProps {
  locationOptions: string[];
  handleAddLocation: () => void;
  handleLocationChange: (index: number, value: string) => void;
  handleRemoveLocation: (index: number) => void;
}

export const LocationConfigSection = ({
  locationOptions,
  handleAddLocation,
  handleLocationChange,
  handleRemoveLocation,
}: LocationConfigSectionProps) => {
  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <Text type="secondary" className="text-xs opacity-70">
          将作为快捷标签显示在查寝录入页，建议保留 8–12 项。
        </Text>
        <Button 
          type="primary" 
          icon={<PlusOutlined />} 
          onClick={handleAddLocation}
          className="apple-btn-primary dorm-toolbar-button dorm-toolbar-button-primary active:scale-95 transition-all border-none"
        >
          新增位置
        </Button>
      </div>

      {locationOptions.length === 0 && <Empty description="暂无预设位置" image={Empty.PRESENTED_IMAGE_SIMPLE} />}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {locationOptions.map((loc, index) => (
          <div key={index} className="group relative">
            <Input
              prefix={<EnvironmentOutlined className="text-co-muted text-xs group-focus-within:text-primary transition-colors" />}
              value={loc}
              onChange={(e) => handleLocationChange(index, e.target.value)}
              placeholder="位置名称"
              className="apple-search-input h-10 !bg-gray-100/50 dark:!bg-white/5 border-none"
              suffix={
                <Button 
                  type="text" 
                  danger 
                  size="small"
                  icon={<DeleteOutlined className="text-xs" />} 
                  onClick={() => handleRemoveLocation(index)}
                  className="opacity-0 group-hover:opacity-60 hover:opacity-100 transition-opacity"
                />
              }
            />
          </div>
        ))}
      </div>
    </div>
  );
};
