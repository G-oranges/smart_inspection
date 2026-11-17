package service

import (
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/my-project/backend-go/internal/model"
	"github.com/my-project/backend-go/internal/repository"
	"github.com/my-project/backend-go/pkg/utils"
	"gorm.io/gorm"
)

// 管理员新建账号和重置密码时生成一次性随机密码（仅返回一次），用户首次登录必须修改。
// 批量导入账号仍使用环境变量 DEFAULT_INITIAL_PASSWORD，同样会在首次登录时被要求修改。

const generatedPasswordLength = 12

type UserService interface {
	GetCurrentUser(id string) (*model.User, error)
	GetUsers(page, pageSize int, filters map[string]interface{}) ([]model.User, int64, error)
	GetExecutors(page, pageSize int, keyword, role string) ([]model.User, int64, error)
	// CreateUser 返回新账号及其一次性初始密码
	CreateUser(req CreateUserRequest) (*model.User, string, error)
	UpdateUser(id string, req UpdateUserRequest) error
	DeleteUsers(ids []string, currentUserId string) error
	// ResetPassword 返回新生成的一次性密码
	ResetPassword(id string) (string, error)
	GenerateTemporaryPassword(id string) (string, error)

	AuthorizeUserCreate(op OperatorContext, req CreateUserRequest) error
	AuthorizeUserUpdate(op OperatorContext, targetID string, req UpdateUserRequest) error
	AuthorizeUserDelete(op OperatorContext, ids []string) error
	AuthorizeCredentialReset(op OperatorContext, targetID string) error
}

type CreateUserRequest struct {
	Username   string   `json:"username"`
	FullName   string   `json:"fullName"`
	Email      string   `json:"email"`
	Phone      string   `json:"phone"`
	Department string   `json:"department"`
	UserType   string   `json:"userType"`
	IsDisabled bool     `json:"isDisabled"`
	Roles      []string `json:"roles"`
	Role       string   `json:"role"`
}

type UpdateUserRequest struct {
	FullName   *string  `json:"fullName"`
	Email      *string  `json:"email"`
	Phone      *string  `json:"phone"`
	Department *string  `json:"department"`
	UserType   *string  `json:"userType"`
	IsDisabled *bool    `json:"isDisabled"`
	Roles      []string `json:"roles"`
	Role       *string  `json:"role"`
}

type userService struct {
	repo repository.UserRepository
	db   *gorm.DB
	// invalidatePermissions 清除指定用户的权限缓存（由 PermissionService 提供）
	invalidatePermissions func(userIDs ...string)
}

// UserServiceOption 用于注入可选依赖。
type UserServiceOption func(*userService)

// WithPermissionCacheInvalidator 让用户角色/状态变更后立即清除权限缓存。
func WithPermissionCacheInvalidator(fn func(userIDs ...string)) UserServiceOption {
	return func(s *userService) { s.invalidatePermissions = fn }
}

func NewUserService(repo repository.UserRepository, db *gorm.DB, opts ...UserServiceOption) UserService {
	s := &userService{repo: repo, db: db}
	for _, opt := range opts {
		opt(s)
	}
	return s
}

func (s *userService) invalidate(userIDs ...string) {
	if s.invalidatePermissions != nil && len(userIDs) > 0 {
		s.invalidatePermissions(userIDs...)
	}
}

func (s *userService) GetCurrentUser(id string) (*model.User, error) {
	return s.repo.GetByID(id)
}

func (s *userService) GetUsers(page, pageSize int, filters map[string]interface{}) ([]model.User, int64, error) {
	users, total, err := s.repo.FindAll(page, pageSize, filters)
	if err != nil || len(users) == 0 {
		return users, total, err
	}

	if err := s.attachExplicitRoles(users); err != nil {
		return nil, 0, err
	}
	if err := s.normalizeUserDepartments(users); err != nil {
		return nil, 0, err
	}

	return users, total, nil
}

func (s *userService) GetExecutors(page, pageSize int, keyword, role string) ([]model.User, int64, error) {
	return s.repo.FindExecutors(page, pageSize, keyword, role)
}

// CreateUser 创建新用户
func (s *userService) CreateUser(req CreateUserRequest) (*model.User, string, error) {
	if req.Username == "" || req.FullName == "" {
		return nil, "", errors.New("用户名和姓名必填")
	}
	normalizedPrimaryRoleCode, validatedRoleIDs, err := s.validateAssignedRoles(req.Roles, req.Role)
	if err != nil {
		return nil, "", err
	}

	// 检查用户名是否已存在
	existing, _ := s.repo.GetByUsername(req.Username)
	if existing != nil {
		return nil, "", errors.New("用户名已存在")
	}

	initialPassword := utils.GenerateRandomPassword(generatedPasswordLength)
	hashedPassword, err := utils.HashPassword(initialPassword)
	if err != nil {
		return nil, "", err
	}

	user := &model.User{
		ID:                 uuid.New().String(),
		Username:           req.Username,
		Password:           hashedPassword,
		FullName:           req.FullName,
		Email:              &req.Email,
		Phone:              &req.Phone,
		Department:         &req.Department,
		UserType:           &req.UserType,
		IsDisabled:         req.IsDisabled,
		Role:               normalizedPrimaryRoleCode,
		MustChangePassword: true,
	}

	if err := s.repo.Create(user, validatedRoleIDs); err != nil {
		return nil, "", err
	}

	return user, initialPassword, nil
}

// UpdateUser 更新用户信息
func (s *userService) UpdateUser(id string, req UpdateUserRequest) error {
	currentUser, err := s.repo.GetByID(id)
	if err != nil {
		return ErrUserNotFound
	}

	// 如果请求包含 isDisabled，需要检查是否实际变更
	var needIncrementTokenVersion bool
	if req.IsDisabled != nil {
		if currentUser.IsDisabled != *req.IsDisabled {
			needIncrementTokenVersion = true
		}
	}

	nextPrimaryRoleCode := currentUser.Role
	if req.Role != nil {
		nextPrimaryRoleCode = strings.TrimSpace(*req.Role)
	}

	// 未提交角色字段时不改动角色关联（传 nil 给仓储层），避免编辑资料时丢失附加角色
	var nextRoleIDs []string
	rolesTouched := req.Role != nil || req.Roles != nil
	if rolesTouched {
		nextRoleIDs, _, err = s.resolveNextRoleIDs(currentUser, s.currentRoleIDs(currentUser), req)
		if err != nil {
			return errors.New("所选主角色不存在")
		}
		validatedPrimaryRoleCode, validatedRoleIDs, err := s.validateAssignedRoles(nextRoleIDs, nextPrimaryRoleCode)
		if err != nil {
			return err
		}
		nextPrimaryRoleCode = validatedPrimaryRoleCode
		nextRoleIDs = validatedRoleIDs
	}

	updates := make(map[string]interface{})

	if req.FullName != nil {
		updates["fullName"] = *req.FullName
	}
	if req.Email != nil {
		updates["email"] = *req.Email
	}
	if req.Phone != nil {
		updates["phone"] = *req.Phone
	}
	if req.Department != nil {
		updates["department"] = *req.Department
	}
	if req.UserType != nil {
		updates["userType"] = *req.UserType
	}
	if req.IsDisabled != nil {
		updates["isDisabled"] = *req.IsDisabled
		// 仅在状态实际变化时递增 tokenVersion，使旧 Token 失效
		if needIncrementTokenVersion {
			updates["tokenVersion"] = "tokenVersion + 1" // 标记需要递增
		}
	}
	if req.Role != nil && nextPrimaryRoleCode != "" {
		updates["role"] = nextPrimaryRoleCode
	}

	if err := s.repo.Update(id, updates, nextRoleIDs); err != nil {
		return err
	}
	if rolesTouched || needIncrementTokenVersion {
		s.invalidate(id)
	}
	return nil
}

// DeleteUsers 批量删除用户
func (s *userService) DeleteUsers(ids []string, currentUserId string) error {
	if len(ids) == 0 {
		return errors.New("请选择要删除的用户")
	}

	// 禁止删除自己
	for _, id := range ids {
		if id == currentUserId {
			return errors.New("不能删除当前登录用户")
		}
	}

	if err := s.repo.Delete(ids); err != nil {
		return err
	}
	s.invalidate(ids...)
	return nil
}

// ResetPassword 为用户生成新的一次性随机密码，旧 Token 立即失效，下次登录必须修改密码。
func (s *userService) ResetPassword(id string) (string, error) {
	if _, err := s.repo.GetByID(id); err != nil {
		return "", ErrUserNotFound
	}

	newPassword := utils.GenerateRandomPassword(generatedPasswordLength)
	hashedPassword, err := utils.HashPassword(newPassword)
	if err != nil {
		return "", err
	}
	if err := s.repo.UpdatePassword(id, hashedPassword); err != nil {
		return "", err
	}
	_ = utils.DelCache("temp_pwd:" + id)
	return newPassword, nil
}

// GenerateTemporaryPassword 生成时效12h的临时密码
func (s *userService) GenerateTemporaryPassword(id string) (string, error) {
	_, err := s.repo.GetByID(id)
	if err != nil {
		return "", ErrUserNotFound
	}

	tempPass := utils.GenerateRandomPassword(12)
	hashed, err := utils.HashPassword(tempPass)
	if err != nil {
		return "", err
	}

	// 存储到 Redis，有效期 12 小时
	err = utils.SetCache("temp_pwd:"+id, hashed, 12*time.Hour)
	if err != nil {
		return "", errors.New("生成临时密码失败（Redis不可用）")
	}

	return tempPass, nil
}

func (s *userService) validateAssignedRoles(roleIDs []string, primaryRoleCode string) (string, []string, error) {
	normalizedPrimaryRoleCode := strings.ToUpper(strings.TrimSpace(primaryRoleCode))
	if normalizedPrimaryRoleCode == "" {
		return "", nil, errors.New("必须选择主角色")
	}

	normalizedRoleIDs := make([]string, 0, len(roleIDs))
	seen := make(map[string]struct{})
	for _, roleID := range roleIDs {
		trimmed := strings.TrimSpace(roleID)
		if trimmed == "" {
			continue
		}
		if _, exists := seen[trimmed]; exists {
			continue
		}
		seen[trimmed] = struct{}{}
		normalizedRoleIDs = append(normalizedRoleIDs, trimmed)
	}
	if len(normalizedRoleIDs) == 0 {
		return "", nil, errors.New("必须至少分配一个角色")
	}

	var roles []model.RoleEntity
	if err := s.db.Where("id IN ?", normalizedRoleIDs).Find(&roles).Error; err != nil {
		return "", nil, err
	}
	if len(roles) != len(normalizedRoleIDs) {
		return "", nil, errors.New("所选角色不存在")
	}

	containsPrimaryRole := false
	for _, role := range roles {
		normalizedRole := normalizeRoleEntity(role)
		if strings.EqualFold(strings.TrimSpace(normalizedRole.Status), "INACTIVE") {
			return "", nil, errors.New("不能分配停用角色")
		}
		if normalizedRole.Code == normalizedPrimaryRoleCode {
			containsPrimaryRole = true
		}
	}
	if !containsPrimaryRole {
		return "", nil, errors.New("主角色必须包含在附加角色中")
	}

	return normalizedPrimaryRoleCode, normalizedRoleIDs, nil
}

func (s *userService) currentRoleIDs(user *model.User) []string {
	if user == nil {
		return nil
	}

	roleIDs := make([]string, 0, len(user.Roles))
	seen := make(map[string]struct{})
	for _, role := range user.Roles {
		roleID := strings.TrimSpace(role.ID)
		if roleID == "" {
			continue
		}
		if _, exists := seen[roleID]; exists {
			continue
		}
		seen[roleID] = struct{}{}
		roleIDs = append(roleIDs, roleID)
	}

	if len(roleIDs) > 0 {
		return roleIDs
	}

	primaryCode := strings.ToUpper(strings.TrimSpace(user.Role))
	if primaryCode == "" {
		return roleIDs
	}

	var primaryRole model.RoleEntity
	if err := s.db.Where("code = ?", primaryCode).First(&primaryRole).Error; err == nil && strings.TrimSpace(primaryRole.ID) != "" {
		return []string{primaryRole.ID}
	}

	return roleIDs
}

func (s *userService) attachExplicitRoles(users []model.User) error {
	userIDs := make([]string, 0, len(users))
	for _, user := range users {
		userID := strings.TrimSpace(user.ID)
		if userID == "" {
			continue
		}
		userIDs = append(userIDs, userID)
	}

	roleMap, err := s.repo.FindRolesByUserIDs(userIDs)
	if err != nil {
		return err
	}

	for index := range users {
		if roles, ok := roleMap[users[index].ID]; ok {
			users[index].Roles = roles
			continue
		}
		users[index].Roles = nil
	}

	return nil
}

func (s *userService) normalizeUserDepartments(users []model.User) error {
	userIDs := make([]string, 0, len(users))
	usernames := make([]string, 0, len(users))
	for _, user := range users {
		if user.ID != "" {
			userIDs = append(userIDs, user.ID)
		}
		if username := strings.TrimSpace(user.Username); username != "" {
			usernames = append(usernames, username)
		}
	}

	studentDepartmentsByUserID, studentDepartmentsByUsername, err := s.loadStudentDepartments(userIDs, usernames)
	if err != nil {
		return err
	}
	teacherDepartmentsByUsername, err := s.loadTeacherDepartments(usernames)
	if err != nil {
		return err
	}

	pendingUpdates := make(map[string]string)
	for index := range users {
		user := &users[index]
		username := strings.TrimSpace(user.Username)
		currentDepartment := strings.TrimSpace(ptrToStr(user.Department))
		resolvedDepartment := currentDepartment

		if college, ok := studentDepartmentsByUserID[user.ID]; ok && college != "" {
			resolvedDepartment = college
		} else if college, ok := studentDepartmentsByUsername[username]; ok && college != "" && isStudentLike(user) {
			resolvedDepartment = college
		} else if department, ok := teacherDepartmentsByUsername[username]; ok && department != "" {
			resolvedDepartment = department
		}

		if resolvedDepartment == "" {
			user.Department = nil
		} else {
			user.Department = ptr(resolvedDepartment)
		}

		if user.ID != "" && resolvedDepartment != "" && currentDepartment != resolvedDepartment {
			pendingUpdates[user.ID] = resolvedDepartment
		}
	}

	for userID, department := range pendingUpdates {
		if err := s.db.Model(&model.User{}).Where("id = ?", userID).Update("department", department).Error; err != nil {
			return err
		}
	}

	return nil
}

func (s *userService) loadStudentDepartments(userIDs []string, usernames []string) (map[string]string, map[string]string, error) {
	byUserID := make(map[string]string)
	byUsername := make(map[string]string)
	if len(userIDs) == 0 && len(usernames) == 0 {
		return byUserID, byUsername, nil
	}

	type studentDepartmentRow struct {
		UserID    *string `gorm:"column:userId"`
		StudentNo *string `gorm:"column:studentNo"`
		College   *string `gorm:"column:college"`
	}

	query := s.db.Model(&model.Student{}).
		Select("userId", "studentNo", "college").
		Where("college IS NOT NULL AND college <> ''")
	if len(userIDs) > 0 && len(usernames) > 0 {
		query = query.Where("(userId IN ? OR studentNo IN ?)", userIDs, usernames)
	} else if len(userIDs) > 0 {
		query = query.Where("userId IN ?", userIDs)
	} else {
		query = query.Where("studentNo IN ?", usernames)
	}

	var rows []studentDepartmentRow
	if err := query.Scan(&rows).Error; err != nil {
		return nil, nil, err
	}

	for _, row := range rows {
		college := strings.TrimSpace(ptrToStr(row.College))
		if college == "" {
			continue
		}
		if row.UserID != nil && strings.TrimSpace(*row.UserID) != "" {
			byUserID[strings.TrimSpace(*row.UserID)] = college
		}
		if row.StudentNo != nil && strings.TrimSpace(*row.StudentNo) != "" {
			byUsername[strings.TrimSpace(*row.StudentNo)] = college
		}
	}

	return byUserID, byUsername, nil
}

func (s *userService) loadTeacherDepartments(usernames []string) (map[string]string, error) {
	departmentsByUsername := make(map[string]string)
	if len(usernames) == 0 {
		return departmentsByUsername, nil
	}

	type teacherDepartmentRow struct {
		EmployeeNo *string `gorm:"column:employeeNo"`
		Department *string `gorm:"column:department"`
	}

	var rows []teacherDepartmentRow
	err := s.db.Model(&model.Teacher{}).
		Select("employeeNo", "department").
		Where("employeeNo IN ?", usernames).
		Where("department IS NOT NULL AND department <> ''").
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}

	for _, row := range rows {
		employeeNo := strings.TrimSpace(ptrToStr(row.EmployeeNo))
		department := strings.TrimSpace(ptrToStr(row.Department))
		if employeeNo == "" || department == "" {
			continue
		}
		departmentsByUsername[employeeNo] = department
	}

	return departmentsByUsername, nil
}

func isStudentLike(user *model.User) bool {
	if user == nil {
		return false
	}

	if strings.EqualFold(strings.TrimSpace(ptrToStr(user.UserType)), "STUDENT") {
		return true
	}

	return strings.EqualFold(strings.TrimSpace(user.Role), "STUDENT")
}
