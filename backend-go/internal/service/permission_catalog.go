package service

import (
	"log"

	"github.com/google/uuid"
	"github.com/my-project/backend-go/internal/model"
	"gorm.io/gorm"
)

// PermissionDef 是权限清单中的一项。Code 必须与路由中 RequirePermission 使用的编码一致。
type PermissionDef struct {
	Code   string
	Name   string
	Module string
}

// PermissionCatalog 是系统权限的唯一清单：后端路由只使用这里列出的编码，启动时自动补齐到数据库。
var PermissionCatalog = []PermissionDef{
	{Code: "USER_MANAGE", Name: "用户管理", Module: "user"},
	{Code: "PERMISSION_MANAGE", Name: "权限配置", Module: "account"},
	{Code: "SYSTEM_SETTINGS", Name: "系统设置", Module: "system"},
	{Code: "STUDENT_VIEW", Name: "查看学生信息", Module: "student"},
	{Code: "STUDENT_EDIT", Name: "编辑学生信息", Module: "student"},
	{Code: "STUDENT_IMPORT", Name: "导入学生信息", Module: "student"},
	{Code: "STUDENT_EXPORT", Name: "导出学生信息", Module: "student"},
	{Code: "TEACHER_MANAGE", Name: "教职工管理", Module: "teacher"},
	{Code: "TEACHER_IMPORT", Name: "导入教职工", Module: "teacher"},
	{Code: "TEACHER_EXPORT", Name: "导出教职工", Module: "teacher"},
	{Code: "DORM_VIEW", Name: "查看宿舍数据", Module: "dorm"},
	{Code: "DORM_EDIT", Name: "编辑宿舍数据", Module: "dorm"},
	{Code: "DORM_IMPORT", Name: "导入宿舍数据", Module: "dorm"},
	{Code: "DORM_EXPORT", Name: "导出宿舍数据", Module: "dorm"},
	{Code: "DORM_CHECKIN_MANAGE", Name: "入住管理", Module: "dorm"},
	{Code: "TASK_PUBLISH", Name: "发布查寝任务", Module: "task"},
	{Code: "TASK_EDIT", Name: "编辑查寝任务", Module: "task"},
	{Code: "TASK_DELETE", Name: "删除查寝任务", Module: "task"},
	{Code: "RESULT_VIEW", Name: "查看查寝结果", Module: "result"},
	{Code: "RESULT_RECORD", Name: "录入查寝结果", Module: "result"},
	{Code: "RESULT_EXPORT", Name: "导出查寝结果", Module: "result"},
}

// 新增权限时，按“原来已拥有哪个权限”授予给现有角色，避免功能上线后原本能用的人突然用不了。
// 例如以前拥有 TEACHER_MANAGE 的角色，在前端已能看到导入按钮，这里同步授予 TEACHER_IMPORT。
var permissionGrantedWith = map[string]string{
	"TEACHER_IMPORT":      "TEACHER_MANAGE",
	"TEACHER_EXPORT":      "TEACHER_MANAGE",
	"DORM_CHECKIN_MANAGE": "DORM_EDIT",
}

// legacyPermissionAliases 记录已合并的重复权限：旧编码 -> 保留的编码。
var legacyPermissionAliases = map[string]string{
	"ACCOUNT_MANAGE": "USER_MANAGE",
}

// EnsurePermissionCatalog 让数据库与 PermissionCatalog 保持一致：
//  1. 补齐缺失的权限，并按 permissionGrantedWith 授予现有角色；管理员角色总是拥有全部权限
//  2. 把已合并的旧权限（如 ACCOUNT_MANAGE）上的角色授权和账号例外迁移到新编码，再删除旧权限
//
// 该函数可重复执行，已存在的权限名称不会被覆盖。
func EnsurePermissionCatalog(db *gorm.DB) error {
	return db.Transaction(func(tx *gorm.DB) error {
		byCode := map[string]model.Permission{}
		var existing []model.Permission
		if err := tx.Find(&existing).Error; err != nil {
			return err
		}
		for _, permission := range existing {
			byCode[permission.Code] = permission
		}

		for _, def := range PermissionCatalog {
			if _, ok := byCode[def.Code]; ok {
				continue
			}
			permission := model.Permission{ID: uuid.NewString(), Code: def.Code, Name: def.Name, Module: def.Module}
			if err := tx.Create(&permission).Error; err != nil {
				return err
			}
			byCode[def.Code] = permission
			log.Printf("Permission catalog: added %s", def.Code)
			if source, ok := permissionGrantedWith[def.Code]; ok {
				if sourcePermission, exists := byCode[source]; exists {
					if err := grantToRolesHolding(tx, sourcePermission.ID, permission.ID); err != nil {
						return err
					}
				}
			}
		}

		for legacyCode, targetCode := range legacyPermissionAliases {
			legacy, ok := byCode[legacyCode]
			if !ok {
				continue
			}
			target, ok := byCode[targetCode]
			if !ok {
				continue
			}
			if err := mergeLegacyPermission(tx, legacy.ID, target.ID); err != nil {
				return err
			}
			log.Printf("Permission catalog: merged %s into %s", legacyCode, targetCode)
		}

		return grantAllToAdmin(tx)
	})
}

// grantToRolesHolding 给拥有 sourceID 权限的角色补授 targetID 权限。
func grantToRolesHolding(tx *gorm.DB, sourceID, targetID string) error {
	var roleIDs []string
	if err := tx.Model(&model.RolePermission{}).Where("permissionId = ?", sourceID).Pluck("roleId", &roleIDs).Error; err != nil {
		return err
	}
	return grantPermissionToRoles(tx, targetID, roleIDs)
}

func grantPermissionToRoles(tx *gorm.DB, permissionID string, roleIDs []string) error {
	for _, roleID := range normalizeStringList(roleIDs) {
		var count int64
		if err := tx.Model(&model.RolePermission{}).Where("roleId = ? AND permissionId = ?", roleID, permissionID).Count(&count).Error; err != nil {
			return err
		}
		if count > 0 {
			continue
		}
		if err := tx.Create(&model.RolePermission{ID: uuid.NewString(), RoleID: roleID, PermissionID: permissionID}).Error; err != nil {
			return err
		}
	}
	return nil
}

// mergeLegacyPermission 把旧权限的角色授权、账号例外迁移到目标权限，然后删除旧权限。
// 账号例外以目标权限上已有的设置为准，不覆盖。
func mergeLegacyPermission(tx *gorm.DB, legacyID, targetID string) error {
	var roleIDs []string
	if err := tx.Model(&model.RolePermission{}).Where("permissionId = ?", legacyID).Pluck("roleId", &roleIDs).Error; err != nil {
		return err
	}
	if err := grantPermissionToRoles(tx, targetID, roleIDs); err != nil {
		return err
	}

	var overrides []model.UserPermissionOverride
	if err := tx.Where("permissionId = ?", legacyID).Find(&overrides).Error; err != nil {
		return err
	}
	for _, override := range overrides {
		var count int64
		if err := tx.Model(&model.UserPermissionOverride{}).Where("userId = ? AND permissionId = ?", override.UserID, targetID).Count(&count).Error; err != nil {
			return err
		}
		if count > 0 {
			continue
		}
		if err := tx.Create(&model.UserPermissionOverride{ID: uuid.NewString(), UserID: override.UserID, PermissionID: targetID, Allow: override.Allow}).Error; err != nil {
			return err
		}
	}

	if err := tx.Where("permissionId = ?", legacyID).Delete(&model.UserPermissionOverride{}).Error; err != nil {
		return err
	}
	if err := tx.Where("permissionId = ?", legacyID).Delete(&model.RolePermission{}).Error; err != nil {
		return err
	}
	return tx.Where("id = ?", legacyID).Delete(&model.Permission{}).Error
}

// grantAllToAdmin 确保管理员角色拥有清单中的全部权限。
func grantAllToAdmin(tx *gorm.DB) error {
	var admin model.RoleEntity
	if err := tx.Select("id").Where("code = ?", model.RoleAdmin).First(&admin).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil
		}
		return err
	}
	codes := make([]string, 0, len(PermissionCatalog))
	for _, def := range PermissionCatalog {
		codes = append(codes, def.Code)
	}
	var permissionIDs []string
	if err := tx.Model(&model.Permission{}).Where("code IN ?", codes).Pluck("id", &permissionIDs).Error; err != nil {
		return err
	}
	for _, permissionID := range permissionIDs {
		if err := grantPermissionToRoles(tx, permissionID, []string{admin.ID}); err != nil {
			return err
		}
	}
	return nil
}
