# Phase 1 确认补全 — PR 拆解执行计划

> **基准**: `doc/confirm_policy_audit_fix_plan.md` Phase 1  
> **日期**: 2026-02-12  
> **约束**: 不涉及 Phase 2（样式/Popconfirm 升级）和 Phase 3（useConfirm 封装）  
> **PR策略**: 4 个 PR，可并行开发，允许按序合并但不互相阻塞

---

## PR 列表总览

| PR       | 标题                                                   | 模块      | 优先级 | 涉及文件数 | 依赖 |
| -------- | ------------------------------------------------------ | --------- | ------ | ---------- | ---- |
| **PR-1** | feat(occupancy): 入住/迁宿/互换操作补全 Global Confirm | Occupancy | P0     | 1          | 无   |
| **PR-2** | feat(building): 单个楼栋删除升级为 Global Confirm      | Building  | P0     | 2          | 无   |
| **PR-3** | feat(occupancy): 批量入住补全无条件 Global Confirm     | Occupancy | P0     | 2          | 无   |
| **PR-4** | feat(account): 单用户删除/临时密码/批量授权补全确认    | Account   | P0+P1  | 2          | 无   |

> 四个 PR 分别修改不同文件（PR-1 与 PR-3 虽都属 Occupancy 模块，但修改的是完全不同的文件），因此可以并行开发、独立合并。

---

## PR-1: feat(occupancy): 入住/迁宿/互换操作补全 Global Confirm

### 1) 修改范围

| 文件                                               | 函数             | 行号     | 改动类型     |
| -------------------------------------------------- | ---------------- | -------- | ------------ |
| `frontend/src/components/ResidencyAdjustModal.jsx` | `handleSubmit()` | L152-192 | 插入确认拦截 |

**不涉及的文件**:

- Columns、Service 层均无需改动
- Modal 的 `onOk` 绑定 (`L210`) 保持不变

### 2) 变更策略

**当前调用链**: Modal `onOk` → `handleSubmit()` → 直接调用 `assignOccupancy` / `moveBed` / `swapBedOccupancy`

**改动点**: 在 `handleSubmit()` 函数内部，`form.validateFields()` 成功之后、`setLoading(true)` 之前（即 L155 与 L156 之间），插入一个 `Modal.confirm()` 拦截。

**具体逻辑**:

1. 在 L155（`const values = await form.validateFields()`）之后，根据 `mode` 和 `isSwapping` 构造不同的确认文案
2. 使用 `await new Promise(resolve => Modal.confirm({...}))` 模式（项目中已有此模式，见 `useOccupancyActions.jsx:L184`）
3. 用户取消时直接 `return`；确认后继续执行 L156 及以下的原有逻辑
4. 原有的 `try/catch/finally` 结构和 `setLoading` 逻辑完全保留

**三个分支的确认内容**:

| 条件                               | 分支     | 确认入口 |
| ---------------------------------- | -------- | -------- |
| `mode === "assign"`                | L164-170 | 确认分配 |
| `mode !== "assign" && isSwapping`  | L172-177 | 确认互换 |
| `mode !== "assign" && !isSwapping` | L178-181 | 确认调宿 |

### 3) 统一确认文案

#### 分支 A: 入住分配（assign）

```
title:    "确认入住分配"
content:  "即将为「{student.fullName}」({student.studentNo}) 分配至 {values.room} 房 {values.bed} 号床。确认办理？"
okText:   "确认分配"
cancelText: "取消"
okType:   默认（primary，非 danger）
```

#### 分支 B: 床位互换（swap）

```
title:    "确认床位互换"
content:  "「{student.fullName}」将与目标床位的在住学生互换位置，双方住宿信息将同时变更。确认互换？"
okText:   "确认互换"
cancelText: "取消"
okType:   "danger"
```

#### 分支 C: 调宿迁移（move）

```
title:    "确认调宿"
content:  "「{student.fullName}」将从当前位置迁移至 {values.room} 房 {values.bed} 号床，原床位将释放。确认调宿？"
okText:   "确认调宿"
cancelText: "取消"
okType:   默认（primary）
```

### 4) 验收标准

**AC-1: 入住分配场景**

```
Given  用户在 ResidencyAdjustModal 中选定了 mode="assign"、目标楼栋/楼层/房间/床位
When   点击"确认办理"按钮
Then   弹出 Modal.confirm，标题为"确认入住分配"，内容包含学生姓名和目标床位
  And  点击"确认分配" → 调用 assignOccupancy，成功后显示 message.success
  And  点击"取消" → 不执行任何写操作，Modal 保持打开
```

**AC-2: 调宿迁移场景**

```
Given  用户在 ResidencyAdjustModal 中选定了 mode="move"、目标为空床位
When   点击"确认办理"按钮
Then   弹出 Modal.confirm，标题为"确认调宿"，内容包含"原床位将释放"
  And  确认后调用 moveBed，成功后显示 message.success
```

**AC-3: 床位互换场景**

```
Given  用户在 ResidencyAdjustModal 中选定了 mode="move"、目标床位已有学生（isSwapping=true）
When   点击"确认办理"按钮
Then   弹出 Modal.confirm，标题为"确认床位互换"，okType 为 danger
  And  确认后调用 swapBedOccupancy
```

### 5) 回归测试清单

**手工测试**:

- [ ] 桌面端：入住分配 → 确认弹窗出现 → 确认 → 成功
- [ ] 桌面端：入住分配 → 确认弹窗出现 → 取消 → 无变化
- [ ] 桌面端：调宿（空目标）→ 确认弹窗 → 确认 → 成功
- [ ] 桌面端：调宿（有人目标/互换）→ 确认弹窗（danger）→ 确认 → 成功
- [ ] 移动端：同上四个场景（Modal 在移动端可正常显示）
- [ ] 表单校验失败时不弹确认（如未选床位）

**自动化命令**:

```powershell
chcp 65001
cd d:\my_project_bychatgpt\frontend
npm run lint -- --no-warn-ignored
npm run build
```

### 6) 风险评估与回滚策略

| 风险项   | 等级 | 说明                                                                               |
| -------- | ---- | ---------------------------------------------------------------------------------- |
| 改动范围 | 低   | 仅修改 1 个文件 1 个函数，插入确认拦截逻辑                                         |
| 功能影响 | 低   | 只增加确认步骤，不改变后续业务逻辑                                                 |
| 异步竞态 | 中   | `await new Promise(resolve => Modal.confirm(...))` 模式需确保 resolve 不被重复调用 |

**回滚**: `git revert <commit-sha>` 即可。仅删除插入的 Modal.confirm 块，恢复直接执行。

---

## PR-2: feat(building): 单个楼栋删除升级为 Global Confirm

### 1) 修改范围

| 文件                                                 | 函数                   | 行号         | 改动类型                                                      |
| ---------------------------------------------------- | ---------------------- | ------------ | ------------------------------------------------------------- |
| `frontend/src/pages/building/BuildingColumns.jsx`    | `createActionColumn()` | L7, L141-151 | 移除 Popconfirm 包裹，改为 Button 直接触发 `onDelete(record)` |
| `frontend/src/pages/building/useBuildingActions.jsx` | `handleDelete()`       | L95-106      | 插入 Modal.confirm 拦截                                       |

### 2) 变更策略

**文件 1: `BuildingColumns.jsx`**

| 位置     | 当前代码                                                 | 改为                                                                                                |
| -------- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| L7       | `import { Button, Space, Popconfirm, Tag } from "antd";` | 移除 `Popconfirm` 导入                                                                              |
| L141-151 | `<Popconfirm>` 包裹删除按钮                              | 仅保留 `<Button>` 直接 `onClick={() => onDelete(record)}`（注意：传完整 `record` 替代 `record.id`） |

**文件 2: `useBuildingActions.jsx`**

| 位置    | 当前代码                                     | 改为                                                                                                      |
| ------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| L95-106 | `handleDelete(id)` 直接 `deleteBuilding(id)` | 改函数签名为 `handleDelete(record)`，内部先弹 `Modal.confirm()`，确认后再执行 `deleteBuilding(record.id)` |

**注意**: `handleDelete` 被 `BuildingColumns.jsx` 中的 `onDelete` 回调引用，同时在 `BuildingManagementPage.jsx`（如果有）的 `mergeColumnsWithAction` 中传入。改签名后需确认调用方也传 `record`。

### 3) 统一确认文案

```
title:      "确认删除楼栋"
content:    "您确定要删除楼栋「{record.name}」吗？如果该楼栋下仍有关联宿舍，删除将失败。此操作不可撤销。"
okText:     "删除"
cancelText: "取消"
okType:     "danger"
```

### 4) 验收标准

**AC-1: 楼栋删除确认**

```
Given  楼栋列表中有一条楼栋记录
When   点击该行"删除"按钮
Then   弹出 Modal.confirm（非 Popconfirm），标题为"确认删除楼栋"
  And  内容包含该楼栋名称
  And  okType 为 danger，okText 为"删除"
  And  点击"删除" → 调用 deleteBuilding(id)
  And  点击"取消" → 无操作
```

**AC-2: 无 Popconfirm 残留**

```
Given  合并 PR-2 后
When   在 BuildingColumns.jsx 中搜索 "Popconfirm"
Then   无结果（import 和 JSX 均已移除）
```

### 5) 回归测试清单

**手工测试**:

- [ ] 桌面端：楼栋列表 → "删除" → Modal 弹出 → 确认 → 成功
- [ ] 桌面端：楼栋列表 → "删除" → Modal 弹出 → 取消 → 无变化
- [ ] 桌面端：删除有关联宿舍的楼栋 → 确认 → 后端返回错误 → message.error 正常显示
- [ ] 移动端：楼栋列表 → "删除" → Modal 正常弹出
- [ ] 桌面端：批量删除楼栋（已有 Modal.confirm） → 功能不受影响
- [ ] 桌面端："详情"/"编辑"按钮 → 功能不受影响

**自动化命令**:

```powershell
chcp 65001
cd d:\my_project_bychatgpt\frontend
npm run lint -- --no-warn-ignored
npm run build
```

### 6) 风险评估与回滚策略

| 风险项          | 等级 | 说明                                                                  |
| --------------- | ---- | --------------------------------------------------------------------- |
| 函数签名变更    | 中   | `handleDelete(id)` → `handleDelete(record)`，需确认所有调用方同步更新 |
| Popconfirm 移除 | 低   | 纯 JSX 删除操作                                                       |
| 行为差异        | 低   | 从气泡确认变为模态确认，用户操作路径一致                              |

**回滚**: `git revert <commit-sha>`。恢复 Popconfirm、恢复 `handleDelete(id)` 签名。

---

## PR-3: feat(occupancy): 批量入住补全无条件 Global Confirm

### 1) 修改范围

| 文件                                                   | 函数                   | 行号     | 改动类型                       |
| ------------------------------------------------------ | ---------------------- | -------- | ------------------------------ |
| `frontend/src/pages/occupancy/useOccupancyActions.jsx` | `handleBatchCheckIn()` | L171-228 | 插入无条件确认                 |
| `frontend/src/pages/OccupancyManagementPage.jsx`       | `handleBatchCheckIn()` | L449-506 | 同步插入无条件确认（平行副本） |

> ⚠️ 项目中有两份 `handleBatchCheckIn` 实现：模块化版本（useOccupancyActions.jsx）和旧版（OccupancyManagementPage.jsx），**必须同步修改**。

### 2) 变更策略

**两个文件的改动逻辑完全一致**：

| 步骤 | 位置（useOccupancyActions）                  | 位置（OccupancyMgmtPage） | 描述                 |
| ---- | -------------------------------------------- | ------------------------- | -------------------- |
| 1    | L178-181 `if (assignmentsList.length === 0)` | L456-459                  | 保留，空分配提前返回 |
| 2    | L183-192 条件性 Modal.confirm                | L461-471                  | **替换**为无条件确认 |
| 3    | L195 `setBatchLoading(true)`                 | L473                      | 移入确认回调内       |

**改动核心**:

- **删除** L183 的 `if (assignmentsList.length < studentsToBeAssigned.length)` 条件判断
- **替换**为在 L182（空分配校验之后、setBatchLoading 之前）插入一个**无条件** `Modal.confirm()`
- 原来"分配未完成"的提示信息，**合并到确认弹窗的 content 中**作为条件性附加文案
- 确认后执行 `setBatchLoading(true)` 及后续原有逻辑
- 取消则直接 `return`

### 3) 统一确认文案

#### 场景 A: 全部分配完成

```
title:      "确认批量入住"
content:    "即将为 {assignmentsList.length} 名学生办理入住手续，确认提交？"
okText:     "确认入住"
cancelText: "取消"
okType:     默认（primary）
```

#### 场景 B: 部分分配（assignmentsList.length < studentsToBeAssigned.length）

```
title:      "确认批量入住"
content:    "您选中了 {studentsToBeAssigned.length} 名学生，但仅为 {assignmentsList.length} 人分配了床位。\n将仅为已分配的 {assignmentsList.length} 人办理入住，确认提交？"
okText:     "确认入住"
cancelText: "取消"
okType:     默认（primary）
```

### 4) 验收标准

**AC-1: 全部分配 → 确认**

```
Given  选中 3 名未入住学生，在弹窗中为 3 人全部分配了床位
When   点击"提交入住"
Then   弹出 Modal.confirm，内容为"即将为 3 名学生办理入住手续，确认提交？"
  And  确认 → 调用 batchCheckIn → 成功
  And  取消 → 不执行
```

**AC-2: 部分分配 → 确认带附加说明**

```
Given  选中 5 名未入住学生，仅为 3 人分配了床位
When   点击"提交入住"
Then   弹出 Modal.confirm，内容包含"您选中了 5 名学生，但仅为 3 人分配了床位"
  And  确认 → 仅为 3 人调用 batchCheckIn
```

**AC-3: 空分配 → 无弹窗**

```
Given  选中学生但未分配任何床位
When   点击"提交入住"
Then   显示 message.warning("请先为学生分配床位")，不弹确认
```

**AC-4: 两份代码同步**

```
Given  合并 PR-3 后
When   对比 useOccupancyActions.jsx 和 OccupancyManagementPage.jsx 中的 handleBatchCheckIn
Then   两者的确认逻辑结构一致
```

### 5) 回归测试清单

**手工测试**:

- [ ] 桌面端：选 3 人、全分配 → 确认弹窗 → 确认 → 成功
- [ ] 桌面端：选 5 人、分配 3 人 → 确认弹窗（含部分分配提示）→ 确认 → 成功
- [ ] 桌面端：选 5 人、分配 3 人 → 确认弹窗 → 取消 → 停留在分配弹窗
- [ ] 桌面端：未分配 → 提交 → warning 提示（不弹确认）
- [ ] 移动端：同上四个场景
- [ ] 桌面端：批量退宿 → 不受影响（已有独立的 Modal.confirm）
- [ ] 部分失败结果弹窗 → 不受影响

**自动化命令**:

```powershell
chcp 65001
cd d:\my_project_bychatgpt\frontend
npm run lint -- --no-warn-ignored
npm run build
```

### 6) 风险评估与回滚策略

| 风险项             | 等级 | 说明                                                                                |
| ------------------ | ---- | ----------------------------------------------------------------------------------- |
| 双副本同步         | 高   | OccupancyManagementPage.jsx 和 useOccupancyActions.jsx 有平行代码，**必须同时修改** |
| 原有条件确认被替换 | 中   | 原来"分配未完成"的独立确认被合并进统一确认弹窗，需确保文案语义不丢失                |
| 用户体验           | 低   | 增加一步确认，批量操作场景可接受                                                    |

**回滚**: `git revert <commit-sha>`。两个文件各恢复一个函数。

---

## PR-4: feat(account): 单用户删除/临时密码/批量授权补全确认

### 1) 修改范围

| 文件                                                          | 函数                           | 行号     | 改动类型                       | 优先级 |
| ------------------------------------------------------------- | ------------------------------ | -------- | ------------------------------ | ------ |
| `frontend/src/pages/account-permission/useAccountActions.jsx` | `handleDeleteSingleUser()`     | L213-225 | 插入 Modal.confirm             | **P0** |
| `frontend/src/pages/AccountPermissionPage.jsx`                | `handleDeleteSingleUser()`     | L545-557 | 插入 Modal.confirm（平行副本） | **P0** |
| `frontend/src/pages/account-permission/useAccountActions.jsx` | `handleGenerateTempPassword()` | L177-189 | 插入 Modal.confirm             | **P1** |
| `frontend/src/pages/AccountPermissionPage.jsx`                | `handleGenerateTempPassword()` | L535-543 | 插入 Modal.confirm（平行副本） | **P1** |
| `frontend/src/pages/account-permission/useAccountActions.jsx` | `handleBatchSaveOverrides()`   | L269-287 | 插入 Modal.confirm             | **P1** |
| `frontend/src/pages/AccountPermissionPage.jsx`                | `handleBatchSaveOverrides()`   | L623-636 | 插入 Modal.confirm（平行副本） | **P1** |

> ⚠️ 项目中同样存在 `AccountPermissionPage.jsx`（旧版）和 `useAccountActions.jsx`（模块化版本）两份平行实现。**每个函数需同步修改两处**。

### 2) 变更策略

#### 2a. handleDeleteSingleUser（P0）

**当前**: L213-225 直接调用 `deleteUsers({ ids: [user.id] })`，无确认。

**改动**: 在 `if (!deleteUsers) return;` 之后、`setBatchLoading(true)` 之前，插入 `Modal.confirm()`。确认后再执行删除。将 `setBatchLoading(true)` 及 `try/catch/finally` 整体移入 `onOk` 回调。

#### 2b. handleGenerateTempPassword（P1）

**当前**: L177-189 直接调用 `generateTemporaryPassword(user.id)`，无确认。

**改动**: 在 `if (!generateTemporaryPassword) return;` 之后，插入 `Modal.confirm()`。确认后再执行生成。将 `try/catch` 移入 `onOk` 回调。

#### 2c. handleBatchSaveOverrides（P1）

**当前**: L269-287 直接调用 `batchUpdateUserOverrides(batchUserIds, overrides)`，无确认。

**改动**: 在 overrides 构造之后、API 调用之前，插入 `Modal.confirm()`。确认后再执行。将 `try/catch` 移入 `onOk` 回调。

### 3) 统一确认文案

#### handleDeleteSingleUser

```
title:      "确认删除用户"
content:    "您确定要删除用户「{user.fullName}」({user.username}) 吗？此操作不可撤销。"
okText:     "删除"
cancelText: "取消"
okType:     "danger"
```

#### handleGenerateTempPassword

```
title:      "确认生成临时密码"
content:    "将为用户「{user.fullName}」({user.username}) 生成新的临时密码，原登录凭证可能受影响。确认生成？"
okText:     "确认生成"
cancelText: "取消"
okType:     默认（primary）
```

#### handleBatchSaveOverrides

```
title:      "确认批量更新权限"
content:    "即将为 {batchUserIds.length} 个用户更新权限覆盖配置，变更将立即生效。确认提交？"
okText:     "确认更新"
cancelText: "取消"
okType:     默认（primary）
```

### 4) 验收标准

**AC-1: 单用户删除**

```
Given  在用户列表中对某用户执行"删除"操作（行内按钮或 ActionSheet）
When   触发 handleDeleteSingleUser
Then   弹出 Modal.confirm，标题"确认删除用户"，内容含用户姓名
  And  确认 → 调用 deleteUsers → 成功
  And  取消 → 不执行
```

**AC-2: 生成临时密码**

```
Given  在用户列表中对某用户执行"生成临时密码"
When   触发 handleGenerateTempPassword
Then   弹出 Modal.confirm，标题"确认生成临时密码"
  And  确认 → 调用 generateTemporaryPassword → 弹出密码结果弹窗
  And  取消 → 不执行
```

**AC-3: 批量授权**

```
Given  在权限管理 Tab，选中 N 个用户并配置了权限覆盖
When   点击"保存"触发 handleBatchSaveOverrides
Then   弹出 Modal.confirm，内容含"{N} 个用户"
  And  确认 → 调用 batchUpdateUserOverrides → 成功消息
  And  取消 → 不执行
```

**AC-4: 两份代码同步**

```
Given  合并 PR-4 后
When   对比 useAccountActions.jsx 和 AccountPermissionPage.jsx 中的三个函数
Then   两者确认逻辑结构一致
```

### 5) 回归测试清单

**手工测试**:

- [ ] 桌面端：单用户删除 → 确认弹窗 → 确认 → 成功
- [ ] 桌面端：单用户删除 → 确认弹窗 → 取消 → 无变化
- [ ] 移动端 ActionSheet：删除单用户 → 确认弹窗 → 确认 → 成功
- [ ] 桌面端：生成临时密码 → 确认弹窗 → 确认 → 显示密码弹窗
- [ ] 桌面端：生成临时密码 → 确认弹窗 → 取消 → 不执行
- [ ] 桌面端：批量授权保存 → 确认弹窗 → 确认 → 成功消息
- [ ] 桌面端：批量授权保存 → 确认弹窗 → 取消 → 不执行
- [ ] 桌面端：批量删除用户 → 已有 Modal.confirm → 不受影响
- [ ] 桌面端：重置密码 → 已有 Modal.confirm → 不受影响
- [ ] 桌面端：切换用户状态 → 已有 Modal.confirm → 不受影响

**自动化命令**:

```powershell
chcp 65001
cd d:\my_project_bychatgpt\frontend
npm run lint -- --no-warn-ignored
npm run build
```

### 6) 风险评估与回滚策略

| 风险项                          | 等级 | 说明                                                                                      |
| ------------------------------- | ---- | ----------------------------------------------------------------------------------------- |
| 双副本同步                      | 高   | AccountPermissionPage.jsx 和 useAccountActions.jsx 有平行代码，3 个函数 × 2 份 = 6 处修改 |
| handleBatchSaveOverrides 返回值 | 中   | 模块化版本有 `return true/false`，Modal.confirm 是异步的，需注意调用方是否依赖同步返回值  |
| 连续弹窗                        | 低   | 生成临时密码会先弹确认、再弹密码显示，两个弹窗是顺序的不会冲突                            |
| 改动量                          | 中   | 2 个文件、6 处改动，需仔细对齐                                                            |

**回滚**: `git revert <commit-sha>`。6 处改动均为 Modal.confirm 包裹，恢复直接调用即可。

---

## 附录：各 PR 涉及文件交叉检查

```
                                ResidencyAdjust  BuildingColumns  useBuildingActions  useOccupancyActions  OccupancyMgmt  useAccountActions  AccountPermission
PR-1 (assign/move/swap)              ✏️             -               -                   -                   -              -                  -
PR-2 (building delete)               -              ✏️              ✏️                  -                   -              -                  -
PR-3 (batchCheckIn)                  -              -               -                   ✏️                  ✏️             -                  -
PR-4 (account confirms)             -              -               -                   -                   -              ✏️                 ✏️
```

> ✅ 无交叉：四个 PR 的文件集完全互斥，可并行开发、独立合并。

---

_本文档仅为 PR 拆解计划，不包含代码实现。_
