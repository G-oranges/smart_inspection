package repository

import (
	"time"

	"github.com/my-project/backend-go/internal/model"
	"github.com/my-project/backend-go/pkg/utils"
	"gorm.io/gorm"
)

type AppealQuery struct {
	Page, PageSize                                 int
	Status, Keyword, TaskID, BuildingID, StudentID string
	StartAt, EndAt                                 *time.Time
	SortBy, SortOrder                              string
	Scope                                          func(*gorm.DB) *gorm.DB
}

type AppealStatusCount struct {
	Status        string
	Count         int64
	Handled       int64
	HandleSeconds float64
}

type AppealRepository struct {
	db *gorm.DB
}

func NewAppealRepository(db *gorm.DB) *AppealRepository {
	return &AppealRepository{db: db}
}

func (r *AppealRepository) query(q AppealQuery) *gorm.DB {
	db := r.db.Model(&model.Appeal{}).
		Joins("LEFT JOIN student ON student.id = appeal.studentId").
		Joins("LEFT JOIN inspection ON inspection.id = appeal.inspectionId").
		Joins("LEFT JOIN dormitory ON dormitory.id = inspection.dormId")
	if q.Scope != nil {
		db = db.Scopes(q.Scope)
	}
	if q.StudentID != "" {
		db = db.Where("appeal.studentId = ?", q.StudentID)
	}
	if q.Status != "" {
		db = db.Where("appeal.status = ?", q.Status)
	}
	if q.Keyword != "" {
		keyword := "%" + q.Keyword + "%"
		db = db.Where("(student.fullName LIKE ? OR student.studentNo LIKE ? OR dormitory.roomNo LIKE ?)", keyword, keyword, keyword)
	}
	if q.TaskID != "" {
		db = db.Where("inspection.taskId = ?", q.TaskID)
	}
	if q.BuildingID != "" {
		db = db.Where("dormitory.buildingId = ?", q.BuildingID)
	}
	if q.StartAt != nil {
		db = db.Where("appeal.createdAt >= ?", *q.StartAt)
	}
	if q.EndAt != nil {
		db = db.Where("appeal.createdAt <= ?", *q.EndAt)
	}
	return db
}

func preloadAppeal(db *gorm.DB) *gorm.DB {
	return db.Preload("Student", func(db *gorm.DB) *gorm.DB {
		return db.Select("id", "fullName", "studentNo", "college", "major", "className")
	}).
		Preload("Inspection.Task").
		Preload("Inspection.Dorm.BuildingRef").
		Preload("HandledBy", func(db *gorm.DB) *gorm.DB {
			return db.Select("id", "fullName", "username")
		})
}

func (r *AppealRepository) FindPage(q AppealQuery) ([]model.Appeal, int64, error) {
	appeals := []model.Appeal{}
	var total int64
	if err := r.query(q).Count(&total).Error; err != nil || total == 0 {
		return appeals, total, err
	}
	sort := utils.ValidateSortParams(q.SortBy, q.SortOrder, utils.SortConfig{
		ValidFields: map[string]string{
			"createdAt": "appeal.createdAt", "updatedAt": "appeal.updatedAt",
			"handledAt": "appeal.handledAt", "status": "appeal.status",
			"studentName": "student.fullName", "scoreDelta": "appeal.scoreDelta",
		},
		DefaultField: "createdAt", DefaultOrder: "DESC",
	})
	err := preloadAppeal(r.query(q)).Select("appeal.*").
		Order(sort).Order("appeal.id DESC").Scopes(Paginate(q.Page, q.PageSize)).Find(&appeals).Error
	for i := range appeals {
		MarkAppealInspectionChanged(&appeals[i])
	}
	return appeals, total, err
}

func (r *AppealRepository) CountByStatus(q AppealQuery) ([]AppealStatusCount, error) {
	q.Status = ""
	seconds := "TIMESTAMPDIFF(MICROSECOND, appeal.createdAt, appeal.handledAt) / 1000000.0"
	if r.db.Dialector.Name() == "sqlite" {
		seconds = "(julianday(appeal.handledAt) - julianday(appeal.createdAt)) * 86400"
	}
	var counts []AppealStatusCount
	err := r.query(q).Select("appeal.status, COUNT(*) AS count, COUNT(appeal.handledAt) AS handled, COALESCE(SUM(" + seconds + "), 0) AS handle_seconds").
		Group("appeal.status").Scan(&counts).Error
	return counts, err
}

func (r *AppealRepository) ExistsPending(inspectionID, studentID string) (bool, error) {
	var count int64
	err := r.db.Model(&model.Appeal{}).Where("inspectionId = ? AND studentId = ? AND status = ?", inspectionID, studentID, model.AppealPending).Count(&count).Error
	return count != 0, err
}

func (r *AppealRepository) InScope(id string, scope func(*gorm.DB) *gorm.DB) (bool, error) {
	var count int64
	err := r.query(AppealQuery{Scope: scope}).Where("appeal.id = ?", id).Count(&count).Error
	return count != 0, err
}

func (r *AppealRepository) InspectionVersions(ids []string) (map[string]time.Time, error) {
	var rows []struct {
		ID      string
		Version time.Time
	}
	err := r.db.Model(&model.Appeal{}).Select("appeal.id, inspection.updatedAt AS version").
		Joins("JOIN inspection ON inspection.id = appeal.inspectionId").
		Where("appeal.id IN ?", ids).Scan(&rows).Error
	versions := make(map[string]time.Time, len(rows))
	for _, row := range rows {
		versions[row.ID] = row.Version
	}
	return versions, err
}

func (r *AppealRepository) GetDetail(id string) (*model.Appeal, error) {
	var appeal model.Appeal
	if err := preloadAppeal(r.db).First(&appeal, "id = ?", id).Error; err != nil {
		return nil, err
	}
	MarkAppealInspectionChanged(&appeal)
	return &appeal, nil
}

func MarkAppealInspectionChanged(appeal *model.Appeal) {
	appeal.InspectionChanged = appeal.Status == model.AppealPending && AppealInspectionChanged(appeal, appeal.Inspection.UpdatedAt)
}

func AppealInspectionChanged(appeal *model.Appeal, currentVersion time.Time) bool {
	return currentVersion.After(appeal.CreatedAt) ||
		(appeal.OriginalInspectionVersion != nil && !currentVersion.Equal(*appeal.OriginalInspectionVersion))
}
