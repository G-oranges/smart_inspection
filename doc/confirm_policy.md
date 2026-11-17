确认弹窗策略规范（Confirm Policy）

文档状态：Active（Phase 2 已落地）
最后更新：2026-02-14
适用范围：全前端系统（桌面端 + 移动端）
目标：统一所有“确认行为”的触发规则、风险分级与使用边界，防止高风险操作被绕过

1. 文档目的（Why）

本系统涉及大量数据库写操作（POST / PUT / DELETE），包括删除、修改、分配、批量处理等高风险行为。
当前确认弹窗存在 入口分散、规则不统一、风险级别判断不一致 等问题。

本策略用于：

明确 哪些操作必须确认

明确 用哪一类确认方式

明确 哪些用法是禁止的

作为 代码审查 / 重构 / 新功能开发 的统一依据

2. 核心原则（Principles）
   P1. 所有数据库写操作必须被用户明确确认

明确确认指：用户在执行前，清楚知道“将发生什么后果”，并主动点击确认。

不允许静默执行

不允许仅依赖 Toast / Message 提示

不允许只在失败时提示

P2. 风险等级决定确认形态，而不是页面位置

确认方式 不由 UI 形态决定（表格 / 页面 / 抽屉），只由以下因素决定：

是否不可逆

是否影响他人数据

是否批量

是否影响系统整体状态

P3. 高风险操作优先保证“不可绕过”

样式、交互体验可以后续优化，但 确认本身不能缺失。

3. 操作风险分级定义（Risk Levels）
   L1｜无风险 / 前端态操作（无需确认）

定义

不写数据库

不改变持久化状态

可随时撤销或刷新恢复

示例

Tab 切换

展开 / 折叠

本地筛选条件变更

页面跳转

规则

❌ 禁止弹出确认

❌ 禁止干扰流程

L2｜中风险操作（Inline Confirm）

定义

写数据库

单条数据

可逆 / 影响范围有限

用户上下文非常清楚当前对象是谁

典型示例

表格行内单条删除

单个对象状态切换（启用 / 禁用）

单条退宿、解绑

允许的确认方式

Inline Confirm（如 Popconfirm）

文案简洁但需明确对象

限制

❌ 不允许用于批量操作

❌ 不允许用于结构性破坏操作（如删除楼栋）

L3｜高风险操作（Global Confirm）

定义（满足任一即为 L3）

不可逆操作

批量操作

影响他人数据 / 系统结构

涉及分配 / 迁移 / 覆盖

影响登录态 / 权限 / 系统配置

典型示例

批量删除

删除楼栋 / 宿舍

床位分配（assignBed）

床位移动（moveBed）

批量入住 / 退宿

退出登录、清空会话

系统设置保存

强制规则

✅ 必须使用 Global Confirm

❌ 禁止使用 Inline Confirm

❌ 禁止无确认直接执行

4. 确认形态使用规范
   4.1 Inline Confirm（行内确认）

用途

L2 操作专用

必须满足

明确对象（名称 / 标识）

明确动作（删除 / 禁用 / 解绑）

明确后果（简要）

禁止

用于批量

用于结构性删除

用于数据迁移 / 分配类操作

4.2 Global Confirm（全局确认弹窗）

用途

所有 L3 操作

必须包含

明确标题（确认 + 动作）

明确影响描述（完整句）

明确主次按钮（取消 ≠ 不可见）

危险操作必须使用 danger 语义

行为约束

不允许自动执行

不允许默认聚焦确认按钮

不允许 maskClosable 绕过（对 L3）

4.3 移动端确认（Action Sheet + 二次确认）

原则

移动端可以改变“呈现方式”

但 不能降低风险等级

规则

L3 操作：

第一步：IOSActionSheet 选择危险动作

第二步：Global Confirm 二次确认

4.4 两阶段确认（5 秒倒计时强确认）— Phase 2

本章节定义「危险操作两阶段确认」机制，于 2026-02-14 落地实施。

4.4.1 适用范围

仅适用于 删除类危险操作，包括：

✅ 单条用户删除（行内操作）
✅ 批量用户删除（工具栏 / ActionSheet 入口）

不适用于：

❌ 密码初始化 / 重置密码（仅需单层 Global Confirm）
❌ 状态切换（启用 / 禁用）
❌ 权限变更（批量授权等）
❌ 非删除类写操作（分配 / 迁移 / 入住等）

后续如需扩展到其他危险操作（如楼栋删除），需经策略评审后更新本章节。

4.4.2 核心函数：strongDangerConfirm

位置：AccountPermissionPage.jsx 组件外部（纯函数）
签名：async function strongDangerConfirm({ title, content, okText }) → Promise<boolean>
返回值：true = 用户是否确认；false = 用户取消或关闭

行为规则：

1. 使用 Modal.confirm 创建弹窗实例
2. 初始状态：okButtonProps.disabled = true，okText = `${okText} (5)`
3. 每秒通过 modal.update() 刷新 okText 显示剩余秒数
4. 5 秒倒计时结束后：okButtonProps.disabled = false，okText 恢复原文
5. 必须设置 maskClosable: false、keyboard: false，防止误关绕过
6. onOk / onCancel / 倒计时结束 三处均必须清理 setInterval timer

4.4.3 链路形态

A. 单条删除

    桌面端：
      行内「删除」按钮
       └─ 第一层：Popconfirm（小弹窗，展示目标用户信息）
            └─ onConfirm → handleDeleteSingleUser(user)
                 └─ 第二层：strongDangerConfirm（5 秒倒计时 Modal）
                      └─ confirmed → deleteUsers API

    移动端：
      卡片操作菜单 → 同桌面端链路（Popconfirm → strongDangerConfirm）

B. 批量删除

    桌面端：
      工具栏「删除」按钮（直接 onClick，无 Popconfirm 包裹）
       └─ handleBulkDelete()
            └─ 第一层：Modal.confirm（大弹窗，Promise 包装 await）
                 └─ confirmed → 第一层关闭后
                      └─ 第二层：strongDangerConfirm（5 秒倒计时 Modal）
                           └─ confirmed → deleteUsers API

    移动端：
      IOSActionSheet「彻底删除账号」→ onBulkDelete → handleBulkDelete()
      （ActionSheet 内不含任何 Modal.confirm，两阶段逻辑集中在 handleBulkDelete 内部）

C. 密码初始化（对照）

    桌面端 / 移动端：
      入口按钮 → 直接 onClick / onResetPassword → handleResetPassword()
       └─ 仅一层 Modal.confirm → 执行 resetUserPassword API
      不使用两阶段确认，不使用 Popconfirm 包裹。

4.4.4 禁止项（两阶段专属）

❌ 禁止两个 Modal 同时叠加显示
→ 第一层必须使用 await new Promise(...) 等待关闭后再弹第二层

❌ 禁止无倒计时的双重确认
→ 如果操作需要两次确认，第二层必须使用 strongDangerConfirm（含 5 秒倒计时）
→ 纯 Popconfirm + Modal.confirm 的无倒计时双重确认是禁止的

❌ 禁止在 ActionSheet / 操作菜单组件内部嵌入 Modal.confirm
→ 确认逻辑必须集中在 handler 函数内部，不得分散到 UI 组件中

❌ 禁止使用 setTimeout 代替 disabled 按钮
→ 必须通过 okButtonProps.disabled 控制，不得粗暴延迟

❌ 禁止在倒计时未完成时允许点击确认按钮
→ 5 秒倒计时期间 OK 按钮必须始终 disabled

4.4.5 验收门禁要点

以下为 Code Review 和 QA 验收必检项：

☑ 倒计时 disabled/enabled - strongDangerConfirm 弹出后，OK 按钮初始为 disabled 状态 - okText 每秒更新显示剩余秒数（如「确认删除 (4)」）- 5 秒倒计时结束后按钮变为 enabled，okText 恢复原文

☑ 取消无写请求 - 第一层取消：不弹出第二层，不发出任何 API 请求 - 第二层取消：不发出 DELETE 请求 - 关闭弹窗（点击遮罩、按 ESC）：被 maskClosable:false + keyboard:false 阻止

☑ 单删：小弹窗（Popconfirm）+ 二次强确认（strongDangerConfirm）- 行内删除按钮必须由 Popconfirm 包裹（第一层）- Popconfirm onConfirm 触发 handleDeleteSingleUser - handleDeleteSingleUser 内部仅调用 strongDangerConfirm（无额外 Modal.confirm）

☑ 批量删：大弹窗（Modal.confirm）+ 二次强确认（strongDangerConfirm）- 工具栏按钮直接 onClick 进入 handleBulkDelete（无 Popconfirm 包裹）- handleBulkDelete 内部 await 第一层 Modal.confirm - 第一层确认后 await 第二层 strongDangerConfirm - 仅二次确认通过后触发 deleteUsers API

☑ 串行不叠加 - Network 面板验证：取消任何阶段均无 DELETE 请求 - DOM 验证：任何时刻最多只有一个 Modal 可见

5. 明确禁止的行为（Hard Rules）

以下行为在本系统中 明确禁止：

❌ 数据库写操作无任何确认

❌ 使用 Popconfirm 执行批量 / 高风险操作

❌ 不同页面自行定义确认语义与规则

❌ 新增自定义确认样式而不经过评审

❌ 以“已经有 Undo”为理由跳过确认（除非策略更新）

❌ 在同一操作链路中出现 Popconfirm + Modal.confirm 无倒计时双重确认（Phase 2 新增）

❌ 两个确认 Modal 同时叠加显示（Phase 2 新增）

❌ 在 ActionSheet / 操作菜单组件内部直接调用 Modal.confirm（Phase 2 新增）

6. 现存已识别的策略缺口（来自审计）

以下操作 当前已被判定为违反本策略，必须优先修复：

assignBed：L3 操作，无确认

moveBed：L3 操作，无确认

单个楼栋删除：L3 操作，错误使用 Inline Confirm

batchCheckIn：L3 操作，确认条件不完整

详见：doc/confirm_dialog_audit.md

7. 执行与审查（Enforcement）
   Code Review 必查项

是否为 DB 写操作？

是否匹配正确风险等级？

是否使用了允许的确认形态？

（Phase 2 新增）删除类操作是否实现两阶段确认？

（Phase 2 新增）两阶段是否串行（第一层关闭后再弹第二层）？

（Phase 2 新增）strongDangerConfirm 是否 5 秒倒计时 + disabled 按钮？

（Phase 2 新增）取消任一阶段是否无 API 请求发出？

新功能开发要求

新增写操作必须先标注风险等级

未标注风险等级的 PR 不得合并

新增删除类操作必须实现两阶段确认（Phase 2 新增）

8. 文档状态说明

本文档为 系统级确认策略

UI / 交互 / 样式实现应以本策略为前提

后续如引入 Undo / 审计日志 / 二次验证，需更新本策略

9. 变更记录

| 日期       | 变更                                            | 影响章节  |
| ---------- | ----------------------------------------------- | --------- |
| 2026-02-14 | Phase 2: 新增两阶段确认（5 秒倒计时强确认）机制 | 4.4, 5, 7 |
| 2026-02-07 | 初始版本: 确认弹窗策略规范 + 全量审计           | 全文      |
