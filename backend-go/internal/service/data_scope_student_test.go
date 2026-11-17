package service

import (
	"testing"

	"github.com/google/uuid"
	"github.com/my-project/backend-go/internal/model"
	"gorm.io/datatypes"
)

func TestResolveUserDataScope_StudentDefaultsToOwnRoom(t *testing.T) {
	db := openDataScopeTestDB(t)
	if err := db.AutoMigrate(&model.RoleEntity{}, &model.RoleDataScope{}, &model.Dormitory{}, &model.Student{}); err != nil {
		t.Fatalf("migrate failed: %v", err)
	}

	studentRole := model.RoleEntity{ID: uuid.NewString(), Code: model.RoleStudent, Name: "学生", Status: "ACTIVE", TypeCode: "SYSTEM"}
	if err := db.Create(&studentRole).Error; err != nil {
		t.Fatalf("seed role failed: %v", err)
	}
	building, roomNo, floor := "1号楼", "305", 3
	dorm := model.Dormitory{ID: uuid.NewString(), Building: &building, Floor: &floor, RoomNo: &roomNo}
	if err := db.Create(&dorm).Error; err != nil {
		t.Fatalf("seed dorm failed: %v", err)
	}
	userID := uuid.NewString()
	student := model.Student{ID: uuid.NewString(), FullName: "张三", UserID: &userID, DormID: &dorm.ID}
	if err := db.Create(&student).Error; err != nil {
		t.Fatalf("seed student failed: %v", err)
	}

	user := &model.User{ID: userID, Username: "2025001", Role: model.RoleStudent, Roles: []model.RoleEntity{studentRole}}
	scope, err := ResolveUserDataScope(db, user)
	if err != nil {
		t.Fatalf("resolve scope failed: %v", err)
	}
	if scope.All {
		t.Fatalf("student without explicit scope must not see all data")
	}
	if !scope.AllowsRoom(building, floor, roomNo) {
		t.Fatalf("student should see own room")
	}
	if scope.AllowsRoom(building, floor, "306") || scope.AllowsBuilding("2号楼") {
		t.Fatalf("student must not see other rooms")
	}

	// 管理员为学生角色显式配置了范围时，以配置为准
	rules := datatypes.JSON([]byte(`{"academic":{"college":[],"major":[],"className":[]},"dormitory":{"building":["2号楼"],"floor":[],"room":[]}}`))
	if err := db.Create(&model.RoleDataScope{ID: uuid.NewString(), RoleID: studentRole.ID, ScopeMode: "DORMITORY", PresetCode: "DORMITORY", RulesJSON: rules}).Error; err != nil {
		t.Fatalf("seed scope failed: %v", err)
	}
	scope, err = ResolveUserDataScope(db, user)
	if err != nil {
		t.Fatalf("resolve scope failed: %v", err)
	}
	if !scope.AllowsBuilding("2号楼") || scope.AllowsRoom(building, floor, roomNo) {
		t.Fatalf("explicit student role scope should override the self default")
	}
}
