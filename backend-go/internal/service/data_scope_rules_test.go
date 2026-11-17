package service

import (
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/my-project/backend-go/internal/model"
	"gorm.io/datatypes"
)

func TestResolveUserDataScope_AcademicRulesNarrowByHierarchy(t *testing.T) {
	db := openDataScopeTestDB(t)
	if err := db.AutoMigrate(&model.RoleEntity{}, &model.RoleDataScope{}, &model.Student{}); err != nil {
		t.Fatalf("migrate failed: %v", err)
	}
	str := func(v string) *string { return &v }
	students := []model.Student{
		{ID: uuid.NewString(), FullName: "a", College: str("工学院"), Major: str("机械"), ClassName: str("机械1班")},
		{ID: uuid.NewString(), FullName: "b", College: str("工学院"), Major: str("机械"), ClassName: str("机械2班")},
		{ID: uuid.NewString(), FullName: "c", College: str("工学院"), Major: str("电气"), ClassName: str("电气1班")},
		{ID: uuid.NewString(), FullName: "d", College: str("理学院"), Major: str("数学"), ClassName: str("数学1班")},
	}
	if err := db.Create(&students).Error; err != nil {
		t.Fatalf("seed students: %v", err)
	}

	cases := []struct {
		name  string
		rules string
		want  []string
	}{
		{"college only", `{"academic":{"college":["工学院"]}}`, []string{"a", "b", "c"}},
		{"college narrowed by major", `{"academic":{"college":["工学院"],"major":["机械"]}}`, []string{"a", "b"}},
		{"major narrowed by class", `{"academic":{"college":["工学院"],"major":["机械"],"className":["机械1班"]}}`, []string{"a"}},
		{"unrelated class is added", `{"academic":{"college":["工学院"],"major":["机械"],"className":["数学1班"]}}`, []string{"a", "b", "d"}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			role := model.RoleEntity{ID: uuid.NewString(), Code: "R_" + uuid.NewString()[:8], Name: "r", Status: "ACTIVE", TypeCode: "CUSTOM"}
			if err := db.Create(&role).Error; err != nil {
				t.Fatalf("seed role: %v", err)
			}
			if err := db.Create(&model.RoleDataScope{ID: uuid.NewString(), RoleID: role.ID, ScopeMode: "ACADEMIC", PresetCode: "ACADEMIC", RulesJSON: datatypes.JSON([]byte(tc.rules))}).Error; err != nil {
				t.Fatalf("seed scope: %v", err)
			}
			scope, err := ResolveUserDataScope(db, &model.User{ID: uuid.NewString(), Role: role.Code, Roles: []model.RoleEntity{role}})
			if err != nil {
				t.Fatalf("resolve: %v", err)
			}
			var names []string
			if err := ApplyAcademicScopeToStudentQuery(db.Model(&model.Student{}), scope).Order("fullName").Pluck("fullName", &names).Error; err != nil {
				t.Fatalf("query: %v", err)
			}
			if len(names) != len(tc.want) {
				t.Fatalf("expected %v, got %v", tc.want, names)
			}
			for i := range names {
				if names[i] != tc.want[i] {
					t.Fatalf("expected %v, got %v", tc.want, names)
				}
			}
		})
	}
}

func TestEnsureDataScopeDefaults_RevertsAutoCreatedAllScopes(t *testing.T) {
	db := openDataScopeTestDB(t)
	if err := db.AutoMigrate(&model.RoleEntity{}, &model.RoleDataScope{}, &model.AppMigration{}); err != nil {
		t.Fatalf("migrate failed: %v", err)
	}
	counselor := model.RoleEntity{ID: uuid.NewString(), Code: "COUNSELOR", Name: "辅导员", Status: "ACTIVE", TypeCode: "SYSTEM"}
	leader := model.RoleEntity{ID: uuid.NewString(), Code: "LEADER", Name: "学生干部", Status: "ACTIVE", TypeCode: "SYSTEM"}
	if err := db.Create(&[]model.RoleEntity{counselor, leader}).Error; err != nil {
		t.Fatalf("seed roles: %v", err)
	}
	now := time.Now()
	operator := uuid.NewString()
	if err := db.Create(&model.AppMigration{Name: legacyDataScopeMigration, AppliedAt: now}).Error; err != nil {
		t.Fatalf("seed marker: %v", err)
	}
	if err := db.Create(&[]model.RoleDataScope{
		// 早期迁移自动写入的记录 -> 应被撤销
		{ID: uuid.NewString(), RoleID: counselor.ID, ScopeMode: "ALL", PresetCode: "ALL", CreatedAt: now},
		// 管理员手动保存过的记录 -> 必须保留
		{ID: uuid.NewString(), RoleID: leader.ID, ScopeMode: "ALL", PresetCode: "ALL", UpdatedBy: &operator, CreatedAt: now},
	}).Error; err != nil {
		t.Fatalf("seed scopes: %v", err)
	}

	for run := 0; run < 2; run++ {
		if err := EnsureDataScopeDefaults(db); err != nil {
			t.Fatalf("run %d: %v", run+1, err)
		}
	}
	var remaining []model.RoleDataScope
	db.Find(&remaining)
	if len(remaining) != 1 || remaining[0].RoleID != leader.ID {
		t.Fatalf("only the manually saved scope should remain, got %+v", remaining)
	}
}

func TestResolveUserDataScope_OwnCollegeDefaultAndUserOverride(t *testing.T) {
	db := openDataScopeTestDB(t)
	if err := db.AutoMigrate(&model.RoleEntity{}, &model.RoleDataScope{}, &model.UserDataScope{}, &model.Student{}, &model.Dormitory{}, &model.Teacher{}); err != nil {
		t.Fatalf("migrate failed: %v", err)
	}
	str := func(v string) *string { return &v }
	building, floor := "3号楼", 2
	dormA := model.Dormitory{ID: uuid.NewString(), Building: &building, Floor: &floor, RoomNo: str("201")}
	dormB := model.Dormitory{ID: uuid.NewString(), Building: &building, Floor: &floor, RoomNo: str("202")}
	if err := db.Create(&[]model.Dormitory{dormA, dormB}).Error; err != nil {
		t.Fatalf("seed dorms: %v", err)
	}
	if err := db.Create(&[]model.Student{
		{ID: uuid.NewString(), FullName: "工学院学生", College: str("工学院"), DormID: &dormA.ID},
		{ID: uuid.NewString(), FullName: "理学院学生", College: str("理学院"), DormID: &dormB.ID},
	}).Error; err != nil {
		t.Fatalf("seed students: %v", err)
	}
	counselor := model.RoleEntity{ID: uuid.NewString(), Code: "COUNSELOR", Name: "辅导员", Status: "ACTIVE", TypeCode: "SYSTEM"}
	if err := db.Create(&counselor).Error; err != nil {
		t.Fatalf("seed role: %v", err)
	}
	user := &model.User{ID: uuid.NewString(), Username: "t001", Role: counselor.Code, Department: str("工学院"), Roles: []model.RoleEntity{counselor}}

	scope, err := ResolveUserDataScope(db, user)
	if err != nil {
		t.Fatalf("resolve: %v", err)
	}
	if scope.All {
		t.Fatalf("counselor without configured scope must not see all data")
	}
	if _, ok := scope.Academic.Colleges["工学院"]; !ok || len(scope.Academic.Colleges) != 1 {
		t.Fatalf("expected own college only, got %v", scope.Academic.Colleges)
	}
	if !scope.AllowsDormID(dormA.ID) || scope.AllowsDormID(dormB.ID) {
		t.Fatalf("dorms of own-college students should be visible, others not")
	}

	// 账号单独设置的范围优先于角色
	rules := datatypes.JSON([]byte(`{"academic":{"college":["理学院"]}}`))
	if err := db.Create(&model.UserDataScope{ID: uuid.NewString(), UserID: user.ID, ScopeMode: "ACADEMIC", RulesJSON: rules}).Error; err != nil {
		t.Fatalf("seed user scope: %v", err)
	}
	scope, err = ResolveUserDataScope(db, user)
	if err != nil {
		t.Fatalf("resolve with user scope: %v", err)
	}
	if _, ok := scope.Academic.Colleges["理学院"]; !ok || len(scope.Academic.Colleges) != 1 || !scope.AllowsDormID(dormB.ID) {
		t.Fatalf("user-level scope should replace the role scope, got %v", scope.Academic.Colleges)
	}
}
