package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/my-project/backend-go/internal/model"
	"github.com/my-project/backend-go/internal/service"
	"gorm.io/gorm"
)

// passwordChangeAllowedPaths 在“必须修改密码”状态下仍允许访问的接口。
var passwordChangeAllowedPaths = map[string]bool{
	"GET /api/auth/me":               true,
	"POST /api/auth/logout":          true,
	"PUT /api/auth/change-password":  true,
	"POST /api/auth/verify-password": true,
	"GET /api/permissions/me":        true,
	"GET /api/users/me":              true,
	"GET /api/settings":              true,
}

// PermissionInjector 权限注入中间件
// 在 AuthMiddleware 后执行，验证用户状态和 Token 版本，计算用户权限并存入上下文
func PermissionInjector(db *gorm.DB, permService *service.PermissionService) gin.HandlerFunc {
	return func(c *gin.Context) {
		userId, exists := c.Get("userId")
		if !exists {
			c.Next()
			return
		}

		userIdStr, ok := userId.(string)
		if !ok || userIdStr == "" {
			c.Next()
			return
		}

		// 获取 Token 中的版本号（从 AuthMiddleware 传递）
		tokenVersionFromClaim, _ := c.Get("tokenVersion")
		tokenVersion, _ := tokenVersionFromClaim.(int)

		// 获取用户信息
		var user model.User
		if err := db.Where("id = ?", userIdStr).First(&user).Error; err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"message": "用户不存在"})
			c.Abort()
			return
		}

		// 检查用户是否被禁用
		if user.IsDisabled {
			c.JSON(http.StatusForbidden, gin.H{"message": "账户已被禁用"})
			c.Abort()
			return
		}

		// 校验 Token 版本号（禁用/改密后旧 Token 失效）
		// tokenVersion == 0 表示旧 Token（无版本号），严格模式下拒绝
		if tokenVersion == 0 || tokenVersion != user.TokenVersion {
			c.JSON(http.StatusUnauthorized, gin.H{"message": "凭证已失效，请重新登录"})
			c.Abort()
			return
		}

		// 使用初始密码 / 重置后的密码 / 临时密码登录的账号，修改密码前只能访问少量接口
		if user.MustChangePassword {
			key := c.Request.Method + " " + strings.TrimSuffix(c.Request.URL.Path, "/")
			if !passwordChangeAllowedPaths[key] {
				c.JSON(http.StatusForbidden, gin.H{
					"message": "请先修改初始密码后再继续使用系统",
					"code":    "PASSWORD_CHANGE_REQUIRED",
				})
				c.Abort()
				return
			}
		}

		// 计算用户权限（使用缓存）
		permissions, err := permService.ComputeUserPermissions(&user)
		if err != nil {
			permissions = []string{}
		}

		// 注入权限与最新用户信息到上下文
		c.Set("permissions", permissions)
		c.Set("fullName", user.FullName)
		// 覆盖 role，避免使用过期 Token 内的角色信息
		c.Set("role", user.Role)

		c.Next()
	}
}

// RequirePermission 权限校验中间件
// 检查用户是否拥有所需的权限码（任一匹配即可）
func RequirePermission(requiredCodes ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		permissions, exists := c.Get("permissions")
		if !exists {
			c.JSON(http.StatusForbidden, gin.H{"message": "Forbidden: 权限信息缺失"})
			c.Abort()
			return
		}

		permList, ok := permissions.([]string)
		if !ok {
			c.JSON(http.StatusForbidden, gin.H{"message": "Forbidden: 权限格式错误"})
			c.Abort()
			return
		}

		// 构建权限集合用于快速查找
		permSet := make(map[string]bool)
		for _, p := range permList {
			permSet[p] = true
		}

		// 检查是否拥有任一所需权限
		for _, required := range requiredCodes {
			if permSet[required] {
				c.Next()
				return
			}
		}

		// 记录未授权访问尝试
		logUnauthorizedAccess(c, "permission", requiredCodes)

		c.JSON(http.StatusForbidden, gin.H{"message": "Forbidden: 权限不足"})
		c.Abort()
	}
}

// RequireRole 角色校验中间件
// 检查用户是否拥有所需的角色（任一匹配即可）
func RequireRole(allowedRoles ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		role, exists := c.Get("role")
		if !exists {
			c.JSON(http.StatusForbidden, gin.H{"message": "Forbidden: 角色信息缺失"})
			c.Abort()
			return
		}

		roleStr, ok := role.(string)
		if !ok {
			c.JSON(http.StatusForbidden, gin.H{"message": "Forbidden: 角色格式错误"})
			c.Abort()
			return
		}

		// 检查用户角色是否在允许列表中
		for _, allowed := range allowedRoles {
			if roleStr == allowed {
				c.Next()
				return
			}
		}

		// 记录未授权访问尝试
		logUnauthorizedAccess(c, "role", allowedRoles)

		c.JSON(http.StatusForbidden, gin.H{"message": "Forbidden: 角色权限不足"})
		c.Abort()
	}
}

// logUnauthorizedAccess 记录未授权访问尝试到审计日志
func logUnauthorizedAccess(c *gin.Context, checkType string, required []string) {
	userId, _ := c.Get("userId")
	operatorName, _ := c.Get("fullName")

	service.LogAudit(service.AuditLogParams{
		Action:       "UNAUTHORIZED_ACCESS",
		Module:       "AUTH",
		Description:  "未授权访问尝试: " + c.Request.Method + " " + c.Request.URL.Path,
		NewValue:     map[string]interface{}{"checkType": checkType, "required": required},
		OperatorID:   stringOrEmpty(userId),
		OperatorName: stringOrEmpty(operatorName),
		IPAddress:    c.ClientIP(),
	})
}

// stringOrEmpty 安全转换 interface{} 为 string
func stringOrEmpty(v interface{}) string {
	if v == nil {
		return ""
	}
	if s, ok := v.(string); ok {
		return s
	}
	return ""
}

// CheckPermissionInController 控制器内权限校验辅助函数
// 用于控制器内的二次校验（纵深防御）
func CheckPermissionInController(c *gin.Context, requiredCodes ...string) bool {
	permissions, exists := c.Get("permissions")
	if !exists {
		return false
	}

	permList, ok := permissions.([]string)
	if !ok {
		return false
	}

	permSet := make(map[string]bool)
	for _, p := range permList {
		permSet[p] = true
	}

	for _, required := range requiredCodes {
		if permSet[required] {
			return true
		}
	}
	return false
}

// CheckRoleInController 控制器内角色校验辅助函数
// 用于控制器内的二次校验（纵深防御）
func CheckRoleInController(c *gin.Context, allowedRoles ...string) bool {
	role, exists := c.Get("role")
	if !exists {
		return false
	}

	roleStr, ok := role.(string)
	if !ok {
		return false
	}

	for _, allowed := range allowedRoles {
		if roleStr == allowed {
			return true
		}
	}
	return false
}
