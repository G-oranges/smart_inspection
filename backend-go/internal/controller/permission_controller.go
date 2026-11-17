package controller

import (
	"errors"
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/my-project/backend-go/internal/middleware"
	"github.com/my-project/backend-go/internal/service"
	"gorm.io/gorm"
)

type PermissionController struct {
	service *service.PermissionService
}

func NewPermissionController(s *service.PermissionService) *PermissionController {
	return &PermissionController{service: s}
}

// GetMyPermissions 获取当前用户的有效权限
func (ctrl *PermissionController) GetMyPermissions(c *gin.Context) {
	userId, _ := c.Get("userId")
	userIdStr, _ := userId.(string)

	user, err := ctrl.service.GetUserByID(userIdStr)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"permissions": []string{}})
		return
	}

	permissions, err := ctrl.service.ComputeUserPermissions(user)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"permissions": []string{}})
		return
	}

	c.JSON(http.StatusOK, gin.H{"permissions": permissions})
}

// GetRoleMatrix 获取角色权限矩阵
func (ctrl *PermissionController) GetRoleMatrix(c *gin.Context) {
	matrix, err := ctrl.service.GetRoleMatrix()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}
	c.JSON(http.StatusOK, matrix)
}

// UpdateRolePermissions 更新角色权限
func (ctrl *PermissionController) UpdateRolePermissions(c *gin.Context) {
	// 二次权限校验（纵深防御）
	if !middleware.CheckPermissionInController(c, "PERMISSION_MANAGE") {
		c.JSON(http.StatusForbidden, gin.H{"message": "Forbidden: 权限不足"})
		return
	}

	roleId := c.Param("roleId")
	var req struct {
		PermissionIds []string `json:"permissionIds"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "参数错误"})
		return
	}

	if err := ctrl.service.UpdateRolePermissions(roleId, req.PermissionIds); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}

	// 记录审计日志
	operatorID, _ := c.Get("userId")
	operatorName, _ := c.Get("fullName")
	service.LogAudit(service.AuditLogParams{
		Action:       service.AuditActionPermissionChange,
		Module:       service.AuditModuleRole,
		TargetID:     roleId,
		Description:  fmt.Sprintf("更新角色权限: 关联 %d 个权限", len(req.PermissionIds)),
		NewValue:     map[string]interface{}{"permissionCount": len(req.PermissionIds)},
		OperatorID:   fmt.Sprintf("%v", operatorID),
		OperatorName: fmt.Sprintf("%v", operatorName),
		IPAddress:    c.ClientIP(),
	})

	c.JSON(http.StatusOK, gin.H{"success": true})
}

// GetUserOverrides 获取账号单独授权
func (ctrl *PermissionController) GetUserOverrides(c *gin.Context) {
	userId := c.Param("userId")
	overrides, err := ctrl.service.GetUserOverrides(userId)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}

	// 前端期望的格式是 { overrides: [...] }
	c.JSON(http.StatusOK, gin.H{"overrides": overrides})
}

// UpdateUserOverrides 更新账号单独授权
func (ctrl *PermissionController) UpdateUserOverrides(c *gin.Context) {
	// 二次权限校验（纵深防御）
	if !middleware.CheckPermissionInController(c, "PERMISSION_MANAGE") {
		c.JSON(http.StatusForbidden, gin.H{"message": "Forbidden: 权限不足"})
		return
	}

	userId := c.Param("userId")
	var req struct {
		Overrides []service.UserOverrideReq `json:"overrides"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "参数错误"})
		return
	}

	if err := ctrl.service.UpdateUserOverrides(userId, req.Overrides); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}

	// 记录审计日志
	operatorID, _ := c.Get("userId")
	operatorName, _ := c.Get("fullName")
	service.LogAudit(service.AuditLogParams{
		Action:       service.AuditActionPermissionChange,
		Module:       service.AuditModulePermission,
		TargetID:     userId,
		Description:  fmt.Sprintf("更新账号权限覆盖: 共 %d 项", len(req.Overrides)),
		NewValue:     map[string]interface{}{"overrideCount": len(req.Overrides)},
		OperatorID:   fmt.Sprintf("%v", operatorID),
		OperatorName: fmt.Sprintf("%v", operatorName),
		IPAddress:    c.ClientIP(),
	})

	c.JSON(http.StatusOK, gin.H{"success": true})
}

// BatchUpdateUserOverrides 批量为多个用户设置权限覆盖
func (ctrl *PermissionController) BatchUpdateUserOverrides(c *gin.Context) {
	// 二次权限校验（纵深防御）
	if !middleware.CheckPermissionInController(c, "PERMISSION_MANAGE") {
		c.JSON(http.StatusForbidden, gin.H{"message": "Forbidden: 权限不足"})
		return
	}

	var req struct {
		UserIds   []string                  `json:"userIds"`
		Overrides []service.UserOverrideReq `json:"overrides"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "参数错误"})
		return
	}

	if err := ctrl.service.BatchUpdateUserOverrides(req.UserIds, req.Overrides); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}

	// 记录审计日志
	operatorID, _ := c.Get("userId")
	operatorName, _ := c.Get("fullName")
	service.LogAudit(service.AuditLogParams{
		Action:       service.AuditActionPermissionChange,
		Module:       service.AuditModulePermission,
		Description:  fmt.Sprintf("批量更新 %d 个账号的权限覆盖: 共 %d 项", len(req.UserIds), len(req.Overrides)),
		NewValue:     map[string]interface{}{"userCount": len(req.UserIds), "overrideCount": len(req.Overrides)},
		OperatorID:   fmt.Sprintf("%v", operatorID),
		OperatorName: fmt.Sprintf("%v", operatorName),
		IPAddress:    c.ClientIP(),
	})

	c.JSON(http.StatusOK, gin.H{
		"success":      true,
		"updatedCount": len(req.UserIds),
		"message":      fmt.Sprintf("已为 %d 个用户更新权限配置", len(req.UserIds)),
	})
}

// GetRoleDataScope 获取角色数据范围
func (ctrl *PermissionController) GetRoleDataScope(c *gin.Context) {
	roleId := c.Param("id")

	scope, err := ctrl.service.GetRoleDataScope(roleId)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"message": "角色不存在"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"dataScope": scope})
}

// SaveRoleDataScope 保存角色数据范围
func (ctrl *PermissionController) SaveRoleDataScope(c *gin.Context) {
	if !middleware.CheckPermissionInController(c, "PERMISSION_MANAGE") {
		c.JSON(http.StatusForbidden, gin.H{"message": "Forbidden: 权限不足"})
		return
	}

	roleId := c.Param("id")
	var req service.RoleDataScopePayload
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "参数错误"})
		return
	}

	operatorID, _ := c.Get("userId")
	scope, err := ctrl.service.SaveRoleDataScope(roleId, fmt.Sprintf("%v", operatorID), req)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"message": "角色不存在"})
			return
		}
		var validationErr *service.ValidationError
		if errors.As(err, &validationErr) {
			c.JSON(http.StatusBadRequest, gin.H{"message": validationErr.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}

	operatorName, _ := c.Get("fullName")
	service.LogAudit(service.AuditLogParams{
		Action:       service.AuditActionPermissionChange,
		Module:       service.AuditModuleRole,
		TargetID:     roleId,
		Description:  fmt.Sprintf("更新角色数据范围: mode=%s preset=%s", req.ScopeMode, req.PresetCode),
		NewValue:     map[string]interface{}{"scopeMode": req.ScopeMode, "presetCode": req.PresetCode},
		OperatorID:   fmt.Sprintf("%v", operatorID),
		OperatorName: fmt.Sprintf("%v", operatorName),
		IPAddress:    c.ClientIP(),
	})

	c.JSON(http.StatusOK, gin.H{"success": true, "dataScope": scope})
}
