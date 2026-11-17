# Phase 2 — 危险操作两阶段确认机制 实施记录

> 日期：2026-02-14  
> 状态：✅ 已完成  
> lint：0 error / 3 warning（均为既有问题）  
> build：✓ built in 15.54s，0 error

---

## 变更文件清单

| 文件                        | 变更类型    | 说明                                                                                                                                               |
| --------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AccountPermissionPage.jsx` | 新增 + 修改 | 新增 `strongDangerConfirm`；改造 `handleBulkDelete` / `handleDeleteSingleUser`；移除桌面端多余 `Popconfirm` 包裹；清理未使用的 `Popconfirm` import |
| `UserColumns.jsx`           | 修改        | 单个删除按钮增加 `Popconfirm` 第一层                                                                                                               |
| `UserActionSheet.jsx`       | 修改        | 移除多余 `Modal.confirm`，直接调用 `onBulkDelete`                                                                                                  |

---

## 实现细节

### 1. `strongDangerConfirm` 函数

- 位于 `AccountPermissionPage.jsx` 组件外部（纯函数）
- 返回 `Promise<boolean>`
- 使用 `Modal.confirm` + `modal.update()` 实现 5 秒倒计时
- 倒计时期间 `okButtonProps.disabled = true`
- 每秒更新 `okText: "${okText} (N)"`
- 倒计时结束恢复 `okText` 并启用按钮
- `maskClosable: false` + `keyboard: false` 防止误关

### 2. 单个删除（两阶段）

```
用户点击行内「删除」按钮
  └─ 第一层：Popconfirm（UserColumns.jsx 操作列）
       └─ onConfirm → handleDeleteSingleUser(user)
            └─ 第二层：strongDangerConfirm（5s 倒计时）
                 └─ 确认 → 执行 deleteUsers
```

### 3. 批量删除（两阶段）

```
桌面端：直接 onClick → handleBulkDelete
移动端：UserActionSheet → onBulkDelete → handleBulkDelete

handleBulkDelete 内部：
  └─ 第一层：Modal.confirm（Promise 包装，await 关闭后再弹第二层）
       └─ 第二层：strongDangerConfirm（5s 倒计时）
            └─ 确认 → 执行 deleteUsers
```

### 4. 密码初始化（单层确认）

```
桌面端：直接 onClick → handleResetPassword
移动端：UserActionSheet → onResetPassword → handleResetPassword

handleResetPassword 内部：
  └─ 仅一层 Modal.confirm → 执行 resetUserPassword
```

---

## 消除的问题

| 问题                                                                     | 修复方式                                       |
| ------------------------------------------------------------------------ | ---------------------------------------------- |
| 桌面端批量删除双重确认（Popconfirm + Modal.confirm）                     | 移除 Popconfirm，改为按钮直接 onClick          |
| 桌面端密码初始化双重确认（Popconfirm + Modal.confirm）                   | 移除 Popconfirm，改为按钮直接 onClick          |
| 移动端批量删除双重确认（UserActionSheet Modal + handleBulkDelete Modal） | UserActionSheet 移除 Modal.confirm             |
| 两个 Modal 同时存在                                                      | 第一层使用 Promise 包装 await 关闭后再弹第二层 |
