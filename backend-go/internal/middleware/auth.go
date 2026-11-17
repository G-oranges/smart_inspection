package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/my-project/backend-go/pkg/utils"
)

// AuthMiddleware 认证中间件
// 验证 JWT Token 有效性，并检查 Token 是否已被加入黑名单（支持分布式注销）
func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"message": "Authorization header is required"})
			c.Abort()
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if !(len(parts) == 2 && parts[0] == "Bearer") {
			c.JSON(http.StatusUnauthorized, gin.H{"message": "Authorization header format must be Bearer {token}"})
			c.Abort()
			return
		}

		tokenString := parts[1]

		claims, err := utils.ParseToken(tokenString)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"message": "Invalid or expired token"})
			c.Abort()
			return
		}

		// Token 黑名单校验（支持分布式注销，Redis 不可用时自动降级）
		if utils.IsTokenBlacklisted(tokenString) {
			c.JSON(http.StatusUnauthorized, gin.H{"message": "Token 已失效，请重新登录"})
			c.Abort()
			return
		}

		// 将用户信息存入上下文，供后续 Handler 使用
		c.Set("userId", claims.ID)
		c.Set("role", claims.Role)
		c.Set("tokenVersion", claims.TokenVersion) // 传递 Token 版本号供 PermissionInjector 校验

		c.Next()
	}
}
