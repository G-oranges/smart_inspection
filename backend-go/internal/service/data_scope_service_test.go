package service

import (
	"testing"

	gormsqlite "github.com/glebarez/sqlite"
	"github.com/google/uuid"
	"github.com/my-project/backend-go/internal/model"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

func TestResolveUserDataScope_MergesScopes(t *testing.T) {
	db := openDataScopeTestDB(t)
	if err := db.AutoMigrate(&model.RoleEntity{}, &model.RoleDataScope{}); err != nil {
		t.Fatalf("migrate failed: %v", err)
	}

	academicRole := model.RoleEntity{ID: uuid.NewString(), Code: "ACA_ROLE", Name: "Academic", Status: "ACTIVE", TypeCode: "CUSTOM"}
	dormRole := model.RoleEntity{ID: uuid.NewString(), Code: "DORM_ROLE", Name: "Dorm", Status: "ACTIVE", TypeCode: "CUSTOM"}
	if err := db.Create(&[]model.RoleEntity{academicRole, dormRole}).Error; err != nil {
		t.Fatalf("seed roles failed: %v", err)
	}

	academicRules := datatypes.JSON([]byte(`{"academic":{"college":["计算机学院"],"major":["软件工程"],"className":["软工1班"]},"dormitory":{"building":[],"floor":[],"room":[]}}`))
	dormRules := datatypes.JSON([]byte(`{"academic":{"college":[],"major":[],"className":[]},"dormitory":{"building":["1号楼"],"floor":["2号楼::3"],"room":["3号楼::5::501"]}}`))
	if err := db.Create(&[]model.RoleDataScope{
		{ID: uuid.NewString(), RoleID: academicRole.ID, ScopeMode: "ACADEMIC", PresetCode: "ACADEMIC", RulesJSON: academicRules},
		{ID: uuid.NewString(), RoleID: dormRole.ID, ScopeMode: "DORMITORY", PresetCode: "DORMITORY", RulesJSON: dormRules},
	}).Error; err != nil {
		t.Fatalf("seed role scopes failed: %v", err)
	}

	scope, err := ResolveUserDataScope(db, &model.User{
		ID:    uuid.NewString(),
		Role:  academicRole.Code,
		Roles: []model.RoleEntity{academicRole, dormRole},
	})
	if err != nil {
		t.Fatalf("resolve scope failed: %v", err)
	}

	if scope.All {
		t.Fatalf("expected merged scoped access, got all access")
	}
	if !scope.HasAcademicAccess() || !scope.HasDormitoryAccess() {
		t.Fatalf("expected both academic and dormitory access")
	}
	if _, ok := scope.Academic.Colleges["计算机学院"]; !ok {
		t.Fatalf("expected college scope to include 计算机学院")
	}
	if !scope.AllowsBuilding("1号楼") {
		t.Fatalf("expected building scope to include 1号楼")
	}
	if !scope.AllowsFloor("2号楼", 3) {
		t.Fatalf("expected floor scope to include 2号楼 3层")
	}
	if !scope.AllowsRoom("3号楼", 5, "501") {
		t.Fatalf("expected room scope to include 3号楼 5层 501")
	}
}

func TestResolveUserDataScope_DefaultsToAllWhenRoleScopeMissing(t *testing.T) {
	db := openDataScopeTestDB(t)
	if err := db.AutoMigrate(&model.RoleEntity{}, &model.RoleDataScope{}); err != nil {
		t.Fatalf("migrate failed: %v", err)
	}

	role := model.RoleEntity{ID: uuid.NewString(), Code: "NO_SCOPE_ROLE", Name: "No Scope", Status: "ACTIVE", TypeCode: "CUSTOM"}
	if err := db.Create(&role).Error; err != nil {
		t.Fatalf("seed role failed: %v", err)
	}

	scope, err := ResolveUserDataScope(db, &model.User{
		ID:    uuid.NewString(),
		Role:  role.Code,
		Roles: []model.RoleEntity{role},
	})
	if err != nil {
		t.Fatalf("resolve scope failed: %v", err)
	}
	if !scope.All {
		t.Fatalf("expected missing role scope to default to all access")
	}
}

func TestApplyAcademicScopeToStudentQuery_FiltersScopedStudents(t *testing.T) {
	db := openDataScopeTestDB(t)
	if err := db.AutoMigrate(&model.Student{}); err != nil {
		t.Fatalf("migrate failed: %v", err)
	}

	collegeA := "计算机学院"
	collegeB := "外国语学院"
	majorA := "软件工程"
	majorB := "英语"
	classA := "软工1班"
	classB := "英语1班"
	nameA := "张三"
	nameB := "李四"

	if err := db.Create(&model.Student{
		ID:        uuid.NewString(),
		FullName:  nameA,
		College:   &collegeA,
		Major:     &majorA,
		ClassName: &classA,
	}).Error; err != nil {
		t.Fatalf("seed scoped student failed: %v", err)
	}
	if err := db.Create(&model.Student{
		ID:        uuid.NewString(),
		FullName:  nameB,
		College:   &collegeB,
		Major:     &majorB,
		ClassName: &classB,
	}).Error; err != nil {
		t.Fatalf("seed out-of-scope student failed: %v", err)
	}

	scope := newResolvedUserDataScope()
	scope.Academic.Colleges[collegeA] = struct{}{}

	var students []model.Student
	if err := ApplyAcademicScopeToStudentQuery(db.Model(&model.Student{}), scope).
		Where("student.fullName LIKE ?", "%三%").
		Find(&students).Error; err != nil {
		t.Fatalf("apply academic scope query failed: %v", err)
	}

	if len(students) != 1 || students[0].FullName != nameA {
		t.Fatalf("expected only scoped student %s, got %#v", nameA, students)
	}
}

func openDataScopeTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(gormsqlite.Open("file:"+uuid.NewString()+"?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open db failed: %v", err)
	}
	return db
}
