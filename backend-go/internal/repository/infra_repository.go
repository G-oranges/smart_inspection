package repository

import (
	"fmt"
	"strconv"

	"github.com/google/uuid"
	"github.com/my-project/backend-go/internal/model"
	"gorm.io/gorm"
)

type InfrastructureRepository interface {
	// Building
	FindAllBuildings() ([]model.Building, error)
	FindAllBuildingsLite() ([]model.Building, error)
	CreateBuilding(building *model.Building) error
	UpdateBuilding(id int, building *model.Building) error
	DeleteBuilding(id int) error
	DeleteBuildings(ids []int) error

	// Dormitory
	FindAllDorms(page, pageSize int, buildingId *int) ([]model.Dormitory, int64, error)
	FindDormsPaged(params DormPageParams) ([]model.Dormitory, int64, error)
	FindByID(id string) (*model.Dormitory, error)
	CreateDorm(dorm *model.Dormitory) error
	UpdateDorm(id string, dorm *model.Dormitory) error
	DeleteDorms(ids []string) error
	FindDormMembers(dormId string) ([]model.Student, error)

	// DormBed
	FindAllBeds(page, pageSize int, dormId *string) ([]model.DormBed, int64, error)

	// 扩展方法
	FindFloorsByBuilding(building string) ([]int, error)
	FindRoomsByBuildingFloor(building string, floor *int) ([]string, error)
	GetDB() *gorm.DB
}

// DormPageParams 宿舍分页查询参数
type DormPageParams struct {
	Page            int
	PageSize        int
	Search          string
	Building        []string
	Floor           []int
	Grade           []string // 学生年级（跨表查询）
	Gender          []string
	College         []string
	Major           []string
	ClassName       []string
	OccupancyStatus []string // 入住状态: full/partial/empty
	Campus          string
	SortField       string
	SortOrder       string
	Scope           *DormitoryScope
}

type DormitoryScope struct {
	Buildings []string
	Floors    []DormitoryScopeFloor
	Rooms     []DormitoryScopeRoom
}

type DormitoryScopeFloor struct {
	Building string
	Floor    int
}

type DormitoryScopeRoom struct {
	Building string
	Floor    int
	RoomNo   string
}

type infraRepository struct {
	db *gorm.DB
}

func NewInfrastructureRepository(db *gorm.DB) InfrastructureRepository {
	return &infraRepository{db: db}
}

func (r *infraRepository) FindAllBuildings() ([]model.Building, error) {
	var buildings []model.Building
	err := r.db.Order("name ASC").Find(&buildings).Error
	return buildings, err
}

func (r *infraRepository) CreateBuilding(building *model.Building) error {
	return r.db.Create(building).Error
}

func (r *infraRepository) UpdateBuilding(id int, building *model.Building) error {
	return r.db.Model(&model.Building{}).Where("id = ?", id).Updates(building).Error
}

func (r *infraRepository) DeleteBuilding(id int) error {
	return r.db.Delete(&model.Building{}, id).Error
}

func (r *infraRepository) DeleteBuildings(ids []int) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		// 检查是否有宿舍关联在该楼栋下
		var count int64
		if err := tx.Model(&model.Dormitory{}).Where("buildingId IN ?", ids).Count(&count).Error; err != nil {
			return err
		}
		if count > 0 {
			return fmt.Errorf("选中的楼栋下尚有 %d 个关联宿舍，请先删除宿舍记录", count)
		}
		return tx.Delete(&model.Building{}, "id IN ?", ids).Error
	})
}

func (r *infraRepository) FindAllDorms(page, pageSize int, buildingId *int) ([]model.Dormitory, int64, error) {
	var dorms []model.Dormitory
	var total int64

	query := r.db.Model(&model.Dormitory{})
	if buildingId != nil {
		query = query.Where("building_id = ?", *buildingId)
	}

	query.Count(&total)

	// 使用 PaginateUnlimited 返回全量数据（不限制 pageSize）
	err := query.Preload("BuildingRef").Preload("Beds").Scopes(PaginateUnlimited(page, pageSize)).Find(&dorms).Error
	return dorms, total, err
}

func (r *infraRepository) FindAllBeds(page, pageSize int, dormId *string) ([]model.DormBed, int64, error) {
	var beds []model.DormBed
	var total int64

	query := r.db.Model(&model.DormBed{})
	if dormId != nil {
		query = query.Where("dormId = ?", *dormId) // 使用 camelCase 列名
	}

	query.Count(&total)

	// Preload Dorm 和 Student
	err := query.Preload("Dorm").Preload("Student").Scopes(Paginate(page, pageSize)).Find(&beds).Error
	return beds, total, err
}

// FindFloorsByBuilding 根据楼栋名称获取所有不同的楼层
func (r *infraRepository) FindFloorsByBuilding(building string) ([]int, error) {
	var floors []int
	err := r.db.Model(&model.Dormitory{}).
		Distinct("floor").
		Where("building = ?", building).
		Order("floor ASC").
		Pluck("floor", &floors).Error
	return floors, err
}

// FindRoomsByBuildingFloor 根据楼栋和楼层获取所有房间号
func (r *infraRepository) FindRoomsByBuildingFloor(building string, floor *int) ([]string, error) {
	var rooms []string
	query := r.db.Model(&model.Dormitory{}).
		Select("roomNo").
		Where("building = ?", building)

	if floor != nil {
		query = query.Where("floor = ?", *floor)
	}

	err := query.Order("roomNo ASC").Pluck("roomNo", &rooms).Error
	return rooms, err
}

// FindAllBuildingsLite 获取所有楼栋的简要信息（用于下拉选择）
func (r *infraRepository) FindAllBuildingsLite() ([]model.Building, error) {
	var buildings []model.Building
	err := r.db.Select("id, name, campus, floors, type, hasElevator").
		Order("campus ASC, name ASC").
		Find(&buildings).Error
	return buildings, err
}

// FindDormsPaged 分页获取宿舍列表（支持筛选和排序）
func (r *infraRepository) FindDormsPaged(params DormPageParams) ([]model.Dormitory, int64, error) {
	var dorms []model.Dormitory
	var total int64

	query := r.db.Model(&model.Dormitory{})

	// 搜索条件
	if params.Search != "" {
		search := "%" + params.Search + "%"
		query = query.Where("roomNo LIKE ? OR building LIKE ? OR campus LIKE ?", search, search, search)
	}

	// 楼栋筛选
	if len(params.Building) > 0 {
		query = query.Where("building IN ?", params.Building)
	}

	query = applyDormitoryScope(query, params.Scope)

	// 楼层筛选
	if len(params.Floor) > 0 {
		query = query.Where("floor IN ?", params.Floor)
	}

	// 性别筛选
	if len(params.Gender) > 0 {
		query = query.Where("gender IN ?", params.Gender)
	}

	// 关联学生表进行学院、专业、班级、年级筛选
	if len(params.College) > 0 || len(params.Major) > 0 || len(params.ClassName) > 0 || len(params.Grade) > 0 {
		studentQuery := r.db.Model(&model.Student{}).Select("dormId")
		if len(params.College) > 0 {
			studentQuery = studentQuery.Where("college IN ?", params.College)
		}
		if len(params.Major) > 0 {
			studentQuery = studentQuery.Where("major IN ?", params.Major)
		}
		if len(params.ClassName) > 0 {
			studentQuery = studentQuery.Where("className IN ?", params.ClassName)
		}
		if len(params.Grade) > 0 {
			studentQuery = studentQuery.Where("grade IN ?", params.Grade)
		}
		query = query.Where("id IN (?)", studentQuery)
	}

	// 入住状态筛选（需要先查询再过滤，因为涉及计算字段）
	// 注：此筛选在内存中进行，因为 occupiedCount 是计算字段
	hasOccupancyFilter := len(params.OccupancyStatus) > 0

	// 统计总数（在应用分页之前）
	// 注意：如果有入住状态筛选，总数需要在过滤后重新计算
	if !hasOccupancyFilter {
		query.Count(&total)
	}

	// 排序字段映射和验证
	validSortFields := map[string]string{
		"roomNo":    "roomNo",
		"building":  "building",
		"floor":     "floor",
		"campus":    "campus",
		"capacity":  "capacity",
		"gender":    "gender",
		"grade":     "grade",
		"createdAt": "createdAt",
		// 计算字段使用默认排序
		"occupancy":     "roomNo",
		"occupiedCount": "roomNo",
	}

	orderClause := "roomNo ASC"
	if params.SortField != "" {
		// 验证排序字段是否有效
		dbField, valid := validSortFields[params.SortField]
		if !valid {
			dbField = "roomNo" // 默认字段
		}
		order := "ASC"
		if params.SortOrder == "desc" {
			order = "DESC"
		}
		orderClause = dbField + " " + order
	}

	// 如果有入住状态筛选，需要先获取全量数据再进行内存过滤
	if hasOccupancyFilter {
		// 获取所有符合条件的宿舍（不分页）
		var allDorms []model.Dormitory
		err := query.Preload("BuildingRef").
			Preload("Beds").
			Preload("Beds.Student").
			Order(orderClause).
			Find(&allDorms).Error
		if err != nil {
			return nil, 0, err
		}

		// 内存过滤：根据入住状态筛选
		var filteredDorms []model.Dormitory
		statusSet := make(map[string]bool)
		for _, s := range params.OccupancyStatus {
			statusSet[s] = true
		}

		for _, d := range allDorms {
			occupiedCount := 0
			for _, bed := range d.Beds {
				if bed.StudentID != nil && *bed.StudentID != "" {
					occupiedCount++
				}
			}
			capacity := 0
			if d.Capacity != nil {
				capacity = *d.Capacity
			}

			// 判断入住状态
			var status string
			if capacity == 0 {
				status = "empty" // 无床位视为空
			} else if occupiedCount == 0 {
				status = "empty"
			} else if occupiedCount >= capacity {
				status = "full"
			} else {
				status = "partial"
			}

			if statusSet[status] {
				filteredDorms = append(filteredDorms, d)
			}
		}

		// 计算过滤后的总数
		total = int64(len(filteredDorms))

		// 内存分页
		start := (params.Page - 1) * params.PageSize
		end := start + params.PageSize
		if start >= len(filteredDorms) {
			dorms = []model.Dormitory{}
		} else if end > len(filteredDorms) {
			dorms = filteredDorms[start:]
		} else {
			dorms = filteredDorms[start:end]
		}

		return dorms, total, nil
	}

	// 无入住状态筛选时，正常分页查询
	err := query.Preload("BuildingRef").
		Preload("Beds").
		Preload("Beds.Student").
		Order(orderClause).
		Scopes(Paginate(params.Page, params.PageSize)).
		Find(&dorms).Error

	return dorms, total, err
}

func applyDormitoryScope(query *gorm.DB, scope *DormitoryScope) *gorm.DB {
	if scope == nil {
		return query
	}

	hasAnyScope := len(scope.Buildings) > 0 || len(scope.Floors) > 0 || len(scope.Rooms) > 0
	if !hasAnyScope {
		return query.Where("1 = 0")
	}

	return query.Where(func(tx *gorm.DB) *gorm.DB {
		started := false

		if len(scope.Buildings) > 0 {
			tx = tx.Where("building IN ?", scope.Buildings)
			started = true
		}
		for _, floor := range scope.Floors {
			if floor.Building == "" {
				continue
			}
			if started {
				tx = tx.Or("(building = ? AND floor = ?)", floor.Building, floor.Floor)
			} else {
				tx = tx.Where("(building = ? AND floor = ?)", floor.Building, floor.Floor)
				started = true
			}
		}
		for _, room := range scope.Rooms {
			if room.Building == "" || room.RoomNo == "" {
				continue
			}
			if started {
				tx = tx.Or("(building = ? AND floor = ? AND roomNo = ?)", room.Building, room.Floor, room.RoomNo)
			} else {
				tx = tx.Where("(building = ? AND floor = ? AND roomNo = ?)", room.Building, room.Floor, room.RoomNo)
				started = true
			}
		}

		if !started {
			return tx.Where("1 = 0")
		}
		return tx
	})
}

func (r *infraRepository) FindByID(id string) (*model.Dormitory, error) {
	var dorm model.Dormitory
	err := r.db.Preload("BuildingRef").Preload("Beds").Preload("Beds.Student").First(&dorm, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &dorm, nil
}

func (r *infraRepository) CreateDorm(dorm *model.Dormitory) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		// 1. 创建宿舍
		if err := tx.Create(dorm).Error; err != nil {
			return err
		}

		// 2. 根据容量创建床位
		if dorm.Capacity != nil && *dorm.Capacity > 0 {
			capacity := *dorm.Capacity
			beds := make([]model.DormBed, 0, capacity)
			for i := 1; i <= capacity; i++ {
				bedNo := strconv.Itoa(i)
				beds = append(beds, model.DormBed{
					ID:     uuid.New().String(),
					DormID: dorm.ID,
					BedNo:  bedNo,
					Status: "available",
				})
			}
			if err := tx.CreateInBatches(beds, 100).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

func (r *infraRepository) UpdateDorm(id string, dorm *model.Dormitory) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		// 1. 获取原宿舍数据
		var oldDorm model.Dormitory
		if err := tx.First(&oldDorm, "id = ?", id).Error; err != nil {
			return err
		}

		// 2. 计算原容量和新容量
		oldCapacity := 0
		if oldDorm.Capacity != nil {
			oldCapacity = *oldDorm.Capacity
		}
		newCapacity := 0
		if dorm.Capacity != nil {
			newCapacity = *dorm.Capacity
		}

		// 3. 更新宿舍基本信息（使用 Select 确保零值字段也能更新）
		if err := tx.Model(&model.Dormitory{}).Where("id = ?", id).
			Select("campus", "building", "floor", "roomNo", "capacity", "gender", "grade", "counselorId", "buildingId", "version").
			Updates(dorm).Error; err != nil {
			return err
		}

		// 4. 同步床位：处理容量变化
		if newCapacity != oldCapacity {
			if err := r.syncDormBeds(tx, id, oldCapacity, newCapacity); err != nil {
				return err
			}
		}

		return nil
	})
}

// syncDormBeds 同步宿舍床位：根据容量变化增删床位记录
func (r *infraRepository) syncDormBeds(tx *gorm.DB, dormID string, oldCapacity, newCapacity int) error {
	if newCapacity > oldCapacity {
		// 【增量】生成新床位
		for i := oldCapacity + 1; i <= newCapacity; i++ {
			bed := model.DormBed{
				ID:     uuid.New().String(),
				DormID: dormID,
				BedNo:  strconv.Itoa(i),
				Status: "available",
			}
			if err := tx.Create(&bed).Error; err != nil {
				return err
			}
		}
	} else if newCapacity < oldCapacity {
		// 【减量】检查要删除的床位是否有人入住
		// 查找床位号大于 newCapacity 且有学生入住的床位数量
		var occupiedCount int64
		if err := tx.Model(&model.DormBed{}).
			Where("dormId = ?", dormID).
			Where("CAST(bedNo AS SIGNED) > ?", newCapacity).
			Where("studentId IS NOT NULL AND studentId != ''").
			Count(&occupiedCount).Error; err != nil {
			return err
		}

		if occupiedCount > 0 {
			return fmt.Errorf("无法缩小宿舍规模：有 %d 个待删除的床位当前已有学生入住，请先办理退宿", occupiedCount)
		}

		// 删除多余的空床位（bedNo 大于 newCapacity 的）
		if err := tx.Where("dormId = ? AND CAST(bedNo AS SIGNED) > ?", dormID, newCapacity).
			Delete(&model.DormBed{}).Error; err != nil {
			return err
		}
	}
	return nil
}

func (r *infraRepository) DeleteDorms(ids []string) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		// 检查是否有学生入住
		var count int64
		if err := tx.Model(&model.DormBed{}).Where("dormId IN ? AND studentId IS NOT NULL AND studentId != ''", ids).Count(&count).Error; err != nil {
			return err
		}
		if count > 0 {
			return fmt.Errorf("选中的宿舍中有 %d 位学生尚未退宿，请先处理退宿", count)
		}

		// 删除关联的床位
		if err := tx.Where("dormId IN ?", ids).Delete(&model.DormBed{}).Error; err != nil {
			return err
		}
		return tx.Delete(&model.Dormitory{}, "id IN ?", ids).Error
	})
}

func (r *infraRepository) FindDormMembers(dormId string) ([]model.Student, error) {
	var students []model.Student
	err := r.db.Where("dormId = ?", dormId).Find(&students).Error
	return students, err
}

func (r *infraRepository) GetDB() *gorm.DB {
	return r.db
}
