package service

import (
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/my-project/backend-go/internal/model"
	"github.com/my-project/backend-go/internal/repository"
	"github.com/my-project/backend-go/pkg/utils"
	"gorm.io/gorm"
)

type TeacherService interface {
	Create(teacher *model.Teacher) error
	Update(id string, teacher *model.Teacher) error
	Delete(ids []string) error
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
	repo repository.TeacherRepository
	db   *gorm.DB
}

func NewTeacherService(repo repository.TeacherRepository, db *gorm.DB) TeacherService {
	return &teacherService{repo: repo, db: db}
}

func (s *teacherService) Create(teacher *model.Teacher) error {
	if teacher.ID == "" {
		teacher.ID = uuid.New().String()
	}

	return s.db.Transaction(func(tx *gorm.DB) error {
		// 检查是否存在相同工号的记录（Upsert 模式）
		if teacher.EmployeeNo != nil && *teacher.EmployeeNo != "" {
			var existing model.Teacher
			if err := tx.Where("employeeNo = ?", *teacher.EmployeeNo).First(&existing).Error; err == nil {
				// 存在相同工号的记录，更新现有记录
				teacher.ID = existing.ID
				if err := tx.Model(&model.Teacher{}).Where("id = ?", existing.ID).Updates(teacher).Error; err != nil {
					return err
				}
				// 获取更新后的数据用于同步
				var updated model.Teacher
				tx.First(&updated, "id = ?", existing.ID)
				return s.syncUserAccountForTeacher(tx, &updated, ptrToStr(existing.EmployeeNo))
			}
		}

		// 不存在则创建新记录
		if err := tx.Create(teacher).Error; err != nil {
			return err
		}
		return s.syncUserAccountForTeacher(tx, teacher, "")
	})
}

func (s *teacherService) Update(id string, teacher *model.Teacher) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		var existing model.Teacher
		if err := tx.First(&existing, "id = ?", id).Error; err != nil {
			return err
		}

		if err := tx.Model(&model.Teacher{}).Where("id = ?", id).Updates(teacher).Error; err != nil {
			return err
		}

		// 获取更新后的数据用于同步
		var updated model.Teacher
		tx.First(&updated, "id = ?", id)
		return s.syncUserAccountForTeacher(tx, &updated, ptrToStr(existing.EmployeeNo))
	})
}

func (s *teacherService) syncUserAccountForTeacher(tx *gorm.DB, teacher *model.Teacher, previousEmployeeNo string) error {
	employeeNo := ptrToStr(teacher.EmployeeNo)
	if employeeNo == "" {
		return nil
	}

	var user model.User
	found := false
	if err := tx.Where("username = ?", employeeNo).First(&user).Error; err == nil {
		found = true
	} else if previousEmployeeNo != "" && previousEmployeeNo != employeeNo {
		if err := tx.Where("username = ?", previousEmployeeNo).First(&user).Error; err == nil {
			found = true
		}
	}

	// 如果 User 角色不是管理员/辅导员，且已存在，则不进行同步以保安全
	if found && user.Role != "COUNSELOR" && user.Role != "ADMIN" {
		return nil
	}

	if found {
		updates := map[string]interface{}{
			"fullName":   teacher.FullName,
			"department": teacher.Department,
			"phone":      teacher.Mobile,
			"userType":   "TEACHER",
			"role":       "COUNSELOR",
		}
		if user.Username != employeeNo {
			var conflict model.User
			if err := tx.Where("username = ?", employeeNo).First(&conflict).Error; err != nil {
				updates["username"] = employeeNo
			}
		}
		if err := tx.Model(&user).Updates(updates).Error; err != nil {
			return err
		}
	} else {
		// 创建新 User - 使用配置化的默认初始密码；首次登录会被要求修改
		hashedPassword, err := utils.HashDefaultInitialPassword()
		if err != nil {
			return err
		}
		user = model.User{
			ID:                 uuid.New().String(),
			Username:           employeeNo,
			Password:           hashedPassword,
			FullName:           teacher.FullName,
			Department:         teacher.Department,
			Phone:              teacher.Mobile,
			Role:               "COUNSELOR",
			UserType:           ptr("TEACHER"),
			IsDisabled:         false,
			TokenVersion:       1, // 显式设置初始版本号
			MustChangePassword: true,
		}
		if err := tx.Create(&user).Error; err != nil {
			return err
		}
		// 关联 COUNSELOR 角色
		var role model.RoleEntity
		if err := tx.Where("code = ?", "COUNSELOR").First(&role).Error; err == nil {
			tx.Exec("INSERT INTO _roleentitytouser (A, B) VALUES (?, ?)", role.ID, user.ID)
		}
	}

	return nil
}

func (s *teacherService) Delete(ids []string) error {
	return s.repo.Delete(ids)
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

// BatchImport 批量导入教工，使用单一事务提升性能
func (s *teacherService) BatchImport(teachers []*model.Teacher, resolution string) (successCount int, failedCount int, err error) {
	if len(teachers) == 0 {
		return 0, 0, nil
	}

	err = s.db.Transaction(func(tx *gorm.DB) error {
		for _, teacher := range teachers {
			if teacher.ID == "" {
				teacher.ID = uuid.New().String()
			}

			if teacher.EmployeeNo != nil && *teacher.EmployeeNo != "" {
				var existing model.Teacher
				if findErr := tx.Where("employeeNo = ?", *teacher.EmployeeNo).First(&existing).Error; findErr == nil {
					if resolution == "skip" {
						continue
					}
					teacher.ID = existing.ID
					if updateErr := tx.Model(&model.Teacher{}).Where("id = ?", existing.ID).Updates(teacher).Error; updateErr != nil {
						failedCount++
						continue
					}
					var updated model.Teacher
					tx.First(&updated, "id = ?", existing.ID)
					s.syncUserAccountForTeacher(tx, &updated, ptrToStr(existing.EmployeeNo))
					successCount++
					continue
				}
			}

			if createErr := tx.Create(teacher).Error; createErr != nil {
				failedCount++
				continue
			}
			s.syncUserAccountForTeacher(tx, teacher, "")
			successCount++
		}
		return nil
	})

	return successCount, failedCount, err
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
	resp := &model.TeacherImportExecuteResponse{
		TotalCount: len(items),
		FailedRows: []model.TeacherImportIssue{},
	}

	err := s.db.Transaction(func(tx *gorm.DB) error {
		for _, item := range items {
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
				continue
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

			var existing model.Teacher
			err := tx.Where("employeeNo = ?", employeeNo).First(&existing).Error
			if err == nil {
				if strategy == "SKIP" {
					resp.SkippedCount++
					continue
				}
				teacher.ID = existing.ID
				if err := tx.Model(&model.Teacher{}).Where("id = ?", existing.ID).Updates(teacher).Error; err != nil {
					resp.FailedCount++
					resp.FailedRows = append(resp.FailedRows, model.TeacherImportIssue{
						RowNo: item.RowNo, ErrorCode: "SAVE_ERROR", Reason: err.Error(),
					})
				} else {
					var updated model.Teacher
					tx.First(&updated, "id = ?", existing.ID)
					s.syncUserAccountForTeacher(tx, &updated, ptrToStr(existing.EmployeeNo))
					resp.UpdatedCount++
					resp.SuccessCount++
				}
			} else {
				teacher.ID = uuid.New().String()
				if err := tx.Create(teacher).Error; err != nil {
					resp.FailedCount++
					resp.FailedRows = append(resp.FailedRows, model.TeacherImportIssue{
						RowNo: item.RowNo, ErrorCode: "CREATE_ERROR", Reason: err.Error(),
					})
				} else {
					s.syncUserAccountForTeacher(tx, teacher, "")
					resp.CreatedCount++
					resp.SuccessCount++
				}
			}
		}
		return nil
	})

	return resp, err
}

// BatchImportV2WithProgress V2版本批量导入（支持进度回传）
func (s *teacherService) BatchImportV2WithProgress(items []model.TeacherImportRow, strategy string, jobId string, taskService ImportTaskService) (*model.TeacherImportExecuteResponse, error) {
	resp := &model.TeacherImportExecuteResponse{
		TotalCount: len(items),
		FailedRows: []model.TeacherImportIssue{},
	}

	err := s.db.Transaction(func(tx *gorm.DB) error {
		for i, item := range items {
			if taskService != nil {
				taskService.UpdateProgress(jobId, i+1)
			}

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
				continue
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

			var existing model.Teacher
			err := tx.Where("employeeNo = ?", employeeNo).First(&existing).Error
			if err == nil {
				if strategy == "SKIP" {
					resp.SkippedCount++
					continue
				}
				teacher.ID = existing.ID
				if err := tx.Model(&model.Teacher{}).Where("id = ?", existing.ID).Updates(teacher).Error; err != nil {
					resp.FailedCount++
					resp.FailedRows = append(resp.FailedRows, model.TeacherImportIssue{
						RowNo: item.RowNo, ErrorCode: "SAVE_ERROR", Reason: err.Error(),
					})
				} else {
					var updated model.Teacher
					tx.First(&updated, "id = ?", existing.ID)
					s.syncUserAccountForTeacher(tx, &updated, ptrToStr(existing.EmployeeNo))
					resp.UpdatedCount++
					resp.SuccessCount++
				}
			} else {
				teacher.ID = uuid.New().String()
				if err := tx.Create(teacher).Error; err != nil {
					resp.FailedCount++
					resp.FailedRows = append(resp.FailedRows, model.TeacherImportIssue{
						RowNo: item.RowNo, ErrorCode: "CREATE_ERROR", Reason: err.Error(),
					})
				} else {
					s.syncUserAccountForTeacher(tx, teacher, "")
					resp.CreatedCount++
					resp.SuccessCount++
				}
			}
		}
		return nil
	})

	return resp, err
}
