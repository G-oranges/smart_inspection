package repository

import (
	"github.com/my-project/backend-go/internal/model"
	"gorm.io/gorm"
)

type TeacherRepository interface {
	FindByID(id string) (*model.Teacher, error)
	Create(teacher *model.Teacher) error
	Update(id string, teacher *model.Teacher) error
	Delete(ids []string) error
	FindAll(page, pageSize int, search string, departments []string) ([]model.Teacher, int64, error)
}

type teacherRepository struct {
	db *gorm.DB
}

func NewTeacherRepository(db *gorm.DB) TeacherRepository {
	return &teacherRepository{db: db}
}

func (r *teacherRepository) FindByID(id string) (*model.Teacher, error) {
	var teacher model.Teacher
	if err := r.db.First(&teacher, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &teacher, nil
}

func (r *teacherRepository) Create(teacher *model.Teacher) error {
	return r.db.Create(teacher).Error
}

func (r *teacherRepository) Update(id string, teacher *model.Teacher) error {
	return r.db.Model(&model.Teacher{}).Where("id = ?", id).Updates(teacher).Error
}

func (r *teacherRepository) Delete(ids []string) error {
	return r.db.Delete(&model.Teacher{}, "id IN ?", ids).Error
}

func (r *teacherRepository) FindAll(page, pageSize int, search string, departments []string) ([]model.Teacher, int64, error) {
	var teachers []model.Teacher
	var total int64

	query := r.db.Model(&model.Teacher{})

	if search != "" {
		p := "%" + search + "%"
		query = query.Where("fullName LIKE ? OR employeeNo LIKE ?", p, p)
	}

	if len(departments) > 0 {
		query = query.Where("department IN ?", departments)
	}

	query.Count(&total)

	err := query.Scopes(Paginate(page, pageSize)).Order("employeeNo ASC").Find(&teachers).Error
	return teachers, total, err
}
