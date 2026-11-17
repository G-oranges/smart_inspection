package repository

import (
	"github.com/my-project/backend-go/internal/model"
	"github.com/my-project/backend-go/pkg/utils"
	"gorm.io/gorm"
)

type UserRepository interface {
	GetByID(id string) (*model.User, error)
	GetByUsername(username string) (*model.User, error)
	FindAll(page, pageSize int, filters map[string]interface{}) ([]model.User, int64, error)
	FindRolesByUserIDs(userIDs []string) (map[string][]model.RoleEntity, error)
	FindExecutors(page, pageSize int, keyword, role string) ([]model.User, int64, error)
	Create(user *model.User, roleIds []string) error
	Update(id string, updates map[string]interface{}, roleIds []string) error
	Delete(ids []string) error
	UpdatePassword(id string, hashedPassword string) error
}

type userRepository struct {
	db *gorm.DB
}

func NewUserRepository(db *gorm.DB) UserRepository {
	return &userRepository{db: db}
}

func (r *userRepository) GetByID(id string) (*model.User, error) {
	var user model.User
	if err := r.db.Preload("Roles").First(&user, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *userRepository) GetByUsername(username string) (*model.User, error) {
	var user model.User
	if err := r.db.First(&user, "username = ?", username).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *userRepository) FindAll(page, pageSize int, filters map[string]interface{}) ([]model.User, int64, error) {
	var users []model.User
	var total int64

	db := r.db.Model(&model.User{})

	// 应用过滤条件
	if filters != nil {
		if search, ok := filters["search"].(string); ok && search != "" {
			searchPattern := "%" + search + "%"
			db = db.Where("(username LIKE ? OR fullName LIKE ?)", searchPattern, searchPattern)
		}
		if dept, ok := filters["department"].(string); ok && dept != "" {
			db = db.Where("department = ?", dept)
		}
		if userType := filters["userType"]; userType != nil {
			if utList, ok := userType.([]string); ok && len(utList) > 0 {
				db = db.Where("userType IN ?", utList)
			} else if utStr, ok := userType.(string); ok && utStr != "" {
				db = db.Where("userType = ?", utStr)
			}
		}
		if isDisabled := filters["isDisabled"]; isDisabled != nil {
			if idList, ok := isDisabled.([]bool); ok && len(idList) > 0 {
				db = db.Where("isDisabled IN ?", idList)
			} else if idBool, ok := isDisabled.(bool); ok {
				db = db.Where("isDisabled = ?", idBool)
			}
		}
	}

	db.Count(&total)

	err := db.Preload("Roles").Order("createdAt DESC").Scopes(Paginate(page, pageSize)).Find(&users).Error
	return users, total, err
}

func (r *userRepository) FindRolesByUserIDs(userIDs []string) (map[string][]model.RoleEntity, error) {
	roleMap := make(map[string][]model.RoleEntity)
	if len(userIDs) == 0 {
		return roleMap, nil
	}

	type userRoleRow struct {
		UserID      string  `gorm:"column:userId"`
		ID          string  `gorm:"column:id"`
		Code        string  `gorm:"column:code"`
		Name        string  `gorm:"column:name"`
		TypeCode    string  `gorm:"column:typeCode"`
		Description *string `gorm:"column:description"`
		IsSystem    bool    `gorm:"column:isSystem"`
		Sort        int     `gorm:"column:sort"`
		Status      string  `gorm:"column:status"`
	}

	var rows []userRoleRow
	err := r.db.
		Table("roleentity").
		Select([]string{
			"`_roleentitytouser`.`B` AS userId",
			"`roleentity`.`id`",
			"`roleentity`.`code`",
			"`roleentity`.`name`",
			"`roleentity`.`typeCode`",
			"`roleentity`.`description`",
			"`roleentity`.`isSystem`",
			"`roleentity`.`sort`",
			"`roleentity`.`status`",
		}).
		Joins("JOIN `_roleentitytouser` ON `_roleentitytouser`.`A` = `roleentity`.`id`").
		Where("`_roleentitytouser`.`B` IN ?", userIDs).
		Order("`_roleentitytouser`.`B` ASC").
		Order("`roleentity`.`sort` ASC").
		Order("`roleentity`.`code` ASC").
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}

	for _, row := range rows {
		roleMap[row.UserID] = append(roleMap[row.UserID], model.RoleEntity{
			ID:          row.ID,
			Code:        row.Code,
			Name:        row.Name,
			TypeCode:    row.TypeCode,
			Description: row.Description,
			IsSystem:    row.IsSystem,
			Sort:        row.Sort,
			Status:      row.Status,
		})
	}

	return roleMap, nil
}

// FindExecutors 获取可执行任务的用户列表（管理员、辅导员、学生干部）
func (r *userRepository) FindExecutors(page, pageSize int, keyword, role string) ([]model.User, int64, error) {
	var users []model.User
	var total int64

	query := r.db.Model(&model.User{}).
		Select([]string{
			"user.id",
			"user.username",
			"user.role",
			"user.fullName",
			"user.email",
			"user.phone",
			"user.department",
			"user.isDisabled",
			"user.tokenVersion",
			"user.userType",
			"user.dormId",
			"user.createdAt",
		}).
		Joins("LEFT JOIN roleentity AS primary_role ON primary_role.code = user.role").
		Where("role IN ?", []string{"ADMIN", "COUNSELOR", "LEADER"}).
		Where("isDisabled = ?", false).
		Where("(primary_role.id IS NULL OR primary_role.status IS NULL OR primary_role.status <> ?)", "INACTIVE")

	if role != "" {
		query = query.Where("role = ?", role)
	}

	if keyword != "" {
		searchPattern := "%" + keyword + "%"
		query = query.Where("(username LIKE ? OR fullName LIKE ?)", searchPattern, searchPattern)
	}

	query.Count(&total)

	err := query.Preload("Dorm").Order("fullName ASC").
		Scopes(Paginate(page, pageSize)).
		Find(&users).Error

	return users, total, err
}

// Create 创建用户并关联角色
func (r *userRepository) Create(user *model.User, roleIds []string) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		// 创建用户
		if err := tx.Create(user).Error; err != nil {
			return err
		}
		// 关联角色
		if len(roleIds) > 0 {
			for _, roleId := range roleIds {
				if err := tx.Exec("INSERT INTO _roleentitytouser (A, B) VALUES (?, ?)", roleId, user.ID).Error; err != nil {
					return err
				}
			}
		}
		return nil
	})
}

// Update 更新用户信息
func (r *userRepository) Update(id string, updates map[string]interface{}, roleIds []string) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		// 更新用户基本信息
		if len(updates) > 0 {
			// 处理 tokenVersion 递增的特殊标记
			if _, hasTokenVersion := updates["tokenVersion"]; hasTokenVersion {
				delete(updates, "tokenVersion")
				// 先执行普通字段更新
				if len(updates) > 0 {
					if err := tx.Model(&model.User{}).Where("id = ?", id).Updates(updates).Error; err != nil {
						return err
					}
				}
				// 再单独递增 tokenVersion（原子操作）
				if err := tx.Model(&model.User{}).Where("id = ?", id).
					Update("tokenVersion", gorm.Expr("tokenVersion + 1")).Error; err != nil {
					return err
				}
				// 清理用户状态缓存
				go func() {
					// 异步清理，不阻塞主流程
					_ = delUserStatusCache(id)
				}()
			} else {
				if err := tx.Model(&model.User{}).Where("id = ?", id).Updates(updates).Error; err != nil {
					return err
				}
			}
		}
		// 如果提供了角色列表且有有效角色，则重新设置角色关联
		// 空数组表示不修改角色，nil 也表示不修改
		if len(roleIds) > 0 {
			// 过滤掉空字符串
			validRoleIds := make([]string, 0, len(roleIds))
			for _, roleId := range roleIds {
				if roleId != "" {
					validRoleIds = append(validRoleIds, roleId)
				}
			}
			// 只有存在有效角色 ID 时才执行更新
			if len(validRoleIds) > 0 {
				// 删除现有角色关联
				if err := tx.Exec("DELETE FROM _roleentitytouser WHERE B = ?", id).Error; err != nil {
					return err
				}
				// 添加新的角色关联
				for _, roleId := range validRoleIds {
					if err := tx.Exec("INSERT INTO _roleentitytouser (A, B) VALUES (?, ?)", roleId, id).Error; err != nil {
						return err
					}
				}
			}
		}
		return nil
	})
}

// delUserStatusCache 清理用户状态缓存（辅助函数）
func delUserStatusCache(userID string) error {
	// 清理用户状态缓存（如果存在）
	utils.DelCache("user:status:" + userID)
	return nil
}

// Delete 批量删除用户
func (r *userRepository) Delete(ids []string) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		// 删除角色关联
		if err := tx.Exec("DELETE FROM _roleentitytouser WHERE B IN ?", ids).Error; err != nil {
			return err
		}
		// 删除用户
		if err := tx.Where("id IN ?", ids).Delete(&model.User{}).Error; err != nil {
			return err
		}
		return nil
	})
}

// UpdatePassword 更新用户密码并递增 tokenVersion（使旧 Token 失效）
func (r *userRepository) UpdatePassword(id string, hashedPassword string) error {
	return r.db.Model(&model.User{}).Where("id = ?", id).Updates(map[string]interface{}{
		"password":     hashedPassword,
		"tokenVersion": gorm.Expr("tokenVersion + 1"),
	}).Error
}
