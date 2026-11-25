package service

import (
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/my-project/backend-go/internal/model"
	"github.com/my-project/backend-go/pkg/utils"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var ErrIdentityConflict = errors.New("学号或工号已被其他档案或账号占用")

type identityKind struct {
	newModel           func() any
	code, number, unit string
}

var (
	studentIdentity = identityKind{func() any { return &model.Student{} }, "STUDENT", "studentNo", "college"}
	teacherIdentity = identityKind{func() any { return &model.Teacher{} }, "TEACHER", "employeeNo", "department"}
	identityKinds   = []identityKind{studentIdentity, teacherIdentity}
)

type identityProfile struct {
	Kind       identityKind `gorm:"-"`
	ID         string       `gorm:"column:id"`
	UserID     *string      `gorm:"column:userId"`
	Number     *string      `gorm:"column:profileNo"`
	FullName   string       `gorm:"column:fullName"`
	Department *string      `gorm:"column:profileDepartment"`
	Mobile     *string      `gorm:"column:mobile"`
	Phone      *string      `gorm:"column:phone"`
}

func (k identityKind) query(db *gorm.DB) *gorm.DB {
	fields := []string{"id", "userId", k.number + " AS profileNo", "fullName", k.unit + " AS profileDepartment", "mobile"}
	if k.code == studentIdentity.code {
		fields = append(fields, "phone")
	}
	return db.Model(k.newModel()).Select(strings.Join(fields, ", "))
}

func (k identityKind) matchesLegacy(user *model.User) bool {
	userType := strings.ToUpper(strings.TrimSpace(ptrToStr(user.UserType)))
	role := strings.ToUpper(strings.TrimSpace(user.Role))
	if userType != "" {
		return userType == k.code
	}
	if k.code == studentIdentity.code {
		return role == "STUDENT" || role == "LEADER"
	}
	return role == "COUNSELOR" || role == "ADMIN"
}

func (p *identityProfile) update(tx *gorm.DB, values map[string]any) error {
	if len(values) == 0 {
		return nil
	}
	return tx.Model(p.Kind.newModel()).Where("id = ?", p.ID).Updates(values).Error
}

func (p *identityProfile) setPhone(values map[string]any, phone *string) {
	values["mobile"] = phone
	if p.Kind.code == studentIdentity.code {
		values["phone"] = phone
	}
}

func firstNonblank(values ...*string) *string {
	for _, value := range values {
		if strings.TrimSpace(ptrToStr(value)) != "" {
			return value
		}
	}
	return nil
}

func findIdentityProfile(db *gorm.DB, user *model.User, legacy, lock bool) (*identityProfile, error) {
	query := func(kind identityKind) *gorm.DB {
		q := kind.query(db)
		if lock {
			q = q.Clauses(clause.Locking{Strength: "UPDATE"})
		}
		return q
	}
	var match *identityProfile
	for _, kind := range identityKinds {
		var profile identityProfile
		err := query(kind).Where("userId = ?", user.ID).Take(&profile).Error
		switch {
		case err == nil:
			if match != nil {
				return nil, fmt.Errorf("%w（账号 %s 关联两类档案）", ErrIdentityConflict, user.ID)
			}
			profile.Kind = kind
			match = &profile
		case errors.Is(err, gorm.ErrRecordNotFound), isMissingTableError(err):
		default:
			return nil, err
		}
	}
	if match != nil || !legacy || user.Username == "" {
		return match, nil
	}

	for _, kind := range identityKinds {
		if !kind.matchesLegacy(user) {
			continue
		}
		var profile identityProfile
		err := query(kind).
			Where(kind.number+" = ? AND userId IS NULL", user.Username).Take(&profile).Error
		switch {
		case err == nil:
			profile.Kind = kind
			match = &profile
		case errors.Is(err, gorm.ErrRecordNotFound), isMissingTableError(err):
		default:
			return nil, err
		}
	}
	return match, nil
}

// IdentitySyncService writes the other side of an identity using the caller's transaction.
type IdentitySyncService struct{}

func (IdentitySyncService) SyncUserFromStudent(tx *gorm.DB, student *model.Student, previousNo string) error {
	profile := identityProfile{Kind: studentIdentity, ID: student.ID, UserID: student.UserID, Number: student.StudentNo,
		FullName: student.FullName, Department: student.College, Mobile: student.Mobile, Phone: student.Phone}
	if err := syncUserFromProfile(tx, &profile, previousNo, student.DormID); err != nil {
		return err
	}
	student.UserID = profile.UserID
	return nil
}

func (IdentitySyncService) SyncUserFromTeacher(tx *gorm.DB, teacher *model.Teacher, previousNo string) error {
	profile := identityProfile{Kind: teacherIdentity, ID: teacher.ID, UserID: teacher.UserID, Number: teacher.EmployeeNo,
		FullName: teacher.FullName, Department: teacher.Department, Mobile: teacher.Mobile}
	if err := syncUserFromProfile(tx, &profile, previousNo, nil); err != nil {
		return err
	}
	teacher.UserID = profile.UserID
	return nil
}

func syncUserFromProfile(tx *gorm.DB, profile *identityProfile, previousNo string, dormID *string) error {
	number := ptrToStr(profile.Number)
	if strings.TrimSpace(number) == "" {
		if profile.UserID != nil || previousNo != "" {
			return errors.New("学号或工号不能为空")
		}
		return nil
	}

	var user model.User
	locked := tx.Clauses(clause.Locking{Strength: "UPDATE"})
	var err error
	switch {
	case profile.UserID != nil:
		err = locked.Take(&user, "id = ?", *profile.UserID).Error
		if err != nil {
			return err
		}
	case previousNo != "":
		err = locked.Take(&user, "username = ?", previousNo).Error
	default:
		err = locked.Take(&user, "username = ?", number).Error
	}
	phone := firstNonblank(profile.Mobile, profile.Phone)
	if phone == nil {
		phone = profile.Mobile
		if phone == nil {
			phone = profile.Phone
		}
	}
	if errors.Is(err, gorm.ErrRecordNotFound) {
		roleCode := "COUNSELOR"
		if profile.Kind.code == studentIdentity.code {
			roleCode = "STUDENT"
		}
		if err := checkIdentityUsername(tx, number, ""); err != nil {
			return err
		}
		password, err := utils.HashDefaultInitialPassword()
		if err != nil {
			return err
		}
		user = model.User{ID: uuid.NewString(), Username: number, FullName: profile.FullName, Department: profile.Department,
			Phone: phone, DormID: dormID, UserType: ptr(profile.Kind.code), Role: roleCode, Password: password,
			TokenVersion: 1, MustChangePassword: true}
		if err := tx.Create(&user).Error; err != nil {
			return err
		}
		var role model.RoleEntity
		if err := tx.Take(&role, "code = ?", roleCode).Error; err != nil {
			return err
		}
		if err := tx.Exec("INSERT INTO _roleentitytouser (A, B) VALUES (?, ?)", role.ID, user.ID).Error; err != nil {
			return err
		}
	} else if err != nil {
		return err
	} else {
		if profile.UserID == nil && (user.IsDisabled || !profile.Kind.matchesLegacy(&user)) {
			return ErrIdentityConflict
		}
		bound, err := findIdentityProfile(tx, &user, false, true)
		if err != nil {
			return err
		}
		if bound != nil && (bound.Kind.code != profile.Kind.code || bound.ID != profile.ID) {
			return ErrIdentityConflict
		}
		if user.Username != number {
			if err := checkIdentityUsername(tx, number, user.ID); err != nil {
				return err
			}
		}
		values := map[string]any{"username": number, "fullName": profile.FullName, "department": profile.Department, "phone": phone}
		if profile.Kind.code == studentIdentity.code {
			values["dormId"] = dormID
		}
		if err := tx.Model(&user).Updates(values).Error; err != nil {
			return err
		}
	}
	values := map[string]any{}
	if profile.UserID == nil {
		values["userId"] = user.ID
	}
	if profile.Kind.code == studentIdentity.code &&
		(ptrToStr(profile.Mobile) != ptrToStr(phone) || ptrToStr(profile.Phone) != ptrToStr(phone)) {
		profile.setPhone(values, phone)
	}
	if err := profile.update(tx, values); err != nil {
		return err
	}
	profile.UserID = &user.ID
	return nil
}

func checkIdentityUsername(tx *gorm.DB, username, exceptID string) error {
	var other model.User
	err := tx.Select("id").Clauses(clause.Locking{Strength: "UPDATE"}).Take(&other, "username = ? AND id <> ?", username, exceptID).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil
	}
	if err != nil {
		return err
	}
	return ErrIdentityConflict
}

func ensureIndependentUsername(tx *gorm.DB, username string) error {
	for _, kind := range identityKinds {
		var profile identityProfile
		err := kind.query(tx).Clauses(clause.Locking{Strength: "UPDATE"}).Take(&profile, kind.number+" = ?", username).Error
		switch {
		case err == nil:
			return ErrIdentityConflict
		case errors.Is(err, gorm.ErrRecordNotFound), isMissingTableError(err):
		default:
			return err
		}
	}
	return nil
}

func (IdentitySyncService) SyncProfileFromUser(tx *gorm.DB, profile *identityProfile, userID string, changed map[string]any) error {
	if profile == nil || len(changed) == 0 {
		return nil
	}
	values := make(map[string]any)
	if value, ok := changed["fullName"]; ok {
		values["fullName"] = value
	}
	if value, ok := changed["department"]; ok {
		values[profile.Kind.unit] = value
	}
	if value, ok := changed["phone"]; ok {
		profile.setPhone(values, ptr(value.(string)))
	}
	if value, ok := changed["qq"]; ok && profile.Kind.code == studentIdentity.code {
		values["qq"] = value
	}
	if len(values) > 0 && profile.UserID == nil {
		values["userId"] = userID
	}
	return profile.update(tx, values)
}

func (p *identityProfile) identityAudit(changed map[string]any) IdentityAudit {
	before := map[string]any{"profileType": p.Kind.code, "profileId": p.ID}
	after := map[string]any{"profileType": p.Kind.code, "profileId": p.ID}
	if value, ok := changed["fullName"]; ok {
		before["fullName"], after["fullName"] = p.FullName, value
	}
	if value, ok := changed["department"]; ok {
		before[p.Kind.unit], after[p.Kind.unit] = p.Department, value
	}
	if value, ok := changed["phone"]; ok {
		before["mobile"], after["mobile"] = p.Mobile, value
		if p.Kind.code == studentIdentity.code {
			before["phone"], after["phone"] = p.Phone, value
		}
	}
	return IdentityAudit{OldValue: before, NewValue: after}
}

func authorizeStudentCollegeUpdate(tx *gorm.DB, operatorID, studentID, college string) error {
	scope, err := ResolveUserDataScopeByUserID(tx, operatorID)
	if err != nil {
		return err
	}
	var student model.Student
	if err := tx.Select("id", "college", "major", "className").Take(&student, "id = ?", studentID).Error; err != nil {
		return err
	}
	before := scope.AllowsStudentAcademic(&student)
	student.College = &college
	if !before || !scope.AllowsStudentAcademic(&student) {
		return newForbiddenError("学生学院变更超出当前数据范围")
	}
	return nil
}
