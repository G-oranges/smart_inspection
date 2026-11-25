package service

import (
	"errors"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/my-project/backend-go/internal/model"
	"github.com/my-project/backend-go/internal/repository"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

type appealFixture struct {
	db      *gorm.DB
	service *AppealService
	input   SubmitAppealInput
	version time.Time
}

func appealValue[T any](v T) *T { return &v }

func newAppealFixture(t *testing.T) appealFixture {
	t.Helper()
	db := openDataScopeTestDB(t)
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	sqlDB.SetMaxOpenConns(1)
	t.Cleanup(func() { sqlDB.Close() })
	if err := db.AutoMigrate(&model.Appeal{}, &model.Inspection{}, &model.Student{}, &model.Dormitory{},
		&model.Task{}, &model.Building{}, &model.SystemSettings{}, &model.AuditLog{}); err != nil {
		t.Fatal(err)
	}
	version := time.Now().Add(-2 * time.Hour).Truncate(time.Millisecond)
	rows := []any{
		&model.Dormitory{ID: "dorm", Building: appealValue("南楼"), RoomNo: appealValue("201"), Floor: appealValue(2)},
		&model.Student{ID: "student", FullName: "张三", College: appealValue("学院A"), DormID: appealValue("dorm")},
		&model.Student{ID: "other", FullName: "李四", College: appealValue("学院B"), DormID: appealValue("other-dorm")},
		&model.Inspection{ID: "inspection", DormID: appealValue("dorm"), TotalScore: appealValue(80),
			Detail: datatypes.JSON(`[{"id":"row-a","code":"A","count":2,"locations":["阳台"]}]`), CreatedAt: version, UpdatedAt: version},
		&model.SystemSettings{ID: 1, GradingRules: datatypes.JSON(`[]`), DeductionItems: datatypes.JSON(`[
			{"code":"A","points":3,"maxPoints":9,"enabled":true},
			{"code":"B","points":10,"maxPoints":"20"},
			{"code":"OFF","points":5,"enabled":false}
		]`)},
	}
	for _, row := range rows {
		if err := db.Create(row).Error; err != nil {
			t.Fatal(err)
		}
	}
	return appealFixture{
		db: db, service: NewAppealService(db, repository.NewAppealRepository(db), nil),
		input: SubmitAppealInput{InspectionID: "inspection", StudentID: "student", Content: "请复核阳台检查扣分", DisputedCodes: []string{"A"}}, version: version,
	}
}

func (f appealFixture) submit(t *testing.T) *model.Appeal {
	t.Helper()
	appeal, err := f.service.SubmitAppeal(f.input)
	if err != nil {
		t.Fatal(err)
	}
	return appeal
}

func (f appealFixture) decision(id string) ProcessAppealInput {
	return ProcessAppealInput{ID: id, OperatorID: "reviewer", Status: model.AppealApproved, InspectionVersion: f.version}
}

func TestAppealSubmissionAndWithdraw(t *testing.T) {
	f := newAppealFixture(t)
	wrongDorm := f.input
	wrongDorm.StudentID = "other"
	if _, err := f.service.SubmitAppeal(wrongDorm); !errors.Is(err, ErrAppealForbidden) {
		t.Fatalf("expected forbidden, got %v", err)
	}
	short := f.input
	short.Content = " 太短 "
	if _, err := f.service.SubmitAppeal(short); !errors.Is(err, ErrAppealInvalid) {
		t.Fatalf("expected invalid content, got %v", err)
	}
	if err := f.db.Model(&model.Inspection{}).Where("id = ?", f.input.InspectionID).
		UpdateColumn("createdAt", time.Now().AddDate(0, 0, -8)).Error; err != nil {
		t.Fatal(err)
	}
	if _, err := f.service.SubmitAppeal(f.input); !errors.Is(err, ErrAppealExpired) {
		t.Fatalf("expected expired, got %v", err)
	}
	if err := f.db.Model(&model.SystemSettings{}).Where("id = 1").Update("appealWindowDays", 9).Error; err != nil {
		t.Fatal(err)
	}
	appeal := f.submit(t)
	if appeal.OriginalScore == nil || *appeal.OriginalScore != 80 || !strings.Contains(string(appeal.OriginalDetail), `"points":3`) {
		t.Fatalf("invalid snapshot: %+v", appeal)
	}
	if _, err := f.service.SubmitAppeal(f.input); !errors.Is(err, ErrAppealDuplicate) {
		t.Fatalf("expected duplicate, got %v", err)
	}
	if err := f.service.WithdrawAppeal(appeal.ID, "other"); !errors.Is(err, ErrAppealForbidden) {
		t.Fatalf("expected forbidden, got %v", err)
	}
	if err := f.service.WithdrawAppeal(appeal.ID, "student"); err != nil {
		t.Fatal(err)
	}
	if err := f.service.WithdrawAppeal(appeal.ID, "student"); !errors.Is(err, ErrAppealNotPending) {
		t.Fatalf("expected already withdrawn, got %v", err)
	}
	f.submit(t)
}

func TestAppealConcurrentSubmission(t *testing.T) {
	f := newAppealFixture(t)
	var group sync.WaitGroup
	results := make(chan error, 2)
	for range 2 {
		group.Add(1)
		go func() {
			defer group.Done()
			_, err := f.service.SubmitAppeal(f.input)
			results <- err
		}()
	}
	group.Wait()
	close(results)
	var successes, duplicates int
	for err := range results {
		switch {
		case err == nil:
			successes++
		case errors.Is(err, ErrAppealDuplicate):
			duplicates++
		default:
			t.Fatal(err)
		}
	}
	if successes != 1 || duplicates != 1 {
		t.Fatalf("received %d successes and %d duplicates", successes, duplicates)
	}
}

func TestAppealApproveWithScoreCorrection(t *testing.T) {
	f := newAppealFixture(t)
	appeal := f.submit(t)
	if err := f.db.Model(&model.SystemSettings{}).Where("id = 1").Update("deductionItems", datatypes.JSON(`[{"code":"B","name":"杂物","points":10,"enabled":true}]`)).Error; err != nil {
		t.Fatal(err)
	}
	detail, err := f.service.GetDetail(appeal.ID)
	if err != nil {
		t.Fatal(err)
	}
	deductions, err := f.service.GetDeductions(detail)
	if err != nil || deductions.BaseScore == nil || *deductions.BaseScore != 86 || !deductions.Rows[0].Disputed {
		t.Fatalf("unexpected deduction details: %+v, %v", deductions, err)
	}
	in := f.decision(appeal.ID)
	in.Adjustments = []DeductionAdjustment{{Code: "A", Action: "update", Count: appealValue(1)}, {Code: "B", Action: "add", Count: appealValue(2)}}
	result, err := f.service.ProcessAppeal(in)
	if err != nil {
		t.Fatal(err)
	}
	if result.AdjustedScore == nil || *result.AdjustedScore != 63 || *result.ScoreDelta != -17 || *result.Inspection.TotalScore != 63 {
		t.Fatalf("incorrect adjusted scores: %+v", result)
	}
	if !strings.Contains(*result.Inspection.Comments, "80→63") || result.HandledAt == nil || !result.Inspection.UpdatedAt.After(f.version) || *result.HandledByID != "reviewer" {
		t.Fatalf("missing adjustment metadata: %+v", result)
	}
	rows, err := ParseDeductionRows(result.Inspection.Detail)
	if err != nil || len(rows) != 2 || rows[1].ID == "" || rows[0].Points != nil {
		t.Fatalf("incorrect live rows: %+v (%v)", rows, err)
	}
	if _, err := f.service.ProcessAppeal(in); !errors.Is(err, ErrAppealNotPending) {
		t.Fatalf("expected already processed, got %v", err)
	}
	var log model.AuditLog
	if err := f.db.Where("action = ?", "APPEAL_PROCESS").First(&log).Error; err != nil || !strings.Contains(string(log.NewValue), `"totalScore":63`) {
		t.Fatalf("missing audit entry: %+v (%v)", log, err)
	}
}

func TestAppealRejectVersionAndAuditRollback(t *testing.T) {
	f := newAppealFixture(t)
	appeal := f.submit(t)
	in := f.decision(appeal.ID)
	in.Status = model.AppealRejected
	if _, err := f.service.ProcessAppeal(in); !errors.Is(err, ErrAppealInvalid) {
		t.Fatalf("expected reply validation, got %v", err)
	}
	in.Reply = "结果属实"
	in.InspectionVersion = f.version.Add(time.Minute)
	if _, err := f.service.ProcessAppeal(in); !errors.Is(err, ErrAppealInspectionChanged) {
		t.Fatalf("expected request version conflict, got %v", err)
	}
	in = f.decision(appeal.ID)
	in.Adjustments = []DeductionAdjustment{{Code: "A", Action: "remove"}}
	if err := f.db.Exec(`CREATE TRIGGER fail_appeal_audit BEFORE INSERT ON auditlog BEGIN SELECT RAISE(ABORT,'audit failed'); END`).Error; err != nil {
		t.Fatal(err)
	}
	if _, err := f.service.ProcessAppeal(in); err == nil {
		t.Fatal("expected audit failure")
	}
	detail, err := f.service.GetDetail(appeal.ID)
	if err != nil || detail.Status != model.AppealPending || *detail.Inspection.TotalScore != 80 || !detail.Inspection.UpdatedAt.Equal(f.version) {
		t.Fatalf("transaction did not roll back: %+v (%v)", detail, err)
	}
}

func TestAppealInspectionUpdatesMakePendingAppealStale(t *testing.T) {
	for _, name := range []string{"inspection", "task"} {
		t.Run(name, func(t *testing.T) {
			f := newAppealFixture(t)
			appeal := f.submit(t)
			score := 78
			if name == "inspection" {
				results := NewInspectionService(repository.NewInspectionRepository(f.db))
				if _, err := results.SubmitResult(f.input.InspectionID, UpdateInspectionRequest{TotalScore: &score}, "reviewer"); err != nil {
					t.Fatal(err)
				}
			} else {
				if err := f.db.Model(&model.Inspection{}).Where("id = ?", f.input.InspectionID).UpdateColumn("taskId", "task").Error; err != nil {
					t.Fatal(err)
				}
				tasks := NewTaskService(nil, nil, f.db)
				if err := tasks.SubmitTaskInspection("task", "dorm", "reviewer", score, "", nil, nil); err != nil {
					t.Fatal(err)
				}
			}
			detail, err := f.service.GetDetail(appeal.ID)
			if err != nil || !detail.InspectionChanged {
				t.Fatalf("expected changed inspection: %+v (%v)", detail, err)
			}
			in := f.decision(appeal.ID)
			in.InspectionVersion = detail.Inspection.UpdatedAt
			if _, err := f.service.ProcessAppeal(in); !errors.Is(err, ErrAppealInspectionChanged) {
				t.Fatalf("fresh request must still refuse stale appeal, got %v", err)
			}
		})
	}
}

func TestAppealQueryScopeAndBatch(t *testing.T) {
	f := newAppealFixture(t)
	appeal := f.submit(t)
	for i := range 3 {
		other := model.Appeal{ID: []string{"visible-2", "outside", "legacy"}[i], StudentID: "other", InspectionID: "inspection",
			Content: "historical", Status: model.AppealPending, CreatedAt: time.Now()}
		if i == 1 {
			other.InspectionID = "missing"
		}
		if i == 2 {
			other.StudentID = "student"
		}
		if err := f.db.Create(&other).Error; err != nil {
			t.Fatal(err)
		}
	}
	scope := &ResolvedUserDataScope{
		Academic:  ResolvedAcademicScope{Colleges: map[string]struct{}{"学院A": {}}},
		Dormitory: ResolvedDormitoryScope{Buildings: map[string]struct{}{"南楼": {}}},
	}
	in := f.decision(appeal.ID)
	in.Scope = ApplyAppealScope(scope)
	q := repository.AppealQuery{Page: 2, PageSize: 1, Status: model.AppealPending, Scope: in.Scope}
	rows, total, err := f.service.ListAppeals(q)
	if err != nil || len(rows) != 1 || total != 3 {
		t.Fatalf("scope should apply before pagination, got %d/%d (%v)", len(rows), total, err)
	}
	q.Keyword = "张三"
	_, total, err = f.service.ListAppeals(q)
	if err != nil || total != 2 {
		t.Fatalf("keyword scope count = %d (%v)", total, err)
	}
	q.Keyword = ""
	failed, err := f.service.BatchProcess([]string{appeal.ID, "legacy", "missing-id"}, in)
	if err != nil || len(failed) != 1 || !errors.Is(failed["missing-id"], gorm.ErrRecordNotFound) {
		t.Fatalf("expected two successes and one missing: %+v (%v)", failed, err)
	}
	legacy, err := f.service.GetDetail("legacy")
	if err != nil || legacy.OriginalScore != nil || legacy.Status != model.AppealApproved {
		t.Fatalf("legacy snapshot should remain empty: %+v (%v)", legacy, err)
	}
	if err := f.db.Model(&model.Appeal{}).Where("id = ?", appeal.ID).
		UpdateColumn("handledAt", appeal.CreatedAt.Add(2*time.Hour)).Error; err != nil {
		t.Fatal(err)
	}
	stats, err := f.service.GetStats(q)
	if err != nil || stats.Pending != 1 || stats.Approved != 2 || stats.Total != 3 || stats.AvgHandleHours < 0.99 || stats.AvgHandleHours > 1.01 {
		t.Fatalf("unexpected stats: %+v (%v)", stats, err)
	}
}
