package service

import (
	"encoding/json"
	"errors"
	"strings"

	"github.com/google/uuid"
	"github.com/my-project/backend-go/internal/model"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

// UserDataScopeView 账号数据范围：Inherited 为 true 表示账号未单独设置，按角色计算。
type UserDataScopeView struct {
	UserID    string             `json:"userId"`
	Inherited bool               `json:"inherited"`
	ScopeMode string             `json:"scopeMode"`
	Rules     RoleDataScopeRules `json:"rules"`
}

// GetUserDataScope 读取账号单独设置的数据范围。
func (s *PermissionService) GetUserDataScope(userID string) (*UserDataScopeView, error) {
	if err := s.ensureUsersExist([]string{userID}); err != nil {
		return nil, err
	}
	var stored model.UserDataScope
	err := s.db.Where("userId = ?", userID).First(&stored).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return &UserDataScopeView{UserID: userID, Inherited: true, Rules: emptyRoleDataScopeRules()}, nil
	}
	if err != nil {
		return nil, err
	}
	rules, err := decodeScopeRules(stored.RulesJSON)
	if err != nil {
		return nil, err
	}
	return &UserDataScopeView{UserID: userID, ScopeMode: stored.ScopeMode, Rules: rules}, nil
}

// SaveUserDataScope 给账号单独设置数据范围（覆盖角色范围）。
func (s *PermissionService) SaveUserDataScope(userID, operatorID string, payload RoleDataScopePayload) (*UserDataScopeView, error) {
	if err := s.ensureUsersExist([]string{userID}); err != nil {
		return nil, err
	}
	normalized, err := s.normalizeAndValidateRoleDataScopePayload(payload)
	if err != nil {
		return nil, err
	}
	rulesJSON, err := json.Marshal(normalized.Rules)
	if err != nil {
		return nil, err
	}
	record := model.UserDataScope{
		ID:        uuid.NewString(),
		UserID:    userID,
		ScopeMode: normalized.ScopeMode,
		RulesJSON: datatypes.JSON(rulesJSON),
	}
	if strings.TrimSpace(operatorID) != "" {
		record.UpdatedBy = &operatorID
	}
	if err := s.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("userId = ?", userID).Delete(&model.UserDataScope{}).Error; err != nil {
			return err
		}
		return tx.Create(&record).Error
	}); err != nil {
		return nil, err
	}
	return &UserDataScopeView{UserID: userID, ScopeMode: record.ScopeMode, Rules: normalized.Rules}, nil
}

// DeleteUserDataScope 取消账号单独设置，恢复按角色计算。
func (s *PermissionService) DeleteUserDataScope(userID string) error {
	if err := s.ensureUsersExist([]string{userID}); err != nil {
		return err
	}
	return s.db.Where("userId = ?", userID).Delete(&model.UserDataScope{}).Error
}

// ScopeAcademicOption 学院/专业/班级组合（去重）。
type ScopeAcademicOption struct {
	College   string `gorm:"column:college" json:"college"`
	Major     string `gorm:"column:major" json:"major"`
	ClassName string `gorm:"column:className" json:"className"`
}

// ScopeDormOption 楼栋/楼层/房间组合（去重）。
type ScopeDormOption struct {
	Building string `gorm:"column:building" json:"building"`
	Floor    *int   `gorm:"column:floor" json:"floor"`
	RoomNo   string `gorm:"column:roomNo" json:"roomNo"`
}

// ScopeOptions 配置数据范围时可选的学院与宿舍。始终基于全量数据，不受当前操作者的数据范围影响。
type ScopeOptions struct {
	Academic []ScopeAcademicOption `json:"academic"`
	Dorms    []ScopeDormOption     `json:"dorms"`
}

func (s *PermissionService) GetScopeOptions() (*ScopeOptions, error) {
	options := &ScopeOptions{Academic: []ScopeAcademicOption{}, Dorms: []ScopeDormOption{}}
	if err := s.db.Model(&model.Student{}).
		Select("DISTINCT COALESCE(college, '') AS college, COALESCE(major, '') AS major, COALESCE(className, '') AS className").
		Where("college IS NOT NULL AND college <> ''").
		Order("college, major, className").
		Scan(&options.Academic).Error; err != nil {
		return nil, err
	}
	if err := s.db.Model(&model.Dormitory{}).
		Select("DISTINCT building, floor, COALESCE(roomNo, '') AS roomNo").
		Where("building IS NOT NULL AND building <> ''").
		Order("building, floor, roomNo").
		Scan(&options.Dorms).Error; err != nil {
		return nil, err
	}
	return options, nil
}
