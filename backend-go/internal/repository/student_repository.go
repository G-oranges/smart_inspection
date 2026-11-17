package repository

import (
	"github.com/my-project/backend-go/internal/model"
	"gorm.io/gorm"
)

type StudentRepository interface {
	FindByID(id string) (*model.Student, error)
	FindByStudentNo(studentNo string) (*model.Student, error)
	Create(student *model.Student) error
	Update(id string, student *model.Student) error
	Delete(ids []string) error
	FindWithDorm(ids []string) ([]model.Student, error)
	FindMonitorsByDormIds(dormIds []string) ([]model.Student, error)
	UpdateMonitorStatus(ids []string, isMonitor bool) error
}

type studentRepository struct {
	db *gorm.DB
}

func NewStudentRepository(db *gorm.DB) StudentRepository {
	return &studentRepository{db: db}
}

func (r *studentRepository) FindByID(id string) (*model.Student, error) {
	var student model.Student
	if err := r.db.First(&student, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &student, nil
}

func (r *studentRepository) FindByStudentNo(studentNo string) (*model.Student, error) {
	var student model.Student
	if err := r.db.First(&student, "studentNo = ?", studentNo).Error; err != nil {
		return nil, err
	}
	return &student, nil
}

func (r *studentRepository) Create(student *model.Student) error {
	return r.db.Create(student).Error
}

func (r *studentRepository) Update(id string, student *model.Student) error {
	return r.db.Model(&model.Student{}).Where("id = ?", id).Updates(student).Error
}

func (r *studentRepository) Delete(ids []string) error {
	return r.db.Delete(&model.Student{}, "id IN ?", ids).Error
}

func (r *studentRepository) FindWithDorm(ids []string) ([]model.Student, error) {
	var students []model.Student
	err := r.db.Where("id IN ?", ids).Find(&students).Error
	return students, err
}

func (r *studentRepository) FindMonitorsByDormIds(dormIds []string) ([]model.Student, error) {
	var students []model.Student
	err := r.db.Where("dormId IN ? AND isMonitor = ?", dormIds, true).Find(&students).Error
	return students, err
}

func (r *studentRepository) UpdateMonitorStatus(ids []string, isMonitor bool) error {
	if len(ids) == 0 {
		return nil
	}
	return r.db.Model(&model.Student{}).Where("id IN ?", ids).Update("isMonitor", isMonitor).Error
}
