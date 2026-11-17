package controller

import (
	"bytes"
	"testing"

	gormsqlite "github.com/glebarez/sqlite"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/my-project/backend-go/internal/model"
	"github.com/my-project/backend-go/internal/service"
	"gorm.io/datatypes"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"github.com/xuri/excelize/v2"
	"net/http/httptest"
)

func TestExportStudents_RespectsAcademicScope(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := openStudentExportTestDB(t)
	if err := db.AutoMigrate(&model.RoleEntity{}, &model.RoleDataScope{}, &model.User{}, &model.Student{}, &model.Dormitory{}, &model.DormBed{}); err != nil {
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
		Code:     "SCOPE_ROLE",
		Name:     "Scope Role",
		TypeCode: "CUSTOM",
		Status:   "ACTIVE",
	}
	if err := db.Create(&role).Error; err != nil {
		t.Fatalf("seed role failed: %v", err)
	}
	rules := datatypes.JSON([]byte(`{"academic":{"college":["计算机学院"],"major":[],"className":[]},"dormitory":{"building":[],"floor":[],"room":[]}}`))
	scope := model.RoleDataScope{
		ID:         uuid.NewString(),
		RoleID:     role.ID,
		ScopeMode:  "ACADEMIC",
		PresetCode: "ACADEMIC",
		RulesJSON:  rules,
	}
	if err := db.Create(&scope).Error; err != nil {
		t.Fatalf("seed role scope failed: %v", err)
	}

	user := model.User{
		ID:       uuid.NewString(),
		Username: "exporter",
		Password: "x",
		Role:     role.Code,
		FullName: "Exporter",
	}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("seed user failed: %v", err)
	}

	collegeA := "计算机学院"
	collegeB := "外国语学院"
	studentNoA := "2024001"
	studentNoB := "2024002"
	if err := db.Create(&model.Student{
		ID:        uuid.NewString(),
		StudentNo: &studentNoA,
		FullName:  "张三",
		College:   &collegeA,
	}).Error; err != nil {
		t.Fatalf("seed scoped student failed: %v", err)
	}
	if err := db.Create(&model.Student{
		ID:        uuid.NewString(),
		StudentNo: &studentNoB,
		FullName:  "李四",
		College:   &collegeB,
	}).Error; err != nil {
		t.Fatalf("seed out-of-scope student failed: %v", err)
	}

	controller := NewStudentController(db, nil)
	resolvedScope, err := service.ResolveUserDataScopeByUserID(db, user.ID)
	if err != nil {
		t.Fatalf("resolve scope failed: %v", err)
	}
	var scopedStudents []model.Student
	if err := service.ApplyAcademicScopeToStudentQuery(db.Model(&model.Student{}), resolvedScope).Preload("Bed.Dorm").Find(&scopedStudents).Error; err != nil {
		t.Fatalf("direct scoped query failed: %v", err)
	}
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Set("userId", user.ID)

	controller.ExportStudents(ctx)

	if recorder.Code != 200 {
		t.Fatalf("expected 200, got %d: %s", recorder.Code, recorder.Body.String())
	}

	file, err := excelize.OpenReader(bytes.NewReader(recorder.Body.Bytes()))
	if err != nil {
		t.Fatalf("open excel failed: %v", err)
	}
	defer file.Close()

	rows, err := file.GetRows("学生信息")
	if err != nil {
		t.Fatalf("read rows failed: %v", err)
	}
	if len(rows) != 2 {
		t.Fatalf("expected header + 1 scoped row, got %d rows", len(rows))
	}
	if len(rows[1]) < 2 || rows[1][1] != "张三" {
		t.Fatalf("expected exported scoped student 张三, got %#v", rows[1])
	}
}

func openStudentExportTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	db, err := gorm.Open(gormsqlite.Open("file:"+uuid.NewString()+"?mode=memory&cache=shared"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		t.Fatalf("open db failed: %v", err)
	}
	return db
}
