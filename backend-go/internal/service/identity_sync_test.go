package service

import (
	"errors"
	"reflect"
	"testing"

	"github.com/my-project/backend-go/internal/model"
	"github.com/my-project/backend-go/internal/repository"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

func identityTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	t.Setenv("DEFAULT_INITIAL_PASSWORD", "TestInit#2026")
	db := openStudentServiceTestDB(t)
	checkIdentityTest(t, db.AutoMigrate(&model.User{}, &model.Student{}, &model.Teacher{}, &model.Dormitory{},
		&model.RoleEntity{}, &model.Permission{}, &model.RolePermission{}, &model.RoleDataScope{}, &model.SystemSettings{}))
	prepareUserRoleJoinTable(t, db)
	for _, code := range []string{"STUDENT", "LEADER", "COUNSELOR", "ADMIN"} {
		checkIdentityTest(t, db.Create(&model.RoleEntity{ID: code, Code: code, Name: code, Status: "ACTIVE"}).Error)
	}
	return db
}

func checkIdentityTest(t *testing.T, err error) {
	t.Helper()
	if err != nil {
		t.Fatal(err)
	}
}

func TestIdentitySyncStudentRoundTripAndContacts(t *testing.T) {
	db := identityTestDB(t)
	students := NewStudentService(repository.NewStudentRepository(db), db, nil)
	users := NewUserService(repository.NewUserRepository(db), db)
	profile := &model.Student{StudentNo: ptr("S1"), FullName: "Before", College: ptr("Science"), Mobile: ptr("123"), QQ: ptr("old-qq")}
	checkIdentityTest(t, students.CreateStudent(profile))
	id := ptrToStr(profile.UserID)
	account, err := users.GetCurrentUser(id)
	checkIdentityTest(t, err)
	if ptrToStr(account.Phone) != "123" || len(account.Roles) != 1 || account.Roles[0].Code != "STUDENT" {
		t.Fatalf("student account not initialized: %+v", account)
	}

	checkIdentityTest(t, users.UpdateUser(id, UpdateUserRequest{Role: ptr("LEADER"), Roles: []string{"LEADER", "STUDENT"}}))
	checkIdentityTest(t, students.UpdateStudent(profile.ID, &model.Student{StudentNo: ptr("S2"), FullName: "New student", Mobile: ptr("456")}))
	admin := model.User{ID: "admin", Username: "admin", FullName: "Admin", Role: "ADMIN", Password: "unused"}
	checkIdentityTest(t, db.Create(&admin).Error)
	audit, err := users.UpdateManagedUser(id, UpdateUserRequest{FullName: ptr("Managed"), Department: ptr("Arts")}, OperatorContext{UserID: admin.ID, Permissions: []string{"USER_MANAGE", "PERMISSION_MANAGE"}})
	checkIdentityTest(t, err)
	if ptrToStr(audit.OldValue["college"].(*string)) != "Science" || audit.NewValue["college"] != "Arts" {
		t.Fatalf("wrong linked-profile audit: %+v", audit)
	}
	var forbidden *ForbiddenError
	counselor := model.User{ID: "counselor", Username: "counselor", FullName: "Counselor", Role: "COUNSELOR", Password: "unused", Department: ptr("Arts")}
	checkIdentityTest(t, db.Create(&counselor).Error)
	_, err = users.UpdateManagedUser(id, UpdateUserRequest{Department: ptr("Science")}, OperatorContext{UserID: counselor.ID, Permissions: []string{"USER_MANAGE"}})
	if !errors.As(err, &forbidden) {
		t.Fatalf("expected department outside counselor scope to be rejected: %v", err)
	}
	err = users.UpdateMyContact(id, SelfContactRequest{Email: ptr("blocked@example.test")}, false)
	if !errors.As(err, &forbidden) {
		t.Fatalf("student promoted to LEADER bypassed contact settings: %v", err)
	}
	checkIdentityTest(t, db.Create(&model.SystemSettings{ID: 1, StudentContactEditable: true, GradingRules: datatypes.JSON(`[]`)}).Error)
	checkIdentityTest(t, users.UpdateMyContact(id, SelfContactRequest{Email: ptr("student@example.test"), QQ: ptr("new-qq")}, true))

	account, err = users.GetCurrentUser(id)
	checkIdentityTest(t, err)
	if account.Username != "S2" || account.Role != "LEADER" || len(account.Roles) != 2 ||
		ptrToStr(account.Phone) != "456" || ptrToStr(account.Email) != "student@example.test" {
		t.Fatalf("account lost synchronized data or roles: %+v", account)
	}
	checkIdentityTest(t, users.UpdateMyContact(id, SelfContactRequest{Phone: ptr("")}, false))
	saved, err := students.GetStudentByID(profile.ID)
	checkIdentityTest(t, err)
	if ptrToStr(saved.Mobile) != "" || ptrToStr(saved.Phone) != "" || ptrToStr(saved.QQ) != "new-qq" ||
		saved.FullName != "Managed" || ptrToStr(saved.College) != "Arts" {
		t.Fatalf("wrong student after reverse sync: %+v", saved)
	}
}

func TestIdentitySyncRollsBackAccountAndRolesWhenProfileWriteFails(t *testing.T) {
	db := identityTestDB(t)
	students := NewStudentService(repository.NewStudentRepository(db), db, nil)
	users := NewUserService(repository.NewUserRepository(db), db)
	profile := &model.Student{StudentNo: ptr("S1"), FullName: "Before"}
	checkIdentityTest(t, students.CreateStudent(profile))
	checkIdentityTest(t, db.Exec("CREATE TRIGGER reject_profile_name BEFORE UPDATE OF fullName ON student BEGIN SELECT RAISE(ABORT, 'blocked profile name'); END").Error)

	err := users.UpdateUser(*profile.UserID, UpdateUserRequest{FullName: ptr("After"), Role: ptr("LEADER"), Roles: []string{"LEADER"}})
	if err == nil {
		t.Fatal("profile update should fail")
	}
	user, err := users.GetCurrentUser(*profile.UserID)
	checkIdentityTest(t, err)
	if user.FullName != "Before" || user.Role != "STUDENT" || len(user.Roles) != 1 || user.Roles[0].Code != "STUDENT" {
		t.Fatalf("profile failure did not roll back user and roles: %+v", user)
	}
}

func TestIdentitySyncTeacherKeepsAdministratorAndRollsBackNumberConflict(t *testing.T) {
	db := identityTestDB(t)
	teachers := NewTeacherService(repository.NewTeacherRepository(db), db, nil)
	users := NewUserService(repository.NewUserRepository(db), db)
	teacher := &model.Teacher{EmployeeNo: ptr("T1"), FullName: "Teacher", Department: ptr("Science")}
	checkIdentityTest(t, teachers.Create(teacher))
	id := ptrToStr(teacher.UserID)
	checkIdentityTest(t, users.UpdateUser(id, UpdateUserRequest{Role: ptr("ADMIN"), Roles: []string{"ADMIN", "COUNSELOR"}}))
	checkIdentityTest(t, teachers.Update(teacher.ID, &model.Teacher{EmployeeNo: ptr("T2"), FullName: "Renamed"}))
	checkIdentityTest(t, users.UpdateMyContact(id, SelfContactRequest{Phone: ptr("123")}, false))
	checkIdentityTest(t, users.UpdateUser(id, UpdateUserRequest{FullName: ptr("Account name"), Department: ptr("Arts")}))
	_, _, err := users.CreateUser(CreateUserRequest{Username: "occupied", FullName: "Independent", Role: "ADMIN", Roles: []string{"ADMIN"}})
	checkIdentityTest(t, err)
	if err := teachers.Update(teacher.ID, &model.Teacher{EmployeeNo: ptr("occupied"), FullName: "Must roll back"}); !errors.Is(err, ErrIdentityConflict) {
		t.Fatalf("number collision returned %v", err)
	}
	var saved model.Teacher
	checkIdentityTest(t, db.Take(&saved, "id = ?", teacher.ID).Error)
	if ptrToStr(saved.EmployeeNo) != "T2" || saved.FullName != "Account name" || ptrToStr(saved.Department) != "Arts" ||
		ptrToStr(saved.Mobile) != "123" || ptrToStr(saved.UserID) != id {
		t.Fatalf("teacher not synchronized, or conflict was not rolled back: %+v", saved)
	}
	account, err := users.GetCurrentUser(id)
	checkIdentityTest(t, err)
	if account.Username != "T2" || account.Role != "ADMIN" || len(account.Roles) != 2 || ptrToStr(account.UserType) != "TEACHER" {
		t.Fatalf("teacher account identity or roles changed unexpectedly: %+v", account)
	}
}

func TestIdentityImportOverwriteKeepsBindingAndCommitsEachRow(t *testing.T) {
	db := identityTestDB(t)
	students := NewStudentService(repository.NewStudentRepository(db), db, nil)
	profile := &model.Student{StudentNo: ptr("S1"), FullName: "Before", IsMonitor: true}
	checkIdentityTest(t, students.CreateStudent(profile))
	checkIdentityTest(t, db.Create(&model.Dormitory{ID: "dorm"}).Error)
	checkIdentityTest(t, db.Model(profile).Updates(map[string]any{"dormId": "dorm", "building": "A", "roomNo": "101", "bedNo": "1"}).Error)
	checkIdentityTest(t, db.Create(&model.User{ID: "occupied", Username: "S3", FullName: "Independent", Password: "unused", Role: "ADMIN", UserType: ptr("ADMIN")}).Error)
	monitor := false
	response, err := students.BatchImportV2([]model.StudentImportRow{
		{RowNo: 2, StudentNo: ptr("S1"), FullName: ptr("Overwrite"), Gender: ptr("F"), Mobile: ptr("123"), IsMonitor: &monitor},
		{RowNo: 3, StudentNo: ptr("S3"), FullName: ptr("Conflict"), Gender: ptr("F")},
		{RowNo: 4, StudentNo: ptr("S4"), FullName: ptr("Created"), Gender: ptr("F")},
	}, "OVERWRITE")
	checkIdentityTest(t, err)
	if response.UpdatedCount != 1 || response.CreatedCount != 1 || response.SuccessCount != 2 ||
		response.FailedCount != 1 || response.FailedRows[0].RowNo != 3 {
		t.Fatalf("wrong import results: %+v", response)
	}
	saved, err := students.GetStudentByID(profile.ID)
	checkIdentityTest(t, err)
	if ptrToStr(saved.UserID) != ptrToStr(profile.UserID) || !saved.CreatedAt.Equal(profile.CreatedAt) || saved.IsMonitor ||
		ptrToStr(saved.DormID) != "dorm" || ptrToStr(saved.DormBuilding) != "A" || ptrToStr(saved.DormRoomNo) != "101" ||
		ptrToStr(saved.BedNo) != "1" || saved.FullName != "Overwrite" {
		t.Fatalf("overwrite lost protected fields or skipped supplied fields: %+v", saved)
	}
	if _, err := students.GetStudentByNo("S3"); !errors.Is(err, gorm.ErrRecordNotFound) {
		t.Fatalf("failed row left a student record: %v", err)
	}
}

func TestIdentityDeletionDisablesAccountsAndKeepsProtectedLogin(t *testing.T) {
	db := identityTestDB(t)
	var invalidated []string
	invalidate := func(ids ...string) { invalidated = append(invalidated, ids...) }
	teachers := NewTeacherService(repository.NewTeacherRepository(db), db, invalidate)
	users := NewUserService(repository.NewUserRepository(db), db)
	ordinary := &model.Teacher{EmployeeNo: ptr("T1"), FullName: "Ordinary"}
	protected := &model.Teacher{EmployeeNo: ptr("T2"), FullName: "Protected"}
	self := &model.Teacher{EmployeeNo: ptr("T3"), FullName: "Current operator"}
	for _, teacher := range []*model.Teacher{ordinary, protected, self} {
		checkIdentityTest(t, teachers.Create(teacher))
	}
	checkIdentityTest(t, users.UpdateUser(*protected.UserID, UpdateUserRequest{Role: ptr("ADMIN"), Roles: []string{"ADMIN"}}))
	result, err := teachers.Delete([]string{ordinary.ID, protected.ID, self.ID}, OperatorContext{UserID: *self.UserID})
	checkIdentityTest(t, err)
	if !reflect.DeepEqual(result.DisabledUserIDs, []string{*ordinary.UserID}) || !reflect.DeepEqual(invalidated, result.DisabledUserIDs) ||
		len(result.RetainedUserIDs) != 2 {
		t.Fatalf("wrong deletion result or cache invalidation: %+v, %v", result, invalidated)
	}
	for _, teacher := range []*model.Teacher{ordinary, protected, self} {
		account, err := users.GetCurrentUser(*teacher.UserID)
		checkIdentityTest(t, err)
		if account.IsDisabled != (teacher == ordinary) || (teacher == ordinary && account.TokenVersion != 2) {
			t.Fatalf("unexpected account state after deletion: %+v", account)
		}
		if err := db.Take(&model.Teacher{}, "id = ?", teacher.ID).Error; !errors.Is(err, gorm.ErrRecordNotFound) {
			t.Fatalf("profile was not deleted: %v", err)
		}
	}
}
