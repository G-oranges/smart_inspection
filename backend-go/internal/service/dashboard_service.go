package service

import (
	"time"

	"github.com/my-project/backend-go/internal/model"
	"gorm.io/gorm"
)

type DashboardStats struct {
	TotalStudents     int64              `json:"totalStudents"`
	TotalDorms        int64              `json:"totalDorms"`
	TotalBeds         int64              `json:"totalBeds"`
	OccupiedBeds      int64              `json:"occupiedBeds"`
	ActiveTasks       int64              `json:"activeTasks"`
	PendingAppeals    int64              `json:"pendingAppeals"`
	AverageScore      float64            `json:"averageScore"`
	TrendData         []TrendPoint       `json:"trendData"`
	Distribution      []DistPoint        `json:"distribution"`
	RecentInspections []model.Inspection `json:"recentInspections"`
}

type TrendPoint struct {
	Label string  `json:"label"`
	Score float64 `json:"score"`
}

type DistPoint struct {
	Name  string `json:"name"`
	Value int64  `json:"value"`
}

type DashboardService interface {
	GetSummary(userID string) (*DashboardStats, error)
	InvalidateCache() // 用于强制刷新缓存
}

type dashboardService struct {
	db *gorm.DB
}

func NewDashboardService(db *gorm.DB) DashboardService {
	return &dashboardService{db: db}
}

// InvalidateCache 使缓存失效（可在数据变更时调用）
func (s *dashboardService) InvalidateCache() {
}

func (s *dashboardService) GetSummary(userID string) (*DashboardStats, error) {
	scope, err := ResolveUserDataScopeByUserID(s.db, userID)
	if err != nil {
		return nil, err
	}

	stats := &DashboardStats{}
	now := time.Now()
	currentMonthStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())

	if scope.All || scope.HasAcademicAccess() {
		if err := ApplyAcademicScopeToStudentQuery(s.db.Model(&model.Student{}), scope).Count(&stats.TotalStudents).Error; err != nil {
			return nil, err
		}
	}

	dormQuery := ApplyDormitoryScopeToDormQuery(s.db.Model(&model.Dormitory{}), scope)
	dormVisible := scope.All || scope.HasDormitoryAccess()

	if dormVisible {
		if err := dormQuery.Count(&stats.TotalDorms).Error; err != nil {
			return nil, err
		}
		if err := dormQuery.Select("COALESCE(SUM(capacity), 0)").Scan(&stats.TotalBeds).Error; err != nil {
			return nil, err
		}

		visibleDormIDs := ApplyDormitoryScopeToDormQuery(s.db.Model(&model.Dormitory{}), scope).Select("id")
		if err := s.db.Model(&model.DormBed{}).
			Where("dormId IN (?)", visibleDormIDs).
			Where("studentId IS NOT NULL AND studentId != ''").
			Count(&stats.OccupiedBeds).Error; err != nil {
			return nil, err
		}
		if err := s.db.Model(&model.Task{}).
			Joins("JOIN taskdorm ON taskdorm.taskId = task.id").
			Where("taskdorm.dormId IN (?)", visibleDormIDs).
			Where("date <= ? AND deadline >= ?", now, now).
			Distinct("task.id").
			Count(&stats.ActiveTasks).Error; err != nil {
			return nil, err
		}

		if err := s.db.Model(&model.Inspection{}).
			Where("dormId IN (?)", visibleDormIDs).
			Where("createdAt >= ?", currentMonthStart).
			Select("COALESCE(AVG(totalScore), 0)").Scan(&stats.AverageScore).Error; err != nil {
			return nil, err
		}

		var dists []struct {
			Range string
			Count int64
		}
		if err := s.db.Model(&model.Inspection{}).
			Where("dormId IN (?)", visibleDormIDs).
			Where("createdAt >= ?", currentMonthStart).
			Select("CASE WHEN totalScore >= 90 THEN '优秀' WHEN totalScore >= 80 THEN '良好' WHEN totalScore >= 60 THEN '及格' ELSE '不及格' END as `range`, COUNT(*) as count").
			Group("`range`").Scan(&dists).Error; err != nil {
			return nil, err
		}
		stats.Distribution = make([]DistPoint, 0, len(dists))
		for _, d := range dists {
			stats.Distribution = append(stats.Distribution, DistPoint{Name: d.Range, Value: d.Count})
		}

		sixMonthsAgo := now.AddDate(0, -5, 0)
		sixMonthsAgoStart := time.Date(sixMonthsAgo.Year(), sixMonthsAgo.Month(), 1, 0, 0, 0, 0, now.Location())
		var trendResults []struct {
			Month string
			Avg   float64
		}
		if err := s.db.Model(&model.Inspection{}).
			Where("dormId IN (?)", visibleDormIDs).
			Where("createdAt >= ?", sixMonthsAgoStart).
			Select(monthBucketExpr(s.db) + " as month, AVG(totalScore) as avg").
			Group("month").
			Scan(&trendResults).Error; err != nil {
			return nil, err
		}
		trendMap := make(map[string]float64)
		for _, tr := range trendResults {
			trendMap[tr.Month] = tr.Avg
		}
		stats.TrendData = make([]TrendPoint, 0, 6)
		for i := 5; i >= 0; i-- {
			m := now.AddDate(0, -i, 0)
			monthKey := m.Format("2006-01")
			stats.TrendData = append(stats.TrendData, TrendPoint{
				Label: m.Format("1月"),
				Score: trendMap[monthKey],
			})
		}

		if err := s.db.Preload("Dorm").Preload("CreatedBy").
			Where("dormId IN (?)", visibleDormIDs).
			Order("createdAt DESC").
			Limit(10).
			Find(&stats.RecentInspections).Error; err != nil {
			return nil, err
		}
	} else {
		stats.Distribution = []DistPoint{}
		stats.TrendData = make([]TrendPoint, 0, 6)
		for i := 5; i >= 0; i-- {
			m := now.AddDate(0, -i, 0)
			stats.TrendData = append(stats.TrendData, TrendPoint{
				Label: m.Format("1月"),
				Score: 0,
			})
		}
		stats.RecentInspections = []model.Inspection{}
	}

	stats.PendingAppeals, err = s.countVisiblePendingAppeals(scope)
	if err != nil {
		return nil, err
	}

	return stats, nil
}

func (s *dashboardService) countVisiblePendingAppeals(scope *ResolvedUserDataScope) (int64, error) {
	if scope == nil || scope.All {
		var count int64
		err := s.db.Model(&model.Appeal{}).Where("status = ?", "pending").Count(&count).Error
		return count, err
	}

	var appeals []model.Appeal
	if err := s.db.Preload("Student").Preload("Inspection.Dorm").
		Where("status = ?", "pending").
		Find(&appeals).Error; err != nil {
		return 0, err
	}

	var count int64
	for _, appeal := range appeals {
		if scopeAllowsStudentForDashboard(scope, &appeal.Student) || scopeAllowsDormForDashboard(scope, appeal.Inspection.Dorm) {
			count++
		}
	}
	return count, nil
}

func scopeAllowsStudentForDashboard(scope *ResolvedUserDataScope, student *model.Student) bool {
	if scope == nil || scope.All {
		return true
	}
	if student == nil || !scope.HasAcademicAccess() {
		return false
	}

	college := ptrToStr(student.College)
	if college != "" {
		if _, ok := scope.Academic.Colleges[college]; ok {
			return true
		}
	}
	major := ptrToStr(student.Major)
	if major != "" {
		if _, ok := scope.Academic.Majors[major]; ok {
			return true
		}
	}
	className := ptrToStr(student.ClassName)
	if className != "" {
		if _, ok := scope.Academic.ClassNames[className]; ok {
			return true
		}
	}
	return false
}

func scopeAllowsDormForDashboard(scope *ResolvedUserDataScope, dorm *model.Dormitory) bool {
	if scope == nil || scope.All {
		return true
	}
	if dorm == nil || !scope.HasDormitoryAccess() {
		return false
	}
	if dorm.ID != "" && scope.AllowsDormID(dorm.ID) {
		return true
	}
	building := ptrToStr(dorm.Building)
	roomNo := ptrToStr(dorm.RoomNo)
	if building == "" {
		return false
	}
	if dorm.RoomNo != nil && roomNo != "" {
		floor := 0
		if dorm.Floor != nil {
			floor = *dorm.Floor
		}
		return scope.AllowsRoom(building, floor, roomNo)
	}
	if dorm.Floor != nil {
		return scope.AllowsFloor(building, *dorm.Floor)
	}
	return scope.AllowsBuilding(building)
}

func monthBucketExpr(db *gorm.DB) string {
	if db != nil && db.Dialector != nil && db.Dialector.Name() == "sqlite" {
		return "strftime('%Y-%m', createdAt)"
	}
	return "DATE_FORMAT(createdAt, '%Y-%m')"
}
