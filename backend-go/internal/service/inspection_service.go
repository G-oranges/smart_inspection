package service

import (
	"github.com/my-project/backend-go/internal/model"
	"github.com/my-project/backend-go/internal/repository"
	"gorm.io/datatypes"
)

type UpdateInspectionRequest struct {
	TotalScore *int           `json:"totalScore"`
	Comments   *string        `json:"comments"`
	Photos     datatypes.JSON `json:"photos"`
	PhotoUrls  datatypes.JSON `json:"photoUrls"` // 兼容前端字段名
	Detail     datatypes.JSON `json:"detail"`
}

type InspectionService interface {
	GetInspections(page, pageSize int, taskId *string, dormId *string) ([]model.Inspection, int64, error)
	GetInspection(id string) (*model.Inspection, error)
	SubmitResult(id string, req UpdateInspectionRequest, reviewerID string) (*model.Inspection, error)
	GetMyInspections(page, pageSize int, reviewerID string) ([]model.Inspection, int64, error)
	ExportResults(taskId *string) ([]model.Inspection, error)
}

type inspectionService struct {
	repo repository.InspectionRepository
}

func NewInspectionService(repo repository.InspectionRepository) InspectionService {
	return &inspectionService{repo: repo}
}

func (s *inspectionService) GetInspections(page, pageSize int, taskId *string, dormId *string) ([]model.Inspection, int64, error) {
	return s.repo.FindAll(page, pageSize, taskId, dormId)
}

func (s *inspectionService) GetInspection(id string) (*model.Inspection, error) {
	return s.repo.GetByID(id)
}

func (s *inspectionService) SubmitResult(id string, req UpdateInspectionRequest, reviewerID string) (*model.Inspection, error) {
	inspection, err := s.repo.GetByID(id)
	if err != nil {
		return nil, err
	}

	inspection.TotalScore = req.TotalScore
	inspection.Comments = req.Comments

	// 优先使用 photos，如果没有则使用 photoUrls (前端兼容)
	if len(req.Photos) > 2 { // datatypes.JSON 空值通常是 [] 或 null，长度 > 2 表示有内容
		inspection.Photos = req.Photos
	} else if req.PhotoUrls != nil {
		inspection.Photos = req.PhotoUrls
	}

	inspection.Detail = req.Detail
	inspection.ReviewedByID = &reviewerID

	if err := s.repo.Update(inspection); err != nil {
		return nil, err
	}

	// 返回更新后的完整对象（重新查询以获取关联数据）
	return s.repo.GetByID(id)
}

func (s *inspectionService) GetMyInspections(page, pageSize int, reviewerID string) ([]model.Inspection, int64, error) {
	return s.repo.FindByReviewerID(page, pageSize, reviewerID)
}

func (s *inspectionService) ExportResults(taskId *string) ([]model.Inspection, error) {
	// 导出逻辑：不分页，获取指定任务下的所有已完成检查
	inspections, _, err := s.repo.FindAll(1, 10000, taskId, nil)
	return inspections, err
}
