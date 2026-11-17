/**
 * Ant Design v6 主题配置
 * 实现模块化、统一化的夜间模式管理
 */

import type { ThemeConfig } from 'antd';
import { theme as antTheme } from "antd";

// ==========================================
// 1. 基础 Token (Light/Dark 共享)
// ==========================================
export const baseToken: NonNullable<ThemeConfig['token']> = {
  fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Icons", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "微软雅黑", "Helvetica Neue", "Helvetica", "Arial", sans-serif',
  borderRadius: 12, // iOS 默认圆角较大
  borderRadiusSM: 8,
  borderRadiusLG: 16,
  borderRadiusXS: 4,
  
  // Apple 品牌色配置 (iOS System Blue)
  colorPrimary: "#007AFF",
  colorPrimaryHover: "#0062CC",
  colorPrimaryActive: "#004099",
  colorPrimaryBg: "rgba(0, 122, 255, 0.1)",
  
  // Apple 状态色
  colorSuccess: "#34C759", // iOS Green
  colorWarning: "#FF9500", // iOS Orange
  colorError: "#FF3B30",   // iOS Red
  colorInfo: "#007AFF",
};

// ==========================================
// 2. 浅色模式专用 Token & 组件覆盖
// ==========================================
export const lightConfig: ThemeConfig = {
  algorithm: antTheme.defaultAlgorithm,
  token: {
    ...baseToken,
    colorTextBase: "#000000",
    colorBgBase: "#F2F2F7", // iOS System Background (Secondary)
    colorBgContainer: "#FFFFFF",
    colorBorder: "rgba(0, 0, 0, 0.05)",
    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
    boxShadowSecondary: "0 8px 32px rgba(0, 0, 0, 0.08)",
  },
  components: {
    Button: {
      borderRadius: 12, // 圆角矩形
      fontWeight: 600,
      controlHeight: 44,
      paddingContentHorizontal: 24,
      defaultBg: "#F2F2F7",
      defaultBorderColor: "transparent",
      primaryShadow: "0 4px 12px rgba(0, 122, 255, 0.3)",
    },
    Card: {
      borderRadiusLG: 24,
      paddingLG: 20,
      boxShadowTertiary: "0 8px 32px rgba(0, 0, 0, 0.04)",
    },
    Table: {
      borderRadius: 12,
      headerBg: "rgba(0, 0, 0, 0.02)",
      headerColor: "rgba(0, 0, 0, 0.45)",
    },
    Modal: {
      borderRadiusLG: 28, // 更大的弹窗圆角
      paddingContentHorizontalLG: 32,
      paddingMD: 32,
      headerBg: "transparent",
      footerBg: "transparent",
      titleFontSize: 20,
      titleLineHeight: 1.6,
      contentBg: "#FFFFFF",
    },
    Input: {
      controlHeight: 44,
      colorBgContainer: "#F2F2F7",
      colorBorder: "transparent",
      borderRadius: 12,
      activeBorderColor: "#007AFF",
      hoverBorderColor: "transparent",
      controlOutlineWidth: 0,
      paddingInline: 16,
    },
    InputNumber: {
      controlHeight: 44,
      colorBgContainer: "#F2F2F7",
      colorBorder: "transparent",
      borderRadius: 12,
      handleVisible: true as const,
    },
    Select: {
      controlHeight: 44,
      colorBgContainer: "#F2F2F7",
      colorBorder: "transparent",
      borderRadius: 12,
      selectorBg: "#F2F2F7",
      optionSelectedBg: "#E5E5EA",
      optionPadding: "10px 16px",
    },
    DatePicker: {
      controlHeight: 44,
      colorBgContainer: "#F2F2F7",
      colorBorder: "transparent",
      borderRadius: 12,
      activeBorderColor: "#007AFF",
      hoverBorderColor: "transparent",
      controlOutlineWidth: 0,
    },
    Segmented: {
      borderRadius: 10,
      itemSelectedBg: "#FFFFFF",
      trackBg: "rgba(118, 118, 128, 0.12)",
      controlHeight: 32,
    }
  }
};

// ==========================================
// 3. 深色模式专用 Token & 组件覆盖 (Modular Dark Mode)
// ==========================================
export const darkConfig: ThemeConfig = {
  algorithm: antTheme.darkAlgorithm,
  token: {
    ...baseToken,
    // iOS 系统深色背景
    colorBgLayout: "#000000",                // 主背景
    colorBgContainer: "#1C1C1E",             // 容器背景 (Secondary)
    colorBgElevated: "#2C2C2E",              // 悬浮层 (Tertiary)
    
    colorText: "#FFFFFF",
    colorTextSecondary: "rgba(235, 235, 245, 0.6)",
    colorBorder: "rgba(255, 255, 255, 0.1)",
    colorBorderSecondary: "rgba(255, 255, 255, 0.05)",
    
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.4)",
    boxShadowSecondary: "0 20px 60px rgba(0, 0, 0, 0.6)",
  },
  components: {
    Button: {
      borderRadius: 12, // 圆角矩形
      fontWeight: 600,
      controlHeight: 44,
      defaultBg: "rgba(255, 255, 255, 0.1)",
      defaultBorderColor: "transparent",
      defaultColor: "#FFFFFF",
      paddingContentHorizontal: 24,
    },
    Card: {
      borderRadiusLG: 24,
      paddingLG: 20,
      colorBgContainer: "#1C1C1E",
    },
    Table: {
      borderRadius: 12,
      headerBg: "rgba(255, 255, 255, 0.04)",
      headerColor: "rgba(235, 235, 245, 0.6)",
      colorBgContainer: "transparent",
    },
    Input: {
      controlHeight: 44,
      colorBgContainer: "rgba(255, 255, 255, 0.08)",
      colorBorder: "transparent",
      borderRadius: 12,
      activeBorderColor: "#007AFF",
      hoverBorderColor: "transparent",
      controlOutlineWidth: 0,
    },
    InputNumber: {
      controlHeight: 44,
      colorBgContainer: "rgba(255, 255, 255, 0.08)",
      colorBorder: "transparent",
      borderRadius: 12,
    },
    Select: {
      controlHeight: 44,
      colorBgContainer: "rgba(255, 255, 255, 0.08)",
      colorBgElevated: "#2C2C2E",
      colorBorder: "transparent",
      borderRadius: 12,
      selectorBg: "rgba(255, 255, 255, 0.08)",
    },
    DatePicker: {
      controlHeight: 44,
      colorBgContainer: "rgba(255, 255, 255, 0.08)",
      colorBorder: "transparent",
      borderRadius: 12,
      activeBorderColor: "#007AFF",
    },
    Modal: {
      borderRadiusLG: 28,
      colorBgElevated: "#1C1C1E", // 弹窗容器背景
      headerBg: "transparent",
      footerBg: "transparent",
      paddingContentHorizontalLG: 32,
      paddingMD: 32,
    },
    Segmented: {
      borderRadius: 10,
      itemSelectedBg: "#636366",
      trackBg: "rgba(118, 118, 128, 0.24)",
      controlHeight: 32,
    }
  }
};

// ==========================================
// 4. 移动端字体缩放配置
// ==========================================
export const mobileTokenOverride: NonNullable<ThemeConfig['token']> = {
  fontSize: 15, // iOS 默认正文字体较大 (17pt/15pt)
  fontSizeSM: 13,
  fontSizeLG: 17,
  fontSizeXL: 19,
};

/**
 * 获取完整的主题配置
 * @param {string} mode 'light' | 'dark'
 * @param {boolean} isMobile 是否为移动端
 * @param {number} fontSizeScale 字体缩放系数 (如 0.9, 1.0, 1.1)
 * @returns {object} Ant Design Theme Config
 */
export const getThemeConfig = (
  mode: 'light' | 'dark',
  isMobile = false,
  fontSizeScale = 1.0,
): ThemeConfig => {
  const config = mode === "dark" ? darkConfig : lightConfig;
  
  // 基础字体大小定义
  const baseFontSize = 14;
  
  // 综合计算缩放比例
  // 如果是移动端，我们在用户设置的 scale 基础上额外缩小一点 (可选，这里设定为用户 scale * 0.95)
  const finalScale = isMobile ? fontSizeScale * 0.95 : fontSizeScale;

  const fontToken = {
    fontSize: Math.round(baseFontSize * finalScale),
    fontSizeSM: Math.round((baseFontSize - 2) * finalScale),
    fontSizeLG: Math.round((baseFontSize + 2) * finalScale),
    fontSizeXL: Math.round((baseFontSize + 4) * finalScale),
    fontSizeHeading1: Math.round(38 * finalScale),
    fontSizeHeading2: Math.round(30 * finalScale),
    fontSizeHeading3: Math.round(24 * finalScale),
    fontSizeHeading4: Math.round(20 * finalScale),
    fontSizeHeading5: Math.round(16 * finalScale),
  };

  return {
    cssVar: {
      key: 'app',
    }, // 启用 CSS 变量模式
    algorithm: config.algorithm,
    token: {
      ...config.token,
      ...fontToken,
    },
    components: config.components,
  };
};

export default getThemeConfig;
