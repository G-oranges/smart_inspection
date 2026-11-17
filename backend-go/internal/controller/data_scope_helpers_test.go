package controller

import (
	"fmt"
	"testing"

	gormsqlite "github.com/glebarez/sqlite"
	"github.com/my-project/backend-go/internal/model"
	"github.com/my-project/backend-go/internal/service"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func TestFilterDormBedsByScope(t *testing.T) {
	scope := &service.ResolvedUserDataScope{
		Dormitory: service.ResolvedDormitoryScope{
			Rooms: map[string]map[int]map[string]struct{}{
				"1号楼": {
					3: {"301": {}},
				},
			},
		},
	}

	beds := []model.DormBed{
		{
			ID: "bed-1",
			Dorm: model.Dormitory{
				Building: strPtr("1号楼"),
				Floor:    intPtr(3),
				RoomNo:   strPtr("301"),
			},
		},
		{
			ID: "bed-2",
			Dorm: model.Dormitory{
				Building: strPtr("2号楼"),
				Floor:    intPtr(2),
				RoomNo:   strPtr("201"),
			},
		},
	}

	filtered := filterDormBedsByScope(beds, scope)
	if len(filtered) != 1 || filtered[0].ID != "bed-1" {
		t.Fatalf("expected only visible bed to remain, got %#v", filtered)
	}
}

func TestFilterTaskForScope_TrimsDormRelatedCollections(t *testing.T) {
	scope := &service.ResolvedUserDataScope{
		Dormitory: service.ResolvedDormitoryScope{
			Buildings: map[string]struct{}{"1号楼": {}},
		},
	}

	task := model.Task{
		ID: "task-1",
		Dorms: []model.TaskDorm{
			{DormID: "dorm-1", Dorm: model.Dormitory{Building: strPtr("1号楼"), Floor: intPtr(2), RoomNo: strPtr("201")}},
			{DormID: "dorm-2", Dorm: model.Dormitory{Building: strPtr("2号楼"), Floor: intPtr(3), RoomNo: strPtr("301")}},
		},
		ExecutorDorms: []model.TaskExecutorDorm{
			{DormID: "dorm-1", Dorm: model.Dormitory{Building: strPtr("1号楼"), Floor: intPtr(2), RoomNo: strPtr("201")}},
			{DormID: "dorm-2", Dorm: model.Dormitory{Building: strPtr("2号楼"), Floor: intPtr(3), RoomNo: strPtr("301")}},
		},
		Inspections: []model.Inspection{
			{DormID: strPtr("dorm-1"), Dorm: &model.Dormitory{Building: strPtr("1号楼"), Floor: intPtr(2), RoomNo: strPtr("201")}},
			{DormID: strPtr("dorm-2"), Dorm: &model.Dormitory{Building: strPtr("2号楼"), Floor: intPtr(3), RoomNo: strPtr("301")}},
		},
	}

	trimmed, ok := filterTaskForScope(task, scope)
	if !ok {
		t.Fatalf("expected task to remain visible")
	}
	if len(trimmed.Dorms) != 1 || trimmed.Dorms[0].DormID != "dorm-1" {
		t.Fatalf("expected only visible dorms to remain, got %#v", trimmed.Dorms)
	}
	if len(trimmed.ExecutorDorms) != 1 || trimmed.ExecutorDorms[0].DormID != "dorm-1" {
		t.Fatalf("expected only visible executor dorms to remain, got %#v", trimmed.ExecutorDorms)
	}
	if len(trimmed.Inspections) != 1 || *trimmed.Inspections[0].DormID != "dorm-1" {
		t.Fatalf("expected only visible inspections to remain, got %#v", trimmed.Inspections)
	}
}

func TestFilterAppealsByScope_AllowsAcademicOrDorm(t *testing.T) {
	scope := &service.ResolvedUserDataScope{
		Academic: service.ResolvedAcademicScope{
			Colleges: map[string]struct{}{"计算机学院": {}},
		},
		Dormitory: service.ResolvedDormitoryScope{
			Buildings: map[string]struct{}{"1号楼": {}},
		},
	}

	appeals := []model.Appeal{
		{
			ID: "appeal-academic",
			Student: model.Student{
				College: strPtr("计算机学院"),
			},
		},
		{
			ID: "appeal-dorm",
			Student: model.Student{
				College: strPtr("外国语学院"),
			},
			Inspection: model.Inspection{
				Dorm: &model.Dormitory{
					Building: strPtr("1号楼"),
					Floor:    intPtr(4),
					RoomNo:   strPtr("401"),
				},
			},
		},
		{
			ID: "appeal-hidden",
			Student: model.Student{
				College: strPtr("外国语学院"),
			},
			Inspection: model.Inspection{
				Dorm: &model.Dormitory{
					Building: strPtr("2号楼"),
					Floor:    intPtr(4),
					RoomNo:   strPtr("401"),
				},
			},
		},
	}

	filtered := filterAppealsByScope(appeals, scope)
	if len(filtered) != 2 {
		t.Fatalf("expected two visible appeals, got %#v", filtered)
	}
	if filtered[0].ID != "appeal-academic" || filtered[1].ID != "appeal-dorm" {
		t.Fatalf("unexpected filtered appeal order/content: %#v", filtered)
	}
}

func TestEnsureDormsWritable_DeniesOutOfScopeDorm(t *testing.T) {
	db := newWriteScopeTestDB(t)
	dorms := []model.Dormitory{
		{ID: "dorm-1", Building: strPtr("1号楼"), Floor: intPtr(2), RoomNo: strPtr("201")},
		{ID: "dorm-2", Building: strPtr("2号楼"), Floor: intPtr(2), RoomNo: strPtr("202")},
	}
	if err := db.Create(&dorms).Error; err != nil {
		t.Fatalf("failed to seed dorms: %v", err)
	}

	scope := &service.ResolvedUserDataScope{
		Dormitory: service.ResolvedDormitoryScope{
			Buildings: map[string]struct{}{"1号楼": {}},
		},
	}

	if err := ensureDormsWritable(db, scope, []string{"dorm-1"}, dormWriteScopeMessage); err != nil {
		t.Fatalf("expected visible dorm to pass, got %v", err)
	}
	if err := ensureDormsWritable(db, scope, []string{"dorm-2"}, dormWriteScopeMessage); err == nil {
		t.Fatalf("expected out-of-scope dorm to be rejected")
	}
}

func TestEnsureStudentsWritable_DeniesOutOfScopeStudentOrDorm(t *testing.T) {
	db := newWriteScopeTestDB(t)
	dorm := model.Dormitory{ID: "dorm-1", Building: strPtr("1号楼"), Floor: intPtr(3), RoomNo: strPtr("301")}
	if err := db.Create(&dorm).Error; err != nil {
		t.Fatalf("failed to seed dorm: %v", err)
	}
	students := []model.Student{
		{ID: "student-1", College: strPtr("计算机学院"), DormID: strPtr("dorm-1")},
		{ID: "student-2", College: strPtr("外国语学院")},
	}
	if err := db.Create(&students).Error; err != nil {
		t.Fatalf("failed to seed students: %v", err)
	}

	scope := &service.ResolvedUserDataScope{
		Academic: service.ResolvedAcademicScope{
			Colleges: map[string]struct{}{"计算机学院": {}},
		},
		Dormitory: service.ResolvedDormitoryScope{
			Buildings: map[string]struct{}{"1号楼": {}},
		},
	}

	if err := ensureStudentsWritable(db, scope, []string{"student-1"}, true, studentDormWriteScopeMessage); err != nil {
		t.Fatalf("expected in-scope student to pass, got %v", err)
	}
	if err := ensureStudentsWritable(db, scope, []string{"student-2"}, false, studentDormWriteScopeMessage); err == nil {
		t.Fatalf("expected out-of-scope student to be rejected")
	}
}

func TestEnsureTaskCurrentDormsWritable_DeniesOutOfScopeTaskDorm(t *testing.T) {
	db := newWriteScopeTestDB(t)
	dorms := []model.Dormitory{
		{ID: "dorm-1", Building: strPtr("1号楼"), Floor: intPtr(2), RoomNo: strPtr("201")},
		{ID: "dorm-2", Building: strPtr("2号楼"), Floor: intPtr(2), RoomNo: strPtr("202")},
	}
	if err := db.Create(&dorms).Error; err != nil {
		t.Fatalf("failed to seed dorms: %v", err)
	}
	taskDorms := []model.TaskDorm{
		{ID: "td-1", TaskID: "task-1", DormID: "dorm-1"},
		{ID: "td-2", TaskID: "task-1", DormID: "dorm-2"},
	}
	if err := db.Create(&taskDorms).Error; err != nil {
		t.Fatalf("failed to seed task dorms: %v", err)
	}

	scope := &service.ResolvedUserDataScope{
		Dormitory: service.ResolvedDormitoryScope{
			Buildings: map[string]struct{}{"1号楼": {}},
		},
	}

	if err := ensureTaskCurrentDormsWritable(db, scope, "task-1"); err == nil {
		t.Fatalf("expected task with out-of-scope dorm to be rejected")
	}
}

func TestCollectDormImportScopeIssues_FlagsOutOfScopeRows(t *testing.T) {
	scope := &service.ResolvedUserDataScope{
		Dormitory: service.ResolvedDormitoryScope{
			Buildings: map[string]struct{}{"1号楼": {}},
		},
	}

	building1 := "1号楼"
	building2 := "2号楼"
	room201 := "201"
	room202 := "202"
	floor2 := 2
	rows := []model.DormImportRow{
		{RowNo: 2, Building: &building1, Floor: &floor2, RoomNo: &room201},
		{RowNo: 3, Building: &building2, Floor: &floor2, RoomNo: &room202},
	}

	issues := collectDormImportScopeIssues(scope, rows)
	if len(issues) != 1 {
		t.Fatalf("expected one out-of-scope dorm issue, got %#v", issues)
	}
	if issues[0].RowNo != 3 || issues[0].Reason != dormWriteScopeMessage {
		t.Fatalf("unexpected dorm scope issue: %#v", issues[0])
	}
}

func TestCollectOccupancyImportScopeIssues_FlagsStudentOrDormOutOfScope(t *testing.T) {
	db := newWriteScopeTestDB(t)
	dorms := []model.Dormitory{
		{ID: "dorm-1", Building: strPtr("1号楼"), Floor: intPtr(2), RoomNo: strPtr("201")},
		{ID: "dorm-2", Building: strPtr("2号楼"), Floor: intPtr(2), RoomNo: strPtr("202")},
	}
	if err := db.Create(&dorms).Error; err != nil {
		t.Fatalf("failed to seed dorms: %v", err)
	}
	students := []model.Student{
		{ID: "student-1", StudentNo: strPtr("2024001"), College: strPtr("计算机学院")},
		{ID: "student-2", StudentNo: strPtr("2024002"), College: strPtr("外国语学院")},
	}
	if err := db.Create(&students).Error; err != nil {
		t.Fatalf("failed to seed students: %v", err)
	}

	scope := &service.ResolvedUserDataScope{
		Academic: service.ResolvedAcademicScope{
			Colleges: map[string]struct{}{"计算机学院": {}},
		},
		Dormitory: service.ResolvedDormitoryScope{
			Buildings: map[string]struct{}{"1号楼": {}},
		},
	}

	studentNo1 := "2024001"
	studentNo2 := "2024002"
	building1 := "1号楼"
	building2 := "2号楼"
	room201 := "201"
	room202 := "202"
	bed1 := "1"
	rows := []model.OccupancyImportRow{
		{RowNo: 2, StudentNo: &studentNo1, Building: &building1, RoomNo: &room201, BedNo: &bed1},
		{RowNo: 3, StudentNo: &studentNo2, Building: &building1, RoomNo: &room201, BedNo: &bed1},
		{RowNo: 4, StudentNo: &studentNo1, Building: &building2, RoomNo: &room202, BedNo: &bed1},
	}

	issues, err := collectOccupancyImportScopeIssues(db, scope, rows)
	if err != nil {
		t.Fatalf("expected scope issue collection to succeed, got %v", err)
	}
	if len(issues) != 2 {
		t.Fatalf("expected two out-of-scope occupancy issues, got %#v", issues)
	}
	if issues[0].Reason != studentDormWriteScopeMessage || issues[1].Reason != studentDormWriteScopeMessage {
		t.Fatalf("unexpected occupancy scope issues: %#v", issues)
	}
}

func TestCollectStudentImportScopeIssues_FlagsOutOfScopeRows(t *testing.T) {
	scope := &service.ResolvedUserDataScope{
		Academic: service.ResolvedAcademicScope{
			Colleges: map[string]struct{}{"计算机学院": {}},
		},
	}

	studentNo1 := "2024001"
	studentNo2 := "2024002"
	fullName1 := "张三"
	fullName2 := "李四"
	college1 := "计算机学院"
	college2 := "外国语学院"

	rows := []model.StudentImportRow{
		{RowNo: 2, StudentNo: &studentNo1, FullName: &fullName1, College: &college1},
		{RowNo: 3, StudentNo: &studentNo2, FullName: &fullName2, College: &college2},
	}

	issues := collectStudentImportScopeIssues(scope, rows)
	if len(issues) != 1 {
		t.Fatalf("expected one out-of-scope student import issue, got %#v", issues)
	}
	if issues[0].RowNo != 3 || issues[0].Reason != studentWriteScopeMessage {
		t.Fatalf("unexpected student import scope issue: %#v", issues[0])
	}
}

func newWriteScopeTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", t.Name())
	db, err := gorm.Open(gormsqlite.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		t.Fatalf("failed to open test db: %v", err)
	}

	if err := db.AutoMigrate(&model.Dormitory{}, &model.Student{}, &model.TaskDorm{}); err != nil {
		t.Fatalf("failed to migrate test tables: %v", err)
	}
	return db
}

func strPtr(value string) *string { return &value }

func intPtr(value int) *int { return &value }
