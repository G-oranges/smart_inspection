package service

import (
	"strings"

	"github.com/google/uuid"
	"github.com/my-project/backend-go/internal/model"
	"gorm.io/gorm"
)

var defaultRoleTypes = []model.RoleType{
	{Code: "SYSTEM", Name: "系统角色", IsSystem: true, Sort: 10, Status: "ACTIVE"},
	{Code: "BUSINESS", Name: "业务角色", IsSystem: true, Sort: 20, Status: "ACTIVE"},
	{Code: "CUSTOM", Name: "自定义角色", IsSystem: true, Sort: 30, Status: "ACTIVE"},
}

func EnsureRoleTypeCatalog(db *gorm.DB) error {
	return db.Transaction(func(tx *gorm.DB) error {
		for _, roleType := range defaultRoleTypes {
			var existing model.RoleType
			err := tx.Where("code = ?", roleType.Code).First(&existing).Error
			if err == nil {
				updates := map[string]interface{}{
					"name":     roleType.Name,
					"isSystem": true,
					"sort":     roleType.Sort,
				}
				if strings.TrimSpace(existing.Status) == "" {
					updates["status"] = roleType.Status
				}
				if err := tx.Model(&model.RoleType{}).Where("id = ?", existing.ID).Updates(updates).Error; err != nil {
					return err
				}
				continue
			}
			if err != gorm.ErrRecordNotFound {
				return err
			}
			roleType.ID = uuid.NewString()
			if err := tx.Create(&roleType).Error; err != nil {
				return err
			}
		}
		return nil
	})
}
