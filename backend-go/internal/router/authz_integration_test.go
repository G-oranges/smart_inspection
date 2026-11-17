package router

import (
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	gormsqlite "github.com/glebarez/sqlite"
	"github.com/google/uuid"
	"github.com/my-project/backend-go/internal/model"
	"github.com/my-project/backend-go/internal/service"
	"github.com/my-project/backend-go/pkg/utils"
	gormmysql "gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

const (
	testDSNEnvPrimary   = "AUTHZ_TEST_DATABASE_URL"
	testDSNEnvSecondary = "DATABASE_URL_TEST"
)

func TestAuthz_MissingTokenReturns401(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupAuthzTestDB(t)
	seedAuthzData(t, db)

	router := SetupRouter(db)
	resp := performAuthzRequest(router, http.MethodGet, "/api/roles", "")
	if resp.Code != http.StatusUnauthorized {
		t.Fatalf("expected status %d, got %d", http.StatusUnauthorized, resp.Code)
	}
}

func TestAuthz_AnyPermissionAllows(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupAuthzTestDB(t)
	seed := seedAuthzData(t, db)

	router := SetupRouter(db)

	adminToken := mustAccessToken(t, seed.adminUserID, "ADMIN")
	resp := performAuthzRequest(router, http.MethodGet, "/api/users", adminToken)
	if resp.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, resp.Code)
	}

	counselorToken := mustAccessToken(t, seed.counselorUserID, "COUNSELOR")
	resp = performAuthzRequest(router, http.MethodGet, "/api/users", counselorToken)
	if resp.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, resp.Code)
	}

	noPermToken := mustAccessToken(t, seed.noPermUserID, "NOPERM")
	resp = performAuthzRequest(router, http.MethodGet, "/api/users", noPermToken)
	if resp.Code != http.StatusForbidden {
		t.Fatalf("expected status %d, got %d", http.StatusForbidden, resp.Code)
	}
}

func TestAuthz_RoleChangeDeniesOldToken(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupAuthzTestDB(t)
	seed := seedAuthzData(t, db)

	router := SetupRouter(db)
	adminToken := mustAccessToken(t, seed.adminUserID, "ADMIN")

	resp := performAuthzRequest(router, http.MethodGet, "/api/roles", adminToken)
	if resp.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, resp.Code)
	}

	if err := db.Model(&model.User{}).Where("id = ?", seed.adminUserID).Update("role", "STUDENT").Error; err != nil {
		t.Fatalf("failed to update role: %v", err)
	}

	// Rebuild router to avoid stale permission cache in the shared service.
	router = SetupRouter(db)
	resp = performAuthzRequest(router, http.MethodGet, "/api/roles", adminToken)
	if resp.Code != http.StatusForbidden {
		t.Fatalf("expected status %d, got %d", http.StatusForbidden, resp.Code)
	}
}

func TestAuthz_UnauthorizedCreatesAuditLog(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupAuthzTestDB(t)
	seed := seedAuthzData(t, db)

	router := SetupRouter(db)
	noPermToken := mustAccessToken(t, seed.noPermUserID, "NOPERM")
	resp := performAuthzRequest(router, http.MethodGet, "/api/roles", noPermToken)
	if resp.Code != http.StatusForbidden {
		t.Fatalf("expected status %d, got %d", http.StatusForbidden, resp.Code)
	}

	waitForAuditLog(t, db, "UNAUTHORIZED_ACCESS", "/api/roles")
}

func TestAuthz_RouteMatrix_DeniesMissingPermissions(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupAuthzTestDB(t)
	seed := seedAuthzData(t, db)

	router := SetupRouter(db)
	noPermToken := mustAccessToken(t, seed.noPermUserID, "NOPERM")

	dummyID := "00000000-0000-0000-0000-000000000000"
	cases := []struct {
		method string
		path   string
	}{
		{http.MethodGet, "/api/users"},
		{http.MethodPost, "/api/users"},
		{http.MethodPut, "/api/users/" + dummyID},
		{http.MethodPut, "/api/users/" + dummyID + "/reset-password"},
		{http.MethodPost, "/api/users/" + dummyID + "/temporary-password"},
		{http.MethodDelete, "/api/users"},
		{http.MethodGet, "/api/students"},
		{http.MethodGet, "/api/students/table"},
		{http.MethodPost, "/api/students"},
		{http.MethodPut, "/api/students/" + dummyID},
		{http.MethodDelete, "/api/students"},
		{http.MethodPost, "/api/students/batch-delete"},
		{http.MethodPut, "/api/students/batch-monitor"},
		{http.MethodPost, "/api/students/import"},
		{http.MethodPost, "/api/students/import/preview"},
		{http.MethodGet, "/api/students/export"},
		{http.MethodGet, "/api/teachers"},
		{http.MethodPost, "/api/teachers"},
		{http.MethodPut, "/api/teachers/" + dummyID},
		{http.MethodDelete, "/api/teachers"},
		{http.MethodPost, "/api/teachers/import"},
		{http.MethodPost, "/api/teachers/import/preview"},
		{http.MethodGet, "/api/teachers/export"},
		{http.MethodGet, "/api/buildings"},
		{http.MethodGet, "/api/buildings/all"},
		{http.MethodGet, "/api/buildings/export"},
		{http.MethodPost, "/api/buildings"},
		{http.MethodPost, "/api/buildings/import"},
		{http.MethodPost, "/api/buildings/import/preview"},
		{http.MethodPut, "/api/buildings/" + dummyID},
		{http.MethodDelete, "/api/buildings/" + dummyID},
		{http.MethodDelete, "/api/buildings/batch"},
		{http.MethodGet, "/api/roles"},
		{http.MethodGet, "/api/dorms"},
		{http.MethodGet, "/api/dorm-beds"},
		{http.MethodGet, "/api/dorms/buildings"},
		{http.MethodGet, "/api/dorms/floors"},
		{http.MethodGet, "/api/dorms/rooms"},
		{http.MethodGet, "/api/dorms/find"},
		{http.MethodGet, "/api/dorms/table"},
		{http.MethodGet, "/api/dorms/stats"},
		{http.MethodPost, "/api/dorms"},
		{http.MethodPut, "/api/dorms/" + dummyID},
		{http.MethodDelete, "/api/dorms"},
		{http.MethodGet, "/api/dorms/" + dummyID + "/members"},
		{http.MethodPost, "/api/dorms/batch-delete"},
		{http.MethodPost, "/api/dorms/import"},
		{http.MethodPost, "/api/dorms/import/preview"},
		{http.MethodGet, "/api/dorms/export"},
		{http.MethodPost, "/api/dorms/batch-checkout"},
		{http.MethodPost, "/api/dorms/batch-checkout-students"},
		{http.MethodPost, "/api/dorms/batch-checkin"},
		{http.MethodPost, "/api/dorms/import-checkin"},
		{http.MethodGet, "/api/occupancy/stats"},
		{http.MethodPost, "/api/occupancy/assign"},
		{http.MethodPost, "/api/occupancy/move"},
		{http.MethodPost, "/api/occupancy/swap"},
		{http.MethodPost, "/api/occupancy/checkout"},
		{http.MethodPost, "/api/tasks"},
		{http.MethodGet, "/api/tasks"},
		{http.MethodGet, "/api/tasks/" + dummyID},
		{http.MethodPut, "/api/tasks/" + dummyID},
		{http.MethodDelete, "/api/tasks/" + dummyID},
		{http.MethodPost, "/api/tasks/" + dummyID + "/inspections"},
		{http.MethodGet, "/api/tasks/" + dummyID + "/dorms/my"},
		{http.MethodGet, "/api/tasks/" + dummyID + "/inspections"},
		{http.MethodGet, "/api/inspections"},
		{http.MethodGet, "/api/inspections/mine"},
		{http.MethodPut, "/api/inspections/" + dummyID},
		{http.MethodPost, "/api/inspections/" + dummyID},
		{http.MethodGet, "/api/inspections/export"},
		{http.MethodGet, "/api/appeals"},
		{http.MethodPut, "/api/appeals/" + dummyID + "/status"},
		{http.MethodPut, "/api/settings"},
		{http.MethodGet, "/api/audit-logs"},
		{http.MethodGet, "/api/audit-logs/stats"},
		{http.MethodGet, "/api/audit-logs/options"},
		{http.MethodDelete, "/api/audit-logs"},
		{http.MethodPost, "/api/uploads"},
		{http.MethodPost, "/api/uploads/batch"},
		{http.MethodGet, "/api/permissions/roles"},
		{http.MethodPut, "/api/permissions/roles/" + dummyID},
		{http.MethodGet, "/api/permissions/users/" + dummyID},
		{http.MethodPut, "/api/permissions/users/" + dummyID},
		{http.MethodPut, "/api/permissions/batch-overrides"},
	}

	for _, tc := range cases {
		t.Run(tc.method+" "+tc.path, func(t *testing.T) {
			resp := performAuthzRequest(router, tc.method, tc.path, noPermToken)
			if resp.Code != http.StatusForbidden {
				t.Fatalf("expected status %d, got %d", http.StatusForbidden, resp.Code)
			}
		})
	}
}

func TestAuthz_RouteMatrix_AdminCanReadSensitive(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupAuthzTestDB(t)
	seed := seedAuthzData(t, db)

	router := SetupRouter(db)
	adminToken := mustAccessToken(t, seed.adminUserID, "ADMIN")

	cases := []struct {
		method string
		path   string
	}{
		{http.MethodGet, "/api/roles"},
		{http.MethodGet, "/api/permissions/roles"},
		{http.MethodGet, "/api/permissions/users/" + seed.studentUserID},
		{http.MethodGet, "/api/audit-logs"},
		{http.MethodGet, "/api/audit-logs/stats"},
		{http.MethodGet, "/api/audit-logs/options"},
	}

	for _, tc := range cases {
		t.Run(tc.method+" "+tc.path, func(t *testing.T) {
			resp := performAuthzRequest(router, tc.method, tc.path, adminToken)
			if resp.Code != http.StatusOK {
				t.Fatalf("expected status %d, got %d", http.StatusOK, resp.Code)
			}
		})
	}
}

func setupAuthzTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := openAuthzTestDB(t)
	if err != nil {
		t.Fatalf("failed to open test db: %v", err)
	}

	if err := migrateAuthzTables(db); err != nil {
		t.Fatalf("failed to migrate tables: %v", err)
	}
	if err := truncateAuthzTables(db); err != nil {
		t.Fatalf("failed to truncate tables: %v", err)
	}
	if err := service.EnsureRoleTypeCatalog(db); err != nil {
		t.Fatalf("failed to initialize role types: %v", err)
	}

	service.InitGlobalAuditService(db)
	t.Setenv("JWT_SECRET", "authz_test_secret")
	return db
}

func openAuthzTestDB(t *testing.T) (*gorm.DB, error) {
	t.Helper()
	cfg := &gorm.Config{
		Logger:                                   logger.Default.LogMode(logger.Silent),
		DisableForeignKeyConstraintWhenMigrating: true,
		IgnoreRelationshipsWhenMigrating:         true,
	}

	dsn := getTestDSN()
	if dsn != "" {
		return gorm.Open(gormmysql.Open(dsn), cfg)
	}

	t.Log("AUTHZ_TEST_DATABASE_URL or DATABASE_URL_TEST not set; using in-memory sqlite")
	return gorm.Open(gormsqlite.Open("file:authz_test?mode=memory&cache=shared"), cfg)
}

type authzSeed struct {
	adminUserID     string
	counselorUserID string
	leaderUserID    string
	studentUserID   string
	noPermUserID    string
}

func seedAuthzData(t *testing.T, db *gorm.DB) authzSeed {
	t.Helper()

	roles := []model.RoleEntity{
		{ID: uuid.NewString(), Code: "ADMIN", Name: "Admin", TypeCode: "SYSTEM", Status: "ACTIVE"},
		{ID: uuid.NewString(), Code: "COUNSELOR", Name: "Counselor", TypeCode: "SYSTEM", Status: "ACTIVE"},
		{ID: uuid.NewString(), Code: "LEADER", Name: "Leader", TypeCode: "SYSTEM", Status: "ACTIVE"},
		{ID: uuid.NewString(), Code: "STUDENT", Name: "Student", TypeCode: "SYSTEM", Status: "ACTIVE"},
	}
	if err := db.Create(&roles).Error; err != nil {
		t.Fatalf("failed to create roles: %v", err)
	}
	roleByCode := map[string]model.RoleEntity{}
	for _, role := range roles {
		roleByCode[role.Code] = role
	}

	perms := []model.Permission{
		{ID: uuid.NewString(), Code: "PERMISSION_MANAGE", Name: "PERMISSION_MANAGE", Module: "SYSTEM"},
		{ID: uuid.NewString(), Code: "USER_MANAGE", Name: "USER_MANAGE", Module: "USER"},
		{ID: uuid.NewString(), Code: "SYSTEM_SETTINGS", Name: "SYSTEM_SETTINGS", Module: "SYSTEM"},
		{ID: uuid.NewString(), Code: "STUDENT_VIEW", Name: "STUDENT_VIEW", Module: "STUDENT"},
		{ID: uuid.NewString(), Code: "STUDENT_EDIT", Name: "STUDENT_EDIT", Module: "STUDENT"},
		{ID: uuid.NewString(), Code: "STUDENT_IMPORT", Name: "STUDENT_IMPORT", Module: "STUDENT"},
		{ID: uuid.NewString(), Code: "STUDENT_EXPORT", Name: "STUDENT_EXPORT", Module: "STUDENT"},
		{ID: uuid.NewString(), Code: "TEACHER_MANAGE", Name: "TEACHER_MANAGE", Module: "TEACHER"},
		{ID: uuid.NewString(), Code: "TEACHER_IMPORT", Name: "TEACHER_IMPORT", Module: "TEACHER"},
		{ID: uuid.NewString(), Code: "TEACHER_EXPORT", Name: "TEACHER_EXPORT", Module: "TEACHER"},
		{ID: uuid.NewString(), Code: "DORM_VIEW", Name: "DORM_VIEW", Module: "DORM"},
		{ID: uuid.NewString(), Code: "DORM_EDIT", Name: "DORM_EDIT", Module: "DORM"},
		{ID: uuid.NewString(), Code: "DORM_IMPORT", Name: "DORM_IMPORT", Module: "DORM"},
		{ID: uuid.NewString(), Code: "DORM_EXPORT", Name: "DORM_EXPORT", Module: "DORM"},
		{ID: uuid.NewString(), Code: "DORM_CHECKIN_MANAGE", Name: "DORM_CHECKIN_MANAGE", Module: "DORM"},
		{ID: uuid.NewString(), Code: "TASK_PUBLISH", Name: "TASK_PUBLISH", Module: "TASK"},
		{ID: uuid.NewString(), Code: "TASK_EDIT", Name: "TASK_EDIT", Module: "TASK"},
		{ID: uuid.NewString(), Code: "TASK_DELETE", Name: "TASK_DELETE", Module: "TASK"},
		{ID: uuid.NewString(), Code: "RESULT_EXPORT", Name: "RESULT_EXPORT", Module: "RESULT"},
		{ID: uuid.NewString(), Code: "RESULT_VIEW", Name: "RESULT_VIEW", Module: "RESULT"},
		{ID: uuid.NewString(), Code: "RESULT_RECORD", Name: "RESULT_RECORD", Module: "RESULT"},
	}
	if err := db.Create(&perms).Error; err != nil {
		t.Fatalf("failed to create permissions: %v", err)
	}
	permByCode := map[string]model.Permission{}
	for _, perm := range perms {
		permByCode[perm.Code] = perm
	}

	rolePerms := []model.RolePermission{
		{ID: uuid.NewString(), RoleID: roleByCode["ADMIN"].ID, PermissionID: permByCode["PERMISSION_MANAGE"].ID},
		{ID: uuid.NewString(), RoleID: roleByCode["ADMIN"].ID, PermissionID: permByCode["USER_MANAGE"].ID},
		{ID: uuid.NewString(), RoleID: roleByCode["ADMIN"].ID, PermissionID: permByCode["SYSTEM_SETTINGS"].ID},
		{ID: uuid.NewString(), RoleID: roleByCode["ADMIN"].ID, PermissionID: permByCode["STUDENT_VIEW"].ID},
		{ID: uuid.NewString(), RoleID: roleByCode["ADMIN"].ID, PermissionID: permByCode["STUDENT_EDIT"].ID},
		{ID: uuid.NewString(), RoleID: roleByCode["ADMIN"].ID, PermissionID: permByCode["STUDENT_IMPORT"].ID},
		{ID: uuid.NewString(), RoleID: roleByCode["ADMIN"].ID, PermissionID: permByCode["STUDENT_EXPORT"].ID},
		{ID: uuid.NewString(), RoleID: roleByCode["ADMIN"].ID, PermissionID: permByCode["TEACHER_MANAGE"].ID},
		{ID: uuid.NewString(), RoleID: roleByCode["ADMIN"].ID, PermissionID: permByCode["TEACHER_IMPORT"].ID},
		{ID: uuid.NewString(), RoleID: roleByCode["ADMIN"].ID, PermissionID: permByCode["TEACHER_EXPORT"].ID},
		{ID: uuid.NewString(), RoleID: roleByCode["ADMIN"].ID, PermissionID: permByCode["DORM_VIEW"].ID},
		{ID: uuid.NewString(), RoleID: roleByCode["ADMIN"].ID, PermissionID: permByCode["DORM_EDIT"].ID},
		{ID: uuid.NewString(), RoleID: roleByCode["ADMIN"].ID, PermissionID: permByCode["DORM_IMPORT"].ID},
		{ID: uuid.NewString(), RoleID: roleByCode["ADMIN"].ID, PermissionID: permByCode["DORM_EXPORT"].ID},
		{ID: uuid.NewString(), RoleID: roleByCode["ADMIN"].ID, PermissionID: permByCode["DORM_CHECKIN_MANAGE"].ID},
		{ID: uuid.NewString(), RoleID: roleByCode["ADMIN"].ID, PermissionID: permByCode["TASK_PUBLISH"].ID},
		{ID: uuid.NewString(), RoleID: roleByCode["ADMIN"].ID, PermissionID: permByCode["TASK_EDIT"].ID},
		{ID: uuid.NewString(), RoleID: roleByCode["ADMIN"].ID, PermissionID: permByCode["TASK_DELETE"].ID},
		{ID: uuid.NewString(), RoleID: roleByCode["ADMIN"].ID, PermissionID: permByCode["RESULT_EXPORT"].ID},
		{ID: uuid.NewString(), RoleID: roleByCode["ADMIN"].ID, PermissionID: permByCode["RESULT_VIEW"].ID},
		{ID: uuid.NewString(), RoleID: roleByCode["ADMIN"].ID, PermissionID: permByCode["RESULT_RECORD"].ID},
		{ID: uuid.NewString(), RoleID: roleByCode["COUNSELOR"].ID, PermissionID: permByCode["USER_MANAGE"].ID},
		{ID: uuid.NewString(), RoleID: roleByCode["COUNSELOR"].ID, PermissionID: permByCode["STUDENT_VIEW"].ID},
		{ID: uuid.NewString(), RoleID: roleByCode["COUNSELOR"].ID, PermissionID: permByCode["STUDENT_EDIT"].ID},
		{ID: uuid.NewString(), RoleID: roleByCode["COUNSELOR"].ID, PermissionID: permByCode["STUDENT_IMPORT"].ID},
		{ID: uuid.NewString(), RoleID: roleByCode["COUNSELOR"].ID, PermissionID: permByCode["STUDENT_EXPORT"].ID},
		{ID: uuid.NewString(), RoleID: roleByCode["COUNSELOR"].ID, PermissionID: permByCode["DORM_VIEW"].ID},
		{ID: uuid.NewString(), RoleID: roleByCode["COUNSELOR"].ID, PermissionID: permByCode["RESULT_VIEW"].ID},
		{ID: uuid.NewString(), RoleID: roleByCode["COUNSELOR"].ID, PermissionID: permByCode["RESULT_RECORD"].ID},
		{ID: uuid.NewString(), RoleID: roleByCode["COUNSELOR"].ID, PermissionID: permByCode["TASK_PUBLISH"].ID},
		{ID: uuid.NewString(), RoleID: roleByCode["LEADER"].ID, PermissionID: permByCode["RESULT_VIEW"].ID},
		{ID: uuid.NewString(), RoleID: roleByCode["LEADER"].ID, PermissionID: permByCode["RESULT_RECORD"].ID},
	}
	if err := db.Create(&rolePerms).Error; err != nil {
		t.Fatalf("failed to create role permissions: %v", err)
	}

	now := time.Now()
	adminUserID := uuid.NewString()
	counselorUserID := uuid.NewString()
	leaderUserID := uuid.NewString()
	studentUserID := uuid.NewString()
	noPermUserID := uuid.NewString()
	users := []model.User{
		{
			ID:           adminUserID,
			Username:     "admin_authz",
			Password:     "hashed",
			Role:         "ADMIN",
			FullName:     "Admin Authz",
			CreatedAt:    now,
			TokenVersion: 1,
		},
		{
			ID:           counselorUserID,
			Username:     "counselor_authz",
			Password:     "hashed",
			Role:         "COUNSELOR",
			FullName:     "Counselor Authz",
			CreatedAt:    now,
			TokenVersion: 1,
		},
		{
			ID:           leaderUserID,
			Username:     "leader_authz",
			Password:     "hashed",
			Role:         "LEADER",
			FullName:     "Leader Authz",
			CreatedAt:    now,
			TokenVersion: 1,
		},
		{
			ID:           studentUserID,
			Username:     "student_authz",
			Password:     "hashed",
			Role:         "STUDENT",
			FullName:     "Student Authz",
			CreatedAt:    now,
			TokenVersion: 1,
		},
		{
			ID:           noPermUserID,
			Username:     "noperm_authz",
			Password:     "hashed",
			Role:         "NOPERM",
			FullName:     "NoPerm Authz",
			CreatedAt:    now,
			TokenVersion: 1,
		},
	}
	if err := db.Create(&users).Error; err != nil {
		t.Fatalf("failed to create users: %v", err)
	}

	student := model.Student{
		ID:        uuid.NewString(),
		FullName:  "Student Authz",
		UserID:    &studentUserID,
		CreatedAt: now,
	}
	if err := db.Create(&student).Error; err != nil {
		t.Fatalf("failed to create student: %v", err)
	}

	return authzSeed{
		adminUserID:     adminUserID,
		counselorUserID: counselorUserID,
		leaderUserID:    leaderUserID,
		studentUserID:   studentUserID,
		noPermUserID:    noPermUserID,
	}
}

func migrateAuthzTables(db *gorm.DB) error {
	if err := db.AutoMigrate(
		&model.User{},
		&model.RoleType{},
		&model.RoleEntity{},
		&model.Permission{},
		&model.RolePermission{},
		&model.RoleDataScope{},
		&model.UserPermissionOverride{},
		&model.AuditLog{},
		&model.Student{},
		&model.Teacher{},
	); err != nil {
		return err
	}
	return db.Exec("CREATE TABLE IF NOT EXISTS `_roleentitytouser` (A char(36) NOT NULL, B char(36) NOT NULL, PRIMARY KEY (A, B))").Error
}

func truncateAuthzTables(db *gorm.DB) error {
	statements := []string{
		"DELETE FROM `auditlog`",
		"DELETE FROM `roledatascope`",
		"DELETE FROM `userpermissionoverride`",
		"DELETE FROM `rolepermission`",
		"DELETE FROM `_roleentitytouser`",
		"DELETE FROM `student`",
		"DELETE FROM `teacher`",
		"DELETE FROM `user`",
		"DELETE FROM `roleentity`",
		"DELETE FROM `permission`",
		"DELETE FROM `roletype`",
	}
	for _, stmt := range statements {
		if err := db.Exec(stmt).Error; err != nil {
			return err
		}
	}
	return nil
}

func getTestDSN() string {
	raw := strings.TrimSpace(os.Getenv(testDSNEnvPrimary))
	if raw == "" {
		raw = strings.TrimSpace(os.Getenv(testDSNEnvSecondary))
	}
	if raw == "" {
		return ""
	}
	return normalizeDSN(raw)
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

func mustAccessToken(t *testing.T, userID, role string) string {
	t.Helper()
	token, err := utils.GenerateAccessToken(userID, role, 1) // 使用默认版本号 1
	if err != nil {
		t.Fatalf("failed to generate token: %v", err)
	}
	return token
}

func performAuthzRequest(router http.Handler, method, path, token string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, nil)
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)
	return resp
}

func waitForAuditLog(t *testing.T, db *gorm.DB, action, path string) {
	t.Helper()
	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		var count int64
		query := db.Model(&model.AuditLog{}).Where("action = ?", action)
		if path != "" {
			query = query.Where("description LIKE ?", "%"+path+"%")
		}
		if err := query.Count(&count).Error; err == nil && count > 0 {
			return
		}
		time.Sleep(50 * time.Millisecond)
	}
	t.Fatalf("expected audit log action %s for path %s", action, path)
}
