package controller

import (
	"fmt"
	"net/http"
	"regexp"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/my-project/backend-go/internal/model"
	"github.com/my-project/backend-go/internal/service"
	"gorm.io/gorm"
)

var roleCodePattern = regexp.MustCompile(`^[A-Z][A-Z0-9_]*$`)
var roleCodeWhitespacePattern = regexp.MustCompile(`\s`)

var roleDefaults = map[string]struct {
	Name     string
	TypeCode string
	IsSystem bool
	Sort     int
	Status   string
}{
	"ADMIN":     {Name: "管理员", TypeCode: "SYSTEM", IsSystem: true, Sort: 10, Status: "ACTIVE"},
	"COUNSELOR": {Name: "辅导员", TypeCode: "SYSTEM", IsSystem: true, Sort: 20, Status: "ACTIVE"},
	"LEADER":    {Name: "学生干部", TypeCode: "SYSTEM", IsSystem: true, Sort: 30, Status: "ACTIVE"},
	"STUDENT":   {Name: "学生", TypeCode: "SYSTEM", IsSystem: true, Sort: 40, Status: "ACTIVE"},
}

var roleTypeDefaults = map[string]struct {
	Name     string
	IsSystem bool
	Sort     int
	Status   string
}{
	"SYSTEM":   {Name: "系统角色", IsSystem: true, Sort: 10, Status: "ACTIVE"},
	"BUSINESS": {Name: "业务角色", IsSystem: true, Sort: 20, Status: "ACTIVE"},
	"CUSTOM":   {Name: "自定义角色", IsSystem: true, Sort: 30, Status: "ACTIVE"},
}

type roleMutationRequest struct {
	Name        string  `json:"name"`
	Code        string  `json:"code"`
	TypeCode    string  `json:"typeCode"`
	Description *string `json:"description"`
	Status      string  `json:"status"`
	Sort        *int    `json:"sort"`
}

type roleStatusRequest struct {
	Status string `json:"status"`
}

type roleTypeMutationRequest struct {
	Name        string  `json:"name"`
	Code        string  `json:"code"`
	Description *string `json:"description"`
	Status      string  `json:"status"`
	Sort        *int    `json:"sort"`
}

type roleTypeStatusRequest struct {
	Status string `json:"status"`
}

func normalizeRoleCode(code string) string {
	return strings.ToUpper(strings.TrimSpace(code))
}

func normalizeRoleStatus(status string) string {
	switch strings.ToUpper(strings.TrimSpace(status)) {
	case "INACTIVE":
		return "INACTIVE"
	default:
		return "ACTIVE"
	}
}

func normalizeRoleTypeCode(typeCode string, fallback string) string {
	next := strings.ToUpper(strings.TrimSpace(typeCode))
	if next == "" {
		if fallback != "" {
			return fallback
		}
		return "CUSTOM"
	}
	return next
}

func normalizeRoleEntity(role model.RoleEntity) model.RoleEntity {
	if meta, ok := roleDefaults[role.Code]; ok {
		if role.Name == "" {
			role.Name = meta.Name
		}
		if role.TypeCode == "" {
			role.TypeCode = meta.TypeCode
		}
		if role.Sort == 0 {
			role.Sort = meta.Sort
		}
		if role.Status == "" {
			role.Status = meta.Status
		}
		if !role.IsSystem {
			role.IsSystem = meta.IsSystem
		}
	} else {
		if role.TypeCode == "" {
			role.TypeCode = "CUSTOM"
		}
		if role.Status == "" {
			role.Status = "ACTIVE"
		}
		if role.Sort == 0 {
			role.Sort = 100
		}
	}
	return role
}

func normalizeRoleTypeEntity(roleType model.RoleType) model.RoleType {
	if meta, ok := roleTypeDefaults[roleType.Code]; ok {
		if roleType.Name == "" {
			roleType.Name = meta.Name
		}
		if roleType.Sort == 0 {
			roleType.Sort = meta.Sort
		}
		if roleType.Status == "" {
			roleType.Status = meta.Status
		}
		if !roleType.IsSystem {
			roleType.IsSystem = meta.IsSystem
		}
	} else {
		if roleType.Status == "" {
			roleType.Status = "ACTIVE"
		}
		if roleType.Sort == 0 {
			roleType.Sort = 100
		}
	}
	return roleType
}

func (c *RoleController) ensureRoleTypeCatalog() error {
	return service.EnsureRoleTypeCatalog(c.db)
}

func (c *RoleController) listRoleTypes() ([]model.RoleType, error) {
	if err := c.ensureRoleTypeCatalog(); err != nil {
		return nil, err
	}
	var roleTypes []model.RoleType
	if err := c.db.
		Order("isSystem DESC, sort ASC, createdAt ASC, name ASC").
		Find(&roleTypes).Error; err != nil {
		return nil, err
	}
	for index := range roleTypes {
		roleTypes[index] = normalizeRoleTypeEntity(roleTypes[index])
	}
	return roleTypes, nil
}

func (c *RoleController) findRoleTypeByID(roleTypeID string) (*model.RoleType, error) {
	if err := c.ensureRoleTypeCatalog(); err != nil {
		return nil, err
	}
	var roleType model.RoleType
	if err := c.db.First(&roleType, "id = ?", roleTypeID).Error; err != nil {
		return nil, err
	}
	roleType = normalizeRoleTypeEntity(roleType)
	return &roleType, nil
}

func (c *RoleController) findRoleTypeByCode(typeCode string) (*model.RoleType, error) {
	if err := c.ensureRoleTypeCatalog(); err != nil {
		return nil, err
	}
	var roleType model.RoleType
	if err := c.db.First(&roleType, "code = ?", strings.ToUpper(strings.TrimSpace(typeCode))).Error; err != nil {
		return nil, err
	}
	roleType = normalizeRoleTypeEntity(roleType)
	return &roleType, nil
}

func (c *RoleController) nextRoleTypeSort() (int, error) {
	var maxSort int
	if err := c.db.Model(&model.RoleType{}).Select("COALESCE(MAX(sort), 30)").Scan(&maxSort).Error; err != nil {
		return 100, err
	}
	return maxSort + 10, nil
}

func (c *RoleController) validateRoleTypeForRole(typeCode string, currentTypeCode string) (*model.RoleType, error) {
	nextTypeCode := normalizeRoleTypeCode(typeCode, currentTypeCode)
	roleType, err := c.findRoleTypeByCode(nextTypeCode)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, fmt.Errorf("角色类型不存在")
		}
		return nil, err
	}
	if strings.EqualFold(roleType.Status, "INACTIVE") && !strings.EqualFold(nextTypeCode, currentTypeCode) {
		return nil, fmt.Errorf("停用的角色类型不能再分配")
	}
	return roleType, nil
}

func (c *RoleController) attachRoleTypeNames(roles []model.RoleEntity) ([]model.RoleEntity, error) {
	roleTypes, err := c.listRoleTypes()
	if err != nil {
		return nil, err
	}
	roleTypeMap := make(map[string]model.RoleType, len(roleTypes))
	for _, roleType := range roleTypes {
		roleTypeMap[strings.ToUpper(strings.TrimSpace(roleType.Code))] = roleType
	}
	for index := range roles {
		typeCode := strings.ToUpper(strings.TrimSpace(roles[index].TypeCode))
		if roleType, ok := roleTypeMap[typeCode]; ok {
			roles[index].TypeName = roleType.Name
			roles[index].TypeCode = roleType.Code
		}
	}
	return roles, nil
}

func (c *RoleController) listRoles() ([]model.RoleEntity, error) {
	if err := c.ensureRoleTypeCatalog(); err != nil {
		return nil, err
	}
	var roles []model.RoleEntity
	if err := c.db.
		Order("isSystem DESC, sort ASC, createdAt ASC, name ASC").
		Find(&roles).Error; err != nil {
		return nil, err
	}
	for index := range roles {
		roles[index] = normalizeRoleEntity(roles[index])
	}
	return c.attachRoleTypeNames(roles)
}

func (c *RoleController) findRole(roleID string) (*model.RoleEntity, error) {
	var role model.RoleEntity
	if err := c.db.First(&role, "id = ?", roleID).Error; err != nil {
		return nil, err
	}
	role = normalizeRoleEntity(role)
	return &role, nil
}

func (c *RoleController) nextRoleSort() (int, error) {
	var maxSort int
	if err := c.db.Model(&model.RoleEntity{}).Select("COALESCE(MAX(sort), 90)").Scan(&maxSort).Error; err != nil {
		return 100, err
	}
	return maxSort + 10, nil
}

func (c *RoleController) CreateRole(ctx *gin.Context) {
	var req roleMutationRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"message": "参数错误"})
		return
	}

	code := normalizeRoleCode(req.Code)
	if req.Name == "" || code == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"message": "角色名称和编码不能为空"})
		return
	}
	if roleCodeWhitespacePattern.MatchString(req.Code) {
		ctx.JSON(http.StatusBadRequest, gin.H{"message": "角色编码不能包含空格"})
		return
	}
	if !roleCodePattern.MatchString(code) {
		ctx.JSON(http.StatusBadRequest, gin.H{"message": "角色编码仅支持大写字母、数字和下划线，且必须以字母开头"})
		return
	}

	var existing int64
	if err := c.db.Model(&model.RoleEntity{}).Where("code = ?", code).Count(&existing).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}
	if existing > 0 {
		ctx.JSON(http.StatusBadRequest, gin.H{"message": "角色编码已存在"})
		return
	}
	roleType, err := c.validateRoleTypeForRole(req.TypeCode, "")
	if err != nil {
		statusCode := http.StatusInternalServerError
		if err == gorm.ErrRecordNotFound || strings.Contains(err.Error(), "角色类型") || strings.Contains(err.Error(), "停用") {
			statusCode = http.StatusBadRequest
		}
		ctx.JSON(statusCode, gin.H{"message": err.Error()})
		return
	}

	sortValue := 0
	if req.Sort != nil {
		sortValue = *req.Sort
	} else {
		nextSort, err := c.nextRoleSort()
		if err != nil {
			ctx.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
			return
		}
		sortValue = nextSort
	}

	role := model.RoleEntity{
		ID:          uuid.NewString(),
		Code:        code,
		Name:        strings.TrimSpace(req.Name),
		TypeCode:    roleType.Code,
		Description: req.Description,
		IsSystem:    false,
		Sort:        sortValue,
		Status:      normalizeRoleStatus(req.Status),
	}

	if err := c.db.Create(&role).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}

	operatorID, _ := ctx.Get("userId")
	operatorName, _ := ctx.Get("fullName")
	service.LogAudit(service.AuditLogParams{
		Action:       service.AuditActionCreate,
		Module:       service.AuditModuleRole,
		TargetID:     role.ID,
		TargetName:   role.Name,
		Description:  fmt.Sprintf("新增角色 %s (%s)", role.Name, role.Code),
		NewValue:     role,
		OperatorID:   fmt.Sprintf("%v", operatorID),
		OperatorName: fmt.Sprintf("%v", operatorName),
		IPAddress:    ctx.ClientIP(),
	})

	ctx.JSON(http.StatusOK, gin.H{"role": normalizeRoleEntity(role)})
}

func (c *RoleController) UpdateRole(ctx *gin.Context) {
	roleID := ctx.Param("id")
	role, err := c.findRole(roleID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			ctx.JSON(http.StatusNotFound, gin.H{"message": "角色不存在"})
			return
		}
		ctx.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}

	var req roleMutationRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"message": "参数错误"})
		return
	}

	if req.Code != "" && normalizeRoleCode(req.Code) != role.Code {
		if roleCodeWhitespacePattern.MatchString(req.Code) {
			ctx.JSON(http.StatusBadRequest, gin.H{"message": "角色编码不能包含空格"})
			return
		}
		ctx.JSON(http.StatusBadRequest, gin.H{"message": "角色编码创建后不可修改"})
		return
	}
	if role.IsSystem {
		if req.TypeCode != "" && normalizeRoleTypeCode(req.TypeCode, role.TypeCode) != role.TypeCode {
			ctx.JSON(http.StatusBadRequest, gin.H{"message": "系统内置角色类型不可修改"})
			return
		}
		if req.Status != "" && normalizeRoleStatus(req.Status) != "ACTIVE" {
			ctx.JSON(http.StatusBadRequest, gin.H{"message": "系统内置角色不可停用"})
			return
		}
	}
	roleType, err := c.validateRoleTypeForRole(req.TypeCode, role.TypeCode)
	if err != nil {
		statusCode := http.StatusInternalServerError
		if err == gorm.ErrRecordNotFound || strings.Contains(err.Error(), "角色类型") || strings.Contains(err.Error(), "停用") {
			statusCode = http.StatusBadRequest
		}
		ctx.JSON(statusCode, gin.H{"message": err.Error()})
		return
	}

	updates := map[string]interface{}{}
	if req.Name != "" {
		updates["name"] = strings.TrimSpace(req.Name)
	}
	if req.Description != nil {
		updates["description"] = req.Description
	}
	if req.TypeCode != "" {
		updates["typeCode"] = roleType.Code
	}
	if req.Sort != nil {
		updates["sort"] = *req.Sort
	}
	if req.Status != "" {
		updates["status"] = normalizeRoleStatus(req.Status)
	}

	if len(updates) == 0 {
		ctx.JSON(http.StatusOK, gin.H{"role": role})
		return
	}

	statusChanged := false
	var affectedUserIDs []string
	if nextStatus, ok := updates["status"].(string); ok && !strings.EqualFold(nextStatus, role.Status) {
		statusChanged = true
		affectedUserIDs, err = c.listAssignedUserIDs(role.ID, role.Code)
		if err != nil {
			ctx.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
			return
		}
	}

	if err := c.db.Model(&model.RoleEntity{}).Where("id = ?", roleID).Updates(updates).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}
	if statusChanged && c.permissionService != nil {
		c.permissionService.InvalidateCacheForUsers(affectedUserIDs...)
	}

	updatedRole, err := c.findRole(roleID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}

	operatorID, _ := ctx.Get("userId")
	operatorName, _ := ctx.Get("fullName")
	service.LogAudit(service.AuditLogParams{
		Action:       service.AuditActionUpdate,
		Module:       service.AuditModuleRole,
		TargetID:     updatedRole.ID,
		TargetName:   updatedRole.Name,
		Description:  fmt.Sprintf("更新角色 %s (%s)", updatedRole.Name, updatedRole.Code),
		NewValue:     updatedRole,
		OperatorID:   fmt.Sprintf("%v", operatorID),
		OperatorName: fmt.Sprintf("%v", operatorName),
		IPAddress:    ctx.ClientIP(),
	})

	ctx.JSON(http.StatusOK, gin.H{"role": updatedRole})
}

func (c *RoleController) DeleteRole(ctx *gin.Context) {
	roleID := ctx.Param("id")
	role, err := c.findRole(roleID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			ctx.JSON(http.StatusNotFound, gin.H{"message": "角色不存在"})
			return
		}
		ctx.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}
	if role.IsSystem {
		ctx.JSON(http.StatusBadRequest, gin.H{"message": "系统内置角色不可删除"})
		return
	}

	boundUsers, err := c.countRoleAssignments(role.ID, role.Code)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}
	if boundUsers > 0 {
		ctx.JSON(http.StatusBadRequest, gin.H{"message": "角色已分配给用户，无法删除"})
		return
	}

	if err := c.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("roleId = ?", roleID).Delete(&model.RolePermission{}).Error; err != nil {
			return err
		}
		if err := tx.Where("roleId = ?", roleID).Delete(&model.RoleDataScope{}).Error; err != nil {
			return err
		}
		return tx.Delete(&model.RoleEntity{}, "id = ?", roleID).Error
	}); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}

	operatorID, _ := ctx.Get("userId")
	operatorName, _ := ctx.Get("fullName")
	service.LogAudit(service.AuditLogParams{
		Action:       service.AuditActionDelete,
		Module:       service.AuditModuleRole,
		TargetID:     role.ID,
		TargetName:   role.Name,
		Description:  fmt.Sprintf("删除角色 %s (%s)", role.Name, role.Code),
		OldValue:     role,
		OperatorID:   fmt.Sprintf("%v", operatorID),
		OperatorName: fmt.Sprintf("%v", operatorName),
		IPAddress:    ctx.ClientIP(),
	})

	ctx.JSON(http.StatusOK, gin.H{"success": true})
}

func (c *RoleController) countRoleAssignments(roleID string, roleCode string) (int64, error) {
	var linkedUsers int64
	if err := c.db.Table("_roleentitytouser").Where("A = ?", roleID).Count(&linkedUsers).Error; err != nil {
		return 0, err
	}

	var primaryUsers int64
	if err := c.db.Model(&model.User{}).Where("role = ?", roleCode).Count(&primaryUsers).Error; err != nil {
		return 0, err
	}

	return linkedUsers + primaryUsers, nil
}

func (c *RoleController) listAssignedUserIDs(roleID string, roleCode string) ([]string, error) {
	if c.permissionService != nil {
		return c.permissionService.FindUsersAffectedByRole(roleID, roleCode)
	}
	return []string{}, nil
}

func (c *RoleController) UpdateRoleStatus(ctx *gin.Context) {
	roleID := ctx.Param("id")
	role, err := c.findRole(roleID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			ctx.JSON(http.StatusNotFound, gin.H{"message": "角色不存在"})
			return
		}
		ctx.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}

	var req roleStatusRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"message": "参数错误"})
		return
	}
	status := normalizeRoleStatus(req.Status)
	if role.IsSystem && status != "ACTIVE" {
		ctx.JSON(http.StatusBadRequest, gin.H{"message": "系统内置角色不可停用"})
		return
	}
	if strings.EqualFold(role.Status, status) {
		ctx.JSON(http.StatusOK, gin.H{"success": true})
		return
	}

	affectedUserIDs, err := c.listAssignedUserIDs(role.ID, role.Code)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}

	if err := c.db.Model(&model.RoleEntity{}).Where("id = ?", roleID).Update("status", status).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}

	if c.permissionService != nil {
		c.permissionService.InvalidateCacheForUsers(affectedUserIDs...)
	}

	action := service.AuditActionEnable
	if status == "INACTIVE" {
		action = service.AuditActionDisable
	}
	operatorID, _ := ctx.Get("userId")
	operatorName, _ := ctx.Get("fullName")
	service.LogAudit(service.AuditLogParams{
		Action:       action,
		Module:       service.AuditModuleRole,
		TargetID:     role.ID,
		TargetName:   role.Name,
		Description:  fmt.Sprintf("更新角色状态 %s (%s) -> %s", role.Name, role.Code, status),
		OldValue:     map[string]string{"id": role.ID, "code": role.Code, "name": role.Name, "status": role.Status},
		NewValue:     map[string]string{"id": role.ID, "code": role.Code, "name": role.Name, "status": status},
		OperatorID:   fmt.Sprintf("%v", operatorID),
		OperatorName: fmt.Sprintf("%v", operatorName),
		IPAddress:    ctx.ClientIP(),
	})

	ctx.JSON(http.StatusOK, gin.H{"success": true})
}

func (c *RoleController) GetRoleTypes(ctx *gin.Context) {
	roleTypes, err := c.listRoleTypes()
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"roleTypes": roleTypes})
}

func (c *RoleController) CreateRoleType(ctx *gin.Context) {
	var req roleTypeMutationRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"message": "参数错误"})
		return
	}

	code := normalizeRoleCode(req.Code)
	if strings.TrimSpace(req.Name) == "" || code == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"message": "角色类型名称和编码不能为空"})
		return
	}
	if roleCodeWhitespacePattern.MatchString(req.Code) {
		ctx.JSON(http.StatusBadRequest, gin.H{"message": "角色类型编码不能包含空格"})
		return
	}
	if !roleCodePattern.MatchString(code) {
		ctx.JSON(http.StatusBadRequest, gin.H{"message": "角色类型编码仅支持大写字母、数字和下划线，且必须以字母开头"})
		return
	}

	if err := c.ensureRoleTypeCatalog(); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}

	var existing int64
	if err := c.db.Model(&model.RoleType{}).Where("code = ?", code).Count(&existing).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}
	if existing > 0 {
		ctx.JSON(http.StatusBadRequest, gin.H{"message": "角色类型编码已存在"})
		return
	}

	sortValue := 0
	if req.Sort != nil {
		sortValue = *req.Sort
	} else {
		nextSort, err := c.nextRoleTypeSort()
		if err != nil {
			ctx.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
			return
		}
		sortValue = nextSort
	}

	roleType := normalizeRoleTypeEntity(model.RoleType{
		ID:          uuid.NewString(),
		Code:        code,
		Name:        strings.TrimSpace(req.Name),
		Description: req.Description,
		IsSystem:    false,
		Sort:        sortValue,
		Status:      normalizeRoleStatus(req.Status),
	})
	if err := c.db.Create(&roleType).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}

	operatorID, _ := ctx.Get("userId")
	operatorName, _ := ctx.Get("fullName")
	service.LogAudit(service.AuditLogParams{
		Action:       service.AuditActionCreate,
		Module:       service.AuditModuleRole,
		TargetID:     roleType.ID,
		TargetName:   roleType.Name,
		Description:  fmt.Sprintf("新增角色类型 %s (%s)", roleType.Name, roleType.Code),
		NewValue:     roleType,
		OperatorID:   fmt.Sprintf("%v", operatorID),
		OperatorName: fmt.Sprintf("%v", operatorName),
		IPAddress:    ctx.ClientIP(),
	})

	ctx.JSON(http.StatusOK, gin.H{"roleType": roleType})
}

func (c *RoleController) UpdateRoleType(ctx *gin.Context) {
	roleTypeID := ctx.Param("id")
	roleType, err := c.findRoleTypeByID(roleTypeID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			ctx.JSON(http.StatusNotFound, gin.H{"message": "角色类型不存在"})
			return
		}
		ctx.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}

	var req roleTypeMutationRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"message": "参数错误"})
		return
	}

	if req.Code != "" && normalizeRoleCode(req.Code) != roleType.Code {
		if roleCodeWhitespacePattern.MatchString(req.Code) {
			ctx.JSON(http.StatusBadRequest, gin.H{"message": "角色类型编码不能包含空格"})
			return
		}
		ctx.JSON(http.StatusBadRequest, gin.H{"message": "角色类型编码创建后不可修改"})
		return
	}
	if roleType.IsSystem && req.Status != "" && normalizeRoleStatus(req.Status) != "ACTIVE" {
		ctx.JSON(http.StatusBadRequest, gin.H{"message": "系统内置角色类型不可停用"})
		return
	}

	updates := map[string]interface{}{}
	if strings.TrimSpace(req.Name) != "" {
		updates["name"] = strings.TrimSpace(req.Name)
	}
	if req.Description != nil {
		updates["description"] = req.Description
	}
	if req.Sort != nil {
		updates["sort"] = *req.Sort
	}
	if req.Status != "" {
		updates["status"] = normalizeRoleStatus(req.Status)
	}
	if len(updates) == 0 {
		ctx.JSON(http.StatusOK, gin.H{"roleType": roleType})
		return
	}

	if err := c.db.Model(&model.RoleType{}).Where("id = ?", roleTypeID).Updates(updates).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}

	updatedRoleType, err := c.findRoleTypeByID(roleTypeID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}

	operatorID, _ := ctx.Get("userId")
	operatorName, _ := ctx.Get("fullName")
	service.LogAudit(service.AuditLogParams{
		Action:       service.AuditActionUpdate,
		Module:       service.AuditModuleRole,
		TargetID:     updatedRoleType.ID,
		TargetName:   updatedRoleType.Name,
		Description:  fmt.Sprintf("更新角色类型 %s (%s)", updatedRoleType.Name, updatedRoleType.Code),
		NewValue:     updatedRoleType,
		OperatorID:   fmt.Sprintf("%v", operatorID),
		OperatorName: fmt.Sprintf("%v", operatorName),
		IPAddress:    ctx.ClientIP(),
	})

	ctx.JSON(http.StatusOK, gin.H{"roleType": updatedRoleType})
}

func (c *RoleController) UpdateRoleTypeStatus(ctx *gin.Context) {
	roleTypeID := ctx.Param("id")
	roleType, err := c.findRoleTypeByID(roleTypeID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			ctx.JSON(http.StatusNotFound, gin.H{"message": "角色类型不存在"})
			return
		}
		ctx.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}

	var req roleTypeStatusRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"message": "参数错误"})
		return
	}

	status := normalizeRoleStatus(req.Status)
	if roleType.IsSystem && status != "ACTIVE" {
		ctx.JSON(http.StatusBadRequest, gin.H{"message": "系统内置角色类型不可停用"})
		return
	}
	if err := c.db.Model(&model.RoleType{}).Where("id = ?", roleTypeID).Update("status", status).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}

	operatorID, _ := ctx.Get("userId")
	operatorName, _ := ctx.Get("fullName")
	service.LogAudit(service.AuditLogParams{
		Action:       service.AuditActionUpdate,
		Module:       service.AuditModuleRole,
		TargetID:     roleType.ID,
		TargetName:   roleType.Name,
		Description:  fmt.Sprintf("更新角色类型状态 %s (%s) -> %s", roleType.Name, roleType.Code, status),
		NewValue:     map[string]string{"status": status},
		OperatorID:   fmt.Sprintf("%v", operatorID),
		OperatorName: fmt.Sprintf("%v", operatorName),
		IPAddress:    ctx.ClientIP(),
	})

	ctx.JSON(http.StatusOK, gin.H{"success": true})
}

func (c *RoleController) DeleteRoleType(ctx *gin.Context) {
	roleTypeID := ctx.Param("id")
	roleType, err := c.findRoleTypeByID(roleTypeID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			ctx.JSON(http.StatusNotFound, gin.H{"message": "角色类型不存在"})
			return
		}
		ctx.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}
	if roleType.IsSystem {
		ctx.JSON(http.StatusBadRequest, gin.H{"message": "系统内置角色类型不可删除"})
		return
	}

	var roleCount int64
	if err := c.db.Model(&model.RoleEntity{}).Where("typeCode = ?", roleType.Code).Count(&roleCount).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}
	if roleCount > 0 {
		ctx.JSON(http.StatusBadRequest, gin.H{"message": "角色类型已被角色引用，无法删除"})
		return
	}

	if err := c.db.Delete(&model.RoleType{}, "id = ?", roleTypeID).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}

	operatorID, _ := ctx.Get("userId")
	operatorName, _ := ctx.Get("fullName")
	service.LogAudit(service.AuditLogParams{
		Action:       service.AuditActionDelete,
		Module:       service.AuditModuleRole,
		TargetID:     roleType.ID,
		TargetName:   roleType.Name,
		Description:  fmt.Sprintf("删除角色类型 %s (%s)", roleType.Name, roleType.Code),
		OldValue:     roleType,
		OperatorID:   fmt.Sprintf("%v", operatorID),
		OperatorName: fmt.Sprintf("%v", operatorName),
		IPAddress:    ctx.ClientIP(),
	})

	ctx.JSON(http.StatusOK, gin.H{"success": true})
}
