//go:build ignore

package main

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	mysqlDriver "github.com/go-sql-driver/mysql"
	"github.com/google/uuid"
	"github.com/joho/godotenv"
	"github.com/my-project/backend-go/internal/model"
	"github.com/my-project/backend-go/pkg/utils"
	gormmysql "gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

const (
	testDSNEnvPrimary   = "AUTHZ_TEST_DATABASE_URL"
	testDSNEnvSecondary = "DATABASE_URL_TEST"
)

func main() {
	_ = godotenv.Load()
	_ = godotenv.Load("../backend/.env")

	raw := strings.TrimSpace(os.Getenv(testDSNEnvPrimary))
	if raw == "" {
		raw = strings.TrimSpace(os.Getenv(testDSNEnvSecondary))
	}
	if raw == "" {
		log.Fatalf("%s or %s must be set", testDSNEnvPrimary, testDSNEnvSecondary)
	}

	dsn := normalizeDSN(raw)
	dbName, err := ensureDatabase(dsn)
	if err != nil {
		log.Fatalf("failed to ensure database: %v", err)
	}
	log.Printf("Using database: %s", dbName)

	db, err := gorm.Open(gormmysql.Open(dsn), &gorm.Config{
		Logger:                                   logger.Default.LogMode(logger.Info),
		DisableForeignKeyConstraintWhenMigrating: true,
		IgnoreRelationshipsWhenMigrating:         true,
	})
	if err != nil {
		log.Fatalf("failed to open database: %v", err)
	}

	if err := migrateAuthzTables(db); err != nil {
		log.Fatalf("failed to migrate tables: %v", err)
	}

	if err := seedAuthzData(db); err != nil {
		log.Fatalf("failed to seed data: %v", err)
	}

	log.Println("Authz test database initialization complete.")
}

func normalizeDSN(raw string) string {
	if !strings.HasPrefix(raw, "mysql://") {
		return raw
	}
	trimmed := strings.TrimPrefix(raw, "mysql://")
	parts := strings.SplitN(trimmed, "@", 2)
	if len(parts) != 2 {
		return raw
	}
	credentials := parts[0]
	addressDB := parts[1]
	addrParts := strings.SplitN(addressDB, "/", 2)
	if len(addrParts) != 2 {
		return raw
	}
	hostPort := addrParts[0]
	dbName := addrParts[1]
	if idx := strings.Index(dbName, "?"); idx != -1 {
		dbName = dbName[:idx]
	}
	return credentials + "@tcp(" + hostPort + ")/" + dbName + "?charset=utf8mb4&parseTime=True&loc=Local"
}

func ensureDatabase(dsn string) (string, error) {
	cfg, err := mysqlDriver.ParseDSN(dsn)
	if err != nil {
		return "", err
	}
	if cfg.DBName == "" {
		return "", fmt.Errorf("database name is required in DSN")
	}

	dbName := cfg.DBName
	cfg.DBName = ""
	serverDSN := cfg.FormatDSN()

	sqlDB, err := sql.Open("mysql", serverDSN)
	if err != nil {
		return "", err
	}
	defer sqlDB.Close()

	if err := sqlDB.Ping(); err != nil {
		return "", err
	}

	stmt := fmt.Sprintf("CREATE DATABASE IF NOT EXISTS `%s` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci", dbName)
	if _, err := sqlDB.Exec(stmt); err != nil {
		return "", err
	}

	return dbName, nil
}

func migrateAuthzTables(db *gorm.DB) error {
	if err := db.AutoMigrate(
		&model.User{},
		&model.RoleType{},
		&model.RoleEntity{},
		&model.Permission{},
		&model.RolePermission{},
		&model.UserPermissionOverride{},
		&model.AuditLog{},
		&model.Student{},
		&model.Teacher{},
	); err != nil {
		return err
	}
	return db.Exec("CREATE TABLE IF NOT EXISTS `_roleentitytouser` (A char(36) NOT NULL, B char(36) NOT NULL, PRIMARY KEY (A, B))").Error
}

func seedAuthzData(db *gorm.DB) error {
	roleDefs := []struct {
		Code string
		Name string
	}{
		{Code: "ADMIN", Name: "Admin"},
		{Code: "COUNSELOR", Name: "Counselor"},
		{Code: "LEADER", Name: "Leader"},
		{Code: "STUDENT", Name: "Student"},
	}

	roles := map[string]model.RoleEntity{}
	for _, def := range roleDefs {
		role := model.RoleEntity{}
		if err := db.Where("code = ?", def.Code).FirstOrCreate(&role, model.RoleEntity{
			ID:   uuid.NewString(),
			Code: def.Code,
			Name: def.Name,
		}).Error; err != nil {
			return err
		}
		roles[def.Code] = role
	}

	permDefs := []struct {
		Code   string
		Module string
	}{
		{Code: "USER_MANAGE", Module: "USER"},
		{Code: "ACCOUNT_MANAGE", Module: "USER"},
		{Code: "PERMISSION_MANAGE", Module: "PERMISSION"},
		{Code: "SYSTEM_SETTINGS", Module: "SYSTEM"},
		{Code: "STUDENT_VIEW", Module: "STUDENT"},
		{Code: "STUDENT_EDIT", Module: "STUDENT"},
		{Code: "STUDENT_IMPORT", Module: "STUDENT"},
		{Code: "STUDENT_EXPORT", Module: "STUDENT"},
		{Code: "TEACHER_MANAGE", Module: "TEACHER"},
		{Code: "TEACHER_IMPORT", Module: "TEACHER"},
		{Code: "TEACHER_EXPORT", Module: "TEACHER"},
		{Code: "DORM_VIEW", Module: "DORM"},
		{Code: "DORM_EDIT", Module: "DORM"},
		{Code: "DORM_IMPORT", Module: "DORM"},
		{Code: "DORM_EXPORT", Module: "DORM"},
		{Code: "DORM_CHECKIN_MANAGE", Module: "DORM"},
		{Code: "TASK_PUBLISH", Module: "TASK"},
		{Code: "RESULT_VIEW", Module: "RESULT"},
		{Code: "RESULT_RECORD", Module: "RESULT"},
	}

	perms := map[string]model.Permission{}
	for _, def := range permDefs {
		perm := model.Permission{}
		if err := db.Where("code = ?", def.Code).FirstOrCreate(&perm, model.Permission{
			ID:     uuid.NewString(),
			Code:   def.Code,
			Name:   def.Code,
			Module: def.Module,
		}).Error; err != nil {
			return err
		}
		perms[def.Code] = perm
	}

	rolePerms := map[string][]string{
		"ADMIN": {
			"USER_MANAGE", "ACCOUNT_MANAGE", "PERMISSION_MANAGE", "SYSTEM_SETTINGS",
			"STUDENT_VIEW", "STUDENT_EDIT", "STUDENT_IMPORT", "STUDENT_EXPORT",
			"TEACHER_MANAGE", "TEACHER_IMPORT", "TEACHER_EXPORT",
			"DORM_VIEW", "DORM_EDIT", "DORM_IMPORT", "DORM_EXPORT", "DORM_CHECKIN_MANAGE",
			"TASK_PUBLISH", "RESULT_VIEW", "RESULT_RECORD",
		},
		"COUNSELOR": {
			"STUDENT_VIEW", "STUDENT_EDIT", "STUDENT_IMPORT", "STUDENT_EXPORT",
			"DORM_VIEW", "RESULT_VIEW", "RESULT_RECORD", "TASK_PUBLISH",
		},
		"LEADER": {
			"RESULT_VIEW", "RESULT_RECORD",
		},
	}

	for roleCode, permCodes := range rolePerms {
		role, ok := roles[roleCode]
		if !ok {
			continue
		}
		for _, permCode := range permCodes {
			perm, ok := perms[permCode]
			if !ok {
				continue
			}
			record := model.RolePermission{}
			if err := db.Where("roleId = ? AND permissionId = ?", role.ID, perm.ID).
				FirstOrCreate(&record, model.RolePermission{
					ID:           uuid.NewString(),
					RoleID:       role.ID,
					PermissionID: perm.ID,
				}).Error; err != nil {
				return err
			}
		}
	}

	hashed, err := utils.HashPassword("AuthzTest123!")
	if err != nil {
		return err
	}

	users := []struct {
		Username string
		FullName string
		Role     string
	}{
		{Username: "admin_authz", FullName: "Admin Authz", Role: "ADMIN"},
		{Username: "counselor_authz", FullName: "Counselor Authz", Role: "COUNSELOR"},
		{Username: "leader_authz", FullName: "Leader Authz", Role: "LEADER"},
		{Username: "student_authz", FullName: "Student Authz", Role: "STUDENT"},
		{Username: "noperm_authz", FullName: "NoPerm Authz", Role: "STUDENT"},
	}

	now := time.Now()
	userIDs := map[string]string{}
	for _, def := range users {
		user := model.User{}
		assign := model.User{
			Password:  hashed,
			Role:      def.Role,
			FullName:  def.FullName,
			CreatedAt: now,
		}
		if err := db.Where("username = ?", def.Username).
			Assign(assign).
			FirstOrCreate(&user, model.User{
				ID:        uuid.NewString(),
				Username:  def.Username,
				Password:  hashed,
				Role:      def.Role,
				FullName:  def.FullName,
				CreatedAt: now,
			}).Error; err != nil {
			return err
		}
		userIDs[def.Username] = user.ID
	}

	studentUserID := userIDs["student_authz"]
	if studentUserID != "" {
		student := model.Student{}
		if err := db.Where("userId = ?", studentUserID).
			FirstOrCreate(&student, model.Student{
				ID:        uuid.NewString(),
				FullName:  "Student Authz",
				UserID:    &studentUserID,
				CreatedAt: now,
			}).Error; err != nil {
			return err
		}
	}

	return nil
}
