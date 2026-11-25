package service

import (
	"errors"
	"sort"

	"github.com/my-project/backend-go/internal/model"
	"github.com/my-project/backend-go/internal/repository"
	"github.com/my-project/backend-go/pkg/utils"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type ProfileDeletion struct {
	DisabledUserIDs []string `json:"disabledUserIds"`
	RetainedUserIDs []string `json:"retainedUserIds"`
}

func deleteIdentityProfiles(db *gorm.DB, kind identityKind, ids []string, op OperatorContext, invalidate func(...string)) (ProfileDeletion, error) {
	var result ProfileDeletion
	if len(ids) == 0 {
		return result, nil
	}
	err := db.Transaction(func(tx *gorm.DB) error {
		var profiles []identityProfile
		if err := kind.query(tx).Clauses(clause.Locking{Strength: "UPDATE"}).Where("id IN ?", ids).Scan(&profiles).Error; err != nil {
			return err
		}
		var userIDs []string
		for _, profile := range profiles {
			if profile.UserID != nil {
				userIDs = append(userIDs, *profile.UserID)
			}
		}
		sort.Strings(userIDs)
		guard := &userService{db: tx, repo: repository.NewUserRepository(tx)}
		var adminIDs []string
		for _, id := range userIDs {
			var user model.User
			if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Preload("Roles").Take(&user, "id = ?", id).Error; err != nil {
				return err
			}
			roleIDs := guard.currentRoleIDs(&user)
			protected := id == op.UserID
			if !protected && !op.has(permissionManageCode) {
				var err error
				protected, err = guard.anyRolePrivileged(roleIDs, user.Role)
				if err != nil {
					return err
				}
			}
			if protected {
				result.RetainedUserIDs = append(result.RetainedUserIDs, id)
				continue
			}
			if !user.IsDisabled {
				isAdmin, err := guard.roleSetIsAdmin(roleIDs, user.Role)
				if err != nil {
					return err
				}
				if isAdmin {
					adminIDs = append(adminIDs, id)
					continue
				}
			}
			result.DisabledUserIDs = append(result.DisabledUserIDs, id)
		}
		if len(adminIDs) > 0 {
			err := guard.ensureAdminRemains(adminIDs)
			var forbidden *ForbiddenError
			switch {
			case err == nil:
				result.DisabledUserIDs = append(result.DisabledUserIDs, adminIDs...)
			case errors.As(err, &forbidden):
				result.RetainedUserIDs = append(result.RetainedUserIDs, adminIDs...)
			default:
				return err
			}
		}
		if len(result.DisabledUserIDs) > 0 {
			if err := tx.Model(&model.User{}).Where("id IN ?", result.DisabledUserIDs).Updates(map[string]any{
				"isDisabled": true, "tokenVersion": gorm.Expr("tokenVersion + 1"),
			}).Error; err != nil {
				return err
			}
		}
		return tx.Where("id IN ?", ids).Delete(kind.newModel()).Error
	})
	if err != nil {
		return ProfileDeletion{}, err
	}
	clearAccountStatus(result.DisabledUserIDs)
	if invalidate != nil && len(result.DisabledUserIDs) > 0 {
		invalidate(result.DisabledUserIDs...)
	}
	return result, nil
}

func clearAccountStatus(ids []string) {
	for _, id := range ids {
		_ = utils.DelCache("user:status:"+id, "temp_pwd:"+id)
	}
}
