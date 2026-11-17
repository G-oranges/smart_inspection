# TaskPublishPage 移动端黑屏修复

## 修复时间

2026-02-07 02:06

## 问题描述

移动端访问任务发布页面时出现黑屏，桌面端正常显示。

## 问题原因

`TaskPublishPage.jsx` 第 240 行使用了 `<ResponsiveDataView>` 组件，但文件顶部**未导入该组件**，导致移动端渲染时抛出 `ReferenceError: ResponsiveDataView is not defined`。

控制台报错：

```
TaskPublishPage.jsx:240 Uncaught ReferenceError: ResponsiveDataView is not defined
    at TaskPublishPage (TaskPublishPage.jsx:240:14)
```

### 代码问题位置

```jsx
// 第 239-250 行 - 问题代码
{isMobile ? (
  <ResponsiveDataView  // ❌ 未导入！
    isMobile={true}
    dataSource={filteredTasks}
    ...
  />
) : (
  <TaskPublishTable ... />  // ✅ 桌面端使用的是 TaskPublishTable，已导入
)}
```

桌面端正常是因为走的是 `else` 分支，使用的是已正确导入的 `TaskPublishTable`。

## 修复方案

在 `TaskPublishPage.jsx` 顶部添加缺失的导入语句：

```jsx
import ResponsiveDataView from "../components/ResponsiveDataView.jsx";
```

## 全局检查结果

| 页面                        | 使用 ResponsiveDataView | 已导入         | 状态      |
| --------------------------- | ----------------------- | -------------- | --------- |
| **TaskPublishPage.jsx**     | ✅ 第240行              | ❌ → ✅ 已修复 | 🟢 已修复 |
| TeacherManagementPage.jsx   | ✅ 第271行              | ✅ 第39行      | ✅ 正常   |
| StudentManagementPage.jsx   | ✅ 第378行              | ✅ 第20行      | ✅ 正常   |
| ResultViewPage.jsx          | ✅ 第602行              | ✅ 第17行      | ✅ 正常   |
| OccupancyManagementPage.jsx | ✅ 第626行              | ✅ 第8行       | ✅ 正常   |
| DormManagementPage.jsx      | ✅ 第429行              | ✅ 第51行      | ✅ 正常   |
| BuildingManagementPage.jsx  | ✅ 第446行              | ✅ 第34行      | ✅ 正常   |
| AuditLogPage.jsx            | ✅ 第84行               | ✅ 第5行       | ✅ 正常   |
| AccountPermissionPage.jsx   | ✅ 第729行              | ✅ 第24行      | ✅ 正常   |

**其他页面均无类似问题。**

## 构建验证

```
✓ 4051 modules transformed.
✓ built in 20.48s
Exit code: 0
```

## 其他警告（非阻塞，后续可清理）

Ant Design v5/v6 API 变更提示：

- `overlayClassName` → `classNames.root`
- `width`/`height` → `size`

这些是代码债务，不影响功能。
