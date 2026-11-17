package middleware

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/my-project/backend-go/pkg/utils"
)

// DistributedRateLimiter 基于 Redis 的分布式限流器
// 支持多实例部署，使用滑动窗口算法
type DistributedRateLimiter struct {
	prefix      string        // Redis 键前缀
	window      time.Duration // 时间窗口
	maxAttempts int           // 窗口内最大尝试次数

	// 内存限流器作为降级方案（Redis 不可用时使用）
	fallback    *RateLimiter
	fallbackMu  sync.RWMutex
	useFallback bool
}

// NewDistributedRateLimiter 创建分布式限流器
// prefix: Redis 键前缀（如 "login", "api"）
// window: 时间窗口
// maxAttempts: 窗口内最大尝试次数
func NewDistributedRateLimiter(prefix string, window time.Duration, maxAttempts int) *DistributedRateLimiter {
	drl := &DistributedRateLimiter{
		prefix:      prefix,
		window:      window,
		maxAttempts: maxAttempts,
		fallback:    NewRateLimiter(window, maxAttempts),
		useFallback: !utils.IsRedisAvailable(),
	}

	// 定期检查 Redis 可用性
	go drl.checkRedisAvailability()

	return drl
}

// checkRedisAvailability 定期检查 Redis 可用性，自动切换模式
func (drl *DistributedRateLimiter) checkRedisAvailability() {
	ticker := time.NewTicker(30 * time.Second)
	for range ticker.C {
		available := utils.IsRedisAvailable()
		drl.fallbackMu.Lock()
		if drl.useFallback && available {
			// Redis 恢复，切换到分布式模式
			drl.useFallback = false
		} else if !drl.useFallback && !available {
			// Redis 不可用，切换到降级模式
			drl.useFallback = true
		}
		drl.fallbackMu.Unlock()
	}
}

// getRedisKey 生成 Redis 键
func (drl *DistributedRateLimiter) getRedisKey(identifier string) string {
	return fmt.Sprintf("ratelimit:%s:%s", drl.prefix, identifier)
}

// isUsingFallback 检查是否使用降级模式
func (drl *DistributedRateLimiter) isUsingFallback() bool {
	drl.fallbackMu.RLock()
	defer drl.fallbackMu.RUnlock()
	return drl.useFallback
}

// CheckLimit 检查是否超过限流
// 返回: (是否允许, 剩余尝试次数, 重试等待秒数)
func (drl *DistributedRateLimiter) CheckLimit(identifier string) (allowed bool, remaining int, retryAfter int) {
	// 降级模式：使用内存限流器
	if drl.isUsingFallback() || utils.RedisClient == nil {
		return drl.checkLimitFallback(identifier)
	}

	key := drl.getRedisKey(identifier)
	ctx := context.Background()
	now := time.Now().Unix()
	windowStart := now - int64(drl.window.Seconds())

	// 使用 Redis 事务执行滑动窗口限流
	// 1. 移除窗口外的旧记录
	// 2. 添加当前请求时间戳
	// 3. 获取窗口内的请求数量
	// 4. 设置键的过期时间

	pipe := utils.RedisClient.Pipeline()

	// ZRemRangeByScore: 移除窗口外的记录
	pipe.ZRemRangeByScore(ctx, key, "0", fmt.Sprintf("%d", windowStart))

	// ZAdd: 添加当前请求（使用纳秒作为 score 和 member 保证唯一性）
	member := fmt.Sprintf("%d", time.Now().UnixNano())
	pipe.ZAdd(ctx, key, utils.RedisZ(float64(now), member))

	// ZCard: 获取窗口内的请求数量
	countCmd := pipe.ZCard(ctx, key)

	// Expire: 设置键的过期时间
	pipe.Expire(ctx, key, drl.window)

	_, err := pipe.Exec(ctx)
	if err != nil {
		// Redis 操作失败，降级到内存限流
		drl.fallbackMu.Lock()
		drl.useFallback = true
		drl.fallbackMu.Unlock()
		return drl.checkLimitFallback(identifier)
	}

	count := int(countCmd.Val())
	remaining = drl.maxAttempts - count

	if count > drl.maxAttempts {
		// 超过限流，计算重试等待时间
		retryAfter = int(drl.window.Seconds())
		return false, 0, retryAfter
	}

	return true, remaining, 0
}

// checkLimitFallback 降级到内存限流
func (drl *DistributedRateLimiter) checkLimitFallback(identifier string) (allowed bool, remaining int, retryAfter int) {
	drl.fallback.mu.Lock()
	defer drl.fallback.mu.Unlock()

	info, exists := drl.fallback.attempts[identifier]
	now := time.Now()

	if !exists || now.After(info.resetAt) {
		// 新窗口
		drl.fallback.attempts[identifier] = &attemptInfo{
			count:   1,
			resetAt: now.Add(drl.window),
		}
		return true, drl.maxAttempts - 1, 0
	}

	if info.count >= drl.maxAttempts {
		retryAfter = int(info.resetAt.Sub(now).Seconds())
		return false, 0, retryAfter
	}

	info.count++
	return true, drl.maxAttempts - info.count, 0
}

// Reset 重置指定标识符的限流计数（如登录成功时清除）
func (drl *DistributedRateLimiter) Reset(identifier string) {
	if drl.isUsingFallback() || utils.RedisClient == nil {
		// 降级模式：清除内存记录
		drl.fallback.mu.Lock()
		delete(drl.fallback.attempts, identifier)
		drl.fallback.mu.Unlock()
		return
	}

	key := drl.getRedisKey(identifier)
	utils.RedisClient.Del(context.Background(), key)
}

// DistributedLoginRateLimiter 分布式登录限流中间件
// 基于 IP 进行限流，支持多实例部署
func DistributedLoginRateLimiter(drl *DistributedRateLimiter) gin.HandlerFunc {
	return func(c *gin.Context) {
		identifier := c.ClientIP()

		allowed, remaining, retryAfter := drl.CheckLimit(identifier)

		// 添加限流相关的响应头
		c.Header("X-RateLimit-Limit", fmt.Sprintf("%d", drl.maxAttempts))
		c.Header("X-RateLimit-Remaining", fmt.Sprintf("%d", remaining))

		if !allowed {
			c.Header("Retry-After", fmt.Sprintf("%d", retryAfter))
			c.JSON(http.StatusTooManyRequests, gin.H{
				"message":    "登录尝试次数过多，请稍后再试",
				"retryAfter": retryAfter,
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

// IsBlocked 只读检查：窗口内的失败次数是否已达上限（不计入新的尝试）。
func (drl *DistributedRateLimiter) IsBlocked(identifier string) (bool, int) {
	if drl.isUsingFallback() || utils.RedisClient == nil {
		drl.fallback.mu.Lock()
		defer drl.fallback.mu.Unlock()
		info, exists := drl.fallback.attempts[identifier]
		now := time.Now()
		if !exists || now.After(info.resetAt) {
			return false, 0
		}
		if info.count >= drl.maxAttempts {
			return true, int(info.resetAt.Sub(now).Seconds()) + 1
		}
		return false, 0
	}

	ctx := context.Background()
	windowStart := time.Now().Unix() - int64(drl.window.Seconds())
	count, err := utils.RedisClient.ZCount(ctx, drl.getRedisKey(identifier), fmt.Sprintf("%d", windowStart), "+inf").Result()
	if err != nil {
		return false, 0
	}
	if int(count) >= drl.maxAttempts {
		return true, int(drl.window.Seconds())
	}
	return false, 0
}

// LoginFailureRateLimiter 登录失败限流：只统计失败的登录，成功登录会清除该账号的失败计数。
// accountLimiter 按 "IP + 用户名" 计数，防止针对单个账号的暴力破解；
// ipLimiter 按 IP 计数（上限更高），防止同一来源对大量账号撒网尝试。
// 客户端 IP 取自 gin 的 ClientIP，只有在路由上配置了受信代理时才会采信 X-Forwarded-For。
func LoginFailureRateLimiter(accountLimiter, ipLimiter *DistributedRateLimiter) gin.HandlerFunc {
	return func(c *gin.Context) {
		ip := c.ClientIP()
		accountKey := ip + "|" + strings.ToLower(strings.TrimSpace(peekJSONField(c, "username")))

		for _, check := range []struct {
			limiter *DistributedRateLimiter
			key     string
		}{{accountLimiter, accountKey}, {ipLimiter, ip}} {
			if blocked, retryAfter := check.limiter.IsBlocked(check.key); blocked {
				c.Header("Retry-After", fmt.Sprintf("%d", retryAfter))
				c.JSON(http.StatusTooManyRequests, gin.H{
					"message":    "登录失败次数过多，请稍后再试",
					"retryAfter": retryAfter,
				})
				c.Abort()
				return
			}
		}

		c.Next()

		switch c.Writer.Status() {
		case http.StatusUnauthorized:
			accountLimiter.CheckLimit(accountKey)
			ipLimiter.CheckLimit(ip)
		case http.StatusOK:
			accountLimiter.Reset(accountKey)
		}
	}
}

// SimpleRateLimiter 通用限流：每次请求都计数（用于找回密码等公开接口）。
func SimpleRateLimiter(drl *DistributedRateLimiter, message string) gin.HandlerFunc {
	return func(c *gin.Context) {
		allowed, _, retryAfter := drl.CheckLimit(c.ClientIP())
		if !allowed {
			c.Header("Retry-After", fmt.Sprintf("%d", retryAfter))
			c.JSON(http.StatusTooManyRequests, gin.H{"message": message, "retryAfter": retryAfter})
			c.Abort()
			return
		}
		c.Next()
	}
}

// peekJSONField 读取 JSON 请求体中的字符串字段，并把请求体还原，供后续处理器正常绑定。
func peekJSONField(c *gin.Context, field string) string {
	if c.Request.Body == nil {
		return ""
	}
	body, err := io.ReadAll(io.LimitReader(c.Request.Body, 64<<10))
	c.Request.Body.Close()
	c.Request.Body = io.NopCloser(bytes.NewReader(body))
	if err != nil {
		return ""
	}
	var payload map[string]interface{}
	if json.Unmarshal(body, &payload) != nil {
		return ""
	}
	value, _ := payload[field].(string)
	return value
}

// DistributedAPIRateLimiter 分布式 API 限流中间件
// 可用于保护普通 API 端点
func DistributedAPIRateLimiter(drl *DistributedRateLimiter) gin.HandlerFunc {
	return func(c *gin.Context) {
		// 优先使用用户 ID，否则使用 IP
		identifier := c.ClientIP()
		if userId, exists := c.Get("userId"); exists {
			identifier = fmt.Sprintf("user:%v", userId)
		}

		allowed, remaining, retryAfter := drl.CheckLimit(identifier)

		c.Header("X-RateLimit-Limit", fmt.Sprintf("%d", drl.maxAttempts))
		c.Header("X-RateLimit-Remaining", fmt.Sprintf("%d", remaining))

		if !allowed {
			c.Header("Retry-After", fmt.Sprintf("%d", retryAfter))
			c.JSON(http.StatusTooManyRequests, gin.H{
				"message":    "请求频率过高，请稍后再试",
				"retryAfter": retryAfter,
			})
			c.Abort()
			return
		}

		c.Next()
	}
}
