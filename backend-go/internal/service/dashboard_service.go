package service

import (
	"fmt"
	"math"
	"sort"
	"strings"
	"time"

	"github.com/my-project/backend-go/internal/model"
	"github.com/my-project/backend-go/internal/repository"
	"gorm.io/gorm"
)

type DashboardActiveTask struct {
	ID             string     `json:"id"`
	Title          string     `json:"title"`
	Deadline       *time.Time `json:"deadline"`
	TotalDorms     int64      `json:"totalDorms"`
	CompletedDorms int64      `json:"completedDorms"`
	MyTotalDorms   int64      `json:"myTotalDorms"`
	MyPendingDorms int64      `json:"myPendingDorms"`
}

type DashboardLowScoreDorm struct {
	InspectionID string    `json:"inspectionId"`
	DormID       string    `json:"dormId"`
	DormName     string    `json:"dormName"`
	TotalScore   int       `json:"totalScore"`
	TaskID       string    `json:"taskId,omitempty"`
	TaskTitle    string    `json:"taskTitle"`
	CreatedAt    time.Time `json:"createdAt"`
}

type DashboardFullScoreDorm struct {
	InspectionID string    `json:"inspectionId"`
	DormID       string    `json:"dormId"`
	DormName     string    `json:"dormName"`
	TotalScore   int       `json:"totalScore"`
	TaskID       string    `json:"taskId,omitempty"`
	TaskTitle    string    `json:"taskTitle"`
	CreatedAt    time.Time `json:"createdAt"`
}

type DashboardPendingAppeal struct {
	ID           string    `json:"id"`
	InspectionID string    `json:"inspectionId"`
	DormName     string    `json:"dormName"`
	StudentName  string    `json:"studentName"`
	TotalScore   *int      `json:"totalScore"`
	Content      string    `json:"content"`
	CreatedAt    time.Time `json:"createdAt"`
}

type DashboardMyDormSummary struct {
	DormID           string     `json:"dormId"`
	DormName         string     `json:"dormName"`
	LatestScore      *int       `json:"latestScore"`
	LatestTime       *time.Time `json:"latestTime"`
	AvgScore         *float64   `json:"avgScore"`
	MyPendingAppeals int64      `json:"myPendingAppeals"`
	HasActiveTask    bool       `json:"hasActiveTask"`
}

type DashboardStats struct {
	Range             string                   `json:"range"`
	ScopeLabel        string                   `json:"scopeLabel"`
	TotalStudents     int64                    `json:"totalStudents"`
	TotalDorms        int64                    `json:"totalDorms"`
	TotalBeds         int64                    `json:"totalBeds"`
	OccupiedBeds      int64                    `json:"occupiedBeds"`
	ActiveTasks       int64                    `json:"activeTasks"`
	PendingAppeals    int64                    `json:"pendingAppeals"`
	AverageScore      float64                  `json:"averageScore"`
	ScoreDelta        *float64                 `json:"scoreDelta"`
	TrendData         []TrendPoint             `json:"trendData"`
	Distribution      []DistPoint              `json:"distribution"`
	RecentInspections []model.Inspection       `json:"recentInspections"`
	ActiveTaskList    []DashboardActiveTask    `json:"activeTaskList"`
	LowScoreDorms     []DashboardLowScoreDorm  `json:"lowScoreDorms"`
	FullScoreDorms    []DashboardFullScoreDorm `json:"fullScoreDorms"`
	PendingAppealList []DashboardPendingAppeal `json:"pendingAppealList"`
	MyDormSummary     *DashboardMyDormSummary  `json:"myDormSummary,omitempty"`
}

type TrendPoint struct {
	Label string  `json:"label"`
	Score float64 `json:"score"`
	Count int64   `json:"count"`
}

type DistPoint struct {
	Name  string `json:"name"`
	Value int64  `json:"value"`
}

type inspectionScoreRow struct {
	TotalScore int       `gorm:"column:totalScore"`
	CreatedAt  time.Time `gorm:"column:createdAt"`
}

type DashboardService interface {
	GetSummary(userID string) (*DashboardStats, error)
	GetSummaryWithRange(userID string, rangeKey string, includeAppeals bool) (*DashboardStats, error)
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

func normalizeDashboardRange(raw string) string {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "month", "30d":
		return "month"
	case "3m":
		return "3m"
	case "all":
		return "all"
	default:
		return "6m"
	}
}

func resolveDashboardWindowStart(rangeKey string, now time.Time) *time.Time {
	switch rangeKey {
	case "all":
		return nil
	case "month":
		d := now.AddDate(0, 0, -29)
		start := time.Date(d.Year(), d.Month(), d.Day(), 0, 0, 0, 0, now.Location())
		return &start
	case "3m":
		m := now.AddDate(0, -2, 0)
		start := time.Date(m.Year(), m.Month(), 1, 0, 0, 0, 0, now.Location())
		return &start
	default: // 6m
		m := now.AddDate(0, -5, 0)
		start := time.Date(m.Year(), m.Month(), 1, 0, 0, 0, 0, now.Location())
		return &start
	}
}

func (s *dashboardService) GetSummary(userID string) (*DashboardStats, error) {
	return s.GetSummaryWithRange(userID, "6m", true)
}

func (s *dashboardService) GetSummaryWithRange(userID string, rangeKey string, includeAppeals bool) (*DashboardStats, error) {
	scope, err := ResolveUserDataScopeByUserID(s.db, userID)
	if err != nil {
		return nil, err
	}

	normalizedRange := normalizeDashboardRange(rangeKey)
	now := time.Now()
	currentMonthStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
	prevMonthStart := currentMonthStart.AddDate(0, -1, 0)
	windowStart := resolveDashboardWindowStart(normalizedRange, now)

	stats := &DashboardStats{
		Range:             normalizedRange,
		ScopeLabel:        buildScopeLabel(scope),
		TrendData:         []TrendPoint{},
		Distribution:      []DistPoint{},
		RecentInspections: []model.Inspection{},
		ActiveTaskList:    []DashboardActiveTask{},
		LowScoreDorms:     []DashboardLowScoreDorm{},
		FullScoreDorms:    []DashboardFullScoreDorm{},
		PendingAppealList: []DashboardPendingAppeal{},
	}

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

		// 一次拉取可见范围内的已评分记录，在 Go 层精确聚合（避免 SQLite/MySQL 日期函数与时区差异）
		scoreQuery := s.db.Model(&model.Inspection{}).
			Select("totalScore, createdAt").
			Where("dormId IN (?)", visibleDormIDs).
			Where("totalScore IS NOT NULL")

		var allScoreRows []inspectionScoreRow
		if err := scoreQuery.Order("createdAt ASC").Scan(&allScoreRows).Error; err != nil {
			return nil, err
		}

		// 本月均分与上月环比；若本月尚无评分记录则回退展示当前统计周期均分
		var curMonthSum, prevMonthSum int64
		var curMonthCnt, prevMonthCnt int64
		windowRows := make([]inspectionScoreRow, 0, len(allScoreRows))

		for _, row := range allScoreRows {
			localTime := row.CreatedAt.In(now.Location())
			if !localTime.Before(currentMonthStart) {
				curMonthSum += int64(row.TotalScore)
				curMonthCnt++
			} else if !localTime.Before(prevMonthStart) && localTime.Before(currentMonthStart) {
				prevMonthSum += int64(row.TotalScore)
				prevMonthCnt++
			}

			if windowStart == nil || !localTime.Before(*windowStart) {
				windowRows = append(windowRows, row)
			}
		}

		if curMonthCnt > 0 {
			stats.AverageScore = math.Round((float64(curMonthSum)/float64(curMonthCnt))*10) / 10
			if prevMonthCnt > 0 {
				prevAvg := float64(prevMonthSum) / float64(prevMonthCnt)
				delta := math.Round((stats.AverageScore-prevAvg)*10) / 10
				stats.ScoreDelta = &delta
			}
		} else if len(windowRows) > 0 {
			var windowSum int64
			for _, row := range windowRows {
				windowSum += int64(row.TotalScore)
			}
			stats.AverageScore = math.Round((float64(windowSum)/float64(len(windowRows)))*10) / 10
		}

		stats.Distribution = aggregateScoreDistribution(windowRows)
		stats.TrendData = aggregateScoreTrend(windowRows, normalizedRange, now)

		if err := s.db.Preload("Dorm").Preload("CreatedBy").Preload("Task").
			Where("dormId IN (?)", visibleDormIDs).
			Order("createdAt DESC").
			Limit(10).
			Find(&stats.RecentInspections).Error; err != nil {
			return nil, err
		}

		activeTaskList, err := s.buildActiveTaskList(userID, visibleDormIDs, now)
		if err != nil {
			return nil, err
		}
		stats.ActiveTaskList = activeTaskList

		lowScoreDorms, err := s.buildLowScoreDorms(visibleDormIDs, windowStart)
		if err != nil {
			return nil, err
		}
		stats.LowScoreDorms = lowScoreDorms

		fullScoreDorms, err := s.buildFullScoreDorms(visibleDormIDs, windowStart)
		if err != nil {
			return nil, err
		}
		stats.FullScoreDorms = fullScoreDorms
	} else {
		stats.TrendData = buildEmptyTrendData(normalizedRange, now)
	}

	if includeAppeals {
		pendingCount, pendingList, err := s.queryVisiblePendingAppeals(scope, 5)
		if err != nil {
			return nil, err
		}
		stats.PendingAppeals = pendingCount
		stats.PendingAppealList = pendingList
	}

	myDormSummary, err := s.buildMyDormSummary(userID, now)
	if err != nil {
		return nil, err
	}
	stats.MyDormSummary = myDormSummary

	return stats, nil
}

func aggregateScoreDistribution(rows []inspectionScoreRow) []DistPoint {
	if len(rows) == 0 {
		return []DistPoint{}
	}

	counts := map[string]int64{
		"优秀":  0,
		"良好":  0,
		"及格":  0,
		"不及格": 0,
	}
	for _, row := range rows {
		switch {
		case row.TotalScore >= 90:
			counts["优秀"]++
		case row.TotalScore >= 80:
			counts["良好"]++
		case row.TotalScore >= 60:
			counts["及格"]++
		default:
			counts["不及格"]++
		}
	}

	order := []string{"优秀", "良好", "及格", "不及格"}
	result := make([]DistPoint, 0, len(order))
	for _, label := range order {
		if counts[label] > 0 {
			result = append(result, DistPoint{
				Name:  label,
				Value: counts[label],
			})
		}
	}
	return result
}

func aggregateScoreTrend(rows []inspectionScoreRow, rangeKey string, now time.Time) []TrendPoint {
	type bucket struct {
		sum   int64
		count int64
	}

	if rangeKey == "month" {
		byDay := make(map[string]*bucket)
		for _, row := range rows {
			key := row.CreatedAt.In(now.Location()).Format("2006-01-02")
			b := byDay[key]
			if b == nil {
				b = &bucket{}
				byDay[key] = b
			}
			b.sum += int64(row.TotalScore)
			b.count++
		}
		if len(byDay) == 0 {
			return buildEmptyTrendData("month", now)
		}
		keys := make([]string, 0, len(byDay))
		for k := range byDay {
			keys = append(keys, k)
		}
		sort.Strings(keys)

		points := make([]TrendPoint, 0, len(keys))
		for _, key := range keys {
			b := byDay[key]
			label := key
			if parsed, err := time.Parse("2006-01-02", key); err == nil {
				label = parsed.Format("01-02")
			}
			points = append(points, TrendPoint{
				Label: label,
				Score: math.Round((float64(b.sum)/float64(b.count))*10) / 10,
				Count: b.count,
			})
		}
		return points
	}

	if rangeKey == "all" {
		byMonth := make(map[string]*bucket)
		for _, row := range rows {
			key := row.CreatedAt.In(now.Location()).Format("2006-01")
			b := byMonth[key]
			if b == nil {
				b = &bucket{}
				byMonth[key] = b
			}
			b.sum += int64(row.TotalScore)
			b.count++
		}
		if len(byMonth) == 0 {
			return buildEmptyTrendData("6m", now)
		}
		keys := make([]string, 0, len(byMonth))
		for k := range byMonth {
			keys = append(keys, k)
		}
		sort.Strings(keys)
		// 最多保留最近 12 个有记录的月份，保持图表可读
		if len(keys) > 12 {
			keys = keys[len(keys)-12:]
		}
		points := make([]TrendPoint, 0, len(keys))
		for _, key := range keys {
			b := byMonth[key]
			label := key
			if parsed, err := time.Parse("2006-01", key); err == nil {
				label = parsed.Format("06年1月")
			}
			points = append(points, TrendPoint{
				Label: label,
				Score: math.Round((float64(b.sum)/float64(b.count))*10) / 10,
				Count: b.count,
			})
		}
		return points
	}

	months := 6
	if rangeKey == "3m" {
		months = 3
	}
	byMonth := make(map[string]*bucket)
	for _, row := range rows {
		key := row.CreatedAt.In(now.Location()).Format("2006-01")
		b := byMonth[key]
		if b == nil {
			b = &bucket{}
			byMonth[key] = b
		}
		b.sum += int64(row.TotalScore)
		b.count++
	}

	points := make([]TrendPoint, 0, months)
	for i := months - 1; i >= 0; i-- {
		m := now.AddDate(0, -i, 0)
		monthKey := m.Format("2006-01")
		var score float64
		var count int64
		if b := byMonth[monthKey]; b != nil && b.count > 0 {
			score = math.Round((float64(b.sum)/float64(b.count))*10) / 10
			count = b.count
		}
		points = append(points, TrendPoint{
			Label: m.Format("1月"),
			Score: score,
			Count: count,
		})
	}
	return points
}

func buildEmptyTrendData(rangeKey string, now time.Time) []TrendPoint {
	if rangeKey == "month" {
		points := make([]TrendPoint, 0, 7)
		for i := 6; i >= 0; i-- {
			d := now.AddDate(0, 0, -i)
			points = append(points, TrendPoint{Label: d.Format("01-02"), Score: 0, Count: 0})
		}
		return points
	}

	months := 6
	if rangeKey == "3m" {
		months = 3
	}
	points := make([]TrendPoint, 0, months)
	for i := months - 1; i >= 0; i-- {
		m := now.AddDate(0, -i, 0)
		points = append(points, TrendPoint{Label: m.Format("1月"), Score: 0, Count: 0})
	}
	return points
}

func (s *dashboardService) buildActiveTaskList(userID string, visibleDormIDs *gorm.DB, now time.Time) ([]DashboardActiveTask, error) {
	var tasks []model.Task
	if err := s.db.Model(&model.Task{}).
		Joins("JOIN taskdorm ON taskdorm.taskId = task.id").
		Where("taskdorm.dormId IN (?)", visibleDormIDs).
		Where("task.date <= ? AND task.deadline >= ?", now, now).
		Group("task.id").
		Order("task.deadline ASC").
		Limit(5).
		Find(&tasks).Error; err != nil {
		return nil, err
	}
	if len(tasks) == 0 {
		return []DashboardActiveTask{}, nil
	}

	result := make([]DashboardActiveTask, 0, len(tasks))
	for _, task := range tasks {
		var totalDorms int64
		if err := s.db.Model(&model.TaskDorm{}).
			Where("taskId = ? AND dormId IN (?)", task.ID, visibleDormIDs).
			Distinct("dormId").
			Count(&totalDorms).Error; err != nil {
			return nil, err
		}

		var completedDorms int64
		if err := s.db.Model(&model.Inspection{}).
			Where("taskId = ? AND dormId IN (?)", task.ID, visibleDormIDs).
			Distinct("dormId").
			Count(&completedDorms).Error; err != nil {
			return nil, err
		}

		var myTotalDorms int64
		var myPendingDorms int64

		if s.db.Migrator().HasTable(&model.TaskExecutorDorm{}) {
			if err := s.db.Model(&model.TaskExecutorDorm{}).
				Where("taskId = ? AND executorId = ? AND dormId IN (?)", task.ID, userID, visibleDormIDs).
				Distinct("dormId").
				Count(&myTotalDorms).Error; err != nil {
				return nil, err
			}
			if myTotalDorms > 0 {
				myAssignedDormIDs := s.db.Model(&model.TaskExecutorDorm{}).
					Select("dormId").
					Where("taskId = ? AND executorId = ? AND dormId IN (?)", task.ID, userID, visibleDormIDs)
				var myCompleted int64
				if err := s.db.Model(&model.Inspection{}).
					Where("taskId = ? AND dormId IN (?)", task.ID, myAssignedDormIDs).
					Distinct("dormId").
					Count(&myCompleted).Error; err != nil {
					return nil, err
				}
				if myTotalDorms > myCompleted {
					myPendingDorms = myTotalDorms - myCompleted
				}
			}
		}

		if myTotalDorms == 0 && s.db.Migrator().HasTable(&model.TaskExecutor{}) {
			var execCount int64
			if err := s.db.Model(&model.TaskExecutor{}).
				Where("taskId = ? AND executorId = ?", task.ID, userID).
				Count(&execCount).Error; err != nil {
				return nil, err
			}
			if execCount > 0 {
				myTotalDorms = totalDorms
				if totalDorms > completedDorms {
					myPendingDorms = totalDorms - completedDorms
				}
			}
		}

		result = append(result, DashboardActiveTask{
			ID:             task.ID,
			Title:          task.Title,
			Deadline:       task.Deadline,
			TotalDorms:     totalDorms,
			CompletedDorms: completedDorms,
			MyTotalDorms:   myTotalDorms,
			MyPendingDorms: myPendingDorms,
		})
	}

	return result, nil
}

func (s *dashboardService) buildLowScoreDorms(visibleDormIDs *gorm.DB, since *time.Time) ([]DashboardLowScoreDorm, error) {
	query := s.db.Preload("Dorm").Preload("Task").
		Where("dormId IN (?)", visibleDormIDs).
		Where("totalScore IS NOT NULL AND totalScore < ?", 60)
	if since != nil {
		query = query.Where("createdAt >= ?", *since)
	}

	var inspections []model.Inspection
	if err := query.Order("totalScore ASC, createdAt DESC").
		Limit(5).
		Find(&inspections).Error; err != nil {
		return nil, err
	}

	list := make([]DashboardLowScoreDorm, 0, len(inspections))
	for _, ins := range inspections {
		score := 0
		if ins.TotalScore != nil {
			score = *ins.TotalScore
		}
		dormID := ""
		if ins.DormID != nil {
			dormID = *ins.DormID
		}
		taskID := ""
		if ins.TaskID != nil {
			taskID = *ins.TaskID
		}
		taskTitle := "日常查寝"
		if ins.Task != nil && strings.TrimSpace(ins.Task.Title) != "" {
			taskTitle = ins.Task.Title
		}
		list = append(list, DashboardLowScoreDorm{
			InspectionID: ins.ID,
			DormID:       dormID,
			DormName:     formatDashboardDormName(ins.Dorm),
			TotalScore:   score,
			TaskID:       taskID,
			TaskTitle:    taskTitle,
			CreatedAt:    ins.CreatedAt,
		})
	}
	return list, nil
}

func (s *dashboardService) buildFullScoreDorms(visibleDormIDs *gorm.DB, since *time.Time) ([]DashboardFullScoreDorm, error) {
	query := s.db.Preload("Dorm").Preload("Task").
		Where("dormId IN (?)", visibleDormIDs).
		Where("totalScore IS NOT NULL AND totalScore >= ?", 100)
	if since != nil {
		query = query.Where("createdAt >= ?", *since)
	}

	var inspections []model.Inspection
	if err := query.Order("createdAt DESC").
		Limit(50).
		Find(&inspections).Error; err != nil {
		return nil, err
	}

	list := make([]DashboardFullScoreDorm, 0, len(inspections))
	for _, ins := range inspections {
		score := 100
		if ins.TotalScore != nil {
			score = *ins.TotalScore
		}
		dormID := ""
		if ins.DormID != nil {
			dormID = *ins.DormID
		}
		taskID := ""
		if ins.TaskID != nil {
			taskID = *ins.TaskID
		}
		taskTitle := "日常查寝"
		if ins.Task != nil && strings.TrimSpace(ins.Task.Title) != "" {
			taskTitle = ins.Task.Title
		}
		list = append(list, DashboardFullScoreDorm{
			InspectionID: ins.ID,
			DormID:       dormID,
			DormName:     formatDashboardDormName(ins.Dorm),
			TotalScore:   score,
			TaskID:       taskID,
			TaskTitle:    taskTitle,
			CreatedAt:    ins.CreatedAt,
		})
	}
	return list, nil
}

func (s *dashboardService) queryVisiblePendingAppeals(scope *ResolvedUserDataScope, limit int) (int64, []DashboardPendingAppeal, error) {
	appeals, total, err := repository.NewAppealRepository(s.db).FindPage(repository.AppealQuery{
		Page: 1, PageSize: limit, Status: model.AppealPending, Scope: ApplyAppealScope(scope),
	})
	if err != nil {
		return 0, nil, err
	}
	list := make([]DashboardPendingAppeal, 0, len(appeals))
	for _, appeal := range appeals {
		studentName := strings.TrimSpace(appeal.Student.FullName)
		if studentName == "" {
			studentName = "学生"
		}
		list = append(list, DashboardPendingAppeal{
			ID: appeal.ID, InspectionID: appeal.InspectionID,
			DormName: formatDashboardDormName(appeal.Inspection.Dorm), StudentName: studentName,
			TotalScore: appeal.Inspection.TotalScore, Content: strings.TrimSpace(appeal.Content), CreatedAt: appeal.CreatedAt,
		})
	}
	return total, list, nil
}

func (s *dashboardService) buildMyDormSummary(userID string, now time.Time) (*DashboardMyDormSummary, error) {
	var student model.Student
	err := s.db.Preload("Dorm").Where("userId = ?", userID).First(&student).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, err
	}
	if student.DormID == nil || strings.TrimSpace(*student.DormID) == "" {
		return nil, nil
	}

	dormID := *student.DormID
	summary := &DashboardMyDormSummary{
		DormID:   dormID,
		DormName: formatDashboardDormName(student.Dorm),
	}

	var latest model.Inspection
	if err := s.db.Where("dormId = ?", dormID).
		Order("createdAt DESC").
		First(&latest).Error; err == nil {
		summary.LatestScore = latest.TotalScore
		t := latest.CreatedAt
		summary.LatestTime = &t
	} else if err != gorm.ErrRecordNotFound {
		return nil, err
	}

	var count int64
	if err := s.db.Model(&model.Inspection{}).
		Where("dormId = ? AND totalScore IS NOT NULL", dormID).
		Count(&count).Error; err != nil {
		return nil, err
	}
	if count > 0 {
		var avg float64
		if err := s.db.Model(&model.Inspection{}).
			Where("dormId = ? AND totalScore IS NOT NULL", dormID).
			Select("COALESCE(AVG(totalScore), 0)").
			Scan(&avg).Error; err != nil {
			return nil, err
		}
		rounded := math.Round(avg*10) / 10
		summary.AvgScore = &rounded
	}

	if err := s.db.Model(&model.Appeal{}).
		Where("studentId = ? AND status = ?", student.ID, model.AppealPending).
		Count(&summary.MyPendingAppeals).Error; err != nil {
		return nil, err
	}

	var activeTaskCount int64
	if err := s.db.Model(&model.Task{}).
		Joins("JOIN taskdorm ON taskdorm.taskId = task.id").
		Where("taskdorm.dormId = ?", dormID).
		Where("task.date <= ? AND task.deadline >= ?", now, now).
		Count(&activeTaskCount).Error; err != nil {
		return nil, err
	}
	summary.HasActiveTask = activeTaskCount > 0

	return summary, nil
}

func formatDashboardDormName(dorm *model.Dormitory) string {
	if dorm == nil {
		return "未命名宿舍"
	}
	building := strings.TrimSpace(ptrToStr(dorm.Building))
	roomNo := strings.TrimSpace(ptrToStr(dorm.RoomNo))
	if building != "" && roomNo != "" {
		return building + "-" + roomNo
	}
	if building != "" {
		return building
	}
	if roomNo != "" {
		return roomNo
	}
	return "未命名宿舍"
}

func buildScopeLabel(scope *ResolvedUserDataScope) string {
	if scope == nil || scope.All {
		return "全校数据"
	}

	parts := make([]string, 0, 2)
	if len(scope.Dormitory.Buildings) > 0 {
		buildings := sortedMapKeys(scope.Dormitory.Buildings)
		if len(buildings) == 1 {
			parts = append(parts, buildings[0])
		} else {
			parts = append(parts, fmt.Sprintf("%d 栋楼宇", len(buildings)))
		}
	} else if len(scope.Dormitory.Rooms) > 0 || len(scope.Dormitory.Floors) > 0 {
		parts = append(parts, "指定宿舍区")
	}

	if len(scope.Academic.Colleges) > 0 {
		colleges := sortedMapKeys(scope.Academic.Colleges)
		if len(colleges) == 1 {
			parts = append(parts, colleges[0])
		} else {
			parts = append(parts, fmt.Sprintf("%d 个学院", len(colleges)))
		}
	} else if len(scope.Academic.ClassNames) > 0 {
		classes := sortedMapKeys(scope.Academic.ClassNames)
		if len(classes) == 1 {
			parts = append(parts, classes[0])
		} else {
			parts = append(parts, fmt.Sprintf("%d 个班级", len(classes)))
		}
	}

	if len(parts) > 0 {
		return strings.Join(parts, " · ")
	}
	if len(scope.Dormitory.DormIDs) > 0 {
		if len(scope.Dormitory.DormIDs) == 1 {
			return "本人宿舍"
		}
		return fmt.Sprintf("管辖 %d 间宿舍", len(scope.Dormitory.DormIDs))
	}
	return "管辖范围"
}
