import React from 'react';
import { ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';

type DotColor =
  | 'blue'
  | 'green'
  | 'orange'
  | 'red'
  | 'purple'
  | 'pink'
  | 'teal'
  | 'gray';

interface AppleStatCardProps {
  icon?: React.ReactNode;
  value: string | number;
  subValue?: string | number;
  label: string;
  dotColor?: DotColor;
  unit?: string;
  trend?: number | null;
  onClick?: () => void;
  className?: string;
}

/**
 * Apple HIG 风格统计卡片组件 v2.1
 * 参照 iOS Widget、macOS 控制中心、visionOS 设计语言
 * 
 * @param {React.ReactNode} icon - 图标
 * @param {string|number} value - 主数值
 * @param {string|number} subValue - 次要数值 (可选，与 value 形成 value/subValue 形式)
 * @param {string} label - 标签文本
 * @param {string} dotColor - 状态点颜色 (blue, green, orange, red, purple, pink, teal, gray)
 * @param {string} unit - 单位 (可选)
 * @param {number} trend - 趋势值 (可选，正数为上升趋势，负数为下降趋势)
 * @param {function} onClick - 点击回调 (可选)
 */
const AppleStatCard = ({ 
  icon, 
  value, 
  subValue, 
  label, 
  dotColor = 'blue', 
  unit = '',
  trend,
  onClick,
  className = '',
}: AppleStatCardProps) => {
  // iOS 系统色彩映射
  const colorMap: Record<DotColor, { main: string; glow: string }> = {
    blue: { main: '#007AFF', glow: 'rgba(0, 122, 255, 0.4)' },
    green: { main: '#34C759', glow: 'rgba(52, 199, 89, 0.4)' },
    orange: { main: '#FF9500', glow: 'rgba(255, 149, 0, 0.4)' },
    red: { main: '#FF3B30', glow: 'rgba(255, 59, 48, 0.4)' },
    purple: { main: '#AF52DE', glow: 'rgba(175, 82, 222, 0.4)' },
    pink: { main: '#FF2D55', glow: 'rgba(255, 45, 85, 0.4)' },
    teal: { main: '#5AC8FA', glow: 'rgba(90, 200, 250, 0.4)' },
    gray: { main: '#8E8E93', glow: 'rgba(142, 142, 147, 0.3)' },
  };

  const color = colorMap[dotColor];
  const hasTrend = trend !== undefined && trend !== null && trend !== 0;

  return (
    <div 
      className={`
        apple-stat-card
        relative overflow-hidden
        rounded-[20px] p-5
        bg-white/30 dark:bg-zinc-900/30
        backdrop-blur-xl
        border border-white/10 dark:border-white/10
        shadow-lg shadow-black/5 dark:shadow-black/20
        transition-all duration-300 ease-out
        hover:shadow-xl hover:shadow-black/10 dark:hover:shadow-black/30
        hover:-translate-y-0.5
        active:scale-[0.98] active:shadow-md
        ${onClick ? 'cursor-pointer' : ''}
        ${className}
        group
      `}
      onClick={onClick}
      style={{ minHeight: '100px' }}
    >
      {/* 背景渐变光晕 (悬停时显示) */}
      <div 
        className="absolute -right-8 -top-8 w-32 h-32 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-3xl pointer-events-none"
        style={{ background: color.glow }}
      />

      {/* 顶部：图标容器 */}
      <div 
        className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 shadow-sm transition-transform duration-300 group-hover:scale-105"
        style={{ 
          background: `linear-gradient(135deg, ${color.main}25, ${color.main}10)`,
          border: `1px solid ${color.main}40`,
        }}
      >
        <span className="text-lg" style={{ color: color.main }}>
          {icon}
        </span>
      </div>

      {/* 中间：数值区域 - 响应式字号，防止溢出 */}
      <div className="flex items-baseline gap-1 sm:gap-1.5 mb-1.5 flex-wrap max-w-full overflow-hidden">
        <span 
          className="text-[24px] sm:text-[28px] md:text-[32px] font-black tracking-tight text-black/90 dark:text-white leading-none"
          style={{ fontFamily: '"Arial Black", sans-serif' }}
        >
          {value}
        </span>
        {subValue !== undefined && (
          <>
            <span className="text-base sm:text-lg md:text-xl text-black/15 dark:text-white/15 font-light">/</span>
            <span 
              className="text-sm sm:text-base md:text-lg text-black/40 dark:text-white/40 font-semibold"
              style={{ fontFamily: '"Arial Black", sans-serif' }}
            >
              {subValue}
            </span>
          </>
        )}
        {unit && (
          <span className="text-xs sm:text-sm text-black/40 dark:text-white/40 font-medium ml-0.5">{unit}</span>
        )}
        
        {/* 趋势指示标签 */}
        {hasTrend && (
          <span className={`
            ml-2 px-1.5 py-0.5 rounded-md text-[11px] font-bold flex items-center gap-0.5
            ${trend > 0 
              ? 'bg-[#34C759]/15 text-[#34C759]' 
              : 'bg-[#FF3B30]/15 text-[#FF3B30]'
            }
          `}>
            {trend > 0 ? <ArrowUpOutlined className="text-[9px]" /> : <ArrowDownOutlined className="text-[9px]" />}
            {Math.abs(trend)}%
          </span>
        )}
      </div>

      {/* 底部：标签 + 脉搏状态点 */}
      <div className="flex items-center gap-2">
        {/* 脉搏动画状态点 */}
        <span className="relative flex h-2 w-2">
          <span 
            className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60"
            style={{ backgroundColor: color.main }}
          />
          <span 
            className="relative inline-flex rounded-full h-2 w-2"
            style={{ backgroundColor: color.main, boxShadow: `0 0 8px ${color.glow}` }}
          />
        </span>
        <span className="text-[12px] font-semibold text-black/50 dark:text-white/40 uppercase tracking-wide">
          {label}
        </span>
      </div>
    </div>
  );
};

export default AppleStatCard;
