import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'


// Ant Design v6 全局样式重置
import 'antd/dist/reset.css'

import './styles/index.css'  // Crystal Omni 模块化样式（新）
import App from './App'
import { initPerformanceMonitoring } from './performance/webVitals'
import { installPerformanceDebugTools } from './performance/debug'
import { initializePerformanceReporter } from './performance/reporter'

// DayJS 全局中文配置
import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
dayjs.locale('zh-cn')


// 创建 QueryClient 实例，配置默认缓存策略
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5分钟内数据被认为是新鲜的
      gcTime: 10 * 60 * 1000,   // 10分钟后垃圾回收
      refetchOnWindowFocus: false, // 窗口聚焦时不自动刷新
      retry: 1, // 失败后重试1次
    },
  },
})

initializePerformanceReporter()
initPerformanceMonitoring()
installPerformanceDebugTools()

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Root element #root not found')
}

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)

