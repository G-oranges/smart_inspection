# Phase 1 PR-4: Account 模块 DB 写操作补 Global Confirm

## 状态: ✅ 已完成

## 变更范围

仅修改两个文件（共 6 处）：

1. `frontend/src/pages/account-permission/useAccountActions.jsx`
2. `frontend/src/pages/AccountPermissionPage.jsx`

## 变更摘要

| 操作            | 函数名                       | 变更内容                                                                                       |
| --------------- | ---------------------------- | ---------------------------------------------------------------------------------------------- |
| A) 单用户删除   | `handleDeleteSingleUser`     | 补 fullName/username 缺失校验 → `message.error` + return；补 `Modal.confirm`（danger）         |
| B) 生成临时密码 | `handleGenerateTempPassword` | 补 id/username 缺失校验 → `message.error` + return；补 `Modal.confirm`（primary）              |
| C) 批量权限覆盖 | `handleBatchSaveOverrides`   | 补 N=0 校验 → `message.warning`（含"请选择/用户"关键词）+ return；补 `Modal.confirm`（danger） |

## Modal.confirm 统一配置

所有 confirm 弹窗均包含：

- `okText` / `cancelText`
- `okType`（删除/批量更新为 danger；生成临时密码为 default/primary）
- `maskClosable: false`
- `keyboard: false`
- Promise 包裹，保证 `await` 语义（返回 boolean）

## 文案规格

- **单删**: `即将删除用户「${fullName}」(${username})。该操作不可撤销，确认继续？`
- **临时密码**: `即将为用户「${fullName||username}」生成临时密码。临时密码生成后将立即生效，可用于登录系统。原密码保持不变，请及时将临时密码告知用户并提醒修改。`
- **批量权限**: `即将为 ${N} 个用户批量更新权限覆盖设置。该操作将直接覆盖现有权限配置，确认继续？`

## Lint / Build 摘要

- **lint**: 0 error, 4 warning（均为变更前已存在的 `max-lines-per-function` × 2 + `exhaustive-deps` × 2）
- **build**: ✅ 成功 (16.48s, Exit code 0)
