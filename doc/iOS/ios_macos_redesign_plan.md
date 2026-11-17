# Apple 生态美学重构方案：iOS & macOS 交互升级计划

本方案旨在通过引入 **Tailwind CSS**，将现有项目风格从传统的企业级中台视觉升级为高度接近 **Apple (iOS/macOS) 原生质感** 的现代 Web 应用。

## 1. 核心视觉与交互设计语言

### 1.1 移动端 (Mobile/H5) - iOS 风格

- **布局**: 采用 `Large Title` 大标题设计，页面向下滚动时标题平滑过渡至导航栏中心。
- **容器**: 摒弃传统边框，使用 `Inset Grouped`（内切分组）样式的圆角卡片 (`rounded-[20px]`) 配合细腻的阴影 (`shadow-sm`)。
- **材质**: 广泛应用 `Glassmorphism`（玻璃拟态）。导航栏、底部 TabBar 及弹出层使用 `backdrop-blur-xl bg-white/80`。
- **交互**: 模拟 iOS 触感。所有按钮和可点击项添加 `active:scale-95 active:opacity-70 transition-transform`。
- **导航**: 底部常驻 `Tab Bar`，取代顶栏或侧边栏菜单。

### 1.2 桌面端 (Desktop/Web) - macOS 风格

- **布局**: 采用左侧 **半透明侧边栏 (Translucent Sidebar)** + 右侧主内容区。
- **材质**: 侧边栏使用 `backdrop-blur-2xl bg-gray-100/60`，模拟 macOS 窗口材质感。
- **细节**: 使用极细边框 (`border-black/5`) 代替阴影，确保界面通透、无负担。
- **排版**: 强制使用系统字体栈 (`-apple-system, SF Pro Text`)，提升精致感。

---

## 2. 技术路线与基础设施方案

### 2.1 Tailwind CSS 基础配置

在 `tailwind.config.js` 中扩展 Apple 专用色值与阴影。

### 2.2 全局样式重置 (`index.css`)

- 隐藏滚动条但保留功能。
- 设置 iOS 惯性滚动。
- 定义 `.glass-card` 等通用类。

### 2.3 智能布局引擎 (`AppLayout.jsx`)

引入响应式 Layout：

- `screen < md`: 渲染底部 TabBar，顶栏居中显示标题。
- `screen >= md`: 渲染左侧毛玻璃侧边栏，启用 macOS 窗口风格。

---

## 3. 页面修改清单与优先级

| 页面名称                       | 修改重点 (iOS/macOS 特性引入)                                                    | 优先级 |
| :----------------------------- | :------------------------------------------------------------------------------- | :----- |
| **登录页 (Login)**             | 登录框改为高斯模糊卡片，背景采用柔和渐变。                                       | 高     |
| **工作台 (Dashboard)**         | 统计数字改用大字体，图表组件放置在 iOS 风格圆角卡片中。                          | 高     |
| **查寝分数录入 (ResultEntry)** | 表单改为列表分组样式，项间使用极细分割线，分段选择器模拟 iOS Segmented Control。 | 高     |
| **管理页面 (Management)**      | 桌面端移除 Table 边框；移动端将 Table 扁平化为卡片列表流。                       | 中     |
| **设置页面 (Settings)**        | 完全参照 iOS 设置页布局，图标左置，右侧带箭头指示器。                            | 中     |

---

## 4. 实施阶段与步骤

### 第一阶段：基础设施建设 (已完成 ✅)

1.  **Tailwind CSS 深度集成**: 扩展 Apple 专用色值（iOS Blue, System Gray 等）与 `backdrop-blur` 预设。
2.  **全局样式原子化 (`index.css`)**: 注入 `.glass-panel` (毛玻璃)、`.active-press` (物理反馈)、`.apple-bg-gradient` (动态背景) 等核心类。
3.  **Ant Design v6 主题适配 (`antdTheme.js`)**: 强制覆盖企业级样式，定义 12px/24px 大圆角及 iOS 语义化分段选择器样式。
4.  **通用组件库建设**: 实现 `AppleStatCard` (统计看板) 与 `AppleIconButton` 等高频原子组件。

### 第二阶段：核心分发布局重构 (已完成 ✅)

1.  **智能布局引擎 (`AppLayout.jsx`)**: 实现响应式切换逻辑。
    - **macOS (md 以上)**: 半透明毛玻璃侧边栏 + macOS Toolbar。
    - **iOS (md 以下)**: 顶部标题栏 + 底部 Tab Bar + 水平分段导航。
2.  **通用页面模板 (`PageLayout.jsx`)**: 封装标准化的玻璃容器架构与 `animate-apple-in` 入场动效。

### 第三阶段：页面 UI 适配与深度重构 (已完成 ✅)

1.  **身份认证入口 (Login & ForgotPassword)**: 全屏动态渐变背景 + 玻璃拟态登录表单。
2.  **移动端核心业务 (ResultEntry & RoomSelect)**: 深度模拟 iOS 原生 Stepper、分组列表及 Inset Grouped 布局。
3.  **基础数据管理 (Dorm/Student/Teacher/Occupancy/Building)**:
    - 全面引入 `AppleStatCard` 统计看板。
    - 移动端统一采用卡片流 + 底部操作抽屉，桌面端采用通透无边框 `GlassTable`。
4.  **系统设置与审计记录**:
    - **AdminSettings**: 采用分组卡片布局，优化了评分规则与全局设置的视觉层次。
    - **AuditLog**: 实现了基于玻璃拟态的日志时间轴与数据表格。
    - **AccountPermission**: 实现了响应式的权限矩阵。

### 第四阶段：微细节打磨与动效增强 (进行中 🔄)

1.  **全局组件注入**: 将 `apple-input`、`apple-switch`、`apple-btn` 等原子类应用到所有表单项，确保风格高度统一。
2.  **动效衔接**: 为页面切换、弹窗弹出增加更顺滑的物理曲线动效（如 `cubic-bezier(0.4, 0, 0.2, 1)`）。
3.  **黑暗模式审计**: 确保所有玻璃面板在深色背景下的对比度与通透感。

---

## 5. 进度跟踪报告

- [x] 基础设施 & Tailwind 扩展
- [x] 智能布局引擎 (Adaptive Layout)
- [x] 登录与认证页面
- [x] 仪表盘首页 (Dashboard)
- [x] 查寝任务与评分流程
- [x] 管理类页面 (Management Pages)
- [x] 系统设置与角色权限
- [/] 全局组件原子化适配 (60%)

---
