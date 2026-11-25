import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Outlet, useLocation, Link, useNavigate } from 'react-router-dom';
import type { Location } from 'react-router-dom';
import type { ReactNode } from 'react';
import type { DropdownProps, FormInstance, UploadProps } from 'antd';
import TitleDropdown from '../components/common/TitleDropdown';
import ThemeSwitcher from '../components/common/ThemeSwitcher';
import ThemeSettingsDrawer from '../components/common/ThemeSettingsDrawer';
import UserAvatar from '../components/common/UserAvatar';
import { useAppContext } from '../context/AppContext';
import { useMobile } from '../hooks/useMobile';
import {
  DashboardOutlined,
  DatabaseOutlined,
  ScheduleOutlined,
  SettingOutlined,
  UserOutlined,
  LogoutOutlined,
  SafetyOutlined,
  BellOutlined,
  MenuOutlined,
  HomeOutlined,
  CheckOutlined,
  IdcardOutlined,
  SwapOutlined,
  CloseOutlined,
  PhoneOutlined,
  MailOutlined,
  BgColorsOutlined,
  CameraOutlined,
  LoadingOutlined
} from '@ant-design/icons';
import { Dropdown, Modal, Form, Input, App, Drawer, Button, Slider, Select, Popover, Divider, Upload } from 'antd';
import { RightOutlined } from '@ant-design/icons';
import IOSActionSheet from '../components/common/IOSActionSheet';
import type { IOSActionSheetAction } from '../components/common/IOSActionSheet';
import {
  getLikelyPrefetchPaths,
  prefetchRoute,
  scheduleRoutePrefetch,
} from '../routes/routePrefetch';
import { trackRouteTransition } from '../performance/routeTransitions';
import type {
  AppActions,
  AppSelectionState,
  RoleLike,
  UserLike,
} from '../types/app';
import type { EntityId, ServiceRecord } from '../types/service';
import { MODAL_WIDTH } from "../components/common/modalSizes";

interface AppLayoutNavItem {
  key: string;
  label: string;
  icon: ReactNode;
  permission?: string | string[] | null;
  children?: AppLayoutNavChild[];
}

interface AppLayoutNavChild {
  key: string;
  label: string;
  permission?: string | string[] | null;
  roleExclude?: string[];
  allowRoles?: string[];
}

interface MobileLayoutProps {
  navItems: AppLayoutNavItem[];
  location: Location;
  selection: AppSelectionState;
  user: UserLike | null;
  onOpenUserMenu: () => void;
}

interface DesktopLayoutProps {
  navItems: AppLayoutNavItem[];
  userMenuProps: DropdownProps;
  location: Location;
  user: UserLike | null;
  activeRole: RoleLike | null;
}

interface AppLayoutProfile extends ServiceRecord {
  mobile?: string;
  phone?: string;
  email?: string;
  studentNo?: string;
  grade?: string;
  college?: string;
  major?: string;
  className?: string;
}

interface AppLayoutUser extends UserLike {
  avatarUrl?: string;
  department?: string;
  userType?: string;
  email?: string;
}

interface UploadResponse extends ServiceRecord {
  url?: string;
  data?: {
    url?: string;
  };
}

interface AppLayoutActions extends AppActions {
  refreshPermissions?: () => Promise<unknown> | void;
  fetchMyProfile?: () => Promise<unknown> | void;
  updateMyContact?: (payload: ServiceRecord) => Promise<unknown>;
  updateMe?: (payload: ServiceRecord) => Promise<unknown>;
  uploadAvatar?: (file: File) => Promise<UploadResponse>;
  loadTasks?: (force?: boolean) => Promise<unknown> | void;
  loadInspections?: (force?: boolean) => Promise<unknown> | void;
  loadAppeals?: (force?: boolean) => Promise<unknown> | void;
  loadMyInspections?: (force?: boolean) => Promise<unknown> | void;
  loadMyAppeals?: (force?: boolean) => Promise<unknown> | void;
}

interface ServiceError {
  message?: string;
}

interface PasswordFormValues {
  oldPassword: string;
  newPassword: string;
}

const EMPTY_PREFETCH_PROPS = {};
// 与后端 utils.IsStrongPassword 保持一致
const STRONG_PASSWORD_PATTERN = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{}|;:,.<>?]).{8,}$/;

function getTargetPath(item: AppLayoutNavItem): string {
  return item.children?.[0]?.key || item.key;
}

function buildPrefetchProps(targetPath: string) {
  const handlePrefetch = () => {
    void prefetchRoute(targetPath);
  };

  return {
    onMouseEnter: handlePrefetch,
    onFocus: handlePrefetch,
    onTouchStart: handlePrefetch,
  };
}

/**
 * --- 移动端组件 (iOS 风格) ---
 */
const MobileLayout = ({ navItems, location, selection, user, onOpenUserMenu }: MobileLayoutProps) => {
  const activeGroup = useMemo(() => {
    return navItems.find(item => {
      const isDirect = location.pathname.startsWith(item.key);
      const isChild = item.children?.some(c => location.pathname.startsWith(c.key));
      return isDirect || isChild;
    });
  }, [navItems, location.pathname]);

  const activeIndex = useMemo(() => {
    return navItems.findIndex(item => {
      const isDirect = location.pathname.startsWith(item.key);
      const isChild = item.children?.some(c => location.pathname.startsWith(c.key));
      return isDirect || isChild;
    });
  }, [navItems, location.pathname]);

  const activeChild = useMemo(() => {
    return activeGroup?.children?.find(c => location.pathname.startsWith(c.key));
  }, [activeGroup, location.pathname]);

  const displayTitle = activeChild?.label || activeGroup?.label || '宿舍管理系统';
  const displayName = user?.fullName || user?.username || '用户';
  // 检测是否为沉浸式页面 (查寝录入详情页)
  const isImmersive = useMemo(() => {
    // 路径匹配: /tasks/entry/buildings/:building/floors/:floor/rooms/:room
    return /\/tasks\/entry\/buildings\/.*\/floors\/.*\/rooms\/[^/]+$/.test(location.pathname);
  }, [location.pathname]);

  return (
    <div className="ios-mobile-base flex flex-col h-[100dvh] transition-all duration-500 overflow-hidden"
         style={{ 
           backgroundImage: 'var(--app-bg-image)', 
           backgroundSize: 'cover', 
           backgroundPosition: 'center',
           backgroundAttachment: 'fixed'
         }}>
      {/* 顶部导航控制中心 (iOS Header) - 支持刘海屏 */}
      {!isImmersive && (
        <header className="fixed top-0 left-0 right-0 z-50 co-header h-12 flex items-center px-4">
          <div className="flex items-center z-10">
            <ThemeSwitcher />
          </div>
          {/* 标题下拉导航 - 替代二级 Tab 栏 */}
          <div className="absolute left-1/2 -translate-x-1/2 max-w-[55%] w-full flex justify-center">
            <TitleDropdown
              title={displayTitle}
              items={activeGroup?.children}
              activeKey={location.pathname}
            />
          </div>
          <button
            type="button"
            onClick={onOpenUserMenu}
            className="ml-auto flex items-center gap-2 px-2.5 py-1.5 backdrop-blur-xl active-press"
            aria-label="打开个人菜单"
          >
            <div className="flex flex-col items-end leading-tight max-w-[120px]">
              {/* <span className="text-[10px] font-bold text-black dark:text-white truncate">
                {displayName}
              </span>
              <span className="text-[8px] font-semibold text-ios-gray-label uppercase tracking-widest truncate">
                {roleLabel}
              </span> */}
            </div>
            <div className="relative">
              <UserAvatar
                avatarUrl={user?.avatarUrl}
                name={displayName}
                size={32}
              />
              <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-ios-green shadow-[0_0_6px_rgba(52,199,89,0.6)] border border-white dark:border-black"></span>
            </div>
          </button>
        </header>
      )}

      {/* 主内容区 - 底部留出悬浮药丸的空间 */}
      <main
        className={`flex-1 overflow-y-auto hide-scrollbar ${isImmersive ? 'mt-0' : 'mt-12'}`}
        style={{ 
          paddingBottom: isImmersive ? '0px' : 'calc(100px + env(safe-area-inset-bottom, 0px))' 
        }}
      >
        <div className={isImmersive ? "" : "animate-apple-in"} key={location.pathname}>
          <Outlet />
        </div>
      </main>

      {/* 
          Apple Floating Pill Bar (形态切换药丸栏)
          - 状态 1: 导航模式 (selection.count === 0)
          - 状态 2: 选择操作模式 (selection.count > 0)
      */}
      {!isImmersive && (
        <div className="co-pill-wrapper">
          <div className={`co-pill-bar ${selection.count > 0 ? 'selection-active' : ''}`}>
            {selection.count > 0 ? (
              /* --- 状态 2: 选择操作模式 --- */
              <div className="pill-selection-info">
                <div className="pill-selection-count">
                  已选 {selection.count}
                </div>
                <div className="pill-action-btn-group">
                  <button
                    className="pill-action-btn-cancel"
                    onClick={selection.onClear ?? undefined}
                  >
                    取消
                  </button>
                  <button
                    className="pill-action-btn-primary"
                    onClick={selection.onAction ?? undefined}
                  >
                    {selection.actionLabel}
                  </button>
                </div>
              </div>
            ) : (
              /* --- 状态 1: 常规导航模式 --- */
              <div className="flex items-center w-full relative h-full">
                {/* 滑动背景指示器 */}
                {navItems.length > 0 && activeIndex !== -1 && (
                  <div
                    className="co-pill-gliding-bg"
                    style={{
                      width: `calc(100% / ${navItems.length})`,
                      transform: `translateX(calc(${activeIndex} * 100%))`,
                    }}
                  />
                )}
                {navItems.map(item => {
                  const hasChildren = !!item.children;
                  const isChildActive = hasChildren && (item.children?.some((child) => location.pathname.startsWith(child.key)) ?? false);
                  const isDirectActive = location.pathname.startsWith(item.key);
                  const isActive = isDirectActive || isChildActive;
                  const targetPath = getTargetPath(item);
                  const prefetchProps = targetPath
                    ? buildPrefetchProps(targetPath)
                    : EMPTY_PREFETCH_PROPS;

                  return (
                    <Link
                      key={item.key}
                      to={targetPath}
                      className={`co-pill-tab-item flex-1 ${isActive ? 'active' : ''}`}
                      {...prefetchProps}
                    >
                      <div className="text-[22px] h-6 flex items-center justify-center">
                        {item.icon}
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-tighter">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};


/**
 * --- 桌面端组件 (macOS 风格) ---
 */
const DesktopLayout = ({ navItems, userMenuProps, location, user, activeRole }: DesktopLayoutProps) => {
  const currentNav = useMemo(() => {
    return navItems.find(item => {
      const isDirect = location.pathname.startsWith(item.key);
      const isChild = item.children?.some(c => location.pathname.startsWith(c.key));
      return isDirect || isChild;
    });
  }, [navItems, location.pathname]);
  // 标题显示当前页面（子菜单）名称，而不是所在分组名称；与移动端保持一致
  const currentTitle =
    currentNav?.children?.find((child) => location.pathname.startsWith(child.key))?.label || currentNav?.label;
  const displayName = user?.fullName || user?.username || '用户';
  const roleLabel = activeRole?.name || user?.role || '角色';

  return (
    <div className="flex h-[100dvh] transition-colors duration-300 overflow-hidden"
         style={{ 
           backgroundImage: 'var(--app-bg-image)', 
           backgroundSize: 'cover', 
           backgroundPosition: 'center',
           backgroundAttachment: 'fixed'
         }}>
      <aside className="w-[260px] flex flex-col h-full bg-white/60 dark:bg-[#1e1e1e]/60 backdrop-blur-3xl border-r border-black/[0.05] dark:border-white/10 z-30">
        <div className="p-6 mb-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-ios-blue to-ios-indigo rounded-[22%] flex items-center justify-center text-white shadow-lg shadow-ios-blue/20">
              <HomeOutlined className="text-xl" />
            </div>
            <div>
              <h2 className="text-[15px] font-black tracking-tight text-co-text leading-tight">宿舍管理系统</h2>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto no-scrollbar pb-6">
          {navItems.map(item => {
            const hasChildren = !!item.children;
            const isChildActive = hasChildren && (item.children?.some((child) => location.pathname.startsWith(child.key)) ?? false);
            const isDirectActive = location.pathname.startsWith(item.key);
            const isActive = isDirectActive || isChildActive;
            const targetPath = getTargetPath(item);
            const linkPrefetchProps = targetPath
              ? buildPrefetchProps(targetPath)
              : EMPTY_PREFETCH_PROPS;

            return (
              <div key={item.key} className="space-y-0.5">
                <Link
                  to={targetPath}
                  className={`co-sidebar-nav-item group ${isActive ? 'active' : ''}`}
                  {...linkPrefetchProps}
                >
                  <span className={`text-[16px] flex items-center justify-center w-6 h-6 rounded-md ${isActive ? 'bg-co-primary text-white' : 'text-co-muted group-hover:text-co-text'}`}>
                    {item.icon}
                  </span>
                  <span className={`text-[13px] font-semibold ${isActive ? 'text-co-text' : 'text-co-muted group-hover:text-co-text'}`}>
                    {item.label}
                  </span>
                </Link>
                {isActive && item.children && (
                  <div className="ml-10 space-y-0.5 mt-0.5 border-l border-[var(--co-glass-border)] pl-2 mb-2">
                    {item.children.map(child => {
                      const isSubActive = location.pathname.startsWith(child.key);
                      return (
                        <Link
                          key={child.key}
                          to={child.key}
                          className={`co-sidebar-sub-item ${isSubActive ? 'active' : ''}`}
                          {...buildPrefetchProps(child.key)}
                        >
                          {child.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="px-3 pb-4">
          <Dropdown
            {...userMenuProps}
            placement="topRight"
            trigger={["click"]}
          >
            <div className="co-user-panel h-[60px] px-3 py-2">
              <UserAvatar
                avatarUrl={user?.avatarUrl}
                name={displayName}
                size={40}
              />
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-bold text-co-text truncate">{displayName}</div>
                <div className="text-[10px] text-co-muted mt-1 truncate">{roleLabel}</div>
                <div className="flex items-center gap-2">
                  {/* <span className="px-2 py-0.5 rounded-full bg-ios-blue/10 text-ios-blue text-[10px] font-bold uppercase tracking-widest truncate">
                    {roleLabel}
                  </span> */}
                  {/* <div className="w-1.5 h-1.5 rounded-full bg-ios-green shadow-[0_0_8px_rgba(52,199,89,0.5)]"></div> */}
                </div>
              </div>
              <SettingOutlined className="text-[16px] text-co-muted" />
            </div>
          </Dropdown>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto bg-white/40 dark:bg-black/20 backdrop-blur-sm relative h-full selection:bg-ios-blue/20 selection:text-ios-blue">
        <header className="sticky top-0 h-14 bg-white/60 dark:bg-black/40 backdrop-blur-xl z-20 px-8 flex items-center justify-between border-b border-black/[0.03] dark:border-white/[0.03]">
          <div className="flex items-center gap-4">
            <h2 className="text-[16px] font-bold text-co-text">
              {currentTitle}
            </h2>
          </div>

          <div className="flex items-center gap-4">
            <ThemeSwitcher />
            <div className="flex items-center gap-3 co-glass-btn px-3 py-1.5 rounded-full">
              <div className="w-1.5 h-1.5 rounded-full bg-[var(--co-success)] animate-pulse"></div>
              <span className="text-[11px] font-black text-co-muted uppercase tracking-widest">{new Date().toLocaleDateString('zh-CN', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
            </div>
            <div className="relative group">
              <BellOutlined className="text-[18px] text-co-muted group-hover:text-co-primary cursor-pointer transition-colors" />
              <div className="absolute -top-1 -right-1 w-2 h-2 bg-[var(--co-error)] rounded-full border-2 border-[var(--co-bg)]"></div>
            </div>
          </div>
        </header>

        <div className="p-8 max-w-[1600px] mx-auto min-h-[calc(100vh-56px)] co-animate-in">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

const AppLayout = () => {
  const {
    user,
    onLogout,
    hasPermission,
    permissionsReady,
    activeRole,
    setActiveRole,
    actions,
    selection,
    data,
    settings,
    myProfile,
    userRoles,
    refreshUser,
  } = useAppContext();
  const layoutActions = actions as AppLayoutActions;
  const layoutUser = user as AppLayoutUser | null;
  const layoutProfile = (myProfile ?? null) as AppLayoutProfile | null;
  const refreshPermissions = layoutActions.refreshPermissions;
  const isMobile = useMobile(768);
  const location = useLocation();
  const navigate = useNavigate();
  const previousRouteRef = useRef<string | null>(null);
  const [changePasswordModal, setChangePasswordModal] = useState(false);
  const mustChangePassword = Boolean(layoutUser?.mustChangePassword);
  const [profileOpen, setProfileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [userSheetOpen, setUserSheetOpen] = useState(false);
  const [roleSheetOpen, setRoleSheetOpen] = useState(false);
  const [themeSettingsOpen, setThemeSettingsOpen] = useState(false);
  const [phoneDraft, setPhoneDraft] = useState("");
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [emailPrefix, setEmailPrefix] = useState("");
  const [emailDomain, setEmailDomain] = useState("");
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [savingContact, setSavingContact] = useState(false);
  const [rolePopoverOpen, setRolePopoverOpen] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [pwdForm] = Form.useForm<PasswordFormValues>();
  const { message: antMessage } = App.useApp();
  const displayName = layoutUser?.fullName || layoutUser?.username || "用户";
  const roleLabel = activeRole?.name || layoutUser?.role || "角色";
  const basePhone =
    activeRole?.code === "STUDENT"
      ? layoutProfile?.mobile || layoutProfile?.phone || ""
      : layoutUser?.phone || "";
  const baseEmail = layoutUser?.email || layoutProfile?.email || "";
  const emailDomains = Array.isArray(settings?.contactEmailDomains)
    ? settings.contactEmailDomains
    : [];
  const canEditContact = Boolean(settings?.studentContactEditable);

  const checkItemPermission = useMemo(
    () =>
      (
        item: Pick<AppLayoutNavChild, 'permission' | 'roleExclude' | 'allowRoles'>,
      ): boolean => {
        if (
          item.roleExclude &&
          activeRole?.code &&
          item.roleExclude.includes(activeRole.code)
        ) {
          return false;
        }

        if (
          item.allowRoles &&
          activeRole?.code &&
          item.allowRoles.includes(activeRole.code)
        ) {
          return true;
        }

        if (!item.permission) {
          return true;
        }

        if (Array.isArray(item.permission)) {
          return item.permission.some((code) => hasPermission(code));
        }

        return hasPermission(item.permission);
      },
    [activeRole?.code, hasPermission],
  );

  const navItems = useMemo(() => {
    const baseNavItems: AppLayoutNavItem[] = [
      { key: '/dashboard', label: '仪表盘', icon: <DashboardOutlined />, permission: null },
      {
        key: 'group-data',
        label: '基础管理',
        icon: <DatabaseOutlined />,
        children: [
          { key: '/buildings', label: '楼栋管理', permission: 'SYSTEM_SETTINGS' },
          { key: '/dorms', label: '宿舍管理', permission: 'DORM_VIEW', roleExclude: ['LEADER'] },
          { key: '/teachers', label: '教职工管理', permission: 'TEACHER_MANAGE' },
          { key: '/students', label: '学生管理', permission: 'STUDENT_VIEW' },
          { key: '/occupancy', label: '入住管理', permission: 'DORM_VIEW' },
        ],
      },
      {
        key: 'group-inspection',
        label: '查寝中心',
        icon: <ScheduleOutlined />,
        children: [
          { key: '/tasks/publish', label: '任务发布', permission: ['TASK_PUBLISH', 'TASK_EDIT', 'TASK_DELETE'] },
          { key: '/tasks/entry', label: '分数录入', permission: 'RESULT_RECORD' },
          { key: '/results', label: '结果查看', permission: 'RESULT_VIEW' },
          {
            key: '/appeals',
            label: activeRole?.code === 'STUDENT' ? '我的申诉' : '申诉处理',
            permission: 'APPEAL_VIEW',
            allowRoles: ['STUDENT'],
          },
        ],
      },
      {
        key: 'group-settings',
        label: '系统设置',
        icon: <SettingOutlined />,
        children: [
          { key: '/settings', label: '系统概览', permission: 'SYSTEM_SETTINGS' },
          {
            key: '/accounts',
            label: '角色权限',
            permission: ['PERMISSION_MANAGE', 'USER_MANAGE'],
          },
          { key: '/audit-logs', label: '审计日志', permission: 'PERMISSION_MANAGE' },
        ],
      },
    ];

    return baseNavItems.flatMap((item) => {
      if (!item.children?.length) {
        return checkItemPermission(item) ? [item] : [];
      }

      const visibleChildren = item.children.filter((child) => checkItemPermission(child));
      if (!visibleChildren.length) {
        return [];
      }

      if (!checkItemPermission(item)) {
        return [];
      }

      return [{ ...item, children: visibleChildren }];
    });
  }, [activeRole?.code, checkItemPermission]);

  useEffect(() => {
    if (!permissionsReady || !activeRole) {
      return;
    }

    const routeGuards: Array<{
      prefix: string;
      permission: string | string[];
      allowRoles?: string[];
    }> = [
      { prefix: '/buildings', permission: 'SYSTEM_SETTINGS' },
      { prefix: '/dorms', permission: 'DORM_VIEW' },
      { prefix: '/occupancy', permission: 'DORM_VIEW' },
      { prefix: '/students', permission: 'STUDENT_VIEW' },
      { prefix: '/teachers', permission: 'TEACHER_MANAGE' },
      { prefix: '/tasks/publish', permission: ['TASK_PUBLISH', 'TASK_EDIT', 'TASK_DELETE'] },
      { prefix: '/tasks/entry', permission: 'RESULT_RECORD' },
      { prefix: '/results', permission: 'RESULT_VIEW' },
      { prefix: '/appeals', permission: 'APPEAL_VIEW', allowRoles: ['STUDENT'] },
      {
        prefix: '/accounts',
        permission: ['PERMISSION_MANAGE', 'USER_MANAGE'],
      },
      { prefix: '/settings', permission: 'SYSTEM_SETTINGS' },
      { prefix: '/audit-logs', permission: 'PERMISSION_MANAGE' },
    ];

    const matchedGuard = routeGuards.find(
      (route) =>
        location.pathname === route.prefix ||
        location.pathname.startsWith(`${route.prefix}/`),
    );

    if (!matchedGuard) {
      return;
    }

    const allowedByRole = Boolean(
      matchedGuard.allowRoles &&
        activeRole.code &&
        matchedGuard.allowRoles.includes(activeRole.code),
    );
    const allowed =
      allowedByRole ||
      (Array.isArray(matchedGuard.permission)
        ? matchedGuard.permission.some((code) => hasPermission(code))
        : hasPermission(matchedGuard.permission));

    if (!allowed) {
      antMessage.warning('当前角色无权访问此页面，已自动跳转');
      navigate('/dashboard', { replace: true });
    }
  }, [activeRole, antMessage, hasPermission, location.pathname, navigate, permissionsReady]);

  useEffect(() => {
    const visiblePaths = new Set(
      navItems.flatMap((item) => (item.children?.length ? item.children.map((child) => child.key) : [item.key])),
    );
    const currentGroup = navItems.find((item) => {
      const isDirect = location.pathname.startsWith(item.key);
      const isChild = item.children?.some((child) => location.pathname.startsWith(child.key));
      return isDirect || isChild;
    });
    const siblingPaths = currentGroup?.children?.map((child) => child.key) || [];
    const roleLikelyPaths = getLikelyPrefetchPaths(activeRole?.code || user?.role).filter(
      (path) => visiblePaths.has(path) || path === location.pathname,
    );

    const cancelPrefetch = scheduleRoutePrefetch([
      location.pathname,
      ...roleLikelyPaths,
      ...siblingPaths,
    ]);

    return cancelPrefetch;
  }, [activeRole?.code, location.pathname, navItems, user?.role]);

  useEffect(() => {
    const nextRoute = `${location.pathname}${location.search}`;
    const cleanup = trackRouteTransition(nextRoute, previousRouteRef.current);
    previousRouteRef.current = nextRoute;

    return cleanup;
  }, [location.pathname, location.search]);

  const handleChangePassword = async (values: PasswordFormValues) => {
    try {
      await layoutActions.changePassword?.(values.oldPassword, values.newPassword);
      setChangePasswordModal(false);
      pwdForm.resetFields();
      // 改密后后端会使所有旧 Token 失效，直接退出并提示用新密码登录
      antMessage.success("密码修改成功，请使用新密码重新登录");
      onLogout?.();
    } catch (err) {
      antMessage.error((err as ServiceError).message || "修改失败");
    }
  };

  const parseEmailParts = (value?: string) => {
    if (!value || !value.includes("@")) {
      return { prefix: "", domain: "" };
    }
    const [prefix, ...rest] = value.split("@");
    return {
      prefix: prefix || "",
      domain: rest.join("@"),
    };
  };

  const emailCandidate = emailPrefix && emailDomain ? `${emailPrefix}@${emailDomain}` : "";
  const phoneChanged = phoneDraft !== basePhone;
  const emailChanged = emailCandidate !== baseEmail;
  const emailDomainAvailable = emailDomains.length > 0;
  const emailHasInput = Boolean(emailPrefix || emailDomain);
  let emailValid = true;
  if (emailChanged && emailHasInput) {
    emailValid =
      emailDomainAvailable &&
      Boolean(emailPrefix && emailDomain) &&
      emailDomains.includes(emailDomain);
  }
  const canSaveContact = canEditContact && (phoneChanged || emailChanged) && emailValid;

  const openProfileDrawer = () => {
    refreshUser?.();
    layoutActions.fetchMyProfile?.();
    setProfileOpen(true);
    setUserMenuOpen(false);
    setUserSheetOpen(false);
    setIsEditingPhone(false);
    setIsEditingEmail(false);
  };


  const handleRoleSwitch = async (role: RoleLike, options: { closeMenu?: boolean; closeSheet?: boolean } = {}) => {
    if (!role || role.id === activeRole?.id) {
      if (options.closeMenu) {
        setUserMenuOpen(false);
      }
      return;
    }
    try {
      setActiveRole(role);
      await refreshPermissions?.();
      await layoutActions.fetchMyProfile?.();
      antMessage.success(`已切换为 ${role.name || role.code}`);
    } catch (err) {
      antMessage.error((err as ServiceError).message || "切换角色失败");
    } finally {
      if (options.closeMenu) {
        setUserMenuOpen(false);
      }
      if (options.closeSheet) {
        setRoleSheetOpen(false);
      }
    }
  };

  const confirmLogout = () => {
    setUserMenuOpen(false);
    setUserSheetOpen(false);
    Modal.confirm({
      title: "退出登录？",
      content: "退出后需要重新登录。",
      okText: "退出登录",
      cancelText: "取消",
      okType: "danger",
      className: "apple-modal",
      onOk: onLogout,
    });
  };

  const handleSaveContact = async () => {
    if (!canSaveContact) return;
    setSavingContact(true);
    try {
      const payload: ServiceRecord = {};
      if (phoneChanged) {
        payload.phone = phoneDraft;
        // 如果是学生，同步到 mobile 字段
      if (activeRole?.code === "STUDENT") {
        payload.mobile = phoneDraft;
      }
      }

      if (emailChanged) {
        payload.email = emailCandidate;
      }

      // 根据角色调用不同接口
      if (activeRole?.code === "STUDENT") {
        await layoutActions.updateMyContact?.(payload);
      } else {
        await layoutActions.updateMe?.(payload);
      }

      await refreshUser?.();
      setIsEditingPhone(false);
      setIsEditingEmail(false);
      antMessage.success("联系方式已更新");

    } catch (err) {
      antMessage.error((err as ServiceError).message || "更新失败");
    } finally {
      setSavingContact(false);
    }
  };

  const handleAvatarUpload: UploadProps['customRequest'] = async ({
    file,
    onSuccess,
    onError,
  }: Parameters<NonNullable<UploadProps['customRequest']>>[0]) => {
    if (!layoutActions.uploadAvatar) {
      const err = new Error("头像上传功能未启用");
      onError?.(err);
      antMessage.error(err.message);
      return;
    }

    const maxAvatarSize = 2 * 1024 * 1024;
    const fileSize = typeof file === 'object' && file && 'size' in file ? file.size : 0;
    if (fileSize > maxAvatarSize) {
      const err = new Error("头像大小不能超过 2 MB");
      onError?.(err);
      antMessage.error(err.message);
      return;
    }

    setAvatarUploading(true);
    try {
      const res = await layoutActions.uploadAvatar(file as File);
      const url = res?.url || res?.data?.url;
      if (!url) {
        throw new Error("头像上传失败，请稍后再试");
      }
      await refreshUser?.();
      onSuccess?.(res);
      antMessage.success("头像已更新");
    } catch (err) {
      onError?.(err as Error);
      antMessage.error((err as ServiceError).message || "头像上传失败，请稍后再试");
    } finally {
      setAvatarUploading(false);
    }
  };


  useEffect(() => {
    if (!profileOpen) return;
    setPhoneDraft(basePhone || "");
    const { prefix, domain } = parseEmailParts(baseEmail);
    setEmailPrefix(prefix);
    setEmailDomain(domain);
    setIsEditingPhone(false);
    setIsEditingEmail(false);
  }, [profileOpen, basePhone, baseEmail]);

  useEffect(() => {
    if (!profileOpen) return;
    layoutActions.loadTasks?.();
    if (activeRole?.code === "STUDENT") {
      layoutActions.loadMyInspections?.();
      layoutActions.loadMyAppeals?.();
    } else {
      if (hasPermission("RESULT_VIEW")) {
        layoutActions.loadInspections?.();
      }
      if (hasPermission("APPEAL_VIEW")) {
        layoutActions.loadAppeals?.();
      }
    }
  }, [profileOpen, basePhone, baseEmail, layoutActions, activeRole?.code, hasPermission]);

  const stats = useMemo(() => {
    const inspectionCount =
      activeRole?.code === "STUDENT"
        ? data.myInspections?.length || 0
        : data.inspections?.length || 0;
    const appealCount =
      activeRole?.code === "STUDENT"
        ? data.myAppeals?.length || 0
        : data.appeals?.length || 0;
    const taskCount = data.tasks?.length || 0;
    return [
      {
        label: activeRole?.code === "STUDENT" ? "我的记录" : "查寝记录",
        value: inspectionCount,
      },
      {
        label: activeRole?.code === "STUDENT" ? "我的申诉" : "申诉总数",
        value: appealCount,
      },
      {
        label: "任务总数",
        value: taskCount,
      },
    ];
  }, [
    activeRole?.code,
    data.myInspections,
    data.inspections,
    data.myAppeals,
    data.appeals,
    data.tasks,
  ]);

  const roleSwitchContent = (
    <div className="w-[100px] animate-apple-in">
      <div className="space-y-1">
        {(userRoles ?? []).map((role) => {
          const isActive = role.id === activeRole?.id;
          return (
            <button
              key={role.id || role.code}
              type="button"
              onClick={() => {
                handleRoleSwitch(role, { closeMenu: true });
                setRolePopoverOpen(false);
              }}
              className={`w-full h-9 rounded-lg px-2 flex items-center justify-between text-[12px] font-semibold transition-all duration-200 ${isActive
                  ? "bg-ios-blue text-white shadow-md shadow-ios-blue/20"
                  : "bg-black/[0.03] dark:bg-white/[0.06] text-black dark:text-white hover:bg-black/[0.06] dark:hover:bg-white/[0.1] active:scale-[0.98]"
                }`}
            >
              <span className="truncate">{role.name || role.code}</span>
              {isActive && <CheckOutlined className="text-white text-[12px]" />}
            </button>
          );
        })}
      </div>
    </div>
  );

  const userMenuContent = (
    <div className="w-[150px] rounded-2xl border border-black/5 dark:border-white/10 bg-white/85 dark:bg-[#1C1C1E]/95 backdrop-blur-xl shadow-[0_18px_50px_rgba(0,0,0,0.2)] p-1.5 space-y-0.5">
      {/* 角色切换项 (第一块) */}
      <Popover
        open={rolePopoverOpen}
        onOpenChange={setRolePopoverOpen}
        content={roleSwitchContent}
        placement="rightTop"
        overlayClassName="apple-popover-glass"
        trigger="click"
        getPopupContainer={(trigger) => trigger.parentElement ?? trigger}
      >
        <button
          type="button"
          className="w-full h-11 rounded-xl px-3 flex flex-col items-center justify-center text-[13px] font-semibold hover:bg-black/[0.04] dark:hover:bg-white/[0.08] transition-all group active:scale-[0.98] relative"
        >
          <div className="flex items-center gap-2 text-black dark:text-white">
            <SwapOutlined className="text-[15px] text-ios-blue" />
            <span>切换角色</span>
          </div>
          <RightOutlined className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] text-ios-gray-label group-hover:translate-x-0.5 transition-transform" />
        </button>
      </Popover>

      <div className="h-px bg-black/[0.05] dark:bg-white/[0.08] mx-2 my-1" />

      {/* 功能项区 */}
      <div className="space-y-0.5">
        <button
          type="button"
          onClick={openProfileDrawer}
          className="w-full h-10 rounded-xl px-3 flex items-center justify-center gap-2 text-[13px] font-semibold text-black dark:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.08] transition-all active:scale-[0.98]"
        >
          <IdcardOutlined className="text-[15px] text-ios-blue" />
          <span>个人信息</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setChangePasswordModal(true);
            setUserMenuOpen(false);
          }}
          className="w-full h-10 rounded-xl px-3 flex items-center justify-center gap-2 text-[13px] font-semibold text-black dark:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.08] transition-all active:scale-[0.98]"
        >
          <SafetyOutlined className="text-[15px] text-ios-blue" />
          <span>修改密码</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setThemeSettingsOpen(true);
            setUserMenuOpen(false);
          }}
          className="w-full h-10 rounded-xl px-3 flex items-center justify-center gap-2 text-[13px] font-semibold text-black dark:text-white hover:bg-black/[0.04] dark:hover:bg-white/[0.08] transition-all active:scale-[0.98]"
        >
          <BgColorsOutlined className="text-[15px] text-ios-blue" />
          <span>外观设置</span>
        </button>

        <button
          type="button"
          onClick={confirmLogout}
          className="w-full h-10 rounded-xl px-3 flex items-center justify-center gap-2 text-[13px] font-semibold text-red-500 hover:bg-red-500/10 transition-all active:scale-[0.98]"
        >
          <LogoutOutlined className="text-[15px]" />
          <span>退出登录</span>
        </button>
      </div>
    </div>
  );


  const userMenuProps = {
    open: userMenuOpen,
    onOpenChange: setUserMenuOpen,
    dropdownRender: () => userMenuContent,
  };

  const userActionSheetActions: IOSActionSheetAction[] = [
    {
      key: "profile",
      label: "个人信息",
      icon: <IdcardOutlined />,
      type: "primary",
      onClick: openProfileDrawer,
    },
    {
      key: "roles",
      label: "切换角色",
      icon: <SwapOutlined />,
      hidden: (userRoles?.length ?? 0) <= 1,
      onClick: () => {
        setUserSheetOpen(false);
        setRoleSheetOpen(true);
      },
    },
    {
      key: "password",
      label: "修改密码",
      icon: <SafetyOutlined />,
      onClick: () => {
        setChangePasswordModal(true);
        setUserSheetOpen(false);
      },
    },
    {
      key: "theme",
      label: "外观设置",
      icon: <BgColorsOutlined />,
      onClick: () => {
        setThemeSettingsOpen(true);
        setUserSheetOpen(false);
      },
    },
    {
      key: "logout",
      label: "退出登录",
      icon: <LogoutOutlined />,
      type: "danger",
      onClick: confirmLogout,
    },
  ];

  const roleSheetActions: IOSActionSheetAction[] = (userRoles || []).map((role) => ({
    key: String(role.id || role.code || role.name || ""),
    label: role.name || role.code || "",
    type: role.id === activeRole?.id ? "primary" : "default",
    onClick: () => handleRoleSwitch(role, { closeSheet: true }),
  }));

  return (
    <div className="min-h-[100dvh]">
      {isMobile ? (
        <MobileLayout
          navItems={navItems}
          location={location}
          selection={selection}
          user={user}
          onOpenUserMenu={() => setUserSheetOpen(true)}
        />
      ) : (
        <DesktopLayout
          navItems={navItems}
          userMenuProps={userMenuProps}
          location={location}
          user={user}
          activeRole={activeRole}
        />
      )}

      <IOSActionSheet
        open={userSheetOpen}
        onClose={() => setUserSheetOpen(false)}
        title="个人中心"
        subtitle={`${displayName} · ${roleLabel}`}
        actions={userActionSheetActions}
      />

      <IOSActionSheet
        open={roleSheetOpen}
        onClose={() => setRoleSheetOpen(false)}
        title="切换角色"
        actions={roleSheetActions}
      />

      <Drawer
        placement={isMobile ? "bottom" : "right"}
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        height={isMobile ? "92vh" : undefined}
        width={isMobile ? undefined : 560}
        closable={false}
        className={isMobile ? "apple-drawer profile-drawer-mobile" : "profile-drawer-right"}
        rootClassName="profile-drawer-root"
        styles={{
          header: { display: "none" },
          body: { padding: 0 },
        }}
      >
        <div className="h-full flex flex-col">
          <div className="px-5 pt-5 pb-3 border-b border-black/5 dark:border-white/10">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-[18px] font-bold text-black dark:text-white">个人信息</h2>
              </div>
              <button
                type="button"
                onClick={() => setProfileOpen(false)}
                className="w-9 h-9 rounded-full bg-black/[0.05] dark:bg-white/[0.08] flex items-center justify-center text-black/60 dark:text-white/60 hover:text-ios-blue transition-colors"
                aria-label="关闭个人信息"
              >
                <CloseOutlined />
              </button>
            </div>
            <div className="mt-3 p-3 rounded-2xl border border-black/5 dark:border-white/10 bg-white/80 dark:bg-[rgba(255,255,255,0.12)]">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <UserAvatar
                    avatarUrl={user?.avatarUrl}
                    name={displayName}
                    size={56}
                    className="shadow-sm"
                  />
                  <Upload
                    accept="image/*"
                    showUploadList={false}
                    customRequest={handleAvatarUpload}
                    disabled={avatarUploading}
                  >
                    <button
                      type="button"
                      className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-white/80 dark:bg-black/60 border border-black/10 dark:border-white/20 flex items-center justify-center text-black/60 dark:text-white/60 shadow-sm hover:text-ios-blue transition-colors disabled:opacity-60"
                      aria-label="更换头像"
                      disabled={avatarUploading}
                    >
                      {avatarUploading ? (
                        <LoadingOutlined className="text-[12px]" />
                      ) : (
                        <CameraOutlined className="text-[12px]" />
                      )}
                    </button>
                  </Upload>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[16px] font-bold text-black dark:text-white truncate">
                    {displayName}
                  </div>
                  <div className="text-[12px] text-ios-gray-label truncate">
                    {user?.username || "-"}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="px-2 py-0.5 rounded-full bg-ios-blue/10 text-ios-blue text-[10px] font-bold uppercase tracking-widest truncate">
                      {roleLabel}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-5 pb-6 space-y-4">
            <section>
              <div className="flex items-center justify-between px-1 mb-1.5">
                <h3 className="text-[11px] font-bold text-ios-gray-label uppercase tracking-widest">
                  基本信息
                </h3>
              </div>
              <div className="rounded-2xl border border-black/5 dark:border-white/10 bg-white/80 dark:bg-[rgba(255,255,255,0.12)] p-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                  {([
                    { label: "部门", value: user?.department || "-" },
                    { label: "用户类型", value: user?.userType || "-" },
                    ...(activeRole?.code === "STUDENT"
                      ? [
                        { label: "学号", value: myProfile?.studentNo || "-" },
                        { label: "年级", value: myProfile?.grade || "-" },
                        { label: "学院", value: myProfile?.college || "-" },
                        { label: "专业", value: myProfile?.major || "-" },
                        { label: "班级", value: myProfile?.className || "-" },
                      ]
                      : []),
                  ] as Array<{ label: string; value: ReactNode }>).map((item) => (
                    <div key={item.label} className="flex flex-col gap-1 min-w-0">
                      <span className="text-[11px] text-ios-gray-label">{item.label}</span>
                      <span className="text-[14px] font-semibold text-black dark:text-white truncate">
                        {item.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section>
              <div className="flex items-center justify-between px-1 mb-1.5">
                <h3 className="text-[11px] font-bold text-ios-gray-label uppercase tracking-widest">
                  联系方式
                </h3>
              </div>
              <div className="rounded-2xl border border-black/5 dark:border-white/10 bg-white/80 dark:bg-[rgba(255,255,255,0.12)] p-4 space-y-4">
                {/* 手机号部分 */}
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-ios-gray-label uppercase tracking-widest flex items-center gap-2">
                    <PhoneOutlined />
                    手机号
                  </label>
                  {isEditingPhone && canEditContact ? (
                    <Input
                      autoFocus
                      value={phoneDraft}
                      onChange={(event) => setPhoneDraft(event.target.value)}
                      onBlur={() => !phoneChanged && setIsEditingPhone(false)}
                      placeholder="填写常用联系电话"
                      className="apple-input h-11"
                    />
                  ) : (
                    <div
                      onClick={() => canEditContact && setIsEditingPhone(true)}
                      className={`h-11 flex items-center px-3 rounded-xl border border-transparent transition-colors ${canEditContact
                          ? "hover:bg-black/[0.03] dark:hover:bg-white/[0.03] cursor-text"
                          : "bg-black/[0.02] dark:bg-white/[0.02]"
                        }`}
                    >
                      <span className={`text-[15px] ${!phoneDraft ? "text-ios-gray-label font-normal" : "font-semibold text-black dark:text-white"}`}>
                        {phoneDraft || "未填写"}
                      </span>
                    </div>
                  )}
                </div>

                {/* 邮箱部分 */}
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-ios-gray-label uppercase tracking-widest flex items-center gap-2">
                    <MailOutlined />
                    邮箱
                  </label>
                  {isEditingEmail && canEditContact ? (
                    <div className="flex items-center apple-input h-11 px-0 overflow-hidden ring-offset-0 focus-within:ring-2 focus-within:ring-ios-blue/20">
                      <Input
                        autoFocus
                        value={emailPrefix}
                        onChange={(event) => setEmailPrefix(event.target.value.trim())}
                        placeholder="邮箱前缀"
                        variant="borderless"
                        className="flex-1 h-full px-3 text-[15px] font-semibold"
                      />
                      <span className="text-[14px] text-ios-gray-label shrink-0 font-bold px-1">@</span>
                      <Select
                        value={emailDomain || undefined}
                        onChange={(value) => setEmailDomain(value)}
                        placeholder={emailDomainAvailable ? "选择域名" : "未配置"}
                        variant="borderless"
                        className="h-full flex-[1.4] text-[15px] font-semibold"
                        popupClassName="apple-dropdown"
                        disabled={!emailDomainAvailable}
                        options={emailDomains.map((domain) => ({
                          value: domain,
                          label: domain,
                        }))}
                      />
                    </div>
                  ) : (
                    <div
                      onClick={() => canEditContact && setIsEditingEmail(true)}
                      className={`h-11 flex items-center px-3 rounded-xl border border-transparent transition-colors ${canEditContact
                          ? "hover:bg-black/[0.03] dark:hover:bg-white/[0.03] cursor-text"
                          : "bg-black/[0.02] dark:bg-white/[0.02]"
                        }`}
                    >
                      <span className={`text-[15px] ${!emailCandidate ? "text-ios-gray-label font-normal" : "font-semibold text-black dark:text-white"}`}>
                        {emailCandidate || "未填写"}
                      </span>
                    </div>
                  )}
                  {isEditingEmail && !emailDomainAvailable && (
                    <span className="text-[11px] text-ios-gray-label block mt-1">
                      请先在系统设置配置可用邮箱域名
                    </span>
                  )}
                </div>

                {(!canEditContact || canSaveContact) && (
                  <div className="flex items-center justify-between gap-3 pt-2">
                    {!canEditContact ? (
                      <span className="text-[11px] text-ios-gray-label transition-opacity">
                        当前账号不支持修改联系方式
                      </span>
                    ) : (
                      <span />
                    )}

                    {canSaveContact && (
                      <Button
                        type="primary"
                        className="apple-btn-primary h-9 px-6 font-bold"
                        loading={savingContact}
                        onClick={handleSaveContact}
                      >
                        保存
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </section>


            <section>
              <div className="flex items-center justify-between px-1 mb-1.5">
                <h3 className="text-[11px] font-bold text-ios-gray-label uppercase tracking-widest">
                  我的工作台
                </h3>
              </div>
              <div className="rounded-2xl border border-black/5 dark:border-white/10 bg-white/80 dark:bg-[rgba(255,255,255,0.12)] p-3">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {stats.map((item) => (
                    <div
                      key={item.label}
                      className="rounded-xl border border-black/5 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.04] px-3 py-2.5"
                    >
                      <div className="text-[11px] text-ios-gray-label font-semibold">{item.label}</div>
                      <div className="text-[18px] font-bold text-black dark:text-white mt-1">
                        {item.value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

          </div>
        </div>
      </Drawer>


      <Modal
        title={mustChangePassword ? "请先修改密码" : "修改密码"}
        open={changePasswordModal || mustChangePassword}
        onCancel={() => {
          if (!mustChangePassword) {
            setChangePasswordModal(false);
          }
        }}
        closable={!mustChangePassword}
        maskClosable={!mustChangePassword}
        keyboard={!mustChangePassword}
        cancelButtonProps={mustChangePassword ? { style: { display: "none" } } : undefined}
        onOk={() => pwdForm.submit()}
        okText="确认修改"
        cancelText="取消"
        centered
        width={MODAL_WIDTH.sm}
        className="co-modal"
      >
        {mustChangePassword ? (
          <p className="muted mt-2">
            你当前使用的是初始或临时密码，修改后才能继续使用。
          </p>
        ) : null}
        <Form form={pwdForm} layout="vertical" onFinish={handleChangePassword} className="mt-4">
          <Form.Item name="oldPassword" label="当前密码" rules={[{ required: true, message: '请输入当前密码' }]}>
            <Input.Password placeholder="当前密码" className="apple-input h-11" />
          </Form.Item>
          <Form.Item
            name="newPassword"
            label="新密码"
            rules={[
              { required: true, message: '请输入新密码' },
              { min: 8, message: '密码不少于 8 位' },
              {
                pattern: STRONG_PASSWORD_PATTERN,
                message: '需包含大小写字母、数字和符号',
              },
            ]}
          >
            <Input.Password placeholder="不少于 8 位，含大小写字母、数字和符号" className="apple-input h-11" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 主题设置抽屉 */}
      <ThemeSettingsDrawer
        open={themeSettingsOpen}
        onClose={() => setThemeSettingsOpen(false)}
      />
    </div>
  );
};

export default AppLayout;

