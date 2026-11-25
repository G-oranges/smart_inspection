package service

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/google/uuid"
	"github.com/my-project/backend-go/internal/model"
	"github.com/my-project/backend-go/internal/repository"
	"gorm.io/datatypes"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const DefaultAppealWindowDays = 7

var (
	ErrAppealInvalid           = errors.New("申诉参数无效")
	ErrAppealForbidden         = errors.New("无权操作该申诉或查寝记录")
	ErrAppealDuplicate         = errors.New("该查寝记录已有待处理申诉")
	ErrAppealExpired           = errors.New("已超过申诉时限")
	ErrAppealNotPending        = errors.New("该申诉已处理或撤回")
	ErrAppealInspectionChanged = repository.ErrInspectionChanged
)

type SubmitAppealInput struct {
	InspectionID, StudentID, Content string
	DisputedCodes, Photos            []string
	PhotoUploaderID                  string
	Scope                            *ResolvedUserDataScope
}

type ProcessAppealInput struct {
	ID, Status, Reply, OperatorID string
	InspectionVersion             time.Time
	Adjustments                   []DeductionAdjustment
	Scope                         func(*gorm.DB) *gorm.DB
}

type AppealStats struct {
	Pending        int64   `json:"pending"`
	Approved       int64   `json:"approved"`
	Rejected       int64   `json:"rejected"`
	Withdrawn      int64   `json:"withdrawn"`
	Total          int64   `json:"total"`
	AvgHandleHours float64 `json:"avgHandleHours"`
}

type AppealDeduction struct {
	Code      string   `json:"code"`
	Name      string   `json:"name"`
	Points    *int     `json:"points"`
	Count     int      `json:"count"`
	Locations []string `json:"locations"`
	Disputed  bool     `json:"disputed"`
}

type AppealDeductions struct {
	Rows              []AppealDeduction `json:"rows"`
	BaseScore         *int64            `json:"baseScore"`
	TotalScore        *int              `json:"totalScore"`
	InspectionVersion time.Time         `json:"inspectionVersion"`
}

type AppealService struct {
	db    *gorm.DB
	repo  *repository.AppealRepository
	audit AuditService
}

func NewAppealService(db *gorm.DB, repo *repository.AppealRepository, audit AuditService) *AppealService {
	return &AppealService{db: db, repo: repo, audit: audit}
}

func ApplyAppealScope(scope *ResolvedUserDataScope) func(*gorm.DB) *gorm.DB {
	return func(query *gorm.DB) *gorm.DB {
		if scope == nil || scope.All {
			return query
		}
		students, dorms := appealScopeSubqueries(query, scope)
		return query.Where("(appeal.studentId IN (?) OR inspection.dormId IN (?))", students, dorms)
	}
}

func appealScopeSubqueries(query *gorm.DB, scope *ResolvedUserDataScope) (*gorm.DB, *gorm.DB) {
	base := query.Session(&gorm.Session{NewDB: true})
	// Match the case-sensitive, trimmed values used by the single-record scope check.
	exact := func(column string) string {
		if query.Dialector.Name() == "mysql" {
			return "BINARY TRIM(" + column + ")"
		}
		return "TRIM(" + column + ") COLLATE BINARY"
	}
	academic := base.Where("1 = 0")
	for _, rule := range []struct {
		column string
		values []string
	}{
		{"college", scope.AcademicColleges()}, {"major", scope.AcademicMajors()}, {"className", scope.AcademicClassNames()},
	} {
		if len(rule.values) > 0 {
			academic = academic.Or(exact(rule.column)+" IN ?", rule.values)
		}
	}
	dormitory := base.Where("1 = 0")
	if rules := scope.ToDormitoryScope(); rules != nil {
		if len(rules.DormIDs) > 0 {
			dormitory = dormitory.Or("id IN ?", rules.DormIDs)
		}
		building, room := exact("building"), exact("roomNo")
		if len(rules.Buildings) > 0 {
			dormitory = dormitory.Or(building+" IN ?", rules.Buildings)
		}
		for _, floor := range rules.Floors {
			dormitory = dormitory.Or("("+building+" = ? AND (floor = ? OR (floor IS NULL AND ? = 0 AND "+room+" <> '')))", floor.Building, floor.Floor, floor.Floor)
		}
		for _, rule := range rules.Rooms {
			dormitory = dormitory.Or("("+building+" = ? AND COALESCE(floor, 0) = ? AND "+room+" = ?)", rule.Building, rule.Floor, rule.RoomNo)
		}
	}
	students := base.Model(&model.Student{}).Select("student.id").Where(academic)
	dorms := base.Model(&model.Dormitory{}).Select("dormitory.id").Where(dormitory)
	return students, dorms
}

func appealSettings(db *gorm.DB) (model.SystemSettings, error) {
	settings := model.SystemSettings{AppealWindowDays: DefaultAppealWindowDays}
	err := db.First(&settings).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return settings, nil
	}
	return settings, err
}

func (s *AppealService) SubmitAppeal(in SubmitAppealInput) (*model.Appeal, error) {
	content := strings.TrimSpace(in.Content)
	if n := utf8.RuneCountInString(content); n < 5 || n > 500 {
		return nil, fmt.Errorf("%w: 申诉内容须为 5–500 字", ErrAppealInvalid)
	}
	appeal := model.Appeal{
		ID: uuid.NewString(), InspectionID: in.InspectionID, StudentID: in.StudentID,
		Content: content, Status: model.AppealPending,
	}
	err := s.db.Transaction(func(tx *gorm.DB) error {
		var inspection model.Inspection
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&inspection, "id = ?", in.InspectionID).Error; err != nil {
			return err
		}
		var student model.Student
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&student, "id = ?", in.StudentID).Error; err != nil {
			return err
		}
		if student.DormID == nil || inspection.DormID == nil || *student.DormID != *inspection.DormID {
			return ErrAppealForbidden
		}
		if in.Scope != nil && !in.Scope.All {
			var count int64
			students, dorms := appealScopeSubqueries(tx, in.Scope)
			err := tx.Model(&model.Inspection{}).Where("id = ? AND (? IN (?) OR dormId IN (?))", inspection.ID, student.ID, students, dorms).
				Count(&count).Error
			if err != nil {
				return err
			}
			if count == 0 {
				return ErrAppealForbidden
			}
		}
		if inspection.TotalScore == nil {
			return fmt.Errorf("%w: 查寝记录尚未评分", ErrAppealInvalid)
		}
		repo := repository.NewAppealRepository(tx)
		pending, err := repo.ExistsPending(inspection.ID, student.ID)
		if err != nil {
			return err
		}
		if pending {
			return ErrAppealDuplicate
		}
		settings, err := appealSettings(tx)
		if err != nil {
			return err
		}
		now := time.Now()
		if now.After(inspection.CreatedAt.AddDate(0, 0, settings.AppealWindowDays)) {
			return ErrAppealExpired
		}
		rows, err := ParseDeductionRows(inspection.Detail)
		if err != nil {
			return err
		}
		config, err := deductionConfig(settings.DeductionItems)
		if err != nil {
			return err
		}
		if err := resolveDeductionPoints(rows, nil, config); err != nil {
			return err
		}
		codes := make(map[string]bool, len(rows))
		for _, row := range rows {
			codes[row.Code] = true
		}
		for _, code := range in.DisputedCodes {
			if !codes[code] {
				return fmt.Errorf("%w: 异议扣分项不存在或重复", ErrAppealInvalid)
			}
			delete(codes, code)
		}
		snapshot, err := json.Marshal(rows)
		if err != nil {
			return err
		}
		appeal.CreatedAt = now
		if inspection.UpdatedAt.After(now) {
			appeal.CreatedAt = inspection.UpdatedAt
		}
		appeal.OriginalScore = inspection.TotalScore
		appeal.OriginalInspectionVersion = &inspection.UpdatedAt
		appeal.OriginalDetail = snapshot
		appeal.DisputedCodes, _ = json.Marshal(in.DisputedCodes)
		if len(in.Photos) > 0 {
			appeal.Photos, _ = json.Marshal(in.Photos)
			appeal.PhotoUploaderID = &in.PhotoUploaderID
		}
		return tx.Create(&appeal).Error
	})
	if err != nil {
		return nil, err
	}
	return &appeal, nil
}

func (s *AppealService) ListAppeals(q repository.AppealQuery) ([]model.Appeal, int64, error) {
	return s.repo.FindPage(q)
}

func (s *AppealService) GetStats(q repository.AppealQuery) (AppealStats, error) {
	counts, err := s.repo.CountByStatus(q)
	var stats AppealStats
	var handled int64
	for _, count := range counts {
		stats.Total += count.Count
		switch count.Status {
		case model.AppealPending:
			stats.Pending = count.Count
		case model.AppealApproved:
			stats.Approved = count.Count
		case model.AppealRejected:
			stats.Rejected = count.Count
		case model.AppealWithdrawn:
			stats.Withdrawn = count.Count
		}
		if count.Status == model.AppealApproved || count.Status == model.AppealRejected {
			handled += count.Handled
			stats.AvgHandleHours += count.HandleSeconds
		}
	}
	if handled > 0 {
		stats.AvgHandleHours /= float64(handled) * 3600
	}
	return stats, err
}

func (s *AppealService) GetDetail(id string) (*model.Appeal, error) {
	return s.repo.GetDetail(id)
}

func (s *AppealService) GetDeductions(appeal *model.Appeal) (AppealDeductions, error) {
	result := AppealDeductions{Rows: []AppealDeduction{}, TotalScore: appeal.Inspection.TotalScore, InspectionVersion: appeal.Inspection.UpdatedAt}
	settings, err := appealSettings(s.db)
	if err != nil {
		return result, err
	}
	rows, config, err := appealScoringRows(appeal, &appeal.Inspection, settings.DeductionItems)
	if err != nil {
		return result, err
	}
	var codes []string
	if len(appeal.DisputedCodes) > 0 {
		if err := json.Unmarshal(appeal.DisputedCodes, &codes); err != nil {
			return result, err
		}
	}
	disputed := make(map[string]bool, len(codes))
	for _, code := range codes {
		disputed[code] = true
	}
	for _, row := range rows {
		name := config[row.Code].Name
		if name == "" {
			name = row.Code
		}
		locations := append([]string{}, row.Locations...)
		result.Rows = append(result.Rows, AppealDeduction{
			Code: row.Code, Name: name, Points: row.Points, Count: row.Count,
			Locations: locations, Disputed: disputed[row.Code],
		})
	}
	if result.TotalScore != nil {
		if deductions, err := sumDeduction(rows); err == nil {
			base := int64(*result.TotalScore) + deductions
			result.BaseScore = &base
		}
	}
	return result, nil
}

func appealScoringRows(appeal *model.Appeal, inspection *model.Inspection, rawConfig datatypes.JSON) ([]DeductionRow, map[string]deductionItem, error) {
	config, err := deductionConfig(rawConfig)
	if err != nil {
		return nil, nil, err
	}
	rows, err := ParseDeductionRows(inspection.Detail)
	if err != nil {
		return nil, nil, err
	}
	snapshot, err := ParseDeductionRows(appeal.OriginalDetail)
	if err != nil {
		return nil, nil, err
	}
	return rows, config, resolveDeductionPoints(rows, snapshot, config)
}

func validateAppealDecision(in ProcessAppealInput) error {
	if in.Status != model.AppealApproved && in.Status != model.AppealRejected {
		return fmt.Errorf("%w: 处理状态必须是 approved 或 rejected", ErrAppealInvalid)
	}
	if in.Status == model.AppealRejected && (strings.TrimSpace(in.Reply) == "" || len(in.Adjustments) != 0) {
		return fmt.Errorf("%w: 驳回必须填写回复，扣分修正须为空", ErrAppealInvalid)
	}
	return nil
}

func (s *AppealService) ProcessAppeal(in ProcessAppealInput) (*model.Appeal, error) {
	if err := validateAppealDecision(in); err != nil {
		return nil, err
	}
	if in.InspectionVersion.IsZero() {
		return nil, fmt.Errorf("%w: 缺少查寝记录版本", ErrAppealInvalid)
	}
	var result *model.Appeal
	err := s.db.Transaction(func(tx *gorm.DB) error {
		var appeal model.Appeal
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&appeal, "id = ?", in.ID).Error; err != nil {
			return err
		}
		var inspection model.Inspection
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&inspection, "id = ?", appeal.InspectionID).Error; err != nil {
			return err
		}
		repo := repository.NewAppealRepository(tx)
		allowed, err := repo.InScope(appeal.ID, in.Scope)
		if err != nil {
			return err
		}
		if !allowed {
			return ErrAppealForbidden
		}
		if appeal.Status != model.AppealPending {
			return ErrAppealNotPending
		}
		if repository.AppealInspectionChanged(&appeal, inspection.UpdatedAt) || !inspection.UpdatedAt.Equal(in.InspectionVersion) {
			return ErrAppealInspectionChanged
		}
		before := map[string]any{"status": appeal.Status, "totalScore": inspection.TotalScore, "detail": inspection.Detail}
		reply := strings.TrimSpace(in.Reply)
		now := time.Now()
		if now.Before(appeal.CreatedAt) {
			now = appeal.CreatedAt
		}
		appeal.Status, appeal.Reply = in.Status, &reply
		appeal.HandledByID, appeal.HandledAt = &in.OperatorID, &now
		if in.Status == model.AppealApproved {
			if err := s.approveAppeal(tx, &appeal, &inspection, in); err != nil {
				return err
			}
		}
		if err := tx.Save(&appeal).Error; err != nil {
			return err
		}
		audit := auditService{db: tx}
		if err := audit.write(AuditLogParams{
			Action: "APPEAL_PROCESS", Module: "APPEAL", TargetID: appeal.ID, OperatorID: in.OperatorID,
			OldValue: before,
			NewValue: map[string]any{"status": appeal.Status, "reply": reply, "totalScore": inspection.TotalScore, "detail": inspection.Detail, "adjustments": in.Adjustments},
		}, now, uuid.NewString(), true); err != nil {
			return err
		}
		result, err = repo.GetDetail(appeal.ID)
		return err
	})
	if err != nil {
		return nil, err
	}
	return result, nil
}

func (s *AppealService) approveAppeal(tx *gorm.DB, appeal *model.Appeal, inspection *model.Inspection, in ProcessAppealInput) error {
	appeal.AdjustedScore = inspection.TotalScore
	appeal.AdjustedDetail = inspection.Detail
	if len(appeal.OriginalDetail) != 0 {
		appeal.AdjustedDetail = appeal.OriginalDetail
	}
	if appeal.OriginalScore != nil && inspection.TotalScore != nil {
		delta := *inspection.TotalScore - *appeal.OriginalScore
		appeal.ScoreDelta = &delta
	}
	hasChange := false
	for _, adjustment := range in.Adjustments {
		if adjustment.Action != "keep" {
			hasChange = true
		}
	}
	if len(in.Adjustments) == 0 {
		return nil
	}
	if inspection.TotalScore == nil {
		return fmt.Errorf("%w: 查寝记录尚未评分", ErrAppealInvalid)
	}
	settings, err := appealSettings(tx)
	if err != nil {
		return err
	}
	oldRows, config, err := appealScoringRows(appeal, inspection, settings.DeductionItems)
	if err != nil {
		return err
	}
	rows, err := applyDeductionAdjustments(oldRows, in.Adjustments, config)
	if err != nil || !hasChange {
		return err
	}
	snapshot, err := ParseDeductionRows(appeal.OriginalDetail)
	if err != nil {
		return err
	}
	if err := resolveDeductionPoints(rows, snapshot, config); err != nil {
		return err
	}
	oldDeduction, err := sumDeduction(oldRows)
	if err != nil {
		return err
	}
	newDeduction, err := sumDeduction(rows)
	if err != nil {
		return err
	}
	oldScore := *inspection.TotalScore
	score := int(max(0, min(100, int64(oldScore)+oldDeduction-newDeduction)))
	for i := range rows {
		if rows[i].ID == "" {
			rows[i].ID = uuid.NewString()
		}
	}
	adjustedSnapshot, err := json.Marshal(rows)
	if err != nil {
		return err
	}
	changes := describeAppealAdjustments(oldRows, rows, in.Adjustments)
	for i := range rows {
		rows[i].Points = nil
	}
	detail, err := json.Marshal(rows)
	if err != nil {
		return err
	}
	comment := fmt.Sprintf("[申诉修正] %s，%d→%d", strings.Join(changes, "，"), oldScore, score)
	if inspection.Comments != nil && *inspection.Comments != "" {
		comment = *inspection.Comments + "\n" + comment
	}
	inspection.TotalScore, inspection.Detail = &score, detail
	inspection.Comments, inspection.ReviewedByID = &comment, &in.OperatorID
	if err := repository.UpdateInspectionResult(tx, inspection); err != nil {
		return err
	}
	appeal.AdjustedScore, appeal.AdjustedDetail = &score, adjustedSnapshot
	if appeal.OriginalScore != nil {
		delta := score - *appeal.OriginalScore
		appeal.ScoreDelta = &delta
	}
	return nil
}

func describeAppealAdjustments(oldRows, rows []DeductionRow, adjustments []DeductionAdjustment) []string {
	oldCounts, counts := map[string]int{}, map[string]int{}
	for _, row := range oldRows {
		oldCounts[row.Code] = row.Count
	}
	for _, row := range rows {
		counts[row.Code] = row.Count
	}
	changes := []string{}
	for _, adjustment := range adjustments {
		code := adjustment.Code
		switch adjustment.Action {
		case "add":
			changes = append(changes, fmt.Sprintf("新增 %s×%d", code, counts[code]))
		case "remove":
			changes = append(changes, "撤销 "+code)
		case "update":
			change := fmt.Sprintf("%s %d→%d 次", code, oldCounts[code], counts[code])
			if adjustment.Locations != nil {
				change += "（位置已更新）"
			}
			changes = append(changes, change)
		}
	}
	return changes
}

func (s *AppealService) BatchProcess(ids []string, in ProcessAppealInput) (map[string]error, error) {
	if len(ids) == 0 || len(ids) > 100 || len(in.Adjustments) != 0 {
		return nil, ErrAppealInvalid
	}
	if err := validateAppealDecision(in); err != nil {
		return nil, err
	}
	for _, id := range ids {
		if id == "" {
			return nil, ErrAppealInvalid
		}
	}
	versions, err := s.repo.InspectionVersions(ids)
	if err != nil {
		return nil, err
	}
	failures := make(map[string]error)
	seen := make(map[string]bool, len(ids))
	successes := []string{}
	for _, id := range ids {
		if seen[id] {
			continue
		}
		seen[id] = true
		version, ok := versions[id]
		if !ok {
			failures[id] = gorm.ErrRecordNotFound
			continue
		}
		in.ID, in.InspectionVersion = id, version
		if _, err := s.ProcessAppeal(in); err != nil {
			failures[id] = err
			continue
		}
		successes = append(successes, id)
	}
	if s.audit != nil {
		_ = s.audit.Log(AuditLogParams{
			Action: "APPEAL_BATCH_PROCESS", Module: "APPEAL", OperatorID: in.OperatorID,
			NewValue: map[string]any{"status": in.Status, "ids": ids, "processed": successes, "failedCount": len(failures)},
		})
	}
	return failures, nil
}

func (s *AppealService) WithdrawAppeal(id, studentID string) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		var appeal model.Appeal
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&appeal, "id = ?", id).Error; err != nil {
			return err
		}
		if appeal.StudentID != studentID {
			return ErrAppealForbidden
		}
		if appeal.Status != model.AppealPending {
			return ErrAppealNotPending
		}
		return tx.Model(&appeal).Update("status", model.AppealWithdrawn).Error
	})
}
