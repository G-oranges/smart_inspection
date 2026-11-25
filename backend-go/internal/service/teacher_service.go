package service

import (
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/my-project/backend-go/internal/model"
	"github.com/my-project/backend-go/internal/repository"
	"github.com/my-project/backend-go/pkg/utils"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type TeacherService interface {
	Create(teacher *model.Teacher) error
	Update(id string, teacher *model.Teacher) error
	Delete(ids []string, op OperatorContext) (ProfileDeletion, error)
	Search(page, pageSize int, search string, departments []string) ([]model.Teacher, int64, error)
	// PreviewImport 预览导入教工数据
	PreviewImport(rows []map[string]string) (*model.ImportPreviewResult, error)
	// BatchImport 批量导入教工，支持冲突解决策略
	BatchImport(teachers []*model.Teacher, resolution string) (successCount int, failedCount int, err error)
	// PreviewImportV2 V2版本预览导入，与 ImportWizard 兼容
	PreviewImportV2(items []model.TeacherImportRow) (*model.TeacherImportPreviewResponse, error)
	// BatchImportV2 V2版本批量导入
	BatchImportV2(items []model.TeacherImportRow, strategy string) (*model.TeacherImportExecuteResponse, error)
	// BatchImportV2WithProgress V2版本批量导入（支持进度回传）
	BatchImportV2WithProgress(items []model.TeacherImportRow, strategy string, jobId string, taskService ImportTaskService) (*model.TeacherImportExecuteResponse, error)
}

type teacherService struct {
	repo                  repository.TeacherRepository
	db                    *gorm.DB
	invalidatePermissions func(...string)
}

func NewTeacherService(repo repository.TeacherRepository, db *gorm.DB, invalidatePermissions func(...string)) TeacherService {
	return &teacherService{repo: repo, db: db, invalidatePermissions: invalidatePermissions}
}

func (s *teacherService) Create(profile *model.Teacher) error {
	_, _, err := s.writeTeacher(profile, false)
	return err
}

func (s *teacherService) Update(id string, profile *model.Teacher) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		var existing model.Teacher
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Take(&existing, "id = ?", id).Error; err != nil {
			return err
		}
		return updateTeacherIdentity(tx, &existing, profile)
	})
}

func (s *teacherService) writeTeacher(profile *model.Teacher, skip bool) (created, skipped bool, err error) {
	err = s.db.Transaction(func(tx *gorm.DB) error {
		if number := ptrToStr(profile.EmployeeNo); number != "" {
			var existing model.Teacher
			err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Take(&existing, "employeeNo = ?", number).Error
			if err == nil {
				if skip {
					skipped = true
					return nil
				}
				if err := updateTeacherIdentity(tx, &existing, profile); err != nil {
					return err
				}
				profile.ID, profile.UserID = existing.ID, existing.UserID
				return nil
			}
			if !errors.Is(err, gorm.ErrRecordNotFound) {
				return err
			}
		}
		created = true
		if profile.ID == "" {
			profile.ID = uuid.NewString()
		}
		profile.UserID = nil
		if err := tx.Omit(clause.Associations).Create(profile).Error; err != nil {
			return err
		}
		return (IdentitySyncService{}).SyncUserFromTeacher(tx, profile, "")
	})
	return
}

func updateTeacherIdentity(tx *gorm.DB, existing, profile *model.Teacher) error {
	previousNo := ptrToStr(existing.EmployeeNo)
	if err := tx.Model(&model.Teacher{}).Where("id = ?", existing.ID).
		Omit(clause.Associations, "ID", "UserID", "CreatedAt").Updates(profile).Error; err != nil {
		return err
	}

	if err := tx.Take(existing, "id = ?", existing.ID).Error; err != nil {
		return err
	}
	return (IdentitySyncService{}).SyncUserFromTeacher(tx, existing, previousNo)
}

func (s *teacherService) Delete(ids []string, op OperatorContext) (ProfileDeletion, error) {
	return deleteIdentityProfiles(s.db, teacherIdentity, ids, op, s.invalidatePermissions)
}

func (s *teacherService) Search(page, pageSize int, search string, departments []string) ([]model.Teacher, int64, error) {
	return s.repo.FindAll(page, pageSize, search, departments)
}

// PreviewImport 预览导入教工数据
func (s *teacherService) PreviewImport(rows []map[string]string) (*model.ImportPreviewResult, error) {
	result := &model.ImportPreviewResult{
		Total:        len(rows),
		InvalidItems: []model.ImportError{},
		Conflicts:    []model.ImportConflict{},
		GlobalErrors: []string{},
	}

	// 定义字段长度限制
	const maxEmployeeNoLen = 30
	const maxFullNameLen = 50
	const maxDepartmentLen = 100
	const maxMobileLen = 20
	const maxClassesLen = 200

	for i, row := range rows {
		rowNum := i + 2
		hasError := false

		fullName := utils.GetValueFromRow(row, []string{"姓名", "fullName", "Full Name"})
		employeeNo := utils.GetValueFromRow(row, []string{"工号", "employeeNo", "Employee No", "工号（同步账号）"})
		department := utils.GetValueFromRow(row, []string{"院系", "部门", "department", "院系/部门"})
		mobile := utils.GetValueFromRow(row, []string{"手机号", "联系电话", "mobile", "phone"})
		classes := utils.GetValueFromRow(row, []string{"所带班级", "负责班级", "classes"})

		// ========== 必填项校验 ==========
		if fullName == "" {
			result.InvalidCount++
			result.InvalidItems = append(result.InvalidItems, model.ImportError{
				Row:       rowNum,
				Field:     "姓名",
				ErrorType: "empty",
				Reason:    "姓名不能为空",
			})
			hasError = true
		}
		if employeeNo == "" {
			result.InvalidCount++
			result.InvalidItems = append(result.InvalidItems, model.ImportError{
				Row:       rowNum,
				Field:     "工号",
				ErrorType: "empty",
				Reason:    "工号不能为空",
			})
			hasError = true
		}

		// ========== 字段长度校验 ==========
		if len(employeeNo) > maxEmployeeNoLen {
			result.InvalidCount++
			result.InvalidItems = append(result.InvalidItems, model.ImportError{
				Row:       rowNum,
				Field:     "工号",
				ErrorType: "length_exceeded",
				Reason:    fmt.Sprintf("工号长度超限，最大允许 %d 字符", maxEmployeeNoLen),
				Content:   employeeNo,
			})
			hasError = true
		}
		if len(fullName) > maxFullNameLen {
			result.InvalidCount++
			result.InvalidItems = append(result.InvalidItems, model.ImportError{
				Row:       rowNum,
				Field:     "姓名",
				ErrorType: "length_exceeded",
				Reason:    fmt.Sprintf("姓名长度超限，最大允许 %d 字符", maxFullNameLen),
				Content:   fullName,
			})
			hasError = true
		}
		if len(department) > maxDepartmentLen {
			result.InvalidCount++
			result.InvalidItems = append(result.InvalidItems, model.ImportError{
				Row:       rowNum,
				Field:     "院系/部门",
				ErrorType: "length_exceeded",
				Reason:    fmt.Sprintf("院系/部门长度超限，最大允许 %d 字符", maxDepartmentLen),
				Content:   department,
			})
			hasError = true
		}
		if len(mobile) > maxMobileLen {
			result.InvalidCount++
			result.InvalidItems = append(result.InvalidItems, model.ImportError{
				Row:       rowNum,
				Field:     "手机号",
				ErrorType: "length_exceeded",
				Reason:    fmt.Sprintf("手机号长度超限，最大允许 %d 字符", maxMobileLen),
				Content:   mobile,
			})
			hasError = true
		}
		if len(classes) > maxClassesLen {
			result.InvalidCount++
			result.InvalidItems = append(result.InvalidItems, model.ImportError{
				Row:       rowNum,
				Field:     "所带班级",
				ErrorType: "length_exceeded",
				Reason:    fmt.Sprintf("所带班级长度超限，最大允许 %d 字符", maxClassesLen),
				Content:   classes,
			})
			hasError = true
		}

		// 如果有基础校验错误，跳过冲突检测
		if hasError {
			continue
		}

		result.ValidCount++

		// ========== 工号冲突校验 ==========
		var existing model.Teacher
		if err := s.db.Where("employeeNo = ?", employeeNo).First(&existing).Error; err == nil {
			result.ConflictCount++
			result.Conflicts = append(result.Conflicts, model.ImportConflict{
				Row:          rowNum,
				Identifier:   employeeNo,
				Name:         fullName,
				ExistingName: existing.FullName,
				ConflictType: "duplicate",
			})
		} else {
			result.NewCount++
		}
	}

	return result, nil
}

// BatchImport 批量导入教工
func (s *teacherService) BatchImport(profiles []*model.Teacher, resolution string) (successCount, failedCount int, err error) {
	for _, profile := range profiles {
		_, skipped, err := s.writeTeacher(profile, resolution == "skip")
		if err != nil {
			failedCount++
		} else if !skipped {
			successCount++
		}
	}
	return successCount, failedCount, nil
}

// PreviewImportV2 V2版本预览导入，与 ImportWizard 兼容
func (s *teacherService) PreviewImportV2(items []model.TeacherImportRow) (*model.TeacherImportPreviewResponse, error) {
	resp := &model.TeacherImportPreviewResponse{
		TotalCount: len(items),
		Issues:     []model.TeacherImportIssue{},
	}

	validGenders := map[string]bool{"男": true, "女": true, "未指定": true}

	for _, item := range items {
		hasCriticalIssue := false

		employeeNo := ""
		if item.EmployeeNo != nil {
			employeeNo = strings.TrimSpace(*item.EmployeeNo)
		}
		fullName := ""
		if item.FullName != nil {
			fullName = strings.TrimSpace(*item.FullName)
		}
		gender := ""
		if item.Gender != nil {
			gender = strings.TrimSpace(*item.Gender)
		}

		missingFields := []string{}
		if employeeNo == "" {
			missingFields = append(missingFields, "employeeNo")
		}
		if fullName == "" {
			missingFields = append(missingFields, "fullName")
		}

		if len(missingFields) > 0 {
			resp.IssueCount++
			resp.Issues = append(resp.Issues, model.TeacherImportIssue{
				RowNo:          item.RowNo,
				ErrorType:      "A",
				ErrorCode:      model.ErrMissingRequiredField,
				Reason:         "必填项缺失",
				Suggestion:     "请填写工号、姓名",
				AffectedFields: missingFields,
			})
			hasCriticalIssue = true
		}

		if gender != "" && !validGenders[gender] {
			resp.IssueCount++
			resp.Issues = append(resp.Issues, model.TeacherImportIssue{
				RowNo:          item.RowNo,
				ErrorType:      "A",
				ErrorCode:      model.ErrInvalidEnumValue,
				Reason:         fmt.Sprintf("性别值 [%s] 不合法", gender),
				Suggestion:     "请使用：男、女、未指定",
				AffectedFields: []string{"gender"},
			})
			hasCriticalIssue = true
		}

		if hasCriticalIssue {
			continue
		}

		var existing model.Teacher
		if err := s.db.Where("employeeNo = ?", employeeNo).First(&existing).Error; err == nil {
			resp.IssueCount++
			resp.Issues = append(resp.Issues, model.TeacherImportIssue{
				RowNo:          item.RowNo,
				ErrorType:      "C",
				ErrorCode:      model.ErrDuplicateEntryInDB,
				Reason:         "工号已存在",
				Suggestion:     "继续导入将根据所选策略执行覆盖或跳过",
				AffectedFields: []string{"employeeNo"},
			})
		}
	}

	resp.PassCount = resp.TotalCount - resp.IssueCount
	return resp, nil
}

// BatchImportV2 V2版本批量导入
func (s *teacherService) BatchImportV2(items []model.TeacherImportRow, strategy string) (*model.TeacherImportExecuteResponse, error) {
	return s.BatchImportV2WithProgress(items, strategy, "", nil)
}

// BatchImportV2WithProgress reports completed rows, including skips and failures.
func (s *teacherService) BatchImportV2WithProgress(items []model.TeacherImportRow, strategy string, jobID string, taskService ImportTaskService) (*model.TeacherImportExecuteResponse, error) {
	resp := &model.TeacherImportExecuteResponse{
		TotalCount: len(items),
		FailedRows: []model.TeacherImportIssue{},
	}
	interval := min(10, max(1, len(items)/20))
	for i, item := range items {
		s.importTeacherRow(resp, item, strategy == "SKIP")
		if taskService != nil && ((i+1)%interval == 0 || i+1 == len(items)) {
			taskService.UpdateProgress(jobID, i+1)
		}
	}
	return resp, nil
}

func (s *teacherService) importTeacherRow(resp *model.TeacherImportExecuteResponse, item model.TeacherImportRow, skip bool) {
	employeeNo := ""
	if item.EmployeeNo != nil {
		employeeNo = strings.TrimSpace(*item.EmployeeNo)
	}
	fullName := ""
	if item.FullName != nil {
		fullName = strings.TrimSpace(*item.FullName)
	}

	if employeeNo == "" || fullName == "" {
		resp.FailedCount++
		resp.FailedRows = append(resp.FailedRows, model.TeacherImportIssue{
			RowNo:     item.RowNo,
			ErrorType: "E",
			ErrorCode: "MISSING_REQUIRED_FIELD",
			Reason:    "必填字段缺失（后端兜底校验）",
		})
		return
	}

	employeeNoValue := employeeNo
	teacher := &model.Teacher{
		FullName:   fullName,
		EmployeeNo: &employeeNoValue,
		Gender:     item.Gender,
		Department: item.Department,
		Mobile:     item.Mobile,
		Classes:    item.Classes,
	}

	created, skipped, err := s.writeTeacher(teacher, skip)
	if err != nil {
		code := "SAVE_ERROR"
		if created {
			code = "CREATE_ERROR"
		}
		resp.FailedCount++
		resp.FailedRows = append(resp.FailedRows, model.TeacherImportIssue{
			RowNo: item.RowNo, ErrorCode: code, Reason: err.Error(),
		})
		return
	}
	if skipped {
		resp.SkippedCount++
		return
	}
	if created {
		resp.CreatedCount++
	} else {
		resp.UpdatedCount++
	}
	resp.SuccessCount++
}
