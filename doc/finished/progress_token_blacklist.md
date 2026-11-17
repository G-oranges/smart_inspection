# Token 黑名单功能实现进展

## 更新时间: 2025-12-26 15:15

## 功能概述

实现了基于 Redis 的分布式 Token 黑名单机制，用于支持：

1. **即时注销**：用户登出后 Token 立即失效
2. **Token 轮转**：Refresh Token 刷新后旧 Token 立即失效，防止 Token 被窃取后重复使用
3. **分布式部署**：多实例部署时共享黑名单状态

## 实现细节

### 1. 认证中间件 (`middleware/auth.go`)

- 使用 `utils.IsTokenBlacklisted(token)` 检查 Token 是否在黑名单中
- **降级策略**：Redis 不可用时自动跳过黑名单检查，保证系统可用性

### 2. 登出接口 (`controller/auth_controller.go`)

- 将当前 Access Token 加入 Redis 黑名单
- **TTL 优化**：使用 Token 实际剩余过期时间作为 TTL，避免浪费 Redis 存储空间

### 3. Token 刷新 (`service/auth_service.go`)

- 刷新前检查 Refresh Token 是否在黑名单中
- 生成新 Refresh Token 后，将旧 Token 加入黑名单（Token 轮转）
- 黑名单 TTL 设置为旧 Token 剩余有效期

### 4. Redis 工具类 (`pkg/utils/redis.go`)

新增以下辅助函数：

- `IsRedisAvailable()` - 检查 Redis 是否可用
- `IsTokenBlacklisted(token)` - 检查 Access Token 是否在黑名单中
- `IsRefreshTokenBlacklisted(token)` - 检查 Refresh Token 是否在黑名单中

## Redis 键设计

| 键模式                                   | 说明                 | TTL              |
| ---------------------------------------- | -------------------- | ---------------- |
| `dorm:blacklist:{access_token}`          | Access Token 黑名单  | Token 剩余有效期 |
| `dorm:blacklist:refresh:{refresh_token}` | Refresh Token 黑名单 | Token 剩余有效期 |

## 安全增强

1. **防窃取**：旧 Token 无法重复使用
2. **即时生效**：登出操作可在分布式系统中立即同步
3. **存储优化**：TTL 基于实际剩余时间，自动清理过期数据

## 测试验证

1. 编译通过：`go build -o backend-go.exe ./cmd/server/main.go` ✅
2. 登出后使用旧 Token 访问 API 应返回 401
3. Refresh Token 轮转后使用旧 Token 刷新应返回 401

## 依赖

- Redis 3.x+
- go-redis/v9 客户端
