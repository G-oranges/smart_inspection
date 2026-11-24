# 待处理功能入口清单（UX 文案审查留存）

记录日期：2026-11-24  
说明：以下入口在全站 UX 文案审查中识别为「点击后功能未实现或跑不通」，按当前决策**暂不隐藏入口**，留存至此待后续补齐前后端能力。

---

## 1. 入住管理页：导出与字段设置入口未实现

- **位置**：
  - `frontend/src/pages/OccupancyManagementPage.tsx`（桌面工具栏与移动端操作入口）
  - `frontend/src/pages/occupancy/OccupancyFilters.tsx`
- **现状**：
  - 点击「导出」仅弹出 toast：`导出功能开发中`。
  - 点击「字段设置」（原「字段管理」）仅弹出 toast：`字段设置功能开发中`。
- **后续处理建议**：
  1. 补齐入住概览与异动记录的 Excel 导出接口及前端下载逻辑。
  2. 接入 `TableFieldSettings` 与 `tableConfigService` 持久化列配置，与其他管理页保持一致。

---

## 2. 用户与权限页：「全选筛选结果」后无法执行批量操作

- **位置**：
  - `frontend/src/pages/AccountPermissionPage.tsx`
  - `frontend/src/pages/account-permission/useAccountActions.tsx`（`handleBulkDelete`、`handleResetPassword`）
- **现状**：
  - 用户列表工具栏提供了「全选筛选结果」跨页全选入口；但勾选后点击「批量删除」或「重置密码」时，会被拦截并提示不支持跨页批量操作。
- **后续处理建议**：
  - **方案 A（推荐）**：后端支持按筛选条件执行跨页批量操作，或在前端支持拉取筛选结果 ID 列表后分批提交。
  - **方案 B**：若出于安全考虑明确禁止跨页批量删除/重置密码，则从工具栏移除「全选筛选结果」入口，仅保留当前页全选。
