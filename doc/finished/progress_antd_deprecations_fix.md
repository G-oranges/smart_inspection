# Ant Design v6 弃用属性修复进展

**更新时间**: 2025-12-25 16:27

## 问题描述

在浏览器控制台中出现以下 Ant Design v6 弃用警告：

1. `[antd: Tag] 'bordered={false}' is deprecated. Please use 'variant="filled"' instead.`
2. `[antd: Card] 'bordered' is deprecated. Please use 'variant' instead.`
3. `[antd: Modal] 'destroyOnClose' is deprecated. Please use 'destroyOnHidden' instead.`

## 修复规则

| 组件  | 旧属性             | 新属性                 |
| ----- | ------------------ | ---------------------- |
| Tag   | `bordered={false}` | `variant="filled"`     |
| Card  | `bordered={false}` | `variant="borderless"` |
| Modal | `destroyOnClose`   | `destroyOnHidden`      |

## 已修复文件

### 1. TeacherManagementPage.jsx

- ✅ `Tag bordered={false}` → `variant="filled"` (行 528)
- ✅ `Modal destroyOnClose` → `destroyOnHidden` (行 839)

### 2. TaskPublishPage.jsx

- ✅ `Tag bordered={false}` → `variant="filled"` (行 864)
- ✅ `Card bordered={false}` → `variant="borderless"` (行 1054)
- ✅ `Modal destroyOnClose` → `destroyOnHidden` (行 1255)

### 3. StudentManagementPage.jsx

- ✅ `Tag bordered={false}` → `variant="filled"` (行 680, 770)
- ✅ `Modal destroyOnClose` → `destroyOnHidden` (行 1294)

### 4. ResultViewPage.jsx

- ✅ `Card bordered={false}` → `variant="borderless"` (行 377, 409, 432, 689, 874, 913)
- ✅ `Tag bordered={false}` → `variant="filled"` (行 385)

### 5. ResultEntryPage.jsx

- ✅ `Card bordered={false}` → `variant="borderless"` (行 680, 762, 856, 1010, 1029, 1222)
- ✅ `Tag bordered={false}` → `variant="filled"` (行 710, 714, 716)

### 6. DashboardPage.jsx

- ✅ `Card bordered={false}` → `variant="borderless"` (行 172, 189, 206, 221, 238, 264, 303, 322)

### 7. AdminSettingsPage.jsx

- ✅ `Card bordered={false}` → `variant="borderless"` (行 225, 238, 273, 314, 352, 437, 474, 485, 506)
- ✅ `Tag bordered={false}` → `variant="filled"` (行 246)

### 8. AccountPermissionPage.jsx

- ✅ `Card bordered={false}` → `variant="borderless"` (行 943, 950, 1075, 1344, 1355, 1404, 1508, 1693)
- ✅ `Tag bordered={false}` → `variant="filled"` (行 1701, 1722)

## 验证结果

使用 `grep` 命令确认：

- ✅ `bordered={false}` - 在 `.jsx` 文件中已无匹配项
- ✅ `destroyOnClose` - 在 `.jsx` 文件中已无匹配项

## 状态

✅ **已完成** - 所有 Ant Design v6 弃用属性警告已修复
