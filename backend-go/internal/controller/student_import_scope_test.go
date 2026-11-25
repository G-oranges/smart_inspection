package controller

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	gormsqlite "github.com/glebarez/sqlite"
	"github.com/google/uuid"
	"github.com/my-project/backend-go/internal/model"
	"github.com/my-project/backend-go/internal/repository"
	"github.com/my-project/backend-go/internal/service"
	"gorm.io/datatypes"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func TestPreviewImportStudentsV2_AppendsScopeIssues(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, user := openStudentImportScopeTestDB(t)
	controller := NewStudentController(db, service.NewStudentService(repository.NewStudentRepository(db), db, nil), nil)

	studentNo := "2024001"
	fullName := "李四"
	college := "外国语学院"
	reqBody := model.StudentImportPreviewRequest{
		Rows: []model.StudentImportRow{
			{RowNo: 2, StudentNo: &studentNo, FullName: &fullName, College: &college, Gender: strPtr("男")},
		},
	}
	body, err := json.Marshal(reqBody)
	if err != nil {
		t.Fatalf("marshal request failed: %v", err)
	}

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/v2/students/import/preview", bytes.NewReader(body))
	ctx.Request.Header.Set("Content-Type", "application/json")
	ctx.Set("userId", user.ID)

	controller.PreviewImportStudentsV2(ctx)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", recorder.Code, recorder.Body.String())
	}

	var resp model.StudentImportPreviewResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal response failed: %v", err)
	}
	if resp.IssueCount == 0 {
		t.Fatalf("expected scope issue to be appended")
	}
	if resp.Issues[len(resp.Issues)-1].ErrorCode != dataScopeDeniedCode {
		t.Fatalf("expected last issue to be scope denied, got %#v", resp.Issues[len(resp.Issues)-1])
	}
}

func TestImportStudentsV2_ReturnsForbiddenForOutOfScopeRows(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db, user := openStudentImportScopeTestDB(t)
	controller := NewStudentController(db, service.NewStudentService(repository.NewStudentRepository(db), db, nil), nil)

	studentNo := "2024002"
	fullName := "李四"
	college := "外国语学院"
	gender := "男"
	reqBody := model.StudentImportExecuteRequest{
		Strategy: "OVERWRITE",
		Rows: []model.StudentImportRow{
			{RowNo: 2, StudentNo: &studentNo, FullName: &fullName, College: &college, Gender: &gender},
		},
	}
	body, err := json.Marshal(reqBody)
	if err != nil {
		t.Fatalf("marshal request failed: %v", err)
	}

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/v2/students/import/execute", bytes.NewReader(body))
	ctx.Request.Header.Set("Content-Type", "application/json")
	ctx.Set("userId", user.ID)

	controller.ImportStudentsV2(ctx)

	if recorder.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d: %s", recorder.Code, recorder.Body.String())
	}
}

func openStudentImportScopeTestDB(t *testing.T) (*gorm.DB, model.User) {
	t.Helper()

	db, err := gorm.Open(gormsqlite.Open("file:"+uuid.NewString()+"?mode=memory&cache=shared"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		t.Fatalf("open db failed: %v", err)
	}
	if err := db.AutoMigrate(&model.RoleEntity{}, &model.RoleDataScope{}, &model.User{}, &model.Student{}); err != nil {
		t.Fatalf("migrate failed: %v", err)
	}
	if err := db.Exec("DROP TABLE IF EXISTS `_roleentitytouser`").Error; err != nil {
		t.Fatalf("drop join table failed: %v", err)
	}
	if err := db.Exec("CREATE TABLE IF NOT EXISTS `_roleentitytouser` (A char(36) NOT NULL, B char(36) NOT NULL, PRIMARY KEY (A, B))").Error; err != nil {
		t.Fatalf("create join table failed: %v", err)
	}

	role := model.RoleEntity{
		ID:       uuid.NewString(),
		Code:     "STUDENT_SCOPE_ROLE",
		Name:     "Student Scope Role",
		TypeCode: "CUSTOM",
		Status:   "ACTIVE",
	}
	if err := db.Create(&role).Error; err != nil {
		t.Fatalf("seed role failed: %v", err)
	}
	scope := model.RoleDataScope{
		ID:         uuid.NewString(),
		RoleID:     role.ID,
		ScopeMode:  "ACADEMIC",
		PresetCode: "ACADEMIC",
		RulesJSON:  datatypes.JSON([]byte(`{"academic":{"college":["计算机学院"],"major":[],"className":[]},"dormitory":{"building":[],"floor":[],"room":[]}}`)),
	}
	if err := db.Create(&scope).Error; err != nil {
		t.Fatalf("seed role scope failed: %v", err)
	}

	user := model.User{
		ID:       uuid.NewString(),
		Username: "importer",
		Password: "x",
		Role:     role.Code,
		FullName: "Importer",
	}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("seed user failed: %v", err)
	}
	if err := db.Exec("INSERT INTO `_roleentitytouser` (A, B) VALUES (?, ?)", role.ID, user.ID).Error; err != nil {
		t.Fatalf("seed user role failed: %v", err)
	}

	return db, user
}
