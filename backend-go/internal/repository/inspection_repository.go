package repository

import (
	"errors"
	"sort"
	"time"

	"github.com/my-project/backend-go/internal/model"
	"gorm.io/gorm"
)

var ErrInspectionChanged = errors.New("查寝记录已变更，请刷新后再处理")

type InspectionRepository interface {
	FindAll(page, pageSize int, taskId *string, dormId *string) ([]model.Inspection, int64, error)
	GetByID(id string) (*model.Inspection, error)
	Update(inspection *model.Inspection) error
	FindByReviewerID(page, pageSize int, reviewerID string) ([]model.Inspection, int64, error)
}

type inspectionRepository struct {
	db *gorm.DB
}

func NewInspectionRepository(db *gorm.DB) InspectionRepository {
	return &inspectionRepository{db: db}
}

type dormStudentRow struct {
	DormID  *string `gorm:"column:dormId"`
	College *string `gorm:"column:college"`
	Grade   *string `gorm:"column:grade"`
}

func (r *inspectionRepository) attachDormAggregates(inspections []model.Inspection) {
	dormIDSet := make(map[string]struct{})
	dormIDs := make([]string, 0, len(inspections))
	for _, ins := range inspections {
		if ins.DormID == nil || *ins.DormID == "" {
			continue
		}
		if _, exists := dormIDSet[*ins.DormID]; exists {
			continue
		}
		dormIDSet[*ins.DormID] = struct{}{}
		dormIDs = append(dormIDs, *ins.DormID)
	}
	if len(dormIDs) == 0 {
		return
	}

	var rows []dormStudentRow
	if err := r.db.Model(&model.Student{}).
		Select("dormId, college, grade").
		Where("dormId IN ?", dormIDs).
		Find(&rows).Error; err != nil {
		return
	}

	collegeSets := make(map[string]map[string]struct{})
	gradeSets := make(map[string]map[string]struct{})
	for _, row := range rows {
		if row.DormID == nil || *row.DormID == "" {
			continue
		}
		dormID := *row.DormID
		if row.College != nil && *row.College != "" {
			if _, ok := collegeSets[dormID]; !ok {
				collegeSets[dormID] = make(map[string]struct{})
			}
			collegeSets[dormID][*row.College] = struct{}{}
		}
		if row.Grade != nil && *row.Grade != "" {
			if _, ok := gradeSets[dormID]; !ok {
				gradeSets[dormID] = make(map[string]struct{})
			}
			gradeSets[dormID][*row.Grade] = struct{}{}
		}
	}

	collegesByDorm := make(map[string][]string)
	for dormID, set := range collegeSets {
		colleges := make([]string, 0, len(set))
		for value := range set {
			colleges = append(colleges, value)
		}
		sort.Strings(colleges)
		collegesByDorm[dormID] = colleges
	}

	gradesByDorm := make(map[string][]string)
	for dormID, set := range gradeSets {
		grades := make([]string, 0, len(set))
		for value := range set {
			grades = append(grades, value)
		}
		sort.Strings(grades)
		gradesByDorm[dormID] = grades
	}

	for i := range inspections {
		ins := &inspections[i]
		if ins.DormID == nil || *ins.DormID == "" {
			continue
		}
		dormID := *ins.DormID
		if colleges, ok := collegesByDorm[dormID]; ok {
			ins.DormColleges = colleges
		}
		if grades, ok := gradesByDorm[dormID]; ok && len(grades) > 0 {
			ins.DormGrades = grades
		} else if ins.Dorm != nil && ins.Dorm.Grade != nil && *ins.Dorm.Grade != "" {
			ins.DormGrades = []string{*ins.Dorm.Grade}
		}
	}
}

func (r *inspectionRepository) FindAll(page, pageSize int, taskId *string, dormId *string) ([]model.Inspection, int64, error) {
	var inspections []model.Inspection
	var total int64

	tx := r.db.Model(&model.Inspection{})
	if taskId != nil {
		tx = tx.Where("taskId = ?", *taskId)
	}
	if dormId != nil {
		tx = tx.Where("dormId = ?", *dormId)
	}

	// 与 Node.js 保持一致：
	// 1. Preload Task 的基本信息（排除 Task 的 Inspections 字段避免循环加载）
	// 2. 排序改为 createdAt DESC（最新的在前）
	// 3. 移除分页限制，返回所有记录
	err := tx.Preload("Dorm").Preload("Dorm.BuildingRef").
		// 只 Preload Task 的基本字段，不加载其关联数据（避免循环引用）
		Preload("Task", func(db *gorm.DB) *gorm.DB {
			return db.Select("id", "title", "date", "deadline", "status", "notes", "createdAt")
		}).
		// Preload CreatedBy 以获取检查人姓名
		Preload("CreatedBy", func(db *gorm.DB) *gorm.DB {
			return db.Select("id", "fullName", "username")
		}).
		// Preload ReviewedBy 以获取实际提交人姓名（提交时设置的是 reviewedById）
		Preload("ReviewedBy", func(db *gorm.DB) *gorm.DB {
			return db.Select("id", "fullName", "username")
		}).
		Order("createdAt DESC").
		Find(&inspections).Error

	if err != nil {
		return nil, 0, err
	}

	// 过滤掉 task 为 null 的无效记录（与 Node.js 一致）
	validInspections := make([]model.Inspection, 0, len(inspections))
	for _, ins := range inspections {
		if ins.Task != nil {
			validInspections = append(validInspections, ins)
		}
	}

	total = int64(len(validInspections))
	r.attachDormAggregates(validInspections)
	return validInspections, total, nil
}

func (r *inspectionRepository) GetByID(id string) (*model.Inspection, error) {
	var inspection model.Inspection
	if err := r.db.Preload("Dorm").First(&inspection, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &inspection, nil
}

func (r *inspectionRepository) Update(inspection *model.Inspection) error {
	return UpdateInspectionResult(r.db, inspection)
}

func UpdateInspectionResult(db *gorm.DB, inspection *model.Inspection) error {
	previous := inspection.UpdatedAt
	next := time.Now().Truncate(time.Millisecond).Add(time.Millisecond)
	if !next.After(previous) {
		next = previous.Truncate(time.Millisecond).Add(time.Millisecond)
	}
	query := db.Model(&model.Inspection{}).Where("id = ?", inspection.ID)
	if previous.IsZero() {
		query = query.Where("updatedAt IS NULL OR updatedAt = ?", previous)
	} else {
		query = query.Where("updatedAt = ?", previous)
	}
	result := query.Updates(map[string]any{
		"totalScore": inspection.TotalScore, "detail": inspection.Detail, "comments": inspection.Comments,
		"photoUrls": inspection.Photos, "reviewedById": inspection.ReviewedByID, "updatedAt": next,
	})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected != 1 {
		return ErrInspectionChanged
	}
	inspection.UpdatedAt = next
	return nil
}

func (r *inspectionRepository) FindByReviewerID(page, pageSize int, reviewerID string) ([]model.Inspection, int64, error) {
	var inspections []model.Inspection
	var total int64

	query := r.db.Model(&model.Inspection{}).Where("reviewedById = ?", reviewerID)
	query.Count(&total)

	err := query.Preload("Dorm").Preload("Dorm.BuildingRef").
		// Preload CreatedBy 以获取检查人姓名
		Preload("CreatedBy", func(db *gorm.DB) *gorm.DB {
			return db.Select("id", "fullName", "username")
		}).
		// Preload ReviewedBy 以获取实际提交人姓名
		Preload("ReviewedBy", func(db *gorm.DB) *gorm.DB {
			return db.Select("id", "fullName", "username")
		}).
		Scopes(Paginate(page, pageSize)).
		Order("createdAt DESC").
		Find(&inspections).Error
	if err == nil {
		r.attachDormAggregates(inspections)
	}
	return inspections, total, err
}
