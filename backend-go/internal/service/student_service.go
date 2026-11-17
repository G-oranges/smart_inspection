package service

import (
	"fmt"

	"github.com/google/uuid"
	"github.com/my-project/backend-go/internal/model"
	"github.com/my-project/backend-go/internal/repository"
	"github.com/my-project/backend-go/pkg/utils"
	"gorm.io/gorm"
)

type BatchMonitorResult struct {
	Conflicts    []MonitorConflict `json:"conflicts"`
	NonConflicts []MonitorConflict `json:"nonConflicts"`
	HasConflicts bool              `json:"hasConflicts"`
	SetCount     int               `json:"setCount"`
	RevokeCount  int               `json:"revokeCount"`
}

type MonitorConflict struct {
	StudentID           string `json:"studentId"`
	StudentName         string `json:"studentName"`
	DormID              string `json:"dormId"`
	DormName            string `json:"dormName"`
	ExistingMonitorID   string `json:"existingMonitorId,omitempty"`
	ExistingMonitorName string `json:"existingMonitorName,omitempty"`
}

type StudentService interface {
	CreateStudent(student *model.Student) error
	UpdateStudent(id string, student *model.Student) error
	DeleteStudents(ids []string) error
	GetStudentByID(id string) (*model.Student, error)
	GetStudentByNo(studentNo string) (*model.Student, error)
	BatchMonitor(studentIds []string, replaceExisting *bool) (*BatchMonitorResult, error)
	// PreviewImport 预览导入数据，检查冲突和格式
	PreviewImport(rows []map[string]string) (*model.ImportPreviewResult, error)
	// BatchImport 批量导入学生，使用单一事务提升性能，支持冲突解决策略
	BatchImport(students []*model.Student, resolution string) (successCount int, failedCount int, err error)
	// PreviewImportV2 V2版本预览导入，与 ImportWizard 兼容
	PreviewImportV2(items []model.StudentImportRow) (*model.StudentImportPreviewResponse, error)
	// BatchImportV2 V2版本批量导入
	BatchImportV2(items []model.StudentImportRow, strategy string) (*model.StudentImportExecuteResponse, error)
	// BatchImportV2WithProgress V2版本批量导入（支持进度回传）
	BatchImportV2WithProgress(items []model.StudentImportRow, strategy string, jobId string, taskService ImportTaskService) (*model.StudentImportExecuteResponse, error)
}

type studentService struct {
	repo repository.StudentRepository
	db   *gorm.DB
}

func NewStudentService(repo repository.StudentRepository, db *gorm.DB) StudentService {
	return &studentService{repo: repo, db: db}
}

func (s *studentService) CreateStudent(student *model.Student) error {
	if student.ID == "" {
		student.ID = uuid.New().String()
	}

	// Phase 1 防御性处理：空字符串视为无宿舍，避免外键约束失败
	if student.DormID != nil && *student.DormID == "" {
		student.DormID = nil
	}
	if student.DormBuilding != nil && *student.DormBuilding == "" {
		student.DormBuilding = nil
	}
	if student.DormRoomNo != nil && *student.DormRoomNo == "" {
		student.DormRoomNo = nil
	}
	if student.BedNo != nil && *student.BedNo == "" {
		student.BedNo = nil
	}

	return s.db.Transaction(func(tx *gorm.DB) error {
		// 检查是否存在相同学号的记录（Upsert 模式）
		if student.StudentNo != nil && *student.StudentNo != "" {
			var existing model.Student
			if err := tx.Where("studentNo = ?", *student.StudentNo).First(&existing).Error; err == nil {
				// 存在相同学号的记录，更新现有记录（排除住宿字段）
				student.ID = existing.ID
				if err := tx.Model(&model.Student{}).Where("id = ?", existing.ID).
					Omit("dormId", "building", "roomNo", "bedNo").
					Updates(student).Error; err != nil {
					return err
				}
				// 重新获取更新后的数据用于同步
				var updated model.Student
				tx.First(&updated, "id = ?", existing.ID)
				return s.syncUserAccountForStudent(tx, &updated, ptrToStr(existing.StudentNo))
			}
		}

		// 不存在则创建新记录（Phase 3: 排除住宿冗余字段，住宿变更应由专有接口处理）
		if err := tx.Omit("dormId", "building", "roomNo", "bedNo").Create(student).Error; err != nil {
			return err
		}
		return s.syncUserAccountForStudent(tx, student, "")
	})
}

func (s *studentService) UpdateStudent(id string, student *model.Student) error {
	// Phase 1 防御性处理：空字符串视为无宿舍，避免外键约束失败
	if student.DormID != nil && *student.DormID == "" {
		student.DormID = nil
	}
	if student.DormBuilding != nil && *student.DormBuilding == "" {
		student.DormBuilding = nil
	}
	if student.DormRoomNo != nil && *student.DormRoomNo == "" {
		student.DormRoomNo = nil
	}
	if student.BedNo != nil && *student.BedNo == "" {
		student.BedNo = nil
	}

	return s.db.Transaction(func(tx *gorm.DB) error {
		var existing model.Student
		if err := tx.First(&existing, "id = ?", id).Error; err != nil {
			return err
		}

		// 排除住宿字段的写入，住宿变更应由专有接口处理
		if err := tx.Model(&model.Student{}).Where("id = ?", id).
			Omit("dormId", "building", "roomNo", "bedNo").
			Updates(student).Error; err != nil {
			return err
		}

		// 重新获取更新后的数据用于同步
		var updated model.Student
		tx.First(&updated, "id = ?", id)
		return s.syncUserAccountForStudent(tx, &updated, ptrToStr(existing.StudentNo))
	})
}

func (s *studentService) syncUserAccountForStudent(tx *gorm.DB, student *model.Student, previousStudentNo string) error {
	studentNo := ptrToStr(student.StudentNo)
	if studentNo == "" {
		return nil
	}

	var user model.User
	// 尝试通过 userId 或用户名找到现有 User
	found := false
	if student.UserID != nil && *student.UserID != "" {
		if err := tx.Where("id = ?", *student.UserID).First(&user).Error; err == nil {
			found = true
		}
	}
	if !found {
		if err := tx.Where("username = ?", studentNo).First(&user).Error; err == nil {
			found = true
		}
	}
	if !found && previousStudentNo != "" && previousStudentNo != studentNo {
		if err := tx.Where("username = ?", previousStudentNo).First(&user).Error; err == nil {
			found = true
		}
	}

	// 如果 User 角色不是 STUDENT 且已存在，则不进行同步（保持安全）
	if found && user.Role != "STUDENT" {
		return nil
	}

	if found {
		// 更新现有 User
		updates := map[string]interface{}{
			"fullName":   student.FullName,
			"department": student.College,
			"role":       "STUDENT",
			"userType":   "STUDENT",
			"phone":      student.Phone,
			"dormId":     student.DormID,
		}
		// 如果学号变更且不冲突，更新用户名
		if user.Username != studentNo {
			var conflict model.User
			if err := tx.Where("username = ?", studentNo).First(&conflict).Error; err != nil {
				updates["username"] = studentNo
			}
		}
		if err := tx.Model(&user).Updates(updates).Error; err != nil {
			return err
		}
	} else {
		// 创建新 User - 使用配置化的默认初始密码
		hashedPassword, _ := utils.HashDefaultInitialPassword()
		user = model.User{
			ID:           uuid.New().String(),
			Username:     studentNo,
			Password:     hashedPassword,
			FullName:     student.FullName,
			Department:   student.College,
			Role:         "STUDENT",
			UserType:     ptr("STUDENT"),
			Phone:        student.Phone,
			DormID:       student.DormID,
			IsDisabled:   false,
			TokenVersion: 1, // 显式设置初始版本号
		}
		if err := tx.Create(&user).Error; err != nil {
			return err
		}
		// 关联默认角色
		var role model.RoleEntity
		if err := tx.Where("code = ?", "STUDENT").First(&role).Error; err == nil {
			tx.Exec("INSERT INTO _roleentitytouser (A, B) VALUES (?, ?)", role.ID, user.ID)
		}
	}

	// 确保学生记录关联了 UserID
	if student.UserID == nil || *student.UserID != user.ID {
		if err := tx.Model(student).Update("userId", user.ID).Error; err != nil {
			return err
		}
	}

	return nil
}

func ptr(s string) *string { return &s }

func (s *studentService) DeleteStudents(ids []string) error {
	return s.repo.Delete(ids)
}

func (s *studentService) GetStudentByID(id string) (*model.Student, error) {
	return s.repo.FindByID(id)
}

func (s *studentService) GetStudentByNo(studentNo string) (*model.Student, error) {
	return s.repo.FindByStudentNo(studentNo)
}

func (s *studentService) BatchMonitor(studentIds []string, replaceExisting *bool) (*BatchMonitorResult, error) {
	// 1. 获取要设置为寝室长的学生及其宿舍信息
	students, err := s.repo.FindWithDorm(studentIds)
	if err != nil {
		return nil, err
	}

	// 2. 获取这些宿舍目前已有的寝室长
	dormIdsMap := make(map[string]bool)
	var dormIds []string
	for _, student := range students {
		if student.DormID != nil && *student.DormID != "" {
			if !dormIdsMap[*student.DormID] {
				dormIdsMap[*student.DormID] = true
				dormIds = append(dormIds, *student.DormID)
			}
		}
	}

	existingMonitors, err := s.repo.FindMonitorsByDormIds(dormIds)
	if err != nil {
		return nil, err
	}

	monitorByDorm := make(map[string]model.Student)
	for _, m := range existingMonitors {
		if m.DormID != nil {
			monitorByDorm[*m.DormID] = m
		}
	}

	result := &BatchMonitorResult{
		Conflicts:    []MonitorConflict{},
		NonConflicts: []MonitorConflict{},
	}

	for _, student := range students {
		dormID := ""
		if student.DormID != nil {
			dormID = *student.DormID
		}
		dormName := fmt.Sprintf("%s-%s", ptrToStr(student.DormBuilding), ptrToStr(student.DormRoomNo))

		if existing, ok := monitorByDorm[dormID]; ok {
			result.Conflicts = append(result.Conflicts, MonitorConflict{
				StudentID:           student.ID,
				StudentName:         student.FullName,
				DormID:              dormID,
				DormName:            dormName,
				ExistingMonitorID:   existing.ID,
				ExistingMonitorName: existing.FullName,
			})
		} else {
			result.NonConflicts = append(result.NonConflicts, MonitorConflict{
				StudentID:   student.ID,
				StudentName: student.FullName,
				DormID:      dormID,
				DormName:    dormName,
			})
		}
	}

	result.HasConflicts = len(result.Conflicts) > 0

	// 如果只是检测冲突（不执行更新），返回冲突信息
	if replaceExisting == nil {
		return result, nil
	}

	// 执行更新
	var toUpdate []string
	var toRevoke []string

	if *replaceExisting {
		// 覆盖模式：处理所有冲突和非冲突
		for _, c := range result.Conflicts {
			toRevoke = append(toRevoke, c.ExistingMonitorID)
			toUpdate = append(toUpdate, c.StudentID)
		}
		for _, nc := range result.NonConflicts {
			toUpdate = append(toUpdate, nc.StudentID)
		}
	} else {
		// 跳过冲突模式：只处理无冲突的
		for _, nc := range result.NonConflicts {
			toUpdate = append(toUpdate, nc.StudentID)
		}
	}

	if err := s.repo.UpdateMonitorStatus(toRevoke, false); err != nil {
		return nil, err
	}
	if err := s.repo.UpdateMonitorStatus(toUpdate, true); err != nil {
		return nil, err
	}

	result.SetCount = len(toUpdate)
	result.RevokeCount = len(toRevoke)

	return result, nil
}

func ptrToStr(p *string) string {
	if p == nil {
		return ""
	}
	return *p
}

// PreviewImport 预览导入数据，检查冲突和格式
func (s *studentService) PreviewImport(rows []map[string]string) (*model.ImportPreviewResult, error) {
	result := &model.ImportPreviewResult{
		Total:        len(rows),
		InvalidItems: []model.ImportError{},
		Conflicts:    []model.ImportConflict{},
		GlobalErrors: []string{},
	}

	// 定义字段长度限制
	const maxStudentNoLen = 30
	const maxFullNameLen = 50
	const maxPhoneLen = 20
	const maxGradeLen = 20
	const maxCollegeLen = 100
	const maxMajorLen = 100
	const maxClassNameLen = 100

	// 预加载所有楼栋和宿舍数据用于校验（减少数据库查询）
	var buildings []model.Building
	s.db.Select("name, floors").Find(&buildings)
	buildingMap := make(map[string]int) // 楼栋名 -> 楼层数
	for _, b := range buildings {
		buildingMap[b.Name] = b.Floors
	}

	for i, row := range rows {
		rowNum := i + 2 // Excel 行号通常从 2 开始（标题占第 1 行）
		hasError := false

		fullName := utils.GetValueFromRow(row, []string{"姓名", "fullName", "Full Name"})
		studentNo := utils.GetValueFromRow(row, []string{"学号", "studentNo", "StudentNo"})
		building := utils.GetValueFromRow(row, []string{"楼栋", "building", "宿舍楼栋"})
		roomNo := utils.GetValueFromRow(row, []string{"宿舍号", "roomNo", "宿舍房间"})
		phone := utils.GetValueFromRow(row, []string{"联系电话", "phone", "手机号"})
		grade := utils.GetValueFromRow(row, []string{"年级", "grade"})
		college := utils.GetValueFromRow(row, []string{"学院", "college"})
		major := utils.GetValueFromRow(row, []string{"专业", "major"})
		className := utils.GetValueFromRow(row, []string{"班级", "className"})

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
		if studentNo == "" {
			result.InvalidCount++
			result.InvalidItems = append(result.InvalidItems, model.ImportError{
				Row:       rowNum,
				Field:     "学号",
				ErrorType: "empty",
				Reason:    "学号不能为空",
			})
			hasError = true
		}

		// ========== 字段长度校验 ==========
		if len(studentNo) > maxStudentNoLen {
			result.InvalidCount++
			result.InvalidItems = append(result.InvalidItems, model.ImportError{
				Row:       rowNum,
				Field:     "学号",
				ErrorType: "length_exceeded",
				Reason:    fmt.Sprintf("学号长度超限，最大允许 %d 字符", maxStudentNoLen),
				Content:   studentNo,
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
		if len(phone) > maxPhoneLen {
			result.InvalidCount++
			result.InvalidItems = append(result.InvalidItems, model.ImportError{
				Row:       rowNum,
				Field:     "联系电话",
				ErrorType: "length_exceeded",
				Reason:    fmt.Sprintf("联系电话长度超限，最大允许 %d 字符", maxPhoneLen),
				Content:   phone,
			})
			hasError = true
		}
		if len(grade) > maxGradeLen {
			result.InvalidCount++
			result.InvalidItems = append(result.InvalidItems, model.ImportError{
				Row:       rowNum,
				Field:     "年级",
				ErrorType: "length_exceeded",
				Reason:    fmt.Sprintf("年级长度超限，最大允许 %d 字符", maxGradeLen),
				Content:   grade,
			})
			hasError = true
		}
		if len(college) > maxCollegeLen {
			result.InvalidCount++
			result.InvalidItems = append(result.InvalidItems, model.ImportError{
				Row:       rowNum,
				Field:     "学院",
				ErrorType: "length_exceeded",
				Reason:    fmt.Sprintf("学院长度超限，最大允许 %d 字符", maxCollegeLen),
				Content:   college,
			})
			hasError = true
		}
		if len(major) > maxMajorLen {
			result.InvalidCount++
			result.InvalidItems = append(result.InvalidItems, model.ImportError{
				Row:       rowNum,
				Field:     "专业",
				ErrorType: "length_exceeded",
				Reason:    fmt.Sprintf("专业长度超限，最大允许 %d 字符", maxMajorLen),
				Content:   major,
			})
			hasError = true
		}
		if len(className) > maxClassNameLen {
			result.InvalidCount++
			result.InvalidItems = append(result.InvalidItems, model.ImportError{
				Row:       rowNum,
				Field:     "班级",
				ErrorType: "length_exceeded",
				Reason:    fmt.Sprintf("班级长度超限，最大允许 %d 字符", maxClassNameLen),
				Content:   className,
			})
			hasError = true
		}

		// ========== 楼栋存在性校验 ==========
		if building != "" {
			if _, exists := buildingMap[building]; !exists {
				result.InvalidCount++
				result.InvalidItems = append(result.InvalidItems, model.ImportError{
					Row:       rowNum,
					Field:     "楼栋",
					ErrorType: "ref_not_found",
					Reason:    fmt.Sprintf("楼栋 [%s] 不存在，请先在楼栋管理中添加", building),
					Content:   building,
				})
				hasError = true
			} else if building != "" && roomNo != "" {
				// 楼栋存在时，校验宿舍是否存在
				var dorm model.Dormitory
				if err := s.db.Where("building = ? AND roomNo = ?", building, roomNo).First(&dorm).Error; err != nil {
					result.InvalidCount++
					result.InvalidItems = append(result.InvalidItems, model.ImportError{
						Row:       rowNum,
						Field:     "宿舍",
						ErrorType: "ref_not_found",
						Reason:    fmt.Sprintf("宿舍 [%s-%s] 不存在，请先在宿舍管理中添加", building, roomNo),
						Content:   fmt.Sprintf("%s-%s", building, roomNo),
					})
					hasError = true
				}
			}
		}

		// 如果有基础校验错误，跳过冲突检测
		if hasError {
			continue
		}

		result.ValidCount++

		// ========== 学号冲突校验 ==========
		var existing model.Student
		if err := s.db.Where("studentNo = ?", studentNo).First(&existing).Error; err == nil {
			result.ConflictCount++
			result.Conflicts = append(result.Conflicts, model.ImportConflict{
				Row:          rowNum,
				Identifier:   studentNo,
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

// BatchImport 批量导入学生，使用单一事务提升性能
func (s *studentService) BatchImport(students []*model.Student, resolution string) (successCount int, failedCount int, err error) {
	if len(students) == 0 {
		return 0, 0, nil
	}

	err = s.db.Transaction(func(tx *gorm.DB) error {
		for _, student := range students {
			if student.ID == "" {
				student.ID = uuid.New().String()
			}

			if student.StudentNo != nil && *student.StudentNo != "" {
				var existing model.Student
				if findErr := tx.Where("studentNo = ?", *student.StudentNo).First(&existing).Error; findErr == nil {
					// 冲突处理
					if resolution == "skip" {
						continue
					}
					// 默认或 overwrite 模式则执行更新
					student.ID = existing.ID
					if updateErr := tx.Model(&model.Student{}).Where("id = ?", existing.ID).Updates(student).Error; updateErr != nil {
						failedCount++
						continue
					}
					var updated model.Student
					tx.First(&updated, "id = ?", existing.ID)
					s.syncUserAccountForStudent(tx, &updated, ptrToStr(existing.StudentNo))
					successCount++
					continue
				}
			}

			if createErr := tx.Create(student).Error; createErr != nil {
				failedCount++
				continue
			}
			s.syncUserAccountForStudent(tx, student, "")
			successCount++
		}
		return nil
	})

	return successCount, failedCount, err
}

// PreviewImportV2 V2版本预览导入，与 ImportWizard 兼容
func (s *studentService) PreviewImportV2(items []model.StudentImportRow) (*model.StudentImportPreviewResponse, error) {
	resp := &model.StudentImportPreviewResponse{
		TotalCount: len(items),
		Issues:     []model.StudentImportIssue{},
	}

	// 有效枚举值
	validGenders := map[string]bool{"男": true, "女": true, "未指定": true}
	validEducationLevels := map[string]bool{"本科": true, "硕士": true, "博士": true, "专科": true, "其他": true}
	validStatuses := map[string]bool{"在读": true, "休学": true, "退学": true, "毕业": true, "结业": true, "其他": true}
	validIdTypes := map[string]bool{"居民身份证": true, "护照": true, "港澳通行证": true, "台胞证": true, "其他": true}
	validPoliticalStatuses := map[string]bool{"群众": true, "共青团员": true, "中共党员": true, "中共预备党员": true, "民主党派": true, "无党派人士": true, "其他": true}

	for _, item := range items {
		hasCriticalIssue := false

		// 1. 必填字段校验 (A类)
		missingFields := []string{}
		if item.StudentNo == nil || *item.StudentNo == "" {
			missingFields = append(missingFields, "studentNo")
		}
		if item.FullName == nil || *item.FullName == "" {
			missingFields = append(missingFields, "fullName")
		}
		if item.Gender == nil || *item.Gender == "" {
			missingFields = append(missingFields, "gender")
		}

		if len(missingFields) > 0 {
			resp.IssueCount++
			resp.Issues = append(resp.Issues, model.StudentImportIssue{
				RowNo:          item.RowNo,
				ErrorType:      "A",
				ErrorCode:      model.ErrMissingRequiredField,
				Reason:         "必填项缺失",
				Suggestion:     "请填写学号、姓名、性别",
				AffectedFields: missingFields,
			})
			hasCriticalIssue = true
		}

		// 2. 枚举校验 (A类)
		if item.Gender != nil && *item.Gender != "" && !validGenders[*item.Gender] {
			resp.IssueCount++
			resp.Issues = append(resp.Issues, model.StudentImportIssue{
				RowNo:          item.RowNo,
				ErrorType:      "A",
				ErrorCode:      model.ErrInvalidEnumValue,
				Reason:         fmt.Sprintf("性别值 [%s] 不合法", *item.Gender),
				Suggestion:     "请使用：男、女、未指定",
				AffectedFields: []string{"gender"},
			})
			hasCriticalIssue = true
		}

		if item.EducationLevel != nil && *item.EducationLevel != "" && !validEducationLevels[*item.EducationLevel] {
			resp.IssueCount++
			resp.Issues = append(resp.Issues, model.StudentImportIssue{
				RowNo:          item.RowNo,
				ErrorType:      "A",
				ErrorCode:      model.ErrInvalidEnumValue,
				Reason:         fmt.Sprintf("培养层次 [%s] 不合法", *item.EducationLevel),
				Suggestion:     "请使用：本科、硕士、博士、专科、其他",
				AffectedFields: []string{"educationLevel"},
			})
			hasCriticalIssue = true
		}

		if item.Status != nil && *item.Status != "" && !validStatuses[*item.Status] {
			resp.IssueCount++
			resp.Issues = append(resp.Issues, model.StudentImportIssue{
				RowNo:          item.RowNo,
				ErrorType:      "A",
				ErrorCode:      model.ErrInvalidEnumValue,
				Reason:         fmt.Sprintf("学籍状态 [%s] 不合法", *item.Status),
				Suggestion:     "请使用：在读、休学、退学、毕业、结业、其他",
				AffectedFields: []string{"status"},
			})
			hasCriticalIssue = true
		}

		if item.IDType != nil && *item.IDType != "" && !validIdTypes[*item.IDType] {
			resp.IssueCount++
			resp.Issues = append(resp.Issues, model.StudentImportIssue{
				RowNo:          item.RowNo,
				ErrorType:      "A",
				ErrorCode:      model.ErrInvalidEnumValue,
				Reason:         fmt.Sprintf("证件类型 [%s] 不合法", *item.IDType),
				Suggestion:     "请使用：居民身份证、护照、港澳通行证、台胞证、其他",
				AffectedFields: []string{"idType"},
			})
			hasCriticalIssue = true
		}

		if item.PoliticalStatus != nil && *item.PoliticalStatus != "" && !validPoliticalStatuses[*item.PoliticalStatus] {
			resp.IssueCount++
			resp.Issues = append(resp.Issues, model.StudentImportIssue{
				RowNo:          item.RowNo,
				ErrorType:      "A",
				ErrorCode:      model.ErrInvalidEnumValue,
				Reason:         fmt.Sprintf("政治面貌 [%s] 不合法", *item.PoliticalStatus),
				Suggestion:     "请使用：群众、共青团员、中共党员、中共预备党员、民主党派、无党派人士、其他",
				AffectedFields: []string{"politicalStatus"},
			})
			hasCriticalIssue = true
		}

		// 3. 手机号格式校验 (A类)
		if item.Mobile != nil && *item.Mobile != "" && len(*item.Mobile) != 11 {
			resp.IssueCount++
			resp.Issues = append(resp.Issues, model.StudentImportIssue{
				RowNo:          item.RowNo,
				ErrorType:      "A",
				ErrorCode:      "INVALID_MOBILE_FORMAT",
				Reason:         fmt.Sprintf("手机号 [%s] 格式不正确", *item.Mobile),
				Suggestion:     "手机号应为11位数字",
				AffectedFields: []string{"mobile"},
			})
			hasCriticalIssue = true
		}

		if hasCriticalIssue {
			continue // 严重错误跳转下一行
		}

		// 4. 学号重复检测 (C类)
		var existing model.Student
		if item.StudentNo != nil && *item.StudentNo != "" {
			err := s.db.Where("studentNo = ?", *item.StudentNo).First(&existing).Error
			if err == nil {
				resp.IssueCount++
				resp.Issues = append(resp.Issues, model.StudentImportIssue{
					RowNo:          item.RowNo,
					ErrorType:      "C",
					ErrorCode:      model.ErrDuplicateEntryInDB,
					Reason:         "学号已存在",
					Suggestion:     "继续导入将根据所选策略执行覆盖或跳过",
					AffectedFields: []string{"studentNo"},
				})
			}
		}
	}

	resp.PassCount = resp.TotalCount - resp.IssueCount
	return resp, nil
}

// BatchImportV2 V2版本批量导入
func (s *studentService) BatchImportV2(items []model.StudentImportRow, strategy string) (*model.StudentImportExecuteResponse, error) {
	resp := &model.StudentImportExecuteResponse{
		TotalCount: len(items),
		FailedRows: []model.StudentImportIssue{},
	}

	err := s.db.Transaction(func(tx *gorm.DB) error {
		for _, item := range items {
			// 后端兜底校验
			if item.StudentNo == nil || *item.StudentNo == "" ||
				item.FullName == nil || *item.FullName == "" ||
				item.Gender == nil || *item.Gender == "" {
				resp.FailedCount++
				resp.FailedRows = append(resp.FailedRows, model.StudentImportIssue{
					RowNo:     item.RowNo,
					ErrorType: "E",
					ErrorCode: "MISSING_REQUIRED_FIELD",
					Reason:    "必填字段缺失（后端兜底校验）",
				})
				continue
			}

			// 构造学生对象
			student := &model.Student{
				StudentNo:       item.StudentNo,
				FullName:        *item.FullName,
				Gender:          item.Gender,
				Grade:           item.Grade,
				College:         item.College,
				Major:           item.Major,
				ClassName:       item.ClassName,
				EducationLevel:  item.EducationLevel,
				Status:          item.Status,
				Mobile:          item.Mobile,
				IDType:          item.IDType,
				IDNumber:        item.IDNumber,
				PoliticalStatus: item.PoliticalStatus,
				Ethnicity:       item.Ethnicity,
				NativePlace:     item.NativePlace,
				HomeAddress:     item.HomeAddress,
				Phone:           item.Phone,
				QQ:              item.QQ,
			}

			// 处理 IsMonitor
			if item.IsMonitor != nil {
				student.IsMonitor = *item.IsMonitor
			}

			// 检查冲突
			var existing model.Student
			err := tx.Where("studentNo = ?", *item.StudentNo).First(&existing).Error

			if err == nil {
				// 冲突处理
				if strategy == "SKIP" {
					resp.SkippedCount++
					continue
				}
				// 覆盖策略 (OVERWRITE)
				student.ID = existing.ID
				if err := tx.Save(student).Error; err != nil {
					resp.FailedCount++
					resp.FailedRows = append(resp.FailedRows, model.StudentImportIssue{
						RowNo:     item.RowNo,
						ErrorCode: "SAVE_ERROR",
						Reason:    err.Error(),
					})
				} else {
					// 同步用户账号
					s.syncUserAccountForStudent(tx, student, ptrToStr(existing.StudentNo))
					resp.UpdatedCount++
					resp.SuccessCount++
				}
			} else {
				// 新增导入
				student.ID = uuid.New().String()
				if err := tx.Create(student).Error; err != nil {
					resp.FailedCount++
					resp.FailedRows = append(resp.FailedRows, model.StudentImportIssue{
						RowNo:     item.RowNo,
						ErrorCode: "CREATE_ERROR",
						Reason:    err.Error(),
					})
				} else {
					// 同步用户账号
					s.syncUserAccountForStudent(tx, student, "")
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
func (s *studentService) BatchImportV2WithProgress(items []model.StudentImportRow, strategy string, jobId string, taskService ImportTaskService) (*model.StudentImportExecuteResponse, error) {
	resp := &model.StudentImportExecuteResponse{
		TotalCount: len(items),
		FailedRows: []model.StudentImportIssue{},
	}

	// 进度更新频率：每处理 10 行或 5% 更新一次
	updateInterval := len(items) / 20
	if updateInterval < 1 {
		updateInterval = 1
	}
	if updateInterval > 10 {
		updateInterval = 10
	}

	err := s.db.Transaction(func(tx *gorm.DB) error {
		for i, item := range items {
			// 更新进度
			if i%updateInterval == 0 || i == len(items)-1 {
				taskService.UpdateProgress(jobId, i+1)
			}

			// 后端兜底校验
			if item.StudentNo == nil || *item.StudentNo == "" ||
				item.FullName == nil || *item.FullName == "" ||
				item.Gender == nil || *item.Gender == "" {
				resp.FailedCount++
				resp.FailedRows = append(resp.FailedRows, model.StudentImportIssue{
					RowNo:     item.RowNo,
					ErrorType: "E",
					ErrorCode: "MISSING_REQUIRED_FIELD",
					Reason:    "必填字段缺失（后端兜底校验）",
				})
				continue
			}

			// 构造学生对象
			student := &model.Student{
				StudentNo:       item.StudentNo,
				FullName:        *item.FullName,
				Gender:          item.Gender,
				Grade:           item.Grade,
				College:         item.College,
				Major:           item.Major,
				ClassName:       item.ClassName,
				EducationLevel:  item.EducationLevel,
				Status:          item.Status,
				Mobile:          item.Mobile,
				IDType:          item.IDType,
				IDNumber:        item.IDNumber,
				PoliticalStatus: item.PoliticalStatus,
				Ethnicity:       item.Ethnicity,
				NativePlace:     item.NativePlace,
				HomeAddress:     item.HomeAddress,
				Phone:           item.Phone,
				QQ:              item.QQ,
			}

			// 处理 IsMonitor
			if item.IsMonitor != nil {
				student.IsMonitor = *item.IsMonitor
			}

			// 检查冲突
			var existing model.Student
			err := tx.Where("studentNo = ?", *item.StudentNo).First(&existing).Error

			if err == nil {
				// 冲突处理
				if strategy == "SKIP" {
					resp.SkippedCount++
					continue
				}
				// 覆盖策略 (OVERWRITE)
				student.ID = existing.ID
				if err := tx.Save(student).Error; err != nil {
					resp.FailedCount++
					resp.FailedRows = append(resp.FailedRows, model.StudentImportIssue{
						RowNo:     item.RowNo,
						ErrorCode: "SAVE_ERROR",
						Reason:    err.Error(),
					})
				} else {
					// 同步用户账号
					s.syncUserAccountForStudent(tx, student, ptrToStr(existing.StudentNo))
					resp.UpdatedCount++
					resp.SuccessCount++
				}
			} else {
				// 新增导入
				student.ID = uuid.New().String()
				if err := tx.Create(student).Error; err != nil {
					resp.FailedCount++
					resp.FailedRows = append(resp.FailedRows, model.StudentImportIssue{
						RowNo:     item.RowNo,
						ErrorCode: "CREATE_ERROR",
						Reason:    err.Error(),
					})
				} else {
					// 同步用户账号
					s.syncUserAccountForStudent(tx, student, "")
					resp.CreatedCount++
					resp.SuccessCount++
				}
			}
		}
		return nil
	})

	return resp, err
}
