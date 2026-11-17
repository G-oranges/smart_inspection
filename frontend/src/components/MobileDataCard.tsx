import React from 'react';
import { Card, Checkbox, Dropdown, Button, Space } from 'antd';
import { MoreOutlined } from '@ant-design/icons';
import type { CSSProperties, MouseEvent, ReactNode } from 'react';
import type { MenuProps } from 'antd';

export interface MobileDataField {
  label: ReactNode;
  value?: ReactNode;
  render?: (value: ReactNode) => ReactNode;
  span?: number;
  layout?: 'column' | 'row';
}

export interface MobileDataCardActions {
  items?: NonNullable<MenuProps['items']>;
  onClick?: MenuProps['onClick'];
}

export interface MobileDataCardProps {
  fields?: MobileDataField[];
  actions?: MobileDataCardActions;
  selected?: boolean;
  compact?: boolean;
  onSelect?: (selected: boolean) => void;
  title?: ReactNode;
  subtitle?: ReactNode;
  extra?: ReactNode;
  onClick?: () => void;
  className?: string;
  style?: CSSProperties;
}

/**
 * 移动端数据卡片组件 (Premium Glass 2.0 版)
 * @param {Object} props
 * @param {Array} props.fields - 字段配置 [{ label, value, render?, span?, layout? }]
 * @param {Object} props.actions - 操作菜单配置 { items: [...], onClick }
 * @param {boolean} props.selected - 是否选中
 * @param {boolean} props.compact - 是否开启紧凑模式 (默认 true)
 * @param {Function} props.onSelect - 选中回调
 * @param {React.ReactNode} props.title - 卡片标题
 * @param {React.ReactNode} props.subtitle - 卡片副标题
 * @param {React.ReactNode} props.extra - 额外内容（如状态标签）
 * @param {Function} props.onClick - 卡片点击回调
 */
export default function MobileDataCard({
  fields = [],
  actions,
  selected,
  compact = true,
  onSelect,
  title,
  subtitle,
  extra,
  onClick,
  className = '',
  style = {},
}: MobileDataCardProps) {
  const handleCardClick = (e: MouseEvent<HTMLDivElement>) => {
    // 如果点击的是特定功能按钮，不触发卡片点击逻辑
    const target = e.target as HTMLElement;
    if (target.closest('.card-actions') || target.closest('.ant-checkbox-wrapper')) {
      return;
    }
    
    // 如果有 onSelect，默认点击行为就是切换选中
    if (onSelect) {
      onSelect(!selected);
    }
    
    onClick?.();
  };

  return (
    <Card
      className={`mobile-compact-card hover-lift ${selected ? 'selected' : ''} ${className}`}
      style={style}
      onClick={handleCardClick}
      size="small"
      variant="borderless"
    >
      {/* 卡片头部 - 响应式排版 */}
      <div className="compact-card-header">
        <div className="compact-header-left">
          {onSelect && (
            <div className="compact-checkbox" onClick={(e) => e.stopPropagation()}>
              <Checkbox
                checked={selected}
                onChange={(e) => onSelect(e.target.checked)}
              />
            </div>
          )}
          <div className="compact-title-group">
            {title && <div className="compact-title">{title}</div>}
            {subtitle && <div className="compact-subtitle">{subtitle}</div>}
          </div>
        </div>
        <div className="compact-header-right">
          <Space size={8}>
            {extra}
            {actions && actions.items && actions.items.length > 0 && (
              <Dropdown
                menu={{
                  items: actions.items,
                  onClick: actions.onClick,
                }}
                trigger={['click']}
                placement="bottomRight"
              >
                <Button
                  type="text"
                  shape="circle"
                  icon={<MoreOutlined />}
                  className="card-actions"
                  onClick={(e) => e.stopPropagation()}
                />
              </Dropdown>
            )}
          </Space>
        </div>
      </div>

      {/* 卡片主体 - 高密度网格布局 */}
      {fields.length > 0 && (
        <div className={`compact-card-grid ${compact ? 'dense' : ''}`}>
          {fields.map((field, index) => {
            const isFullWidth = field.span === 2 || (typeof field.value === 'string' && field.value.length > 15);
            const layoutMode = field.layout || 'column'; // 默认上下布局，可选 'row'

            return (
              <div 
                key={index} 
                className={`compact-info-item ${isFullWidth ? 'full-row' : ''} layout-${layoutMode}`}
              >
                <span className="compact-label">{field.label}</span>
                <span className="compact-value">
                  {field.render ? field.render(field.value) : (field.value ?? '-')}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

