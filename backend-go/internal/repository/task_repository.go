package repository

import (
	"time"

	"github.com/google/uuid"
	"github.com/my-project/backend-go/internal/model"
	"gorm.io/gorm"
)

type TaskRepository interface {
	CreateTaskWithRelations(task *model.Task, inspections []model.Inspection, executorDorms []model.TaskExecutorDorm) error
	FindAll(page, pageSize int) ([]model.Task, int64, error)
	FindByID(id string) (*model.Task, error)
	FindBasicByID(id string) (*model.Task, error)
	FindWithDormIDsByID(id string) (*model.Task, error)
	Delete(id string) error
	Update(task *model.Task) error
	SetTaskDorms(taskId string, dormIds []string) error
	SetTaskExecutors(taskId string, executorIds []string) error
	FindMyAssignedDorms(taskId string, executorId string, building, floor, campus, search string) ([]model.Dormitory, error)
	CreateInspection(inspection *model.Inspection) error
}

type taskRepository struct {
	db *gorm.DB
}

func NewTaskRepository(db *gorm.DB) TaskRepository {
	return &taskRepository{db: db}
}

func (r *taskRepository) CreateTaskWithRelations(task *model.Task, inspections []model.Inspection, executorDorms []model.TaskExecutorDorm) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		// 1. 创建任务
		if err := tx.Create(task).Error; err != nil {
			return err
		}

		// 2. 批量创建初始检查记录
		if len(inspections) > 0 {
			if err := tx.CreateInBatches(inspections, 100).Error; err != nil {
				return err
			}
		}

		// 3. 批量创建执行人-宿舍分配记录
		if len(executorDorms) > 0 {
			if err := tx.CreateInBatches(executorDorms, 100).Error; err != nil {
				return err
			}
		}

		return nil
	})
}

func (r *taskRepository) FindAll(page, pageSize int) ([]model.Task, int64, error) {
	var tasks []model.Task
	var total int64

	tx := r.db.Model(&model.Task{})

	// 获取总数
	tx.Session(&gorm.Session{}).Count(&total)

	// 查询数据 (优化：列表页不加载详情关联，仅加载创建者，避免几万行数据的 Join 导致超时)
	err := tx.Order("createdAt DESC").
		Preload("CreatedBy").
		Preload("Dorms").
		Preload("Dorms.Dorm").
		Preload("Executors.Executor").
		Scopes(Paginate(page, pageSize)).
		Find(&tasks).Error
	return tasks, total, err
}

func (r *taskRepository) FindByID(id string) (*model.Task, error) {
	var task model.Task
	err := r.db.Preload("CreatedBy").
		Preload("Inspections").
		Preload("Inspections.Dorm").
		Preload("Inspections.CreatedBy").
		Preload("Inspections.ReviewedBy").
		Preload("Dorms").
		Preload("Dorms.Dorm").
		Preload("Executors").
		Preload("Executors.Executor").
		Preload("ExecutorDorms").
		Preload("ExecutorDorms.Executor").
		Preload("ExecutorDorms.Dorm").
		First(&task, "id = ?", id).Error

	if err != nil {
		return nil, err
	}
	return &task, nil
}

func (r *taskRepository) FindBasicByID(id string) (*model.Task, error) {
	var task model.Task
	err := r.db.Preload("CreatedBy").
		First(&task, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &task, nil
}

func (r *taskRepository) FindWithDormIDsByID(id string) (*model.Task, error) {
	var task model.Task
	// 仅加载关联表，不加载深层 Dorm/User 对象，避免几万个 ID 导致 MySQL 占位符超限
	err := r.db.Preload("CreatedBy").
		Preload("Dorms").
		Preload("Executors").
		First(&task, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &task, nil
}

// Delete 删除任务及其关联的查寝记录
func (r *taskRepository) Delete(id string) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		// 1. 删除关联的查寝记录
		if err := tx.Where("taskId = ?", id).Delete(&model.Inspection{}).Error; err != nil {
			return err
		}
		// 2. 删除任务
		if err := tx.Where("id = ?", id).Delete(&model.Task{}).Error; err != nil {
			return err
		}
		return nil
	})
}

// Update 更新任务 (仅更新任务基本字段，严格禁用关联同步)
func (r *taskRepository) Update(task *model.Task) error {
	// 使用 map 形式 Updates 确保 GORM 只更新这些基础字段，且完全不触碰关联表
	return r.db.Model(&model.Task{}).Where("id = ?", task.ID).Updates(map[string]interface{}{
		"title":        task.Title,
		"date":         task.Date,
		"timeSlot":     task.TimeSlot,
		"notes":        task.Notes,
		"description":  task.Description,
		"deadline":     task.Deadline,
		"status":       task.Status,
		"roleRequired": task.RoleRequired,
		"scoringItems": task.ScoringItems,
		"updatedAt":    time.Now(),
	}).Error
}

// SetTaskDorms 设置任务关联的宿舍
func (r *taskRepository) SetTaskDorms(taskId string, dormIds []string) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		// 1. 删除旧的关联
		if err := tx.Where("taskId = ?", taskId).Delete(&model.TaskDorm{}).Error; err != nil {
			return err
		}
		// 2. 创建新的关联
		if len(dormIds) > 0 {
			dorms := make([]model.TaskDorm, 0, len(dormIds))
			for _, dormId := range dormIds {
				dorms = append(dorms, model.TaskDorm{
					ID:     uuid.New().String(),
					TaskID: taskId,
					DormID: dormId,
				})
			}
			if err := tx.CreateInBatches(dorms, 100).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

// SetTaskExecutors 设置任务执行人
func (r *taskRepository) SetTaskExecutors(taskId string, executorIds []string) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		// 1. 删除旧的关联
		if err := tx.Where("taskId = ?", taskId).Delete(&model.TaskExecutor{}).Error; err != nil {
			return err
		}
		// 2. 创建新的关联
		if len(executorIds) > 0 {
			executors := make([]model.TaskExecutor, 0, len(executorIds))
			for _, executorId := range executorIds {
				executors = append(executors, model.TaskExecutor{
					ID:         uuid.New().String(),
					TaskID:     taskId,
					ExecutorID: executorId,
				})
			}
			if err := tx.CreateInBatches(executors, 100).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

func (r *taskRepository) FindMyAssignedDorms(taskId string, executorId string, building, floor, campus, search string) ([]model.Dormitory, error) {
	var dorms []model.Dormitory
	query := r.db.Table("dormitory").
		Joins("JOIN taskexecutordorm ON taskexecutordorm.dormId = dormitory.id").
		Where("taskexecutordorm.taskId = ? AND taskexecutordorm.executorId = ?", taskId, executorId)

	if building != "" {
		query = query.Where("dormitory.building = ?", building)
	}
	if floor != "" {
		query = query.Where("dormitory.floor = ?", floor)
	}
	if campus != "" {
		query = query.Where("dormitory.campus = ?", campus)
	}
	if search != "" {
		query = query.Where("dormitory.roomNo LIKE ?", "%"+search+"%")
	}

	// 按房间号升序排序（先按数字部分，再按原始字符串）
	err := query.Order("CAST(dormitory.roomNo AS UNSIGNED) ASC, dormitory.roomNo ASC").
		Preload("BuildingRef").Find(&dorms).Error
	return dorms, err
}

func (r *taskRepository) CreateInspection(inspection *model.Inspection) error {
	return r.db.Create(inspection).Error
}
