import { Button, Drawer, InputNumber, Select, Tag } from 'antd';
import { CloseOutlined } from '@ant-design/icons';

import { DEFAULT_LOCATION_OPTIONS } from '../resultEntrySchema';
import type { DeductionDrawerProps } from '../types';

export default function DeductionDrawer({
  open,
  onClose,
  newDeductionForm,
  setNewDeductionForm,
  enabledDeductions,
  appliedDeductions,
  settings,
  onToggleLocation,
  onConfirm,
}: DeductionDrawerProps) {
  const locationOptions = (
    Array.isArray(settings?.locationOptions) && settings.locationOptions.length > 0
      ? settings.locationOptions
      : DEFAULT_LOCATION_OPTIONS
  ).filter((location): location is string => typeof location === 'string');

  return (
    <Drawer
      open={open}
      onClose={onClose}
      placement="bottom"
      height="auto"
      closable={false}
      className="ios-drawer-rounded"
      styles={{
        body: { padding: 0 },
        wrapper: { borderRadius: '20px 20px 0 0', overflow: 'hidden' },
      }}
    >
      <div className="bg-white dark:bg-zinc-900 rounded-t-[20px] overflow-hidden">
        <div className="flex justify-center py-3">
          <div className="w-10 h-1 bg-ios-gray/40 rounded-full" />
        </div>

        <div className="px-4 pb-4 flex items-center justify-between border-b border-ios-divider">
          <span className="text-lg font-bold text-black dark:text-white">
            违规详情
          </span>
          <Button
            type="text"
            icon={<CloseOutlined />}
            onClick={onClose}
            className="text-ios-gray-label"
          />
        </div>

        <div className="p-4 space-y-5">
          <div>
            <label className="text-[11px] font-bold text-ios-gray-label uppercase tracking-widest mb-2 block">
              类型
            </label>
            <Select
              value={newDeductionForm.code || undefined}
              placeholder="请选择类型"
              className="w-full"
              size="large"
              onChange={(value) => {
                setNewDeductionForm((prev) => ({ ...prev, code: value }));
              }}
              options={enabledDeductions
                .filter((option) => {
                  if (newDeductionForm.id && option.code === newDeductionForm.code) {
                    return true;
                  }
                  return !appliedDeductions.some((item) => item.code === option.code);
                })
                .map((option) => ({
                  value: option.code,
                  label: `${option.name} (-${option.points}分)`,
                }))}
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-ios-gray-label uppercase tracking-widest mb-2 block">
              次数
            </label>
            <div className="flex items-center gap-3">
              <InputNumber
                value={newDeductionForm.count}
                min={1}
                max={10}
                size="large"
                className="flex-1 text-center"
                onChange={(value) =>
                  setNewDeductionForm((prev) => ({
                    ...prev,
                    count: value || 1,
                  }))
                }
              />
              <span className="text-ios-gray-label">次</span>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold text-ios-gray-label uppercase tracking-widest mb-2 block">
              位置
            </label>
            <div className="flex flex-wrap gap-2">
              {locationOptions.map((location) => (
                <Tag
                  key={location}
                  className={`cursor-pointer px-3 py-1.5 rounded-full text-[13px] font-medium transition-all ${
                    newDeductionForm.locations.includes(location)
                      ? 'bg-ios-blue text-white border-ios-blue'
                      : 'bg-ios-gray/20 text-black dark:text-white border-transparent hover:bg-ios-gray/30'
                  }`}
                  onClick={() => onToggleLocation(location)}
                >
                  {location}
                </Tag>
              ))}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-ios-divider flex gap-3 pb-8">
          <Button
            size="large"
            className="flex-1 h-12 rounded-2xl font-bold"
            onClick={onClose}
          >
            取消
          </Button>
          <Button
            type="primary"
            size="large"
            className="flex-1 h-12 rounded-2xl font-bold bg-ios-blue"
            onClick={onConfirm}
            disabled={!newDeductionForm.code}
          >
            {newDeductionForm.id ? '保存修改' : '添加项目'}
          </Button>
        </div>
      </div>
    </Drawer>
  );
}
