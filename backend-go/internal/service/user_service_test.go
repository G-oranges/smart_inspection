package service

import (
	"strings"
	"testing"

	gormsqlite "github.com/glebarez/sqlite"
	"github.com/google/uuid"
	"github.com/my-project/backend-go/internal/model"
	"github.com/my-project/backend-go/internal/repository"
	"gorm.io/gorm"
)

func TestUserServiceCreateUserRoleValidation(t *testing.T) {
	db := openServiceTestDB(t)
	if err := db.AutoMigrate(&model.User{}, &model.RoleEntity{}); err != nil {
		t.Fatalf("migrate failed: %v", err)
	}
	prepareUserRoleJoinTable(t, db)

	activeRole := model.RoleEntity{
		ID:       uuid.NewString(),
		Code:     "ACTIVE_ROLE",
		Name:     "Active Role",
		Status:   "ACTIVE",
		TypeCode: "CUSTOM",
	}
	inactiveRole := model.RoleEntity{
		ID:       uuid.NewString(),
		Code:     "INACTIVE_ROLE",
		Name:     "Inactive Role",
		Status:   "INACTIVE",
		TypeCode: "CUSTOM",
	}
	otherRole := model.RoleEntity{
		ID:       uuid.NewString(),
		Code:     "OTHER_ROLE",
		Name:     "Other Role",
		Status:   "ACTIVE",
		TypeCode: "CUSTOM",
	}
	if err := db.Create(&[]model.RoleEntity{activeRole, inactiveRole, otherRole}).Error; err != nil {
		t.Fatalf("seed roles failed: %v", err)
	}

	service := NewUserService(repository.NewUserRepository(db), db)

	testCases := []struct {
		name    string
		req     CreateUserRequest
		wantErr string
	}{
		{
			name: "reject inactive role",
			req: CreateUserRequest{
				Username: "inactive_user",
				FullName: "Inactive User",
				Role:     inactiveRole.Code,
				Roles:    []string{inactiveRole.ID},
			},
			wantErr: "不能分配停用角色",
		},
		{
			name: "reject primary role mismatch",
			req: CreateUserRequest{
				Username: "mismatch_user",
				FullName: "Mismatch User",
				Role:     otherRole.Code,
				Roles:    []string{activeRole.ID},
			},
			wantErr: "主角色必须包含在附加角色中",
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			_, _, err := service.CreateUser(testCase.req)
			if err == nil || !strings.Contains(err.Error(), testCase.wantErr) {
				t.Fatalf("expected error containing %q, got %v", testCase.wantErr, err)
			}
		})
	}
}

func TestUserServiceGetUsersNormalizesDepartmentsAndRoles(t *testing.T) {
	db := openServiceTestDB(t)
	if err := db.AutoMigrate(&model.User{}, &model.RoleEntity{}, &model.Student{}, &model.Teacher{}); err != nil {
		t.Fatalf("migrate failed: %v", err)
	}
	prepareUserRoleJoinTable(t, db)

	studentRole := model.RoleEntity{ID: uuid.NewString(), Code: "STUDENT", Name: "学生", Status: "ACTIVE", TypeCode: "SYSTEM"}
	counselorRole := model.RoleEntity{ID: uuid.NewString(), Code: "COUNSELOR", Name: "辅导员", Status: "ACTIVE", TypeCode: "SYSTEM"}
	customRole := model.RoleEntity{ID: uuid.NewString(), Code: "CUSTOM_REVIEWER", Name: "审核员", Status: "ACTIVE", TypeCode: "CUSTOM"}
	if err := db.Create(&[]model.RoleEntity{studentRole, counselorRole, customRole}).Error; err != nil {
		t.Fatalf("seed roles failed: %v", err)
	}

	studentUser := model.User{
		ID:       uuid.NewString(),
		Username: "2024001",
		Password: "x",
		Role:     "STUDENT",
		FullName: "学生甲",
		UserType: testStringPtr("STUDENT"),
	}
	teacherUser := model.User{
		ID:       uuid.NewString(),
		Username: "T001",
		Password: "x",
		Role:     "COUNSELOR",
		FullName: "教师甲",
		UserType: testStringPtr("TEACHER"),
	}
	seedUser := model.User{
		ID:         uuid.NewString(),
		Username:   "seed-admin",
		Password:   "x",
		Role:       "COUNSELOR",
		FullName:   "多角色用户",
		Department: testStringPtr("系统管理部"),
	}
	if err := db.Create(&[]model.User{studentUser, teacherUser, seedUser}).Error; err != nil {
		t.Fatalf("seed users failed: %v", err)
	}

	if err := db.Create(&model.Student{
		ID:        uuid.NewString(),
		StudentNo: testStringPtr(studentUser.Username),
		FullName:  studentUser.FullName,
		College:   testStringPtr("计算机学院"),
		UserID:    testStringPtr(studentUser.ID),
	}).Error; err != nil {
		t.Fatalf("seed student failed: %v", err)
	}
	if err := db.Create(&model.Teacher{
		ID:         uuid.NewString(),
		EmployeeNo: testStringPtr(teacherUser.Username),
		FullName:   teacherUser.FullName,
		Department: testStringPtr("外国语学院"),
	}).Error; err != nil {
		t.Fatalf("seed teacher failed: %v", err)
	}

	if err := db.Exec("INSERT INTO `_roleentitytouser` (A, B) VALUES (?, ?), (?, ?), (?, ?), (?, ?)",
		studentRole.ID, studentUser.ID,
		counselorRole.ID, teacherUser.ID,
		counselorRole.ID, seedUser.ID,
		customRole.ID, seedUser.ID,
	).Error; err != nil {
		t.Fatalf("seed user roles failed: %v", err)
	}

	service := NewUserService(repository.NewUserRepository(db), db)
	users, total, err := service.GetUsers(1, 10, nil)
	if err != nil {
		t.Fatalf("get users failed: %v", err)
	}
	if total != 3 {
		t.Fatalf("expected total 3, got %d", total)
	}

	usersByUsername := make(map[string]model.User, len(users))
	for _, user := range users {
		usersByUsername[user.Username] = user
	}

	if got := ptrToStr(usersByUsername["2024001"].Department); got != "计算机学院" {
		t.Fatalf("expected student department to be 计算机学院, got %q", got)
	}
	if got := ptrToStr(usersByUsername["T001"].Department); got != "外国语学院" {
		t.Fatalf("expected teacher department to be 外国语学院, got %q", got)
	}
	if len(usersByUsername["seed-admin"].Roles) != 2 {
		t.Fatalf("expected seed-admin to have 2 roles, got %d", len(usersByUsername["seed-admin"].Roles))
	}

	var persistedStudentUser model.User
	if err := db.First(&persistedStudentUser, "id = ?", studentUser.ID).Error; err != nil {
		t.Fatalf("reload student user failed: %v", err)
	}
	if got := ptrToStr(persistedStudentUser.Department); got != "计算机学院" {
		t.Fatalf("expected persisted student department to be backfilled, got %q", got)
	}

	var persistedTeacherUser model.User
	if err := db.First(&persistedTeacherUser, "id = ?", teacherUser.ID).Error; err != nil {
		t.Fatalf("reload teacher user failed: %v", err)
	}
	if got := ptrToStr(persistedTeacherUser.Department); got != "外国语学院" {
		t.Fatalf("expected persisted teacher department to be backfilled, got %q", got)
	}
}

func openServiceTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(gormsqlite.Open("file:"+uuid.NewString()+"?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open db failed: %v", err)
	}
	return db
}

func prepareUserRoleJoinTable(t *testing.T, db *gorm.DB) {
	t.Helper()
	if err := db.Exec("DROP TABLE IF EXISTS `_roleentitytouser`").Error; err != nil {
		t.Fatalf("drop join table failed: %v", err)
	}
	if err := db.Exec("CREATE TABLE IF NOT EXISTS `_roleentitytouser` (A char(36) NOT NULL, B char(36) NOT NULL, PRIMARY KEY (A, B))").Error; err != nil {
		t.Fatalf("create join table failed: %v", err)
	}
}

func testStringPtr(value string) *string {
	return &value
}
