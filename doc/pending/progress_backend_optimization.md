# 后端优化阶段进展总结

## 任务背景

结合 `backend_optimization_plan.md` 对 Go 后端进行安全性、性能和工程化方面的优化评估与实施。

## 当前进展 (2025-12-26)

### 1. 方案评估与文档更新

- ✅ **必要性与可行性评估**: 完成了对 Argon2id、Casbin、密码策略、索引优化、Redis 缓存、结构化日志、输入校验等项的深度评估。
- ✅ **计划更新**: 已更新 `doc/backend_optimization_plan.md`，明确了后续的三个实施阶段。
- ✅ **新增优化项**: 识别并添加了“代码模块化重构”和“统一错误码体系”作为高优先级优化项。

### 2. 已落地优化项 (本阶段已完成)

- ✅ **Token 黑名单与轮转**: 基于 Redis 实现了安全注销和防止 Token 窃取。
- ✅ **限流机制**: 实现了基于 Redis 滑动窗口的分布式限流，并已应用在登录接口。
- ✅ **性能优化**:
  - 仪表盘统计数据 60s 内存缓存。
  - 文件上传 MIME/大小严格校验。
  - 批量导入事务化与 Upsert 逻辑优化。
- ✅ **兼容性适配**: 统一了后端所有控制器的错误返回字段为 `message`，确保与前端完全对齐。
- ✅ **ORDER BY 注入防护** (2026-01-11):
  - 新增 `pkg/utils/sort_validator.go` 通用排序验证工具
  - 学生表 (`GetStudentTable`) 和楼栋表 (`GetBuildingTable`) 排序参数改为白名单校验
  - 非法 `sortField`/`sortOrder` 静默回退默认值，阻断 SQL 注入攻击
  - 响应体新增 `sortableFields` 字段，暴露可排序字段列表供前端对齐
  - 配套单元测试 `sort_validator_test.go` 覆盖注入场景
- ✅ **Token 版本化失效机制** (2026-01-11):
  - User 模型新增 `tokenVersion` 字段（默认值 1）
  - JWT Claims 新增 `tokenVersion` 字段，Login/Refresh 时写入
  - `PermissionInjector` 中间件校验 isDisabled 和 tokenVersion
  - 禁用用户 → 403；版本不匹配 → 401（凭证已失效）
  - 触发版本递增的场景：
    - 用户禁用/启用 (`user_service.go`)
    - 用户改密 (`auth_service.go:ChangePassword`)
    - 邮箱验证码重置密码 (`auth_service.go:ResetPasswordByCode`)
    - 管理员重置密码 (`user_repository.go:UpdatePassword`)
  - 旧 Token（无版本号）采用严格模式拒绝，强制重新登录
  - 数据库迁移脚本: `scripts/migrate_token_version.sql`
- ✅ **Token 版本化修复** (2026-01-12):
  - 修复测试代码 `GenerateAccessToken` 签名
  - 新建学生/教工账号显式设置 `TokenVersion: 1`
  - 优化 isDisabled 递增逻辑，仅状态实际变化时递增
  - 完善 `delUserStatusCache` 缓存清理实现

## 下一步工作计划

### 立即启动 (工程化增强)

1. **代码分割**: 将庞大的 `extended_controller.go` 拆分为模块化控制器。
2. **结构化日志**: 引入 `Zap` 替换标准 `log` 包。

### 后续规划 (安全防御)

1. **密码复杂度校验**: 实现后端级别的强制密码策略。
2. **连接池深度调优**: 针对生产环境并发量进一步微调数据库参数。

---

_更新于: 2026-01-11 23:50_
