# Phase 1 确认补全 — 合并后验收清单

> **基准文档**: `doc/confirm_phase1_pr_plan.md`  
> **验收日期**: 2026-02-12（v2 修订: 2026-02-12）  
> **适用条件**: 四个 PR 全部合并后的总体验收

---

## 1. 合并后总体验收目标

Phase 1 的唯一目标是：**消灭所有 L3 操作和关键 DB 写操作的"静默执行"**。合并全部 4 个 PR 后，`assignOccupancy`、`moveBed`、`swapBedOccupancy`（PR-1）、单个楼栋删除（PR-2）、`batchCheckIn` 全路径（PR-3）、单用户删除 / 生成临时密码 / 批量权限覆盖（PR-4）共 9 个操作点必须在执行前弹出 `Modal.confirm` 全局确认弹窗，用户明确点击确认后才触发后端写操作；点击取消时不产生任何副作用（Network 面板零 POST/PUT/DELETE 请求）。确认弹窗的动态内容（对象名称、数量、后果描述）中不得出现空值或 `undefined`。验收不关注样式统一、Popconfirm 升级或 useConfirm 封装（这些属于 Phase 2/3）。

---

## 2. 统一手工回归步骤

> **前置条件**: 开发环境启动（`npm run dev`），浏览器打开 **DevTools → Network** 面板并保持可见。

### PR-1 覆盖：入住 / 迁宿 / 互换

| #       | 场景                                 | 终端   | 操作                                                           | 预期                                                                                                                   | ✅  |
| ------- | ------------------------------------ | ------ | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | --- |
| **R01** | 入住分配 — 确认                      | 桌面   | 入住管理 → 选未入住学生 → "办理入住" → 选目标床位 → "确认办理" | 弹出 Modal「确认入住分配」→ 点"确认分配" → `message.success` + 数据刷新                                                | ☐   |
| **R02** | 入住分配 — 取消 + Network 证据       | 桌面   | 同 R01，弹窗后点"取消"                                         | Modal 关闭，ResidencyAdjustModal 保持打开；**Network 面板无 POST/PUT/DELETE 请求**                                     | ☐   |
| **R03** | 入住分配 — 校验失败                  | 桌面   | 不选床位直接点"确认办理"                                       | 表单校验报错（红框提示），**不弹 Modal.confirm**                                                                       | ☐   |
| **R04** | 调宿迁移 — 确认                      | 移动端 | 已入住学生 → "调宿" → 选空目标床位 → "确认办理"                | 弹出 Modal「确认调宿」→ 点"确认调宿" → 成功提示                                                                        | ☐   |
| **R05** | 床位互换 — 确认                      | 移动端 | 已入住学生 → "调宿" → 选已占用目标床位 → "确认办理"            | 弹出 Modal「确认床位互换」，okType 为 danger → 确认 → 成功                                                             | ☐   |
| **R06** | 🆕 弹窗内容准确性 — assign/move/swap | 桌面   | 分别触发 R01/R04/R05 的确认弹窗，**不点确认，仅目视弹窗内容**  | ① 学生姓名/学号**不为空、不为 undefined** ② 目标房间号 + 床位号**不为空、不为 undefined** ③ 互换场景提及"互换"或"双方" | ☐   |

### PR-2 覆盖：单个楼栋删除

| #       | 场景                                       | 终端 | 操作                                      | 预期                                                                                                                                                              | ✅  |
| ------- | ------------------------------------------ | ---- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- |
| **R07** | 楼栋删除 — 确认                            | 桌面 | 楼栋管理 → 某行"删除"                     | 弹出 Modal.confirm「确认删除楼栋」（含楼栋名称），okType danger → 确认 → 成功                                                                                     | ☐   |
| **R08** | 楼栋删除 — 取消 + Network 证据             | 桌面 | 同 R07，弹窗后点"取消"                    | 无操作，列表不变；**Network 面板无 DELETE 请求**                                                                                                                  | ☐   |
| **R09** | 楼栋删除 — 后端拒绝                        | 桌面 | 选一个有关联宿舍的楼栋 → "删除" → 确认    | 后端返回错误 → `message.error` 正确显示错误信息                                                                                                                   | ☐   |
| **R10** | 🆕 弹窗内容准确性 — 楼栋名称（**硬门槛**） | 桌面 | 触发 R07 的确认弹窗，**目视弹窗 content** | 弹窗内容中楼栋名称**必须为实际楼栋名（如"1号楼"），严禁出现 `undefined`、空字符串或 `[object Object]`**。若出现则**该 PR 不得合并**，视为签名变更未同步的 P0 缺陷 | ☐   |

### PR-3 覆盖：批量入住

| #       | 场景                         | 终端 | 操作                                                           | 预期                                                                                                                                                                       | ✅  |
| ------- | ---------------------------- | ---- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- |
| **R11** | 全部分配 — 确认              | 桌面 | 选 N 名未入住学生 → 批量入住弹窗 → 全部分配 → "提交入住"       | 弹出 Modal「确认批量入住」→ 内容含"{N} 名学生" → 确认 → 成功                                                                                                               | ☐   |
| **R12** | 部分分配 — 确认              | 桌面 | 选 5 名，仅分配 3 名 → "提交入住"                              | 弹出 Modal「确认批量入住」→ 内容含"您选中了 5 名学生，但仅为 3 人分配" → 确认 → 仅 3 人入住                                                                                | ☐   |
| **R13** | 空分配 — 拦截（关键词校验）  | 桌面 | 选学生但不分配 → "提交入住"                                    | 出现 `message.warning` 提示（关键词包含 **"分配"** 或 **"床位"**），**不弹 Modal.confirm**。不要求精确匹配完整字符串，仅验证 ① warning 类型 ② 关键词命中 ③ 无 confirm 弹出 | ☐   |
| **R14** | 两份实现一致性               | 桌面 | 打开 DevTools Network，分别从两个入口触发批量入住（如存在）    | 两个路径发出的请求和确认弹窗行为一致                                                                                                                                       | ☐   |
| **R15** | 🆕 弹窗内容准确性 — 数量字段 | 桌面 | 分别触发 R11（全分配）和 R12（部分分配），**目视弹窗 content** | ① 学生人数为**正整数**（非 0、非 NaN、非 undefined） ② 部分分配场景中"选中数">"已分配数"，两个数字均正确                                                                   | ☐   |

### PR-4 覆盖：Account 模块

| #       | 场景                                               | 终端   | 操作                                                                      | 预期                                                                                          | ✅  |
| ------- | -------------------------------------------------- | ------ | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | --- |
| **R16** | 单用户删除 — 确认                                  | 桌面   | 账号管理 → 某用户行"删除"                                                 | 弹出 Modal「确认删除用户」（含姓名）→ 确认 → 成功                                             | ☐   |
| **R17** | 🆕 单用户删除 + 批量权限覆盖 — 取消 + Network 证据 | 桌面   | ① 触发单用户删除 → 弹窗后点"取消" ② 触发批量权限覆盖保存 → 弹窗后点"取消" | 两次取消后 **Network 面板均无 POST/PUT/DELETE 请求**；列表/权限配置数据无变化                 | ☐   |
| **R18** | 生成临时密码 — 确认+取消                           | 移动端 | ActionSheet → "生成临时密码"                                              | 弹出 Modal「确认生成临时密码」→ 确认 → 显示密码弹窗；**取消 → Network 无请求**                | ☐   |
| **R19** | 批量权限覆盖 — 确认                                | 桌面   | 权限管理 Tab → 选 N 个用户 → 配置权限 → "保存"                            | 弹出 Modal「确认批量更新权限」→ 内容含"N 个用户" → 确认 → 成功消息                            | ☐   |
| **R20** | 🆕 弹窗内容准确性 — 用户名/数量                    | 桌面   | 分别触发 R16（单删）和 R19（批量权限），**目视弹窗 content**              | ① 单删：用户姓名 + 用户名**不为空、不为 undefined** ② 批量权限："{N} 个用户"中 N 为**正整数** | ☐   |
| **R21** | 两份实现一致性                                     | 桌面   | 对比 useAccountActions / AccountPermissionPage 两个入口的行为             | 三个函数的确认弹窗标题、内容、按钮文案一致                                                    | ☐   |

---

## 3. 各 PR 验收标准 Given/When/Then 简表

### PR-1: assign / move / swap

| AC  | Given                                                              | When              | Then                                                                                                                      |
| --- | ------------------------------------------------------------------ | ----------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 1.1 | ResidencyAdjustModal `mode="assign"`，已选目标 楼栋/楼层/房间/床位 | 点击"确认办理"    | Modal.confirm 弹出，title="确认入住分配"，内容含学生姓名 + 目标床位 → 确认后 `assignOccupancy` 被调用 → `message.success` |
| 1.2 | `mode="move"`，目标床位为空                                        | 点击"确认办理"    | Modal.confirm title="确认调宿"，内容含"原床位将释放" → 确认后 `moveBed` 被调用                                            |
| 1.3 | `mode="move"`，目标床位有人（`isSwapping=true`）                   | 点击"确认办理"    | Modal.confirm title="确认床位互换"，`okType="danger"` → 确认后 `swapBedOccupancy` 被调用                                  |
| 1.4 | 表单未填完（如未选床位）                                           | 点击"确认办理"    | 表单校验失败（Ant Form 红框），**不弹出 Modal.confirm**                                                                   |
| 1.5 | 任一分支弹出 Modal.confirm 后                                      | 点击"取消"        | Modal 关闭，ResidencyAdjustModal 保持打开，**Network 无 POST/PUT 请求**，数据库无写入                                     |
| 1.6 | 🆕 任一分支弹出 Modal.confirm 后                                   | 目视 content 内容 | 学生姓名/学号、目标房间/床位均为**非空有效值**，无 `undefined`、`null`、`NaN`、`[object Object]`                          |

### PR-2: 单个楼栋删除

| AC  | Given                                | When                                             | Then                                                                                                                                                |
| --- | ------------------------------------ | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2.1 | 楼栋列表中存在记录                   | 点击行内"删除"按钮                               | 弹出 Modal.confirm（**非 Popconfirm**），title="确认删除楼栋"，内容含楼栋名称，`okType="danger"`                                                    |
| 2.2 | Modal.confirm 弹出后                 | 点击"删除"                                       | `deleteBuilding(id)` 被调用 → 成功后 `message.success` + 列表刷新                                                                                   |
| 2.3 | Modal.confirm 弹出后                 | 点击"取消"                                       | **Network 无 DELETE 请求**，列表无变化                                                                                                              |
| 2.4 | 楼栋有关联宿舍                       | 确认删除                                         | 后端返回错误 → `message.error` 正常显示错误文案                                                                                                     |
| 2.5 | 合并后                               | 全局搜索 `BuildingColumns.jsx` 中的 `Popconfirm` | import 和 JSX 中均无 `Popconfirm` 残留                                                                                                              |
| 2.6 | 🆕 **硬门槛** — Modal.confirm 弹出后 | 目视 content 内容                                | 楼栋名称显示为**实际名称**（如"1号楼"），**严禁出现 `undefined`、空字符串、`[object Object]`。若出现，判定为签名变更未同步的 P0 缺陷，PR 不得合并** |

### PR-3: batchCheckIn

| AC  | Given                                                                                                       | When                  | Then                                                                                                             |
| --- | ----------------------------------------------------------------------------------------------------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------- |
| 3.1 | 选中 N 名未入住学生，全部分配完成                                                                           | 点击"提交入住"        | Modal.confirm 弹出，title="确认批量入住"，内容="即将为 N 名学生办理入住手续" → 确认后调用 `batchCheckIn`         |
| 3.2 | 选中 M 名学生，仅为 K 人分配（K < M）                                                                       | 点击"提交入住"        | Modal.confirm 弹出，内容含"选中了 M 名…仅为 K 人分配" → 确认后仅提交 K 条                                        |
| 3.3 | 选中学生但 0 人分配                                                                                         | 点击"提交入住"        | 出现 `message.warning`（关键词含"分配"或"床位"），**不弹 Modal.confirm**                                         |
| 3.4 | 合并后对比 `useOccupancyActions.jsx:handleBatchCheckIn` 与 `OccupancyManagementPage.jsx:handleBatchCheckIn` | —                     | 两份函数的确认逻辑结构（title / content 构造 / onOk 回调体）一致                                                 |
| 3.5 | 🆕 全部分配 or 部分分配场景弹出 Modal.confirm 后                                                            | 目视 content 中的数字 | 学生人数为**正整数**（非 0、非 NaN、非 undefined）；部分分配场景"选中数"与"已分配数"数值正确且 选中数 > 已分配数 |

### PR-4: Account 模块三项

| AC  | Given                                                                        | When                                             | Then                                                                                                                    |
| --- | ---------------------------------------------------------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| 4.1 | 用户列表中对某用户触发行内删除                                               | `handleDeleteSingleUser` 执行                    | Modal.confirm 弹出，title="确认删除用户"，内容含 `fullName + username`，`okType="danger"` → 确认后 `deleteUsers` 被调用 |
| 4.2 | 用户列表中对某用户触发"生成临时密码"                                         | `handleGenerateTempPassword` 执行                | Modal.confirm 弹出 → 确认 → `generateTemporaryPassword` 被调用 → 随后弹出密码显示弹窗                                   |
| 4.3 | 权限管理 Tab，选中 N 个用户 + 配置覆盖权限                                   | 点击"保存"                                       | Modal.confirm 弹出，content 含"{N} 个用户" → 确认 → `batchUpdateUserOverrides` 被调用                                   |
| 4.4 | 合并后对比 `useAccountActions.jsx` 与 `AccountPermissionPage.jsx` 中三个函数 | —                                                | 两份实现的确认逻辑结构一致（3 函数 × 2 处 = 6 处均已同步）                                                              |
| 4.5 | 已有确认的操作（批量删除 / 重置密码 / 切换状态）                             | 正常操作                                         | 行为不受影响，不出现双重确认或确认丢失                                                                                  |
| 4.6 | 🆕 单用户删除 — Modal.confirm 弹出后                                         | 点击"取消"                                       | Modal 关闭，**Network 无 DELETE/POST 请求**，用户列表无变化                                                             |
| 4.7 | 🆕 批量权限覆盖 — Modal.confirm 弹出后                                       | 点击"取消"                                       | Modal 关闭，**Network 无 POST/PUT 请求**，权限配置无变化                                                                |
| 4.8 | 🆕 弹窗内容准确性                                                            | 目视 R16（单删）和 R19（批量权限）的弹窗 content | ① 单删：`fullName` 和 `username` 为**非空有效文本**，无 undefined ② 批量权限："{N} 个用户"中 N 为正整数                 |

---

## 4. 自动化命令清单

以下命令在**每个 PR 合并后**和**全部合并后**各执行一次。

```powershell
# 0. 设置 UTF-8 编码
chcp 65001

# 1. Lint 检查（不允许有新增 error）
cd d:\my_project_bychatgpt\frontend
npm run lint -- --no-warn-ignored

# 2. 生产构建（不允许 build 失败）
npm run build

# 3. Popconfirm 残留检查（PR-2 专用）
# 预期：BuildingColumns.jsx 中 0 个匹配
npx grep-cli "Popconfirm" src/pages/building/BuildingColumns.jsx 2>$null; if ($LASTEXITCODE -ne 0) { Write-Host "PASS: 无 Popconfirm 残留" } else { Write-Host "FAIL: 仍有 Popconfirm" }

# 4. 确认拦截覆盖率快检（全量合并后）
# 以下 9 个操作入口，每个都应在其函数体中包含 Modal.confirm
# assignOccupancy  → ResidencyAdjustModal.jsx
# moveBed          → ResidencyAdjustModal.jsx
# swapBedOccupancy → ResidencyAdjustModal.jsx
# deleteBuilding   → useBuildingActions.jsx
# batchCheckIn     → useOccupancyActions.jsx + OccupancyManagementPage.jsx
# deleteUsers(单)  → useAccountActions.jsx + AccountPermissionPage.jsx
# generateTemporaryPassword → useAccountActions.jsx + AccountPermissionPage.jsx
# batchUpdateUserOverrides  → useAccountActions.jsx + AccountPermissionPage.jsx
```

**通过标准**:

- ✅ `npm run lint` 零 error（warning 预算不增加）
- ✅ `npm run build` 成功（exit code 0）
- ✅ BuildingColumns 中无 Popconfirm 残留

---

## 5. 合并顺序建议 + 冲突预案

### 5.1 推荐合并顺序

```
PR-1 (ResidencyAdjustModal)    ─┐
PR-2 (BuildingColumns + useBuildingActions) ─┼── 任意顺序
PR-3 (useOccupancyActions + OccupancyMgmtPage) ─┤
PR-4 (useAccountActions + AccountPermissionPage) ─┘
```

> **四个 PR 文件集完全互斥，无合并冲突**，可以任意顺序合并。推荐按模块风险从低到高：PR-1 → PR-2 → PR-3 → PR-4。

### 5.2 冲突预案

#### 场景 A: 平行副本不同步（PR-3 / PR-4）

| 风险                                                                     | 描述                                     | 预防措施                                  | 发现方式                             | 修复手段           |
| ------------------------------------------------------------------------ | ---------------------------------------- | ----------------------------------------- | ------------------------------------ | ------------------ |
| PR-3 只改了 `useOccupancyActions.jsx` 漏改 `OccupancyManagementPage.jsx` | 一份有确认、一份静默执行                 | 开发时同步复制；PR 描述中明确列出两个文件 | R14 手工步骤 + Code Review diff 对比 | 补提交修改遗漏文件 |
| PR-4 六处改动有遗漏                                                      | 某个函数在一份文件中加了确认，另一份未加 | 开发时按 3 函数 × 2 文件逐个检查          | AC-4.4 对比检查                      | 补提交             |

#### 场景 B: PR-2 函数签名变更扩散（⚠️ 已升级为硬门槛）

| 风险                                                         | 描述                                                                      | 预防措施                                                            | 发现方式                                                      | 修复手段                                                                                   |
| ------------------------------------------------------------ | ------------------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `handleDelete(id)` → `handleDelete(record)` 导致调用方未同步 | BuildingManagementPage 或其他调用方仍传 `id` → `record.name` 为 undefined | 全局搜索 `handleDelete` / `onDelete` 在 building 模块中的所有调用点 | **R10 硬门槛**：弹窗内容中楼栋名称若为 undefined，PR 不得合并 | 同步所有调用方传 `record`；弹窗 content 中加 fallback `record.name \|\| "该楼栋"` 作为保底 |

> **门槛规则**: R10（原 AC-2.6）为**阻断性验收项**——若楼栋名称在弹窗中显示为 `undefined` / 空 / `[object Object]`，**PR-2 必须打回**，不得以"后续修复"方式通过。

#### 场景 C: PR-4 中 `handleBatchSaveOverrides` 返回值语义变化

| 风险                                                                                                            | 描述                                             | 预防措施                                                                                                         | 发现方式                                               | 修复手段                                                                                                                                     |
| --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 模块化版本原来 `return true/false`，包裹 Modal.confirm 后变为 `return undefined`（因为 Modal.confirm 是异步的） | 如果调用方依赖返回值判断成功与否，会出现逻辑错误 | 开发前搜索 `handleBatchSaveOverrides` 的所有调用方，确认是否有 `if (await handleBatchSaveOverrides(...))` 的判断 | 搜索调用方代码；R19 手工验证批量保存后 UI 状态正确清空 | 改用 `await new Promise(resolve => Modal.confirm({onOk: async () => { ... resolve(true) }, onCancel: () => resolve(false)}))` 模式保留返回值 |

#### 场景 D: 其他分支在合并期间修改了相同文件

| 风险                                                                                | 描述                        | 预防措施                            | 发现方式                | 修复手段                                                    |
| ----------------------------------------------------------------------------------- | --------------------------- | ----------------------------------- | ----------------------- | ----------------------------------------------------------- |
| `OccupancyManagementPage.jsx` 或 `AccountPermissionPage.jsx` 被其他功能分支并行修改 | 行号漂移导致手动 merge 所需 | 合并前 `git pull --rebase` 对齐主干 | Git merge conflict 提示 | 按函数名定位（而非行号），手动解决冲突后重新跑 lint + build |

### 5.3 合并后快速验证脚本

每个 PR 合并后立即执行：

```powershell
chcp 65001
cd d:\my_project_bychatgpt\frontend

# 1. 确保无编译破损
npm run build
if ($LASTEXITCODE -ne 0) { Write-Host "❌ BUILD FAILED — 立即 git revert"; exit 1 }

# 2. 确保无 lint 新增 error
npm run lint -- --no-warn-ignored
if ($LASTEXITCODE -ne 0) { Write-Host "❌ LINT FAILED — 检查新增 error"; exit 1 }

Write-Host "✅ 构建 + Lint 通过，开始手工回归"
```

### 5.4 回滚策略

| PR   | 回滚命令                      | 影响范围                                                                                 | 恢复后状态                          |
| ---- | ----------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------- |
| PR-1 | `git revert <PR-1-merge-sha>` | `ResidencyAdjustModal.jsx` 恢复直接执行                                                  | assign/move/swap 无确认（回到原状） |
| PR-2 | `git revert <PR-2-merge-sha>` | `BuildingColumns.jsx` 恢复 Popconfirm + `useBuildingActions.jsx` 恢复 `handleDelete(id)` | 楼栋删除回到 Popconfirm             |
| PR-3 | `git revert <PR-3-merge-sha>` | 两个文件各恢复一个函数                                                                   | batchCheckIn 恢复条件性确认         |
| PR-4 | `git revert <PR-4-merge-sha>` | 两个文件各恢复三个函数（6 处）                                                           | 三项操作恢复静默执行                |

> 四个 PR 文件互斥，任一 revert 不影响其他 PR 的变更。

---

_本文档仅用于验收与回归目的，不包含代码实现。_
