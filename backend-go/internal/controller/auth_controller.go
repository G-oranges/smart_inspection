package controller

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/my-project/backend-go/internal/model"
	"github.com/my-project/backend-go/internal/service"
	"github.com/my-project/backend-go/pkg/utils"
	"gorm.io/gorm"
)

type AuthController struct {
	authService service.AuthService
	db          *gorm.DB
}

func NewAuthController(authService service.AuthService) *AuthController {
	return &AuthController{authService: authService}
}

// NewAuthControllerWithDB 创建带数据库连接的 AuthController（用于 GetMe 和 Logout）
func NewAuthControllerWithDB(authService service.AuthService, db *gorm.DB) *AuthController {
	return &AuthController{authService: authService, db: db}
}

type LoginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

type LoginResponse struct {
	Token        string      `json:"token"` // 保持向后兼容
	AccessToken  string      `json:"accessToken"`
	RefreshToken string      `json:"refreshToken,omitempty"`
	ExpiresIn    int         `json:"expiresIn"`
	User         interface{} `json:"user"`
}

func (ctrl *AuthController) Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "参数错误"})
		return
	}

	accessToken, refreshToken, user, isTempPwd, err := ctrl.authService.Login(req.Username, req.Password)
	if err != nil {
		// 记录登录失败审计日志
		service.LogAudit(service.AuditLogParams{
			Action:      service.AuditActionLoginFailed,
			Module:      service.AuditModuleAuth,
			TargetName:  req.Username,
			Description: fmt.Sprintf("登录失败：%s", err.Error()),
			IPAddress:   c.ClientIP(),
			UserAgent:   c.Request.UserAgent(),
		})
		c.JSON(http.StatusUnauthorized, gin.H{"message": err.Error()})
		return
	}

	// 记录登录成功审计日志
	service.LogAudit(service.AuditLogParams{
		Action:     service.AuditActionLogin,
		Module:     service.AuditModuleAuth,
		TargetID:   user.ID,
		TargetName: user.Username,
		Description: fmt.Sprintf("用户 %s (%s) 登录成功%s", user.FullName, user.Username, func() string {
			if isTempPwd {
				return "（使用临时密码）"
			}
			return ""
		}()),
		OperatorID:   user.ID,
		OperatorName: user.FullName,
		IPAddress:    c.ClientIP(),
		UserAgent:    c.Request.UserAgent(),
	})

	// 构造返回给前端的用户 DTO (过滤敏感字段)
	userDto := gin.H{
		"id":                  user.ID,
		"username":            user.Username,
		"fullName":            user.FullName,
		"role":                user.Role,
		"roles":               user.Roles,
		"isDisabled":          user.IsDisabled,
		"createdAt":           user.CreatedAt,
		"isTemporaryPassword": isTempPwd,
		"department":          user.Department,
		"userType":            user.UserType,
		"phone":               user.Phone,
		"email":               user.Email,
	}

	c.JSON(http.StatusOK, LoginResponse{
		Token:        accessToken,
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		ExpiresIn:    1800, // 30分钟
		User:         userDto,
	})
}

func (ctrl *AuthController) Refresh(c *gin.Context) {
	var req struct {
		RefreshToken string `json:"refreshToken" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "参数错误"})
		return
	}

	accessToken, refreshToken, err := ctrl.authService.RefreshToken(req.RefreshToken)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"message": "刷新令牌无效或已过期"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"token":        accessToken,
		"accessToken":  accessToken,
		"refreshToken": refreshToken, // 如果即将过期会返回新的
		"expiresIn":    1800,
	})
}

func (ctrl *AuthController) VerifyPassword(c *gin.Context) {
	var req struct {
		Password string `json:"password" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "参数错误"})
		return
	}

	userId, _ := c.Get("userId")
	userIdStr, _ := userId.(string)

	verifiedToken, err := ctrl.authService.VerifyPassword(userIdStr, req.Password)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":       true,
		"verifiedToken": verifiedToken,
		"expiresIn":     300,
		"message":       "密码验证成功",
	})
}

// GetMe 获取当前登录用户信息（从 router.go 的 authMe 闭包重构而来）
func (ctrl *AuthController) GetMe(c *gin.Context) {
	userId, _ := c.Get("userId")
	userIdStr, _ := userId.(string)

	// 查询用户
	var user model.User
	if err := ctrl.db.First(&user, "id = ?", userIdStr).Error; err != nil {
		role, _ := c.Get("role")
		// 回退到 mock 数据
		c.JSON(http.StatusOK, gin.H{
			"user": gin.H{
				"id":       userId,
				"username": "unknown",
				"role":     role,
				"roles":    []gin.H{{"code": role, "name": role}},
			},
		})
		return
	}

	// 获取用户的角色列表
	var linkedRoles []model.RoleEntity
	ctrl.db.Model(&model.RoleEntity{}).
		Joins("JOIN `_roleentitytouser` ON `_roleentitytouser`.`A` = `roleentity`.`id`").
		Where("`_roleentitytouser`.`B` = ?", user.ID).
		Find(&linkedRoles)

	roles := make([]gin.H, 0, len(linkedRoles))
	for _, r := range linkedRoles {
		normalized := normalizeRoleEntity(r)
		roles = append(roles, gin.H{
			"id":          normalized.ID,
			"code":        normalized.Code,
			"name":        normalized.Name,
			"typeCode":    normalized.TypeCode,
			"description": normalized.Description,
			"isSystem":    normalized.IsSystem,
			"sort":        normalized.Sort,
			"status":      normalized.Status,
			"createdAt":   normalized.CreatedAt,
			"updatedAt":   normalized.UpdatedAt,
		})
	}

	// 如果没有关联角色，使用用户的 role 字段
	if len(roles) == 0 {
		fallback := normalizeRoleEntity(model.RoleEntity{Code: user.Role, Name: user.Role})
		roles = append(roles, gin.H{
			"code":        fallback.Code,
			"name":        fallback.Name,
			"typeCode":    fallback.TypeCode,
			"description": fallback.Description,
			"isSystem":    fallback.IsSystem,
			"sort":        fallback.Sort,
			"status":      fallback.Status,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"user": gin.H{
			"id":         user.ID,
			"username":   user.Username,
			"fullName":   user.FullName,
			"role":       user.Role,
			"roles":      roles,
			"isDisabled": user.IsDisabled,
			"createdAt":  user.CreatedAt,
			"department": user.Department,
			"userType":   user.UserType,
			"phone":      user.Phone,
			"email":      user.Email,
		},
	})
}

// Logout 登出（支持分布式 Token 黑名单）
func (ctrl *AuthController) Logout(c *gin.Context) {
	userId, _ := c.Get("userId")
	userIdStr, _ := userId.(string)

	// 查询用户姓名用于审计日志
	var fullName string
	if ctrl.db != nil && userIdStr != "" {
		var user model.User
		if err := ctrl.db.Select("fullName").Where("id = ?", userIdStr).First(&user).Error; err == nil {
			fullName = user.FullName
		}
	}

	// 将 Token 加入黑名单
	authHeader := c.GetHeader("Authorization")
	if strings.HasPrefix(authHeader, "Bearer ") {
		token := strings.TrimPrefix(authHeader, "Bearer ")
		// 解析 Token 获取实际剩余过期时间
		if claims, err := utils.ParseToken(token); err == nil {
			ttl := time.Until(claims.ExpiresAt.Time)
			if ttl > 0 {
				// 使用 Token 实际剩余时间作为黑名单 TTL，避免浪费 Redis 存储
				utils.BlacklistToken(token, ttl)
			}
		} else {
			// 解析失败时使用默认 TTL
			utils.BlacklistToken(token, 30*time.Minute)
		}
	}

	service.LogAudit(service.AuditLogParams{
		Action:       service.AuditActionLogout,
		Module:       service.AuditModuleAuth,
		TargetID:     userIdStr,
		TargetName:   fullName,
		Description:  fmt.Sprintf("用户 %s 登出", fullName),
		OperatorID:   userIdStr,
		OperatorName: fullName,
		IPAddress:    c.ClientIP(),
		UserAgent:    c.Request.UserAgent(),
	})

	c.JSON(http.StatusOK, gin.H{"message": "success"})
}

// ChangePassword 修改密码
func (ctrl *AuthController) ChangePassword(c *gin.Context) {
	var req struct {
		OldPassword string `json:"oldPassword" binding:"required"`
		NewPassword string `json:"newPassword" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "参数错误"})
		return
	}

	userId, _ := c.Get("userId")
	userIdStr, _ := userId.(string)

	if err := ctrl.authService.ChangePassword(userIdStr, req.OldPassword, req.NewPassword); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
		return
	}

	// 记录审计日志
	fullName, _ := c.Get("fullName")
	ipAddress := c.ClientIP()
	service.LogAudit(service.AuditLogParams{
		Action:       service.AuditActionUpdate,
		Module:       service.AuditModuleAuth,
		TargetID:     userIdStr,
		TargetName:   fmt.Sprintf("%v", fullName),
		Description:  "用户自主修改密码",
		OperatorID:   userIdStr,
		OperatorName: fmt.Sprintf("%v", fullName),
		IPAddress:    ipAddress,
	})

	c.JSON(http.StatusOK, gin.H{"message": "密码修改成功"})
}

// CheckUserEmail 检查用户绑定的邮箱 - 返回部分隐藏的邮箱
func (ctrl *AuthController) CheckUserEmail(c *gin.Context) {
	var req struct {
		Username string `json:"username" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "请输入用户名"})
		return
	}

	maskedEmail, err := ctrl.authService.CheckUserEmail(req.Username)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":     true,
		"maskedEmail": maskedEmail,
		"message":     "请输入完整邮箱以确认身份",
	})
}

// ForgotPassword 忘记密码 - 验证用户名 and 邮箱匹配后发送验证码
func (ctrl *AuthController) ForgotPassword(c *gin.Context) {
	var req struct {
		Username string `json:"username" binding:"required"`
		Email    string `json:"email" binding:"required,email"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "请输入用户名和有效的邮箱地址"})
		return
	}

	err := ctrl.authService.ForgotPassword(req.Username, req.Email)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
		return
	}

	// 记录审计日志
	service.LogAudit(service.AuditLogParams{
		Action:      service.AuditActionUpdate,
		Module:      service.AuditModuleAuth,
		TargetName:  req.Username,
		Description: fmt.Sprintf("请求密码重置验证码: 用户 %s", req.Username),
		IPAddress:   c.ClientIP(),
		UserAgent:   c.Request.UserAgent(),
	})

	c.JSON(http.StatusOK, gin.H{
		"message": "验证码已发送到您的邮箱，请查收",
		"success": true,
	})
}

// ResetPassword 通过验证码重置密码
func (ctrl *AuthController) ResetPassword(c *gin.Context) {
	var req struct {
		Email       string `json:"email" binding:"required,email"`
		Code        string `json:"code" binding:"required,len=6"`
		NewPassword string `json:"newPassword" binding:"required,min=8"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "参数错误，请检查邮箱、验证码和新密码"})
		return
	}

	err := ctrl.authService.ResetPasswordByCode(req.Email, req.Code, req.NewPassword)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
		return
	}

	// 记录审计日志
	service.LogAudit(service.AuditLogParams{
		Action:      service.AuditActionUpdate,
		Module:      service.AuditModuleAuth,
		TargetName:  req.Email,
		Description: fmt.Sprintf("通过邮箱验证码重置密码成功: %s", req.Email),
		IPAddress:   c.ClientIP(),
		UserAgent:   c.Request.UserAgent(),
	})

	c.JSON(http.StatusOK, gin.H{
		"message": "密码重置成功，请使用新密码登录",
		"success": true,
	})
}
