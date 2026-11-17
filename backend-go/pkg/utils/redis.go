package utils

import (
	"context"
	"fmt"
	"os"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
)

var (
	RedisClient    *redis.Client
	ctx            = context.Background()
	localBlacklist = newBlacklistStore()
)

type blacklistStore struct {
	mu     sync.RWMutex
	tokens map[string]time.Time
}

func newBlacklistStore() *blacklistStore {
	return &blacklistStore{tokens: make(map[string]time.Time)}
}

func (s *blacklistStore) set(key string, ttl time.Duration) {
	if ttl <= 0 {
		return
	}
	expireAt := time.Now().Add(ttl)
	s.mu.Lock()
	s.tokens[key] = expireAt
	s.mu.Unlock()
}

func (s *blacklistStore) contains(key string) bool {
	s.mu.RLock()
	expireAt, ok := s.tokens[key]
	s.mu.RUnlock()
	if !ok {
		return false
	}
	if time.Now().After(expireAt) {
		s.mu.Lock()
		delete(s.tokens, key)
		s.mu.Unlock()
		return false
	}
	return true
}

// InitRedis 初始化 Redis 连接
func InitRedis() error {
	addr := os.Getenv("REDIS_ADDR")
	if addr == "" {
		addr = "localhost:6379" // 默认值
	}

	password := os.Getenv("REDIS_PASSWORD")

	RedisClient = redis.NewClient(&redis.Options{
		Addr:     addr,
		Password: password,
		DB:       0, // 默认使用 DB 0
	})

	// 测试连接 (缩短超时时间，在开发环境下若 Redis 未启动可快速跳过)
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	_, err := RedisClient.Ping(ctx).Result()
	if err != nil {
		return fmt.Errorf("failed to connect to redis: %v", err)
	}

	return nil
}

// GetRedisKey 获取带前缀的 Redis 键
func GetRedisKey(key string) string {
	return "dorm:" + key
}

// SetCache 设置缓存
func SetCache(key string, value interface{}, expiration time.Duration) error {
	if RedisClient == nil {
		return nil
	}
	return RedisClient.Set(ctx, GetRedisKey(key), value, expiration).Err()
}

// GetCache 获取缓存
func GetCache(key string) (string, error) {
	if RedisClient == nil {
		return "", fmt.Errorf("redis client not initialized")
	}
	return RedisClient.Get(ctx, GetRedisKey(key)).Result()
}

// DelCache 删除缓存
func DelCache(key ...string) error {
	if RedisClient == nil || len(key) == 0 {
		return nil
	}
	keys := make([]string, len(key))
	for i, k := range key {
		keys[i] = GetRedisKey(k)
	}
	return RedisClient.Del(ctx, keys...).Err()
}

// IsRedisAvailable 检查 Redis 是否可用
func IsRedisAvailable() bool {
	if RedisClient == nil {
		return false
	}
	ctx, cancel := context.WithTimeout(context.Background(), 500*time.Millisecond)
	defer cancel()
	return RedisClient.Ping(ctx).Err() == nil
}

// IsTokenBlacklisted 检查 Access Token 是否在黑名单中
// Redis 不可用时降级为仅检查本地内存黑名单
func IsTokenBlacklisted(token string) bool {
	key := "blacklist:" + token
	if localBlacklist.contains(key) {
		return true
	}
	if RedisClient == nil {
		return false
	}
	_, err := RedisClient.Get(ctx, GetRedisKey(key)).Result()
	if err == nil {
		return true
	}
	if err == redis.Nil {
		return false
	}
	return false
}

// IsRefreshTokenBlacklisted 检查 Refresh Token 是否在黑名单中
// Redis 不可用时降级为仅检查本地内存黑名单
func IsRefreshTokenBlacklisted(token string) bool {
	key := "blacklist:refresh:" + token
	if localBlacklist.contains(key) {
		return true
	}
	if RedisClient == nil {
		return false
	}
	_, err := RedisClient.Get(ctx, GetRedisKey(key)).Result()
	if err == nil {
		return true
	}
	if err == redis.Nil {
		return false
	}
	return false
}

// BlacklistToken adds an access token to blacklist with TTL.
// When Redis is unavailable, it falls back to in-memory storage.
func BlacklistToken(token string, ttl time.Duration) error {
	return setBlacklist("blacklist:"+token, ttl)
}

// BlacklistRefreshToken adds a refresh token to blacklist with TTL.
// When Redis is unavailable, it falls back to in-memory storage.
func BlacklistRefreshToken(token string, ttl time.Duration) error {
	return setBlacklist("blacklist:refresh:"+token, ttl)
}

func setBlacklist(key string, ttl time.Duration) error {
	if ttl <= 0 {
		return nil
	}
	if RedisClient == nil {
		localBlacklist.set(key, ttl)
		return fmt.Errorf("redis client not initialized")
	}
	if err := RedisClient.Set(ctx, GetRedisKey(key), "1", ttl).Err(); err != nil {
		localBlacklist.set(key, ttl)
		return err
	}
	return nil
}

// RedisZ 创建 Redis ZSet 成员（用于 ZAdd 操作）
// 封装 go-redis/v9 的 Z 类型，避免其他包直接依赖 redis 包
func RedisZ(score float64, member string) redis.Z {
	return redis.Z{
		Score:  score,
		Member: member,
	}
}
