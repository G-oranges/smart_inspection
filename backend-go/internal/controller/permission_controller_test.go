package controller

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	gormsqlite "github.com/glebarez/sqlite"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/my-project/backend-go/internal/model"
	"github.com/my-project/backend-go/internal/service"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func TestGetRoleDataScope_ReturnsNotFoundForMissingRole(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := openPermissionControllerTestDB(t)
	if err := db.AutoMigrate(&model.RoleEntity{}, &model.RoleDataScope{}); err != nil {
		t.Fatalf("migrate failed: %v", err)
	}

	controller := NewPermissionController(service.NewPermissionService(db))
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Params = gin.Params{{Key: "id", Value: uuid.NewString()}}

	controller.GetRoleDataScope(ctx)

	if recorder.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", recorder.Code)
	}
}

func TestSaveRoleDataScope_ReturnsNotFoundForMissingRole(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := openPermissionControllerTestDB(t)
	if err := db.AutoMigrate(&model.RoleEntity{}, &model.RoleDataScope{}, &model.Student{}, &model.Dormitory{}); err != nil {
		t.Fatalf("migrate failed: %v", err)
	}

	payload := service.RoleDataScopePayload{
		ScopeMode:  "ALL",
		PresetCode: "ALL",
		Rules: service.RoleDataScopeRules{
			Academic: map[string][]string{
				"college":   []string{},
				"major":     []string{},
				"className": []string{},
			},
			Dormitory: map[string][]string{
				"building": []string{},
				"floor":    []string{},
				"room":     []string{},
			},
		},
	}
	body, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("marshal payload failed: %v", err)
	}

	controller := NewPermissionController(service.NewPermissionService(db))
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Params = gin.Params{{Key: "id", Value: uuid.NewString()}}
	ctx.Request = httptest.NewRequest(http.MethodPut, "/api/roles/missing/data-scope", bytes.NewReader(body))
	ctx.Request.Header.Set("Content-Type", "application/json")
	ctx.Set("permissions", []string{"PERMISSION_MANAGE"})
	ctx.Set("userId", uuid.NewString())
	ctx.Set("fullName", "tester")

	controller.SaveRoleDataScope(ctx)

	if recorder.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", recorder.Code)
	}
}

func openPermissionControllerTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	db, err := gorm.Open(gormsqlite.Open("file:"+uuid.NewString()+"?mode=memory&cache=shared"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		t.Fatalf("open db failed: %v", err)
	}
	return db
}
