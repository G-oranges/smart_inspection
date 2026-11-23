# 前端样式总体范式（Crystal Omni Style Handbook）

> 适用范围：全前端页面、通用组件、管理类 CRUD 工作面、移动端列表与抽屉、桌面端弹窗（`>= 768px` 与 `< 768px`）。
> 唯一全局样式入口：`frontend/src/styles/index.css`（由 `frontend/src/main.tsx` 引入）
> 设计令牌真相源：`frontend/src/styles/base/tokens.css`
> 专项子规范：[桌面端弹窗规范（co-modal）](./modal_style_guide.md) · [确认弹窗策略（Confirm Policy）](./confirm_policy.md) · [Figma 规范映射](./figma_ready_design_package.md)
> 自动化护栏：`npm run lint:styleguard`（`frontend/scripts/check-style-guardrails.js`）

---

## 1. 现状架构与历史收敛

对比当前最新代码架构与历史文档，以下差异已收口为现行唯一事实：

| 维度 | 历史文档 / 旧写法 | 当前最新架构真相 | 约束结论 |
| --- | --- | --- | --- |
| 全局样式入口 | 提及 `App.css`、`src/index.css`、`styles/legacy/legacy.css` 为迁移期保留层 | 三者均已删除，`main.tsx` 仅导入 `antd/dist/reset.css` 与 `./styles/index.css` | 禁止重建 `App.css` / `src/index.css`；所有新样式写入 `styles/components/*.css` 并由 `styles/index.css` 聚合 |
| 变量体系 | 混用 `--color-*` / `--glass-*` / `--radius-*` 与硬编码 `#hex` / `rgba()` | `base/tokens.css` 统一提供 `--co-*` 亮/暗双主题变量，CI 护栏拦截新增旧变量与硬编码色值 | 仅允许使用和扩展 `--co-*`（及管理页作用域 `--dorm-*`） |
| 主题配置层 | 文档声称 `antdTheme.js` 驱动全部样式 | `frontend/src/theme/antdTheme.ts` 作为 AntD 6 基础 `ConfigProvider` 底座（含部分历史色值 `#007AFF` 与默认圆角），视觉覆盖由 `styles/vendors/antd-overrides.css` 及 `styles/components/*.css` 接管 | 通用组件与弹窗以 `tokens.css` + `styles/components/*.css` 为准，不直接在业务页写内联样式覆写 AntD |
| 管理页表格 | `macos-table` 与 `dorm-table` 混用，规范分散在 `management_table_standard_guide.md` | 10 个管理页已统一收口至 `management-theme-page` + `dorm-*` 公共契约 | `dorm-*` 视为现行有效管理页公共契约；新管理页禁止混用 `macos-table` |
| 桌面端弹窗 | `glass-modal` / `apple-modal` 针对旧版 `.ant-modal-content` 失效，宽度/标题/按钮各写各的 | 统一收口为 `overlay.css` 的 `.co-modal` + `components/common/modalSizes.ts` | 所有桌面端 `Modal` 必须遵循 [modal_style_guide.md](./modal_style_guide.md) |
| 旧布局壳 | 旧文档列出 `components/Layout.tsx`、`App.jsx`、`AppLayout.jsx` | 已全面 TypeScript 化，`components/Layout.tsx` 已删除，统一使用 `layouts/AppLayout.tsx` | 文档与新代码统一按 `App.tsx` / `AppLayout.tsx` 路径引用 |

---

## 2. 统一规范（总体范式）

### 2.1 样式分层与职责边界

全局加载顺序（不可颠倒）：

1. **AntD 底座**：`antd/dist/reset.css` + `ConfigProvider`（`frontend/src/theme/antdTheme.ts`）
2. **Tailwind 基础层**：`frontend/src/styles/tailwind.css`
3. **设计令牌与重置**：`base/tokens.css` → `base/reset.css`
4. **核心组件与 AntD 覆写**：`components/glass.css`、`animations.css`、`layout.css`、`vendors/antd-overrides.css`
5. **模块组件样式**：`components/*.css`（按组件或业务模块拆分，统一在 `styles/index.css` 中 `@import`）

Tailwind 与 CSS 类的分工：

| 场景 | 采用方案 | 示例 |
| --- | --- | --- |
| 布局、间距、对齐、响应式断点（`md:` = 768px） | Tailwind utility | `flex items-center gap-2`、`grid grid-cols-2` |
| 颜色、文字层级、圆角、阴影、模糊、动效时长 | `--co-*` CSS 变量 | `var(--co-primary)`、`var(--co-radius-xl)` |
| 玻璃材质、按钮、表单、管理页、弹窗、移动卡片 | 已有 `.co-*` / `.apple-*` / `.dorm-*` 契约类 | `.co-glass-panel`、`apple-btn-primary`、`co-modal` |
| 页面特有复杂样式 / AntD 深度覆写 | `frontend/src/styles/components/<module>.css` | 并在 `styles/index.css` 显式 `@import` |

### 2.2 设计令牌（`--co-*`）

唯一真相源：`frontend/src/styles/base/tokens.css`。亮/暗模式通过 `[data-theme="light"]` 与 `[data-theme="dark"]` 自动切换，组件层无需手写深色硬编码。

| 类别 | 核心变量 | 说明 |
| --- | --- | --- |
| 品牌与状态 | `--co-primary` (`#3c83f6`)、`--co-primary-hover`、`--co-primary-active`、`--co-success`、`--co-warning`、`--co-error`、`--co-info` | 主题无关，禁止在组件 CSS 硬编码色值 |
| 背景与文字 | `--co-bg`、`--co-text`、`--co-text-secondary`、`--co-text-muted` | 亮/暗模式自动切换 |
| 玻璃面板 | `--co-glass-bg`、`--co-glass-bg-heavy`、`--co-glass-border`、`--co-glass-shadow`、`--co-glass-shadow-lg`、`--co-glass-blur(-sm/-xs)` | 玻璃拟态面板与卡片 |
| 控件与导航 | `--co-input-*`、`--co-btn-*`、`--co-sidebar-bg`、`--co-header-bg`、`--co-nav-*` | 输入框、按钮、侧栏与顶栏 |
| 圆角与过渡 | `--co-radius-sm` (6px) ~ `--co-radius-2xl` (32px)、`--co-radius-full`、`--co-transition`、`--co-transition-fast` | 统一圆角与交互过渡 |
| 管理页作用域 | `--dorm-toolbar-*`、`--dorm-table-*`、`--dorm-text-*`、`--dorm-action-*`、`--dorm-pagination-*` | 仅在 `.management-theme-page` 作用域内生效（定义于 `dorm-management.css`） |

### 2.3 基础组件契约

新增或修改 UI 时，必须优先复用以下既有契约，禁止重复造轮子：

| 组件类别 | 标准类名 / 公共组件 | 样式出处 | 关键约定 |
| --- | --- | --- | --- |
| 玻璃容器与动效 | `.co-glass-panel`、`.co-glass-panel-heavy`、`.co-glass-card`、`.co-glass-input`、`.co-glass-btn(-primary)`、`.co-animated-bg` | `glass.css`、`animations.css` | 通用面板/卡片/入场动效直接复用 |
| 按钮系统 | `apple-btn-primary`、`apple-btn-secondary`；管理页工具栏叠加 `dorm-toolbar-button` + `-primary` / `-subtle` / `-danger` | `button-apple.css`、`dorm-management.css` | 禁止同一按钮叠加互斥类，禁止在按钮上堆叠 `px-8`、`rounded-xl`、`bg-ios-blue` 等覆盖样式 |
| 高密度表单 | `<Form layout="vertical" className="apple-form apple-form-compact">`；行内开关加 `form-item-inline-switch` | `form-apple.css`、`form-compact.css` | 适用于 Modal / Drawer 多字段表单；禁止对单个字段硬编码控件高度或重写 label 样式 |
| 统计指标卡 | `AppleStatCard` + `CollapsibleStatsBoard` | `stats.css` | 复用既有 tone / dotColor，不新增业务专属色 |
| 桌面端筛选 | `FilterDropdownPanel`（`.filter-dropdown-panel`、`.filter-trigger-btn`、`.filter-expanded-panel`）；级联用 `CollegeMajorClassCascader` | `filter-panel.css` | 轻量触发器 + 展开面板，禁止把全部筛选项直接平铺塞满工具栏首屏 |
| 移动端列表卡片 | `.mobile-compact-card`（`.compact-card-header`、`.compact-card-grid`、`.compact-label`、`.compact-value`、选中态 `.selected`） | `mobile-compact.css` | 移动端列表统一基于此契约，禁止仅用 Tailwind 临时拼装新卡片基类 |
| 移动端筛选与抽屉 | `MobileAdvancedFilter`（`.mobile-advanced-filter-drawer`）、`IOSActionSheet`、`<Drawer className="apple-drawer ios-action-sheet" />` | `action-sheet.css` | 移动端表单/筛选/轻量操作统一用底部抽屉承载，与桌面端共享表单内容结构 |

### 2.4 管理类页面范式

所有管理类 CRUD 页面以**学生管理页**（`frontend/src/pages/StudentManagementPage.tsx` 及 `frontend/src/pages/student/*`）为标准样板，统一采用以下骨架：

```tsx
<div className="management-theme-page">
  <PageLayout
    statsLayout="custom"
    stats={<CollapsibleStatsBoard expandedContent={<ModuleStats ... />} ... />}
    filters={<ModulePageFilters ... />} // 桌面端 dorm-toolbar-shell；移动端搜索 + MobileAdvancedFilter
  >
    <div className="table-head dorm-table-head mb-4">
      <div className="flex items-center gap-2">
        <div className="dorm-table-head-accent" />
        <h3 className="dorm-table-head-title">实时列表</h3>
        <span className="dorm-table-head-time">最后更新: {lastRefreshedAt}</span>
      </div>
    </div>

    <div className="table-wrapper dorm-table-wrapper">
      <ResponsiveDataView className="dorm-table" ... />
    </div>
  </PageLayout>
</div>
```

桌面端工具栏标准分层（必须在 `management-theme-page` 内）：

```tsx
<div className="dorm-toolbar-shell">
  <div className="dorm-toolbar-row dorm-toolbar-row-main">
    {/* dorm-toolbar-search 搜索框 + 查询 / 重置 */}
  </div>
  <div className="dorm-toolbar-row dorm-toolbar-row-actions">
    {/* 新增 / 导入 / 导出 / 字段设置 / 批量操作 */}
  </div>
</div>
<div className="dorm-toolbar-row dorm-toolbar-row-filters">
  {/* FilterDropdownPanel / CollegeMajorClassCascader */}
</div>
```

必须同时满足：
- 外层包裹 `management-theme-page`（注入 `--dorm-*` 作用域变量）。
- 表格使用 `dorm-table-wrapper` + `dorm-table`，禁止混用 `macos-table`。
- 静态配置列表可省略 `dorm-table-head-time`，但保留 `dorm-table-head` 结构。

### 2.5 弹窗与确认边界

弹窗按形态与职责严格分流，不互相侵入：

| 场景 | 适用规范 | 核心用法 |
| --- | --- | --- |
| 桌面端常规 `antd Modal`（表单/详情/预检/工作区） | [modal_style_guide.md](./modal_style_guide.md) | 必选 `className="co-modal"` + `centered` + `width={MODAL_WIDTH.sm\|md\|lg\|xl}`；纯文本标题；`apple-btn-secondary` / `apple-btn-primary` |
| 风险操作确认（`Modal.confirm` / `Popconfirm`） | [confirm_policy.md](./confirm_policy.md) | 统一走 `frontend/src/utils/confirm.ts` 与 L1/L2/L3 风险分级，不在 `co-modal` 约束范围内 |
| 移动端底部抽屉 / ActionSheet / 全屏弹窗 | 本手册 2.3 节 | `Drawer` 使用 `apple-drawer ios-action-sheet`；移动端需全屏时按断点移除 `co-modal`（如 `isMobile ? "xxx" : "xxx co-modal"`） |
| 内容自带完整布局的弹窗（如导入向导） | [modal_style_guide.md](./modal_style_guide.md) | 追加 `co-modal--flush` 去除内容区内边距，由内部自行滚动 |

### 2.6 硬性禁令

- **禁止**重建或修改 `frontend/src/App.css`、`frontend/src/index.css`。
- **禁止**在 `frontend/src/styles/**/*.css`（除 `base/tokens.css`）新增 `--color-*` 旧变量或 `#hex` / `rgb()` / `rgba()` / `hsl()` 硬编码色值（CI 护栏会直接报错）。
- **禁止**新增 `styles/components/*.css` 后漏写 `styles/index.css` 中的 `@import`。
- **禁止**跳过 `management-theme-page` 直接使用 `dorm-toolbar-*`、`dorm-table-*`，或在新管理页混用 `macos-table`。
- **禁止**在桌面端 `Modal` 上写旧类名 `glass-modal` / `apple-modal`、内联 `bodyStyle` / `style={{ top }}` / `maxHeight`，或在 `title` 中嵌套图标、色块、副标题。
- **禁止**在业务页内私造第二套通用卡片、筛选面板、表头或按钮配色体系。

---

## 3. 代码与规范文件映射

### 3.1 样式文件分层清单（`frontend/src/styles/`）

| 层级 | 文件 | 职责 |
| --- | --- | --- |
| 入口与基础 | `index.css`、`tailwind.css`、`base/tokens.css`、`base/reset.css` | 全局聚合入口、Tailwind 层、`--co-*` 令牌真相源与基础重置 |
| AntD 覆写 | `vendors/antd-overrides.css` | Ant Design v6 全局 token 化覆盖 |
| 通用基础组件 | `glass.css`、`glass-legacy.css`、`animations.css`、`layout.css`、`app-shell.css`、`pill-bar.css`、`utilities.css`、`apple-utilities.css`、`font-scale.css` | 玻璃容器、动效、桌面侧栏/移动底栏壳、字号与通用工具类 |
| 交互组件契约 | `button-apple.css`、`form-apple.css`、`form-compact.css`、`dropdown-apple.css`、`custom-select.css`、`date-picker-apple.css`、`tag-apple.css`、`title-dropdown.css`、`overlay.css`、`action-sheet.css`、`filter-panel.css`、`mobile-compact.css`、`stats.css` | 按钮、表单、下拉、弹窗（`co-modal`）、抽屉、筛选、移动卡片、统计卡 |
| 管理页与表格 | `dorm-management.css`、`table-layout.css`、`table-resize.css`、`table-macos.css`（存量兼容，新页禁用） | 管理页主题作用域与表格样式 |
| 业务模块专属 | `auth.css`、`dorm-grid.css`、`assignment-pool.css`、`task-publish.css`、`task-publish-modal.css`、`result-entry.css`、`result-detail-modal.css`、`account-permission.css`、`admin-settings.css` | 特定业务页/专属弹窗样式 |

### 3.2 优先复用的通用组件（`frontend/src/components/common/`）

| 组件 / 文件 | 用途 |
| --- | --- |
| `AppleStatCard.tsx`（配合 `components/stats/CollapsibleStatsBoard.tsx`） | 统一统计指标卡与折叠统计区 |
| `FilterDropdownPanel.tsx` / `CollegeMajorClassCascader.tsx` | 桌面端筛选面板与学院/专业/班级三级联 |
| `MobileAdvancedFilter.tsx` / `IOSActionSheet.tsx` | 移动端高级筛选抽屉与 iOS 操作表 |
| `modalSizes.ts` | 桌面端弹窗宽度档位常量（`MODAL_WIDTH`） |
| `ImportWizardModal.tsx` / `LazyImportWizardModal.tsx` | 通用导入向导弹窗（`lg + co-modal--flush`） |
| `PanelSelect.tsx` / `TitleDropdown.tsx` / `ThemeSwitcher.tsx` / `ThemeSettingsDrawer.tsx` | 面板选择器、标题下拉、主题切换 |

### 3.3 已接入 `management-theme-page` 的管理页清单

当前代码中已采用管理页主题契约的 10 个页面（均位于 `frontend/src/pages/`）：

| 页面 | 文件 |
| --- | --- |
| 学生管理（标准样板） | `StudentManagementPage.tsx` |
| 宿舍管理 | `DormManagementPage.tsx` |
| 楼栋管理 | `BuildingManagementPage.tsx` |
| 教职工管理 | `TeacherManagementPage.tsx` |
| 入住管理 | `OccupancyManagementPage.tsx` |
| 查寝结果 | `ResultViewPage.tsx` |
| 任务发布 | `TaskPublishPage.tsx` |
| 账号权限 | `AccountPermissionPage.tsx` |
| 审计日志 | `AuditLogPage.tsx` |
| 系统设置 | `AdminSettingsPage.tsx` |

### 3.4 前端样式文档体系与优先级

如多份文档出现规则冲突，按以下权威优先级裁决（从高到低）：

| 优先级 | 文档 | 定位 | 状态 |
| --- | --- | --- | --- |
| 1（最高） | `frontend/src/styles/base/tokens.css` & `frontend/scripts/check-style-guardrails.js` | 代码真相源与 CI 强制护栏 | 现行生效 |
| 2 | `doc/style_handbook.md`（本文件） | 前端样式总体范式（基础组件 + 管理页 + 分层规则） | 现行主手册 |
| 2 | `doc/modal_style_guide.md` | 桌面端弹窗专项规范（`co-modal`） | 现行专项规范 |
| 2 | `doc/confirm_policy.md` | 确认弹窗风险分级与触发策略 | 现行专项规范 |
| 3 | `AGENTS.md` / `.agent/rules/操作规范.md` | Agent 执行约束与 Figma 工作流映射 | 现行规则（对齐主手册） |
| 3 | `doc/figma_ready_design_package.md` | 代码到 Figma 的双向映射包 | 现行参考 |
| 3 | `frontend/frontend-architecture-guidelines.md` | 前端目录分层与代码体积护栏 | 现行架构规范 |
| 4（历史） | `doc/management_table_standard_guide.md`、`doc/style_audit_appcss.md`、`doc/style_prompt_optimization.md`、`doc/finished/*` | 历史迁移背景、审计与早期提案（不再作为开发依据） | 已收敛 / 归档 |

---

## 4. 新增 / 修改检查项（人类 & Agent 通用）

提交或评审任何前端样式/UI 变更前，逐项核对：

- [ ] **入口与文件**：新样式写在 `frontend/src/styles/components/*.css` 且已在 `frontend/src/styles/index.css` 中 `@import`；未创建或触碰 `App.css` / `src/index.css`。
- [ ] **令牌与深色模式**：仅使用 `--co-*`（或管理页 `--dorm-*`），未新增 `--color-*`、`#hex`、`rgb()`/`hsl()` 硬编码色值，亮/暗模式均可读。
- [ ] **组件复用**：按钮用 `apple-btn-*`（工具栏叠加 `dorm-toolbar-button*`）；高密度表单用 `apple-form apple-form-compact`；移动端列表用 `mobile-compact-card`；筛选用 `FilterDropdownPanel` / `MobileAdvancedFilter`。
- [ ] **管理页骨架**：外层含 `management-theme-page`，使用 `dorm-toolbar-shell` / `dorm-table-head` / `dorm-table-wrapper` + `dorm-table`，未混用 `macos-table`。
- [ ] **桌面端弹窗**：满足 `className="co-modal"`、`centered`、`width={MODAL_WIDTH.*}`、纯文本标题、规范按钮、无内联高度/顶部偏移（详见 [modal_style_guide.md](./modal_style_guide.md)）。
- [ ] **自动化护栏**：在 `frontend/` 下运行 `npm run lint:styleguard` 通过。
