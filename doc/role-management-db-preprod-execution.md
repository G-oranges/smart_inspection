# 角色管理数据库预发执行记录

更新时间：2026-04-19

## 执行目标

在预发目标库 `dorm_inspection` 上完成角色管理数据库收口：

1. 备份现有库
2. 补齐角色管理基础表
3. 运行 normalize 清洗历史数据
4. 运行 tighten 补唯一约束和外键
5. 验证 role-management schema warning 消失

## 执行环境

- 数据库：`dorm_inspection`
- MySQL 版本：`5.7.26`
- 地址：`localhost:3307`
- 账号：`root`
- 备份文件：
  - [dorm_inspection_preprod_before_role_mgmt_20260419.sql](D:/my_project_bychatgpt/doc/db-backups/dorm_inspection_preprod_before_role_mgmt_20260419.sql)

## 执行步骤

### 1. 备份

使用 `mysqldump` 执行整库备份。

首次备份命令因 MySQL 8 客户端默认读取 `COLUMN_STATISTICS` 失败，已通过追加 `--column-statistics=0` 修正。

### 2. 预检查

预检查发现：

- 库中已有 `roleentity`、`roletype`、`rolepermission`、`_roleentitytouser`
- `roledatascope` 尚未存在
- `WarnRoleManagementSchemaStatus` 报告缺失：
  - `roledatascope(roleId)` 唯一约束
  - `fk_roleentity_typecode`
  - `fk_roledatascope_roleid`
  - `fk_rolepermission_roleid`
  - `fk_rolepermission_permissionid`
  - `fk_roleentitytouser_role`
  - `fk_roleentitytouser_user`

### 3. 补角色管理基础表

由于预发库处于旧 schema 状态，先按当前服务启动逻辑的“轻量版本”补基础表：

- `SystemSettings`
- `RoleType`
- `RoleEntity`
- `Permission`
- `RolePermission`
- `RoleDataScope`
- `UserPermissionOverride`
- `_roleentitytouser`

注意：

- 这里采用了 `DisableForeignKeyConstraintWhenMigrating=true`
- 原因是完整 `AutoMigrate` 会带出无关业务关系，旧库会在 `dormitory/building` 等历史外键上报错

### 4. 执行 normalize

执行：

- `backend-go/scripts/role_management_precheck_normalize.go`

关键结果：

- `SYSTEM / BUSINESS / CUSTOM` 角色类型已对齐
- 标准角色统一回收到 `SYSTEM`
- `_roleentitytouser` 被按有效角色/有效用户重建
- 未出现用户主角色异常回收

本次 normalize 报告：

- `RoleTypesInserted: 0`
- `RoleTypesUpdated: 0`
- `RoleEntitiesUpdated: 4`
- `RoleDataScopesDeleted: 0`
- `RolePermissionsDeleted: 0`
- `UserRolesUpdated: 0`
- `JoinRowsRebuilt: 19811`
- `MissingStdRolesCreated: 0`

### 5. 执行 tighten

执行：

- `backend-go/scripts/role_management_tighten_constraints.go`

脚本在当前环境中成功完成，并做了两类兼容处理：

- `roletype.code`、`roleentity.code` 使用 `varchar(191)`，兼容 MySQL 5.7 + `utf8mb4` 唯一索引长度限制
- 先将角色管理相关表统一切换为 `InnoDB`，再添加外键

## 执行后结果

### 表引擎

以下表已确认为 `InnoDB`：

- `roletype`
- `roleentity`
- `roledatascope`
- `rolepermission`
- `_roleentitytouser`

### 已确认生效的角色管理外键

- `fk_roleentity_typecode`
- `fk_roledatascope_roleid`
- `fk_rolepermission_roleid`
- `fk_rolepermission_permissionid`
- `fk_roleentitytouser_role`
- `fk_roleentitytouser_user`

### 执行后数据概况

- `roleentity`：5
- `roletype`：3
- `roledatascope`：0
- `rolepermission`：33
- `_roleentitytouser`：19811
- `user`：19809

### Warning 检查

使用 `WarnRoleManagementSchemaStatus` 独立探测后，结果为：

- `role-management-warning-check-passed`

说明角色管理数据库硬化 warning 已消失。

## 结论

预发数据库层结论：**Go**

当前已完成：

- 预发库备份
- 角色管理基础表补齐
- normalize 清洗
- tighten 加约束
- role-management schema warning 消失

## 仍待完成的预发侧动作

这一步主要完成了数据库层落地，以下仍建议继续做，但不属于本次脚本执行本身的失败项：

- 用真实预发后端进程完成一次重启验证
- 前后端联调验证角色、角色类型、数据范围、看板、导入链路
- 基于预发数据做一轮业务侧 smoke test

## 风险与注意事项

- 预发库原有表存在 `MyISAM` 历史包袱；如果后续再新建角色管理相关表，仍应确认引擎为 `InnoDB`
- `user.role` 仍未加数据库外键，这一兼容策略没有变化
- 本次未在预发库直接运行接口自动化测试；接口层回归仍依赖本地/测试库测试结果和后续联调
