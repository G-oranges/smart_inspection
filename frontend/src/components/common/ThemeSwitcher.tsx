import React from 'react';
import { Dropdown } from 'antd';
import { 
  SunOutlined, 
  MoonOutlined, 
  DesktopOutlined,
  CheckOutlined
} from '@ant-design/icons';
import { useAppContext } from '../../context/AppContext';
import type { MenuProps } from 'antd';
import type { ThemeMode } from '../../types/app';

const ThemeSwitcher = () => {
  const { themeMode, setThemeMode, activeTheme } = useAppContext();

  const items: Array<{ key: ThemeMode; label: string; icon: React.ReactNode }> = [
    {
      key: 'auto',
      label: '跟随系统',
      icon: <DesktopOutlined />,
    },
    {
      key: 'light',
      label: '浅色模式',
      icon: <SunOutlined />,
    },
    {
      key: 'dark',
      label: '深色模式',
      icon: <MoonOutlined />,
    },
  ];

  const menuItems: MenuProps['items'] = items.map((item) => ({
    ...item,
    className: themeMode === item.key ? 'apple-dropdown-item-active' : '',
    label: (
      <div className="flex items-center justify-between min-w-[120px]">
        <span>{item.label}</span>
        {themeMode === item.key && <CheckOutlined className="text-ios-blue text-[12px]" />}
      </div>
    )
  }));

  return (
    <Dropdown 
      menu={{ 
        items: menuItems, 
        onClick: ({ key }) => setThemeMode(key as ThemeMode) 
      }} 
      trigger={['click']} 
      placement="bottomRight"
      overlayClassName="apple-dropdown"
    >
      <div className="w-9 h-9 sm:w-8 sm:h-8 rounded-xl bg-black/[0.03] dark:bg-white/[0.05] flex items-center justify-center text-black/60 dark:text-white/60 hover:text-ios-blue hover:bg-ios-blue/5 dark:hover:bg-ios-blue/10 cursor-pointer transition-all active:scale-95">
        <span className="text-[18px] flex items-center justify-center">
          {activeTheme === 'dark' ? <MoonOutlined /> : <SunOutlined />}
        </span>
      </div>
    </Dropdown>
  );
};

export default ThemeSwitcher;

