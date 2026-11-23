package middleware

import (
	"sync"
	"time"
)

// RateLimiter 内存限流存储，作为 DistributedRateLimiter 在 Redis 不可用时的降级后端。
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

// NewRateLimiter 创建新的内存限流器。
// window: 时间窗口，maxAttempts: 窗口内最大尝试次数。
func NewRateLimiter(window time.Duration, maxAttempts int) *RateLimiter {
	rl := &RateLimiter{
		attempts:    make(map[string]*attemptInfo),
		window:      window,
		maxAttempts: maxAttempts,
	}
	go rl.cleanup()
	return rl
}

// cleanup 定期清理过期的限流记录。
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
