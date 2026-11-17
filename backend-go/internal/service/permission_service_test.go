package service

import (
	"encoding/json"
	"errors"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/my-project/backend-go/internal/model"
	"gorm.io/gorm"
)

func TestSaveRoleDataScope_NormalizesRules(t *testing.T) {
	db := openDataScopeTestDB(t)
	if err := db.AutoMigrate(&model.RoleEntity{}, &model.RoleDataScope{}, &model.Student{}, &model.Dormitory{}); err != nil {
		t.Fatalf("migrate failed: %v", err)
	}

	role := model.RoleEntity{ID: uuid.NewString(), Code: "CUSTOM_ROLE", Name: "Custom", Status: "ACTIVE", TypeCode: "CUSTOM"}
	if err := db.Create(&role).Error; err != nil {
		t.Fatalf("seed role failed: %v", err)
	}
	college := "计算机学院"
	major := "软件工程"
	className := "软工1班"
	building := "1号楼"
	room := "201"
	floor := 2
	if err := db.Create(&model.Student{
		ID:        uuid.NewString(),
		FullName:  "张三",
		College:   &college,
		Major:     &major,
		ClassName: &className,
	}).Error; err != nil {
		t.Fatalf("seed student failed: %v", err)
	}
	if err := db.Create(&model.Dormitory{
		ID:       uuid.NewString(),
		Building: &building,
		Floor:    &floor,
		RoomNo:   &room,
	}).Error; err != nil {
		t.Fatalf("seed dorm failed: %v", err)
	}

	service := NewPermissionService(db)
	scope, err := service.SaveRoleDataScope(role.ID, "", RoleDataScopePayload{
		ScopeMode:  "custom",
		PresetCode: "CUSTOM",
		Rules: RoleDataScopeRules{
			Academic: map[string][]string{
				"college":   {" 计算机学院 ", "计算机学院", ""},
				"major":     {"软件工程"},
				"className": {"软工1班"},
				"ignored":   {"bad"},
			},
			Dormitory: map[string][]string{
				"building": {"1号楼", "1号楼"},
				"floor":    {"1号楼::2", "1号楼::2"},
				"room":     {"1号楼::2::201", " 1号楼::2::201 "},
				"ignored":  {"bad"},
			},
		},
	})
	if err != nil {
		t.Fatalf("save role data scope failed: %v", err)
	}

	var rules RoleDataScopeRules
	if err := json.Unmarshal(scope.RulesJSON, &rules); err != nil {
		t.Fatalf("unmarshal rules failed: %v", err)
	}
	if scope.ScopeMode != roleDataScopeCustom || scope.PresetCode != roleDataScopeCustom {
		t.Fatalf("expected normalized custom scope, got %#v", scope)
	}
	if len(rules.Academic["college"]) != 1 || rules.Academic["college"][0] != "计算机学院" {
		t.Fatalf("expected normalized college rules, got %#v", rules.Academic["college"])
	}
	if len(rules.Dormitory["building"]) != 1 || rules.Dormitory["building"][0] != "1号楼" {
		t.Fatalf("expected normalized building rules, got %#v", rules.Dormitory["building"])
	}
	if _, ok := rules.Academic["ignored"]; ok {
		t.Fatalf("unexpected ignored academic key to persist")
	}
	if _, ok := rules.Dormitory["ignored"]; ok {
		t.Fatalf("unexpected ignored dormitory key to persist")
	}
}

func TestSaveRoleDataScope_RejectsInvalidPayload(t *testing.T) {
	db := openDataScopeTestDB(t)
	if err := db.AutoMigrate(&model.RoleEntity{}, &model.RoleDataScope{}, &model.Student{}, &model.Dormitory{}); err != nil {
		t.Fatalf("migrate failed: %v", err)
	}

	role := model.RoleEntity{ID: uuid.NewString(), Code: "CUSTOM_ROLE", Name: "Custom", Status: "ACTIVE", TypeCode: "CUSTOM"}
	if err := db.Create(&role).Error; err != nil {
		t.Fatalf("seed role failed: %v", err)
	}

	service := NewPermissionService(db)

	_, err := service.SaveRoleDataScope(role.ID, "", RoleDataScopePayload{
		ScopeMode:  "INVALID",
		PresetCode: "INVALID",
		Rules:      emptyRoleDataScopeRules(),
	})
	if err == nil || !strings.Contains(err.Error(), "非法") {
		t.Fatalf("expected invalid mode error, got %v", err)
	}

	_, err = service.SaveRoleDataScope(role.ID, "", RoleDataScopePayload{
		ScopeMode:  roleDataScopeAcademic,
		PresetCode: roleDataScopeAcademic,
		Rules: RoleDataScopeRules{
			Academic: map[string][]string{
				"college":   {},
				"major":     {},
				"className": {},
			},
			Dormitory: map[string][]string{
				"building": {"不存在的楼"},
				"floor":    {},
				"room":     {},
			},
		},
	})
	if err == nil || !strings.Contains(err.Error(), "不能包含楼栋规则") {
		t.Fatalf("expected mismatched rules error, got %v", err)
	}
}

func TestSaveRoleDataScope_RejectsUnknownDormRule(t *testing.T) {
	db := openDataScopeTestDB(t)
	if err := db.AutoMigrate(&model.RoleEntity{}, &model.RoleDataScope{}, &model.Dormitory{}); err != nil {
		t.Fatalf("migrate failed: %v", err)
	}

	role := model.RoleEntity{ID: uuid.NewString(), Code: "CUSTOM_ROLE", Name: "Custom", Status: "ACTIVE", TypeCode: "CUSTOM"}
	if err := db.Create(&role).Error; err != nil {
		t.Fatalf("seed role failed: %v", err)
	}

	service := NewPermissionService(db)
	_, err := service.SaveRoleDataScope(role.ID, "", RoleDataScopePayload{
		ScopeMode:  roleDataScopeDormitory,
		PresetCode: roleDataScopeDormitory,
		Rules: RoleDataScopeRules{
			Academic: map[string][]string{
				"college":   {},
				"major":     {},
				"className": {},
			},
			Dormitory: map[string][]string{
				"building": {},
				"floor":    {},
				"room":     {"1号楼::2::201"},
			},
		},
	})
	if err == nil || !strings.Contains(err.Error(), "房间不存在") {
		t.Fatalf("expected unknown room error, got %v", err)
	}
}

func TestGetRoleDataScope_ReturnsNotFoundForMissingRole(t *testing.T) {
	db := openDataScopeTestDB(t)
	if err := db.AutoMigrate(&model.RoleEntity{}, &model.RoleDataScope{}); err != nil {
		t.Fatalf("migrate failed: %v", err)
	}

	service := NewPermissionService(db)
	_, err := service.GetRoleDataScope(uuid.NewString())
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		t.Fatalf("expected record not found, got %v", err)
	}
}

func TestSaveRoleDataScope_ReturnsNotFoundForMissingRole(t *testing.T) {
	db := openDataScopeTestDB(t)
	if err := db.AutoMigrate(&model.RoleEntity{}, &model.RoleDataScope{}); err != nil {
		t.Fatalf("migrate failed: %v", err)
	}

	service := NewPermissionService(db)
	_, err := service.SaveRoleDataScope(uuid.NewString(), "", RoleDataScopePayload{
		ScopeMode:  roleDataScopeAll,
		PresetCode: roleDataScopeAll,
		Rules:      emptyRoleDataScopeRules(),
	})
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		t.Fatalf("expected record not found, got %v", err)
	}
}
