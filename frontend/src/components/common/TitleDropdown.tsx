import React, { useState } from 'react';
import { Dropdown } from 'antd';
import { DownOutlined, CheckOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import type { MenuProps } from 'antd';

interface TitleDropdownItem {
  key: string;
  label: string;
}

interface TitleDropdownProps {
  title: string;
  items?: TitleDropdownItem[];
  activeKey?: string;
  disabled?: boolean;
}

/**
 * iOS 风格标题下拉导航组件
 * 用于移动端二级页面切换，取代传统 Tab 栏
 * 
 * @param {string} title - 当前显示的标题
 * @param {Array} items - 下拉菜单项 [{ key: '/path', label: '名称' }, ...]
 * @param {string} activeKey - 当前激活的路径
 * @param {boolean} disabled - 是否禁用下拉（无子页面时）
 */
const TitleDropdown = ({
  title,
  items,
  activeKey,
  disabled = false,
}: TitleDropdownProps) => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  // 如果没有子页面或禁用，直接显示普通标题
  if (!items || items.length === 0 || disabled) {
    return (
      <h1 className="text-[17px] font-bold tracking-tight text-black dark:text-white text-center flex-1 truncate">
        {title}
      </h1>
    );
  }

  // 构建下拉菜单项
  const menuItems: MenuProps['items'] = items.map((item) => ({
    key: item.key,
    label: (
      <div className="flex items-center justify-between gap-3">
        <span>{item.label}</span>
        {activeKey?.startsWith(item.key) && (
          <CheckOutlined className="text-ios-blue text-[12px]" />
        )}
      </div>
    ),
    className: activeKey?.startsWith(item.key) ? 'ant-dropdown-menu-item-selected' : '',
  }));

  const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
    setOpen(false);
    navigate(String(key));
  };

  return (
    <Dropdown
      menu={{ 
        items: menuItems, 
        onClick: handleMenuClick,
        selectable: true,
        selectedKeys: activeKey ? [activeKey] : [],
      }}
      trigger={['click']}
      placement="bottom"
      open={open}
      onOpenChange={setOpen}
      overlayClassName="ios-title-dropdown"
      getPopupContainer={(trigger) => trigger.parentElement ?? trigger}
    >
      <div 
        className={`title-dropdown-trigger ${open ? 'title-dropdown-open' : ''}`}
        onClick={(e) => e.preventDefault()}
      >
        <span className="text-[17px] font-bold tracking-tight text-black dark:text-white truncate max-w-[180px]">
          {title}
        </span>
        <DownOutlined className="title-dropdown-arrow text-black/40 dark:text-white/40" />
      </div>
    </Dropdown>
  );
};

export default TitleDropdown;
