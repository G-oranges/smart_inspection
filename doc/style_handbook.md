# Style Handbook

> 目标：将现有样式体系收口为可复用的开发规范，而不是继续维护一份只做盘点的样式索引。
>
> 适用范围：所有管理类页面、通用组件、移动端列表、表单弹窗与 Ant Design token 化覆盖层。

---

## 1. 手册定位

本手册是当前项目的样式主手册，优先级高于零散进展文档和页面内临时注释。

使用方式：

1. 新页面开发：先按本手册选容器、按钮、表格、筛选、表单组合，再补业务差异。
2. 老页面整改：先判断页面是否属于“管理页”，若是，优先迁入 `management-theme-page` + 管理页公共契约。
3. 新增样式：只能扩展 `--co-*` 设计令牌，不再扩展旧 `--color-*` / `--glass-*` / `--radius-*` 体系。

过渡说明：

- `App.css` 仍然存在，是迁移期遗留层，不应作为新样式入口。
- `dorm-*` 目前已经承担“管理页通用样式”职责，即使名字带有宿舍语义，也应视为现行有效契约。
- 后续如抽象为更中性的 `co-mgmt-*` 前缀，应以代码重构为前提；本手册不虚构未落地前缀。

---

## 2. 当前样式入口架构

唯一全局入口：`frontend/src/styles/index.css`

```text
frontend/src/styles/
├── index.css
├── tailwind.css
├── base/
│   ├── tokens.css
│   └── reset.css
├── vendors/
│   └── antd-overrides.css
├── legacy/
│   └── legacy.css
└── components/
    ├── glass.css
    ├── glass-legacy.css
    ├── animations.css
    ├── layout.css
    ├── auth.css
    ├── task-publish.css
    ├── dorm-grid.css
    ├── assignment-pool.css
    ├── apple-utilities.css
    ├── title-dropdown.css
    ├── stats.css
    ├── utilities.css
    ├── font-scale.css
    ├── mobile-compact.css
    ├── app-shell.css
    ├── overlay.css
    ├── action-sheet.css
    ├── pill-bar.css
    ├── task-publish-modal.css
    ├── result-detail-modal.css
    ├── filter-panel.css
    ├── dorm-management.css
    ├── form-apple.css
    ├── form-compact.css
    ├── dropdown-apple.css
    ├── custom-select.css
    ├── date-picker-apple.css
    ├── table-layout.css
    ├── table-macos.css
    ├── table-resize.css
    ├── account-permission.css
    ├── button-apple.css
    ├── tag-apple.css
    ├── result-entry.css
    └── admin-settings.css
```

规范：

- `main.jsx` 只能导入 `styles/index.css`。
- 新样式文件应挂到 `styles/components/`、`styles/vendors/` 或 `styles/base/`，不再给 `App.css` 追加新块。
- 组件样式优先写成“可组合契约”，避免把业务名写死在类名中；现有 `dorm-*` 属于历史例外，但已升级为管理页公共层。

禁止：

- 新页面直接把样式写回 `App.css`。
- 绕过 `styles/index.css` 单独引入某个局部样式文件。
- 在业务组件里新增第二套全局 CSS 入口。

---

## 3. 设计令牌规范

唯一真相源：`frontend/src/styles/base/tokens.css`

### 3.1 当前允许使用的变量体系

| 体系 | 前缀 | 状态 | 说明 |
| --- | --- | --- | --- |
| 新体系 | `--co-*` | 现行标准 | 所有新样式都应从这里取值 |
| 旧体系 | `--color-*` / `--glass-*` / `--radius-*` | 兼容保留 | 仅用于存量兼容，不再扩展 |

### 3.2 推荐优先级

1. 颜色、半透明面板、文字色、按钮背景，优先复用 `--co-*`
2. 交互动效优先复用 `--co-transition` / `--co-transition-fast`
3. 圆角优先复用 `--co-radius-*`
4. 管理页局部差异通过作用域变量覆写，不要在组件里硬编码新色值

### 3.3 管理页作用域变量

`frontend/src/styles/components/dorm-management.css` 在以下容器作用域内注入管理页变量：

- `management-theme-page`
- `dorm-management-page`

当前关键变量族：

- `--dorm-toolbar-*`
- `--dorm-table-*`
- `--dorm-text-*`
- `--dorm-action-*`
- `--dorm-pagination-*`

规范：

- 管理页外观差异优先通过这些作用域变量调整，而不是在单个按钮或表格节点上重复写 `bg-*`、`border-*`。
- 页面必须先有主题容器，局部类才有正确的颜色、边框和 hover 表现。

---

## 4. 管理页通用主题

管理类 CRUD 页面统一采用：

```tsx
<div className="management-theme-page">
  <PageLayout ...>
    ...
  </PageLayout>
</div>
```

### 4.1 主题容器契约

| 契约 | 作用 |
| --- | --- |
| `management-theme-page` | 注入管理页桌面主题变量，作为表格、工具栏、筛选面板、分页等样式作用域 |
| `dorm-management-page` | 旧业务容器，仍有效；新管理页优先使用 `management-theme-page` |

推荐：

- 新管理页统一包裹 `management-theme-page`
- 页面内部的工具栏、筛选面板、表格头、表格 wrapper 都在该容器内渲染

禁止：

- 跳过主题容器，直接在普通页面节点里使用 `dorm-toolbar-shell`、`dorm-table-wrapper`
- 在管理页容器外单独挂载局部表格头和筛选器，导致变量不生效

### 4.2 管理页工具栏契约

桌面端标准结构：

```tsx
<div className="dorm-toolbar-shell">
  <div className="dorm-toolbar-row dorm-toolbar-row-main">
    {/* 搜索输入 + 主搜索按钮 + 重置 */}
  </div>
  <div className="dorm-toolbar-row dorm-toolbar-row-actions">
    {/* 新增 / 导入 / 导出 / 字段管理 / 批量操作 */}
  </div>
</div>

<div className="dorm-toolbar-row dorm-toolbar-row-filters">
  {/* FilterDropdownPanel 等筛选入口 */}
</div>
```

当前有效公共接口：

- `dorm-toolbar-shell`
- `dorm-toolbar-row`
- `dorm-toolbar-row-main`
- `dorm-toolbar-row-actions`
- `dorm-toolbar-row-filters`

按钮叠加规则：

- 基础主按钮：`apple-btn-primary`
- 基础次按钮：`apple-btn-secondary`
- 管理页密度收敛：`dorm-toolbar-button`
- 主操作按钮：`dorm-toolbar-button-primary`
- 次要按钮：`dorm-toolbar-button-subtle`
- 危险批量按钮：`dorm-toolbar-button-danger`

推荐：

- 按钮先拿 Apple 基础按钮风格，再叠加管理页按钮类收敛高度、圆角和字重
- 搜索框使用 `dorm-toolbar-search`

禁止：

- 只写 `apple-btn-primary`，不叠加管理页按钮类就塞进列表工具栏
- 在工具栏按钮上继续堆过多 Tailwind 临时样式，导致和 `dorm-management.css` 冲突

### 4.3 管理页表格头契约

标准结构：

```tsx
<div className="table-head dorm-table-head mb-4">
  <div className="flex items-center gap-2">
    <div className="dorm-table-head-accent" />
    <h3 className="dorm-table-head-title">实时列表</h3>
    <span className="dorm-table-head-time">最后更新: {lastRefreshedAt}</span>
  </div>
</div>
```

公共接口：

- `dorm-table-head`
- `dorm-table-head-accent`
- `dorm-table-head-title`
- `dorm-table-head-time`

推荐：

- 所有管理页列表都保留统一表头装饰
- 时间文案仅用于动态列表；静态配置列表可省略 `dorm-table-head-time`

禁止：

- 省略 `dorm-table-head`，只保留裸标题
- 单独复刻一个新表头类名，造成风格分叉

### 4.4 管理页表格容器契约

标准结构：

```tsx
<div className="table-wrapper dorm-table-wrapper">
  <ResponsiveDataView className="dorm-table" ... />
</div>
```

公共接口：

- `dorm-table-wrapper`
- `dorm-table`

推荐：

- 桌面端统一使用 `dorm-table`
- 表格外围统一放进 `dorm-table-wrapper`

禁止：

- 新管理页继续混用 `macos-table` 与 `dorm-table`
- 只给表格加 `dorm-table`，却漏掉 `dorm-table-wrapper`

补充说明：

- 旧文档 `doc/management_table_standard_guide.md` 中的管理页表格标准已并入本手册；原文档仅作为迁移背景参考。

---

## 5. 学生管理页标准样板

学生管理页是当前管理类 CRUD 页的标准样板，优先级高于旧的“仅样式类清单”写法。

参考实现：

- `frontend/src/pages/StudentManagementPage.tsx`
- `frontend/src/pages/student/StudentToolbar.tsx`
- `frontend/src/pages/student/StudentMobileFilters.tsx`
- `frontend/src/pages/student/modals/StudentFormModal.tsx`

### 5.1 页面骨架

```tsx
<div className="management-theme-page">
  <PageLayout
    statsLayout="custom"
    stats={<CollapsibleStatsBoard expandedContent={<StudentStats ... />} ... />}
    filters={<StudentPageFilters ... />}
  >
    <div className="table-head dorm-table-head mb-4">
      <div className="flex items-center gap-2">
        <div className="dorm-table-head-accent" />
        <h3 className="dorm-table-head-title">实时列表</h3>
        <span className="dorm-table-head-time">最后更新: ...</span>
      </div>
    </div>

    <div className="table-wrapper dorm-table-wrapper">
      <StudentTableSection ... />
    </div>
  </PageLayout>
</div>
```

结构职责：

- `management-theme-page`：提供管理页作用域变量
- `PageLayout`：负责页面骨架和插槽
- `CollapsibleStatsBoard`：桌面与移动统一的统计承载层
- `StudentPageFilters`：根据端能力切换桌面工具栏和移动筛选入口
- `StudentTableSection`：统一列表渲染与 rowSelection

### 5.2 统计区

学生管理页用 `StudentStats` 作为统计区样板，其职责是把业务数据映射到统一统计卡，而不是自己发明一套新布局。

推荐组合：

- 统计卡组件：`AppleStatCard`
- 统计容器：`CollapsibleStatsBoard`
- 指标映射函数：`mapStudentStatsToSegments`

规范：

- 统计区负责“总量 / 结构 / 当前筛选结果”三类信息
- 统计卡优先复用现有 tone 和 dotColor，不新增业务专属色

### 5.3 桌面工具栏

学生管理页桌面工具栏由 `StudentToolbar` 实现，是当前列表页桌面交互样板。

职责分层：

- 搜索区：搜索词输入、搜索、重置
- 主操作区：新增、导入、导出、字段管理
- 批量状态区：已选数量、跨页全选、清空、批量删除
- 筛选区：`FilterDropdownPanel` + 学院专业班级级联器

规范：

- 搜索与主操作分行管理，避免把全部按钮塞进单行造成拥挤
- 字段筛选优先通过 `FilterDropdownPanel` 渲染
- 学院/专业/班级使用 `CollegeMajorClassCascader`，不重复造局部三级筛选器

### 5.4 移动端入口

学生管理页移动端入口由 `MobileSearchBar` 和 `StudentMobileAdvancedFilter` 提供，是当前移动管理页列表标准。

推荐组合：

- 搜索入口：`MobileSearchBar`
- 高级筛选容器：`MobileAdvancedFilter`
- 级联字段：`CollegeMajorClassCascader`

规范：

- 移动端只保留搜索、筛选、重置三个核心入口
- 高级筛选使用抽屉式承载，不在首屏堆叠大量控件

### 5.5 表单弹窗与移动底部抽屉

学生新增/编辑弹窗由 `StudentFormModal` 实现，桌面端用 `Modal`，移动端用 `Drawer`，属于高密度 Apple 表单样板。

标准组合：

```tsx
<Form layout="vertical" className="apple-form apple-form-compact">
  ...
</Form>
```

移动端抽屉：

```tsx
<Drawer className="apple-drawer ios-action-sheet" ... />
```

规范：

- 同一业务表单在桌面与移动端只切承载容器，不重写字段布局逻辑
- 高密度表单统一使用 `apple-form + apple-form-compact`
- 行内开关字段使用 `form-item-inline-switch`

---

## 6. 组件级规范

### 6.1 按钮规范

基础按钮：

- `apple-btn-primary`
- `apple-btn-secondary`

管理页工具栏叠加：

- `dorm-toolbar-button`
- `dorm-toolbar-button-primary`
- `dorm-toolbar-button-subtle`
- `dorm-toolbar-button-danger`

推荐：

- 基础样式交给 `button-apple.css`
- 管理页密度和上下文差异交给 `dorm-management.css`

禁止：

- 为同一按钮同时叠加多套互斥按钮类
- 在管理页里重新定义另一套主次按钮配色

### 6.2 高密度表单规范

推荐组合：

- `apple-form`
- `apple-form-compact`
- `form-item-inline-switch`

当前约束来自 `form-apple.css` 与 `form-compact.css`：

- label 使用更小字号与更高字重
- 控件高度统一在紧凑区间
- Select、Input、Switch 对齐
- 移动端自动提升控件高度

适用场景：

- 学生编辑
- 教师编辑
- 需要在单个 Modal / Drawer 中容纳较多字段的表单

禁止：

- 在紧凑表单里再叠加自定义控件高度硬编码
- 单独给某个字段补一套新的 label 样式

### 6.3 移动紧凑卡片规范

基础卡片契约：

- `mobile-compact-card`
- `compact-card-header`
- `compact-card-grid`
- `compact-label`
- `compact-value`

规范：

- 管理页移动列表优先基于 `mobile-compact-card` 构建
- 选中态使用 `.selected`
- 信息密度优先通过 `compact-card-grid` 控制，而不是在卡片内部手写多套布局

禁止：

- 新建另一套移动列表卡片基础类
- 只用 Tailwind 临时拼一个卡片，跳过已有卡片契约

### 6.4 筛选面板规范

桌面端优先：

- `FilterDropdownPanel`
- `filter-dropdown-panel`
- `filter-trigger-btn`
- `filter-expanded-panel`

移动端优先：

- `MobileAdvancedFilter`
- `mobile-advanced-filter-drawer`

规范：

- 桌面端筛选应保持轻量触发器 + 展开面板模式
- 移动端筛选应使用抽屉承载
- 复杂级联字段复用通用级联组件，不在页面内重复实现联动逻辑

禁止：

- 每个页面重复发明一套筛选容器类名
- 桌面端把所有筛选控件直接平铺在工具栏首屏

### 6.5 Action Sheet / Drawer 规范

移动端底部抽屉统一使用：

- `apple-drawer ios-action-sheet`
- `ios-action-sheet-drawer`

适用场景：

- 表单编辑
- 筛选面板
- 轻量操作菜单

规范：

- 底部抽屉优先承载移动端次级交互
- 与桌面端 `Modal` 共享内容结构，避免双份表单

---

## 7. Do / Don't

### Do

- 使用 `management-theme-page` 作为管理页顶层作用域
- 使用 `dorm-toolbar-shell`、`dorm-table-head`、`dorm-table-wrapper` 组成标准列表页
- 使用 `apple-btn-*` 作为按钮基础层，再叠加管理页按钮类
- 使用 `apple-form apple-form-compact` 构建高密度编辑弹窗
- 使用 `mobile-compact-card` 承载移动端列表项
- 使用 `FilterDropdownPanel` 和 `MobileAdvancedFilter` 区分桌面与移动筛选

### Don't

- 不再为新管理页直接追加 `App.css` 局部硬编码
- 不再扩展旧变量体系
- 不再跳过 `management-theme-page` 直接套表格样式
- 不再混用 `macos-table` 与 `dorm-table`
- 不再在页面内部私造新的筛选容器、移动卡片、表格头基础类

---

## 8. 适用页面与参考文档

当前已采用管理页主题契约的代表页面包括：

- `StudentManagementPage.tsx`
- `BuildingManagementPage.tsx`
- `AccountPermissionPage.tsx`
- `ResultViewPage.tsx`
- `AuditLogPage.tsx`

补充参考：

- `doc/management_table_standard_guide.md`
- `doc/style_audit_appcss.md`

说明：

- 上述补充文档可用于理解历史迁移背景。
- 后续若出现规则冲突，以本手册和实际代码契约为准。
