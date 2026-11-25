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
	"gorm.io/gorm/clause"
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
	UpdateManagedUser(id string, req UpdateUserRequest, op OperatorContext) (IdentityAudit, error)
	UpdateMyContact(id string, req SelfContactRequest, requireStudent bool) error
	DeleteUsers(ids []string, op OperatorContext) error
	// ResetPassword 返回新生成的一次性密码
	ResetPassword(id string) (string, error)
	GenerateTemporaryPassword(id string) (string, error)

	AuthorizeUserCreate(op OperatorContext, req CreateUserRequest) error
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
	if err := s.attachProfileSummaries(users); err != nil {
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

	userType, err := normalizeUserType(req.UserType, normalizedPrimaryRoleCode)
	if err != nil {
		return nil, "", err
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
		UserType:           &userType,
		IsDisabled:         req.IsDisabled,
		Role:               normalizedPrimaryRoleCode,
		MustChangePassword: true,
	}

	if err := s.db.Transaction(func(tx *gorm.DB) error {
		if err := checkIdentityUsername(tx, user.Username, ""); err != nil {
			return err
		}
		if err := ensureIndependentUsername(tx, user.Username); err != nil {
			return err
		}
		return repository.NewUserRepository(tx).Create(user, validatedRoleIDs)
	}); err != nil {
		return nil, "", err
	}

	return user, initialPassword, nil
}

func normalizeUserType(value, role string) (string, error) {
	value = strings.ToUpper(strings.TrimSpace(value))
	if value == "" {
		switch role {
		case "ADMIN":
			return "ADMIN", nil
		case "COUNSELOR":
			return "TEACHER", nil
		case "STUDENT", "LEADER":
			return "STUDENT", nil
		default:
			return "OTHER", nil
		}
	}
	switch value {
	case "ADMIN", "TEACHER", "STUDENT", "OTHER":
		return value, nil
	default:
		return "", errors.New("无效的账号类型")
	}
}

type SelfContactRequest struct {
	Phone  *string `json:"phone"`
	Mobile *string `json:"mobile"`
	Email  *string `json:"email"`
	QQ     *string `json:"qq"`
}

type IdentityAudit struct {
	OldValue map[string]any
	NewValue map[string]any
}

func (s *userService) UpdateUser(id string, req UpdateUserRequest) error {
	_, err := s.updateUser(id, req, nil, false, false, nil)
	return err
}

func (s *userService) UpdateManagedUser(id string, req UpdateUserRequest, op OperatorContext) (IdentityAudit, error) {
	return s.updateUser(id, req, &op, false, false, nil)
}

func (s *userService) UpdateMyContact(id string, req SelfContactRequest, requireStudent bool) error {
	phone := req.Phone
	var qq *string
	if requireStudent {
		if req.Mobile != nil && (ptrToStr(req.Mobile) != "" || phone == nil) {
			phone = req.Mobile
		}
		qq = req.QQ
	}
	_, err := s.updateUser(id, UpdateUserRequest{Phone: phone, Email: req.Email}, nil, true, requireStudent, qq)
	return err
}

func (s *userService) updateUser(id string, req UpdateUserRequest, op *OperatorContext, self, requireStudent bool, qq *string) (IdentityAudit, error) {
	var audit IdentityAudit
	var rolesTouched, statusChanged bool
	err := s.db.Transaction(func(tx *gorm.DB) error {
		var user model.User
		err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Preload("Roles").Take(&user, "id = ?", id).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrUserNotFound
		}
		if err != nil {
			return err
		}
		txService := &userService{db: tx, repo: repository.NewUserRepository(tx)}
		if op != nil {
			if err := txService.AuthorizeUserUpdate(*op, id, req); err != nil {
				return err
			}
		}

		updates := make(map[string]any)
		shared := make(map[string]any)
		if req.FullName != nil && *req.FullName != user.FullName {
			shared["fullName"] = *req.FullName
		}
		if req.Department != nil && (user.Department == nil || *req.Department != *user.Department) {
			shared["department"] = *req.Department
		}
		if req.Phone != nil && (user.Phone == nil || *req.Phone != *user.Phone) {
			shared["phone"] = *req.Phone
		}
		for key, value := range shared {
			updates[key] = value
		}

		var profile *identityProfile
		if self || len(shared) > 0 {
			profile, err = findIdentityProfile(tx, &user, true, true)
			if err != nil {
				return err
			}
		}
		if self {
			if user.IsDisabled {
				return newForbiddenError("用户已停用")
			}
			student := profile != nil && profile.Kind.code == studentIdentity.code
			if requireStudent && !student {
				return ErrStudentProfileNotFound
			}
			if student || studentIdentity.matchesLegacy(&user) || strings.EqualFold(user.Role, "STUDENT") {
				if err := requireStudentContactEditable(tx); err != nil {
					return err
				}
			}
			if qq != nil {
				shared["qq"] = *qq
			}
		}
		if op != nil && profile != nil && profile.Kind.code == studentIdentity.code {
			if department, changed := shared["department"]; changed {
				if err := authorizeStudentCollegeUpdate(tx, op.UserID, profile.ID, department.(string)); err != nil {
					return err
				}
			}
		}
		if op != nil && profile != nil && len(shared) > 0 {
			audit = profile.identityAudit(shared)
		}

		if req.Email != nil {
			updates["email"] = *req.Email
		}
		if req.UserType != nil {
			updates["userType"] = *req.UserType
		}
		if req.IsDisabled != nil && user.IsDisabled != *req.IsDisabled {
			statusChanged = true
			updates["isDisabled"] = *req.IsDisabled
			updates["tokenVersion"] = gorm.Expr("tokenVersion + 1")
		}

		nextPrimaryRoleCode := user.Role
		if req.Role != nil {
			nextPrimaryRoleCode = strings.TrimSpace(*req.Role)
		}

		// 未提交角色字段时不改动角色关联（传 nil 给仓储层），避免编辑资料时丢失附加角色
		var nextRoleIDs []string
		rolesTouched = req.Role != nil || req.Roles != nil
		if rolesTouched {
			nextRoleIDs, _, err = txService.resolveNextRoleIDs(&user, txService.currentRoleIDs(&user), req)
			if err != nil {
				return errors.New("所选主角色不存在")
			}
			validatedPrimaryRoleCode, validatedRoleIDs, err := txService.validateAssignedRoles(nextRoleIDs, nextPrimaryRoleCode)
			if err != nil {
				return err
			}
			nextPrimaryRoleCode = validatedPrimaryRoleCode
			nextRoleIDs = validatedRoleIDs
		}

		if req.Role != nil {
			updates["role"] = nextPrimaryRoleCode
		}
		if err := repository.UpdateUserInTransaction(tx, id, updates, nextRoleIDs); err != nil {
			return err
		}
		return (IdentitySyncService{}).SyncProfileFromUser(tx, profile, id, shared)
	})
	if err != nil {
		return IdentityAudit{}, err
	}
	if statusChanged {
		_ = utils.DelCache("user:status:" + id)
	}
	if rolesTouched || statusChanged {
		s.invalidate(id)
	}
	return audit, nil
}

var ErrStudentProfileNotFound = errors.New("未找到学生档案")

func requireStudentContactEditable(tx *gorm.DB) error {
	var settings model.SystemSettings
	err := tx.First(&settings).Error
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}
	if !settings.StudentContactEditable {
		return newForbiddenError("系统当前不允许学生自行修改联系方式")
	}
	return nil
}

// DeleteUsers 批量删除用户
func (s *userService) DeleteUsers(ids []string, op OperatorContext) error {
	if len(ids) == 0 {
		return errors.New("请选择要删除的用户")
	}

	if err := s.db.Transaction(func(tx *gorm.DB) error {
		var targets []model.User
		if err := tx.Select("id").Where("id IN ?", ids).Order("id").
			Clauses(clause.Locking{Strength: "UPDATE"}).Find(&targets).Error; err != nil {
			return err
		}
		repo := repository.NewUserRepository(tx)
		guard := &userService{db: tx, repo: repo}
		if err := guard.AuthorizeUserDelete(op, ids); err != nil {
			return err
		}
		return repo.Delete(ids)
	}); err != nil {
		return err
	}
	clearAccountStatus(ids)
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

func (s *userService) attachProfileSummaries(users []model.User) error {
	byID := make(map[string]*model.User, len(users))
	ids := make([]string, 0, len(users))
	for i := range users {
		user := &users[i]
		byID[user.ID] = user
		ids = append(ids, user.ID)
	}
	for _, kind := range identityKinds {
		var rows []identityProfile
		err := kind.query(s.db).Where("userId IN ?", ids).Scan(&rows).Error
		if isMissingTableError(err) {
			continue
		}
		if err != nil {
			return err
		}
		for _, row := range rows {
			user := byID[ptrToStr(row.UserID)]
			if user.ProfileID != nil {
				return ErrIdentityConflict
			}
			user.ProfileType, user.ProfileID, user.ProfileNo = ptr(kind.code), ptr(row.ID), row.Number
		}
	}
	return nil
}
