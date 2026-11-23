import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from 'tailwindcss'
import autoprefixer from 'autoprefixer'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'pwa-icon.svg'],
      manifest: {
        name: '智慧宿舍管理系统',
        short_name: '宿舍管理',
        description: '高效便捷的宿舍管理与查寝评分系统',
        theme_color: '#007AFF',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait-primary',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'pwa-icon.svg',
            sizes: '192x192',
            type: 'image/svg+xml'
          },
          {
            src: 'pwa-icon.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any'
          },
          {
            src: 'pwa-icon.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        // 缓存策略配置
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        // 增加预缓存文件大小限制（默认 2MB，设置为 4MB）
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        
        // 运行时缓存策略
        runtimeCaching: [
          {
            // API 请求 - 网络优先，失败时使用缓存
            urlPattern: /^https?:\/\/.*\/api\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 // 24小时
              },
              cacheableResponse: {
                statuses: [0, 200]
              },
              networkTimeoutSeconds: 10
            }
          },
          {
            // 上传的图片 - 缓存优先
            urlPattern: /^https?:\/\/.*\/uploads\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'uploads-cache',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30天
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            // 外部字体（如 Google Fonts）
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1年
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            // 字体文件
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1年
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ],
        
        // 离线回退页面
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//]
      },
      
      // 开发环境配置
      devOptions: {
        enabled: true,
        type: 'module'
      }
    })
  ],
  css: {
    postcss: {
      plugins: [
        tailwindcss(),
        autoprefixer(),
      ],
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.replace(/\\/g, '/')

          if (!normalizedId.includes('/node_modules/')) {
            return undefined
          }

          if (
            normalizedId.includes('/node_modules/react/') ||
            normalizedId.includes('/node_modules/react-dom/') ||
            normalizedId.includes('/node_modules/react-router') ||
            normalizedId.includes('/node_modules/scheduler/')
          ) {
            return 'react-vendor'
          }

          if (normalizedId.includes('/node_modules/@ant-design/icons/')) {
            return 'antd-icons-vendor'
          }

          if (
            normalizedId.includes('/node_modules/@rc-component/table/') ||
            normalizedId.includes('/node_modules/@rc-component/pagination/') ||
            normalizedId.includes('/node_modules/rc-virtual-list/') ||
            normalizedId.includes('/node_modules/rc-overflow/') ||
            normalizedId.includes('/node_modules/rc-resize-observer/')
          ) {
            return 'antd-table-vendor'
          }

          if (
            normalizedId.includes('/node_modules/@rc-component/picker/') ||
            normalizedId.includes('/node_modules/dayjs/')
          ) {
            return 'antd-date-vendor'
          }

          if (
            normalizedId.includes('/node_modules/@rc-component/form/') ||
            normalizedId.includes('/node_modules/@rc-component/input/') ||
            normalizedId.includes('/node_modules/@rc-component/input-number/') ||
            normalizedId.includes('/node_modules/@rc-component/select/') ||
            normalizedId.includes('/node_modules/@rc-component/cascader/') ||
            normalizedId.includes('/node_modules/@rc-component/tree-select/') ||
            normalizedId.includes('/node_modules/@rc-component/checkbox/') ||
            normalizedId.includes('/node_modules/@rc-component/switch/') ||
            normalizedId.includes('/node_modules/@rc-component/slider/') ||
            normalizedId.includes('/node_modules/@rc-component/segmented/') ||
            normalizedId.includes('/node_modules/@rc-component/textarea/')
          ) {
            return 'antd-form-vendor'
          }

          if (
            normalizedId.includes('/node_modules/@rc-component/dialog/') ||
            normalizedId.includes('/node_modules/@rc-component/drawer/') ||
            normalizedId.includes('/node_modules/@rc-component/dropdown/') ||
            normalizedId.includes('/node_modules/@rc-component/tooltip/') ||
            normalizedId.includes('/node_modules/@rc-component/tour/') ||
            normalizedId.includes('/node_modules/@rc-component/trigger/') ||
            normalizedId.includes('/node_modules/@rc-component/portal/') ||
            normalizedId.includes('/node_modules/@rc-component/notification/')
          ) {
            return 'antd-overlay-vendor'
          }

          if (normalizedId.includes('/node_modules/@rc-component/upload/')) {
            return 'antd-upload-vendor'
          }

          if (
            normalizedId.includes('/node_modules/@rc-component/') ||
            normalizedId.includes('/node_modules/rc-')
          ) {
            return 'antd-rc-vendor'
          }

          if (
            normalizedId.includes('/node_modules/antd/es/table/') ||
            normalizedId.includes('/node_modules/antd/es/pagination/') ||
            normalizedId.includes('/node_modules/antd/es/list/') ||
            normalizedId.includes('/node_modules/antd/es/descriptions/')
          ) {
            return 'antd-table-vendor'
          }

          if (
            normalizedId.includes('/node_modules/antd/es/date-picker/') ||
            normalizedId.includes('/node_modules/antd/es/calendar/') ||
            normalizedId.includes('/node_modules/antd/es/time-picker/')
          ) {
            return 'antd-date-vendor'
          }

          if (
            normalizedId.includes('/node_modules/antd/es/form/') ||
            normalizedId.includes('/node_modules/antd/es/input/') ||
            normalizedId.includes('/node_modules/antd/es/input-number/') ||
            normalizedId.includes('/node_modules/antd/es/select/') ||
            normalizedId.includes('/node_modules/antd/es/cascader/') ||
            normalizedId.includes('/node_modules/antd/es/tree-select/') ||
            normalizedId.includes('/node_modules/antd/es/checkbox/') ||
            normalizedId.includes('/node_modules/antd/es/radio/') ||
            normalizedId.includes('/node_modules/antd/es/switch/') ||
            normalizedId.includes('/node_modules/antd/es/slider/') ||
            normalizedId.includes('/node_modules/antd/es/segmented/')
          ) {
            return 'antd-form-vendor'
          }

          if (
            normalizedId.includes('/node_modules/antd/es/modal/') ||
            normalizedId.includes('/node_modules/antd/es/drawer/') ||
            normalizedId.includes('/node_modules/antd/es/dropdown/') ||
            normalizedId.includes('/node_modules/antd/es/popconfirm/') ||
            normalizedId.includes('/node_modules/antd/es/popover/') ||
            normalizedId.includes('/node_modules/antd/es/tooltip/') ||
            normalizedId.includes('/node_modules/antd/es/notification/') ||
            normalizedId.includes('/node_modules/antd/es/message/') ||
            normalizedId.includes('/node_modules/antd/es/tour/')
          ) {
            return 'antd-overlay-vendor'
          }

          if (normalizedId.includes('/node_modules/antd/es/upload/')) {
            return 'antd-upload-vendor'
          }

          if (normalizedId.includes('/node_modules/antd/')) {
            return 'antd-core-vendor'
          }

          if (
            normalizedId.includes('/node_modules/@tanstack/react-query/') ||
            normalizedId.includes('/node_modules/@tanstack/query-core/')
          ) {
            return 'query-vendor'
          }

          if (
            normalizedId.includes('/node_modules/react-resizable/') ||
            normalizedId.includes('/node_modules/react-draggable/') ||
            normalizedId.includes('/node_modules/prop-types/') ||
            normalizedId.includes('/node_modules/clsx/')
          ) {
            return 'table-resize-vendor'
          }

          if (normalizedId.includes('/node_modules/recharts/')) {
            return 'charts-vendor'
          }

          if (normalizedId.includes('/node_modules/xlsx/')) {
            return 'excel-vendor'
          }

          if (
            normalizedId.includes('/node_modules/workbox-window/') ||
            normalizedId.includes('/node_modules/idb/')
          ) {
            return 'pwa-vendor'
          }

          return 'vendor'
        },
      },
    },
  },
  server: {
    host: '0.0.0.0', // 允许局域网访问
    watch: {
      usePolling: true,
    },
    proxy: {
      '/api': {
        target: 'http://localhost:4002',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:4002',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/tests/setupTests.ts',
    coverage: {
      provider: 'v8',
      include: [
        'src/hooks/useTableFetch.ts',
        'src/hooks/useTableStateCore.ts',
        'src/hooks/useTableState.ts',
        'src/hooks/useResultTableState.ts',
        'src/hooks/useBulkSelection.ts',
        'src/pages/account-permission/scopeUtils.ts',
        'src/pages/account-permission/overrideUtils.ts',
      ],
      thresholds: {
        lines: 80,
        statements: 80,
        branches: 80,
        functions: 80,
      },
    },
  },
})
