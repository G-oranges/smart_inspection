# 项目进展 - Apple HIG 深度适配

## 当前状态

- **日期**: 2026-01-09
- **阶段**: Phase 5 - 安全加固与稳定性优化

### 服务端授权加固（2026-01-09）

- [x] **创建授权中间件** `authz.go`
  - `PermissionInjector` - 注入用户权限到上下文
  - `RequirePermission` - 权限码校验中间件
  - `RequireRole` - 角色校验中间件（如 ADMIN）
- [x] **路由权限配置** `router.go`
  - 用户管理：USER_CREATE/UPDATE/DELETE/RESET_PASSWORD
  - 权限管理：仅 ADMIN 可操作
  - 审计日志删除：仅 ADMIN
  - 系统设置：仅 ADMIN
- [x] **控制器二次校验**（纵深防御）
  - `user_controller.go` - CreateUser/DeleteUsers/ResetPassword
  - `permission_controller.go` - UpdateRolePermissions/UpdateUserOverrides
  - `audit_controller.go` - DeleteLogs + 审计日志记录

---

## 已完成

1. **移动端形态切换悬浮药丸导航 (Floating Pill Navigation)**:

   - 实现了一个高保真 iOS 风格的悬浮药丸栏 (`apple-mobile-pill-wrapper`)。
   - 支持动态形态切换：
     - **导航模式**: 显示四个核心功能入口的小型 Tab 条。
     - **选择模式**: 当选中列表项时，自动平滑“变形”为带有选中计数、取消按钮和主操作按钮的黑色操作栏。
   - **涉及页面**: 宿舍管理、学生管理、教师管理、楼宇管理、入住管理、查寝结果、账号权限。
   - **交互重构**: 移除了所有陈旧的 `bottom-selection-bar`，统一改为全局感应式药丸栏 + `IOSActionSheet`。

1. **入住管理页面 (OccupancyManagementPage.jsx)**:
   - 修复了所有 JSX 语法错误与编码乱码问题。
   - 完成了响应式批量入住分配 Drawer/Modal 重构。
   - 注入了 `apple-` 系列原子类。
1. **楼栋管理页面 (BuildingManagementPage.jsx)**:
   - 完成响应式 Drawer/Modal 重构。
   - 应用了 Apple HIG 风格原子组件类。
1. **首页/仪表盘 (DashboardPage.jsx)**:
   - 完成了快捷操作入口的 Apple HIG 风格优化。
   - 应用了 `active-press` 微动效。
1. **教师管理页面 (TeacherManagementPage.jsx)**:
   - 完成响应式 Drawer/Modal 重构。
   - 注入 `apple-` 系列原子类。
1. **视觉优化与弹窗美化**:
   - [x] 入住管理页面 (Occupancy Management) 样式优化
   - [x] 宿舍管理页面 (Dorm Management) 样式优化
   - [x] 全局弹窗 (Global Modals) 苹果质感升级
   - [x] 任务发布页面 (Task Publish) 弹窗美化计划：
     - [x] 引入 macOS 毛玻璃效果与 28px 圆角
     - [x] 采用 `variant="filled"` 积木式输入框布局
     - [x] 优化 3 步操作流程的视觉连贯性
     - [x] 同步更新示意图 (Mockup) 确认为最终设计方案
     - [x] 引入 `FilterDropdownPanel` 悬浮筛选交互
     - [x] 为宿舍圈定步骤增加列表/卡片/缩略多视图支持
1. **学生管理页面 (StudentManagementPage.jsx)** & **宿舍管理页面 (DormManagementPage.jsx)**:

   - 已完成 Apple HIG 风格重构与响应式适配。

1. **✅ [2026-01-02] Apple HIG 组件覆盖率与 WCAG 暗黑模式对比度审核**:

   - 完成全局 15 个页面的 AntD 组件 Apple 原子类覆盖率检查
   - 完成暗黑模式 WCAG 2.1 AA/AAA 对比度审核
   - 输出详细审核报告: `doc/apple_hig_audit_report.md`
   - **主要发现**:
     - 整体覆盖率: Input ~90%, Select ~85%, Button ~75%, Modal ~70%
     - 发现 2 处 WCAG 对比度不合规问题 (床位标签、宿舍卡片次要文本)
     - DatePicker/RangePicker 组件未添加 Apple 原子类 (~30%)

1. **✅ [2026-01-06] Modal 弹窗与表单视觉重构 (统一 44px 高度 & 填充样式)**:

   - 已完成 `antdTheme.js` 中的组件 Token 重构，实现 iOS/macOS 原生卡片风格。
   - 所有 Input, Select, Button, Modal 均已适配“填充式”背景及 44px 触控高度。
   - 新增 `App.css` 中的 `.glass-modal`、`.apple-modal`、`.apple-form`、`.apple-btn-primary/secondary`、`.apple-input` 等统一样式类。

1. **✅ [2026-01-06] 按钮圆角样式优化 (胶囊 → 圆角矩形)**:
   - 将按钮圆角从 22px（胶囊形状）调整为 12px（圆角矩形），与字段管理按钮风格保持一致。
   - **修改文件**: `antdTheme.js`（浅色/深色模式 Button Token）、`App.css`（.apple-btn-primary/secondary）
   - **涉及页面**:
     - `BuildingManagementPage.jsx` - 新增楼栋按钮、Modal 确认/取消
     - `DormManagementPage.jsx` - 新增宿舍按钮、Modal 确认/取消
     - `StudentManagementPage.jsx` - 新增学生按钮、Modal 确认/取消
     - `TeacherManagementPage.jsx` - 新增教职工按钮、Modal 确认/取消
     - `TaskPublishPage.jsx` - 发布任务按钮、导航步骤按钮
     - `OccupancyManagementPage.jsx` - 批量入住按钮、提交按钮
     - `ResultViewPage.jsx` - 筛选确认、权限提示返回按钮

## 进行中

- ✅ 所有 P0/P1/P2 任务已完成
- ✅ PWA (Service Worker 离线支持) 已实现

## 下一步计划

1. ~~全局检查 AntD 组件的 Apple 原子类覆盖率。~~ ✅ 已完成
2. ~~进行 WCAG 对比度审核（暗黑模式）。~~ ✅ 已完成
3. ~~**根据审核报告修复以下问题**~~:
   - ~~P0: 修复 `.bed-tag.occupied` 深色模式对比度~~ ✅ 已修复
   - ~~P1: 添加 `apple-datepicker` 原子类定义~~ ✅ 已添加
   - ~~P1: 修复 `.mini-occupancy` 对比度~~ ✅ 已修复
   - ~~P2: 表格操作按钮添加 `active-press`~~ ✅ 已完成
4. ~~探索 Service Worker 离线支持。~~ ✅ 已实现 (PWA)
5. ~~增强 `ResultEntryPage.jsx` 的 50/50 布局动效过渡。~~ ✅ 已实现

## 本次修复内容（2026-01-02 23:38~23:45）

### P0 - WCAG 对比度修复

- **文件**: `frontend/src/index.css`
- **修改内容**:
  - `.bed-tag.occupied` 颜色从 `rgba(255,255,255,0.65)` → `rgba(255,255,255,0.75)`
  - `.bed-tag.occupied .bed-num` 颜色从 `rgba(255,255,255,0.4)` → `rgba(255,255,255,0.55)`
  - `.mini-occupancy` 颜色从 `rgba(255,255,255,0.45)` → `rgba(255,255,255,0.55)`

### P1 - Apple DatePicker 原子类

- **文件**: `frontend/src/index.css`
- **新增类**:
  - `.apple-datepicker` - 单日期选择器
  - `.apple-rangepicker` - 日期范围选择器
  - `.apple-datepicker-dropdown` / `.apple-rangepicker-dropdown` - 弹出浮层

### P1 - AuditLogPage 组件覆盖

- **文件**: `frontend/src/pages/AuditLogPage.jsx`
- **修改内容**: 为桌面端和移动端筛选组件添加 Apple 原子类
  - Select → `apple-select` + `popupClassName="apple-dropdown"`
  - Input → `apple-input`
  - RangePicker → `apple-rangepicker` + `popupClassName="apple-rangepicker-dropdown"`
  - Button → `apple-btn-primary` / `apple-btn-secondary` + `active-press`
  - Drawer → `apple-drawer ios-action-sheet`

### P2 - 表格操作按钮 `active-press` 类

- **修改页面**:
  - `BuildingManagementPage.jsx` - 详情/编辑/删除按钮
  - `OccupancyManagementPage.jsx` - 办理入住/调宿/退宿按钮
  - `AccountPermissionPage.jsx` - 编辑/临时密码/删除按钮
  - `TeacherManagementPage.jsx` - 编辑/删除按钮
  - `StudentManagementPage.jsx` - 详情/编辑/删除按钮
  - `DormManagementPage.jsx` - 详情/编辑/删除按钮

### PWA 功能实现（2026-01-02 23:57）

- **安装的依赖**:

  - `vite-plugin-pwa` - Vite PWA 插件
  - `workbox-window` - Service Worker 管理

- **新增/修改文件**:

  - `vite.config.js` - 添加 VitePWA 插件配置
  - `index.html` - 添加 PWA meta 标签和安装提示
  - `public/pwa-icon.svg` - 应用图标（宿舍楼造型）
  - `src/components/common/PWAUpdatePrompt.jsx` - 更新提示组件
  - `src/components/common/NetworkStatusIndicator.jsx` - 网络状态指示器
  - `src/App.jsx` - 集成 PWA 组件

- **功能特性**:

  - ✅ 离线访问支持（缓存静态资源）
  - ✅ 应用安装到主屏幕
  - ✅ 自动检测更新并提示刷新
  - ✅ 网络状态实时显示（离线/在线）
  - ✅ API 请求网络优先策略（NetworkFirst）
  - ✅ 图片资源缓存优先策略（CacheFirst）

- **缓存策略**:
  | 资源类型 | 策略 | 有效期 |
  |---------|------|--------|
  | 静态资源 (JS/CSS/HTML) | 预缓存 | 随构建更新 |
  | API 请求 | NetworkFirst | 24 小时 |
  | 上传图片 | CacheFirst | 30 天 |
  | 外部字体 | CacheFirst | 1 年 |

### 50/50 布局动效过渡（2026-01-03 00:50）

- **修改文件**:

  - `frontend/src/index.css` - 添加动画关键帧和工具类
  - `frontend/src/pages/ResultEntryPage.jsx` - 应用动画类

- **新增动画效果**:
  | 动画类名 | 效果说明 |
  |---------|---------|
  | `animate-slide-left` | 左列从左侧滑入（0.6s） |
  | `animate-slide-right` | 右列从右侧滑入（延迟 0.15s） |
  | `animate-card-pop` | 卡片弹入效果（带回弹） |
  | `animate-content-reveal` | 内容渐显（带模糊过渡） |
  | `stagger-children` | 子元素交错动画（依次出现） |
  | `hover-lift` | 悬停时卡片上浮 + 阴影增强 |

- **应用位置**:
  - 左列整体：`animate-slide-left`
  - 右列整体：`animate-slide-right`
  - 分数仪表盘卡片：`animate-card-pop` + `hover-lift`
  - 基础设定卡片：`hover-lift`
  - 扣分项列表：`stagger-children` + `hover-lift`
  - 证据补充卡片：`hover-lift`

## 审核报告

详细审核报告请参阅: [Apple HIG 审核报告](./apple_hig_audit_report.md)

### 表格列宽调整与操作列冻结（2026-01-05）

- **需求描述**:

  - 基础信息页面（楼栋管理、宿舍管理、学生管理、教师管理等）的桌面端表格支持手动调整列宽
  - 表格最右侧的操作按钮列固定显示，不被水平滚动遮挡

- **技术方案**:

  - 使用 `react-resizable` 库实现列宽拖拽调整
  - 为操作列添加 `fixed: "right"` 属性实现列冻结
  - 创建可复用的 `ResizableTitle` 组件和 `useResizableColumns` Hook

- **新增/修改文件**:
  | 文件 | 操作 | 说明 |
  |------|------|------|
  | `package.json` | 修改 | 添加 `react-resizable` 依赖 |
  | `src/components/ResizableTitle.jsx` | 新建 | 可调整列宽的表头组件 |
  | `src/hooks/useResizableColumns.js` | 新建 | 列宽状态管理 Hook |
  | `src/index.css` | 修改 | 添加拖拽手柄样式、固定列毛玻璃背景 |
  | `src/components/GlassTable.jsx` | 修改 | 支持 `resizable` 属性 |
  | `src/components/ResponsiveDataView.jsx` | 修改 | 传递 `resizable` 属性 |
  | `src/pages/BuildingManagementPage.jsx` | 修改 | 启用列宽调整和操作列冻结 |
  | `src/pages/DormManagementPage.jsx` | 修改 | 启用列宽调整和操作列冻结 |
  | `src/pages/StudentManagementPage.jsx` | 修改 | 启用列宽调整和操作列冻结 |
  | `src/pages/TeacherManagementPage.jsx` | 修改 | 启用列宽调整和操作列冻结 |
  | `src/pages/OccupancyManagementPage.jsx` | 修改 | 启用列宽调整和操作列冻结 |

- **功能特性**:

  - ✅ 拖拽表头边框可调整列宽
  - ✅ 操作列始终固定在表格右侧
  - ✅ 支持设置最小/最大列宽限制（默认 60px ~ 500px）
  - ✅ 固定列与调整列宽互不冲突
  - ✅ 深色模式适配

- **使用方式**:

  ```jsx
  // 1. 为列配置添加 width 属性
  const columns = [{ title: '名称', dataIndex: 'name', width: 150 }, ...]

  // 2. 使用 useResizableColumns Hook
  const { columns: resizableColumns } = useResizableColumns(columns)

  // 3. 在 ResponsiveDataView 或 GlassTable 中启用
  <ResponsiveDataView columns={resizableColumns} resizable={true} />
  ```

### PWA 稳定性与 AntD v6 规范适配 (2026-01-05)

- [x] **Hooks 调用顺序修复**: 解决了 `StudentManagementPage`, `TeacherManagementPage`, `DormManagementPage` 和 `ResultViewPage` 中的 `Warning: React has detected a change in the order of Hooks` 警告。通过将权限校验的早期返回逻辑移动到组件所有 Hook 定义之后，确保了 Hook 调用顺序的稳定性。
- [x] **Ant Design v6 适配**: 完成了全局 `Drawer` 样式、`Select` 弹出框类名、`Modal` 销毁属性等废弃 API 的迁移。
- [x] **PWA 稳定性优化**: 修复了 StrictMode 下 Service Worker 重复注册导致的 `AbortError`。
  - 修复 `StudentManagementPage.jsx` 中的 `ReferenceError`: 通过重构组件内部函数初始化顺序，解决了列定义在渲染处理函数之前被引用的受限访问问题（TDZ）。
  - 将 `renderStudentCell` 提取为独立辅助函数，并优化了所有页面的 `useMemo` 依赖顺序。
