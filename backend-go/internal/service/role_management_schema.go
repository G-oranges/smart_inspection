package service

import (
	"log"
	"strings"

	"gorm.io/gorm"
)

type schemaCheck struct {
	name  string
	query string
	args  []interface{}
}

func WarnRoleManagementSchemaStatus(db *gorm.DB) error {
	if db == nil || db.Dialector == nil {
		return nil
	}
	if strings.ToLower(strings.TrimSpace(db.Dialector.Name())) != "mysql" {
		return nil
	}

	var schemaName string
	if err := db.Raw("SELECT DATABASE()").Scan(&schemaName).Error; err != nil {
		return err
	}
	schemaName = strings.TrimSpace(schemaName)
	if schemaName == "" {
		return nil
	}

	checks := []schemaCheck{
		{
			name:  "unique index roletype(code)",
			query: `SELECT COUNT(1) FROM information_schema.statistics WHERE table_schema = ? AND table_name = 'roletype' AND column_name = 'code' AND non_unique = 0`,
			args:  []interface{}{schemaName},
		},
		{
			name:  "unique index roleentity(code)",
			query: `SELECT COUNT(1) FROM information_schema.statistics WHERE table_schema = ? AND table_name = 'roleentity' AND column_name = 'code' AND non_unique = 0`,
			args:  []interface{}{schemaName},
		},
		{
			name:  "unique index roledatascope(roleId)",
			query: `SELECT COUNT(1) FROM information_schema.statistics WHERE table_schema = ? AND table_name = 'roledatascope' AND column_name = 'roleId' AND non_unique = 0`,
			args:  []interface{}{schemaName},
		},
		{
			name:  "foreign key fk_roleentity_typecode",
			query: `SELECT COUNT(1) FROM information_schema.referential_constraints WHERE constraint_schema = ? AND constraint_name = 'fk_roleentity_typecode'`,
			args:  []interface{}{schemaName},
		},
		{
			name:  "foreign key fk_roledatascope_roleid",
			query: `SELECT COUNT(1) FROM information_schema.referential_constraints WHERE constraint_schema = ? AND constraint_name = 'fk_roledatascope_roleid'`,
			args:  []interface{}{schemaName},
		},
		{
			name:  "foreign key fk_rolepermission_roleid",
			query: `SELECT COUNT(1) FROM information_schema.referential_constraints WHERE constraint_schema = ? AND constraint_name = 'fk_rolepermission_roleid'`,
			args:  []interface{}{schemaName},
		},
		{
			name:  "foreign key fk_rolepermission_permissionid",
			query: `SELECT COUNT(1) FROM information_schema.referential_constraints WHERE constraint_schema = ? AND constraint_name = 'fk_rolepermission_permissionid'`,
			args:  []interface{}{schemaName},
		},
		{
			name:  "foreign key fk_roleentitytouser_role",
			query: `SELECT COUNT(1) FROM information_schema.referential_constraints WHERE constraint_schema = ? AND constraint_name = 'fk_roleentitytouser_role'`,
			args:  []interface{}{schemaName},
		},
		{
			name:  "foreign key fk_roleentitytouser_user",
			query: `SELECT COUNT(1) FROM information_schema.referential_constraints WHERE constraint_schema = ? AND constraint_name = 'fk_roleentitytouser_user'`,
			args:  []interface{}{schemaName},
		},
	}

	var missing []string
	for _, check := range checks {
		var count int64
		if err := db.Raw(check.query, check.args...).Scan(&count).Error; err != nil {
			return err
		}
		if count == 0 {
			missing = append(missing, check.name)
		}
	}

	if len(missing) > 0 {
		log.Printf("Warning: role-management hardening migration appears incomplete. Missing checks: %s", strings.Join(missing, ", "))
	}
	return nil
}
