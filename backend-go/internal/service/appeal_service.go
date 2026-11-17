package service

import (
	"time"

	"github.com/google/uuid"
	"github.com/my-project/backend-go/internal/model"
	"github.com/my-project/backend-go/internal/repository"
	"gorm.io/gorm"
)

type AppealService interface {
	SubmitAppeal(inspectionID, studentID, content string) (*model.Appeal, error)
	GetAppeals(page, pageSize int, status string) ([]model.Appeal, int64, error)
	ProcessAppeal(id string, status string, reply string) error
	GetMyAppeals(page, pageSize int, studentID string) ([]model.Appeal, int64, error)
}

type appealService struct {
	repo repository.AppealRepository
}

func NewAppealService(repo repository.AppealRepository) AppealService {
	return &appealService{repo: repo}
}

func (s *appealService) SubmitAppeal(inspectionID, studentID, content string) (*model.Appeal, error) {
	appeal := &model.Appeal{
		ID:           uuid.New().String(),
		InspectionID: inspectionID,
		StudentID:    studentID,
		Content:      content,
		Status:       "pending",
		CreatedAt:    time.Now(),
	}
	if err := s.repo.Create(appeal); err != nil {
		return nil, err
	}
	return appeal, nil
}

func (s *appealService) GetAppeals(page, pageSize int, status string) ([]model.Appeal, int64, error) {
	return s.repo.FindAll(page, pageSize, status)
}

func (s *appealService) ProcessAppeal(id string, status string, reply string) error {
	appeal, err := s.repo.GetByID(id)
	if err != nil {
		return err
	}

	appeal.Status = status
	appeal.Reply = &reply
	appeal.UpdatedAt = time.Now()

	// 如果审批通过，关联逻辑（可选：这里简单处理，实际业务可能需要联动修改 Inspection）
	if status == "approved" {
		return s.repo.UpdateWithTransaction(appeal, func(tx *gorm.DB) error {
			// 联动更新 Inspection 状态或分数的逻辑可以在这里实现
			// 例如：tx.Model(&model.Inspection{}).Where("id = ?", appeal.InspectionID).Update("comments", "申诉已通过并修正")
			return nil
		})
	}

	return s.repo.Update(appeal)
}

func (s *appealService) GetMyAppeals(page, pageSize int, studentID string) ([]model.Appeal, int64, error) {
	return s.repo.FindByStudentID(page, pageSize, studentID)
}
