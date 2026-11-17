package service

import (
	"encoding/json"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/my-project/backend-go/internal/model"
	"github.com/my-project/backend-go/internal/repository"
	"github.com/my-project/backend-go/pkg/utils"
	"gorm.io/gorm"
)

type InfrastructureService interface {
	GetBuildings() ([]model.Building, error)
	GetBuildingsLite() ([]model.Building, error)
	GetDormitories(page, pageSize int, buildingId *int) ([]model.Dormitory, int64, error)
	GetDormsTable(params repository.DormPageParams) ([]model.Dormitory, int64, error)
	GetDormBeds(page, pageSize int, dormId *string) ([]model.DormBed, int64, error)
	GetFloors(building string) ([]int, error)
	GetRooms(building string, floor *int) ([]string, error)

	CreateDorm(dorm *model.Dormitory) error
	UpdateDorm(id string, dorm *model.Dormitory) error
	DeleteDorms(ids []string) error
	GetDormMembers(dormId string) ([]model.Student, error)

	// 批量入住管理
	BatchCheckout(dormIds []string, operatorID string) (affectedCount int, err error)
	BatchCheckoutStudents(studentIds []string, operatorID string) (affectedCount int, err error)
	BatchCheckIn(assignments []CheckInAssignment, operatorID string) (successCount, failedCount int, errors []string, err error)

	CreateBuilding(building *model.Building) error
	UpdateBuilding(id int, building *model.Building) error
	DeleteBuilding(id int) error
	DeleteBuildings(ids []int) error
	PreviewImportDorms(dorms []*model.Dormitory) (*model.ImportPreviewResult, error)
	BatchImportDorms(dorms []*model.Dormitory, resolution string) (int, int, error)
	PreviewImportBuildings(buildings []*model.Building) (*model.ImportPreviewResult, error)
	BatchImportBuildings(buildings []*model.Building, resolution string) (int, int, error)

	// V2 增强型
	PreviewImportDormsV2(items []model.DormImportRow) (*model.DormImportPreviewResponse, error)
	BatchImportDormsV2(items []model.DormImportRow, strategy string) (*model.DormImportExecuteResponse, error)
	// BatchImportDormsV2WithProgress V2版本批量导入（支持进度回传）
	BatchImportDormsV2WithProgress(items []model.DormImportRow, strategy string, jobId string, taskService ImportTaskService) (*model.DormImportExecuteResponse, error)
	PreviewImportBuildingsV2(items []model.BuildingImportRow) (*model.BuildingImportPreviewResponse, error)
	BatchImportBuildingsV2(items []model.BuildingImportRow, strategy string) (*model.BuildingImportExecuteResponse, error)
	BatchImportBuildingsV2WithProgress(items []model.BuildingImportRow, strategy string, jobId string, taskService ImportTaskService) (*model.BuildingImportExecuteResponse, error)
}

// CheckInAssignment 批量入住分配项
type CheckInAssignment struct {
	DormID    string `json:"dormId"`
	StudentID string `json:"studentId"`
	BedNo     string `json:"bedNo,omitempty"`
}

type infraService struct {
	repo repository.InfrastructureRepository
	// 简单的内存缓存
	cache struct {
		buildings     []model.Building
		buildingsLite []model.Building
		floors        map[string][]int
		rooms         map[string][]string
		expiresAt     time.Time
		mu            sync.RWMutex
	}
}

func NewInfrastructureService(repo repository.InfrastructureRepository) InfrastructureService {
	s := &infraService{repo: repo}
	s.cache.floors = make(map[string][]int)
	s.cache.rooms = make(map[string][]string)
	return s
}

const (
	infraCacheTTL       = 5 * time.Minute
	infraRedisKeyPrefix = "infra:"
)

func (s *infraService) GetBuildings() ([]model.Building, error) {
	// L1
	s.cache.mu.RLock()
	if s.cache.buildings != nil && time.Now().Before(s.cache.expiresAt) {
		res := s.cache.buildings
		s.cache.mu.RUnlock()
		return res, nil
	}
	s.cache.mu.RUnlock()

	// L2
	redisKey := infraRedisKeyPrefix + "buildings"
	if cached, err := utils.GetCache(redisKey); err == nil {
		var res []model.Building
		if err := json.Unmarshal([]byte(cached), &res); err == nil {
			s.cache.mu.Lock()
			s.cache.buildings = res
			s.cache.expiresAt = time.Now().Add(infraCacheTTL)
			s.cache.mu.Unlock()
			return res, nil
		}
	}

	buildings, err := s.repo.FindAllBuildings()
	if err == nil {
		// Update L1
		s.cache.mu.Lock()
		s.cache.buildings = buildings
		s.cache.expiresAt = time.Now().Add(infraCacheTTL)
		s.cache.mu.Unlock()
		// Update L2
		if data, err := json.Marshal(buildings); err == nil {
			utils.SetCache(redisKey, data, infraCacheTTL)
		}
	}
	return buildings, err
}

// GetBuildingsLite 获取所有楼栋的简要信息（用于下拉选择）
func (s *infraService) GetBuildingsLite() ([]model.Building, error) {
	// L1
	s.cache.mu.RLock()
	if s.cache.buildingsLite != nil && time.Now().Before(s.cache.expiresAt) {
		res := s.cache.buildingsLite
		s.cache.mu.RUnlock()
		return res, nil
	}
	s.cache.mu.RUnlock()

	// L2
	redisKey := infraRedisKeyPrefix + "buildings_lite"
	if cached, err := utils.GetCache(redisKey); err == nil {
		var res []model.Building
		if err := json.Unmarshal([]byte(cached), &res); err == nil {
			s.cache.mu.Lock()
			s.cache.buildingsLite = res
			s.cache.expiresAt = time.Now().Add(infraCacheTTL)
			s.cache.mu.Unlock()
			return res, nil
		}
	}

	buildings, err := s.repo.FindAllBuildingsLite()
	if err == nil {
		// Update L1
		s.cache.mu.Lock()
		s.cache.buildingsLite = buildings
		s.cache.expiresAt = time.Now().Add(infraCacheTTL)
		s.cache.mu.Unlock()
		// Update L2
		if data, err := json.Marshal(buildings); err == nil {
			utils.SetCache(redisKey, data, infraCacheTTL)
		}
	}
	return buildings, err
}

func (s *infraService) invalidateCache() {
	s.cache.mu.Lock()
	defer s.cache.mu.Unlock()
	s.cache.buildings = nil
	s.cache.buildingsLite = nil
	s.cache.floors = make(map[string][]int)
	s.cache.rooms = make(map[string][]string)
	s.cache.expiresAt = time.Time{}

	// Distribution Clear
	utils.DelCache("infra:buildings", "infra:buildings_lite")
	// Note: For simplicity, we clear specific floors/rooms by pattern if needed,
	// but here we just clear the main lists.
}

func (s *infraService) GetDormitories(page, pageSize int, buildingId *int) ([]model.Dormitory, int64, error) {
	return s.repo.FindAllDorms(page, pageSize, buildingId)
}

// GetDormsTable 获取分页的宿舍列表（支持筛选和排序）
func (s *infraService) GetDormsTable(params repository.DormPageParams) ([]model.Dormitory, int64, error) {
	return s.repo.FindDormsPaged(params)
}

func (s *infraService) GetDormBeds(page, pageSize int, dormId *string) ([]model.DormBed, int64, error) {
	return s.repo.FindAllBeds(page, pageSize, dormId)
}

// GetFloors 获取指定楼栋的所有楼层列表
func (s *infraService) GetFloors(building string) ([]int, error) {
	s.cache.mu.RLock()
	if floors, ok := s.cache.floors[building]; ok && time.Now().Before(s.cache.expiresAt) {
		s.cache.mu.RUnlock()
		return floors, nil
	}
	s.cache.mu.RUnlock()

	floors, err := s.repo.FindFloorsByBuilding(building)
	if err == nil {
		s.cache.mu.Lock()
		s.cache.floors[building] = floors
		s.cache.expiresAt = time.Now().Add(infraCacheTTL)
		s.cache.mu.Unlock()
	}
	return floors, err
}

// GetRooms 获取指定楼栋和楼层的所有房间列表
func (s *infraService) GetRooms(building string, floor *int) ([]string, error) {
	key := building
	if floor != nil {
		key = fmt.Sprintf("%s:%d", building, *floor)
	}

	s.cache.mu.RLock()
	if rooms, ok := s.cache.rooms[key]; ok && time.Now().Before(s.cache.expiresAt) {
		s.cache.mu.RUnlock()
		return rooms, nil
	}
	s.cache.mu.RUnlock()

	rooms, err := s.repo.FindRoomsByBuildingFloor(building, floor)
	if err == nil {
		s.cache.mu.Lock()
		s.cache.rooms[key] = rooms
		s.cache.expiresAt = time.Now().Add(infraCacheTTL)
		s.cache.mu.Unlock()
	}
	return rooms, err
}

func (s *infraService) CreateDorm(dorm *model.Dormitory) error {
	s.invalidateCache()
	if dorm.ID == "" {
		dorm.ID = uuid.New().String()
	}
	// 如果是新创建，默认版本号为 1
	if dorm.Version == 0 {
		dorm.Version = 1
	}
	return s.repo.CreateDorm(dorm)
}

func (s *infraService) UpdateDorm(id string, dorm *model.Dormitory) error {
	s.invalidateCache()
	return s.repo.UpdateDorm(id, dorm)
}

func (s *infraService) DeleteDorms(ids []string) error {
	s.invalidateCache()
	return s.repo.DeleteDorms(ids)
}

func (s *infraService) GetDormMembers(dormId string) ([]model.Student, error) {
	return s.repo.FindDormMembers(dormId)
}

func (s *infraService) CreateBuilding(building *model.Building) error {
	s.invalidateCache()
	return s.repo.CreateBuilding(building)
}

func (s *infraService) UpdateBuilding(id int, building *model.Building) error {
	s.invalidateCache()
	return s.repo.UpdateBuilding(id, building)
}

func (s *infraService) DeleteBuilding(id int) error {
	s.invalidateCache()
	return s.repo.DeleteBuilding(id)
}

func (s *infraService) DeleteBuildings(ids []int) error {
	s.invalidateCache()
	return s.repo.DeleteBuildings(ids)
}

func (s *infraService) PreviewImportDorms(dorms []*model.Dormitory) (*model.ImportPreviewResult, error) {
	result := &model.ImportPreviewResult{
		Total:        len(dorms),
		InvalidItems: []model.ImportError{},
		Conflicts:    []model.ImportConflict{},
		GlobalErrors: []string{},
	}

	// 定义字段长度限制
	const maxBuildingLen = 50
	const maxRoomNoLen = 20
	const maxCampusLen = 50
	const maxGenderLen = 10
	const maxGradeLen = 20

	for i, dorm := range dorms {
		rowNum := i + 2 // Excel 第一行是表头
		hasError := false

		// 必填字段校验
		if dorm.Building == nil || *dorm.Building == "" {
			result.InvalidCount++
			result.InvalidItems = append(result.InvalidItems, model.ImportError{
				Row:       rowNum,
				Field:     "楼栋",
				ErrorType: "empty",
				Reason:    "楼栋名称不能为空",
			})
			hasError = true
		}
		if dorm.RoomNo == nil || *dorm.RoomNo == "" {
			result.InvalidCount++
			result.InvalidItems = append(result.InvalidItems, model.ImportError{
				Row:       rowNum,
				Field:     "房间号",
				ErrorType: "empty",
				Reason:    "房间号不能为空",
			})
			hasError = true
		}

		// 字段长度校验
		if dorm.Building != nil && len(*dorm.Building) > maxBuildingLen {
			result.InvalidCount++
			result.InvalidItems = append(result.InvalidItems, model.ImportError{
				Row:       rowNum,
				Field:     "楼栋",
				ErrorType: "length_exceeded",
				Reason:    fmt.Sprintf("楼栋名称长度超限，最大允许 %d 字符", maxBuildingLen),
				Content:   *dorm.Building,
			})
			hasError = true
		}
		if dorm.RoomNo != nil && len(*dorm.RoomNo) > maxRoomNoLen {
			result.InvalidCount++
			result.InvalidItems = append(result.InvalidItems, model.ImportError{
				Row:       rowNum,
				Field:     "房间号",
				ErrorType: "length_exceeded",
				Reason:    fmt.Sprintf("房间号长度超限，最大允许 %d 字符", maxRoomNoLen),
				Content:   *dorm.RoomNo,
			})
			hasError = true
		}
		if dorm.Campus != nil && len(*dorm.Campus) > maxCampusLen {
			result.InvalidCount++
			result.InvalidItems = append(result.InvalidItems, model.ImportError{
				Row:       rowNum,
				Field:     "校区",
				ErrorType: "length_exceeded",
				Reason:    fmt.Sprintf("校区名称长度超限，最大允许 %d 字符", maxCampusLen),
				Content:   *dorm.Campus,
			})
			hasError = true
		}
		if dorm.Gender != nil && len(*dorm.Gender) > maxGenderLen {
			result.InvalidCount++
			result.InvalidItems = append(result.InvalidItems, model.ImportError{
				Row:       rowNum,
				Field:     "宿舍性别",
				ErrorType: "length_exceeded",
				Reason:    fmt.Sprintf("宿舍性别长度超限，最大允许 %d 字符", maxGenderLen),
				Content:   *dorm.Gender,
			})
			hasError = true
		}
		if dorm.Grade != nil && len(*dorm.Grade) > maxGradeLen {
			result.InvalidCount++
			result.InvalidItems = append(result.InvalidItems, model.ImportError{
				Row:       rowNum,
				Field:     "年级",
				ErrorType: "length_exceeded",
				Reason:    fmt.Sprintf("年级长度超限，最大允许 %d 字符", maxGradeLen),
				Content:   *dorm.Grade,
			})
			hasError = true
		}

		// 容量有效性校验
		if dorm.Capacity != nil && *dorm.Capacity < 0 {
			result.InvalidCount++
			result.InvalidItems = append(result.InvalidItems, model.ImportError{
				Row:       rowNum,
				Field:     "可住人数",
				ErrorType: "type_mismatch",
				Reason:    "可住人数不能为负数",
				Content:   fmt.Sprintf("%d", *dorm.Capacity),
			})
			hasError = true
		}

		// 楼层有效性校验
		if dorm.Floor != nil && *dorm.Floor < 0 {
			result.InvalidCount++
			result.InvalidItems = append(result.InvalidItems, model.ImportError{
				Row:       rowNum,
				Field:     "楼层",
				ErrorType: "type_mismatch",
				Reason:    "楼层不能为负数",
				Content:   fmt.Sprintf("%d", *dorm.Floor),
			})
			hasError = true
		}

		// 如果已有基础校验错误，跳过后续校验
		if hasError {
			continue
		}

		// ========== 楼栋存在性校验 ==========
		// 验证楼栋是否在楼栋管理中存在
		var buildingRecord model.Building
		buildingErr := s.repo.GetDB().Where("name = ?", *dorm.Building).First(&buildingRecord).Error
		if buildingErr != nil {
			result.InvalidCount++
			result.InvalidItems = append(result.InvalidItems, model.ImportError{
				Row:       rowNum,
				Field:     "楼栋",
				ErrorType: "ref_not_found",
				Reason:    fmt.Sprintf("楼栋 [%s] 不存在，请先在楼栋管理中添加", *dorm.Building),
				Content:   *dorm.Building,
			})
			continue // 楼栋不存在则跳过楼层和冲突检测
		}

		// ========== 楼层有效性校验 ==========
		// 验证楼层是否在该楼栋的有效楼层范围内
		if dorm.Floor != nil && *dorm.Floor > 0 {
			if *dorm.Floor > buildingRecord.Floors {
				result.InvalidCount++
				result.InvalidItems = append(result.InvalidItems, model.ImportError{
					Row:       rowNum,
					Field:     "楼层",
					ErrorType: "ref_not_found",
					Reason:    fmt.Sprintf("楼层 [%d] 超出 [%s] 的有效楼层范围 (1-%d)", *dorm.Floor, buildingRecord.Name, buildingRecord.Floors),
					Content:   fmt.Sprintf("%d", *dorm.Floor),
				})
				continue
			}
		}

		// ========== 房间号与楼层一致性校验 ==========
		// 规则：房间号的第一个数字通常应与楼层一致（如 301 应在 3 层）
		if dorm.Floor != nil && *dorm.Floor > 0 && dorm.RoomNo != nil && len(*dorm.RoomNo) > 0 {
			roomNoStr := *dorm.RoomNo
			// 提取房间号的首个数字字符
			var firstDigit int = -1
			for _, c := range roomNoStr {
				if c >= '0' && c <= '9' {
					firstDigit = int(c - '0')
					break
				}
			}
			// 如果房间号首位数字与楼层不一致，记录为警告（不阻止导入，但提示用户检查）
			if firstDigit >= 0 && firstDigit != *dorm.Floor {
				// 这里作为警告而非错误，仍然允许导入
				// 如需严格校验，可取消下面的注释并改为 InvalidCount++
				result.InvalidCount++
				result.InvalidItems = append(result.InvalidItems, model.ImportError{
					Row:       rowNum,
					Field:     "房间号",
					ErrorType: "format_warning",
					Reason:    fmt.Sprintf("房间号 [%s] 首位数字 (%d) 与楼层 (%d) 不一致，请确认是否正确", roomNoStr, firstDigit, *dorm.Floor),
					Content:   roomNoStr,
				})
				continue
			}
		}

		// ========== 房间号重复检测 ==========
		// 检查该楼栋+房间号是否已存在于数据库
		var existing model.Dormitory
		err := s.repo.GetDB().Where("building = ? AND roomNo = ?", *dorm.Building, *dorm.RoomNo).First(&existing).Error
		if err == nil {
			result.ConflictCount++
			result.Conflicts = append(result.Conflicts, model.ImportConflict{
				Row:          rowNum,
				Identifier:   fmt.Sprintf("%s-%s", *dorm.Building, *dorm.RoomNo),
				Name:         fmt.Sprintf("%s %s", *dorm.Building, *dorm.RoomNo),
				ExistingName: fmt.Sprintf("%s %s (已存在)", *dorm.Building, *dorm.RoomNo),
				ConflictType: "duplicate",
			})
		} else {
			result.NewCount++
		}
	}

	result.ValidCount = result.Total - result.InvalidCount
	return result, nil
}

func (s *infraService) BatchImportDorms(dorms []*model.Dormitory, resolution string) (int, int, error) {
	s.invalidateCache()
	successCount := 0
	failedCount := 0

	db := s.repo.GetDB()
	err := db.Transaction(func(tx *gorm.DB) error {
		for _, dorm := range dorms {
			var existing model.Dormitory
			err := tx.Where("building = ? AND roomNo = ?", *dorm.Building, *dorm.RoomNo).First(&existing).Error
			if err == nil {
				// 冲突
				if resolution == "skip" {
					continue
				}
				// 覆盖
				dorm.ID = existing.ID
				if err := tx.Save(dorm).Error; err != nil {
					failedCount++
				} else {
					successCount++
				}
			} else {
				// 新增
				if err := tx.Create(dorm).Error; err != nil {
					failedCount++
				} else {
					successCount++
				}
			}
		}
		return nil
	})

	return successCount, failedCount, err
}

func (s *infraService) PreviewImportDormsV2(items []model.DormImportRow) (*model.DormImportPreviewResponse, error) {
	resp := &model.DormImportPreviewResponse{
		TotalCount: len(items),
		Issues:     []model.DormImportIssue{},
	}

	for _, item := range items {
		hasCriticalIssue := false

		// 1. 必填字段校验 (A类 - 格式/必填)
		missingFields := []string{}
		if item.Campus == nil || *item.Campus == "" {
			missingFields = append(missingFields, "campus")
		}
		if item.Building == nil || *item.Building == "" {
			missingFields = append(missingFields, "building")
		}
		if item.RoomNo == nil || *item.RoomNo == "" {
			missingFields = append(missingFields, "roomNo")
		}
		if item.Capacity == nil || *item.Capacity <= 0 {
			missingFields = append(missingFields, "capacity")
		}
		if item.Gender == nil || *item.Gender == "" {
			missingFields = append(missingFields, "gender")
		}

		if len(missingFields) > 0 {
			resp.IssueCount++
			resp.Issues = append(resp.Issues, model.DormImportIssue{
				RowNo:          item.RowNo,
				ErrorType:      "A",
				ErrorCode:      model.ErrMissingRequiredField,
				Reason:         "必填项缺失或数值无效",
				Suggestion:     "请检查对应列是否已填写且数值大于0",
				AffectedFields: missingFields,
			})
			hasCriticalIssue = true
		}

		// 2. 枚举校验 (A类)
		if item.Gender != nil && *item.Gender != "" {
			validGenders := map[string]bool{"男": true, "女": true, "混合": true, "未指定": true}
			if !validGenders[*item.Gender] {
				resp.IssueCount++
				resp.Issues = append(resp.Issues, model.DormImportIssue{
					RowNo:          item.RowNo,
					ErrorType:      "A",
					ErrorCode:      model.ErrInvalidEnumValue,
					Reason:         fmt.Sprintf("性别值 [%s] 不合法", *item.Gender),
					Suggestion:     "请使用：男、女、混合、未指定",
					AffectedFields: []string{"gender"},
				})
				hasCriticalIssue = true
			}
		}

		if hasCriticalIssue {
			continue // 严重错误跳转下一行
		}

		// 3. 引用校验 (B类 - 逻辑校验)
		var building model.Building
		if err := s.repo.GetDB().Where("name = ?", *item.Building).First(&building).Error; err != nil {
			resp.IssueCount++
			resp.Issues = append(resp.Issues, model.DormImportIssue{
				RowNo:          item.RowNo,
				ErrorType:      "B",
				ErrorCode:      model.ErrBuildingNotFound,
				Reason:         fmt.Sprintf("楼栋 [%s] 在系统中不存在", *item.Building),
				Suggestion:     "前往楼栋管理页面创建该楼栋",
				AffectedFields: []string{"building"},
			})
			continue
		}

		// 4. 重复检测 (C类 - 提示性冲突)
		var existing model.Dormitory
		err := s.repo.GetDB().Where("campus = ? AND building = ? AND roomNo = ?", *item.Campus, *item.Building, *item.RoomNo).First(&existing).Error
		if err == nil {
			resp.IssueCount++
			resp.Issues = append(resp.Issues, model.DormImportIssue{
				RowNo:          item.RowNo,
				ErrorType:      "C",
				ErrorCode:      model.ErrDuplicateEntryInDB,
				Reason:         "宿舍已存在",
				Suggestion:     "继续导入将根据所选策略执行覆盖或跳过",
				AffectedFields: []string{"campus", "building", "roomNo"},
			})
		}
	}

	resp.PassCount = resp.TotalCount - resp.IssueCount
	return resp, nil
}

func (s *infraService) BatchImportDormsV2(items []model.DormImportRow, strategy string) (*model.DormImportExecuteResponse, error) {
	s.invalidateCache()
	resp := &model.DormImportExecuteResponse{
		TotalCount: len(items),
		FailedRows: []model.DormImportIssue{},
	}

	db := s.repo.GetDB()
	err := db.Transaction(func(tx *gorm.DB) error {
		for _, item := range items {
			// B6 兜底：必填字段校验，即使前端绕过也不会 panic
			if item.Campus == nil || *item.Campus == "" ||
				item.Building == nil || *item.Building == "" ||
				item.RoomNo == nil || *item.RoomNo == "" ||
				item.Capacity == nil || *item.Capacity <= 0 ||
				item.Gender == nil || *item.Gender == "" {
				resp.FailedCount++
				resp.FailedRows = append(resp.FailedRows, model.DormImportIssue{
					RowNo:     item.RowNo,
					ErrorType: "E",
					ErrorCode: "MISSING_REQUIRED_FIELD",
					Reason:    "必填字段缺失（后端兜底校验）",
				})
				continue
			}

			var existing model.Dormitory
			err := tx.Where("campus = ? AND building = ? AND roomNo = ?", *item.Campus, *item.Building, *item.RoomNo).First(&existing).Error

			dorm := &model.Dormitory{
				Campus:   item.Campus,
				Building: item.Building,
				Floor:    item.Floor,
				RoomNo:   item.RoomNo,
				Capacity: item.Capacity,
				Gender:   item.Gender,
				Grade:    item.Grade,
				Version:  1,
			}

			if err == nil {
				// 冲突处理
				if strategy == "SKIP" {
					resp.SkippedCount++
					continue
				}
				// 覆盖策略 (OVERWRITE)
				dorm.ID = existing.ID
				if err := tx.Save(dorm).Error; err != nil {
					resp.FailedCount++
					resp.FailedRows = append(resp.FailedRows, model.DormImportIssue{
						RowNo: item.RowNo, ErrorCode: "SAVE_ERROR", Reason: err.Error(),
					})
				} else {
					resp.UpdatedCount++
					resp.SuccessCount++
				}
			} else {
				// 新增导入
				dorm.ID = uuid.New().String()
				if err := tx.Create(dorm).Error; err != nil {
					resp.FailedCount++
					resp.FailedRows = append(resp.FailedRows, model.DormImportIssue{
						RowNo: item.RowNo, ErrorCode: "CREATE_ERROR", Reason: err.Error(),
					})
				} else {
					resp.CreatedCount++
					resp.SuccessCount++
				}
			}
		}
		return nil
	})

	return resp, err
}

// BatchImportDormsV2WithProgress V2版本批量导入（支持进度回传）
func (s *infraService) BatchImportDormsV2WithProgress(items []model.DormImportRow, strategy string, jobId string, taskService ImportTaskService) (*model.DormImportExecuteResponse, error) {
	s.invalidateCache()
	resp := &model.DormImportExecuteResponse{
		TotalCount: len(items),
		FailedRows: []model.DormImportIssue{},
	}

	db := s.repo.GetDB()
	err := db.Transaction(func(tx *gorm.DB) error {
		for i, item := range items {
			// 更新进度
			if taskService != nil {
				taskService.UpdateProgress(jobId, i+1)
			}

			// B6 兜底：必填字段校验，即使前端绕过也不会 panic
			if item.Campus == nil || *item.Campus == "" ||
				item.Building == nil || *item.Building == "" ||
				item.RoomNo == nil || *item.RoomNo == "" ||
				item.Capacity == nil || *item.Capacity <= 0 ||
				item.Gender == nil || *item.Gender == "" {
				resp.FailedCount++
				resp.FailedRows = append(resp.FailedRows, model.DormImportIssue{
					RowNo:     item.RowNo,
					ErrorType: "E",
					ErrorCode: "MISSING_REQUIRED_FIELD",
					Reason:    "必填字段缺失（后端兜底校验）",
				})
				continue
			}

			var existing model.Dormitory
			err := tx.Where("campus = ? AND building = ? AND roomNo = ?", *item.Campus, *item.Building, *item.RoomNo).First(&existing).Error

			dorm := &model.Dormitory{
				Campus:   item.Campus,
				Building: item.Building,
				Floor:    item.Floor,
				RoomNo:   item.RoomNo,
				Capacity: item.Capacity,
				Gender:   item.Gender,
				Grade:    item.Grade,
				Version:  1,
			}

			if err == nil {
				// 冲突处理
				if strategy == "SKIP" {
					resp.SkippedCount++
					continue
				}
				// 覆盖策略 (OVERWRITE)
				dorm.ID = existing.ID
				if err := tx.Save(dorm).Error; err != nil {
					resp.FailedCount++
					resp.FailedRows = append(resp.FailedRows, model.DormImportIssue{
						RowNo: item.RowNo, ErrorCode: "SAVE_ERROR", Reason: err.Error(),
					})
				} else {
					resp.UpdatedCount++
					resp.SuccessCount++
				}
			} else {
				// 新增导入
				dorm.ID = uuid.New().String()
				if err := tx.Create(dorm).Error; err != nil {
					resp.FailedCount++
					resp.FailedRows = append(resp.FailedRows, model.DormImportIssue{
						RowNo: item.RowNo, ErrorCode: "CREATE_ERROR", Reason: err.Error(),
					})
				} else {
					resp.CreatedCount++
					resp.SuccessCount++
				}
			}
		}
		return nil
	})

	return resp, err
}

func normalizeHasElevatorValue(value string) (bool, bool) {
	normalized := strings.TrimSpace(strings.ToLower(value))
	switch normalized {
	case "有", "是", "true", "1":
		return true, true
	case "无", "否", "false", "0":
		return false, true
	default:
		return false, false
	}
}

func (s *infraService) PreviewImportBuildingsV2(items []model.BuildingImportRow) (*model.BuildingImportPreviewResponse, error) {
	resp := &model.BuildingImportPreviewResponse{
		TotalCount: len(items),
		Issues:     []model.BuildingImportIssue{},
	}

	validTypes := map[string]bool{"男": true, "女": true, "混合": true}

	for _, item := range items {
		hasCriticalIssue := false

		name := ""
		if item.Name != nil {
			name = strings.TrimSpace(*item.Name)
		}
		campus := ""
		if item.Campus != nil {
			campus = strings.TrimSpace(*item.Campus)
		}
		buildingType := ""
		if item.Type != nil {
			buildingType = strings.TrimSpace(*item.Type)
		}
		hasElevator := ""
		if item.HasElevator != nil {
			hasElevator = strings.TrimSpace(*item.HasElevator)
		}

		missingFields := []string{}
		if name == "" {
			missingFields = append(missingFields, "name")
		}
		if campus == "" {
			missingFields = append(missingFields, "campus")
		}
		if buildingType == "" {
			missingFields = append(missingFields, "type")
		}
		if item.Floors == nil || *item.Floors <= 0 {
			missingFields = append(missingFields, "floors")
		}

		if len(missingFields) > 0 {
			resp.IssueCount++
			resp.Issues = append(resp.Issues, model.BuildingImportIssue{
				RowNo:          item.RowNo,
				ErrorType:      "A",
				ErrorCode:      model.ErrMissingRequiredField,
				Reason:         "必填项缺失或数值无效",
				Suggestion:     "请检查楼栋名称、校区、类型、楼层数是否已填写",
				AffectedFields: missingFields,
			})
			hasCriticalIssue = true
		}

		if item.Floors != nil && *item.Floors > 50 {
			resp.IssueCount++
			resp.Issues = append(resp.Issues, model.BuildingImportIssue{
				RowNo:          item.RowNo,
				ErrorType:      "A",
				ErrorCode:      model.ErrValueOutOfRange,
				Reason:         fmt.Sprintf("楼层数 [%d] 超出允许范围", *item.Floors),
				Suggestion:     "楼层数应为 1-50 之间的整数",
				AffectedFields: []string{"floors"},
			})
			hasCriticalIssue = true
		}

		if buildingType != "" && !validTypes[buildingType] {
			resp.IssueCount++
			resp.Issues = append(resp.Issues, model.BuildingImportIssue{
				RowNo:          item.RowNo,
				ErrorType:      "A",
				ErrorCode:      model.ErrInvalidEnumValue,
				Reason:         fmt.Sprintf("类型值 [%s] 不合法", buildingType),
				Suggestion:     "请使用：男、女、混合",
				AffectedFields: []string{"type"},
			})
			hasCriticalIssue = true
		}

		if hasElevator != "" {
			if _, ok := normalizeHasElevatorValue(hasElevator); !ok {
				resp.IssueCount++
				resp.Issues = append(resp.Issues, model.BuildingImportIssue{
					RowNo:          item.RowNo,
					ErrorType:      "A",
					ErrorCode:      model.ErrInvalidEnumValue,
					Reason:         fmt.Sprintf("是否有电梯值 [%s] 不合法", hasElevator),
					Suggestion:     "请使用：有/无 或 是/否",
					AffectedFields: []string{"hasElevator"},
				})
				hasCriticalIssue = true
			}
		}

		if hasCriticalIssue {
			continue
		}

		var existing model.Building
		if err := s.repo.GetDB().Where("name = ?", name).First(&existing).Error; err == nil {
			resp.IssueCount++
			resp.Issues = append(resp.Issues, model.BuildingImportIssue{
				RowNo:          item.RowNo,
				ErrorType:      "C",
				ErrorCode:      model.ErrDuplicateEntryInDB,
				Reason:         "楼栋名称已存在",
				Suggestion:     "继续导入将根据所选策略执行覆盖或跳过",
				AffectedFields: []string{"name"},
			})
		}
	}

	resp.PassCount = resp.TotalCount - resp.IssueCount
	return resp, nil
}

func (s *infraService) BatchImportBuildingsV2(items []model.BuildingImportRow, strategy string) (*model.BuildingImportExecuteResponse, error) {
	s.invalidateCache()
	resp := &model.BuildingImportExecuteResponse{
		TotalCount: len(items),
		FailedRows: []model.BuildingImportIssue{},
	}

	db := s.repo.GetDB()
	err := db.Transaction(func(tx *gorm.DB) error {
		for _, item := range items {
			name := ""
			if item.Name != nil {
				name = strings.TrimSpace(*item.Name)
			}
			campus := ""
			if item.Campus != nil {
				campus = strings.TrimSpace(*item.Campus)
			}
			buildingType := ""
			if item.Type != nil {
				buildingType = strings.TrimSpace(*item.Type)
			}

			if name == "" || campus == "" || buildingType == "" || item.Floors == nil || *item.Floors <= 0 {
				resp.FailedCount++
				resp.FailedRows = append(resp.FailedRows, model.BuildingImportIssue{
					RowNo:     item.RowNo,
					ErrorType: "E",
					ErrorCode: "MISSING_REQUIRED_FIELD",
					Reason:    "必填字段缺失（后端兜底校验）",
				})
				continue
			}

			hasElevator := false
			if item.HasElevator != nil {
				if parsed, ok := normalizeHasElevatorValue(*item.HasElevator); ok {
					hasElevator = parsed
				}
			}

			buildingTypeValue := buildingType
			var contactInfo *string
			if item.ContactInfo != nil {
				trimmed := strings.TrimSpace(*item.ContactInfo)
				if trimmed != "" {
					contactInfo = &trimmed
				}
			}

			building := &model.Building{
				Name:        name,
				Campus:      campus,
				Type:        &buildingTypeValue,
				Floors:      *item.Floors,
				HasElevator: hasElevator,
				ContactInfo: contactInfo,
			}

			var existing model.Building
			err := tx.Where("name = ?", name).First(&existing).Error
			if err == nil {
				if strategy == "SKIP" {
					resp.SkippedCount++
					continue
				}
				building.ID = existing.ID
				if err := tx.Save(building).Error; err != nil {
					resp.FailedCount++
					resp.FailedRows = append(resp.FailedRows, model.BuildingImportIssue{
						RowNo: item.RowNo, ErrorCode: "SAVE_ERROR", Reason: err.Error(),
					})
				} else {
					resp.UpdatedCount++
					resp.SuccessCount++
				}
			} else {
				if err := tx.Create(building).Error; err != nil {
					resp.FailedCount++
					resp.FailedRows = append(resp.FailedRows, model.BuildingImportIssue{
						RowNo: item.RowNo, ErrorCode: "CREATE_ERROR", Reason: err.Error(),
					})
				} else {
					resp.CreatedCount++
					resp.SuccessCount++
				}
			}
		}
		return nil
	})

	return resp, err
}

func (s *infraService) BatchImportBuildingsV2WithProgress(items []model.BuildingImportRow, strategy string, jobId string, taskService ImportTaskService) (*model.BuildingImportExecuteResponse, error) {
	s.invalidateCache()
	resp := &model.BuildingImportExecuteResponse{
		TotalCount: len(items),
		FailedRows: []model.BuildingImportIssue{},
	}

	db := s.repo.GetDB()
	err := db.Transaction(func(tx *gorm.DB) error {
		for i, item := range items {
			if taskService != nil {
				taskService.UpdateProgress(jobId, i+1)
			}

			name := ""
			if item.Name != nil {
				name = strings.TrimSpace(*item.Name)
			}
			campus := ""
			if item.Campus != nil {
				campus = strings.TrimSpace(*item.Campus)
			}
			buildingType := ""
			if item.Type != nil {
				buildingType = strings.TrimSpace(*item.Type)
			}

			if name == "" || campus == "" || buildingType == "" || item.Floors == nil || *item.Floors <= 0 {
				resp.FailedCount++
				resp.FailedRows = append(resp.FailedRows, model.BuildingImportIssue{
					RowNo:     item.RowNo,
					ErrorType: "E",
					ErrorCode: "MISSING_REQUIRED_FIELD",
					Reason:    "必填字段缺失（后端兜底校验）",
				})
				continue
			}

			hasElevator := false
			if item.HasElevator != nil {
				if parsed, ok := normalizeHasElevatorValue(*item.HasElevator); ok {
					hasElevator = parsed
				}
			}

			buildingTypeValue := buildingType
			var contactInfo *string
			if item.ContactInfo != nil {
				trimmed := strings.TrimSpace(*item.ContactInfo)
				if trimmed != "" {
					contactInfo = &trimmed
				}
			}

			building := &model.Building{
				Name:        name,
				Campus:      campus,
				Type:        &buildingTypeValue,
				Floors:      *item.Floors,
				HasElevator: hasElevator,
				ContactInfo: contactInfo,
			}

			var existing model.Building
			err := tx.Where("name = ?", name).First(&existing).Error
			if err == nil {
				if strategy == "SKIP" {
					resp.SkippedCount++
					continue
				}
				building.ID = existing.ID
				if err := tx.Save(building).Error; err != nil {
					resp.FailedCount++
					resp.FailedRows = append(resp.FailedRows, model.BuildingImportIssue{
						RowNo: item.RowNo, ErrorCode: "SAVE_ERROR", Reason: err.Error(),
					})
				} else {
					resp.UpdatedCount++
					resp.SuccessCount++
				}
			} else {
				if err := tx.Create(building).Error; err != nil {
					resp.FailedCount++
					resp.FailedRows = append(resp.FailedRows, model.BuildingImportIssue{
						RowNo: item.RowNo, ErrorCode: "CREATE_ERROR", Reason: err.Error(),
					})
				} else {
					resp.CreatedCount++
					resp.SuccessCount++
				}
			}
		}
		return nil
	})

	return resp, err
}

func (s *infraService) PreviewImportBuildings(buildings []*model.Building) (*model.ImportPreviewResult, error) {
	result := &model.ImportPreviewResult{
		Total:        len(buildings),
		InvalidItems: []model.ImportError{},
		Conflicts:    []model.ImportConflict{},
		GlobalErrors: []string{},
	}

	// 定义字段长度限制
	const maxNameLen = 50
	const maxCampusLen = 50
	const maxTypeLen = 20
	const maxContactInfoLen = 200

	for i, building := range buildings {
		rowNum := i + 2
		hasError := false

		// ========== 必填项校验 ==========
		if building.Name == "" {
			result.InvalidCount++
			result.InvalidItems = append(result.InvalidItems, model.ImportError{
				Row:       rowNum,
				Field:     "楼栋名称",
				ErrorType: "empty",
				Reason:    "楼栋名称不能为空",
			})
			hasError = true
		}
		if building.Campus == "" {
			result.InvalidCount++
			result.InvalidItems = append(result.InvalidItems, model.ImportError{
				Row:       rowNum,
				Field:     "校区",
				ErrorType: "empty",
				Reason:    "校区不能为空",
			})
			hasError = true
		}

		// ========== 字段长度校验 ==========
		if len(building.Name) > maxNameLen {
			result.InvalidCount++
			result.InvalidItems = append(result.InvalidItems, model.ImportError{
				Row:       rowNum,
				Field:     "楼栋名称",
				ErrorType: "length_exceeded",
				Reason:    fmt.Sprintf("楼栋名称长度超限，最大允许 %d 字符", maxNameLen),
				Content:   building.Name,
			})
			hasError = true
		}
		if len(building.Campus) > maxCampusLen {
			result.InvalidCount++
			result.InvalidItems = append(result.InvalidItems, model.ImportError{
				Row:       rowNum,
				Field:     "校区",
				ErrorType: "length_exceeded",
				Reason:    fmt.Sprintf("校区长度超限，最大允许 %d 字符", maxCampusLen),
				Content:   building.Campus,
			})
			hasError = true
		}
		if building.Type != nil && len(*building.Type) > maxTypeLen {
			result.InvalidCount++
			result.InvalidItems = append(result.InvalidItems, model.ImportError{
				Row:       rowNum,
				Field:     "类型",
				ErrorType: "length_exceeded",
				Reason:    fmt.Sprintf("类型长度超限，最大允许 %d 字符", maxTypeLen),
				Content:   *building.Type,
			})
			hasError = true
		}
		if building.ContactInfo != nil && len(*building.ContactInfo) > maxContactInfoLen {
			result.InvalidCount++
			result.InvalidItems = append(result.InvalidItems, model.ImportError{
				Row:       rowNum,
				Field:     "联系方式",
				ErrorType: "length_exceeded",
				Reason:    fmt.Sprintf("联系方式长度超限，最大允许 %d 字符", maxContactInfoLen),
				Content:   *building.ContactInfo,
			})
			hasError = true
		}

		// ========== 楼层数值校验 ==========
		if building.Floors < 0 {
			result.InvalidCount++
			result.InvalidItems = append(result.InvalidItems, model.ImportError{
				Row:       rowNum,
				Field:     "楼层数",
				ErrorType: "type_mismatch",
				Reason:    "楼层数不能为负数",
				Content:   fmt.Sprintf("%d", building.Floors),
			})
			hasError = true
		}
		if building.Floors > 100 {
			result.InvalidCount++
			result.InvalidItems = append(result.InvalidItems, model.ImportError{
				Row:       rowNum,
				Field:     "楼层数",
				ErrorType: "invalid_range",
				Reason:    "楼层数超出合理范围（最大 100 层）",
				Content:   fmt.Sprintf("%d", building.Floors),
			})
			hasError = true
		}

		// 如果有基础校验错误，跳过冲突检测
		if hasError {
			continue
		}

		result.ValidCount++

		// ========== 楼栋名称冲突检测 ==========
		var existing model.Building
		err := s.repo.GetDB().Where("name = ?", building.Name).First(&existing).Error
		if err == nil {
			result.ConflictCount++
			result.Conflicts = append(result.Conflicts, model.ImportConflict{
				Row:          rowNum,
				Identifier:   building.Name,
				Name:         building.Name,
				ExistingName: fmt.Sprintf("%s (%s)", existing.Name, existing.Campus),
				ConflictType: "duplicate",
			})
		} else {
			result.NewCount++
		}
	}

	return result, nil
}

func (s *infraService) BatchImportBuildings(buildings []*model.Building, resolution string) (int, int, error) {
	s.invalidateCache()
	successCount := 0
	failedCount := 0

	db := s.repo.GetDB()
	err := db.Transaction(func(tx *gorm.DB) error {
		for _, building := range buildings {
			var existing model.Building
			err := tx.Where("name = ?", building.Name).First(&existing).Error
			if err == nil {
				// 冲突
				if resolution == "skip" {
					continue
				}
				// 覆盖
				building.ID = existing.ID
				if err := tx.Save(building).Error; err != nil {
					failedCount++
				} else {
					successCount++
				}
			} else {
				// 新增
				if err := tx.Create(building).Error; err != nil {
					failedCount++
				} else {
					successCount++
				}
			}
		}
		return nil
	})

	return successCount, failedCount, err
}

// BatchCheckout 批量退宿：清空指定宿舍的所有学生入住信息，并记录日志
func (s *infraService) BatchCheckout(dormIds []string, operatorID string) (affectedCount int, err error) {
	if len(dormIds) == 0 {
		return 0, nil
	}

	db := s.repo.GetDB()
	err = db.Transaction(func(tx *gorm.DB) error {
		// 1. 查询所有需要退宿的学生
		var students []model.Student
		if err := tx.Where("dormId IN ?", dormIds).Find(&students).Error; err != nil {
			return err
		}

		if len(students) == 0 {
			return nil // 没有需要退宿的学生
		}

		// 2. 为每个学生记录退宿日志
		for _, student := range students {
			prevDorm := ""
			if student.DormBuilding != nil && student.DormRoomNo != nil {
				prevDorm = fmt.Sprintf("%s-%s", *student.DormBuilding, *student.DormRoomNo)
			}
			if student.DormID != nil {
				prevDorm = *student.DormID
			}

			log := model.ResidencyLog{
				StudentID: student.ID,
				Type:      "退宿",
				PrevDorm:  &prevDorm,
				CurrDorm:  nil,
				Operator:  operatorID,
				Reason:    ptr("批量退宿操作"),
			}
			if err := tx.Create(&log).Error; err != nil {
				return err
			}
		}

		// 3. 批量清空学生的宿舍关联信息
		result := tx.Model(&model.Student{}).
			Where("dormId IN ?", dormIds).
			Updates(map[string]interface{}{
				"dormId":   nil,
				"building": nil,
				"roomNo":   nil,
				"bedNo":    nil,
			})

		if result.Error != nil {
			return result.Error
		}

		affectedCount = int(result.RowsAffected)
		return nil
	})

	if err == nil {
		s.invalidateCache()
	}

	return affectedCount, err
}

// BatchCheckIn 批量入住：将学生分配到指定宿舍
func (s *infraService) BatchCheckIn(assignments []CheckInAssignment, operatorID string) (successCount, failedCount int, errors []string, err error) {
	if len(assignments) == 0 {
		return 0, 0, nil, nil
	}

	db := s.repo.GetDB()

	// 1. 预加载所有涉及的宿舍信息
	dormIds := make([]string, 0, len(assignments))
	for _, a := range assignments {
		dormIds = append(dormIds, a.DormID)
	}

	var dorms []model.Dormitory
	if err := db.Where("id IN ?", dormIds).Find(&dorms).Error; err != nil {
		return 0, 0, nil, err
	}

	dormMap := make(map[string]*model.Dormitory)
	for i := range dorms {
		dormMap[dorms[i].ID] = &dorms[i]
	}

	// 2. 统计每个宿舍当前入住人数
	type occupancyCount struct {
		DormID string
		Count  int64
	}
	var occupancies []occupancyCount
	if err := db.Model(&model.Student{}).
		Select("dormId as dorm_id, COUNT(*) as count").
		Where("dormId IN ?", dormIds).
		Group("dormId").
		Scan(&occupancies).Error; err != nil {
		return 0, 0, nil, err
	}

	occupancyMap := make(map[string]int64)
	for _, o := range occupancies {
		occupancyMap[o.DormID] = o.Count
	}

	// 3. 预加载所有涉及的学生信息
	studentIds := make([]string, 0, len(assignments))
	for _, a := range assignments {
		studentIds = append(studentIds, a.StudentID)
	}

	var students []model.Student
	if err := db.Where("id IN ?", studentIds).Find(&students).Error; err != nil {
		return 0, 0, nil, err
	}

	studentMap := make(map[string]*model.Student)
	for i := range students {
		studentMap[students[i].ID] = &students[i]
	}

	// 4. 逐条校验并执行入住
	err = db.Transaction(func(tx *gorm.DB) error {
		for _, assignment := range assignments {
			dorm := dormMap[assignment.DormID]
			student := studentMap[assignment.StudentID]

			// 校验宿舍是否存在
			if dorm == nil {
				errors = append(errors, fmt.Sprintf("宿舍 %s 不存在", assignment.DormID))
				failedCount++
				continue
			}

			// 校验学生是否存在
			if student == nil {
				errors = append(errors, fmt.Sprintf("学生 %s 不存在", assignment.StudentID))
				failedCount++
				continue
			}

			// 校验学生是否已入住其他宿舍
			if student.DormID != nil && *student.DormID != "" && *student.DormID != assignment.DormID {
				errors = append(errors, fmt.Sprintf("学生 %s 已入住其他宿舍", student.FullName))
				failedCount++
				continue
			}

			// 校验宿舍容量
			currentOccupancy := occupancyMap[assignment.DormID]
			capacity := 0
			if dorm.Capacity != nil {
				capacity = *dorm.Capacity
			}
			if currentOccupancy >= int64(capacity) {
				errors = append(errors, fmt.Sprintf("宿舍 %s 已满员", *dorm.RoomNo))
				failedCount++
				continue
			}

			// 校验性别匹配
			if dorm.Gender != nil && student.Gender != nil {
				dormGender := *dorm.Gender
				studentGender := *student.Gender
				if dormGender != "混合" && dormGender != "未指定" && dormGender != studentGender {
					errors = append(errors, fmt.Sprintf("学生 %s 性别（%s）与宿舍性别要求（%s）不匹配", student.FullName, studentGender, dormGender))
					failedCount++
					continue
				}
			}

			// 执行入住
			updates := map[string]interface{}{
				"dormId":   assignment.DormID,
				"building": dorm.Building,
				"roomNo":   dorm.RoomNo,
			}
			if assignment.BedNo != "" {
				updates["bedNo"] = assignment.BedNo
			}

			if err := tx.Model(&model.Student{}).Where("id = ?", assignment.StudentID).Updates(updates).Error; err != nil {
				errors = append(errors, fmt.Sprintf("学生 %s 入住失败: %s", student.FullName, err.Error()))
				failedCount++
				continue
			}

			// 记录日志
			prevDorm := ""
			if student.DormID != nil && *student.DormID != "" {
				prevDorm = *student.DormID
			}
			currDorm := assignment.DormID
			log := model.ResidencyLog{
				StudentID: assignment.StudentID,
				Type:      "入住",
				PrevDorm:  &prevDorm,
				CurrDorm:  &currDorm,
				Operator:  operatorID,
				Reason:    ptr("批量入住操作"),
			}
			if err := tx.Create(&log).Error; err != nil {
				// 日志失败不中断，但记录错误
				errors = append(errors, fmt.Sprintf("学生 %s 入住日志记录失败", student.FullName))
			}

			successCount++
			occupancyMap[assignment.DormID]++ // 更新内存中的入住计数
		}
		return nil
	})

	if err == nil && successCount > 0 {
		s.invalidateCache()
	}

	return successCount, failedCount, errors, err
}

// BatchCheckoutStudents 批量学生退宿
func (s *infraService) BatchCheckoutStudents(studentIds []string, operatorID string) (affectedCount int, err error) {
	if len(studentIds) == 0 {
		return 0, nil
	}

	db := s.repo.GetDB()

	err = db.Transaction(func(tx *gorm.DB) error {
		// 查询这些学生的当前宿舍信息，用于记录日志
		var students []model.Student
		if err := tx.Where("id IN ?", studentIds).Find(&students).Error; err != nil {
			return err
		}

		for _, student := range students {
			// 如果已经在寝室，则记录退宿日志
			if student.DormID != nil {
				prevDorm := *student.DormID
				log := model.ResidencyLog{
					StudentID: student.ID,
					Type:      "退宿",
					PrevDorm:  &prevDorm,
					CurrDorm:  nil,
					Operator:  operatorID,
					Reason:    ptr("批量学生退宿操作"),
				}
				if err := tx.Create(&log).Error; err != nil {
					return err
				}
				affectedCount++
			}
		}

		// 批量清空宿舍信息
		if err := tx.Model(&model.Student{}).Where("id IN ?", studentIds).Updates(map[string]interface{}{
			"dormId":   nil,
			"building": nil,
			"roomNo":   nil,
			"bedNo":    nil,
		}).Error; err != nil {
			return err
		}

		return nil
	})

	if err == nil {
		s.invalidateCache()
	}

	return affectedCount, err
}
