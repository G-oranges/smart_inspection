import React from "react";
import { Row } from "antd";
import type { ReactNode } from "react";
import { useMobile } from "../hooks/useMobile";

interface PageLayoutProps {
  title?: ReactNode;
  eyebrow?: ReactNode;
  subtitle?: ReactNode;
  stats?: ReactNode;
  statsLayout?: 'row' | 'custom';
  filters?: ReactNode;
  sidebarFilters?: ReactNode;
  children?: ReactNode;
  extraHeroContent?: ReactNode;
  enableSplitLayout?: boolean;
}

/**
 * 苹果生态风格页面基础布局
 * 支持宽屏分栏布局 (xl 断点以上时启用左侧筛选面板 + 右侧内容区)
 *
 * @param {React.ReactNode} stats - 统计卡片内容
 * @param {React.ReactNode} filters - 筛选器内容 (普通布局) 或工具栏内容 (分栏布局)
 * @param {React.ReactNode} sidebarFilters - 侧边栏筛选内容 (仅分栏布局时显示)
 * @param {React.ReactNode} children - 主内容区域
 * @param {boolean} enableSplitLayout - 是否启用宽屏分栏布局 (默认 true)
 */
const PageLayout = ({
  title,
  eyebrow,
  subtitle,
  stats,
  statsLayout = 'row',
  filters,
  sidebarFilters,
  children,
  extraHeroContent,
  enableSplitLayout = true,
}: PageLayoutProps) => {
  const isMobile = useMobile();

  // 判断是否应用分栏布局 (仅非移动端且启用时)
  const useSplitLayout = enableSplitLayout && !isMobile && sidebarFilters;

  return (
    <div className="space-y-6 co-animate-in">
      {(title || eyebrow || subtitle) && (
        <div className="space-y-2">
          {eyebrow ? (
            <div className="text-xs font-bold text-co-muted uppercase tracking-[0.22em]">
              {eyebrow}
            </div>
          ) : null}
          {title ? (
            <h1 className="text-3xl font-black tracking-tight text-black/85 dark:text-white">
              {title}
            </h1>
          ) : null}
          {subtitle ? (
            <p className="max-w-3xl text-sm leading-6 text-black/55 dark:text-white/55">
              {subtitle}
            </p>
          ) : null}
        </div>
      )}

      {/* 额外的 Hero 内容区域 (如视图切换器等) */}
      {extraHeroContent && (
        <div className="flex items-center justify-between">
          {extraHeroContent}
        </div>
      )}

      {/* 状态统计区域 - 采用 Apple Stat Card 容器样式 */}
      {stats && (
        statsLayout === 'custom' ? (
          stats
        ) : (
          <Row gutter={[16, 16]} className="items-stretch">
            {stats}
          </Row>
        )
      )}

      {/* 宽屏分栏布局 (xl 断点以上) */}
      {useSplitLayout ? (
        <div className="hidden xl:grid xl:grid-cols-[280px,1fr] xl:gap-6 xl:items-start">
          {/* 左侧：粘性筛选面板 */}
          <aside className="sticky top-4 h-fit">
            <div className="co-glass-panel-heavy p-5 rounded-[20px] space-y-5">
              <div className="text-xs font-bold text-co-muted uppercase tracking-widest mb-4">
                筛选条件
              </div>
              {sidebarFilters}
            </div>
          </aside>

          {/* 右侧：主内容区 */}
          <div className="space-y-5">
            {/* 顶部工具栏 (搜索 + 操作按钮) */}
            {filters && (
              <div className="co-glass-panel p-4 rounded-[20px] relative z-20">
                {filters}
              </div>
            )}

            {/* 主内容区域 */}
            <div className="co-glass-panel p-6 rounded-[24px]">{children}</div>
          </div>
        </div>
      ) : null}

      {/* 默认布局 (移动端 + < xl 断点) */}
      <div className={useSplitLayout ? "xl:hidden" : ""}>
        {/* 筛选与控制区 - 玻璃拟态面板 */}
        {filters && (
          <div className="co-glass-panel p-5 rounded-[24px] mb-6 relative z-30">
            {filters}
          </div>
        )}

        {/* 主内容区域 - 玻璃拟态面板 */}
        <div className="co-glass-panel p-6 rounded-[24px]">{children}</div>
      </div>
    </div>
  );
};

export default PageLayout;
