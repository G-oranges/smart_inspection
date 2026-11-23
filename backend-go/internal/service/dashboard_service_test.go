package service

import (
	"testing"
	"time"

	gormsqlite "github.com/glebarez/sqlite"
	"github.com/google/uuid"
	"github.com/my-project/backend-go/internal/model"
	"gorm.io/datatypes"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func TestDashboardServiceGetSummary_RespectsRoleDataScope(t *testing.T) {
	db := openDashboardTestDB(t)
	if err := db.AutoMigrate(
		&model.RoleEntity{},
		&model.RoleDataScope{},
		&model.User{},
		&model.Student{},
		&model.Dormitory{},
		&model.DormBed{},
		&model.Task{},
		&model.TaskDorm{},
		&model.Inspection{},
		&model.Appeal{},
	); err != nil {
		t.Fatalf("migrate failed: %v", err)
	}
	if err := db.Exec("DROP TABLE IF EXISTS `_roleentitytouser`").Error; err != nil {
		t.Fatalf("drop join table failed: %v", err)
	}
	if err := db.Exec("CREATE TABLE IF NOT EXISTS `_roleentitytouser` (A char(36) NOT NULL, B char(36) NOT NULL, PRIMARY KEY (A, B))").Error; err != nil {
		t.Fatalf("create join table failed: %v", err)
	}

	role := model.RoleEntity{ID: uuid.NewString(), Code: "DASH_SCOPE", Name: "Dash Scope", Status: "ACTIVE", TypeCode: "CUSTOM"}
	if err := db.Create(&role).Error; err != nil {
		t.Fatalf("seed role failed: %v", err)
	}
	scope := model.RoleDataScope{
		ID:         uuid.NewString(),
		RoleID:     role.ID,
		ScopeMode:  "CUSTOM",
		PresetCode: "CUSTOM",
		RulesJSON:  datatypes.JSON([]byte(`{"academic":{"college":["计算机学院"],"major":[],"className":[]},"dormitory":{"building":["1号楼"],"floor":[],"room":[]}}`)),
	}
	if err := db.Create(&scope).Error; err != nil {
		t.Fatalf("seed scope failed: %v", err)
	}

	scopedUser := model.User{ID: uuid.NewString(), Username: "scoped", Password: "x", Role: role.Code, FullName: "Scoped"}
	fullUser := model.User{ID: uuid.NewString(), Username: "full", Password: "x", Role: "ADMIN", FullName: "Full"}
	if err := db.Create(&[]model.User{scopedUser, fullUser}).Error; err != nil {
		t.Fatalf("seed users failed: %v", err)
	}
	if err := db.Exec("INSERT INTO `_roleentitytouser` (A, B) VALUES (?, ?)", role.ID, scopedUser.ID).Error; err != nil {
		t.Fatalf("seed user role failed: %v", err)
	}

	collegeA := "计算机学院"
	collegeB := "外国语学院"
	dorm1ID := uuid.NewString()
	dorm2ID := uuid.NewString()
	if err := db.Create(&[]model.Dormitory{
		{ID: dorm1ID, Building: strPtr("1号楼"), Floor: intPtr(2), RoomNo: strPtr("201"), Capacity: intPtr(4)},
		{ID: dorm2ID, Building: strPtr("2号楼"), Floor: intPtr(2), RoomNo: strPtr("202"), Capacity: intPtr(4)},
	}).Error; err != nil {
		t.Fatalf("seed dorms failed: %v", err)
	}
	if err := db.Create(&[]model.Student{
		{ID: uuid.NewString(), FullName: "张三", College: &collegeA, DormID: &dorm1ID},
		{ID: uuid.NewString(), FullName: "李四", College: &collegeB, DormID: &dorm2ID},
	}).Error; err != nil {
		t.Fatalf("seed students failed: %v", err)
	}
	studentID1 := uuid.NewString()
	studentID2 := uuid.NewString()
	if err := db.Create(&[]model.DormBed{
		{ID: uuid.NewString(), DormID: dorm1ID, BedNo: "1", StudentID: &studentID1, Status: "occupied"},
		{ID: uuid.NewString(), DormID: dorm2ID, BedNo: "1", StudentID: &studentID2, Status: "occupied"},
	}).Error; err != nil {
		t.Fatalf("seed beds failed: %v", err)
	}

	now := time.Now()
	startedAt := now.Add(-time.Hour)
	deadline := now.Add(time.Hour)
	task1ID := uuid.NewString()
	task2ID := uuid.NewString()
	if err := db.Create(&[]model.Task{
		{ID: task1ID, Title: "任务1", Date: &startedAt, Deadline: &deadline},
		{ID: task2ID, Title: "任务2", Date: &startedAt, Deadline: &deadline},
	}).Error; err != nil {
		t.Fatalf("seed tasks failed: %v", err)
	}
	if err := db.Create(&[]model.TaskDorm{
		{ID: uuid.NewString(), TaskID: task1ID, DormID: dorm1ID},
		{ID: uuid.NewString(), TaskID: task2ID, DormID: dorm2ID},
	}).Error; err != nil {
		t.Fatalf("seed task dorms failed: %v", err)
	}

	scoreA := 90
	scoreB := 60
	inspection1ID := uuid.NewString()
	inspection2ID := uuid.NewString()
	if err := db.Create(&[]model.Inspection{
		{ID: inspection1ID, DormID: &dorm1ID, TotalScore: &scoreA, CreatedAt: now},
		{ID: inspection2ID, DormID: &dorm2ID, TotalScore: &scoreB, CreatedAt: now},
	}).Error; err != nil {
		t.Fatalf("seed inspections failed: %v", err)
	}
	scopedStudentID := uuid.NewString()
	outStudentID := uuid.NewString()
	if err := db.Create(&[]model.Student{
		{ID: scopedStudentID, FullName: "王五", College: &collegeA},
		{ID: outStudentID, FullName: "赵六", College: &collegeB},
	}).Error; err != nil {
		t.Fatalf("seed appeal students failed: %v", err)
	}
	if err := db.Create(&[]model.Appeal{
		{ID: uuid.NewString(), InspectionID: inspection1ID, StudentID: scopedStudentID, Content: "申诉1", Status: "pending"},
		{ID: uuid.NewString(), InspectionID: inspection2ID, StudentID: outStudentID, Content: "申诉2", Status: "pending"},
	}).Error; err != nil {
		t.Fatalf("seed appeals failed: %v", err)
	}

	svc := NewDashboardService(db)
	scopedStats, err := svc.GetSummary(scopedUser.ID)
	if err != nil {
		t.Fatalf("get scoped summary failed: %v", err)
	}
	fullStats, err := svc.GetSummary(fullUser.ID)
	if err != nil {
		t.Fatalf("get full summary failed: %v", err)
	}

	if scopedStats.TotalStudents >= fullStats.TotalStudents {
		t.Fatalf("expected scoped student total to be smaller, scoped=%d full=%d", scopedStats.TotalStudents, fullStats.TotalStudents)
	}
	if scopedStats.TotalDorms >= fullStats.TotalDorms {
		t.Fatalf("expected scoped dorm total to be smaller, scoped=%d full=%d", scopedStats.TotalDorms, fullStats.TotalDorms)
	}
	if scopedStats.ActiveTasks >= fullStats.ActiveTasks {
		t.Fatalf("expected scoped active tasks to be smaller, scoped=%d full=%d", scopedStats.ActiveTasks, fullStats.ActiveTasks)
	}
	if scopedStats.PendingAppeals >= fullStats.PendingAppeals {
		t.Fatalf("expected scoped pending appeals to be smaller, scoped=%d full=%d", scopedStats.PendingAppeals, fullStats.PendingAppeals)
	}
	if len(scopedStats.RecentInspections) >= len(fullStats.RecentInspections) {
		t.Fatalf("expected scoped recent inspections to be smaller, scoped=%d full=%d", len(scopedStats.RecentInspections), len(fullStats.RecentInspections))
	}
	if scopedStats.ScopeLabel != "1号楼 · 计算机学院" {
		t.Fatalf("unexpected scoped label: %q", scopedStats.ScopeLabel)
	}
	if fullStats.ScopeLabel != "全校数据" {
		t.Fatalf("unexpected full scope label: %q", fullStats.ScopeLabel)
	}
	if len(scopedStats.ActiveTaskList) != 1 || len(fullStats.ActiveTaskList) != 2 {
		t.Fatalf("unexpected active task list sizes: scoped=%d full=%d", len(scopedStats.ActiveTaskList), len(fullStats.ActiveTaskList))
	}
	if len(scopedStats.PendingAppealList) != 1 || len(fullStats.PendingAppealList) != 2 {
		t.Fatalf("unexpected pending appeal list sizes: scoped=%d full=%d", len(scopedStats.PendingAppealList), len(fullStats.PendingAppealList))
	}
}

func TestDashboardServiceGetSummaryWithRange_ExtendedMetrics(t *testing.T) {
	db := openDashboardTestDB(t)
	if err := db.AutoMigrate(
		&model.RoleEntity{},
		&model.RoleDataScope{},
		&model.User{},
		&model.Student{},
		&model.Dormitory{},
		&model.DormBed{},
		&model.Task{},
		&model.TaskDorm{},
		&model.TaskExecutor{},
		&model.TaskExecutorDorm{},
		&model.Inspection{},
		&model.Appeal{},
	); err != nil {
		t.Fatalf("migrate failed: %v", err)
	}
	if err := db.Exec("DROP TABLE IF EXISTS `_roleentitytouser`").Error; err != nil {
		t.Fatalf("drop join table failed: %v", err)
	}
	if err := db.Exec("CREATE TABLE IF NOT EXISTS `_roleentitytouser` (A char(36) NOT NULL, B char(36) NOT NULL, PRIMARY KEY (A, B))").Error; err != nil {
		t.Fatalf("create join table failed: %v", err)
	}

	admin := model.User{ID: uuid.NewString(), Username: "admin2", Password: "x", Role: "ADMIN", FullName: "Admin"}
	studentUser := model.User{ID: uuid.NewString(), Username: "stu1", Password: "x", Role: "STUDENT", FullName: "同学甲"}
	if err := db.Create(&[]model.User{admin, studentUser}).Error; err != nil {
		t.Fatalf("seed users failed: %v", err)
	}

	dorm1ID := uuid.NewString()
	dorm2ID := uuid.NewString()
	if err := db.Create(&[]model.Dormitory{
		{ID: dorm1ID, Building: strPtr("东1"), Floor: intPtr(3), RoomNo: strPtr("301"), Capacity: intPtr(4)},
		{ID: dorm2ID, Building: strPtr("东1"), Floor: intPtr(3), RoomNo: strPtr("302"), Capacity: intPtr(4)},
	}).Error; err != nil {
		t.Fatalf("seed dorms failed: %v", err)
	}

	stuID := uuid.NewString()
	if err := db.Create(&model.Student{
		ID:       stuID,
		FullName: "同学甲",
		DormID:   &dorm1ID,
		UserID:   &studentUser.ID,
	}).Error; err != nil {
		t.Fatalf("seed student failed: %v", err)
	}

	now := time.Now()
	prevMonth := time.Date(now.Year(), now.Month(), 1, 12, 0, 0, 0, now.Location()).AddDate(0, -1, 5)
	startedAt := now.Add(-time.Hour)
	deadline := now.Add(4 * time.Hour)
	taskID := uuid.NewString()
	if err := db.Create(&model.Task{
		ID:       taskID,
		Title:    "本周例行查寝",
		Date:     &startedAt,
		Deadline: &deadline,
	}).Error; err != nil {
		t.Fatalf("seed task failed: %v", err)
	}
	if err := db.Create(&[]model.TaskDorm{
		{ID: uuid.NewString(), TaskID: taskID, DormID: dorm1ID},
		{ID: uuid.NewString(), TaskID: taskID, DormID: dorm2ID},
	}).Error; err != nil {
		t.Fatalf("seed task dorms failed: %v", err)
	}
	if err := db.Create(&model.TaskExecutorDorm{
		ID:         uuid.NewString(),
		TaskID:     taskID,
		ExecutorID: admin.ID,
		DormID:     dorm2ID,
	}).Error; err != nil {
		t.Fatalf("seed task executor dorm failed: %v", err)
	}

	lowScore := 54
	highScore := 92
	prevScore := 80
	lowInsID := uuid.NewString()
	if err := db.Create(&[]model.Inspection{
		{ID: lowInsID, TaskID: &taskID, DormID: &dorm1ID, TotalScore: &lowScore, CreatedAt: now},
		{ID: uuid.NewString(), DormID: &dorm2ID, TotalScore: &highScore, CreatedAt: now},
		{ID: uuid.NewString(), DormID: &dorm1ID, TotalScore: &prevScore, CreatedAt: prevMonth},
	}).Error; err != nil {
		t.Fatalf("seed inspections failed: %v", err)
	}
	if err := db.Create(&model.Appeal{
		ID:           uuid.NewString(),
		InspectionID: lowInsID,
		StudentID:    stuID,
		Content:      "复核请求",
		Status:       model.AppealPending,
	}).Error; err != nil {
		t.Fatalf("seed appeal failed: %v", err)
	}

	svc := NewDashboardService(db)
	stats3m, err := svc.GetSummaryWithRange(admin.ID, "3m")
	if err != nil {
		t.Fatalf("get 3m summary failed: %v", err)
	}
	if stats3m.Range != "3m" || len(stats3m.TrendData) != 3 {
		t.Fatalf("expected 3m range with 3 trend points, got range=%s len=%d", stats3m.Range, len(stats3m.TrendData))
	}
	if stats3m.ScoreDelta == nil || *stats3m.ScoreDelta != -7.0 {
		t.Fatalf("expected scoreDelta=-7.0 (avg 73 - prev 80), got %v", stats3m.ScoreDelta)
	}
	if len(stats3m.LowScoreDorms) != 1 || stats3m.LowScoreDorms[0].DormName != "东1-301" || stats3m.LowScoreDorms[0].TotalScore != 54 {
		t.Fatalf("unexpected lowScoreDorms: %+v", stats3m.LowScoreDorms)
	}
	if len(stats3m.ActiveTaskList) != 1 {
		t.Fatalf("expected 1 active task, got %d", len(stats3m.ActiveTaskList))
	}
	taskSummary := stats3m.ActiveTaskList[0]
	if taskSummary.TotalDorms != 2 || taskSummary.CompletedDorms != 1 || taskSummary.MyTotalDorms != 1 || taskSummary.MyPendingDorms != 1 {
		t.Fatalf("unexpected task progress: %+v", taskSummary)
	}

	stuStats, err := svc.GetSummaryWithRange(studentUser.ID, "month")
	if err != nil {
		t.Fatalf("get student summary failed: %v", err)
	}
	if stuStats.MyDormSummary == nil {
		t.Fatalf("expected myDormSummary for student user")
	}
	if stuStats.MyDormSummary.DormName != "东1-301" || stuStats.MyDormSummary.LatestScore == nil || *stuStats.MyDormSummary.LatestScore != 54 {
		t.Fatalf("unexpected myDormSummary: %+v", stuStats.MyDormSummary)
	}
	if !stuStats.MyDormSummary.HasActiveTask || stuStats.MyDormSummary.MyPendingAppeals != 1 {
		t.Fatalf("unexpected myDormSummary flags: %+v", stuStats.MyDormSummary)
	}
}

func openDashboardTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	db, err := gorm.Open(gormsqlite.Open("file:"+uuid.NewString()+"?mode=memory&cache=shared"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		t.Fatalf("open db failed: %v", err)
	}
	return db
}

func strPtr(value string) *string { return &value }

func intPtr(value int) *int { return &value }
