# 分布式限流功能实现进展

## 更新时间: 2025-12-26 15:25

## 功能概述

实现了基于 Redis 的分布式限流机制，使用**滑动窗口算法**，支持：

1. **多实例部署**：限流状态通过 Redis 共享
2. **自动降级**：Redis 不可用时自动切换到内存模式
3. **平滑限流**：滑动窗口比固定窗口更平滑，避免窗口边界的突发请求

## 实现细节

### 1. 新增文件: `middleware/distributed_ratelimit.go`

#### DistributedRateLimiter 结构体

```go
type DistributedRateLimiter struct {
    prefix      string        // Redis 键前缀
    window      time.Duration // 时间窗口
    maxAttempts int           // 窗口内最大尝试次数
    fallback    *RateLimiter  // 内存限流器作为降级方案
    useFallback bool          // 是否使用降级模式
}
```

#### 核心方法

- `NewDistributedRateLimiter(prefix, window, maxAttempts)` - 创建分布式限流器
- `CheckLimit(identifier)` - 检查是否超过限流
- `Reset(identifier)` - 重置限流计数（如登录成功时）

#### 中间件

- `DistributedLoginRateLimiter` - 登录限流中间件（基于 IP）
- `DistributedAPIRateLimiter` - 通用 API 限流中间件（基于用户 ID 或 IP）

### 2. Redis 辅助函数: `pkg/utils/redis.go`

新增 `RedisZ()` 函数用于创建 ZSet 成员

### 3. 路由更新: `internal/router/router.go`

- 将 `NewRateLimiter` 替换为 `NewDistributedRateLimiter`
- 将 `SimpleLoginRateLimiter` 替换为 `DistributedLoginRateLimiter`

## 算法说明: 滑动窗口限流

使用 Redis Sorted Set 实现滑动窗口：

1. **时间戳作为 Score**：每个请求的时间戳作为 ZSet 的 score
2. **窗口清理**：每次请求时移除窗口外的旧记录 (ZRemRangeByScore)
3. **计数判断**：统计当前窗口内的请求数量 (ZCard)
4. **自动过期**：设置键的 TTL 为窗口时长

```
Redis 操作流程:
1. ZREMRANGEBYSCORE key 0 (now - window)  # 移除过期记录
2. ZADD key now member                     # 添加当前请求
3. ZCARD key                               # 获取请求计数
4. EXPIRE key window                       # 设置过期时间
```

## Redis 键设计

| 键模式                        | 说明     | TTL            |
| ----------------------------- | -------- | -------------- |
| `ratelimit:login:{ip}`        | 登录限流 | 5 分钟         |
| `ratelimit:api:{user_id\|ip}` | API 限流 | 配置的窗口时长 |

## 响应头

限流中间件会添加以下响应头：

- `X-RateLimit-Limit`: 最大请求数
- `X-RateLimit-Remaining`: 剩余请求数
- `Retry-After`: 超限时的重试等待秒数

## 降级策略

1. **启动时检测**：创建限流器时检测 Redis 可用性
2. **定期探测**：每 30 秒检测一次 Redis 状态
3. **自动切换**：
   - Redis 恢复 → 切换到分布式模式
   - Redis 故障 → 切换到内存模式
4. **无感降级**：业务代码无需关心当前模式

## 配置

当前登录限流配置：

- 时间窗口：5 分钟
- 最大尝试次数：5 次

## 测试验证

1. 编译通过 ✅
2. 快速连续登录（错误密码）应触发 429 响应
3. 响应头应包含 `X-RateLimit-*` 信息
4. 停止 Redis 后应自动降级到内存模式

## 依赖

- Redis 3.x+ (支持 Sorted Set)
- go-redis/v9 客户端
