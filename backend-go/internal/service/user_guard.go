package service

import (
	"errors"
	"strings"

	"github.com/my-project/backend-go/internal/model"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// ErrUserNotFound 目标用户不存在。
var ErrUserNotFound = errors.New("用户不存在")

// ForbiddenError 表示操作者无权执行该账号操作（对应 HTTP 403）。
type ForbiddenError struct {
	message string
}

func (e *ForbiddenError) Error() string { return e.message }

func newForbiddenError(message string) error { return &ForbiddenError{message: message} }

const permissionManageCode = "PERMISSION_MANAGE"

// OperatorContext 描述发起账号操作的当前登录用户。
type OperatorContext struct {
	UserID      string
	Permissions []string
}

func (o OperatorContext) has(code string) bool {
	return containsString(o.Permissions, code)
}

// AuthorizeUserCreate 校验操作者能否创建拥有这些角色的账号。
func (s *userService) AuthorizeUserCreate(op OperatorContext, req CreateUserRequest) error {
	return s.ensureCanAssignRoles(op, req.Roles, req.Role)
}

// AuthorizeUserUpdate 校验操作者能否按 req 修改目标账号。
func (s *userService) AuthorizeUserUpdate(op OperatorContext, targetID string, req UpdateUserRequest) error {
	target, err := s.loadTarget(targetID)
	if err != nil {
		return err
	}
	currentRoleIDs := s.currentRoleIDs(target)
	nextRoleIDs, rolesChanged, err := s.resolveNextRoleIDs(target, currentRoleIDs, req)
	if err != nil {
		return err
	}
	disabling := req.IsDisabled != nil && *req.IsDisabled && !target.IsDisabled

	if targetID == op.UserID && (rolesChanged || disabling) {
		return newForbiddenError("不能修改自己的角色，也不能停用自己的账号")
	}
	if err := s.ensureCanTouchUsers(op, []string{targetID}); err != nil {
		return err
	}
	if rolesChanged {
		nextPrimary := target.Role
		if req.Role != nil {
			nextPrimary = *req.Role
		}
		if err := s.ensureCanAssignRoles(op, nextRoleIDs, nextPrimary); err != nil {
			return err
		}
	}

	losesAdmin := false
	if rolesChanged {
		wasAdmin, err := s.roleSetIsAdmin(currentRoleIDs, target.Role)
		if err != nil {
			return err
		}
		nextPrimary := target.Role
		if req.Role != nil {
			nextPrimary = *req.Role
		}
		stillAdmin, err := s.roleSetIsAdmin(nextRoleIDs, nextPrimary)
		if err != nil {
			return err
		}
		losesAdmin = wasAdmin && !stillAdmin
	}
	if losesAdmin || disabling {
		return s.ensureAdminRemains([]string{targetID})
	}
	return nil
}

// AuthorizeUserDelete 校验批量删除。
func (s *userService) AuthorizeUserDelete(op OperatorContext, ids []string) error {
	for _, id := range ids {
		if id == op.UserID {
			return newForbiddenError("不能删除当前登录用户")
		}
	}
	if err := s.ensureCanTouchUsers(op, ids); err != nil {
		return err
	}
	return s.ensureAdminRemains(ids)
}

// AuthorizeCredentialReset 校验重置密码 / 生成临时密码。
func (s *userService) AuthorizeCredentialReset(op OperatorContext, targetID string) error {
	if _, err := s.loadTarget(targetID); err != nil {
		return err
	}
	return s.ensureCanTouchUsers(op, []string{targetID})
}

func (s *userService) loadTarget(id string) (*model.User, error) {
	user, err := s.repo.GetByID(id)
	if err != nil || user == nil {
		return nil, ErrUserNotFound
	}
	return user, nil
}

// resolveNextRoleIDs 计算更新后的角色集合；未提交角色字段时保持原样。
func (s *userService) resolveNextRoleIDs(target *model.User, currentRoleIDs []string, req UpdateUserRequest) ([]string, bool, error) {
	if req.Roles == nil && req.Role == nil {
		return currentRoleIDs, false, nil
	}
	next := currentRoleIDs
	if req.Roles != nil {
		next = normalizeStringList(req.Roles)
	} else {
		primaryID, err := s.roleIDByCode(*req.Role)
		if err != nil {
			return nil, false, err
		}
		next = normalizeStringList(append(append([]string{}, currentRoleIDs...), primaryID))
	}
	changed := !sameStringSet(next, currentRoleIDs)
	if req.Role != nil && !strings.EqualFold(strings.TrimSpace(*req.Role), target.Role) {
		changed = true
	}
	return next, changed, nil
}

// ensureCanAssignRoles：分配管理员角色或带「权限配置」的角色，要求操作者自己拥有「权限配置」。
func (s *userService) ensureCanAssignRoles(op OperatorContext, roleIDs []string, primaryRoleCode string) error {
	if op.has(permissionManageCode) {
		return nil
	}
	privileged, err := s.anyRolePrivileged(normalizeStringList(roleIDs), primaryRoleCode)
	if err != nil {
		return err
	}
	if privileged {
		return newForbiddenError("分配管理员或含「权限配置」的角色，需要操作者拥有「权限配置」权限")
	}
	return nil
}

// ensureCanTouchUsers：修改/删除/重置管理员类账号，要求操作者拥有「权限配置」。
func (s *userService) ensureCanTouchUsers(op OperatorContext, userIDs []string) error {
	if op.has(permissionManageCode) {
		return nil
	}
	for _, userID := range userIDs {
		user, err := s.repo.GetByID(userID)
		if err != nil || user == nil {
			continue
		}
		privileged, err := s.anyRolePrivileged(s.currentRoleIDs(user), user.Role)
		if err != nil {
			return err
		}
		if privileged {
			return newForbiddenError("修改、删除或重置管理员账号，需要操作者拥有「权限配置」权限")
		}
	}
	return nil
}

// anyRolePrivileged 判断角色集合（含主角色编码）中是否有 ADMIN 或拥有 PERMISSION_MANAGE 的角色。
func (s *userService) anyRolePrivileged(roleIDs []string, primaryRoleCode string) (bool, error) {
	primaryRoleCode = strings.ToUpper(strings.TrimSpace(primaryRoleCode))
	if primaryRoleCode == model.RoleAdmin {
		return true, nil
	}
	if primaryRoleCode != "" {
		if id, err := s.roleIDByCode(primaryRoleCode); err == nil && id != "" {
			roleIDs = append(append([]string{}, roleIDs...), id)
		}
	}
	if len(roleIDs) == 0 {
		return false, nil
	}
	var adminCount int64
	if err := s.db.Model(&model.RoleEntity{}).Where("id IN ? AND code = ?", roleIDs, model.RoleAdmin).Count(&adminCount).Error; err != nil {
		return false, err
	}
	if adminCount > 0 {
		return true, nil
	}
	var managerCount int64
	if err := s.db.Table("rolepermission").
		Joins("JOIN `permission` ON `permission`.`id` = `rolepermission`.`permissionId`").
		Where("`rolepermission`.`roleId` IN ? AND `permission`.`code` = ?", roleIDs, permissionManageCode).
		Count(&managerCount).Error; err != nil {
		return false, err
	}
	return managerCount > 0, nil
}

func (s *userService) roleSetIsAdmin(roleIDs []string, primaryRoleCode string) (bool, error) {
	if strings.EqualFold(strings.TrimSpace(primaryRoleCode), model.RoleAdmin) {
		return true, nil
	}
	if len(roleIDs) == 0 {
		return false, nil
	}
	var count int64
	err := s.db.Model(&model.RoleEntity{}).Where("id IN ? AND code = ?", roleIDs, model.RoleAdmin).Count(&count).Error
	return count > 0, err
}

// ensureAdminRemains 确保排除这些账号后，仍至少有一个启用中的管理员。
func (s *userService) ensureAdminRemains(excludedIDs []string) error {
	query := s.db.Model(&model.User{}).Where("isDisabled = ?", false)
	if len(excludedIDs) > 0 {
		query = query.Where("id NOT IN ?", excludedIDs)
	}
	adminRoleID, _ := s.roleIDByCode(model.RoleAdmin)
	if adminRoleID != "" {
		query = query.Where("(role = ? OR id IN (?))", model.RoleAdmin,
			s.db.Table("_roleentitytouser").Select("B").Where("A = ?", adminRoleID))
	} else {
		query = query.Where("role = ?", model.RoleAdmin)
	}
	// Lock a remaining administrator so concurrent updates cannot both remove the last one.
	var remaining model.User
	err := query.Select("id").Order("id").Clauses(clause.Locking{Strength: "UPDATE"}).Take(&remaining).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return newForbiddenError("至少需要保留一个启用中的管理员账号")
	}
	return err
}

func (s *userService) roleIDByCode(code string) (string, error) {
	var role model.RoleEntity
	if err := s.db.Select("id").Where("code = ?", strings.ToUpper(strings.TrimSpace(code))).First(&role).Error; err != nil {
		return "", err
	}
	return role.ID, nil
}

func sameStringSet(left, right []string) bool {
	left = normalizeStringList(left)
	right = normalizeStringList(right)
	if len(left) != len(right) {
		return false
	}
	for index := range left {
		if left[index] != right[index] {
			return false
		}
	}
	return true
}
