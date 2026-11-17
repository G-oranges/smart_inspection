package service

import (
	"errors"
	"log"
	"time"

	"github.com/my-project/backend-go/internal/model"
	"gorm.io/gorm"
)

const (
	// 早期版本曾给未配置范围的非管理员角色自动写入“全部数据”（升级保护），已被下面的迁移撤销。
	legacyDataScopeMigration   = "2026-11-explicit-legacy-role-data-scopes"
	ownCollegeDefaultMigration = "2026-11-own-college-default"
)

// EnsureDataScopeDefaults 建立数据范围相关表，并执行一次性迁移：
// 撤销早期自动写入的“全部数据”，让这些角色回到新的默认值（非管理员默认本学院、学生默认仅本人）。
// 只删除那次迁移自动创建、之后从未被管理员保存过的记录（updatedBy 为空，创建时间与迁移时间一致）。
func EnsureDataScopeDefaults(db *gorm.DB) error {
	if err := db.AutoMigrate(&model.AppMigration{}, &model.UserDataScope{}); err != nil {
		return err
	}
	return db.Transaction(func(tx *gorm.DB) error {
		if applied, err := migrationApplied(tx, ownCollegeDefaultMigration); err != nil || applied {
			return err
		}

		var legacy model.AppMigration
		err := tx.Where("name = ?", legacyDataScopeMigration).First(&legacy).Error
		switch {
		case err == nil:
			window := 2 * time.Minute
			var adminIDs []string
			if err := tx.Model(&model.RoleEntity{}).Where("code = ?", model.RoleAdmin).Pluck("id", &adminIDs).Error; err != nil {
				return err
			}
			query := tx.Where("scopeMode = ? AND updatedBy IS NULL AND createdAt BETWEEN ? AND ?",
				DataScopeModeAll, legacy.AppliedAt.Add(-window), legacy.AppliedAt.Add(window))
			if len(adminIDs) > 0 {
				query = query.Where("roleId NOT IN ?", adminIDs)
			}
			result := query.Delete(&model.RoleDataScope{})
			if result.Error != nil {
				return result.Error
			}
			log.Printf("Data scope migration: reverted %d auto-created ALL scopes to the new defaults", result.RowsAffected)
		case errors.Is(err, gorm.ErrRecordNotFound):
			// 早期迁移从未执行：直接记下，确保它以后也不会执行
			if err := tx.Create(&model.AppMigration{Name: legacyDataScopeMigration}).Error; err != nil {
				return err
			}
		default:
			return err
		}
		return tx.Create(&model.AppMigration{Name: ownCollegeDefaultMigration}).Error
	})
}

func migrationApplied(tx *gorm.DB, name string) (bool, error) {
	var count int64
	if err := tx.Model(&model.AppMigration{}).Where("name = ?", name).Count(&count).Error; err != nil {
		return false, err
	}
	return count > 0, nil
}
