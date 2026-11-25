package service

import (
	"encoding/json"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/my-project/backend-go/internal/model"
	"github.com/my-project/backend-go/internal/repository"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

type TargetScope struct {
	BuildingIDs []int `json:"buildingIds"`
}

type CreateTaskRequest struct {
	Title        string         `json:"title"`
	Description  string         `json:"description"`
	Date         string         `json:"date"`     // 开始时间字符串
	Deadline     string         `json:"deadline"` // 截止时间字符串
	Notes        string         `json:"notes"`
	ScoringItems datatypes.JSON `json:"scoringItems"`
	DormIds      []string       `json:"dormIds"`
	Executors    []string       `json:"executors"`
}

type TaskService interface {
	CreateTask(req CreateTaskRequest, createdByID string) (*model.Task, error)
	GetTasks(page, pageSize int) ([]model.Task, int64, error)
	GetTaskByID(id string) (*model.Task, error)
	GetTaskWithDormIDsByID(id string) (*model.Task, error)
	DeleteTask(id string) error
	UpdateTask(id string, req UpdateTaskRequest) (*model.Task, error)
	GetMyAssignedDorms(taskId string, executorId string, building, floor, campus, search string) ([]model.Dormitory, error)
	SubmitTaskInspection(taskId string, dormId string, reviewerID string, score int, comments string, photos []string, detail interface{}) error
}

type taskService struct {
	taskRepo  repository.TaskRepository
	infraRepo repository.InfrastructureRepository
	db        *gorm.DB // 用于某些直接查询
}

func NewTaskService(taskRepo repository.TaskRepository, infraRepo repository.InfrastructureRepository, db *gorm.DB) TaskService {
	return &taskService{
		taskRepo:  taskRepo,
		infraRepo: infraRepo,
		db:        db,
	}
}

func (s *taskService) CreateTask(req CreateTaskRequest, createdByID string) (*model.Task, error) {
	taskID := uuid.New().String()

	// 1. 解析日期
	var startDate, deadlineDate time.Time
	formats := []string{time.RFC3339, "2006-01-02T15:04:05.000Z", "2006-01-02 15:04:05", "2006-01-02T15:04:05Z"}

	if req.Date != "" {
		for _, f := range formats {
			if t, err := time.Parse(f, req.Date); err == nil {
				startDate = t
				break
			}
		}
	}
	if req.Deadline != "" {
		for _, f := range formats {
			if t, err := time.Parse(f, req.Deadline); err == nil {
				deadlineDate = t
				break
			}
		}
	}

	// 自动判定初始状态
	now := time.Now()
	status := "ONGOING"
	if !startDate.IsZero() && now.Before(startDate) {
		status = "NOT_STARTED"
	} else if !deadlineDate.IsZero() && now.After(deadlineDate) {
		status = "FINISHED"
	}

	task := &model.Task{
		ID:           taskID,
		Title:        req.Title,
		Description:  &req.Description,
		Date:         &startDate,
		Deadline:     &deadlineDate,
		Notes:        &req.Notes,
		ScoringItems: req.ScoringItems,
		Status:       &status,
		CreatedByID:  &createdByID,
		CreatedAt:    time.Now(),
	}

	// 注意：不再预创建 Inspection 记录，与 Node.js 保持一致
	// Inspection 记录只在用户实际提交分数时才创建（通过 SubmitTaskInspection）

	// 准备执行人与宿舍的具体分配关联 (taskexecutordorm)
	var executorDorms []model.TaskExecutorDorm
	if len(req.DormIds) > 0 && len(req.Executors) > 0 {
		for _, executorId := range req.Executors {
			for _, dormId := range req.DormIds {
				executorDorms = append(executorDorms, model.TaskExecutorDorm{
					ID:         uuid.New().String(),
					TaskID:     taskID,
					ExecutorID: executorId,
					DormID:     dormId,
				})
			}
		}
	}

	// 调用 Repository 执行事务创建（不再传入 inspections）
	if err := s.taskRepo.CreateTaskWithRelations(task, nil, executorDorms); err != nil {
		return nil, err
	}

	// 4. 设置任务宿舍和执行人关联 (用于多对多展示)
	if len(req.DormIds) > 0 {
		s.taskRepo.SetTaskDorms(taskID, req.DormIds)
	}

	if len(req.Executors) > 0 {
		s.taskRepo.SetTaskExecutors(taskID, req.Executors)
	}

	// 5. 返回更新后的任务 (使用较轻量的方法)
	return s.taskRepo.FindWithDormIDsByID(taskID)
}

func (s *taskService) GetTasks(page, pageSize int) ([]model.Task, int64, error) {
	tasks, total, err := s.taskRepo.FindAll(page, pageSize)
	if err != nil || len(tasks) == 0 {
		return tasks, total, err
	}

	// 批量统计任务的检查完成数
	taskIDs := make([]string, 0, len(tasks))
	for i := range tasks {
		taskIDs = append(taskIDs, tasks[i].ID)
	}

	type countResult struct {
		TaskID string `gorm:"column:taskId"`
		Count  int    `gorm:"column:count"`
	}
	var counts []countResult
	s.db.Model(&model.Inspection{}).
		Select("taskId, count(*) as count").
		Where("taskId IN ?", taskIDs).
		Group("taskId").
		Scan(&counts)

	countMap := make(map[string]int)
	for _, c := range counts {
		if c.TaskID != "" {
			countMap[c.TaskID] = c.Count
		}
	}

	for i := range tasks {
		tasks[i].InspectedCount = countMap[tasks[i].ID]
	}

	return tasks, total, nil
}

func (s *taskService) GetTaskByID(id string) (*model.Task, error) {
	return s.taskRepo.FindByID(id)
}

func (s *taskService) GetTaskWithDormIDsByID(id string) (*model.Task, error) {
	return s.taskRepo.FindWithDormIDsByID(id)
}

func (s *taskService) DeleteTask(id string) error {
	return s.taskRepo.Delete(id)
}

// UpdateTaskRequest 更新任务请求
type UpdateTaskRequest struct {
	Title        *string         `json:"title"`
	Description  *string         `json:"description"`
	Date         *string         `json:"date"`
	Deadline     *string         `json:"deadline"`
	TimeSlot     *string         `json:"timeSlot"`
	Status       *string         `json:"status"`
	RoleRequired *string         `json:"roleRequired"`
	Notes        *string         `json:"notes"`
	ScoringItems *datatypes.JSON `json:"scoringItems"`
	DormIds      []string        `json:"dormIds"`
	ExecutorIds  []string        `json:"executors"`
}

func (s *taskService) UpdateTask(id string, req UpdateTaskRequest) (*model.Task, error) {
	// 1. 查找任务 (使用较基础的方法，避免深层 Preload 导致的占位符过多错误)
	task, err := s.taskRepo.FindWithDormIDsByID(id)
	if err != nil {
		return nil, errors.New("任务不存在")
	}

	// 2. 更新基本字段
	if req.Title != nil {
		task.Title = *req.Title
	}
	if req.Date != nil {
		if *req.Date != "" {
			// 尝试多种格式解析日期
			formats := []string{time.RFC3339, "2006-01-02T15:04:05.000Z", "2006-01-02 15:04:05"}
			var parsed time.Time
			var parseErr error
			for _, f := range formats {
				parsed, parseErr = time.Parse(f, *req.Date)
				if parseErr == nil {
					break
				}
			}
			if parseErr == nil {
				task.Date = &parsed
			}
		} else {
			task.Date = nil
		}
	}
	if req.Deadline != nil {
		if *req.Deadline != "" {
			formats := []string{time.RFC3339, "2006-01-02T15:04:05.000Z", "2006-01-02 15:04:05"}
			var parsed time.Time
			var parseErr error
			for _, f := range formats {
				parsed, parseErr = time.Parse(f, *req.Deadline)
				if parseErr == nil {
					break
				}
			}
			if parseErr == nil {
				task.Deadline = &parsed
			}
		} else {
			task.Deadline = nil
		}
	}
	if req.Notes != nil {
		task.Notes = req.Notes
	}
	if req.Description != nil {
		task.Description = req.Description
	}
	if req.TimeSlot != nil {
		task.TimeSlot = req.TimeSlot
	}
	if req.RoleRequired != nil {
		task.RoleRequired = req.RoleRequired
	}
	if req.ScoringItems != nil {
		task.ScoringItems = *req.ScoringItems
	}

	if req.Status != nil && *req.Status != "" {
		task.Status = req.Status
	} else {
		now := time.Now()
		status := "ONGOING"
		if task.Date != nil && now.Before(*task.Date) {
			status = "NOT_STARTED"
		} else if task.Deadline != nil && now.After(*task.Deadline) {
			status = "FINISHED"
		}
		task.Status = &status
	}

	// 3. 使用 Repository 更新
	if err := s.taskRepo.Update(task); err != nil {
		return nil, err
	}

	// 4. 更新关联的宿舍和执行人（如果提供了）
	if len(req.DormIds) > 0 {
		if err := s.taskRepo.SetTaskDorms(id, req.DormIds); err != nil {
			return nil, err
		}
		// 同步 Inspection 记录
		s.syncTaskInspections(id, req.DormIds)
	}
	if len(req.ExecutorIds) > 0 {
		if err := s.taskRepo.SetTaskExecutors(id, req.ExecutorIds); err != nil {
			return nil, err
		}
	}

	// 4.5 同步更新 taskexecutordorm (如果宿舍或执行人发生了变化)
	if len(req.DormIds) > 0 || len(req.ExecutorIds) > 0 {
		// 使用 updatedTask 此时的状态（已包含最新的关联表 IDs）
		updatedTask, _ := s.taskRepo.FindWithDormIDsByID(id)
		if updatedTask != nil {
			// 先删除旧的
			s.db.Where("taskId = ?", id).Delete(&model.TaskExecutorDorm{})

			// 准备列表
			var dormIds []string
			var executorIds []string
			for _, d := range updatedTask.Dorms {
				dormIds = append(dormIds, d.DormID)
			}
			for _, e := range updatedTask.Executors {
				executorIds = append(executorIds, e.ExecutorID)
			}

			if len(dormIds) > 0 && len(executorIds) > 0 {
				var executorDorms []model.TaskExecutorDorm
				for _, eid := range executorIds {
					for _, did := range dormIds {
						executorDorms = append(executorDorms, model.TaskExecutorDorm{
							ID:         uuid.New().String(),
							TaskID:     id,
							ExecutorID: eid,
							DormID:     did,
						})
					}
				}
				if len(executorDorms) > 0 {
					s.db.CreateInBatches(executorDorms, 100)
				}
			}
		}
	}

	// 5. 返回更新后的任务 (使用较基础的方法，避免后续返回时再次触发占位符错误)
	return s.taskRepo.FindWithDormIDsByID(id)
}

func (s *taskService) syncTaskInspections(taskId string, dormIds []string) {
	// 注意：不再预创建空的 Inspection 记录，与 Node.js 保持一致
	// Inspection 记录只在用户实际提交分数时才创建（通过 SubmitTaskInspection）
	// 此方法保留用于未来可能的兼容性需求，但当前不执行任何操作
}

func (s *taskService) GetMyAssignedDorms(taskId string, executorId string, building, floor, campus, search string) ([]model.Dormitory, error) {
	return s.taskRepo.FindMyAssignedDorms(taskId, executorId, building, floor, campus, search)
}

func (s *taskService) SubmitTaskInspection(taskId string, dormId string, reviewerID string, score int, comments string, photos []string, detail interface{}) error {
	// 查找是否已有记录
	var inspection model.Inspection
	err := s.db.Where("taskId = ? AND dormId = ?", taskId, dormId).First(&inspection).Error

	photoBytes, _ := json.Marshal(photos)
	detailBytes, _ := json.Marshal(detail)

	if errors.Is(err, gorm.ErrRecordNotFound) {
		// 创建新记录
		inspection = model.Inspection{
			ID:           uuid.New().String(),
			TaskID:       &taskId,
			DormID:       &dormId,
			TotalScore:   &score,
			Comments:     &comments,
			Photos:       photoBytes,
			Detail:       detailBytes,
			ReviewedByID: &reviewerID,
			CreatedAt:    time.Now(),
		}
		return s.db.Create(&inspection).Error
	}
	if err != nil {
		return err
	}

	// 更新旧记录
	inspection.TotalScore = &score
	inspection.Comments = &comments
	inspection.Photos = photoBytes
	inspection.Detail = detailBytes
	inspection.ReviewedByID = &reviewerID
	return repository.UpdateInspectionResult(s.db, &inspection)
}
