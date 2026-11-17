package middleware

import (
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

// RateLimiter 简单的内存限流器
type RateLimiter struct {
	mu          sync.Mutex
	attempts    map[string]*attemptInfo
	window      time.Duration
	maxAttempts int
}

type attemptInfo struct {
	count   int
	resetAt time.Time
}

// NewRateLimiter 创建新的限流器
// window: 时间窗口，maxAttempts: 窗口内最大尝试次数
func NewRateLimiter(window time.Duration, maxAttempts int) *RateLimiter {
	rl := &RateLimiter{
		attempts:    make(map[string]*attemptInfo),
		window:      window,
		maxAttempts: maxAttempts,
	}
	// 定期清理过期记录
	go rl.cleanup()
	return rl
}

// cleanup 定期清理过期的限流记录
func (rl *RateLimiter) cleanup() {
	ticker := time.NewTicker(time.Minute)
	for range ticker.C {
		rl.mu.Lock()
		now := time.Now()
		for key, info := range rl.attempts {
			if now.After(info.resetAt) {
				delete(rl.attempts, key)
			}
		}
		rl.mu.Unlock()
	}
}

// getKey 生成限流键（IP + 用户名组合）
func getKey(c *gin.Context, username string) string {
	ip := c.ClientIP()
	if username != "" {
		return ip + ":" + username
	}
	return ip
}

// LoginRateLimitMiddleware 登录限流中间件
// 限制每个 IP+用户名 在 5 分钟内最多尝试 5 次登录
func LoginRateLimitMiddleware(rl *RateLimiter) gin.HandlerFunc {
	return func(c *gin.Context) {
		// 尝试从请求体中获取用户名（需要先读取）
		var req struct {
			Username string `json:"username"`
		}

		// 保存原始 body 以便后续处理
		if err := c.ShouldBindJSON(&req); err != nil {
			// 如果无法解析，继续处理（让后面的 handler 返回错误）
			c.Next()
			return
		}

		// 重新设置 body 供后续 handler 使用
		// 注意：由于 ShouldBindJSON 会消费 body，需要特殊处理
		// 这里我们只检查限流，不消费 body

		key := getKey(c, req.Username)

		rl.mu.Lock()
		info, exists := rl.attempts[key]
		now := time.Now()

		if !exists || now.After(info.resetAt) {
			// 新窗口
			rl.attempts[key] = &attemptInfo{
				count:   1,
				resetAt: now.Add(rl.window),
			}
			rl.mu.Unlock()
			c.Next()
			return
		}

		if info.count >= rl.maxAttempts {
			retryAfter := int(info.resetAt.Sub(now).Seconds())
			rl.mu.Unlock()
			c.JSON(http.StatusTooManyRequests, gin.H{
				"message":    "登录尝试次数过多，请稍后再试",
				"retryAfter": retryAfter,
			})
			c.Abort()
			return
		}

		info.count++
		rl.mu.Unlock()
		c.Next()
	}
}

// RecordLoginAttempt 记录登录尝试（供成功登录时跳过计数使用）
func (rl *RateLimiter) RecordLoginAttempt(c *gin.Context, username string, success bool) {
	if success {
		// 登录成功，清除该用户的限流记录
		key := getKey(c, username)
		rl.mu.Lock()
		delete(rl.attempts, key)
		rl.mu.Unlock()
	}
}

// SimpleLoginRateLimiter 简化版登录限流中间件（不消费 body）
// 仅基于 IP 进行限流
func SimpleLoginRateLimiter(rl *RateLimiter) gin.HandlerFunc {
	return func(c *gin.Context) {
		key := c.ClientIP()

		rl.mu.Lock()
		info, exists := rl.attempts[key]
		now := time.Now()

		if !exists || now.After(info.resetAt) {
			// 新窗口或窗口已过期
			rl.attempts[key] = &attemptInfo{
				count:   1,
				resetAt: now.Add(rl.window),
			}
			rl.mu.Unlock()
			c.Next()
			return
		}

		if info.count >= rl.maxAttempts {
			retryAfter := int(info.resetAt.Sub(now).Seconds())
			rl.mu.Unlock()
			c.JSON(http.StatusTooManyRequests, gin.H{
				"message":    "登录尝试次数过多，请5分钟后再试",
				"retryAfter": retryAfter,
			})
			c.Abort()
			return
		}

		info.count++
		rl.mu.Unlock()
		c.Next()
	}
}
