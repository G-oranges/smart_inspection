/**
 * 自定义主题管理 Hook
 * @module hooks/useThemeCustomization
 *
 * 管理内置背景主题切换 + 自定义背景上传
 * 通过 CSS 变量 --app-bg-image 驱动布局背景
 */
import { useState, useEffect, useCallback, useRef } from 'react';

import type { ThemeCustomizationState, ThemePreset } from '../types/app';

// ==================== 内置背景主题 ====================
export const THEME_PRESETS: ThemePreset[] = [
  {
    key: "default",
    label: "默认",
    emoji: "⚪",
    // 无背景图，使用原始 Tailwind 底色
    value: "none",
  },
  {
    key: "aurora",
    label: "极光蓝",
    emoji: "🌊",
    value:
      "radial-gradient(ellipse at 20% 50%, rgba(56,189,248,0.2) 0%, transparent 50%), " +
      "radial-gradient(ellipse at 80% 20%, rgba(139,92,246,0.15) 0%, transparent 50%), " +
      "radial-gradient(ellipse at 40% 80%, rgba(34,211,238,0.12) 0%, transparent 50%), " +
      "linear-gradient(135deg, #e0f2fe 0%, #f0f9ff 30%, #ede9fe 70%, #f5f3ff 100%)",
    darkValue:
      "radial-gradient(ellipse at 20% 50%, rgba(56,189,248,0.12) 0%, transparent 50%), " +
      "radial-gradient(ellipse at 80% 20%, rgba(139,92,246,0.1) 0%, transparent 50%), " +
      "radial-gradient(ellipse at 40% 80%, rgba(34,211,238,0.08) 0%, transparent 50%), " +
      "linear-gradient(135deg, #0c1222 0%, #0f172a 50%, #1a1033 100%)",
  },
  {
    key: "warm-sun",
    label: "暖阳橙",
    emoji: "🌅",
    value:
      "radial-gradient(ellipse at 30% 20%, rgba(251,146,60,0.15) 0%, transparent 50%), " +
      "radial-gradient(ellipse at 70% 60%, rgba(251,191,36,0.12) 0%, transparent 50%), " +
      "radial-gradient(ellipse at 50% 90%, rgba(244,114,182,0.1) 0%, transparent 50%), " +
      "linear-gradient(135deg, #fff7ed 0%, #fffbeb 40%, #fef2f2 80%, #fff1f2 100%)",
    darkValue:
      "radial-gradient(ellipse at 30% 20%, rgba(251,146,60,0.1) 0%, transparent 50%), " +
      "radial-gradient(ellipse at 70% 60%, rgba(251,191,36,0.08) 0%, transparent 50%), " +
      "radial-gradient(ellipse at 50% 90%, rgba(244,114,182,0.06) 0%, transparent 50%), " +
      "linear-gradient(135deg, #1c1210 0%, #1a1412 50%, #18100e 100%)",
  },
  {
    key: "forest",
    label: "森林绿",
    emoji: "🌿",
    value:
      "radial-gradient(ellipse at 25% 30%, rgba(52,211,153,0.15) 0%, transparent 50%), " +
      "radial-gradient(ellipse at 75% 70%, rgba(16,185,129,0.12) 0%, transparent 50%), " +
      "radial-gradient(ellipse at 50% 10%, rgba(167,243,208,0.1) 0%, transparent 50%), " +
      "linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 40%, #f0fdfa 80%, #f5f3ff 100%)",
    darkValue:
      "radial-gradient(ellipse at 25% 30%, rgba(52,211,153,0.1) 0%, transparent 50%), " +
      "radial-gradient(ellipse at 75% 70%, rgba(16,185,129,0.08) 0%, transparent 50%), " +
      "radial-gradient(ellipse at 50% 10%, rgba(167,243,208,0.05) 0%, transparent 50%), " +
      "linear-gradient(135deg, #0a1612 0%, #0f1a16 50%, #0c1810 100%)",
  },
  {
    key: "starry",
    label: "星空紫",
    emoji: "🌌",
    value:
      "radial-gradient(ellipse at 20% 80%, rgba(139,92,246,0.15) 0%, transparent 50%), " +
      "radial-gradient(ellipse at 80% 30%, rgba(99,102,241,0.12) 0%, transparent 50%), " +
      "radial-gradient(ellipse at 50% 50%, rgba(168,85,247,0.08) 0%, transparent 50%), " +
      "linear-gradient(135deg, #faf5ff 0%, #f5f3ff 40%, #eef2ff 80%, #ede9fe 100%)",
    darkValue:
      "radial-gradient(ellipse at 20% 80%, rgba(139,92,246,0.12) 0%, transparent 50%), " +
      "radial-gradient(ellipse at 80% 30%, rgba(99,102,241,0.1) 0%, transparent 50%), " +
      "radial-gradient(ellipse at 50% 50%, rgba(168,85,247,0.06) 0%, transparent 50%), " +
      "linear-gradient(135deg, #0f0a1a 0%, #110e1e 50%, #0c0a18 100%)",
  },
];

const STORAGE_KEY = 'themeCustomization';

interface StoredThemeCustomization {
  bgPreset?: string;
  customBgUrl?: string | null;
}

/**
 * 读取持久化的主题配置
 */
function loadSavedTheme(): StoredThemeCustomization | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredThemeCustomization;
  } catch {
    return null;
  }
}

/**
 * 自定义主题管理 Hook

/**
 * 自定义主题管理 Hook
 * @returns {Object} 主题状态和操作方法
 */
export default function useThemeCustomization(): ThemeCustomizationState {
  const saved = loadSavedTheme();
  const [bgPreset, setBgPreset] = useState(saved?.bgPreset || 'default');
  const [customBgUrl, setCustomBgUrl] = useState(saved?.customBgUrl || null);

  // 使用 ref 追踪最新状态，供 MutationObserver 读取，
  // 避免 Observer 和主 effect 双重执行 applyBackground
  const bgPresetRef = useRef(bgPreset);
  bgPresetRef.current = bgPreset;
  const customBgUrlRef = useRef(customBgUrl);
  customBgUrlRef.current = customBgUrl;

  /**
   * 应用背景到 CSS 变量
   */
  const applyBackground = useCallback(
    (presetKey: string, customUrl: string | null, isDark: boolean) => {
      const root = document.documentElement;

      // 自定义背景优先
      if (customUrl) {
        root.style.setProperty(
          '--app-bg-image',
          `url(${customUrl})`,
        );
        return;
      }

      // 内置预设
      const preset = THEME_PRESETS.find((p) => p.key === presetKey);
      if (!preset || presetKey === 'default') {
        root.style.setProperty('--app-bg-image', 'none');
        return;
      }

      const bgValue = isDark && preset.darkValue ? preset.darkValue : preset.value;
      root.style.setProperty("--app-bg-image", bgValue);
    },
    []
  );

  // 监听外部 data-theme 属性变化（如系统主题切换），通过 ref 读取最新状态
  // 仅在 mount 时创建一次 observer，不随 bgPreset/customBgUrl 变化重建
  useEffect(() => {
    const observer = new MutationObserver(() => {
      const isDark =
        document.documentElement.getAttribute('data-theme') === 'dark';
      applyBackground(bgPresetRef.current, customBgUrlRef.current, isDark);
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => observer.disconnect();
  }, [applyBackground]);

  // bgPreset 或 customBgUrl 变化时应用背景（初始化 + 用户切换预设）
  useEffect(() => {
    const isDark =
      document.documentElement.getAttribute('data-theme') === 'dark';
    applyBackground(bgPreset, customBgUrl, isDark);
  }, [bgPreset, customBgUrl, applyBackground]);
  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ bgPreset, customBgUrl })
    );
  }, [bgPreset, customBgUrl]);

  /**
   * 选择内置预设
   */
  const selectPreset = useCallback((key: string) => {
    setBgPreset(key);
    setCustomBgUrl(null); // 选预设时清除自定义
  }, []);

  /**
   * 设置自定义背景 URL
   */
  const setCustomBackground = useCallback((url: string | null) => {
    setCustomBgUrl(url);
    setBgPreset('custom');
  }, []);

  /**
   * 重置为默认
   */
  const resetToDefault = useCallback(() => {
    setBgPreset('default');
    setCustomBgUrl(null);
  }, []);

  return {
    bgPreset,
    customBgUrl,
    selectPreset,
    setCustomBackground,
    resetToDefault,
    presets: THEME_PRESETS,
  };
}
