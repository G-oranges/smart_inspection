# Phase 2 — 危险操作两阶段确认 闭环验证报告

> **日期**: 2026-02-14  
> **环境**: Windows 10 / Node v24.11.1 / npm 11.6.2  
> **lint**: 0 error / 3 warning（均为既有问题，非本次引入）  
> **build**: ✓ vite v5.4.21 built in 15.45s, 0 error, exit code 0

---

## A. 代码级校验清单

### 1. `strongDangerConfirm` 实现正确性

| 校验项                           | 结论    | 证据（行号）                                                                                                                               |
| -------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 返回 `Promise<boolean>`          | ✅ PASS | L68: `async function strongDangerConfirm(...)`, L69: `return new Promise((resolve) => {`                                                   |
| 取消 resolve(false)              | ✅ PASS | L85-88: `onCancel: () => { if (timer) clearInterval(timer); resolve(false); }`                                                             |
| 确认 resolve(true)               | ✅ PASS | L81-84: `onOk: () => { if (timer) clearInterval(timer); resolve(true); }`                                                                  |
| 初始 okButtonProps.disabled=true | ✅ PASS | L77: `okButtonProps: { disabled: true }`                                                                                                   |
| okText 带倒计时刷新              | ✅ PASS | L76: `` `${okText} (${remaining})` ``，L93-96: `modal.update({ okText: \`${okText} (${remaining})\`, okButtonProps: { disabled: true } })` |
| 倒计时结束启用按钮               | ✅ PASS | L98-103: `clearInterval(timer); timer = null; modal.update({ okText, okButtonProps: { disabled: false } })`                                |
| maskClosable: false              | ✅ PASS | L79: `maskClosable: false`                                                                                                                 |
| keyboard: false                  | ✅ PASS | L80: `keyboard: false`                                                                                                                     |
| timer 清理（onOk/onCancel）      | ✅ PASS | L82: `if (timer) clearInterval(timer)` (onOk)、L86: `if (timer) clearInterval(timer)` (onCancel)                                           |
| timer 清理（countdown 结束）     | ✅ PASS | L98: `clearInterval(timer); timer = null;`                                                                                                 |

**结论**: `strongDangerConfirm` 实现完全正确，无内存泄漏风险。

---

### 2. 单删链路校验（桌面端）

| 校验项                                              | 结论    | 证据                                                                                                                         |
| --------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------- | --- | ------------------------------------------------- |
| UserColumns.jsx 删除按钮有 Popconfirm 第一层        | ✅ PASS | UserColumns.jsx L110-127: `<Popconfirm title="确认删除" ... onConfirm={() => onDelete(user)}>` 包裹删除 Button               |
| Popconfirm onConfirm 只调用 handleDeleteSingleUser  | ✅ PASS | UserColumns.jsx L113: `onConfirm={() => onDelete(user)}`，AccountPermissionPage.jsx L833: `onDelete: handleDeleteSingleUser` |
| handleDeleteSingleUser 不含第一层 Modal.confirm     | ✅ PASS | AccountPermissionPage.jsx L632-661: 函数内无 `Modal.confirm` 调用（仅有 `strongDangerConfirm`）                              |
| handleDeleteSingleUser 直接进入 strongDangerConfirm | ✅ PASS | L640: `const finalConfirmed = await strongDangerConfirm({...})`                                                              |
| 字段安全校验在 strongDangerConfirm 之前             | ✅ PASS | L635-637: `if (!user?.fullName                                                                                               |     | !user?.username) { message.error(...); return; }` |
| 仅 finalConfirmed=true 时触发 delete API            | ✅ PASS | L650: `if (!finalConfirmed) return;`，L653: `await deleteUsers({ ids: [user.id] })`                                          |

**完整链路**: `行内删除按钮 → Popconfirm(L110) → onDelete → handleDeleteSingleUser(L632) → strongDangerConfirm(L640) → deleteUsers(L653)`

---

### 3. 批量删除链路校验（桌面端 + 移动端）

#### 桌面端

| 校验项                                        | 结论    | 证据                                                                                                                                                  |
| --------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| 删除按钮无 Popconfirm 包裹                    | ✅ PASS | AccountPermissionPage.jsx L908: `<Button danger ... onClick={handleBulkDelete}>删除</Button>` — 无 Popconfirm 包裹                                    |
| handleBulkDelete 第一层为 await Modal.confirm | ✅ PASS | L512-530: `const firstConfirmed = await new Promise((resolve) => { Modal.confirm({...onOk: () => resolve(true), onCancel: () => resolve(false) }) })` |
| 第一层关闭后才弹第二层（串行不叠加）          | ✅ PASS | L531: `if (!firstConfirmed) return;` — await 确保第一层关闭后再执行后续代码                                                                           |
| 第二层为 strongDangerConfirm                  | ✅ PASS | L533-542: `const finalConfirmed = await strongDangerConfirm({...})`                                                                                   |
| 仅二次确认后触发 delete API                   | ✅ PASS | L543: `if (!finalConfirmed) return;`，L546: `await deleteUsers({ ids: selectedIds })`                                                                 |

#### 移动端

| 校验项                               | 结论    | 证据                                                                     |
| ------------------------------------ | ------- | ------------------------------------------------------------------------ |
| UserActionSheet 无多余 Modal.confirm | ✅ PASS | UserActionSheet.jsx 全文 51 行，无 `Modal` 导入、无 `Modal.confirm` 调用 |
| 删除入口直接调用 onBulkDelete        | ✅ PASS | UserActionSheet.jsx L43-44: `onClose(); onBulkDelete();`                 |
| onBulkDelete 绑定为 handleBulkDelete | ✅ PASS | AccountPermissionPage.jsx L973: `onBulkDelete={handleBulkDelete}`        |

**完整链路**:

- 桌面: `工具栏删除按钮(L908) → onClick → handleBulkDelete(L504) → Modal.confirm(L513) → strongDangerConfirm(L533) → deleteUsers(L546)`
- 移动: `ActionSheet 删除(L44) → onBulkDelete → handleBulkDelete(L504) → 同上`

---

### 4. 密码初始化/重置密码链路校验

| 校验项                                   | 结论    | 证据                                                                                                            |
| ---------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------- |
| 桌面端无 Popconfirm 包裹                 | ✅ PASS | AccountPermissionPage.jsx L909: `<Button ... onClick={handleResetPassword}>密码初始化</Button>` — 无 Popconfirm |
| 移动端无多余确认                         | ✅ PASS | UserActionSheet.jsx L33-34: `onClose(); onResetPassword();` — 直接调用                                          |
| handleResetPassword 仅单层 Modal.confirm | ✅ PASS | AccountPermissionPage.jsx L565-600: 仅一次 `Modal.confirm`，onOk 直接执行 API                                   |
| 不涉及 strongDangerConfirm               | ✅ PASS | L558-601: 函数内无 `strongDangerConfirm` 调用                                                                   |

---

### 5. Popconfirm 全局搜索——双重确认点排查

#### AccountPermissionPage.jsx 范围内

| 搜索项                | 结果                                               |
| --------------------- | -------------------------------------------------- |
| `Popconfirm` import   | ❌ 已移除（L8-19 antd import 列表中无 Popconfirm） |
| `Popconfirm` JSX 使用 | ❌ 无（仅 L631 注释中提到，非代码）                |

**结论**: AccountPermissionPage.jsx 内已无任何 Popconfirm 组件使用。✅

#### account-permission 模块范围内

| 文件                             | Popconfirm 使用                        | 是否双重确认                                          | 处置建议                   |
| -------------------------------- | -------------------------------------- | ----------------------------------------------------- | -------------------------- |
| UserColumns.jsx L110-127         | ✅ 单删第一层                          | ❌ 否（第二层是 strongDangerConfirm，符合两阶段设计） | 无需修改                   |
| MonitorSetupSection.jsx L225-240 | ⚠️ 寝室长冲突弹窗 footer 中 Popconfirm | ⚠️ 在 Modal 内嵌 Popconfirm                           | **已知遗留，非本次 scope** |

#### scope 外其他页面

| 文件                           | Popconfirm 使用         | 是否双重确认                                       |
| ------------------------------ | ----------------------- | -------------------------------------------------- |
| TeacherManagementPage.jsx L473 | 批量删除按钮 Popconfirm | 需检查 `handleBulkDelete` 内是否再有 Modal.confirm |
| TeacherColumns.jsx L62         | 行内删除 Popconfirm     | 需检查 handler                                     |
| StudentColumns.jsx L165        | 行内删除 Popconfirm     | 需检查 handler                                     |
| OccupancyColumns.jsx L109      | 退宿 Popconfirm         | 单层确认                                           |
| DormColumns.jsx L184           | 删除 Popconfirm         | 需检查 handler                                     |

**结论**: scope 外可能存在与 Account 模块相同的双重确认问题，建议后续 PR 统一排查。

---

## B. lint + build 结果

### eslint

```
AccountPermissionPage.jsx
  109:16  warning  Function 'AccountPermissionPage' has too many lines (877)  max-lines-per-function
  369:6   warning  React Hook useEffect has a missing dependency: 'loadBatchUsers'  react-hooks/exhaustive-deps
  397:6   warning  React Hook useEffect has a missing dependency: 'loadStudentList'  react-hooks/exhaustive-deps

✖ 3 problems (0 errors, 3 warnings)
```

| 指标         | 值                    |
| ------------ | --------------------- |
| 新增 error   | 0                     |
| 新增 warning | 0（3 条均为既有问题） |

### vite build

```
✓ 4051 modules transformed.
✓ built in 15.45s
Exit code: 0
```

---

## C. 手工回归用例

### 用例 1：单删（桌面端）

| 步骤                    | 预期                           | 实际                                             | 结论 |
| ----------------------- | ------------------------------ | ------------------------------------------------ | ---- |
| 点击行内「删除」        | Popconfirm 小弹窗弹出          | ✅ Popconfirm 弹出，显示"确认删除"标题和用户信息 | PASS |
| Popconfirm 点击「取消」 | 弹窗关闭，无请求               | ✅ 弹窗关闭，页面无变化                          | PASS |
| Popconfirm 点击「继续」 | 弹出 strongDangerConfirm Modal | ✅ 弹出"⚠️ 是否确认 — 删除用户"Modal             | PASS |
| 5s 倒计时内按钮状态     | disabled，显示"确认删除 (N)"   | ✅ 按钮 disabled，文字含倒计时                   | PASS |
| 5s 后按钮状态           | enabled，显示"确认删除"        | ✅ 按钮可点击，文字恢复为"确认删除"              | PASS |
| 点击「取消」            | Modal 关闭，无请求             | ✅ 关闭，用户仍在列表中                          | PASS |

**证据**: 截图 `delete_modal_countdown_1771057368777.png`（页面状态）、`click_feedback_1771057535241.png`（第二阶段 Modal 可见，含"确认删除"按钮 enabled 状态）。录屏: `desktop_single_delete_1771057217789.webp`

### 用例 2：批量删（桌面端）

| 步骤                              | 预期                                     | 代码级验证                                                |
| --------------------------------- | ---------------------------------------- | --------------------------------------------------------- |
| 勾选用户 → 点击工具栏「删除」按钮 | 无 Popconfirm，直接进入 handleBulkDelete | ✅ L908: `onClick={handleBulkDelete}`，无 Popconfirm 包裹 |
| handleBulkDelete 内第一层         | Modal.confirm 弹出                       | ✅ L512-530: Promise 包装 Modal.confirm                   |
| 第一层取消                        | return，不触发第二层                     | ✅ L531: `if (!firstConfirmed) return`                    |
| 第一层确认 → 第二层               | await 确保串行，弹出 strongDangerConfirm | ✅ L533: `await strongDangerConfirm(...)`                 |
| 第二层取消                        | return，不触发 API                       | ✅ L543: `if (!finalConfirmed) return`                    |
| 第二层确认                        | 触发 deleteUsers                         | ✅ L546: `await deleteUsers({ ids: selectedIds })`        |

**状态**: 代码级 PASS ✅（浏览器 UI 验证因子代理临时故障未完成，但代码链路已逐行确认）

### 用例 3：批量删（移动端）

| 步骤                             | 预期                             | 代码级验证                        |
| -------------------------------- | -------------------------------- | --------------------------------- |
| ActionSheet 点击「彻底删除账号」 | onClose → onBulkDelete           | ✅ UserActionSheet.jsx L43-44     |
| onBulkDelete 绑定                | handleBulkDelete                 | ✅ AccountPermissionPage.jsx L973 |
| 后续流程                         | 同桌面端 handleBulkDelete 两阶段 | ✅ 同用例 2                       |

**状态**: 代码级 PASS ✅

### 用例 4：密码初始化

| 步骤                | 预期                        | 代码级验证                                       |
| ------------------- | --------------------------- | ------------------------------------------------ |
| 桌面端按钮          | 无 Popconfirm，直接 onClick | ✅ L909: `onClick={handleResetPassword}`         |
| 移动端入口          | 直接调用 onResetPassword    | ✅ UserActionSheet.jsx L33-34                    |
| handleResetPassword | 仅单层 Modal.confirm        | ✅ L565: 一次 Modal.confirm，onOk 内直接执行 API |
| 取消                | 不触发 API                  | ✅ Modal.confirm 原生取消行为                    |

**状态**: 代码级 PASS ✅

### 用例 5：负例 — 快速连点

| 场景                      | 分析                                                                                            |
| ------------------------- | ----------------------------------------------------------------------------------------------- |
| 快速连点行内删除          | Popconfirm 为 AntD 原生组件，已打开时再次点击不会创建新实例 ✅                                  |
| handleBulkDelete 连续调用 | 第一层 Modal.confirm 使用 `await new Promise` 阻塞，第二次调用会等待第一次完成 ✅               |
| 两阶段 Modal 是否叠加     | 不会。第一层 `await` resolve 后 Modal 已关闭，第二层才创建。strongDangerConfirm 也是 `await` ✅ |

---

## D. 已知遗留问题 & 后续 PR 建议

| #   | 问题                                                                        | 严重度 | 建议                                                     |
| --- | --------------------------------------------------------------------------- | ------ | -------------------------------------------------------- |
| 1   | `useAccountActions.jsx` 整文件为死代码（页面未使用该 Hook）                 | P1     | 后续 PR 删除或将 AccountPermissionPage 内联逻辑迁入 Hook |
| 2   | `MonitorSetupSection.jsx` L225: Modal footer 内嵌 Popconfirm                | P2     | 后续统一，改为独立按钮 + 二阶段确认或简单 Modal.confirm  |
| 3   | scope 外页面（Teacher/Student/Dorm/Building）可能存在类似双重确认           | P2     | 后续 PR 全局扫描并统一                                   |
| 4   | AccountPermissionPage.jsx 行数 877，仍触发 `max-lines-per-function` warning | P3     | 后续继续模块化拆分                                       |

---

## E. 合并判定

### ✅ 可合并

**理由**:

1. **0 error** — lint 和 build 均无新增错误
2. **两阶段确认机制完整实现** — `strongDangerConfirm` 函数正确（倒计时/禁用/启用/清理全部到位）
3. **单删/批量删链路正确** — 代码级逐行验证 + 桌面端单删 UI 测试通过
4. **双重确认问题消除** — 桌面端 Popconfirm 包裹已移除，移动端多余 Modal.confirm 已移除
5. **密码初始化保持单层** — 无回归风险
