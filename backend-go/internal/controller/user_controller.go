package controller

import (
	"errors"
	"fmt"
	"log"
	"net/http"
	"regexp"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/my-project/backend-go/internal/middleware"
	"github.com/my-project/backend-go/internal/model"
	"github.com/my-project/backend-go/internal/service"
	"gorm.io/gorm"
)

type UserController struct {
	service service.UserService
}

func NewUserController(service service.UserService) *UserController {
	return &UserController{service: service}
}

// createUserResponse 保持原有用户字段平铺返回，并附带一次性初始密码。
type createUserResponse struct {
	*model.User
	InitialPassword string `json:"initialPassword"`
}

// operatorFromContext 读取 AuthMiddleware / PermissionInjector 注入的当前操作者信息。
func operatorFromContext(c *gin.Context) service.OperatorContext {
	op := service.OperatorContext{}
	if userID, ok := c.Get("userId"); ok {
		op.UserID, _ = userID.(string)
	}
	if permissions, ok := c.Get("permissions"); ok {
		op.Permissions, _ = permissions.([]string)
	}
	return op
}

// respondUserError 把服务层错误映射为 404/403/400，数据库原始报错不直接返回给前端。
func respondUserError(c *gin.Context, err error) {
	var forbidden *service.ForbiddenError
	switch {
	case errors.Is(err, service.ErrUserNotFound), errors.Is(err, gorm.ErrRecordNotFound):
		c.JSON(http.StatusNotFound, gin.H{"message": "用户不存在"})
	case errors.As(err, &forbidden):
		c.JSON(http.StatusForbidden, gin.H{"message": forbidden.Error()})
	case isDatabaseError(err):
		log.Printf("user operation failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"message": "操作失败，请稍后重试"})
	default:
		c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
	}
}

var databaseErrorPattern = regexp.MustCompile(`^Error \d+ \(\w+\)|SQL logic error|constraint failed`)

// isDatabaseError 识别驱动层错误（如 "Error 1452 (23000): ..."），避免把 SQL 细节暴露给前端。
func isDatabaseError(err error) bool {
	return databaseErrorPattern.MatchString(err.Error())
}

func (ctrl *UserController) GetMe(c *gin.Context) {
	userId, exists := c.Get("userId")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"message": "Unauthorized"})
		return
	}

	user, err := ctrl.service.GetCurrentUser(userId.(string))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"message": "User not found"})
		return
	}

	c.JSON(http.StatusOK, user)
}

func (ctrl *UserController) UpdateMe(c *gin.Context) {
	userId, _ := c.Get("userId")
	userIdStr := userId.(string)

	// 个人资料只允许修改联系方式；部门、用户类型属于身份信息，只能由管理员修改
	var req struct {
		Phone *string `json:"phone"`
		Email *string `json:"email"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "参数错误"})
		return
	}

	if err := ctrl.service.UpdateUser(userIdStr, service.UpdateUserRequest{
		Phone: req.Phone,
		Email: req.Email,
	}); err != nil {
		respondUserError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "更新成功"})
}

func (ctrl *UserController) GetUsers(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "10"))

	// 解析过滤参数
	filters := make(map[string]interface{})
	if search := c.Query("search"); search != "" {
		filters["search"] = search
	}
	if dept := c.Query("department"); dept != "" {
		filters["department"] = dept
	}
	if userTypes := c.QueryArray("userType"); len(userTypes) > 0 {
		filters["userType"] = userTypes
	}
	if isDisabledStrs := c.QueryArray("isDisabled"); len(isDisabledStrs) > 0 {
		var isDisabledList []bool
		for _, s := range isDisabledStrs {
			if b, err := strconv.ParseBool(s); err == nil {
				isDisabledList = append(isDisabledList, b)
			}
		}
		if len(isDisabledList) > 0 {
			filters["isDisabled"] = isDisabledList
		}
	}
	if sortField := c.Query("sortField"); sortField != "" {
		filters["sortField"] = sortField
	}
	if sortOrder := c.Query("sortOrder"); sortOrder != "" {
		filters["sortOrder"] = sortOrder
	}

	users, total, err := ctrl.service.GetUsers(page, pageSize, filters)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}

	// 格式化用户数据，添加角色名称
	items := make([]gin.H, 0, len(users))
	for _, u := range users {
		primaryRole := normalizeRoleEntity(model.RoleEntity{Code: u.Role, Name: u.Role})
		roleName := primaryRole.Name

		// 构建角色数组：包含关联的 Roles + 默认角色
		roles := make([]gin.H, 0)
		for _, r := range u.Roles {
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
		// 如果没有关联角色，使用用户的 role 字段（并添加默认角色 ID）
		if len(roles) == 0 {
			roles = append(roles, gin.H{
				"id":          primaryRole.ID,
				"code":        primaryRole.Code,
				"name":        roleName,
				"typeCode":    primaryRole.TypeCode,
				"description": primaryRole.Description,
				"isSystem":    primaryRole.IsSystem,
				"sort":        primaryRole.Sort,
				"status":      primaryRole.Status,
				"createdAt":   primaryRole.CreatedAt,
				"updatedAt":   primaryRole.UpdatedAt,
			})
		}

		items = append(items, gin.H{
			"id":         u.ID,
			"username":   u.Username,
			"fullName":   u.FullName,
			"email":      u.Email,
			"phone":      u.Phone,
			"department": u.Department,
			"userType":   u.UserType,
			"isDisabled": u.IsDisabled,
			"role":       u.Role,
			"roleName":   roleName,
			"roles":      roles,
			"createdAt":  u.CreatedAt,
		})
	}

	// 前端期望 { items: [...], total: number } 格式
	c.JSON(http.StatusOK, gin.H{
		"items": items,
		"total": total,
	})
}

// GetExecutors 获取可执行任务的用户列表（管理员、辅导员、学生干部）
func (ctrl *UserController) GetExecutors(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))
	keyword := c.Query("keyword")
	role := c.Query("role")

	// 限制 pageSize
	if pageSize > 100 {
		pageSize = 100
	}
	if pageSize <= 0 {
		pageSize = 20
	}
	if page <= 0 {
		page = 1
	}

	users, total, err := ctrl.service.GetExecutors(page, pageSize, keyword, role)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"users":    users,
		"total":    total,
		"page":     page,
		"pageSize": pageSize,
	})
}

// CreateUser 创建新用户
func (ctrl *UserController) CreateUser(c *gin.Context) {
	// 二次权限校验（纵深防御）
	if !middleware.CheckPermissionInController(c, "USER_MANAGE") {
		c.JSON(http.StatusForbidden, gin.H{"message": "Forbidden: 权限不足"})
		return
	}

	var req service.CreateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "参数错误"})
		return
	}

	if err := ctrl.service.AuthorizeUserCreate(operatorFromContext(c), req); err != nil {
		respondUserError(c, err)
		return
	}

	user, initialPassword, err := ctrl.service.CreateUser(req)
	if err != nil {
		respondUserError(c, err)
		return
	}

	// 记录审计日志
	operatorID, _ := c.Get("userId")
	operatorName, _ := c.Get("fullName")
	ipAddress := c.ClientIP()
	service.LogAudit(service.AuditLogParams{
		Action:       service.AuditActionCreate,
		Module:       service.AuditModuleUser,
		TargetID:     user.ID,
		TargetName:   user.Username,
		Description:  fmt.Sprintf("创建用户 %s (%s)", user.FullName, user.Username),
		NewValue:     map[string]interface{}{"username": user.Username, "fullName": user.FullName, "role": user.Role},
		OperatorID:   fmt.Sprintf("%v", operatorID),
		OperatorName: fmt.Sprintf("%v", operatorName),
		IPAddress:    ipAddress,
	})

	// 初始密码只在本次响应中返回一次，由管理员转交给用户
	c.JSON(http.StatusOK, createUserResponse{User: user, InitialPassword: initialPassword})
}

// UpdateUser 更新用户信息
func (ctrl *UserController) UpdateUser(c *gin.Context) {
	// 二次权限校验（纵深防御）
	if !middleware.CheckPermissionInController(c, "USER_MANAGE") {
		c.JSON(http.StatusForbidden, gin.H{"message": "Forbidden: 权限不足"})
		return
	}

	id := c.Param("id")
	var req service.UpdateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "参数错误"})
		return
	}

	if err := ctrl.service.AuthorizeUserUpdate(operatorFromContext(c), id, req); err != nil {
		respondUserError(c, err)
		return
	}
	if err := ctrl.service.UpdateUser(id, req); err != nil {
		respondUserError(c, err)
		return
	}

	// 查询用户信息用于审计日志
	targetName := ""
	if user, err := ctrl.service.GetCurrentUser(id); err == nil && user != nil {
		targetName = user.FullName
		if targetName == "" {
			targetName = user.Username
		}
	}

	// 记录审计日志
	operatorID, _ := c.Get("userId")
	operatorName, _ := c.Get("fullName")
	ipAddress := c.ClientIP()

	// 判断是启用/禁用操作还是普通更新
	action := service.AuditActionUpdate
	description := "更新用户信息"
	if req.IsDisabled != nil {
		if *req.IsDisabled {
			action = service.AuditActionDisable
			description = fmt.Sprintf("禁用用户 %s", targetName)
		} else {
			action = service.AuditActionEnable
			description = fmt.Sprintf("启用用户 %s", targetName)
		}
	}
	service.LogAudit(service.AuditLogParams{
		Action:       action,
		Module:       service.AuditModuleUser,
		TargetID:     id,
		TargetName:   targetName,
		Description:  description,
		NewValue:     req,
		OperatorID:   fmt.Sprintf("%v", operatorID),
		OperatorName: fmt.Sprintf("%v", operatorName),
		IPAddress:    ipAddress,
	})

	c.JSON(http.StatusOK, gin.H{"message": "更新成功"})
}

// DeleteUsers 批量删除用户
func (ctrl *UserController) DeleteUsers(c *gin.Context) {
	// 二次权限校验（纵深防御）
	if !middleware.CheckPermissionInController(c, "USER_MANAGE") {
		c.JSON(http.StatusForbidden, gin.H{"message": "Forbidden: 权限不足"})
		return
	}

	var req struct {
		Ids []string `json:"ids"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "参数错误"})
		return
	}

	currentUserId, _ := c.Get("userId")
	if err := ctrl.service.AuthorizeUserDelete(operatorFromContext(c), req.Ids); err != nil {
		respondUserError(c, err)
		return
	}
	if err := ctrl.service.DeleteUsers(req.Ids, currentUserId.(string)); err != nil {
		respondUserError(c, err)
		return
	}

	// 记录审计日志
	operatorName, _ := c.Get("fullName")
	ipAddress := c.ClientIP()
	service.LogAudit(service.AuditLogParams{
		Action:       service.AuditActionDelete,
		Module:       service.AuditModuleUser,
		Description:  fmt.Sprintf("批量删除 %d 个用户", len(req.Ids)),
		NewValue:     map[string]interface{}{"deletedIds": req.Ids, "count": len(req.Ids)},
		OperatorID:   currentUserId.(string),
		OperatorName: fmt.Sprintf("%v", operatorName),
		IPAddress:    ipAddress,
	})

	c.JSON(http.StatusOK, gin.H{"message": "批量删除成功", "count": len(req.Ids)})
}

// ResetPassword 重置用户密码为初始密码
func (ctrl *UserController) ResetPassword(c *gin.Context) {
	// 二次权限校验（纵深防御）
	if !middleware.CheckPermissionInController(c, "USER_MANAGE") {
		c.JSON(http.StatusForbidden, gin.H{"message": "Forbidden: 权限不足"})
		return
	}

	id := c.Param("id")

	if err := ctrl.service.AuthorizeCredentialReset(operatorFromContext(c), id); err != nil {
		respondUserError(c, err)
		return
	}
	newPassword, err := ctrl.service.ResetPassword(id)
	if err != nil {
		respondUserError(c, err)
		return
	}

	// 记录审计日志
	operatorID, _ := c.Get("userId")
	operatorName, _ := c.Get("fullName")
	ipAddress := c.ClientIP()
	service.LogAudit(service.AuditLogParams{
		Action:       service.AuditActionPasswordReset,
		Module:       service.AuditModuleUser,
		TargetID:     id,
		Description:  "重置用户密码",
		OperatorID:   fmt.Sprintf("%v", operatorID),
		OperatorName: fmt.Sprintf("%v", operatorName),
		IPAddress:    ipAddress,
	})

	c.JSON(http.StatusOK, gin.H{
		"message":     "密码已重置，用户下次登录时需修改密码",
		"newPassword": newPassword,
	})
}

// GenerateTemporaryPassword 生成临时密码
func (ctrl *UserController) GenerateTemporaryPassword(c *gin.Context) {
	// 二次权限校验（纵深防御）
	if !middleware.CheckPermissionInController(c, "USER_MANAGE") {
		c.JSON(http.StatusForbidden, gin.H{"message": "Forbidden: 权限不足"})
		return
	}

	id := c.Param("id")

	if err := ctrl.service.AuthorizeCredentialReset(operatorFromContext(c), id); err != nil {
		respondUserError(c, err)
		return
	}
	tempPass, err := ctrl.service.GenerateTemporaryPassword(id)
	if err != nil {
		respondUserError(c, err)
		return
	}

	// 记录审计日志
	operatorID, _ := c.Get("userId")
	operatorName, _ := c.Get("fullName")
	ipAddress := c.ClientIP()
	service.LogAudit(service.AuditLogParams{
		Action:       service.AuditActionPasswordReset,
		Module:       service.AuditModuleUser,
		TargetID:     id,
		Description:  "生成12h时效临时密码",
		OperatorID:   fmt.Sprintf("%v", operatorID),
		OperatorName: fmt.Sprintf("%v", operatorName),
		IPAddress:    ipAddress,
	})

	c.JSON(http.StatusOK, gin.H{
		"temporaryPassword": tempPass,
		"expiresIn":         43200, // 12h
		"message":           "临时密码生成成功，有效期12h",
	})
}
