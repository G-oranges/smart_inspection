package repository

import (
	"github.com/my-project/backend-go/internal/model"
	"gorm.io/gorm"
)

type AppealRepository interface {
	Create(appeal *model.Appeal) error
	FindAll(page, pageSize int, status string) ([]model.Appeal, int64, error)
	GetByID(id string) (*model.Appeal, error)
	Update(appeal *model.Appeal) error
	UpdateWithTransaction(appeal *model.Appeal, updateInspection func(tx *gorm.DB) error) error
	FindByStudentID(page, pageSize int, studentID string) ([]model.Appeal, int64, error)
}

type appealRepository struct {
	db *gorm.DB
}

func NewAppealRepository(db *gorm.DB) AppealRepository {
	return &appealRepository{db: db}
}

func (r *appealRepository) Create(appeal *model.Appeal) error {
	return r.db.Create(appeal).Error
}

func (r *appealRepository) FindAll(page, pageSize int, status string) ([]model.Appeal, int64, error) {
	var appeals []model.Appeal
	var total int64

	query := r.db.Model(&model.Appeal{}).
		Preload("Student").
		Preload("Inspection").
		Preload("Inspection.Dorm").
		Preload("Inspection.Dorm.BuildingRef")
	if status != "" {
		query = query.Where("status = ?", status)
	}

	query.Count(&total)
	err := query.Scopes(Paginate(page, pageSize)).Order("createdAt DESC").Find(&appeals).Error
	return appeals, total, err
}

func (r *appealRepository) GetByID(id string) (*model.Appeal, error) {
	var appeal model.Appeal
	if err := r.db.Preload("Inspection").Preload("Inspection.Dorm").First(&appeal, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &appeal, nil
}

func (r *appealRepository) Update(appeal *model.Appeal) error {
	return r.db.Save(appeal).Error
}

func (r *appealRepository) UpdateWithTransaction(appeal *model.Appeal, updateInspection func(tx *gorm.DB) error) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Save(appeal).Error; err != nil {
			return err
		}
		if updateInspection != nil {
			if err := updateInspection(tx); err != nil {
				return err
			}
		}
		return nil
	})
}

func (r *appealRepository) FindByStudentID(page, pageSize int, studentID string) ([]model.Appeal, int64, error) {
	var appeals []model.Appeal
	var total int64

	query := r.db.Model(&model.Appeal{}).
		Where("studentId = ?", studentID).
		Preload("Inspection").
		Preload("Inspection.Dorm")
	query.Count(&total)

	err := query.Scopes(Paginate(page, pageSize)).Order("createdAt DESC").Find(&appeals).Error
	return appeals, total, err
}
