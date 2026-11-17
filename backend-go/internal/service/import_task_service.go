package service

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/my-project/backend-go/pkg/utils"
)

// ImportTaskStatus 导入任务状态常量
const (
	ImportStatusPending   = "pending"   // 等待执行
	ImportStatusRunning   = "running"   // 执行中
	ImportStatusCompleted = "completed" // 已完成
	ImportStatusFailed    = "failed"    // 失败
)

// ImportTaskProgress 导入任务进度结构
type ImportTaskProgress struct {
	JobID       string      `json:"jobId"`
	Status      string      `json:"status"`      // pending / running / completed / failed
	Total       int         `json:"total"`       // 总行数
	Processed   int         `json:"processed"`   // 已处理行数
	Progress    int         `json:"progress"`    // 进度百分比 (0-100)
	StartedAt   *time.Time  `json:"startedAt"`   // 开始时间
	CompletedAt *time.Time  `json:"completedAt"` // 完成时间
	Result      interface{} `json:"result"`      // 最终结果（完成后填充）
	Error       string      `json:"error"`       // 错误信息（失败时填充）
}

// ImportTaskService 导入任务服务接口
type ImportTaskService interface {
	// CreateTask 创建新的导入任务，返回 jobId
	CreateTask(total int) (string, error)
	// UpdateProgress 更新任务进度
	UpdateProgress(jobId string, processed int) error
	// CompleteTask 标记任务完成
	CompleteTask(jobId string, result interface{}) error
	// FailTask 标记任务失败
	FailTask(jobId string, err error) error
	// GetProgress 获取任务进度
	GetProgress(jobId string) (*ImportTaskProgress, error)
}

// importTaskService 导入任务服务实现
type importTaskService struct {
	keyPrefix string        // Redis key 前缀
	ttl       time.Duration // 任务状态过期时间
}

// NewImportTaskService 创建导入任务服务
func NewImportTaskService() ImportTaskService {
	return &importTaskService{
		keyPrefix: "import_task:",
		ttl:       30 * time.Minute, // 任务状态保留 30 分钟
	}
}

// getRedisKey 获取 Redis 键名
func (s *importTaskService) getRedisKey(jobId string) string {
	return s.keyPrefix + jobId
}

// CreateTask 创建新的导入任务
func (s *importTaskService) CreateTask(total int) (string, error) {
	if !utils.IsRedisAvailable() {
		return "", fmt.Errorf("Redis 不可用，无法创建导入任务")
	}

	jobId := uuid.New().String()
	now := time.Now()

	progress := ImportTaskProgress{
		JobID:     jobId,
		Status:    ImportStatusPending,
		Total:     total,
		Processed: 0,
		Progress:  0,
		StartedAt: &now,
	}

	data, err := json.Marshal(progress)
	if err != nil {
		return "", fmt.Errorf("序列化任务状态失败: %v", err)
	}

	if err := utils.SetCache(s.getRedisKey(jobId), string(data), s.ttl); err != nil {
		return "", fmt.Errorf("保存任务状态到 Redis 失败: %v", err)
	}

	return jobId, nil
}

// UpdateProgress 更新任务进度
func (s *importTaskService) UpdateProgress(jobId string, processed int) error {
	if !utils.IsRedisAvailable() {
		return nil // Redis 不可用时静默忽略
	}

	progress, err := s.GetProgress(jobId)
	if err != nil {
		return err
	}

	progress.Status = ImportStatusRunning
	progress.Processed = processed
	if progress.Total > 0 {
		progress.Progress = processed * 100 / progress.Total
		if progress.Progress > 100 {
			progress.Progress = 100
		}
	}

	data, err := json.Marshal(progress)
	if err != nil {
		return err
	}

	return utils.SetCache(s.getRedisKey(jobId), string(data), s.ttl)
}

// CompleteTask 标记任务完成
func (s *importTaskService) CompleteTask(jobId string, result interface{}) error {
	if !utils.IsRedisAvailable() {
		return nil
	}

	progress, err := s.GetProgress(jobId)
	if err != nil {
		return err
	}

	now := time.Now()
	progress.Status = ImportStatusCompleted
	progress.Processed = progress.Total
	progress.Progress = 100
	progress.CompletedAt = &now
	progress.Result = result

	data, err := json.Marshal(progress)
	if err != nil {
		return err
	}

	return utils.SetCache(s.getRedisKey(jobId), string(data), s.ttl)
}

// FailTask 标记任务失败
func (s *importTaskService) FailTask(jobId string, taskErr error) error {
	if !utils.IsRedisAvailable() {
		return nil
	}

	progress, err := s.GetProgress(jobId)
	if err != nil {
		return err
	}

	now := time.Now()
	progress.Status = ImportStatusFailed
	progress.CompletedAt = &now
	if taskErr != nil {
		progress.Error = taskErr.Error()
	}

	data, err := json.Marshal(progress)
	if err != nil {
		return err
	}

	return utils.SetCache(s.getRedisKey(jobId), string(data), s.ttl)
}

// GetProgress 获取任务进度
func (s *importTaskService) GetProgress(jobId string) (*ImportTaskProgress, error) {
	if !utils.IsRedisAvailable() {
		return nil, fmt.Errorf("Redis 不可用")
	}

	data, err := utils.GetCache(s.getRedisKey(jobId))
	if err != nil {
		return nil, fmt.Errorf("任务不存在或已过期")
	}

	var progress ImportTaskProgress
	if err := json.Unmarshal([]byte(data), &progress); err != nil {
		return nil, fmt.Errorf("解析任务状态失败: %v", err)
	}

	return &progress, nil
}

// 全局单例（可选，也可通过依赖注入）
var globalImportTaskService ImportTaskService

// GetImportTaskService 获取全局导入任务服务实例
func GetImportTaskService() ImportTaskService {
	if globalImportTaskService == nil {
		globalImportTaskService = NewImportTaskService()
	}
	return globalImportTaskService
}

// ImportTaskContext 用于在 goroutine 中传递上下文
type ImportTaskContext struct {
	JobID   string
	Service ImportTaskService
	Ctx     context.Context
}

// NewImportTaskContext 创建导入任务上下文
func NewImportTaskContext(jobId string) *ImportTaskContext {
	return &ImportTaskContext{
		JobID:   jobId,
		Service: GetImportTaskService(),
		Ctx:     context.Background(),
	}
}
