package service

import (
	"context"
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/my-project/backend-go/internal/model"
	"github.com/my-project/backend-go/pkg/utils"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

type RoleDataScopeRules struct {
	Academic  map[string][]string `json:"academic"`
	Dormitory map[string][]string `json:"dormitory"`
}

type RoleDataScopePayload struct {
	ScopeMode  string             `json:"scopeMode"`
	PresetCode string             `json:"presetCode"`
	Rules      RoleDataScopeRules `json:"rules"`
}

type ValidationError struct {
	Message string
}

func (e *ValidationError) Error() string {
	return e.Message
}

func newValidationError(message string) error {
	return &ValidationError{Message: message}
}

// PermissionService 权限计算服务
type PermissionService struct {
	db *gorm.DB
	// 简单的内存缓存
	cache struct {
		userPerms map[string]userPermCacheItem
		mu        sync.RWMutex
	}
}

type userPermCacheItem struct {
	perms     []string
	updatedAt time.Time
}

const (
	permCacheTTL       = 10 * time.Minute
	permRedisKeyPrefix = "user_perms:"
)

const (
	roleDataScopeAll       = "ALL"
	roleDataScopeAcademic  = "ACADEMIC"
	roleDataScopeDormitory = "DORMITORY"
	roleDataScopeCustom    = "CUSTOM"
	roleDataScopeSelf      = "SELF"
	roleDataScopeOwn       = "OWN_COLLEGE"
)

var defaultRoleMeta = map[string]struct {
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

// NewPermissionService 创建新的权限服务
func NewPermissionService(db *gorm.DB) *PermissionService {
	s := &PermissionService{db: db}
	s.cache.userPerms = make(map[string]userPermCacheItem)
	return s
}

func normalizeRoleEntity(role model.RoleEntity) model.RoleEntity {
	if meta, ok := defaultRoleMeta[role.Code]; ok {
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

// ComputeUserPermissions 计算用户的有效权限列表
func (s *PermissionService) ComputeUserPermissions(user *model.User) ([]string, error) {
	if user == nil {
		return []string{}, nil
	}

	// 1. 尝试从内存缓存读取 (L1)
	s.cache.mu.RLock()
	if item, ok := s.cache.userPerms[user.ID]; ok && time.Since(item.updatedAt) < permCacheTTL {
		res := item.perms
		s.cache.mu.RUnlock()
		return res, nil
	}
	s.cache.mu.RUnlock()

	// 2. 尝试从 Redis 读取 (L2)
	redisKey := permRedisKeyPrefix + user.ID
	if cached, err := utils.GetCache(redisKey); err == nil {
		var res []string
		if err := json.Unmarshal([]byte(cached), &res); err == nil {
			// 回填 L1
			s.cache.mu.Lock()
			s.cache.userPerms[user.ID] = userPermCacheItem{
				perms:     res,
				updatedAt: time.Now(),
			}
			s.cache.mu.Unlock()
			return res, nil
		}
	}

	// 3. 收集用户的所有角色代码
	roleCodes := make(map[string]bool)
	if user.Role != "" {
		roleCodes[user.Role] = true
	}

	// 查询用户关联的角色实体
	var linkedRoles []model.RoleEntity
	if err := s.db.Model(&model.RoleEntity{}).
		Joins("JOIN `_roleentitytouser` ON `_roleentitytouser`.`A` = `roleentity`.`id`").
		Where("`_roleentitytouser`.`B` = ?", user.ID).
		Select("code").
		Find(&linkedRoles).Error; err != nil {
		return nil, err
	}

	for _, role := range linkedRoles {
		roleCodes[role.Code] = true
	}

	// 3. 获取这些角色拥有的权限
	roleCodeList := make([]string, 0, len(roleCodes))
	for code := range roleCodes {
		roleCodeList = append(roleCodeList, code)
	}

	type permResult struct {
		PermissionCode string `gorm:"column:permission_code"`
	}
	var rolePermissions []permResult
	if len(roleCodeList) > 0 {
		// 停用（INACTIVE）的角色不再提供任何权限
		if err := s.db.Table("rolepermission").
			Joins("JOIN `roleentity` ON `roleentity`.`id` = `rolepermission`.`roleId`").
			Joins("JOIN `permission` ON `permission`.`id` = `rolepermission`.`permissionId`").
			Where("`roleentity`.`code` IN ?", roleCodeList).
			Where("(`roleentity`.`status` IS NULL OR `roleentity`.`status` <> ?)", "INACTIVE").
			Select("`permission`.`code` AS permission_code").
			Scan(&rolePermissions).Error; err != nil {
			return nil, err
		}
	}

	permissionSet := make(map[string]bool)
	for _, rp := range rolePermissions {
		if rp.PermissionCode != "" {
			permissionSet[rp.PermissionCode] = true
		}
	}

	// 4. 应用用户权限覆盖
	type overrideResult struct {
		PermissionCode string `gorm:"column:permission_code"`
		Allow          bool   `gorm:"column:allow"`
	}
	var overrides []overrideResult
	if err := s.db.Table("userpermissionoverride").
		Joins("JOIN `permission` ON `permission`.`id` = `userpermissionoverride`.`permissionId`").
		Where("`userpermissionoverride`.`userId` = ?", user.ID).
		Select("`permission`.`code` AS permission_code, `userpermissionoverride`.`allow` AS allow").
		Scan(&overrides).Error; err != nil {
		return nil, err
	}

	for _, override := range overrides {
		if override.PermissionCode == "" {
			continue
		}
		if override.Allow {
			permissionSet[override.PermissionCode] = true
		} else {
			delete(permissionSet, override.PermissionCode)
		}
	}

	// 5. 转换为切片返回
	result := make([]string, 0, len(permissionSet))
	for code := range permissionSet {
		result = append(result, code)
	}

	// 6. 更新 L1
	s.cache.mu.Lock()
	s.cache.userPerms[user.ID] = userPermCacheItem{
		perms:     result,
		updatedAt: time.Now(),
	}
	s.cache.mu.Unlock()

	// 7. 更新 L2
	if data, err := json.Marshal(result); err == nil {
		utils.SetCache(redisKey, data, permCacheTTL)
	}

	return result, nil
}

func (s *PermissionService) InvalidateCache() {
	s.InvalidateCacheForUsers()
}

func (s *PermissionService) InvalidateCacheForUsers(userIDs ...string) {
	s.cache.mu.Lock()
	if len(userIDs) == 0 {
		s.cache.userPerms = make(map[string]userPermCacheItem)
	} else {
		for _, userID := range userIDs {
			if strings.TrimSpace(userID) == "" {
				continue
			}
			delete(s.cache.userPerms, userID)
		}
	}
	s.cache.mu.Unlock()

	s.invalidateRedisPermissionCache(userIDs...)
}

func (s *PermissionService) invalidateRedisPermissionCache(userIDs ...string) {
	if utils.RedisClient == nil {
		return
	}

	if len(userIDs) > 0 {
		keys := make([]string, 0, len(userIDs))
		seen := make(map[string]struct{}, len(userIDs))
		for _, userID := range userIDs {
			userID = strings.TrimSpace(userID)
			if userID == "" {
				continue
			}
			cacheKey := permRedisKeyPrefix + userID
			if _, ok := seen[cacheKey]; ok {
				continue
			}
			seen[cacheKey] = struct{}{}
			keys = append(keys, cacheKey)
		}
		if len(keys) > 0 {
			_ = utils.DelCache(keys...)
		}
		return
	}

	pattern := utils.GetRedisKey(permRedisKeyPrefix + "*")
	ctx := context.Background()
	var cursor uint64
	for {
		keys, nextCursor, err := utils.RedisClient.Scan(ctx, cursor, pattern, 200).Result()
		if err != nil {
			return
		}
		if len(keys) > 0 {
			_ = utils.RedisClient.Del(ctx, keys...).Err()
		}
		cursor = nextCursor
		if cursor == 0 {
			return
		}
	}
}

func (s *PermissionService) FindUsersAffectedByRole(roleID string, roleCode string) ([]string, error) {
	ids := make(map[string]struct{})

	var linkedUserIDs []string
	if err := s.db.Table("`user`").
		Distinct("`user`.`id`").
		Joins("JOIN `_roleentitytouser` ON `_roleentitytouser`.`B` = `user`.`id`").
		Where("`_roleentitytouser`.`A` = ?", roleID).
		Pluck("`user`.`id`", &linkedUserIDs).Error; err != nil {
		return nil, err
	}
	for _, userID := range linkedUserIDs {
		if strings.TrimSpace(userID) != "" {
			ids[userID] = struct{}{}
		}
	}

	var primaryUserIDs []string
	if err := s.db.Model(&model.User{}).
		Distinct("id").
		Where("role = ?", roleCode).
		Pluck("id", &primaryUserIDs).Error; err != nil {
		return nil, err
	}
	for _, userID := range primaryUserIDs {
		if strings.TrimSpace(userID) != "" {
			ids[userID] = struct{}{}
		}
	}

	result := make([]string, 0, len(ids))
	for userID := range ids {
		result = append(result, userID)
	}
	sort.Strings(result)
	return result, nil
}

// GetUserByID 根据 ID 获取用户
func (s *PermissionService) GetUserByID(userID string) (*model.User, error) {
	var user model.User
	if err := s.db.Where("id = ?", userID).First(&user).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

// GetRoleMatrix 获取角色权限矩阵
// 返回所有标准角色、权限和角色权限关联
func (s *PermissionService) GetRoleMatrix() (map[string]interface{}, error) {
	if err := EnsureRoleTypeCatalog(s.db); err != nil {
		return nil, err
	}
	var roles []model.RoleEntity
	if err := s.db.
		Order("isSystem DESC, sort ASC, createdAt ASC, name ASC").
		Find(&roles).Error; err != nil {
		return nil, err
	}
	for index := range roles {
		roles[index] = normalizeRoleEntity(roles[index])
	}
	var roleTypes []model.RoleType
	if err := s.db.Find(&roleTypes).Error; err != nil {
		return nil, err
	}
	roleTypeNames := make(map[string]string, len(roleTypes))
	for _, roleType := range roleTypes {
		roleTypeNames[strings.ToUpper(strings.TrimSpace(roleType.Code))] = roleType.Name
	}
	for index := range roles {
		if typeName, ok := roleTypeNames[strings.ToUpper(strings.TrimSpace(roles[index].TypeCode))]; ok {
			roles[index].TypeName = typeName
		}
	}

	// 获取所有权限
	var permissions []model.Permission
	if err := s.db.Find(&permissions).Error; err != nil {
		return nil, err
	}

	// 使用原生查询获取角色权限关联
	// 注意：GORM Scan 使用列名映射到结构体字段，需要确保列名和字段名匹配
	type RolePermissionResult struct {
		Id           string `gorm:"column:id" json:"id"`
		RoleId       string `gorm:"column:roleId" json:"roleId"`
		PermissionId string `gorm:"column:permissionId" json:"permissionId"`
	}
	var rolePermissions []RolePermissionResult

	if err := s.db.Table("rolepermission").
		Select("rolepermission.id as id, rolepermission.roleId as roleId, rolepermission.permissionId as permissionId").
		Joins("JOIN roleentity ON roleentity.id = rolepermission.roleId").
		Scan(&rolePermissions).Error; err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"roles":           roles,
		"permissions":     permissions,
		"rolePermissions": rolePermissions,
	}, nil
}

// UpdateRolePermissions 批量更新角色权限。
// 角色不存在时返回 gorm.ErrRecordNotFound；权限 ID 非法或会导致管理员失去权限配置能力时返回 ValidationError。
func (s *PermissionService) UpdateRolePermissions(roleID string, permissionIDs []string) error {
	role, err := s.ensureRoleExists(roleID)
	if err != nil {
		return err
	}
	permissionIDs = normalizeStringList(permissionIDs)
	permissionCodes, err := s.permissionCodesByIDs(permissionIDs)
	if err != nil {
		return err
	}
	if strings.EqualFold(role.Code, model.RoleAdmin) && !containsString(permissionCodes, "PERMISSION_MANAGE") {
		return newValidationError("不能移除管理员角色的「权限配置」权限，否则将无人能再管理权限")
	}

	affectedUserIDs, err := s.FindUsersAffectedByRole(role.ID, role.Code)
	if err != nil {
		return err
	}

	err = s.db.Transaction(func(tx *gorm.DB) error {
		// 1. 删除旧的关联
		if err := tx.Where("roleId = ?", roleID).Delete(&model.RolePermission{}).Error; err != nil {
			return err
		}

		// 2. 创建新的关联
		if len(permissionIDs) > 0 {
			rolePermissions := make([]model.RolePermission, 0, len(permissionIDs))
			for _, pID := range permissionIDs {
				rolePermissions = append(rolePermissions, model.RolePermission{
					ID:           uuid.New().String(),
					RoleID:       roleID,
					PermissionID: pID,
				})
			}
			if err := tx.Create(&rolePermissions).Error; err != nil {
				return err
			}
		}

		return nil
	})
	if err != nil {
		return err
	}
	// 事务提交后再清缓存，避免并发请求在提交前把旧权限重新写回缓存
	s.InvalidateCacheForUsers(affectedUserIDs...)
	return nil
}

// permissionCodesByIDs 校验权限 ID 全部存在，并返回对应的权限编码。
func (s *PermissionService) permissionCodesByIDs(permissionIDs []string) ([]string, error) {
	if len(permissionIDs) == 0 {
		return []string{}, nil
	}
	var permissions []model.Permission
	if err := s.db.Select("id", "code").Where("id IN ?", permissionIDs).Find(&permissions).Error; err != nil {
		return nil, err
	}
	if len(permissions) != len(permissionIDs) {
		return nil, newValidationError("包含不存在的权限，请刷新页面后重试")
	}
	codes := make([]string, 0, len(permissions))
	for _, permission := range permissions {
		codes = append(codes, permission.Code)
	}
	return codes, nil
}

// ensureUsersExist 校验所有用户 ID 都存在，否则返回 gorm.ErrRecordNotFound。
func (s *PermissionService) ensureUsersExist(userIDs []string) error {
	if len(userIDs) == 0 {
		return newValidationError("请选择至少一个用户")
	}
	var count int64
	if err := s.db.Model(&model.User{}).Where("id IN ?", userIDs).Count(&count).Error; err != nil {
		return err
	}
	if int(count) != len(userIDs) {
		return gorm.ErrRecordNotFound
	}
	return nil
}

// normalizeOverrides 去重（同一权限以最后一项为准）并校验权限 ID。
func (s *PermissionService) normalizeOverrides(overrides []UserOverrideReq) ([]UserOverrideReq, error) {
	byPermission := make(map[string]UserOverrideReq, len(overrides))
	order := make([]string, 0, len(overrides))
	for _, override := range overrides {
		permissionID := strings.TrimSpace(override.PermissionID)
		if permissionID == "" {
			continue
		}
		if _, exists := byPermission[permissionID]; !exists {
			order = append(order, permissionID)
		}
		override.PermissionID = permissionID
		byPermission[permissionID] = override
	}
	if _, err := s.permissionCodesByIDs(order); err != nil {
		return nil, err
	}
	result := make([]UserOverrideReq, 0, len(order))
	for _, permissionID := range order {
		result = append(result, byPermission[permissionID])
	}
	return result, nil
}

func containsString(values []string, target string) bool {
	for _, value := range values {
		if value == target {
			return true
		}
	}
	return false
}

// GetRoleDataScope 返回角色的数据范围；未配置时返回该角色的默认范围（管理员为全部，其余为仅本人）。
func (s *PermissionService) GetRoleDataScope(roleID string) (*model.RoleDataScope, error) {
	role, err := s.ensureRoleExists(roleID)
	if err != nil {
		return nil, err
	}
	var scope model.RoleDataScope
	err = s.db.Where("roleId = ?", roleID).First(&scope).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			rules, _ := json.Marshal(RoleDataScopeRules{
				Academic: map[string][]string{
					"college":   {},
					"major":     {},
					"className": {},
				},
				Dormitory: map[string][]string{
					"building": {},
					"floor":    {},
					"room":     {},
				},
			})
			defaultMode := DefaultDataScopeModeForRole(role.Code)
			return &model.RoleDataScope{
				RoleID:     roleID,
				ScopeMode:  defaultMode,
				PresetCode: defaultMode,
				RulesJSON:  datatypes.JSON(rules),
			}, nil
		}
		return nil, err
	}

	return &scope, nil
}

func (s *PermissionService) SaveRoleDataScope(roleID string, operatorID string, payload RoleDataScopePayload) (*model.RoleDataScope, error) {
	if _, err := s.ensureRoleExists(roleID); err != nil {
		return nil, err
	}
	normalizedPayload, err := s.normalizeAndValidateRoleDataScopePayload(payload)
	if err != nil {
		return nil, err
	}
	rulesJSON, err := json.Marshal(normalizedPayload.Rules)
	if err != nil {
		return nil, err
	}

	scope := &model.RoleDataScope{
		RoleID:     roleID,
		ScopeMode:  normalizedPayload.ScopeMode,
		PresetCode: normalizedPayload.PresetCode,
		RulesJSON:  datatypes.JSON(rulesJSON),
	}
	if operatorID != "" {
		scope.UpdatedBy = &operatorID
	}

	err = s.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("roleId = ?", roleID).Delete(&model.RoleDataScope{}).Error; err != nil {
			return err
		}
		scope.ID = uuid.New().String()
		return tx.Create(scope).Error
	})
	if err != nil {
		return nil, err
	}

	return scope, nil
}

func (s *PermissionService) ensureRoleExists(roleID string) (*model.RoleEntity, error) {
	var role model.RoleEntity
	if err := s.db.Select("id", "code", "name", "status").Where("id = ?", roleID).First(&role).Error; err != nil {
		return nil, err
	}
	return &role, nil
}

func (s *PermissionService) normalizeAndValidateRoleDataScopePayload(payload RoleDataScopePayload) (RoleDataScopePayload, error) {
	scopeMode, err := normalizeRoleDataScopeMode(payload.ScopeMode)
	if err != nil {
		return RoleDataScopePayload{}, err
	}
	presetCode, err := normalizeRoleDataScopeMode(payload.PresetCode)
	if err != nil {
		return RoleDataScopePayload{}, err
	}
	if scopeMode == "" {
		scopeMode = presetCode
	}
	if presetCode == "" {
		presetCode = scopeMode
	}
	if scopeMode == "" {
		scopeMode = roleDataScopeAll
	}
	if presetCode == "" {
		presetCode = roleDataScopeAll
	}
	if scopeMode != presetCode {
		return RoleDataScopePayload{}, newValidationError("scopeMode 与 presetCode 不一致")
	}

	rules := RoleDataScopeRules{
		Academic: map[string][]string{
			"college":   normalizeStringList(payload.Rules.Academic["college"]),
			"major":     normalizeStringList(payload.Rules.Academic["major"]),
			"className": normalizeStringList(payload.Rules.Academic["className"]),
		},
		Dormitory: map[string][]string{
			"building": normalizeStringList(payload.Rules.Dormitory["building"]),
			"floor":    normalizeStringList(payload.Rules.Dormitory["floor"]),
			"room":     normalizeStringList(payload.Rules.Dormitory["room"]),
		},
	}

	academicHasData := hasRuleValues(rules.Academic)
	dormHasData := hasRuleValues(rules.Dormitory)

	switch scopeMode {
	case roleDataScopeAll, roleDataScopeSelf, roleDataScopeOwn:
		rules = emptyRoleDataScopeRules()
	case roleDataScopeAcademic:
		if dormHasData {
			return RoleDataScopePayload{}, newValidationError("学院范围配置不能包含楼栋规则")
		}
		rules.Dormitory = emptyRoleDataScopeRules().Dormitory
	case roleDataScopeDormitory:
		if academicHasData {
			return RoleDataScopePayload{}, newValidationError("楼栋范围配置不能包含学院规则")
		}
		rules.Academic = emptyRoleDataScopeRules().Academic
	case roleDataScopeCustom:
	default:
		return RoleDataScopePayload{}, newValidationError("不支持的数据范围模式")
	}

	if err := s.validateAcademicScopeRules(rules.Academic); err != nil {
		return RoleDataScopePayload{}, err
	}
	if err := s.validateDormitoryScopeRules(rules.Dormitory); err != nil {
		return RoleDataScopePayload{}, err
	}

	return RoleDataScopePayload{
		ScopeMode:  scopeMode,
		PresetCode: scopeMode,
		Rules:      rules,
	}, nil
}

func normalizeRoleDataScopeMode(value string) (string, error) {
	normalized := strings.ToUpper(strings.TrimSpace(value))
	if normalized == "" {
		return "", nil
	}
	switch normalized {
	case roleDataScopeAll, roleDataScopeAcademic, roleDataScopeDormitory, roleDataScopeCustom, roleDataScopeSelf, roleDataScopeOwn:
		return normalized, nil
	default:
		return "", newValidationError("scopeMode/presetCode 非法")
	}
}

func emptyRoleDataScopeRules() RoleDataScopeRules {
	return RoleDataScopeRules{
		Academic: map[string][]string{
			"college":   {},
			"major":     {},
			"className": {},
		},
		Dormitory: map[string][]string{
			"building": {},
			"floor":    {},
			"room":     {},
		},
	}
}

func normalizeStringList(values []string) []string {
	if len(values) == 0 {
		return []string{}
	}
	unique := make(map[string]struct{}, len(values))
	result := make([]string, 0, len(values))
	for _, value := range values {
		trimmed := strings.TrimSpace(value)
		if trimmed == "" {
			continue
		}
		if _, exists := unique[trimmed]; exists {
			continue
		}
		unique[trimmed] = struct{}{}
		result = append(result, trimmed)
	}
	sort.Strings(result)
	return result
}

func hasRuleValues(rules map[string][]string) bool {
	for _, values := range rules {
		if len(values) > 0 {
			return true
		}
	}
	return false
}

func (s *PermissionService) validateAcademicScopeRules(rules map[string][]string) error {
	if err := s.validateStudentScopeValues("college", rules["college"], "学院"); err != nil {
		return err
	}
	if err := s.validateStudentScopeValues("major", rules["major"], "专业"); err != nil {
		return err
	}
	if err := s.validateStudentScopeValues("className", rules["className"], "班级"); err != nil {
		return err
	}
	return nil
}

func (s *PermissionService) validateStudentScopeValues(field string, values []string, label string) error {
	if len(values) == 0 {
		return nil
	}
	existing := make([]string, 0, len(values))
	query := s.db.Model(&model.Student{}).Distinct(field)
	switch field {
	case "college":
		query = query.Where("college IN ?", values).Pluck("college", &existing)
	case "major":
		query = query.Where("major IN ?", values).Pluck("major", &existing)
	case "className":
		query = query.Where("className IN ?", values).Pluck("className", &existing)
	default:
		return newValidationError("不支持的学院规则字段")
	}
	if query.Error != nil {
		return query.Error
	}
	existingSet := make(map[string]struct{}, len(existing))
	for _, item := range existing {
		trimmed := strings.TrimSpace(item)
		if trimmed != "" {
			existingSet[trimmed] = struct{}{}
		}
	}
	for _, value := range values {
		if _, ok := existingSet[value]; !ok {
			return newValidationError(fmt.Sprintf("%s不存在: %s", label, value))
		}
	}
	return nil
}

func (s *PermissionService) validateDormitoryScopeRules(rules map[string][]string) error {
	if err := s.validateBuildingValues(rules["building"]); err != nil {
		return err
	}
	for _, token := range rules["floor"] {
		building, floor, ok := parseDormFloorToken(token)
		if !ok || strings.TrimSpace(building) == "" {
			return newValidationError(fmt.Sprintf("楼层规则格式非法: %s", token))
		}
		var count int64
		if err := s.db.Model(&model.Dormitory{}).
			Where("building = ? AND floor = ?", building, floor).
			Count(&count).Error; err != nil {
			return err
		}
		if count == 0 {
			return newValidationError(fmt.Sprintf("楼层不存在: %s", token))
		}
	}
	for _, token := range rules["room"] {
		building, floor, roomNo, ok := parseDormRoomToken(token)
		if !ok {
			return newValidationError(fmt.Sprintf("房间规则格式非法: %s", token))
		}
		var count int64
		if err := s.db.Model(&model.Dormitory{}).
			Where("building = ? AND floor = ? AND roomNo = ?", building, floor, roomNo).
			Count(&count).Error; err != nil {
			return err
		}
		if count == 0 {
			return newValidationError(fmt.Sprintf("房间不存在: %s", token))
		}
	}
	return nil
}

func (s *PermissionService) validateBuildingValues(values []string) error {
	if len(values) == 0 {
		return nil
	}
	existing := make([]string, 0, len(values))
	if err := s.db.Model(&model.Dormitory{}).
		Distinct("building").
		Where("building IN ?", values).
		Pluck("building", &existing).Error; err != nil {
		return err
	}
	existingSet := make(map[string]struct{}, len(existing))
	for _, item := range existing {
		trimmed := strings.TrimSpace(item)
		if trimmed != "" {
			existingSet[trimmed] = struct{}{}
		}
	}
	for _, value := range values {
		if _, ok := existingSet[value]; !ok {
			return newValidationError(fmt.Sprintf("楼栋不存在: %s", value))
		}
	}
	return nil
}

// UserOverrideReq 用户权限覆盖请求项
type UserOverrideReq struct {
	PermissionID string `json:"permissionId"`
	Grant        bool   `json:"grant"`
	// Inherit 为 true 表示删除该权限上的例外，恢复按角色计算（仅批量接口使用）
	Inherit bool `json:"inherit,omitempty"`
}

// GetUserOverrides 获取用户的权限覆盖（格式化为前端期望的 { overrides: [{ permissionId, grant }] }）
func (s *PermissionService) GetUserOverrides(userID string) ([]map[string]interface{}, error) {
	var overrides []model.UserPermissionOverride
	if err := s.db.Where("userId = ?", userID).Find(&overrides).Error; err != nil {
		return nil, err
	}

	result := make([]map[string]interface{}, 0, len(overrides))
	for _, o := range overrides {
		result = append(result, map[string]interface{}{
			"permissionId": o.PermissionID,
			"grant":        o.Allow, // 映射 Allow 到 grant
		})
	}
	return result, nil
}

// UpdateUserOverrides 更新单个用户的权限覆盖
func (s *PermissionService) UpdateUserOverrides(userID string, overrides []UserOverrideReq) error {
	if err := s.ensureUsersExist([]string{userID}); err != nil {
		return err
	}
	overrides, err := s.normalizeOverrides(overrides)
	if err != nil {
		return err
	}
	err = s.db.Transaction(func(tx *gorm.DB) error {
		// 1. 删除现有覆盖
		if err := tx.Where("userId = ?", userID).Delete(&model.UserPermissionOverride{}).Error; err != nil {
			return err
		}

		// 2. 插入新覆盖
		if len(overrides) > 0 {
			rows := make([]model.UserPermissionOverride, 0, len(overrides))
			for _, o := range overrides {
				if o.Inherit {
					continue
				}
				rows = append(rows, model.UserPermissionOverride{
					ID:           uuid.New().String(),
					UserID:       userID,
					PermissionID: o.PermissionID,
					Allow:        o.Grant,
				})
			}
			if err := tx.Create(&rows).Error; err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return err
	}
	s.InvalidateCacheForUsers(userID)
	return nil
}

// BatchUpdateUserOverrides 批量修改多个用户的权限例外：只修改请求中列出的功能点，其他已有例外保持不变。
// Inherit=true 的项会删除该功能点上的例外。
func (s *PermissionService) BatchUpdateUserOverrides(userIDs []string, overrides []UserOverrideReq) error {
	userIDs = normalizeStringList(userIDs)
	if err := s.ensureUsersExist(userIDs); err != nil {
		return err
	}
	overrides, err := s.normalizeOverrides(overrides)
	if err != nil {
		return err
	}
	if len(overrides) == 0 {
		return nil
	}
	permissionIDs := make([]string, 0, len(overrides))
	for _, o := range overrides {
		permissionIDs = append(permissionIDs, o.PermissionID)
	}
	err = s.db.Transaction(func(tx *gorm.DB) error {
		// 1. 只删除这些用户在本次涉及的功能点上的旧例外
		if err := tx.Where("userId IN ? AND permissionId IN ?", userIDs, permissionIDs).Delete(&model.UserPermissionOverride{}).Error; err != nil {
			return err
		}

		// 2. 写入新的例外（Inherit 项只删除不写入）
		rows := make([]model.UserPermissionOverride, 0, len(userIDs)*len(overrides))
		for _, uID := range userIDs {
			for _, o := range overrides {
				if o.Inherit {
					continue
				}
				rows = append(rows, model.UserPermissionOverride{
					ID:           uuid.New().String(),
					UserID:       uID,
					PermissionID: o.PermissionID,
					Allow:        o.Grant,
				})
			}
		}
		if len(rows) > 0 {
			// 分批插入以避免大型 SQL
			if err := tx.CreateInBatches(&rows, 500).Error; err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return err
	}
	s.InvalidateCacheForUsers(userIDs...)
	return nil
}
