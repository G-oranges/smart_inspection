package service

import (
	"testing"

	gormsqlite "github.com/glebarez/sqlite"
	"github.com/google/uuid"
	"github.com/my-project/backend-go/internal/model"
	"github.com/my-project/backend-go/internal/repository"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func TestStudentServiceUpdateStudentSyncsUserDepartmentFromCollege(t *testing.T) {
	// 导入学生会自动建账号，初始密码只从环境变量读取
	t.Setenv("DEFAULT_INITIAL_PASSWORD", "TestInit#2026")
	db := openStudentServiceTestDB(t)
	if err := db.AutoMigrate(&model.User{}, &model.RoleEntity{}, &model.Student{}); err != nil {
		t.Fatalf("migrate failed: %v", err)
	}
	if err := db.Exec("CREATE TABLE IF NOT EXISTS `_roleentitytouser` (A char(36) NOT NULL, B char(36) NOT NULL, PRIMARY KEY (A, B))").Error; err != nil {
		t.Fatalf("create join table failed: %v", err)
	}

	studentRole := model.RoleEntity{
		ID:       uuid.NewString(),
		Code:     "STUDENT",
		Name:     "学生",
		Status:   "ACTIVE",
		TypeCode: "SYSTEM",
	}
	if err := db.Create(&studentRole).Error; err != nil {
		t.Fatalf("seed student role failed: %v", err)
	}

	service := NewStudentService(repository.NewStudentRepository(db), db)
	student := &model.Student{
		StudentNo: studentServiceStringPtr("2024001"),
		FullName:  "张三",
		College:   studentServiceStringPtr("计算机学院"),
	}
	if err := service.CreateStudent(student); err != nil {
		t.Fatalf("create student failed: %v", err)
	}

	var createdUser model.User
	if err := db.First(&createdUser, "username = ?", "2024001").Error; err != nil {
		t.Fatalf("load created user failed: %v", err)
	}
	if got := ptrToStr(createdUser.Department); got != "计算机学院" {
		t.Fatalf("expected created user department to be 计算机学院, got %q", got)
	}

	updatePayload := &model.Student{
		StudentNo: studentServiceStringPtr("2024001"),
		FullName:  "张三",
		College:   studentServiceStringPtr("外国语学院"),
	}
	if err := service.UpdateStudent(student.ID, updatePayload); err != nil {
		t.Fatalf("update student failed: %v", err)
	}

	var updatedUser model.User
	if err := db.First(&updatedUser, "id = ?", createdUser.ID).Error; err != nil {
		t.Fatalf("load updated user failed: %v", err)
	}
	if got := ptrToStr(updatedUser.Department); got != "外国语学院" {
		t.Fatalf("expected updated user department to be 外国语学院, got %q", got)
	}
}

func openStudentServiceTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	db, err := gorm.Open(gormsqlite.Open("file:"+uuid.NewString()+"?mode=memory&cache=shared"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		t.Fatalf("open db failed: %v", err)
	}
	return db
}

func studentServiceStringPtr(value string) *string {
	return &value
}
