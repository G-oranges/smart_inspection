import { useMemo, useEffect, useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Alert, Button, Typography, theme } from 'antd';
import { 
  DownloadOutlined, 
  SaveOutlined, 
  TagOutlined, 
  SettingOutlined, 
  EyeOutlined, 
  MinusCircleOutlined, 
  EnvironmentOutlined, 
  UserOutlined, 
  FileDoneOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';

import { useAppContext } from '../context/AppContext';
import PermissionDeniedState from '../components/common/PermissionDeniedState';
import { adminSettingsPermissionPreset } from '../components/common/permissionDeniedPresets';
import CollapsibleStatsBoard from '../components/stats/CollapsibleStatsBoard';
import {
  AdminSettingsStats,
  DeductionConfigSection,
  DisplayConfigSection,
  GradingRulesSection,
  LocationConfigSection,
  mapAdminSettingsStatsToSegments,
  ScoringContactSection,
  TEMPLATE_OPTIONS,
  useAdminSettingsActions,
} from './admin-settings';

import type { AdminSettingsActions } from './admin-settings/types';

const { Title } = Typography;

/**
 * 设置页面分区配置
 */
const SETTINGS_SECTIONS = [
  { id: 'grading-rules', title: '评分规则', icon: <TagOutlined /> },
  { id: 'scoring-contact', title: '评分与联系配置', icon: <SettingOutlined /> },
  { id: 'display-config', title: '界面显示配置', icon: <EyeOutlined /> },
  { id: 'deduction-config', title: '扣分配置', icon: <MinusCircleOutlined /> },
  { id: 'location-config', title: '扣分位置管理', icon: <EnvironmentOutlined /> },
  { id: 'permission-entry', title: '权限管理入口', icon: <UserOutlined /> },
  { id: 'template-download', title: '模板下载', icon: <FileDoneOutlined /> },
];

export default function AdminSettingsPage() {
  const {
    hasPermission,
    settings,
    actions: appActions,
    activeRole,
    fontSizeScale,
    setFontSizeScale,
  } = useAppContext();
  const navigate = useNavigate();
  const location = useLocation();
  const { token } = theme.useToken();

  // 状态与逻辑
  const actions = useMemo<AdminSettingsActions>(() => {
    const updateSettings =
      typeof appActions.updateSettings === 'function'
        ? appActions.updateSettings
        : async () => {
            throw new Error('当前无法保存设置，请刷新后重试');
          };
    const downloadTemplate =
      typeof appActions.downloadTemplate === 'function'
        ? appActions.downloadTemplate
        : async () => {
            throw new Error('当前无法下载模板，请刷新后重试');
          };

    return {
      updateSettings: (payload) => updateSettings(payload),
      downloadTemplate: async (type) => {
        const result = await downloadTemplate(type);
        if (!(result instanceof Blob)) {
          throw new Error('模板下载失败');
        }
        return result;
      },
    };
  }, [appActions.downloadTemplate, appActions.updateSettings]);

  const {
    draft,
    setDraft,
    emailDomainDraft,
    setEmailDomainDraft,
    saving,
    error,
    message,
    isDirty,
    handleSave,
    handleTemplateDownload,
    handleAddEmailDomain,
    handleRemoveEmailDomain,
    handleRuleChange,
    handleLabelChange,
    handleDeductionChange,
    handleDeductionToggle,
    handleAddDeduction,
    handleRemoveDeduction,
    handleAddLocation,
    handleRemoveLocation,
    handleLocationChange,
  } = useAdminSettingsActions({
    settings,
    actions,
    location,
    navigate,
  });

  // 滚动监听 (Scrollspy)
  const [activeSection, setActiveSection] = useState(SETTINGS_SECTIONS[0].id);
  const isScrollingRef = useRef(false);

  useEffect(() => {
    const observerOptions = {
      root: null,
      rootMargin: '-10% 0px -45% 0px', // 扩大检测范围
      threshold: [0, 0.1, 0.5, 1.0],
    };

    const observerCallback = (entries: IntersectionObserverEntry[]) => {
      // 如果是用户点击导航触发的滚动，暂时忽略监听
      if (isScrollingRef.current) return;

      // 找到当前在视口中最显著的元素
      const intersectingEntries = entries.filter(e => e.isIntersecting);
      if (intersectingEntries.length > 0) {
        // 按交集比例排序，取最显著的
        const sorted = intersectingEntries.sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        setActiveSection(sorted[0].target.id);
      }
    };

    const observer = new IntersectionObserver(observerCallback, observerOptions);

    SETTINGS_SECTIONS.forEach((section) => {
      const el = document.getElementById(section.id);
      if (el) {
        observer.observe(el);
      }
    });

    // 处理触底情况：当滚动到页面底部时，强制高亮最后一个分区
    const handleScroll = () => {
      const scrollHeight = document.documentElement.scrollHeight;
      const scrollTop = document.documentElement.scrollTop || document.body.scrollTop;
      const clientHeight = document.documentElement.clientHeight;

      // 距离底部 50px 以内
      if (scrollTop + clientHeight >= scrollHeight - 50) {
        setActiveSection(SETTINGS_SECTIONS[SETTINGS_SECTIONS.length - 1].id);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const scrollToSection = (id: string) => {
    isScrollingRef.current = true;
    setActiveSection(id);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    // 延迟恢复监听，避免平滑滚动过程中的干扰
    setTimeout(() => {
      isScrollingRef.current = false;
    }, 800);
  };


  const allowed = activeRole?.code === 'ADMIN' && hasPermission('SYSTEM_SETTINGS');

  if (!allowed) {
    return (
      <PermissionDeniedState
        {...adminSettingsPermissionPreset}
        actionText="返回上一页"
        onAction={() => navigate(-1)}
      />
    );
  }

  // 渲染 Section 外壳
  const renderSection = (id: string, title: string, icon: React.ReactNode, children: React.ReactNode) => (
    <div id={id} className="admin-settings-section-panel co-animate-in">
      <div className="admin-settings-section-header">
        <span style={{ color: token.colorPrimary, fontSize: '18px' }} className="flex items-center opacity-80">{icon}</span>
        <Title level={5} className="admin-settings-section-title">{title}</Title>
      </div>
      <div className="admin-settings-section-body">
        {children}
      </div>
    </div>
  );

  return (
    <div className="admin-settings-page management-theme-page co-animate-in">

      {/* 统计指标区 - 压扁感 */}
      <CollapsibleStatsBoard
        expandedContent={<AdminSettingsStats draft={draft} fontSizeScale={fontSizeScale} />}
        segments={mapAdminSettingsStatsToSegments(draft, fontSizeScale)}
      />

      {/* 移动端吸顶导航 */}
      <div className="admin-settings-mobile-nav">
        <div className="admin-settings-mobile-nav-scroll">
          {SETTINGS_SECTIONS.map((section) => (
            <button
              key={section.id}
              className={`admin-settings-mobile-nav-item ${activeSection === section.id ? 'active' : ''}`}
              onClick={() => scrollToSection(section.id)}
            >
              {section.title}
            </button>
          ))}
        </div>
      </div>

      <div className="admin-settings-workbench">
        {/* 左侧垂直导航栏 (桌面端) */}
        <aside className="admin-settings-sidebar">
          <div className="admin-settings-nav-card">
            <div className="px-3 py-2 text-[11px] font-bold text-co-muted uppercase tracking-widest opacity-60">
              设置分区
            </div>
            <div className="flex flex-col">
              {SETTINGS_SECTIONS.map((section) => (
                <div
                  key={section.id}
                  className={`admin-settings-nav-item ${activeSection === section.id ? 'active' : ''}`}
                  onClick={() => scrollToSection(section.id)}
                >
                  <i>{section.icon}</i>
                  <span>{section.title}</span>
                </div>
              ))}
            </div>

            {/* 侧边栏保存区 */}
            <div className="admin-settings-sidebar-footer">
              {isDirty && (
                <div className="px-1 py-1 flex items-center gap-2 text-orange-500 co-animate-in">
                  <ExclamationCircleOutlined className="text-xs" />
                  <span className="text-[11px] font-semibold">有未保存的修改</span>
                </div>
              )}
              <Button
                type="primary"
                icon={<SaveOutlined />}
                onClick={handleSave}
                loading={saving}
                block
                className="apple-btn-primary"
              >
                保存全局设置
              </Button>
            </div>
          </div>
        </aside>

        {/* 右侧主内容区 */}
        <main className="admin-settings-content">
          {message && (
            <Alert
              type="success"
              showIcon
              message={message}
              className="rounded-xl border-none bg-green-500/10 text-green-600 dark:text-green-400 co-animate-in"
            />
          )}

          {error && (
            <Alert
              type="error"
              showIcon
              message={error}
              className="rounded-xl border-none bg-red-500/10 text-red-600 dark:text-red-400 co-animate-in"
            />
          )}

          {/* 各个分区 */}
          {renderSection('grading-rules', '评分规则', <TagOutlined />, (
            <GradingRulesSection
              gradeRules={draft.gradingRules}
              handleLabelChange={handleLabelChange}
              handleRuleChange={handleRuleChange}
            />
          ))}

          {renderSection('scoring-contact', '评分与联系配置', <SettingOutlined />, (
            <ScoringContactSection
              draft={draft}
              setDraft={setDraft}
              emailDomainDraft={emailDomainDraft}
              setEmailDomainDraft={setEmailDomainDraft}
              handleAddEmailDomain={handleAddEmailDomain}
              handleRemoveEmailDomain={handleRemoveEmailDomain}
            />
          ))}

          {renderSection('display-config', '界面显示配置', <EyeOutlined />, (
            <DisplayConfigSection
              fontSizeScale={fontSizeScale}
              setFontSizeScale={setFontSizeScale}
            />
          ))}

          {renderSection('deduction-config', '扣分配置', <MinusCircleOutlined />, (
            <DeductionConfigSection
              deductionItems={draft.deductionItems}
              handleAddDeduction={handleAddDeduction}
              handleDeductionChange={handleDeductionChange}
              handleDeductionToggle={handleDeductionToggle}
              handleRemoveDeduction={handleRemoveDeduction}
            />
          ))}

          {renderSection('location-config', '扣分位置管理', <EnvironmentOutlined />, (
            <LocationConfigSection
              locationOptions={draft.locationOptions}
              handleAddLocation={handleAddLocation}
              handleLocationChange={handleLocationChange}
              handleRemoveLocation={handleRemoveLocation}
            />
          ))}

          {renderSection('permission-entry', '权限管理入口', <UserOutlined />, (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-blue-50/50 dark:bg-blue-900/10 border border-blue-200/20 flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/10 text-blue-500 rounded-lg">
                    <UserOutlined className="text-lg" />
                  </div>
                  <div className="text-[13px] text-co-text">
                    角色与用户权限请在用户与权限管理中配置
                  </div>
                </div>
                <Button type="primary" size="small" onClick={() => navigate('/accounts')} className="rounded-lg h-8 text-[11px]">
                  前往用户与权限管理
                </Button>
              </div>
            </div>
          ))}

          {renderSection('template-download', '模板下载', <FileDoneOutlined />, (
            <div className="flex flex-wrap gap-3">
              {TEMPLATE_OPTIONS.map((item) => (
                <Button
                  key={item.type}
                  icon={<DownloadOutlined />}
                  onClick={() => {
                    void handleTemplateDownload(item.type);
                  }}
                  className="co-glass-btn h-10 rounded-xl px-6 text-xs font-medium border-black/5 dark:border-white/5"
                >
                  下载{item.label}
                </Button>
              ))}
            </div>
          ))}
        </main>
      </div>
    </div>
  );
}
