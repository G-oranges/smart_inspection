# 确认策略一致性校验 & 修复执行计划

> **校验日期**: 2026-02-12  
> **基准文档**: `doc/confirm_policy.md`  
> **审计数据**: `doc/confirm_dialog_audit.md`  
> **目标**: 精确定位策略违反点，输出可执行修复路径

---

## 1. 策略违反清单（精确到文件 + 行号）

### 1.1 违反 L3 必须使用 Global Confirm 的操作

| #      | 违反描述                                                   | 文件路径                                  | 行号     | 当前行为                                                                                                 | 策略要求                                                |
| ------ | ---------------------------------------------------------- | ----------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| **V1** | `assignOccupancy`（入住分配）无任何确认                    | `components/ResidencyAdjustModal.jsx`     | L164-170 | Modal 的 `onOk` 直接调用 `actions.assignOccupancy()`，无二次确认                                         | **L3**：涉及分配操作，必须 Global Confirm               |
| **V2** | `moveBed`（迁宿）无任何确认                                | `components/ResidencyAdjustModal.jsx`     | L178-181 | Modal 的 `onOk` 直接调用 `actions.moveBed()`，无二次确认                                                 | **L3**：涉及迁移操作，影响他人数据，必须 Global Confirm |
| **V3** | `swapBedOccupancy`（床位互换）无任何确认                   | `components/ResidencyAdjustModal.jsx`     | L172-177 | Modal 的 `onOk` 直接调用 `actions.swapBedOccupancy()`，无二次确认                                        | **L3**：涉及两人数据互换，不可逆，必须 Global Confirm   |
| **V4** | 单个楼栋删除使用 Popconfirm（L2）而非 Global Confirm（L3） | `pages/building/BuildingColumns.jsx`      | L141-151 | 使用 `<Popconfirm>` 行内确认                                                                             | **L3**：结构性删除操作，策略明确禁止 Inline Confirm     |
| **V5** | `batchCheckIn`（批量入住）仅在"分配未完成"时有部分确认     | `pages/occupancy/useOccupancyActions.jsx` | L183-192 | 仅当 `assignmentsList.length < studentsToBeAssigned.length` 时弹出 Modal.confirm；全部分配完成时直接提交 | **L3**：批量操作，所有场景必须 Global Confirm           |
| **V6** | 桌面端批量删除用户使用 Popconfirm                          | `pages/AccountPermissionPage.jsx`         | L785-787 | `<Popconfirm title="确认删除">` 包裹批量删除按钮                                                         | **L3**：批量删除不可逆，禁止 Inline Confirm             |
| **V7** | 桌面端批量重置密码使用 Popconfirm                          | `pages/AccountPermissionPage.jsx`         | L788-790 | `<Popconfirm title="确认重置密码">` 包裹批量重置按钮                                                     | **L3**：批量操作 + 影响他人登录态，禁止 Inline Confirm  |

### 1.2 DB 写操作无确认的点

| #      | 操作                                         | 文件路径                                         | 行号     | 当前行为                                                 | 策略要求                                                     |
| ------ | -------------------------------------------- | ------------------------------------------------ | -------- | -------------------------------------------------------- | ------------------------------------------------------------ |
| **W1** | `generateTemporaryPassword`                  | `pages/AccountPermissionPage.jsx`                | L535-543 | 直接调用 `generateTemporaryPassword(user.id)`，无确认    | **L2/L3**：生成临时密码属于敏感操作，至少需要 Inline Confirm |
| **W2** | `generateTemporaryPassword`（模块化版本）    | `pages/account-permission/useAccountActions.jsx` | L177-189 | 同上，无确认直接调用                                     | **L2/L3**：同上                                              |
| **W3** | `batchUpdateUserOverrides`（批量权限更新）   | `pages/AccountPermissionPage.jsx`                | L623-636 | 直接调用，无确认弹窗                                     | **L3**：批量操作 + 影响权限，必须 Global Confirm             |
| **W4** | `batchUpdateUserOverrides`（模块化版本）     | `pages/account-permission/useAccountActions.jsx` | L269-287 | 同上，无确认直接调用                                     | **L3**：同上                                                 |
| **W5** | `updateRolePermissions`（角色权限矩阵切换）  | `pages/account-permission/useAccountActions.jsx` | L230-249 | Checkbox 切换即时生效，无确认                            | **L3**：影响系统配置/权限，策略要求确认                      |
| **W6** | `handleDeleteSingleUser` 无确认              | `pages/account-permission/useAccountActions.jsx` | L213-225 | 直接调用 `deleteUsers({ids: [user.id]})`，**无任何确认** | **L2**：单条删除至少需 Inline Confirm                        |
| **W7** | `handleDeleteSingleUser`（旧版本同样无确认） | `pages/AccountPermissionPage.jsx`                | L545-557 | 同上                                                     | **L2**：同上                                                 |

### 1.3 误用 Popconfirm 执行高风险操作的点

| #      | 操作                                                                                             | 文件路径                             | 行号        | 误用详情                                                                                | 正确做法                                            |
| ------ | ------------------------------------------------------------------------------------------------ | ------------------------------------ | ----------- | --------------------------------------------------------------------------------------- | --------------------------------------------------- |
| **P1** | 单个楼栋删除                                                                                     | `pages/building/BuildingColumns.jsx` | L141-151    | `<Popconfirm title="确定删除该楼栋吗?">` — 楼栋为结构性实体，关联宿舍/床位              | 改用 Global Confirm (Modal.confirm)                 |
| **P2** | 桌面端批量删除用户                                                                               | `pages/AccountPermissionPage.jsx`    | L785-787    | `<Popconfirm title="确认删除">` — 批量删除用户                                          | 改用 Global Confirm，Popconfirm 禁止用于批量操作    |
| **P3** | 桌面端批量重置密码                                                                               | `pages/AccountPermissionPage.jsx`    | L788-790    | `<Popconfirm title="确认重置密码">` — 批量重置密码                                      | 改用 Global Confirm，此为影响他人登录态的高风险操作 |
| **P4** | AccountPermissionPage 中批量删除按钮同时有 Popconfirm 和 `handleBulkDelete` 内部的 Modal.confirm | `pages/AccountPermissionPage.jsx`    | L785 + L461 | Popconfirm 触发 onConfirm → handleBulkDelete → 内部又弹 Modal.confirm，导致**双重确认** | 移除外层 Popconfirm，仅保留内部 Modal.confirm       |
| **P5** | 批量重置密码同理双重确认                                                                         | `pages/AccountPermissionPage.jsx`    | L788 + L497 | Popconfirm 触发 onConfirm → handleResetPassword → 内部又弹 Modal.confirm                | 移除外层 Popconfirm，仅保留内部 Modal.confirm       |

---

## 2. P0 修复执行清单（按优先级排序）

### P0-1: `assignBed` / `assignOccupancy` — 无确认直接执行

| 项目             | 详情                                                                                                                                                                                                                                                                                                         |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **位置**         | `components/ResidencyAdjustModal.jsx` → `handleSubmit()` → L164-170                                                                                                                                                                                                                                          |
| **当前行为**     | 用户在 ResidencyAdjustModal 中选好楼栋/楼层/房间/床位后，点击"确认办理"按钮，Modal 的 `onOk` 直接调用 `actions.assignOccupancy()`，**无二次确认**                                                                                                                                                            |
| **应改为**       | **L3 — Global Confirm**                                                                                                                                                                                                                                                                                      |
| **最小改动策略** | 在 `handleSubmit()` 函数中，当 `mode === "assign"` 时，在调用 `actions.assignOccupancy()` 之前插入 `Modal.confirm()`。确认标题："确认入住分配"；确认内容应包含学生姓名 + 目标床位信息；使用 `okType: "primary"`（非危险操作但不可逆）。仅需改动 `handleSubmit()` 内部逻辑，不影响 Modal 的 `onOk` 触发方式。 |

### P0-2: `moveBed` — 无确认直接执行

| 项目             | 详情                                                                                                                                                                                                                                                                                                                                    |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **位置**         | `components/ResidencyAdjustModal.jsx` → `handleSubmit()` → L178-181                                                                                                                                                                                                                                                                     |
| **当前行为**     | `handleSubmit()` 中 `mode !== "assign" && !isSwapping` 分支直接调用 `actions.moveBed(payload)`，**无二次确认**                                                                                                                                                                                                                          |
| **应改为**       | **L3 — Global Confirm**                                                                                                                                                                                                                                                                                                                 |
| **最小改动策略** | 在 `handleSubmit()` 函数中，当执行 `moveBed` 分支时，插入 `Modal.confirm()`。确认标题："确认调宿"；确认内容应包含学生姓名 + 原位置 + 目标位置；强调"原床位将释放"。同理 `swapBedOccupancy` 分支（L172-177）也需插入 Global Confirm，内容应提示"两名学生将互换床位"。三个分支共用 `handleSubmit`，可以在调用前统一拦截，先弹确认再执行。 |

### P0-3: 单个楼栋删除 — 误用 Popconfirm

| 项目             | 详情                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **位置**         | `pages/building/BuildingColumns.jsx` → `createActionColumn()` → L141-151 <br> `pages/building/useBuildingActions.jsx` → `handleDelete()` → L95-106                                                                                                                                                                                                                                                                            |
| **当前行为**     | 表格行内使用 `<Popconfirm title="确定删除该楼栋吗?">` 触发 `onDelete(record.id)`；`handleDelete()` 中直接调用 `deleteBuilding(id)` 无额外确认                                                                                                                                                                                                                                                                                 |
| **应改为**       | **L3 — Global Confirm**                                                                                                                                                                                                                                                                                                                                                                                                       |
| **最小改动策略** | 方案 A（推荐）：移除 `BuildingColumns.jsx` 中的 `<Popconfirm>` 包裹，改为按钮直接触发 `onDelete(record)`（传完整 record）；在 `useBuildingActions.jsx` 的 `handleDelete()` 内部添加 `Modal.confirm()`，标题"确认删除楼栋"，内容包含楼栋名称 + "关联宿舍将受到影响"的警告，`okType: "danger"`。方案 B：保留 `Popconfirm` 作为第一步快速提示，但在 `handleDelete` 内再弹 `Modal.confirm` 做二次确认（不推荐，双重确认体验差）。 |

### P0-4: `batchCheckIn` — 确认条件不完整

| 项目             | 详情                                                                                                                                                                                                                                                                                                                       |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **位置**         | `pages/occupancy/useOccupancyActions.jsx` → `handleBatchCheckIn()` → L171-228                                                                                                                                                                                                                                              |
| **当前行为**     | 只有当分配不完整时（`assignmentsList.length < studentsToBeAssigned.length`，L183）才弹出 `Modal.confirm()` 提示"分配未完成，是否继续"。当全部分配完成时，**直接执行 `dormService.batchCheckIn()`，无确认**                                                                                                                 |
| **应改为**       | **L3 — Global Confirm（所有场景）**                                                                                                                                                                                                                                                                                        |
| **最小改动策略** | 在 `handleBatchCheckIn()` 中，在 L195（`setBatchLoading(true)`) 之前，插入一个无条件的 `Modal.confirm()`。确认标题："确认批量入住"；确认内容："即将为 {N} 名学生办理入住，分配如下：…"；`okText: "确认入住"`。当分配不完整时，将"分配未完成"的提示合并到这个确认弹窗的内容中，而不是作为独立的前置确认。保持单一确认入口。 |

---

## 3. 模块风险排序

按**策略违规数量**降序排列：

| 排名  | 模块                      | 违规总数 | L3 违规 | 无确认写操作 | Popconfirm 误用 | 典型问题                                                                                                                                                                  |
| ----- | ------------------------- | -------- | ------- | ------------ | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1** | **Account（账号权限）**   | **8**    | 2       | 4            | 3               | 批量删除/重置密码双重确认；`generateTemporaryPassword` 无确认；`batchUpdateUserOverrides` 无确认；`updateRolePermissions` 即时生效无确认；`handleDeleteSingleUser` 无确认 |
| **2** | **Occupancy（入住管理）** | **4**    | 3       | 0            | 0               | `assignOccupancy` / `moveBed` / `swapBedOccupancy` 三项 L3 操作无确认；`batchCheckIn` 确认条件不完整                                                                      |
| **3** | **Building（楼栋管理）**  | **1**    | 1       | 0            | 1               | 单个楼栋删除误用 Popconfirm 替代 Global Confirm                                                                                                                           |
| **4** | **Dorm（宿舍管理）**      | **0**    | 0       | 0            | 0               | 单个/批量删除均已有 Modal.confirm ✅                                                                                                                                      |
| **5** | **Task（任务发布）**      | **0**    | 0       | 0            | 0               | 删除任务已有 Modal.confirm ✅                                                                                                                                             |

> 📝 Teacher / Student / Result / AdminSettings 模块均已通过策略校验，不在此表列出。

---

## 4. 修复阶段划分

### Phase 1：仅补确认（纯功能闭合，零重构）

**目标**：让所有 L3 操作和 DB 写操作 **至少有一个确认拦截**。

| 序号 | 任务                                                                                               | 涉及文件                                                                       | 改动量 | 优先级 |
| ---- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------ | ------ |
| 1.1  | `ResidencyAdjustModal.handleSubmit()` 中三个分支（assign / move / swap）各加 `Modal.confirm()`     | `components/ResidencyAdjustModal.jsx`                                          | ~30 行 | **P0** |
| 1.2  | `useBuildingActions.handleDelete()` 内部加 `Modal.confirm()`，移除 BuildingColumns 中的 Popconfirm | `pages/building/useBuildingActions.jsx` + `BuildingColumns.jsx`                | ~15 行 | **P0** |
| 1.3  | `useOccupancyActions.handleBatchCheckIn()` 添加无条件 `Modal.confirm()`                            | `pages/occupancy/useOccupancyActions.jsx`                                      | ~15 行 | **P0** |
| 1.4  | `handleDeleteSingleUser` 加 Popconfirm 或 Modal.confirm                                            | `pages/account-permission/useAccountActions.jsx` + `AccountPermissionPage.jsx` | ~10 行 | **P0** |
| 1.5  | `handleGenerateTempPassword` 加 Modal.confirm（"确认生成临时密码？"）                              | `useAccountActions.jsx` + `AccountPermissionPage.jsx`                          | ~10 行 | **P1** |
| 1.6  | `handleBatchSaveOverrides` 加 Modal.confirm（"确认批量更新权限？"）                                | `useAccountActions.jsx` + `AccountPermissionPage.jsx`                          | ~10 行 | **P1** |

**Phase 1 交付标准**：所有 DB 写操作至少有 1 次确认拦截，无静默执行。

---

### Phase 2：确认方式升级（L2 → L3 纠正）

**目标**：将误用 Popconfirm（Inline Confirm）执行高风险操作的点，升级为 Global Confirm。

| 序号 | 任务                                                                             | 涉及文件                                                  | 改动描述                                                                                                                             |
| ---- | -------------------------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| 2.1  | 移除桌面端 AccountPermissionPage 工具栏的 Popconfirm 包裹（批量删除 + 批量重置） | `pages/AccountPermissionPage.jsx` L785-790                | 删除 `<Popconfirm>`，让按钮直接调用 `handleBulkDelete` / `handleResetPassword`（这两个函数内部已有 Modal.confirm）。消除双重确认问题 |
| 2.2  | `updateRolePermissions` 权限矩阵切换加确认                                       | `pages/account-permission/useAccountActions.jsx` L230-249 | 在 Checkbox onChange 触发时弹出 Modal.confirm 再执行，防止误触                                                                       |
| 2.3  | 统一 Modal.confirm 的 className 为 `apple-confirm-modal`                         | 所有使用 Modal.confirm 的文件                             | 当前混用 `apple-modal`、`apple-confirm`（未定义）和无类名                                                                            |
| 2.4  | 统一 okText / cancelText 文案风格                                                | 全局                                                      | 按 audit 报告中的文案规范表统一                                                                                                      |

**Phase 2 交付标准**：所有 L3 操作使用 Global Confirm；无 Popconfirm 用于批量/结构性操作。

---

### Phase 3：统一入口封装

**目标**：创建 `useConfirm` Hook 或 `ConfirmProvider`，封装统一确认 API，消除分散实现。

| 序号 | 任务                              | 描述                                                                                                                                        |
| ---- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 3.1  | 创建 `hooks/useConfirm.js`        | 封装 `confirm({ type, title, content, onOk })` 方法，内部根据 `useMobile()` 自动选择桌面端 Modal.confirm 或移动端 IOSActionSheet + 二次确认 |
| 3.2  | 定义 `apple-confirm-modal` CSS 类 | 在 `index.css` 中定义，含浅色/深色模式完整样式规则                                                                                          |
| 3.3  | 全局迁移                          | 将所有 Modal.confirm 调用点替换为 `useConfirm().confirm()`                                                                                  |
| 3.4  | 移动端 L3 操作升级                | 移动端危险操作统一使用 IOSActionSheet → Global Confirm 二步流程                                                                             |
| 3.5  | 添加确认策略 Lint 规则            | 编写 ESLint 自定义规则，禁止 `Popconfirm` 内嵌批量/删除操作按钮                                                                             |

**Phase 3 交付标准**：确认行为由统一 Hook 管理；新增写操作自动继承响应式适配和风险分级。

---

## 附录：快速检索

### 所有需要修改的文件清单

```
Phase 1:
  ✏️ frontend/src/components/ResidencyAdjustModal.jsx
  ✏️ frontend/src/pages/building/useBuildingActions.jsx
  ✏️ frontend/src/pages/building/BuildingColumns.jsx
  ✏️ frontend/src/pages/occupancy/useOccupancyActions.jsx
  ✏️ frontend/src/pages/account-permission/useAccountActions.jsx
  ✏️ frontend/src/pages/AccountPermissionPage.jsx

Phase 2:
  ✏️ frontend/src/pages/AccountPermissionPage.jsx
  ✏️ frontend/src/pages/account-permission/useAccountActions.jsx
  ✏️ 所有含 Modal.confirm 的文件（className 统一）

Phase 3:
  ➕ frontend/src/hooks/useConfirm.js（新建）
  ✏️ frontend/src/index.css（补 apple-confirm-modal 样式）
  ✏️ 全量迁移
```

---

_本文档仅为修复计划，不包含代码实现。_
