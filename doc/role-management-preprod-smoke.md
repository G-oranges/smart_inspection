# 角色管理预发 Smoke 记录（2026-04-19）

## 背景
- 目标库：`mysql://root:******@localhost:3307/dorm_inspection`
- 既有服务：`http://localhost:4001`
- 临时验证实例：`http://localhost:4002`

## 已验证接口

### 4001 运行中服务
- `GET /health`：通过
- `POST /api/auth/login`：通过
- `GET /api/users/me`：通过
- `GET /api/roles`：通过
- `GET /api/role-types`：通过
- `GET /api/permissions/me`：通过
- `GET /api/permissions/roles`：通过
- `GET /api/dashboard/summary`：通过

### 首次阻断项
- `GET /api/users/executors`：失败
- 现象：返回 `500`
- 原因：查询路径显式引用了旧库中不存在的 `user.avatarUrl` 列

## 本轮修补
- 文件：`D:\\my_project_bychatgpt\\backend-go\\internal\\repository\\user_repository.go`
- 调整：`FindExecutors` 改为显式选择执行人接口真正需要的用户列，不再隐式依赖 `avatarUrl`
- 回归测试：`D:\\my_project_bychatgpt\\backend-go\\internal\\repository\\user_repository_test.go`
  - 覆盖“旧库无 `avatarUrl` 列时执行人查询仍可用”的场景

## 修补后验证
- 通过临时 `4002` 实例加载新代码，对同一目标库执行真实验证
- 结果：
  - `GET /health`：通过
  - `POST /api/auth/login`：通过
  - `GET /api/users/executors`：通过
  - 返回总数：`5`

## 启动期兼容性补口
- 修补项：
  - `Dormitory.Version` 显式映射到 `column:version`
  - `UserPermissionOverride.Allow` 显式映射到 `column:allow`
  - `RoleEntity.Users` 统一使用 `_roleentitytouser`
  - 启动期 `AutoMigrate` 改为：
    - `DisableForeignKeyConstraintWhenMigrating: true`
    - `IgnoreRelationshipsWhenMigrating: true`
- 目的：
  - 不再让运行时 `AutoMigrate` 去隐式修复历史外键
  - 避免在 MySQL 大小写不敏感环境里把 `version/allow` 误判成新列
  - 避免把 `_roleentitytouser` 当成新的隐式关系表重塑结构

## 启动期验证
- 再次通过临时 `4002` 实例启动验证
- 结果：
  - 角色管理相关的 `AutoMigrate` 警告已消失
  - 仅剩共享 `.env` 文件缺失提示，不影响当前本地 `.env` 启动

## 当前结论
- 角色管理相关预发 smoke 关键读链路可用
- 数据库收口后的角色、角色类型、权限矩阵、数据范围、看板汇总链路未出现新的角色管理阻断项
- `users/executors` 兼容性问题已修复

## 仍需后续处理的非角色管理问题
- 临时 `4002` 实例仍会提示：
  - `Warning: Error loading shared .env file from ../backend/.env`
- 该提示不影响当前启动，因为 `backend-go/.env` 已提供有效配置
- 若后续要统一环境加载策略，可单独整理 `.env` 目录结构，但不属于角色管理阻断项
