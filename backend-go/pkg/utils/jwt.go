package utils

import (
	"errors"
	"os"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// Claims 定义 JWT 载荷，必须与 Node.js 兼容
type Claims struct {
	ID           string `json:"id"`           // 改为 id 以匹配 Node.js
	Role         string `json:"role"`         // 仅 Access Token 包含角色
	Type         string `json:"type"`         // access 或 refresh
	TokenVersion int    `json:"tokenVersion"` // Token 版本号，用于失效控制
	jwt.RegisteredClaims
}

const (
	AccessTokenExpiresIn  = 30 * time.Minute
	RefreshTokenExpiresIn = 7 * 24 * time.Hour
)

// GenerateAccessToken 生成访问令牌（短期）
// tokenVersion: 用户当前的 token 版本号，用于禁用/改密后失效旧 Token
func GenerateAccessToken(id, role string, tokenVersion int) (string, error) {
	secret := []byte(os.Getenv("JWT_SECRET"))
	if len(secret) == 0 {
		secret = []byte("default_secret_for_dev_only")
	}

	claims := &Claims{
		ID:           id,
		Role:         role,
		Type:         "access",
		TokenVersion: tokenVersion,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(AccessTokenExpiresIn)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(secret)
}

// GenerateRefreshToken 生成刷新令牌（长期）
// tokenVersion: 用户当前的 token 版本号，用于禁用/改密后失效旧 Refresh Token
func GenerateRefreshToken(id string, tokenVersion int) (string, error) {
	secret := []byte(os.Getenv("JWT_REFRESH_SECRET"))
	if len(secret) == 0 {
		// 如果未配置，使用派生密钥（匹配 Node.js 逻辑）
		jwtSecret := os.Getenv("JWT_SECRET")
		if jwtSecret == "" {
			jwtSecret = "default_secret_for_dev_only"
		}
		secret = []byte(jwtSecret + "_refresh")
	}

	claims := &Claims{
		ID:           id,
		Type:         "refresh",
		TokenVersion: tokenVersion,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(RefreshTokenExpiresIn)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(secret)
}

// ParseToken 解析并验证 JWT Access Token
func ParseToken(tokenString string) (*Claims, error) {
	secret := []byte(os.Getenv("JWT_SECRET"))
	if len(secret) == 0 {
		secret = []byte("default_secret_for_dev_only")
	}

	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return secret, nil
	})

	if err != nil {
		return nil, err
	}

	if claims, ok := token.Claims.(*Claims); ok && token.Valid {
		if claims.Type != "access" {
			return nil, errors.New("invalid token type")
		}
		return claims, nil
	}

	return nil, errors.New("invalid token")
}

// ParseRefreshToken 解析并验证 JWT Refresh Token
func ParseRefreshToken(tokenString string) (*Claims, error) {
	secret := []byte(os.Getenv("JWT_REFRESH_SECRET"))
	if len(secret) == 0 {
		jwtSecret := os.Getenv("JWT_SECRET")
		if jwtSecret == "" {
			jwtSecret = "default_secret_for_dev_only"
		}
		secret = []byte(jwtSecret + "_refresh")
	}

	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return secret, nil
	})

	if err != nil {
		return nil, err
	}

	if claims, ok := token.Claims.(*Claims); ok && token.Valid {
		if claims.Type != "refresh" {
			return nil, errors.New("invalid token type")
		}
		return claims, nil
	}

	return nil, errors.New("invalid token")
}
