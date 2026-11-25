package service

import (
	"errors"
	"fmt"
	"strings"

	"github.com/my-project/backend-go/internal/model"
	"gorm.io/gorm"
)

const identityMigration = "2026-11-profile-identity-bindings"

func EnsureIdentityBindings(db *gorm.DB) error {
	if err := db.AutoMigrate(&model.AppMigration{}); err != nil {
		return err
	}
	migrator := db.Migrator()
	if !migrator.HasColumn(&model.Teacher{}, "UserID") {
		if err := migrator.AddColumn(&model.Teacher{}, "UserID"); err != nil {
			return err
		}
	}
	if err := db.Transaction(func(tx *gorm.DB) error {
		if applied, err := migrationApplied(tx, identityMigration); err != nil || applied {
			return err
		}
		if err := backfillIdentityBindings(tx); err != nil {
			return err
		}
		return tx.Create(&model.AppMigration{Name: identityMigration}).Error
	}); err != nil {
		return err
	}

	// MySQL commits DDL separately. Resume any missing indexes on every startup.
	for _, index := range []struct {
		kind identityKind
		name string
	}{{studentIdentity, "ux_student_user_id"}, {teacherIdentity, "ux_teacher_user_id"}} {
		profile := index.kind.newModel()
		if !migrator.HasIndex(profile, index.name) {
			if err := migrator.CreateIndex(profile, index.name); err != nil {
				return err
			}
		}
	}
	return nil
}

func backfillIdentityBindings(tx *gorm.DB) error {
	var users []model.User
	if err := tx.Select("id", "username", "role", "userType", "fullName", "department", "phone").Find(&users).Error; err != nil {
		return err
	}
	byID := make(map[string]*model.User, len(users))
	for i := range users {
		byID[users[i].ID] = &users[i]
	}

	var profiles []identityProfile
	bindings := make(map[string]identityProfile)
	for _, kind := range identityKinds {
		var rows []identityProfile
		if err := kind.query(tx).Scan(&rows).Error; err != nil {
			return err
		}
		for i := range rows {
			p := &rows[i]
			p.Kind = kind
			if p.UserID != nil && byID[*p.UserID] == nil {
				var account model.User
				err := tx.Select("id").Take(&account, "id = ?", *p.UserID).Error
				if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
					return err
				}
				var userID *string
				if err == nil {
					userID = &account.ID
				}
				if err := p.update(tx, map[string]any{"userId": userID}); err != nil {
					return err
				}
				p.UserID = userID
			}
			if p.UserID != nil {
				if err := registerIdentityBinding(bindings, *p.UserID, *p); err != nil {
					return err
				}
			}
		}
		profiles = append(profiles, rows...)
	}

	for _, profile := range profiles {
		user := byID[ptrToStr(profile.UserID)]
		values := make(map[string]any)
		if user == nil && strings.TrimSpace(ptrToStr(profile.Number)) != "" {
			var candidate model.User
			result := tx.Where("username = ?", *profile.Number).Limit(1).Find(&candidate)
			if result.Error != nil {
				return result.Error
			}
			adminTeacher := profile.Kind.code == teacherIdentity.code && strings.EqualFold(candidate.Role, model.RoleAdmin) &&
				strings.EqualFold(ptrToStr(candidate.UserType), model.RoleAdmin)
			if result.RowsAffected != 0 && (profile.Kind.matchesLegacy(&candidate) || adminTeacher) {
				if err := registerIdentityBinding(bindings, candidate.ID, profile); err != nil {
					return err
				}
				user = byID[candidate.ID]
				values["userId"] = user.ID
			}
		}
		if user == nil {
			continue
		}
		name := firstNonblank(&profile.FullName, &user.FullName)
		department := firstNonblank(profile.Department, user.Department)
		phone := firstNonblank(profile.Mobile, profile.Phone, user.Phone)
		if name != nil && *name != profile.FullName {
			values["fullName"] = *name
		}
		values[profile.Kind.unit] = department
		profile.setPhone(values, phone)
		if err := profile.update(tx, values); err != nil {
			return err
		}
		accountValues := map[string]any{"department": department, "phone": phone}
		if name != nil {
			accountValues["fullName"] = *name
		}
		if err := tx.Model(user).Updates(accountValues).Error; err != nil {
			return err
		}
	}
	return nil
}

func registerIdentityBinding(bindings map[string]identityProfile, userID string, profile identityProfile) error {
	if prior, exists := bindings[userID]; exists {
		return fmt.Errorf("%w（账号 %s，档案 %s/%s 和 %s/%s）", ErrIdentityConflict, userID, prior.Kind.code, prior.ID, profile.Kind.code, profile.ID)
	}
	bindings[userID] = profile
	return nil
}
