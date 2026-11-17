//go:build ignore

package main

import (
	"fmt"
	"log"
	"os"
	"sort"
	"strings"

	"github.com/google/uuid"
	"github.com/joho/godotenv"
	"github.com/my-project/backend-go/internal/model"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

type normalizeReport struct {
	RoleTypesInserted      int `json:"roleTypesInserted"`
	RoleTypesUpdated       int `json:"roleTypesUpdated"`
	RoleTypesDeleted       int `json:"roleTypesDeleted"`
	RoleEntitiesUpdated    int `json:"roleEntitiesUpdated"`
	RoleEntitiesDeleted    int `json:"roleEntitiesDeleted"`
	RoleDataScopesDeleted  int `json:"roleDataScopesDeleted"`
	RoleDataScopesUpdated  int `json:"roleDataScopesUpdated"`
	RolePermissionsDeleted int `json:"rolePermissionsDeleted"`
	UserRolesUpdated       int `json:"userRolesUpdated"`
	JoinRowsRebuilt        int `json:"joinRowsRebuilt"`
	MissingStdRolesCreated int `json:"missingStdRolesCreated"`
}

var standardRoleSort = map[string]int{
	model.RoleAdmin:     10,
	model.RoleCounselor: 20,
	model.RoleLeader:    30,
	model.RoleStudent:   40,
}

var systemRoleTypeSeed = []model.RoleType{
	{Code: "SYSTEM", Name: "系统角色", IsSystem: true, Sort: 10, Status: "ACTIVE"},
	{Code: "BUSINESS", Name: "业务角色", IsSystem: true, Sort: 20, Status: "ACTIVE"},
	{Code: "CUSTOM", Name: "自定义角色", IsSystem: true, Sort: 30, Status: "ACTIVE"},
}

func main() {
	_ = godotenv.Load()
	_ = godotenv.Load("../backend/.env")

	rawDSN := strings.TrimSpace(os.Getenv("DATABASE_URL"))
	if rawDSN == "" {
		log.Fatal("DATABASE_URL environment variable is required")
	}

	db, err := gorm.Open(mysql.Open(convertDSN(rawDSN)), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Warn),
	})
	if err != nil {
		log.Fatalf("failed to connect database: %v", err)
	}

	report := normalizeReport{}
	if err := db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Exec("CREATE TABLE IF NOT EXISTS `_roleentitytouser` (`A` char(36) NOT NULL, `B` char(36) NOT NULL, PRIMARY KEY (`A`,`B`))").Error; err != nil {
			return err
		}
		if err := normalizeRoleTypes(tx, &report); err != nil {
			return err
		}
		if err := normalizeRoles(tx, &report); err != nil {
			return err
		}
		if err := normalizeUserRoles(tx, &report); err != nil {
			return err
		}
		if err := normalizeRoleDataScopes(tx, &report); err != nil {
			return err
		}
		if err := normalizeRolePermissions(tx, &report); err != nil {
			return err
		}
		if err := normalizeRoleUserJoin(tx, &report); err != nil {
			return err
		}
		return nil
	}); err != nil {
		log.Fatalf("role management normalize failed: %v", err)
	}

	log.Printf("role management normalize report: %+v", report)
}

func normalizeRoleTypes(tx *gorm.DB, report *normalizeReport) error {
	for _, seed := range systemRoleTypeSeed {
		var existing model.RoleType
		err := tx.Where("code = ?", seed.Code).First(&existing).Error
		if err == gorm.ErrRecordNotFound {
			seed.ID = uuid.NewString()
			if err := tx.Create(&seed).Error; err != nil {
				return err
			}
			report.RoleTypesInserted++
			continue
		}
		if err != nil {
			return err
		}
		updates := map[string]interface{}{
			"name":     seed.Name,
			"isSystem": true,
			"sort":     seed.Sort,
		}
		if strings.TrimSpace(existing.Status) == "" {
			updates["status"] = "ACTIVE"
		}
		if err := tx.Model(&model.RoleType{}).Where("id = ?", existing.ID).Updates(updates).Error; err != nil {
			return err
		}
	}

	var roleTypes []model.RoleType
	if err := tx.Find(&roleTypes).Error; err != nil {
		return err
	}
	grouped := make(map[string][]model.RoleType)
	for _, item := range roleTypes {
		code := normalizeCode(item.Code)
		if code == "" {
			code = "CUSTOM_TYPE_" + shortID(item.ID)
		}
		updates := map[string]interface{}{}
		if code != item.Code {
			updates["code"] = code
		}
		if strings.TrimSpace(item.Name) == "" {
			updates["name"] = code
		}
		if strings.TrimSpace(item.Status) == "" {
			updates["status"] = "ACTIVE"
		}
		if len(updates) > 0 {
			if err := tx.Model(&model.RoleType{}).Where("id = ?", item.ID).Updates(updates).Error; err != nil {
				return err
			}
			report.RoleTypesUpdated++
			if v, ok := updates["code"].(string); ok {
				item.Code = v
			}
			if v, ok := updates["name"].(string); ok {
				item.Name = v
			}
			if v, ok := updates["status"].(string); ok {
				item.Status = v
			}
		}
		grouped[item.Code] = append(grouped[item.Code], item)
	}

	for code, items := range grouped {
		if len(items) <= 1 {
			continue
		}
		sort.SliceStable(items, func(i, j int) bool {
			if items[i].IsSystem != items[j].IsSystem {
				return items[i].IsSystem
			}
			return items[i].ID < items[j].ID
		})
		keeper := items[0]
		for _, duplicate := range items[1:] {
			if err := tx.Model(&model.RoleEntity{}).Where("typeCode = ?", duplicate.Code).Update("typeCode", code).Error; err != nil {
				return err
			}
			if err := tx.Delete(&model.RoleType{}, "id = ?", duplicate.ID).Error; err != nil {
				return err
			}
			report.RoleTypesDeleted++
		}
		if keeper.Code != code {
			if err := tx.Model(&model.RoleType{}).Where("id = ?", keeper.ID).Update("code", code).Error; err != nil {
				return err
			}
		}
	}
	return nil
}

func normalizeRoles(tx *gorm.DB, report *normalizeReport) error {
	var roleTypes []model.RoleType
	if err := tx.Find(&roleTypes).Error; err != nil {
		return err
	}
	validTypes := make(map[string]struct{}, len(roleTypes))
	for _, roleType := range roleTypes {
		validTypes[normalizeCode(roleType.Code)] = struct{}{}
	}

	var roles []model.RoleEntity
	if err := tx.Find(&roles).Error; err != nil {
		return err
	}
	grouped := make(map[string][]model.RoleEntity)
	for _, role := range roles {
		code := normalizeCode(role.Code)
		if code == "" {
			nameCode := normalizeCode(role.Name)
			if _, ok := standardRoleSort[nameCode]; ok {
				code = nameCode
			} else {
				code = "ROLE_" + shortID(role.ID)
			}
		}
		typeCode := normalizeCode(role.TypeCode)
		if _, ok := standardRoleSort[code]; ok {
			typeCode = "SYSTEM"
		}
		if typeCode == "" {
			typeCode = "CUSTOM"
		}
		if _, ok := validTypes[typeCode]; !ok {
			typeCode = "CUSTOM"
		}
		updates := map[string]interface{}{}
		if code != role.Code {
			updates["code"] = code
		}
		if strings.TrimSpace(role.Name) == "" {
			updates["name"] = code
		}
		if strings.TrimSpace(role.Status) == "" {
			updates["status"] = "ACTIVE"
		}
		if typeCode != role.TypeCode {
			updates["typeCode"] = typeCode
		}
		if _, ok := standardRoleSort[code]; ok {
			updates["isSystem"] = true
			updates["sort"] = standardRoleSort[code]
		}
		if len(updates) > 0 {
			if err := tx.Model(&model.RoleEntity{}).Where("id = ?", role.ID).Updates(updates).Error; err != nil {
				return err
			}
			report.RoleEntitiesUpdated++
			if v, ok := updates["code"].(string); ok {
				role.Code = v
			}
		}
		grouped[role.Code] = append(grouped[role.Code], role)
	}

	for code, items := range grouped {
		if len(items) <= 1 {
			continue
		}
		sort.SliceStable(items, func(i, j int) bool {
			if items[i].IsSystem != items[j].IsSystem {
				return items[i].IsSystem
			}
			return items[i].ID < items[j].ID
		})
		keeper := items[0]
		for _, duplicate := range items[1:] {
			if err := tx.Model(&model.RolePermission{}).Where("roleId = ?", duplicate.ID).Update("roleId", keeper.ID).Error; err != nil {
				return err
			}
			if err := tx.Model(&model.RoleDataScope{}).Where("roleId = ?", duplicate.ID).Update("roleId", keeper.ID).Error; err != nil {
				return err
			}
			if err := tx.Exec("UPDATE `_roleentitytouser` SET `A` = ? WHERE `A` = ?", keeper.ID, duplicate.ID).Error; err != nil {
				return err
			}
			if err := tx.Delete(&model.RoleEntity{}, "id = ?", duplicate.ID).Error; err != nil {
				return err
			}
			report.RoleEntitiesDeleted++
		}
		if _, ok := standardRoleSort[code]; ok && keeper.Code == code && keeper.TypeCode != "SYSTEM" {
			if err := tx.Model(&model.RoleEntity{}).Where("id = ?", keeper.ID).Updates(map[string]interface{}{
				"typeCode": "SYSTEM",
				"isSystem": true,
				"sort":     standardRoleSort[code],
			}).Error; err != nil {
				return err
			}
			report.RoleEntitiesUpdated++
		}
	}
	return nil
}

func normalizeUserRoles(tx *gorm.DB, report *normalizeReport) error {
	for code := range standardRoleSort {
		var count int64
		if err := tx.Model(&model.RoleEntity{}).Where("code = ?", code).Count(&count).Error; err != nil {
			return err
		}
		if count == 0 {
			role := model.RoleEntity{ID: uuid.NewString(), Code: code, Name: code, TypeCode: "SYSTEM", IsSystem: true, Sort: standardRoleSort[code], Status: "ACTIVE"}
			if err := tx.Create(&role).Error; err != nil {
				return err
			}
			report.MissingStdRolesCreated++
		}
	}

	var users []model.User
	if err := tx.Select("id", "role").Find(&users).Error; err != nil {
		return err
	}
	validRoles := map[string]struct{}{}
	var roles []model.RoleEntity
	if err := tx.Select("code").Find(&roles).Error; err != nil {
		return err
	}
	for _, role := range roles {
		validRoles[normalizeCode(role.Code)] = struct{}{}
	}
	for _, user := range users {
		nextRole := normalizeCode(user.Role)
		if nextRole == "" {
			nextRole = model.RoleStudent
		}
		if _, ok := validRoles[nextRole]; !ok {
			nextRole = model.RoleStudent
		}
		if nextRole != user.Role {
			if err := tx.Model(&model.User{}).Where("id = ?", user.ID).Update("role", nextRole).Error; err != nil {
				return err
			}
			report.UserRolesUpdated++
		}
	}
	return nil
}

func normalizeRoleDataScopes(tx *gorm.DB, report *normalizeReport) error {
	if result := tx.Exec("DELETE FROM roledatascope WHERE roleId NOT IN (SELECT id FROM roleentity)"); result.Error != nil {
		return result.Error
	} else {
		report.RoleDataScopesDeleted += int(result.RowsAffected)
	}
	if result := tx.Exec("UPDATE roledatascope SET scopeMode = 'ALL' WHERE scopeMode IS NULL OR TRIM(scopeMode) = ''"); result.Error != nil {
		return result.Error
	} else {
		report.RoleDataScopesUpdated += int(result.RowsAffected)
	}
	if result := tx.Exec("UPDATE roledatascope SET presetCode = 'ALL' WHERE presetCode IS NULL OR TRIM(presetCode) = ''"); result.Error != nil {
		return result.Error
	} else {
		report.RoleDataScopesUpdated += int(result.RowsAffected)
	}
	type duplicate struct{ ID string }
	var duplicates []duplicate
	if err := tx.Raw(`
		SELECT a.id
		FROM roledatascope a
		JOIN roledatascope b
		  ON a.roleId = b.roleId
		 AND (
			COALESCE(a.updatedAt, a.createdAt, '1970-01-01') < COALESCE(b.updatedAt, b.createdAt, '1970-01-01')
			OR (
				COALESCE(a.updatedAt, a.createdAt, '1970-01-01') = COALESCE(b.updatedAt, b.createdAt, '1970-01-01')
				AND a.id < b.id
			)
		 )
	`).Scan(&duplicates).Error; err != nil {
		return err
	}
	for _, row := range duplicates {
		if err := tx.Delete(&model.RoleDataScope{}, "id = ?", row.ID).Error; err != nil {
			return err
		}
		report.RoleDataScopesDeleted++
	}
	return nil
}

func normalizeRolePermissions(tx *gorm.DB, report *normalizeReport) error {
	if result := tx.Exec("DELETE FROM rolepermission WHERE roleId NOT IN (SELECT id FROM roleentity) OR permissionId NOT IN (SELECT id FROM permission)"); result.Error != nil {
		return result.Error
	} else {
		report.RolePermissionsDeleted += int(result.RowsAffected)
	}
	if result := tx.Exec(`
		DELETE rp1 FROM rolepermission rp1
		JOIN rolepermission rp2
		  ON rp1.roleId = rp2.roleId
		 AND rp1.permissionId = rp2.permissionId
		 AND rp1.id < rp2.id
	`); result.Error != nil {
		return result.Error
	} else {
		report.RolePermissionsDeleted += int(result.RowsAffected)
	}
	return nil
}

func normalizeRoleUserJoin(tx *gorm.DB, report *normalizeReport) error {
	type joinRow struct {
		A string
		B string
	}
	var rows []joinRow
	if err := tx.Raw("SELECT `A`, `B` FROM `_roleentitytouser`").Scan(&rows).Error; err != nil {
		return err
	}
	type key struct{ A, B string }
	uniqueRows := make(map[key]struct{})
	validRoleIDs := map[string]struct{}{}
	validUserIDs := map[string]struct{}{}
	var roleIDs []string
	var userIDs []string
	if err := tx.Model(&model.RoleEntity{}).Pluck("id", &roleIDs).Error; err != nil {
		return err
	}
	if err := tx.Model(&model.User{}).Pluck("id", &userIDs).Error; err != nil {
		return err
	}
	for _, id := range roleIDs {
		validRoleIDs[id] = struct{}{}
	}
	for _, id := range userIDs {
		validUserIDs[id] = struct{}{}
	}
	for _, row := range rows {
		if _, ok := validRoleIDs[row.A]; !ok {
			continue
		}
		if _, ok := validUserIDs[row.B]; !ok {
			continue
		}
		uniqueRows[key{A: row.A, B: row.B}] = struct{}{}
	}
	if err := tx.Exec("DELETE FROM `_roleentitytouser`").Error; err != nil {
		return err
	}
	for pair := range uniqueRows {
		if err := tx.Exec("INSERT INTO `_roleentitytouser` (`A`,`B`) VALUES (?, ?)", pair.A, pair.B).Error; err != nil {
			return err
		}
		report.JoinRowsRebuilt++
	}
	return nil
}

func normalizeCode(value string) string {
	return strings.ToUpper(strings.TrimSpace(value))
}

func shortID(id string) string {
	id = strings.ReplaceAll(id, "-", "")
	if len(id) >= 8 {
		return id[:8]
	}
	return fmt.Sprintf("%08s", id)
}

func convertDSN(prismaDSN string) string {
	const prefix = "mysql://"
	if !strings.HasPrefix(prismaDSN, prefix) {
		return prismaDSN
	}
	trimmed := strings.TrimPrefix(prismaDSN, prefix)
	parts := strings.SplitN(trimmed, "@", 2)
	if len(parts) != 2 {
		return prismaDSN
	}
	credentials := parts[0]
	addressDB := parts[1]
	addrParts := strings.SplitN(addressDB, "/", 2)
	if len(addrParts) != 2 {
		return prismaDSN
	}
	hostPort := addrParts[0]
	dbName := addrParts[1]
	if idx := strings.Index(dbName, "?"); idx != -1 {
		dbName = dbName[:idx]
	}
	return fmt.Sprintf("%s@tcp(%s)/%s?charset=utf8mb4&parseTime=True&loc=Local", credentials, hostPort, dbName)
}
