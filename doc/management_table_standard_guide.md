# 管理页面表格样式标准化指南

为了在全站实现如“宿舍管理”页面般精致的 Apple 风格表格，我们对现有的样式冲突进行了清理，并总结出一套“完美应用” Standard 公式。

## 1. 核心差异分析：为什么之前样式不统一？

通过分析 `dorm-management.css` 与 `table-macos.css`，我们发现了以下主要矛盾：

| 维度 | 宿舍管理 (目标风格) | 楼栋/学生管理 (旧风格) | 冲突后果 |
| :--- | :--- | :--- | :--- |
| **CSS 类名** | `.dorm-table` | `.macos-table` | `macos-table` 中包含大量硬编码的 `!important` 规则。 |
| **字体细节** | 14px, 正常字重 | 11px, 全大写 (Uppercase) | 导致表头文字极小且难以阅读，风格过于冷峻。 |
| **边距与间距** | 细腻的 Padding, 紧凑布局 | 较大的默认 Padding | 表格显得松散，不够精致。 |
| **复选框样式** | 居中，对齐精准 | 存在偏移 | 视觉上复选框与文字不在一条线上。 |

## 2. 完美应用“公式” (标准化实施步骤)

若要将新页面改造为标准风格，请遵循以下结构：

### A. 容器命名 (注入变量)
确保最外层容器包含 `management-theme-page` 类。这是所有 `--dorm-*` 变量的来源。
```tsx
<div className="management-theme-page">
   <PageLayout ...>
```

### B. 工具栏结构 (Toolbar)
使用标准的 `dorm-toolbar-shell` 类，而不是通用的 Card。
```tsx
<div className="dorm-toolbar-shell">
  <div className="dorm-toolbar-row dorm-toolbar-row-main">
    {/* 搜索框与主按钮 */}
  </div>
  <div className="dorm-toolbar-row dorm-toolbar-row-actions">
    {/* 功能按钮组 */}
  </div>
</div>
```

### C. 表头装饰 (Table Head)
使用带修饰条的表头。
```tsx
<div className="table-head dorm-table-head mb-4">
  <div className="flex items-center gap-2">
    <div className="dorm-table-head-accent" />
    <h3 className="dorm-table-head-title">实时列表</h3>
    <span className="dorm-table-head-time">最后更新: {lastRefreshedAt}</span>
  </div>
</div>
```

### D. 表格封装 (Table Wrapper)
必须使用 `dorm-table-wrapper` 包裹表格。
```tsx
<div className="table-wrapper dorm-table-wrapper">
  <ResponsiveDataView
    className="dorm-table" // 关键：移除 macos-table，仅保留 dorm-table
    ...
  />
</div>
```

## 3. 已完成的修复清单

我们已在以下页面中移除了冲突的 `macos-table` 类，并统一为标准的 `dorm-table` 样式：

1.  **楼栋管理 (`BuildingManagementPage.tsx`)** - 已修复
2.  **学生管理 (`StudentManagementPage.tsx`)** - 已修复
3.  **教职工管理 (`TeacherManagementPage.tsx`)** - 已修复
4.  **入住管理 (`OccupancyManagementPage.tsx`)** - 已修复
5.  **查寝结果 (`ResultViewPage.tsx`)** - 已修复
6.  **账号权限 (`AccountPermissionPage.tsx`)** - 已修复

## 4. 后续建议

建议在近期将 `dorm-management.css` 中的通用表格样式（如 `.dorm-table`, `.dorm-toolbar`）迁移至 `management-table-standard.css` 并更名为 `.co-mgmt-table`，以彻底消除“宿舍”这一业务语义对通用样式的绑定。
