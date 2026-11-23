package utils

import (
	"errors"
	"fmt"
	"os"
	"strings"
	"testing"
)

// devFallbackJWTSecret 仅在开发/测试环境下、且未配置 JWT_SECRET 时使用。
const devFallbackJWTSecret = "default_secret_for_dev_only"

// MinJWTSecretLength 非开发环境下 JWT 密钥的最小字节数（HS256 建议 >= 256 bit）。
const MinJWTSecretLength = 32

var errJWTSecretMissing = errors.New("JWT_SECRET 未配置")

// inTestBinary 可在单元测试中替换，用于验证生产环境分支。
var inTestBinary = testing.Testing

// IsDevEnvironment 当 APP_ENV 为 development/dev/local/test 或处于 go test 中时返回 true。
// 未设置 APP_ENV 视为生产环境（安全默认值）。
func IsDevEnvironment() bool {
	if inTestBinary() {
		return true
	}
	switch strings.ToLower(strings.TrimSpace(os.Getenv("APP_ENV"))) {
	case "development", "dev", "local", "test":
		return true
	}
	return false
}

// JWTSecret 返回 Access Token 签名密钥。
// 生产环境未配置时返回错误，绝不回退到硬编码默认值。
func JWTSecret() ([]byte, error) {
	if s := os.Getenv("JWT_SECRET"); s != "" {
		return []byte(s), nil
	}
	if IsDevEnvironment() {
		return []byte(devFallbackJWTSecret), nil
	}
	return nil, errJWTSecretMissing
}

// JWTRefreshSecret 返回 Refresh Token 签名密钥。
// 未单独配置 JWT_REFRESH_SECRET 时，沿用 "<JWT_SECRET>_refresh" 的派生规则（兼容既有 token）。
func JWTRefreshSecret() ([]byte, error) {
	if s := os.Getenv("JWT_REFRESH_SECRET"); s != "" {
		return []byte(s), nil
	}
	base, err := JWTSecret()
	if err != nil {
		return nil, err
	}
	return append(base, []byte("_refresh")...), nil
}

// ValidateJWTConfig 在服务启动时调用：非开发环境下密钥缺失或过短直接返回错误。
func ValidateJWTConfig() error {
	if IsDevEnvironment() {
		return nil
	}
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		return fmt.Errorf("%w：非开发环境必须设置 JWT_SECRET（开发环境请设置 APP_ENV=development）", errJWTSecretMissing)
	}
	if len(secret) < MinJWTSecretLength {
		return fmt.Errorf("JWT_SECRET 长度不足：需要至少 %d 字节，当前 %d 字节", MinJWTSecretLength, len(secret))
	}
	if refresh := os.Getenv("JWT_REFRESH_SECRET"); refresh != "" && len(refresh) < MinJWTSecretLength {
		return fmt.Errorf("JWT_REFRESH_SECRET 长度不足：需要至少 %d 字节，当前 %d 字节", MinJWTSecretLength, len(refresh))
	}
	return nil
}
