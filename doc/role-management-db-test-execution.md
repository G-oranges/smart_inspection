# 角色管理数据库测试库执行记录

更新时间：2026-04-18

## 执行目标

在独立测试 MySQL 上验证：

1. `role_management_precheck_normalize.go` 可以清洗角色管理相关脏数据
2. `role_management_tighten_constraints.go` 可以成功补齐唯一约束和外键
3. 角色管理核心链路在加约束后仍可通过后端回归

## 执行环境

- 数据库：`dorm_inspection_role_mgmt_test`
- MySQL 版本：`5.7.26`
- 连接来源：本地 `backend-go/.env` 派生测试库，不触碰现有 `dorm_inspection`
- 备份说明：
  - 本次使用的是新建隔离测试库，因此未做传统备份
  - 执行前状态可通过重新初始化测试库复原

## 执行前快照

- `roleentity`：4
- `roletype`：1
- `roledatascope`：2
- `rolepermission`：29
- `_roleentitytouser`：1
- `user`：5

为验证清洗逻辑，执行前主动注入了几类脏数据：

- 空/非法 `roleentity.typeCode`
- 空 `roleentity.status`
- 非法 `user.role`
- 孤儿 `roledatascope`
- 孤儿 `_roleentitytouser`
- 空名称/空状态的自定义 `roletype`

## 执行过程

### 1. 初始化测试库

- 使用 `scripts/init_authz_test_db.go` 初始化隔离测试库
- 补齐 `roledatascope` 表后注入验证用脏数据

### 2. 运行 normalize

执行：

- `backend-go/scripts/role_management_precheck_normalize.go`

关键结果：

- 自动补齐 `SYSTEM / BUSINESS / CUSTOM`
- 非法 `user.role` 被回收为有效角色码
- 孤儿 `roledatascope` 被删除
- 孤儿 `_roleentitytouser` 被清空
- 标准角色被重新归并到 `SYSTEM`

本次 normalize 报告：

- `RoleTypesInserted: 3`
- `RoleTypesUpdated: 1`
- `RoleEntitiesUpdated: 4`
- `RoleDataScopesDeleted: 1`
- `UserRolesUpdated: 1`
- `JoinRowsRebuilt: 0`

### 3. 运行 tighten

首次执行暴露了两个真实兼容问题：

1. `varchar(255)` + 唯一索引在 MySQL 5.7 / `utf8mb4` 下超出 key length
2. 测试库默认表引擎为 `MyISAM`，外键不会真正生效

已按实际环境修正脚本：

- `roletype.code`、`roleentity.code` 保持 `varchar(191)`
- 先将 `user`、`permission`、`roletype`、`roleentity`、`roledatascope`、`rolepermission`、`_roleentitytouser` 统一切换为 `InnoDB`

修正后再次执行：

- `backend-go/scripts/role_management_tighten_constraints.go`

执行成功。

## 执行后结果

### 已确认生效的外键

- `fk_roledatascope_roleid`
- `fk_roleentity_typecode`
- `fk_rolepermission_permissionid`
- `fk_rolepermission_roleid`
- `fk_roleentitytouser_role`
- `fk_roleentitytouser_user`

### 执行后数据概况

- `roleentity`：4
- `roletype`：3
- `roledatascope`：0
- `rolepermission`：30
- `_roleentitytouser`：0
- `user`：5

### 启动期检查

- 使用 `WarnRoleManagementSchemaStatus` 单独探测，结果为 `role-management-warning-check-passed`
- 说明角色管理数据库硬化 warning 已消失

## 回归验证

执行：

- `go test ./internal/router`
- `go test ./...`

说明：

- 测试最初失败，原因是 `authz_integration_test.go` 的清库顺序和种子数据仍按“无外键”时代编写
- 已修复：
  - 清库顺序按外键依赖调整
  - 在测试环境初始化时先执行 `EnsureRoleTypeCatalog`
  - 角色种子显式带 `TypeCode: SYSTEM`

修复后：

- `go test ./internal/router` 通过
- `go test ./...` 通过

## Go / No-Go 结论

测试库结论：**Go**

满足进入预发的条件：

- 脚本执行成功，无需手工改表救火
- 角色管理数据库 warning 已消失
- 核心后端回归通过
- 角色、角色类型、权限矩阵、数据范围、导入、看板相关链路未出现无解释 `500`

## 进入预发前的建议

1. 预发库先备份，再按同样顺序执行 normalize -> tighten
2. 预发环境重点关注：
   - 历史真实脏数据规模
   - 脚本执行耗时
   - 前后端联调是否有兼容问题
3. 若预发库默认引擎也为 `MyISAM`，必须确认脚本切换为 `InnoDB` 后再观察 FK 生效情况
