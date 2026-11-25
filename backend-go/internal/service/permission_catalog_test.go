package service

import (
	"slices"
	"testing"

	"github.com/google/uuid"
	"github.com/my-project/backend-go/internal/model"
	"gorm.io/gorm"
)

func TestEnsurePermissionCatalog_InheritsAppealAccessOnce(t *testing.T) {
	db := openDataScopeTestDB(t)
	if err := db.AutoMigrate(&model.User{}, &model.RoleEntity{}, &model.Permission{}, &model.RolePermission{}, &model.UserPermissionOverride{}); err != nil {
		t.Fatal(err)
	}
	makeRows := func(rows ...any) {
		t.Helper()
		for _, row := range rows {
			if err := db.Create(row).Error; err != nil {
				t.Fatal(err)
			}
		}
	}
	roles := []model.RoleEntity{
		{ID: "admin", Code: model.RoleAdmin, Name: "Admin", Status: "ACTIVE"},
		{ID: "recorder", Code: "RECORDER", Name: "Recorder", Status: "ACTIVE"},
	}
	users := []model.User{
		{ID: "deny-view", Username: "deny-view", FullName: "Deny View", Role: "RECORDER", Password: "test"},
		{ID: "deny-both", Username: "deny-both", FullName: "Deny Both", Role: "RECORDER", Password: "test"},
		{ID: "allow-one", Username: "allow-one", FullName: "Allow One", Role: "NONE", Password: "test"},
	}
	makeRows(&roles, &users,
		&model.Permission{ID: "view", Code: "RESULT_VIEW", Name: "View", Module: "result"},
		&model.Permission{ID: "record", Code: "RESULT_RECORD", Name: "Record", Module: "result"},
		&model.RolePermission{ID: "recorder-view", RoleID: "recorder", PermissionID: "view"},
		&model.RolePermission{ID: "recorder-record", RoleID: "recorder", PermissionID: "record"},
		&model.UserPermissionOverride{ID: "deny-view-view", UserID: "deny-view", PermissionID: "view"},
		&model.UserPermissionOverride{ID: "deny-both-view", UserID: "deny-both", PermissionID: "view"},
		&model.UserPermissionOverride{ID: "deny-both-record", UserID: "deny-both", PermissionID: "record"},
		&model.UserPermissionOverride{ID: "allow-one-view", UserID: "allow-one", PermissionID: "view", Allow: true},
	)
	if err := EnsurePermissionCatalog(db); err != nil {
		t.Fatal(err)
	}
	loader := PermissionService{db: db}
	for i, want := range [][2]bool{{true, true}, {false, false}, {true, false}} {
		got, err := loader.loadUserPermissions(&users[i])
		if err != nil || slices.Contains(got, "APPEAL_VIEW") != want[0] || slices.Contains(got, "APPEAL_HANDLE") != want[1] {
			t.Fatalf("%s: effective permissions %v (%v)", users[i].ID, got, err)
		}
	}
	var view model.Permission
	if err := db.First(&view, "code = ?", "APPEAL_VIEW").Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Where("permissionId = ?", view.ID).Delete(&model.RolePermission{}).Error; err != nil {
		t.Fatal(err)
	}
	if err := EnsurePermissionCatalog(db); err != nil {
		t.Fatal(err)
	}
	for _, role := range roles {
		if rolePermissionCodes(t, db, role.ID)["APPEAL_VIEW"] {
			t.Fatalf("restart regranted APPEAL_VIEW to %s", role.Code)
		}
	}
}

func rolePermissionCodes(t *testing.T, db *gorm.DB, roleID string) map[string]bool {
	t.Helper()
	var codes []string
	if err := db.Table("rolepermission").
		Joins("JOIN permission ON permission.id = rolepermission.permissionId").
		Where("rolepermission.roleId = ?", roleID).
		Pluck("permission.code", &codes).Error; err != nil {
		t.Fatalf("load role permissions: %v", err)
	}
	result := map[string]bool{}
	for _, code := range codes {
		result[code] = true
	}
	return result
}

func TestEnsurePermissionCatalog_AddsMissingAndMergesLegacy(t *testing.T) {
	db := openDataScopeTestDB(t)
	if err := db.AutoMigrate(&model.RoleEntity{}, &model.Permission{}, &model.RolePermission{}, &model.UserPermissionOverride{}); err != nil {
		t.Fatalf("migrate failed: %v", err)
	}

	admin := model.RoleEntity{ID: uuid.NewString(), Code: model.RoleAdmin, Name: "管理员", Status: "ACTIVE", TypeCode: "SYSTEM"}
	counselor := model.RoleEntity{ID: uuid.NewString(), Code: "COUNSELOR", Name: "辅导员", Status: "ACTIVE", TypeCode: "SYSTEM"}
	if err := db.Create(&[]model.RoleEntity{admin, counselor}).Error; err != nil {
		t.Fatalf("seed roles: %v", err)
	}
	legacy := model.Permission{ID: uuid.NewString(), Code: "ACCOUNT_MANAGE", Name: "管理系统账号", Module: "account"}
	userManage := model.Permission{ID: uuid.NewString(), Code: "USER_MANAGE", Name: "用户管理", Module: "user"}
	teacherManage := model.Permission{ID: uuid.NewString(), Code: "TEACHER_MANAGE", Name: "教职工管理", Module: "teacher"}
	if err := db.Create(&[]model.Permission{legacy, userManage, teacherManage}).Error; err != nil {
		t.Fatalf("seed permissions: %v", err)
	}
	if err := db.Create(&[]model.RolePermission{
		{ID: uuid.NewString(), RoleID: counselor.ID, PermissionID: legacy.ID},
		{ID: uuid.NewString(), RoleID: counselor.ID, PermissionID: teacherManage.ID},
	}).Error; err != nil {
		t.Fatalf("seed role permissions: %v", err)
	}
	userID := uuid.NewString()
	if err := db.Create(&model.UserPermissionOverride{ID: uuid.NewString(), UserID: userID, PermissionID: legacy.ID, Allow: false}).Error; err != nil {
		t.Fatalf("seed override: %v", err)
	}

	for run := 0; run < 2; run++ {
		if err := EnsurePermissionCatalog(db); err != nil {
			t.Fatalf("run %d: %v", run+1, err)
		}
	}

	var count int64
	db.Model(&model.Permission{}).Where("code = ?", "ACCOUNT_MANAGE").Count(&count)
	if count != 0 {
		t.Fatalf("legacy ACCOUNT_MANAGE should be removed")
	}
	db.Model(&model.Permission{}).Count(&count)
	if int(count) != len(PermissionCatalog) {
		t.Fatalf("expected %d permissions, got %d", len(PermissionCatalog), count)
	}

	counselorCodes := rolePermissionCodes(t, db, counselor.ID)
	for _, code := range []string{"USER_MANAGE", "TEACHER_MANAGE", "TEACHER_IMPORT", "TEACHER_EXPORT"} {
		if !counselorCodes[code] {
			t.Fatalf("counselor should have %s, got %v", code, counselorCodes)
		}
	}
	if counselorCodes["DORM_CHECKIN_MANAGE"] {
		t.Fatalf("counselor had no DORM_EDIT and must not receive DORM_CHECKIN_MANAGE")
	}
	if adminCodes := rolePermissionCodes(t, db, admin.ID); len(adminCodes) != len(PermissionCatalog) {
		t.Fatalf("admin should hold every catalog permission, got %d", len(adminCodes))
	}

	var override model.UserPermissionOverride
	if err := db.Where("userId = ? AND permissionId = ?", userID, userManage.ID).First(&override).Error; err != nil || override.Allow {
		t.Fatalf("legacy deny override should move to USER_MANAGE as deny, got %+v (%v)", override, err)
	}
	var rpCount int64
	db.Model(&model.RolePermission{}).Where("roleId = ?", counselor.ID).Count(&rpCount)
	if int(rpCount) != len(counselorCodes) {
		t.Fatalf("running twice must not create duplicate grants")
	}
}
