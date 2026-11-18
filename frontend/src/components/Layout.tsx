import { useState, useMemo, useEffect, useCallback } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { Layout as AntLayout, Menu, Dropdown, Space, Button, message, Drawer, Modal, Form, Input } from 'antd';
import type { MenuProps } from 'antd';
import {
  DownOutlined,
  DashboardOutlined,
  HomeOutlined,
  TeamOutlined,
  UserOutlined,
  EditOutlined,
  EyeOutlined,
  SettingOutlined,
  FileTextOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  LogoutOutlined,
  SafetyOutlined,
  DatabaseOutlined,
  ScheduleOutlined,
  KeyOutlined,
} from '@ant-design/icons';
import { Switch } from "antd";
import { SunOutlined, MoonOutlined } from "@ant-design/icons";
import type { RoleLike } from '../types/app';
import { MODAL_WIDTH } from "./common/modalSizes";

const { Header, Sider, Content } = AntLayout;
type MenuItem = Required<MenuProps>['items'][number];
type MenuClickInfo = Parameters<NonNullable<MenuProps['onClick']>>[0];

interface NavChildItem {
  key: string;
  label: string;
  permission?: string | string[];
  roleExclude?: string[];
  icon?: JSX.Element;
  matchPrefix?: boolean;
  exactMatch?: boolean;
}

interface NavMenuGroup {
  key: string;
  label: string;
  icon: JSX.Element;
  children: NavChildItem[];
}

interface NavItem {
  key: string;
  label: string;
  icon: JSX.Element;
}

// 子菜单键常量
const SUBMENU_KEYS = {
  DATA: 'sub-data',
  INSPECTION: 'sub-inspection',
  SYSTEM: 'sub-system',
};

// 导航配置 - 二级菜单结构
const NAV_CONFIG: {
  dashboard: NavItem;
  dataSubMenu: NavMenuGroup;
  inspectionSubMenu: NavMenuGroup;
  systemSubMenu: NavMenuGroup;
} = {
  // 仪表盘 - 顶级项
  dashboard: {
    key: '/dashboard',
    label: '仪表盘',
    icon: <DashboardOutlined />,
  },
  // 基础数据管理 - 子菜单
  dataSubMenu: {
    key: SUBMENU_KEYS.DATA,
    label: '基础数据',
    icon: <DatabaseOutlined />,
    children: [
      { key: '/buildings', label: '楼栋管理', permission: 'SYSTEM_SETTINGS' },
      { key: '/dorms', label: '宿舍管理', permission: 'DORM_VIEW', roleExclude: ['LEADER'] },
      { key: '/occupancy', label: '入住管理', permission: 'DORM_VIEW', icon: <KeyOutlined /> },
      { key: '/students', label: '学生管理', permission: 'STUDENT_VIEW' },
      { key: '/teachers', label: '教工管理', permission: 'TEACHER_MANAGE' },
    ],
  },
  // 宿舍检查 - 子菜单
  inspectionSubMenu: {
    key: SUBMENU_KEYS.INSPECTION,
    label: '宿舍检查',
    icon: <ScheduleOutlined />,
    children: [
      { key: '/tasks/publish', label: '查寝任务发布', permission: 'TASK_PUBLISH' },
      { key: '/tasks/entry', label: '查寝分数录入', permission: 'RESULT_RECORD', matchPrefix: true },
      { key: '/results', label: '查寝结果查看', permission: 'RESULT_VIEW' },
    ],
  },
  // 系统设置 - 子菜单
  systemSubMenu: {
    key: SUBMENU_KEYS.SYSTEM,
    label: '系统设置',
    icon: <SettingOutlined />,
    children: [
      { key: '/accounts', label: '账号与权限管理', permission: ['PERMISSION_MANAGE', 'USER_MANAGE'] },
      { key: '/settings', label: '管理员设置', permission: 'SYSTEM_SETTINGS', exactMatch: true },
      { key: '/audit-logs', label: '审计日志', permission: 'PERMISSION_MANAGE' },
    ],
  },
};

// 路径到子菜单键的映射（用于自动展开）
const PATH_TO_SUBMENU: Record<string, string> = {
  '/occupancy': SUBMENU_KEYS.DATA,
  '/dorms': SUBMENU_KEYS.DATA,
  '/buildings': SUBMENU_KEYS.DATA,
  '/students': SUBMENU_KEYS.DATA,
  '/teachers': SUBMENU_KEYS.DATA,
  '/tasks/publish': SUBMENU_KEYS.INSPECTION,
  '/tasks/entry': SUBMENU_KEYS.INSPECTION,
  '/results': SUBMENU_KEYS.INSPECTION,
  '/accounts': SUBMENU_KEYS.SYSTEM,
  '/settings': SUBMENU_KEYS.SYSTEM,
  '/audit-logs': SUBMENU_KEYS.SYSTEM,
};


export default function Layout() {
  const {
    user,
    onLogout,
    hasPermission,
    activeRole,
    setActiveRole,
    userRoles,
    permissionsReady,
    activeTheme,
    setThemeMode,
    actions,
  } = useAppContext();
  const { changePassword } = actions || {};
  const toggleTheme = useCallback(() => {
    setThemeMode((prev) => (prev === 'light' ? 'dark' : 'light'));
  }, [setThemeMode]);

  const [collapsed, setCollapsed] = useState(false);
  const [openKeys, setOpenKeys] = useState<string[]>([]);
  const [isMobile, setIsMobile] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [changePasswordModal, setChangePasswordModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pwdForm] = Form.useForm();
  const location = useLocation();
  const navigate = useNavigate();

  // 检测移动端
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // 路由变化时关闭抽屉
  useEffect(() => {
    if (isMobile) {
      setDrawerOpen(false);
    }
  }, [location.pathname, isMobile]);

  // [新增] 检测是否为临时密码登录，强制/提示修改
  useEffect(() => {
    if (user?.isTemporaryPassword && !changePasswordModal) {
      setChangePasswordModal(true);
      message.warning({
        content: '您当前使用的是临时密码，请立即修改以确保账号安全！',
        duration: 4, // 4秒后自动消失
        key: 'force-change-pwd',
      });
    }
  }, [changePasswordModal, user?.isTemporaryPassword]);

  // 角色切换菜单 - 保持原有逻辑
  const roleMenu: MenuProps = {
    items: (userRoles || []).map((r) => ({
      key: r.code ?? '',
      label: r.name ?? r.code ?? '',
      onClick: () => setActiveRole(r as RoleLike)
    })),
  };

  const handleChangePassword = async (values: {
    oldPassword: string;
    newPassword: string;
  }) => {
    if (!changePassword) return;
    setSubmitting(true);
    try {
      await changePassword(values.oldPassword, values.newPassword);
      message.success("密码修改成功");
      setChangePasswordModal(false);
      pwdForm.resetFields();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "修改密码失败";
      message.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const userActionMenu: MenuProps = {
    items: [
      {
        key: 'profile',
        label: '个人信息',
        icon: <UserOutlined />,
        disabled: true,
      },
      {
        key: 'change-password',
        label: '修改密码',
        icon: <SafetyOutlined />,
        onClick: () => setChangePasswordModal(true),
      },
      {
        type: 'divider',
      },
      {
        key: 'logout',
        label: '安全退出',
        icon: <LogoutOutlined />,
        danger: true,
        onClick: onLogout,
      },
    ]
  };

  // 检查菜单项是否有权限访问
  const checkItemPermission = useCallback((item: NavChildItem) => {
    // 检查角色排除
    if (
      item.roleExclude &&
      activeRole?.code &&
      item.roleExclude.includes(activeRole.code)
    ) {
      return false;
    }
    // 无权限要求则允许
    if (!item.permission) return true;
    // 权限数组 - 任一满足即可
    if (Array.isArray(item.permission)) {
      return item.permission.some((code) => hasPermission(code));
    }
    // 单个权限检查
    return hasPermission(item.permission);
  }, [activeRole?.code, hasPermission]);

  // 过滤子菜单的子项
  const filterChildren = useCallback((children: NavChildItem[]) => {
    return children.filter(child => checkItemPermission(child));
  }, [checkItemPermission]);

  // 构建菜单项 - 支持子菜单结构
  const menuItems = useMemo(() => {
    const items: MenuItem[] = [];

    // 仪表盘 - 始终显示
    items.push({
      key: NAV_CONFIG.dashboard.key,
      icon: NAV_CONFIG.dashboard.icon,
      label: NAV_CONFIG.dashboard.label,
    });

    // 基础数据管理子菜单
    const dataChildren = filterChildren(NAV_CONFIG.dataSubMenu.children);
    if (dataChildren.length > 0) {
      items.push({
        key: NAV_CONFIG.dataSubMenu.key,
        icon: NAV_CONFIG.dataSubMenu.icon,
        label: NAV_CONFIG.dataSubMenu.label,
        children: dataChildren.map(child => ({
          key: child.key,
          label: child.label,
        })),
      });
    }

    // 宿舍检查子菜单
    const inspectionChildren = filterChildren(NAV_CONFIG.inspectionSubMenu.children);
    if (inspectionChildren.length > 0) {
      items.push({
        key: NAV_CONFIG.inspectionSubMenu.key,
        icon: NAV_CONFIG.inspectionSubMenu.icon,
        label: NAV_CONFIG.inspectionSubMenu.label,
        children: inspectionChildren.map(child => ({
          key: child.key,
          label: child.label,
        })),
      });
    }

    // 系统设置子菜单
    const systemChildren = filterChildren(NAV_CONFIG.systemSubMenu.children);
    if (systemChildren.length > 0) {
      items.push({
        key: NAV_CONFIG.systemSubMenu.key,
        icon: NAV_CONFIG.systemSubMenu.icon,
        label: NAV_CONFIG.systemSubMenu.label,
        children: systemChildren.map(child => ({
          key: child.key,
          label: child.label,
        })),
      });
    }

    return items;
  }, [filterChildren]);

  // 计算当前选中的菜单项
  const selectedKeys = useMemo(() => {
    const pathname = location.pathname;
    
    // 收集所有可选菜单项的 key（包括子菜单项）
    const allKeys: Array<{ key: string; item: MenuItem }> = [];
    const collectKeys = (items: MenuItem[]) => {
      items.forEach(item => {
        if (!item || typeof item === 'string' || !('key' in item)) {
          return;
        }
        allKeys.push({ key: String(item.key), item });
        if ('children' in item && Array.isArray(item.children)) {
          collectKeys(item.children as MenuItem[]);
        }
      });
    };
    collectKeys((menuItems ?? []) as MenuItem[]);

    // 精确匹配
    const exactMatch = allKeys.find(({ key }) => key === pathname);
    if (exactMatch) return [exactMatch.key];

    // 特殊处理 /tasks/entry 子路由（如 /tasks/entry/buildings）
    if (pathname.startsWith('/tasks/entry/')) {
      return ['/tasks/entry'];
    }

    // /audit-logs 精确匹配
    if (pathname === '/audit-logs') {
      return ['/audit-logs'];
    }

    // 前缀匹配（处理其他子路由）
    const prefixMatch = allKeys.find(({ key }) => 
      pathname.startsWith(`${key}/`)
    );
    if (prefixMatch) return [prefixMatch.key];

    return ['/dashboard'];
  }, [location.pathname, menuItems]);

  // 根据当前路径自动展开对应的子菜单
  useEffect(() => {
    const pathname = location.pathname;
    
    // 查找匹配的子菜单键
    let matchedSubMenuKey = null;
    
    // 精确匹配
    if (PATH_TO_SUBMENU[pathname]) {
      matchedSubMenuKey = PATH_TO_SUBMENU[pathname];
    } else {
      // 前缀匹配
      for (const [path, subMenuKey] of Object.entries(PATH_TO_SUBMENU)) {
        if (pathname.startsWith(path + '/') || pathname.startsWith(path)) {
          matchedSubMenuKey = subMenuKey;
          break;
        }
      }
    }

    if (matchedSubMenuKey && !openKeys.includes(matchedSubMenuKey)) {
      setOpenKeys(prev => [...new Set([...prev, matchedSubMenuKey])]);
    }
  }, [location.pathname, openKeys]);

  // 处理子菜单展开/收起
  const handleOpenChange = (keys: string[]) => {
    setOpenKeys(keys);
  };

  // 路由守卫逻辑保持不变
  useEffect(() => {
    const pathname = location.pathname;
    const ROUTE_GUARDS = [
      { prefix: '/occupancy', permission: 'DORM_VIEW' },
      { prefix: '/dorms', permission: 'DORM_VIEW' },
      { prefix: '/students', permission: 'STUDENT_VIEW' },
      { prefix: '/teachers', permission: 'TEACHER_MANAGE' },
      { prefix: '/tasks/publish', permission: 'TASK_PUBLISH' },
      { prefix: '/tasks/entry', permission: 'RESULT_RECORD' },
      { prefix: '/results', permission: 'RESULT_VIEW' },
      { prefix: '/accounts', permission: ['PERMISSION_MANAGE', 'USER_MANAGE'] },
      { prefix: '/users', permission: ['PERMISSION_MANAGE', 'USER_MANAGE'] },
      { prefix: '/settings', permission: 'SYSTEM_SETTINGS' },
      { prefix: '/audit-logs', permission: 'PERMISSION_MANAGE' },
    ];

    if (!permissionsReady || !activeRole) return;

    const matched = ROUTE_GUARDS.find(
      (route) => pathname === route.prefix || pathname.startsWith(`${route.prefix}/`)
    );
    if (!matched) return;

    const { permission } = matched;
    const allowed = Array.isArray(permission)
      ? permission.some((code) => hasPermission(code))
      : permission
      ? hasPermission(permission)
      : true;

    if (!allowed) {
      message.warning('当前角色无权访问此页面，已自动跳转');
      navigate('/dashboard', { replace: true });
    }
  }, [activeRole, hasPermission, location.pathname, navigate, permissionsReady]);

  // 菜单点击处理
  const handleMenuClick = ({ key }: MenuClickInfo) => {
    navigate(String(key));
  };

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      {/* 桌面端侧边栏 - 使用玻璃拟态样式 */}
      {!isMobile && (
        <Sider
          className="glass-sidebar"
          trigger={null}
          collapsible
          collapsed={collapsed}
          breakpoint="lg"
          collapsedWidth={80}
          onBreakpoint={(broken) => {
            setCollapsed(broken);
          }}
          style={{
            overflow: 'auto',
            height: '100vh',
            position: 'fixed',
            left: 0,
            top: 0,
            bottom: 0,
            zIndex: 1100,
          }}
        >
          {/* 品牌标题 */}
          <div className="sider-brand">
            {!collapsed && <span>宿舍查寝系统</span>}
            {collapsed && <span>查寝</span>}
          </div>

          {/* 导航菜单 */}
          <Menu
            theme="dark"
            mode="inline"
            selectedKeys={selectedKeys}
            openKeys={openKeys}
            onOpenChange={handleOpenChange}
            items={menuItems}
            onClick={handleMenuClick}
            className="glass-menu"
          />
        </Sider>
      )}

      {/* 移动端抽屉式导航 */}
      {isMobile && (
        <Drawer
          placement="left"
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          width={240}
          styles={{
            body: { padding: 0, background: 'var(--color-navy)' },
            header: { display: 'none' },
          }}
          className="mobile-drawer"
        >
          {/* 品牌标题 */}
          <div className="sider-brand" style={{ background: 'var(--color-navy)' }}>
            <span>宿舍查寝系统</span>
          </div>

          {/* 导航菜单 */}
          <Menu
            theme="dark"
            mode="inline"
            selectedKeys={selectedKeys}
            openKeys={openKeys}
            onOpenChange={handleOpenChange}
            items={menuItems}
            onClick={handleMenuClick}
            className="glass-menu"
          />
        </Drawer>
      )}

      {/* 主内容区 */}
      <AntLayout style={{ marginLeft: isMobile ? 0 : (collapsed ? 80 : 200), transition: 'margin-left 0.2s' }}>
        {/* 顶部栏 */}
        <Header className="app-header">
          <div className="header-left">
            <Button
              type="text"
              icon={isMobile ? <MenuUnfoldOutlined /> : (collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />)}
              onClick={() => isMobile ? setDrawerOpen(!drawerOpen) : setCollapsed(!collapsed)}
              className="collapse-btn"
            />
          </div>
          <div className="header-right">
             {isMobile && userRoles && userRoles.length > 1 && (
               <Dropdown menu={roleMenu} trigger={['click']} placement="bottomRight">
                 <Button 
                   type="text" 
                   className="mobile-role-btn"
                   icon={<UserOutlined />}
                   style={{ marginRight: 4 }}
                 >
                   {activeRole?.name} <DownOutlined style={{ fontSize: 10, marginLeft: 2 }} />
                 </Button>
               </Dropdown>
             )}
             <Switch
              checkedChildren={<MoonOutlined />}
              unCheckedChildren={<SunOutlined />}
              checked={activeTheme === "dark"}
              onChange={toggleTheme}
            />
            {!isMobile ? (
              <Dropdown menu={userActionMenu} placement="bottomRight" arrow>
                <div className="user-info" style={{ cursor: 'pointer', marginLeft: 16 }}>
                  <div className="user-name">{user?.fullName || user?.username || ''}</div>
                  <div className="user-role">
                    {userRoles && userRoles.length > 1 ? (
                      <Dropdown menu={roleMenu} trigger={['click']}>
                        <Space className="clickable-role" style={{ cursor: 'pointer', color: '#3b82f6' }} onClick={e => e.stopPropagation()}>
                          {activeRole?.name || user?.role || ''} <DownOutlined style={{ fontSize: '10px' }} />
                        </Space>
                      </Dropdown>
                    ) : (
                      activeRole?.name || user?.role || ''
                    )}
                  </div>
                </div>
              </Dropdown>
            ) : (
              <Button 
                type="text" 
                icon={<LogoutOutlined />} 
                onClick={onLogout}
                className="logout-btn"
                style={{ marginLeft: 8 }}
              />
            )}
          </div>
        </Header>
        {/* 内容区 - 点击/触摸时收起侧边栏子菜单 */}
        <Content 
          className="app-content"
          onTouchStart={() => {
            // 非移动端时，触摸内容区域收起展开的子菜单
            if (!isMobile && openKeys.length > 0) {
              setOpenKeys([]);
            }
          }}
        >
          <Outlet />
        </Content>
      </AntLayout>

      <Modal
        title="修改密码"
        open={changePasswordModal}
        onCancel={() => {
          setChangePasswordModal(false);
          pwdForm.resetFields();
        }}
        onOk={() => pwdForm.submit()}
        confirmLoading={submitting}
        okText="确认修改"
        cancelText="取消"
        destroyOnHidden
        centered
        width={MODAL_WIDTH.sm}
        className="co-modal"
      >
        <Form
          form={pwdForm}
          layout="vertical"
          onFinish={handleChangePassword}
          style={{ marginTop: 16 }}
        >
          <Form.Item
            name="oldPassword"
            label="当前密码"
            rules={[{ required: true, message: '请输入当前密码' }]}
          >
            <Input.Password placeholder="请输入当前使用的密码" />
          </Form.Item>
          
          <Form.Item
            name="newPassword"
            label="新密码"
            rules={[
              { required: true, message: '请输入新密码' },
              { min: 8, message: '密码长度不能少于 8 位' },
              {
                pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{}|;:,.<>?]).*$/,
                message: '必须包含大小写字母、数字及标点符号',
              }
            ]}
          >
            <Input.Password placeholder="8位以上，包含大小写、数字及标点" />
          </Form.Item>

          <Form.Item
            name="confirmPassword"
            label="确认新密码"
            dependencies={['newPassword']}
            rules={[
              { required: true, message: '请再次输入新密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('两次输入的密码不一致'));
                },
              }),
            ]}
          >
            <Input.Password placeholder="请再次输入新密码" />
          </Form.Item>
        </Form>
      </Modal>
    </AntLayout>
  );
}

