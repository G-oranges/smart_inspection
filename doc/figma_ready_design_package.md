# Figma-ready Design Package

> 目标：把当前代码中的样式规范转成可直接用于 Figma 工作流的规范包，并以学生管理页作为首个样板页。
>
> 当前前提：已连接 Figma 账号，但当前团队席位为 `View`。本轮只输出规范包与文件蓝图，不直接写入 Figma 文件。

---

## 1. Package Overview

本规范包面向两类场景：

1. 将现有代码体系沉淀为 Figma 设计系统
2. 后续获得 Figma 编辑权限后，按统一结构建立 Foundations、Patterns、Components 和 Templates

本包的事实来源只有以下三类：

- 样式主手册：`doc/style_handbook.md`
- 设计令牌：`frontend/src/styles/base/tokens.css`
- 管理页样板实现：`frontend/src/pages/StudentManagementPage.tsx` 与 `frontend/src/pages/student/*`

不做的事：

- 不重发明一套视觉语言
- 不把管理页做成营销落地页
- 不脱离代码现状臆造新的管理页 class 前缀

---

## 2. Code To Figma Mapping

### 2.1 Foundations

| Code Contract | Source | Figma Expression | Notes |
| --- | --- | --- | --- |
| `--co-primary` | `tokens.css` | Color Variable / Brand / Primary | 主操作色 |
| `--co-primary-hover` | `tokens.css` | Color Variable / Brand / Primary Hover | 交互态 |
| `--co-primary-active` | `tokens.css` | Color Variable / Brand / Primary Active | 按压态 |
| `--co-success` / `--co-warning` / `--co-error` / `--co-info` | `tokens.css` | Semantic Color Variables | 状态体系 |
| `--co-text` / `--co-text-secondary` / `--co-text-muted` | `tokens.css` | Text Color Variables | 正文层级 |
| `--co-glass-*` | `tokens.css` | Glass Surface Variables | 玻璃面板、blur、边框与 shadow |
| `--co-radius-*` | `tokens.css` | Radius Variables | 统一圆角尺度 |
| `--co-transition*` | `tokens.css` | Motion Notes | 用于注释，不必强制做成原型动画 token |

### 2.2 Management Theme

| Code Contract | Source | Figma Expression | Notes |
| --- | --- | --- | --- |
| `management-theme-page` | `style_handbook.md` + `dorm-management.css` | Template Scope / Management Page Frame | 管理页主题作用域 |
| `--dorm-toolbar-*` | `dorm-management.css` | Management Pattern Variables | 工具栏背景、边框、hover |
| `--dorm-table-*` | `dorm-management.css` | Management Pattern Variables | 表格背景、表头、hover、selected |
| `--dorm-action-*` | `dorm-management.css` | Action Tone Variables | 表格操作按钮色调 |

### 2.3 Components

| Code Contract | Source | Figma Expression | Notes |
| --- | --- | --- | --- |
| `apple-btn-primary` | `button-apple.css` | Button / Primary | 基础主按钮 |
| `apple-btn-secondary` | `button-apple.css` | Button / Secondary | 基础次按钮 |
| `dorm-toolbar-button-primary` | `dorm-management.css` | Management / Toolbar / Primary | 管理页密度版主按钮 |
| `dorm-toolbar-button-subtle` | `dorm-management.css` | Management / Toolbar / Subtle | 管理页次级操作 |
| `dorm-toolbar-button-danger` | `dorm-management.css` | Management / Toolbar / Danger | 危险批量操作 |
| `filter-trigger-btn` | `filter-panel.css` | Filter Chip / Trigger | 桌面筛选入口 |
| `mobile-compact-card` | `mobile-compact.css` | Mobile / List Item / Compact | 移动端列表卡片 |
| `apple-form` + `apple-form-compact` | `form-apple.css` + `form-compact.css` | Form / Compact Layout | 高密度编辑表单 |
| `apple-drawer ios-action-sheet` | `action-sheet.css` | Mobile / Drawer / Sheet | 移动底部承载容器 |

### 2.4 Component To Code Anchors

| Figma Display Name | Code Anchor |
| --- | --- |
| `Management / Stats / Apple Card` | `frontend/src/components/common/AppleStatCard.tsx` |
| `Management / Filters / Desktop Panel` | `frontend/src/components/common/FilterDropdownPanel.tsx` |
| `Management / Filters / Mobile Advanced` | `frontend/src/components/common/MobileAdvancedFilter.tsx` |
| `Management / Action Sheet / iOS` | `frontend/src/components/common/IOSActionSheet.tsx` |
| `Management / Student / Desktop Toolbar` | `frontend/src/pages/student/StudentToolbar.tsx` |
| `Management / Student / Mobile Filters` | `frontend/src/pages/student/StudentMobileFilters.tsx` |
| `Management / Student / Form Modal` | `frontend/src/pages/student/modals/StudentFormModal.tsx` |

说明：

- Figma 中允许使用中性命名。
- 但每个页面模式和组件都必须保留到代码文件或类名的映射，避免实现阶段失联。

---

## 3. Recommended Figma File Blueprint

后续获得可编辑权限后，推荐使用一个新的专用 Figma 文件，不直接污染未知存量文件。

### 3.1 Page Structure

```text
00 Foundations
01 Management Patterns
02 Components
10 Templates / Student Management
```

### 3.2 `00 Foundations`

应包含：

- Brand colors
- Semantic status colors
- Light / dark text colors
- Glass surface fills, borders, shadows, blur notes
- Radius scale
- Type hierarchy notes
- Motion / transition note

建议分区：

- `Color Variables / Brand`
- `Color Variables / Semantic`
- `Color Variables / Text`
- `Surface Variables / Glass`
- `Radius`
- `Typography`
- `Motion Notes`

### 3.3 `01 Management Patterns`

应包含：

- Theme container anatomy
- Toolbar anatomy
- Table header anatomy
- Table wrapper / density pattern
- Desktop filter pattern
- Mobile filter entry pattern
- Selection state bar

建议命名：

- `Management / Container / Theme Scope`
- `Management / Toolbar / Anatomy`
- `Management / Table / Header`
- `Management / Table / Wrapper`
- `Management / Filters / Desktop`
- `Management / Filters / Mobile`
- `Management / Selection / State Bar`

### 3.4 `02 Components`

应包含：

- Primary / secondary buttons
- Toolbar button variants
- Filter trigger chips
- Compact stat card
- Mobile compact card
- Compact form field group
- Drawer footer actions

建议命名：

- `Button / Primary`
- `Button / Secondary`
- `Management / Toolbar / Primary`
- `Management / Toolbar / Subtle`
- `Management / Toolbar / Danger`
- `Filter / Trigger`
- `Card / Stat / Apple`
- `Card / List / Compact Mobile`
- `Form / Compact / Field`
- `Drawer / Footer / Actions`

### 3.5 `10 Templates / Student Management`

应包含以下样板画板：

- `Student Management / Desktop / List`
- `Student Management / Desktop / List Selected`
- `Student Management / Mobile / List`
- `Student Management / Mobile / Advanced Filter Drawer`
- `Student Management / Desktop / Form Modal`
- `Student Management / Mobile / Form Drawer`

---

## 4. Student Management Template Spec

学生管理页是当前首个管理类模板。视觉方向应保持产品工作面克制感，不引入 homepage hero、展示型装饰段落或营销化标语。

### 4.1 Template Thesis

- Visual thesis：Linear-style restraint + Apple glass surfaces，用明确层级而不是堆卡片来表达管理工作面
- Content plan：统计 -> 搜索/操作 -> 筛选 -> 列表 -> 详情/编辑承载
- Interaction thesis：轻量入场、清晰 hover/active、移动端以 drawer/action sheet 承接次级操作

### 4.2 Desktop List View

区域结构：

1. Page shell
2. Stats board
3. Desktop toolbar
4. Filter row
5. Table header
6. Table wrapper
7. Batch selection state

| Region | Visual Job | Code Mapping | Token / Pattern Reuse | Avoid |
| --- | --- | --- | --- | --- |
| Page shell | 提供管理页背景与作用域 | `management-theme-page` + `PageLayout` | `--dorm-*`, `--co-bg` | 不要套 homepage hero |
| Stats board | 快速提供总量与结构信息 | `CollapsibleStatsBoard`, `StudentStats` | `AppleStatCard`, brand/semantic colors | 不要做 dashboard mosaic |
| Desktop toolbar | 搜索与主操作 | `StudentToolbar` | `dorm-toolbar-shell`, `apple-btn-*`, `dorm-toolbar-button*` | 不要把全部按钮塞成一行 |
| Filter row | 提供可扩展筛选入口 | `FilterDropdownPanel` | `filter-trigger-btn`, glass panel tokens | 不要把全部筛选平铺 |
| Table header | 统一列表标题与更新时间 | `dorm-table-head*` | management header pattern | 不要自造第二种表头 |
| Table wrapper | 承载主工作面 | `dorm-table-wrapper`, `dorm-table` | `--dorm-table-*` | 不要混用 `macos-table` |
| Batch selection state | 表示跨页选择与批量动作 | `StudentToolbar` selection state block | primary tint + compact action row | 不要隐藏关键选择状态 |

### 4.3 Mobile List Entry + Advanced Filter Drawer

区域结构：

1. Mobile search bar
2. Filter trigger
3. Reset action
4. Compact list cards
5. Advanced filter drawer
6. Row action sheet

| Region | Visual Job | Code Mapping | Token / Pattern Reuse | Avoid |
| --- | --- | --- | --- | --- |
| Search row | 移动端首层入口 | `MobileSearchBar` | `apple-btn-primary`, compact input | 不要塞过多控件 |
| Filter trigger | 展示筛选状态 | `MobileSearchBar` | count badge, subtle surface | 不要把筛选项全部露出 |
| List card | 高密度信息扫描 | `StudentMobileCard` | `mobile-compact-card`, compact labels/values | 不要改成大卡片营销样式 |
| Advanced filter drawer | 承载复杂筛选 | `StudentMobileAdvancedFilter`, `MobileAdvancedFilter` | left nav + right panel layout | 不要做成弹窗堆叠 |
| Action sheet | 承载单行次级操作 | `StudentActionSheet`, `IOSActionSheet` | iOS sheet pattern | 不要改成多层菜单 |

### 4.4 Create/Edit Form Modal And Drawer

区域结构：

1. Title
2. Compact field grid
3. Inline switch field
4. Footer actions

| Region | Visual Job | Code Mapping | Token / Pattern Reuse | Avoid |
| --- | --- | --- | --- | --- |
| Modal title | 明确新增/编辑状态 | `StudentFormModal` | compact title hierarchy | 不要引入副标题噪音 |
| Field grid | 高密度信息录入 | `apple-form apple-form-compact` | compact form layout | 不要重做另一套表单密度 |
| Inline switch | 容纳布尔字段 | `form-item-inline-switch` | compact control height | 不要破坏行高对齐 |
| Drawer footer | 移动端主次操作 | `apple-drawer ios-action-sheet` + buttons | primary/secondary buttons | 不要引入第三种按钮风格 |

---

## 5. Foundations And Component Notes

### 5.1 Color And Theme Modes

Figma 中应显式区分：

- Brand colors
- Semantic status colors
- Text hierarchy colors
- Light mode glass surfaces
- Dark mode glass surfaces

建议：

- 建立 Light / Dark 两组 mode
- 所有组件优先绑定变量，不使用散落的本地填充色

### 5.2 Typography

代码中当前主字体栈为：

- `Inter`
- `PingFang SC`
- `Hiragino Sans GB`
- `Microsoft YaHei`

Figma 中可将其表述为：

- Primary Latin UI Font: Inter
- Primary CJK UI Font: PingFang SC compatible stack note

说明：

- 当前代码未将完整字号层级抽成单独 typography token 文件
- Figma 中应先以“规范说明 + 样板文本样式”承载，而不是臆造一整套未落地 type scale

### 5.3 Icons

- 当前图标系统基于 `@ant-design/icons`
- Figma 组件说明中应注明：图标默认映射到 Ant Design icons 语义集合
- 不建议在样板页中引入新的图标风格系统

### 5.4 Assets

当前本地静态资源目录：

- `frontend/src/assets`

当前可见资源：

- `react.svg`
- `stitch-role-management-ref.png`

规范：

- 本项目不是图片驱动型 marketing site
- 管理页模板不应依赖大面积摄影或情绪图

---

## 6. Future Figma Execution Steps

当前不执行写入，但后续获得可编辑权限后，按以下顺序落地。

### 6.1 Preferred Path: New Dedicated File

1. 确认可编辑 team 或 file
2. 新建专用 design system file
3. 建 `00 Foundations`
4. 建 `01 Management Patterns`
5. 建 `02 Components`
6. 建 `10 Templates / Student Management`
7. 为关键变量与组件建立 code mapping

推荐理由：

- 避免污染未知历史文件
- 更利于后续扩展为多个管理页模板

### 6.2 Alternate Path: Update Existing Writable File

仅在满足以下前提时采用：

- 文件已有明确设计系统定位
- 命名规则与本包兼容
- 不会和现有 component library 冲突

更新顺序不变：

1. 先 foundations
2. 再 patterns
3. 再 components
4. 再 student template

### 6.3 Permission Constraint

当前已知限制：

- 已连接 Figma 账号
- 当前可见团队席位为 `View`

因此默认假设：

- 不能直接在当前团队下写入文件
- 未来执行应使用新可编辑团队或某个明确可写文件

---

## 7. Acceptance Checklist

- `AGENTS.md` 中的规则均能回溯到代码路径
- 本文档中的 token、组件和页面映射与 `style_handbook.md` 一致
- 学生管理页样板覆盖 desktop、mobile、form 三大场景
- Figma 文件蓝图覆盖 foundations、patterns、components、templates 四层
- 即使没有 Figma 编辑权限，也可以直接把本包交给后续执行者继续建文件
