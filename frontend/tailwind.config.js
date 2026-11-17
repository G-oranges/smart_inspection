/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class', '[data-theme="dark"]'],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        /* Crystal Omni — 引用 CSS 变量 */
        co: {
          bg:      'var(--co-bg)',
          text:    'var(--co-text)',
          muted:   'var(--co-text-muted)',
          primary: 'var(--co-primary)',
          accent:  'var(--co-accent)',
        },
        /* 保留现有 iOS 色板兼容 */
        ios: {
          blue: '#007AFF',
          gray: '#F2F2F7',
          'gray-dark': '#1C1C1E',
          'gray-label': '#3C3C4399',
          systemFill: '#7878801F',
          green: '#34C759',
          red: '#FF3B30',
          orange: '#FF9500',
          indigo: '#5856D6',
          pink: '#FF2D55',
          teal: '#30B0C7',
          yellow: '#FFCC00',
        },
        macos: {
          sidebar: 'rgba(246, 246, 246, 0.6)',
          'sidebar-dark': 'rgba(30, 30, 30, 0.6)',
          accent: '#007AFF',
        }
      },
      borderRadius: {
        'apple-xl': '20px',
        'apple-2xl': '24px',
        'glass': 'var(--co-radius-xl)',
        'glass-lg': 'var(--co-radius-2xl)',
      },
      backdropBlur: {
        'apple-xl': '20px',
        'apple-2xl': '40px',
        'glass': '40px',
      },
      boxShadow: {
        'ios': '0 2px 10px rgba(0,0,0,0.05)',
        'macos': '0 4px 20px rgba(0,0,0,0.1)',
        'glass': 'var(--co-glass-shadow)',
        'glass-lg': 'var(--co-glass-shadow-lg)',
      },
      fontFamily: {
        display: ['Inter', '-apple-system', 'BlinkMacSystemFont',
                  'PingFang SC', 'Hiragino Sans GB',
                  'Microsoft YaHei', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
