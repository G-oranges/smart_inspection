# 角色管理数据库收尾说明

## 目标

本轮把角色管理的数据库收口拆成两步：

1. 先通过脚本清洗历史脏数据
2. 再通过脚本补齐索引、唯一约束、外键和默认值

服务启动期仍保留 `AutoMigrate` 和 `EnsureRoleTypeCatalog`，但不再承担历史数据大规模修复职责。

## 脚本

### 1. `backend-go/scripts/role_management_precheck_normalize.go`

用途：

- 确保 `SYSTEM / BUSINESS / CUSTOM` 三个系统角色类型存在
- 清洗 `roletype`、`roleentity`、`roledatascope`、`rolepermission`、`_roleentitytouser`
- 修正 `user.role` 到有效角色编码
- 删除孤儿记录、重复记录，并尽可能归并引用

执行后目标是让数据库进入“可以安全加约束”的状态。

### 2. `backend-go/scripts/role_management_tighten_constraints.go`

用途：

- 补字段默认值和非空约束
- 补唯一索引
- 补外键
- 将角色管理相关表统一转换为 `InnoDB`

这一步假定前置清洗已经完成，不建议直接在脏库上运行。

## 执行顺序

1. 备份数据库
2. 运行 `role_management_precheck_normalize.go`
3. 检查脚本输出报告，确认没有异常清洗结果
4. 运行 `role_management_tighten_constraints.go`
5. 重启服务，查看启动日志中的 schema warning 是否消失
6. 回归验证角色 CRUD、角色类型 CRUD、角色数据范围、权限矩阵、用户分配角色

## 新增约束

### `roletype`

- `code` 唯一且非空（MySQL 5.7 环境保持 `varchar(191)`，避免 `utf8mb4` 下唯一索引超长）
- `status` 非空，默认 `ACTIVE`
- `isSystem` 非空，默认 `false`
- `sort` 非空，默认 `100`

### `roleentity`

- `code` 唯一且非空（MySQL 5.7 环境保持 `varchar(191)`，避免 `utf8mb4` 下唯一索引超长）
- `typeCode` 非空，默认 `SYSTEM`
- `status` 非空，默认 `ACTIVE`
- `isSystem` 非空，默认 `false`
- `sort` 非空，默认 `100`
- `typeCode -> roletype.code`
  - `ON UPDATE CASCADE`
  - `ON DELETE RESTRICT`

### `roledatascope`

- `roleId` 唯一且非空
- `scopeMode` 非空，默认 `ALL`
- `presetCode` 非空，默认 `ALL`
- `roleId -> roleentity.id`
  - `ON UPDATE CASCADE`
  - `ON DELETE CASCADE`

### `_roleentitytouser`

- `(A, B)` 唯一
- `A -> roleentity.id`
  - `ON UPDATE CASCADE`
  - `ON DELETE CASCADE`
- `B -> user.id`
  - `ON UPDATE CASCADE`
  - `ON DELETE CASCADE`

### `rolepermission`

- 保持 `(roleId, permissionId)` 唯一
- `roleId -> roleentity.id`
  - `ON UPDATE CASCADE`
  - `ON DELETE CASCADE`
- `permissionId -> permission.id`
  - `ON UPDATE CASCADE`
  - `ON DELETE CASCADE`

## 本轮明确未加的外键

`user.role` 本轮**不加**指向 `roleentity.code` 的数据库外键。

原因：

- 这是兼容主角色字段，历史包袱最重
- 当前系统仍依赖 `code` 语义
- 先通过迁移脚本和应用层校验保证正确性，避免一次性外键把历史库直接卡死

## 启动期职责

启动期仍保留：

- `AutoMigrate`
- `EnsureRoleTypeCatalog`

但职责已经收缩为：

- 补基础表结构和字段
- 保证系统角色类型存在

启动期不再承担：

- 修复历史 `roleentity.typeCode`
- 批量归并脏数据
- 自动加外键和唯一约束

如果关键数据库硬化脚本没有执行，服务会打印 warning，但不会在启动时自动改库。

## 环境注意事项

- 如果目标库默认表引擎是 `MyISAM`，外键不会真正生效；`role_management_tighten_constraints.go` 会先把相关表统一切换为 `InnoDB`，再补外键。
- 在 MySQL 5.7 + `utf8mb4` 环境下，带唯一索引的 `code` 字段不应扩成 `varchar(255)`；当前脚本固定使用 `varchar(191)`。

## 回滚策略

本轮不提供自动回滚脚本。

手工回滚顺序：

1. 先回滚代码版本
2. 如果新约束导致问题，手工删除新增外键和唯一索引
3. 如需恢复清洗前的数据，使用执行脚本前的数据库备份恢复

建议不要在没有备份的情况下直接执行脚本。
