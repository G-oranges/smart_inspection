package service

import (
	"testing"

	gormsqlite "github.com/glebarez/sqlite"
	"github.com/google/uuid"
	"github.com/my-project/backend-go/internal/model"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func TestEnsureRoleTypeCatalog_DoesNotRewriteRoleTypeCode(t *testing.T) {
	db := openRoleTypeBootstrapTestDB(t)
	if err := db.AutoMigrate(&model.RoleType{}, &model.RoleEntity{}); err != nil {
		t.Fatalf("migrate failed: %v", err)
	}

	legacyType := "LEGACY_TYPE"
	role := model.RoleEntity{
		ID:       uuid.NewString(),
		Code:     "CUSTOM_ROLE",
		Name:     "自定义角色",
		TypeCode: legacyType,
		Status:   "ACTIVE",
	}
	if err := db.Create(&role).Error; err != nil {
		t.Fatalf("seed role failed: %v", err)
	}

	if err := EnsureRoleTypeCatalog(db); err != nil {
		t.Fatalf("EnsureRoleTypeCatalog failed: %v", err)
	}

	var reloaded model.RoleEntity
	if err := db.Where("id = ?", role.ID).First(&reloaded).Error; err != nil {
		t.Fatalf("reload role failed: %v", err)
	}
	if reloaded.TypeCode != legacyType {
		t.Fatalf("expected role type code to remain %q, got %q", legacyType, reloaded.TypeCode)
	}

	var count int64
	if err := db.Model(&model.RoleType{}).Where("code IN ?", []string{"SYSTEM", "BUSINESS", "CUSTOM"}).Count(&count).Error; err != nil {
		t.Fatalf("count role types failed: %v", err)
	}
	if count != 3 {
		t.Fatalf("expected 3 default role types, got %d", count)
	}
}

func openRoleTypeBootstrapTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	db, err := gorm.Open(gormsqlite.Open("file::memory:?cache=shared"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		t.Fatalf("open sqlite failed: %v", err)
	}
	return db
}
