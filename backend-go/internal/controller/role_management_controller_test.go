package controller

import (
	"testing"

	gormsqlite "github.com/glebarez/sqlite"
	"github.com/google/uuid"
	"github.com/my-project/backend-go/internal/model"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func TestCountRoleAssignments_IncludesPrimaryRoleReference(t *testing.T) {
	db := openRoleControllerTestDB(t)

	role := model.RoleEntity{ID: uuid.NewString(), Code: "CUSTOM_ROLE", Name: "Custom", Status: "ACTIVE", TypeCode: "CUSTOM"}
	user := model.User{ID: uuid.NewString(), Username: "tester", Password: "x", Role: role.Code, FullName: "Tester"}
	if err := db.Create(&role).Error; err != nil {
		t.Fatalf("seed role failed: %v", err)
	}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("seed user failed: %v", err)
	}

	controller := NewRoleController(db, nil)
	count, err := controller.countRoleAssignments(role.ID, role.Code)
	if err != nil {
		t.Fatalf("count role assignments failed: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected primary role reference to be counted, got %d", count)
	}
}

func TestCountRoleAssignments_IncludesLinkedRoleReference(t *testing.T) {
	db := openRoleControllerTestDB(t)

	role := model.RoleEntity{ID: uuid.NewString(), Code: "CUSTOM_ROLE", Name: "Custom", Status: "ACTIVE", TypeCode: "CUSTOM"}
	user := model.User{ID: uuid.NewString(), Username: "tester", Password: "x", Role: "OTHER_ROLE", FullName: "Tester"}
	if err := db.Create(&role).Error; err != nil {
		t.Fatalf("seed role failed: %v", err)
	}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("seed user failed: %v", err)
	}
	if err := db.Exec("INSERT INTO `_roleentitytouser` (A, B) VALUES (?, ?)", role.ID, user.ID).Error; err != nil {
		t.Fatalf("seed join table failed: %v", err)
	}
	controller := NewRoleController(db, nil)
	count, err := controller.countRoleAssignments(role.ID, role.Code)
	if err != nil {
		t.Fatalf("count role assignments failed: %v", err)
	}
	if count != 1 {
		t.Fatalf("expected linked role reference to be counted, got %d", count)
	}
}

func openRoleControllerTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	db, err := gorm.Open(gormsqlite.Open("file:"+uuid.NewString()+"?mode=memory&cache=shared"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		t.Fatalf("open db failed: %v", err)
	}
	if err := db.AutoMigrate(&model.RoleEntity{}, &model.RolePermission{}, &model.RoleDataScope{}, &model.User{}); err != nil {
		t.Fatalf("migrate failed: %v", err)
	}
	if err := db.Exec("DROP TABLE IF EXISTS `_roleentitytouser`").Error; err != nil {
		t.Fatalf("drop join table failed: %v", err)
	}
	if err := db.Exec("CREATE TABLE IF NOT EXISTS `_roleentitytouser` (A char(36) NOT NULL, B char(36) NOT NULL, PRIMARY KEY (A, B))").Error; err != nil {
		t.Fatalf("create join table failed: %v", err)
	}
	return db
}
