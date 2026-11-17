package controller

import (
	"errors"
	"fmt"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/my-project/backend-go/internal/model"
	"github.com/my-project/backend-go/internal/service"
	"gorm.io/gorm"
)

const (
	dormWriteScopeMessage        = "所选宿舍超出当前数据范围"
	studentWriteScopeMessage     = "所选学生超出当前数据范围"
	studentDormWriteScopeMessage = "所选学生或宿舍超出当前数据范围"
	taskDormWriteScopeMessage    = "所选任务宿舍超出当前数据范围"
	dataScopeDeniedCode          = "DATA_SCOPE_DENIED"
)

func resolveDataScopeForCurrentUser(db *gorm.DB, c *gin.Context) (*service.ResolvedUserDataScope, error) {
	userID, _ := c.Get("userId")
	return service.ResolveUserDataScopeByUserID(db, fmt.Sprintf("%v", userID))
}

func scopeAllowsDormLocation(scope *service.ResolvedUserDataScope, building string, floor int, roomNo string) bool {
	if scope == nil || scope.All {
		return true
	}

	building = strings.TrimSpace(building)
	roomNo = strings.TrimSpace(roomNo)
	if building == "" || roomNo == "" {
		return false
	}
	return scope.AllowsRoom(building, floor, roomNo)
}

func hasDormLocation(building string, roomNo string) bool {
	return strings.TrimSpace(building) != "" && strings.TrimSpace(roomNo) != ""
}

func scopeAllowsDorm(scope *service.ResolvedUserDataScope, dorm *model.Dormitory) bool {
	if scope == nil || scope.All {
		return true
	}
	if dorm == nil {
		return false
	}

	building := strings.TrimSpace(ptrToStr(dorm.Building))
	if building == "" {
		return false
	}

	if dorm.RoomNo != nil && strings.TrimSpace(*dorm.RoomNo) != "" {
		floor := 0
		if dorm.Floor != nil {
			floor = *dorm.Floor
		}
		return scope.AllowsRoom(building, floor, strings.TrimSpace(*dorm.RoomNo))
	}

	if dorm.Floor != nil {
		return scope.AllowsFloor(building, *dorm.Floor)
	}

	return scope.AllowsBuilding(building)
}

func scopeAllowsStudent(scope *service.ResolvedUserDataScope, student *model.Student) bool {
	if scope == nil || scope.All {
		return true
	}
	if student == nil || !scope.HasAcademicAccess() {
		return false
	}

	college := strings.TrimSpace(ptrToStr(student.College))
	if college != "" {
		if _, ok := scope.Academic.Colleges[college]; ok {
			return true
		}
	}

	major := strings.TrimSpace(ptrToStr(student.Major))
	if major != "" {
		if _, ok := scope.Academic.Majors[major]; ok {
			return true
		}
	}

	className := strings.TrimSpace(ptrToStr(student.ClassName))
	if className != "" {
		if _, ok := scope.Academic.ClassNames[className]; ok {
			return true
		}
	}

	return false
}

func ensureStudentPayloadWritable(scope *service.ResolvedUserDataScope, student *model.Student, message string) error {
	if scope == nil || scope.All {
		return nil
	}
	if !scopeAllowsStudent(scope, student) {
		return errors.New(message)
	}
	return nil
}

func collectLegacyStudentImportScopeErrors(scope *service.ResolvedUserDataScope, students []*model.Student) []model.ImportError {
	if scope == nil || scope.All {
		return nil
	}

	errors := make([]model.ImportError, 0)
	for index, student := range students {
		if scopeAllowsStudent(scope, student) {
			continue
		}
		errors = append(errors, model.ImportError{
			Row:       index + 2,
			Field:     "学生",
			ErrorType: dataScopeDeniedCode,
			Reason:    studentWriteScopeMessage,
			Content:   strings.TrimSpace(student.FullName),
		})
	}
	return errors
}

func collectStudentImportScopeIssues(scope *service.ResolvedUserDataScope, rows []model.StudentImportRow) []model.StudentImportIssue {
	if scope == nil || scope.All {
		return nil
	}

	issues := make([]model.StudentImportIssue, 0)
	for index, row := range rows {
		student := &model.Student{
			StudentNo: row.StudentNo,
			FullName:  strings.TrimSpace(ptrToStr(row.FullName)),
			College:   row.College,
			Major:     row.Major,
			ClassName: row.ClassName,
		}
		if scopeAllowsStudent(scope, student) {
			continue
		}
		rowNo := row.RowNo
		if rowNo == 0 {
			rowNo = index + 2
		}
		issues = append(issues, model.StudentImportIssue{
			RowNo:          rowNo,
			ErrorType:      "B",
			ErrorCode:      dataScopeDeniedCode,
			Reason:         studentWriteScopeMessage,
			Suggestion:     "请仅导入当前角色数据范围内的学生记录",
			AffectedFields: []string{"college", "major", "className"},
		})
	}
	return issues
}

func ensureLegacyStudentImportWritable(scope *service.ResolvedUserDataScope, students []*model.Student) error {
	if scope == nil || scope.All {
		return nil
	}
	for _, student := range students {
		if !scopeAllowsStudent(scope, student) {
			return errors.New(studentWriteScopeMessage)
		}
	}
	return nil
}

func ensureStudentImportRowsWritable(scope *service.ResolvedUserDataScope, rows []model.StudentImportRow) error {
	if scope == nil || scope.All {
		return nil
	}
	for _, row := range rows {
		student := &model.Student{
			StudentNo: row.StudentNo,
			FullName:  strings.TrimSpace(ptrToStr(row.FullName)),
			College:   row.College,
			Major:     row.Major,
			ClassName: row.ClassName,
		}
		if !scopeAllowsStudent(scope, student) {
			return errors.New(studentWriteScopeMessage)
		}
	}
	return nil
}

func filterDormBedsByScope(beds []model.DormBed, scope *service.ResolvedUserDataScope) []model.DormBed {
	if scope == nil || scope.All {
		return beds
	}

	filtered := make([]model.DormBed, 0, len(beds))
	for _, bed := range beds {
		if scopeAllowsDorm(scope, &bed.Dorm) {
			filtered = append(filtered, bed)
		}
	}
	return filtered
}

func filterInspectionsByScope(inspections []model.Inspection, scope *service.ResolvedUserDataScope) []model.Inspection {
	if scope == nil || scope.All {
		return inspections
	}

	filtered := make([]model.Inspection, 0, len(inspections))
	for _, inspection := range inspections {
		if scopeAllowsDorm(scope, inspection.Dorm) {
			filtered = append(filtered, inspection)
		}
	}
	return filtered
}

func filterAppealsByScope(appeals []model.Appeal, scope *service.ResolvedUserDataScope) []model.Appeal {
	if scope == nil || scope.All {
		return appeals
	}

	filtered := make([]model.Appeal, 0, len(appeals))
	for _, appeal := range appeals {
		allowStudent := scopeAllowsStudent(scope, &appeal.Student)
		allowDorm := scopeAllowsDorm(scope, appeal.Inspection.Dorm)
		if allowStudent || allowDorm {
			filtered = append(filtered, appeal)
		}
	}
	return filtered
}

func filterTaskForScope(task model.Task, scope *service.ResolvedUserDataScope) (model.Task, bool) {
	if scope == nil || scope.All {
		return task, true
	}

	filteredDorms := make([]model.TaskDorm, 0, len(task.Dorms))
	for _, taskDorm := range task.Dorms {
		if scopeAllowsDorm(scope, &taskDorm.Dorm) {
			filteredDorms = append(filteredDorms, taskDorm)
		}
	}

	filteredExecutorDorms := make([]model.TaskExecutorDorm, 0, len(task.ExecutorDorms))
	for _, assignment := range task.ExecutorDorms {
		if scopeAllowsDorm(scope, &assignment.Dorm) {
			filteredExecutorDorms = append(filteredExecutorDorms, assignment)
		}
	}

	filteredInspections := make([]model.Inspection, 0, len(task.Inspections))
	for _, inspection := range task.Inspections {
		if scopeAllowsDorm(scope, inspection.Dorm) {
			filteredInspections = append(filteredInspections, inspection)
		}
	}

	visible := len(filteredDorms) > 0 || len(filteredExecutorDorms) > 0 || len(filteredInspections) > 0
	if !visible && len(task.Dorms) == 0 && len(task.ExecutorDorms) == 0 && len(task.Inspections) == 0 {
		visible = false
	}
	if !visible {
		return model.Task{}, false
	}

	task.Dorms = filteredDorms
	task.ExecutorDorms = filteredExecutorDorms
	task.Inspections = filteredInspections
	return task, true
}

func filterTasksByScope(tasks []model.Task, scope *service.ResolvedUserDataScope) []model.Task {
	if scope == nil || scope.All {
		return tasks
	}

	filtered := make([]model.Task, 0, len(tasks))
	for _, task := range tasks {
		trimmed, ok := filterTaskForScope(task, scope)
		if ok {
			filtered = append(filtered, trimmed)
		}
	}
	return filtered
}

func paginateRange(page, pageSize, total int) (int, int) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 10
	}

	start := (page - 1) * pageSize
	if start >= total {
		return total, total
	}

	end := start + pageSize
	if end > total {
		end = total
	}
	return start, end
}

func loadDormsByIDs(db *gorm.DB, ids []string) ([]model.Dormitory, error) {
	if len(ids) == 0 {
		return []model.Dormitory{}, nil
	}

	var dorms []model.Dormitory
	if err := db.Select("id", "building", "floor", "roomNo", "campus").Where("id IN ?", ids).Find(&dorms).Error; err != nil {
		return nil, err
	}
	return dorms, nil
}

func ensureDormsWritable(db *gorm.DB, scope *service.ResolvedUserDataScope, ids []string, message string) error {
	if scope == nil || scope.All || len(ids) == 0 {
		return nil
	}

	dorms, err := loadDormsByIDs(db, ids)
	if err != nil {
		return err
	}
	for _, dorm := range dorms {
		if !scopeAllowsDorm(scope, &dorm) {
			return errors.New(message)
		}
	}
	return nil
}

func loadStudentsByIDs(db *gorm.DB, ids []string) ([]model.Student, error) {
	if len(ids) == 0 {
		return []model.Student{}, nil
	}

	var students []model.Student
	if err := db.Preload("Dorm").
		Select("id", "college", "major", "className", "dormId", "building", "roomNo", "bedNo").
		Where("id IN ?", ids).
		Find(&students).Error; err != nil {
		return nil, err
	}
	return students, nil
}

func ensureStudentsWritable(db *gorm.DB, scope *service.ResolvedUserDataScope, ids []string, requireDormWritable bool, message string) error {
	if scope == nil || scope.All || len(ids) == 0 {
		return nil
	}

	students, err := loadStudentsByIDs(db, ids)
	if err != nil {
		return err
	}
	for _, student := range students {
		if !scopeAllowsStudent(scope, &student) {
			return errors.New(message)
		}
		if requireDormWritable && student.DormID != nil && *student.DormID != "" && !scopeAllowsDorm(scope, student.Dorm) {
			return errors.New(message)
		}
	}
	return nil
}

func ensureStudentUpdateWritable(db *gorm.DB, scope *service.ResolvedUserDataScope, studentID string, payload *model.Student, message string) error {
	if scope == nil || scope.All {
		return nil
	}

	var existing model.Student
	if err := db.Select("id", "college", "major", "className").First(&existing, "id = ?", studentID).Error; err != nil {
		return err
	}
	if !scopeAllowsStudent(scope, &existing) {
		return errors.New(message)
	}

	next := existing
	if payload != nil {
		if payload.College != nil {
			next.College = payload.College
		}
		if payload.Major != nil {
			next.Major = payload.Major
		}
		if payload.ClassName != nil {
			next.ClassName = payload.ClassName
		}
	}
	if !scopeAllowsStudent(scope, &next) {
		return errors.New(message)
	}
	return nil
}

func ensureBatchCheckoutDormsWritable(db *gorm.DB, scope *service.ResolvedUserDataScope, dormIDs []string) error {
	if err := ensureDormsWritable(db, scope, dormIDs, dormWriteScopeMessage); err != nil {
		return err
	}
	if scope == nil || scope.All || len(dormIDs) == 0 {
		return nil
	}

	var students []model.Student
	if err := db.Select("id", "college", "major", "className").Where("dormId IN ?", dormIDs).Find(&students).Error; err != nil {
		return err
	}
	for _, student := range students {
		if !scopeAllowsStudent(scope, &student) {
			return errors.New(studentDormWriteScopeMessage)
		}
	}
	return nil
}

func ensureBatchCheckInWritable(db *gorm.DB, scope *service.ResolvedUserDataScope, assignments []service.CheckInAssignment) error {
	if scope == nil || scope.All || len(assignments) == 0 {
		return nil
	}

	studentIDs := make([]string, 0, len(assignments))
	dormIDs := make([]string, 0, len(assignments))
	for _, assignment := range assignments {
		studentIDs = append(studentIDs, assignment.StudentID)
		dormIDs = append(dormIDs, assignment.DormID)
	}

	if err := ensureStudentsWritable(db, scope, studentIDs, false, studentDormWriteScopeMessage); err != nil {
		return err
	}
	if err := ensureDormsWritable(db, scope, dormIDs, studentDormWriteScopeMessage); err != nil {
		return err
	}
	return nil
}

func ensureStudentAndDormWritable(db *gorm.DB, scope *service.ResolvedUserDataScope, studentID string, dormID string) error {
	if err := ensureStudentsWritable(db, scope, []string{studentID}, false, studentDormWriteScopeMessage); err != nil {
		return err
	}
	if err := ensureDormsWritable(db, scope, []string{dormID}, studentDormWriteScopeMessage); err != nil {
		return err
	}
	return nil
}

func ensureMoveWritable(db *gorm.DB, scope *service.ResolvedUserDataScope, studentID string, targetDormID string) error {
	if scope == nil || scope.All {
		return nil
	}

	var student model.Student
	if err := db.Preload("Dorm").
		Select("id", "college", "major", "className", "dormId", "building", "roomNo", "bedNo").
		First(&student, "id = ?", studentID).Error; err != nil {
		return err
	}
	if !scopeAllowsStudent(scope, &student) {
		return errors.New(studentDormWriteScopeMessage)
	}
	if student.DormID != nil && *student.DormID != "" && !scopeAllowsDorm(scope, student.Dorm) {
		return errors.New(studentDormWriteScopeMessage)
	}
	if err := ensureDormsWritable(db, scope, []string{targetDormID}, studentDormWriteScopeMessage); err != nil {
		return err
	}
	return nil
}

func ensureSwapWritable(db *gorm.DB, scope *service.ResolvedUserDataScope, studentIDs []string) error {
	if scope == nil || scope.All {
		return nil
	}

	students, err := loadStudentsByIDs(db, studentIDs)
	if err != nil {
		return err
	}
	for _, student := range students {
		if !scopeAllowsStudent(scope, &student) {
			return errors.New(studentDormWriteScopeMessage)
		}
		if student.DormID != nil && *student.DormID != "" && !scopeAllowsDorm(scope, student.Dorm) {
			return errors.New(studentDormWriteScopeMessage)
		}
	}
	return nil
}

func ensureTaskCurrentDormsWritable(db *gorm.DB, scope *service.ResolvedUserDataScope, taskID string) error {
	if scope == nil || scope.All || strings.TrimSpace(taskID) == "" {
		return nil
	}

	var taskDorms []model.TaskDorm
	if err := db.Preload("Dorm").
		Where("taskId = ?", taskID).
		Find(&taskDorms).Error; err != nil {
		return err
	}
	for _, taskDorm := range taskDorms {
		if !scopeAllowsDorm(scope, &taskDorm.Dorm) {
			return errors.New(taskDormWriteScopeMessage)
		}
	}
	return nil
}

func ensureTaskRequestedDormsWritable(db *gorm.DB, scope *service.ResolvedUserDataScope, dormIDs []string) error {
	return ensureDormsWritable(db, scope, dormIDs, taskDormWriteScopeMessage)
}

func ensureDormLocationsWritable(scope *service.ResolvedUserDataScope, dorms []*model.Dormitory, message string) error {
	if scope == nil || scope.All || len(dorms) == 0 {
		return nil
	}

	for _, dorm := range dorms {
		if dorm == nil {
			continue
		}
		building := strings.TrimSpace(ptrToStr(dorm.Building))
		roomNo := strings.TrimSpace(ptrToStr(dorm.RoomNo))
		if !hasDormLocation(building, roomNo) {
			continue
		}
		floor := 0
		if dorm.Floor != nil {
			floor = *dorm.Floor
		}
		if !scopeAllowsDormLocation(scope, building, floor, roomNo) {
			return errors.New(message)
		}
	}
	return nil
}

func buildDormImportScopeIssue(rowNo int) model.DormImportIssue {
	return model.DormImportIssue{
		RowNo:          rowNo,
		ErrorType:      "B",
		ErrorCode:      dataScopeDeniedCode,
		Reason:         dormWriteScopeMessage,
		Suggestion:     "请移除该行或调整当前角色数据范围",
		AffectedFields: []string{"building", "floor", "roomNo"},
	}
}

func collectDormImportScopeIssues(scope *service.ResolvedUserDataScope, rows []model.DormImportRow) []model.DormImportIssue {
	if scope == nil || scope.All || len(rows) == 0 {
		return nil
	}

	issues := make([]model.DormImportIssue, 0)
	for _, row := range rows {
		building := ""
		if row.Building != nil {
			building = strings.TrimSpace(*row.Building)
		}
		roomNo := ""
		if row.RoomNo != nil {
			roomNo = strings.TrimSpace(*row.RoomNo)
		}
		if !hasDormLocation(building, roomNo) {
			continue
		}
		floor := 0
		if row.Floor != nil {
			floor = *row.Floor
		}
		if !scopeAllowsDormLocation(scope, building, floor, roomNo) {
			issues = append(issues, buildDormImportScopeIssue(row.RowNo))
		}
	}
	return issues
}

func ensureDormImportRowsWritable(scope *service.ResolvedUserDataScope, rows []model.DormImportRow) error {
	if len(collectDormImportScopeIssues(scope, rows)) > 0 {
		return errors.New(dormWriteScopeMessage)
	}
	return nil
}

func collectLegacyDormImportScopeErrors(scope *service.ResolvedUserDataScope, dorms []*model.Dormitory) []model.ImportError {
	if scope == nil || scope.All || len(dorms) == 0 {
		return nil
	}

	errorsList := make([]model.ImportError, 0)
	for index, dorm := range dorms {
		if dorm == nil {
			continue
		}
		building := strings.TrimSpace(ptrToStr(dorm.Building))
		roomNo := strings.TrimSpace(ptrToStr(dorm.RoomNo))
		if !hasDormLocation(building, roomNo) {
			continue
		}
		floor := 0
		if dorm.Floor != nil {
			floor = *dorm.Floor
		}
		if scopeAllowsDormLocation(scope, building, floor, roomNo) {
			continue
		}
		errorsList = append(errorsList, model.ImportError{
			Row:       index + 2,
			Field:     "楼栋/房间号",
			ErrorType: "out_of_scope",
			Reason:    dormWriteScopeMessage,
			Content:   fmt.Sprintf("%s-%s", building, roomNo),
		})
	}
	return errorsList
}

func loadStudentsByStudentNos(db *gorm.DB, studentNos []string) (map[string]model.Student, error) {
	result := make(map[string]model.Student)
	if len(studentNos) == 0 {
		return result, nil
	}

	var students []model.Student
	if err := db.Select("id", "studentNo", "college", "major", "className").
		Where("studentNo IN ?", studentNos).
		Find(&students).Error; err != nil {
		return nil, err
	}
	for _, student := range students {
		key := strings.TrimSpace(ptrToStr(student.StudentNo))
		if key != "" {
			result[key] = student
		}
	}
	return result, nil
}

func loadDormsByBuildingRooms(db *gorm.DB, buildings []string) (map[string]model.Dormitory, error) {
	result := make(map[string]model.Dormitory)
	if len(buildings) == 0 {
		return result, nil
	}

	var dorms []model.Dormitory
	if err := db.Select("id", "building", "floor", "roomNo", "campus").
		Where("building IN ?", buildings).
		Find(&dorms).Error; err != nil {
		return nil, err
	}
	for _, dorm := range dorms {
		building := strings.TrimSpace(ptrToStr(dorm.Building))
		roomNo := strings.TrimSpace(ptrToStr(dorm.RoomNo))
		if hasDormLocation(building, roomNo) {
			result[fmt.Sprintf("%s|%s", building, roomNo)] = dorm
		}
	}
	return result, nil
}

func buildOccupancyImportScopeIssue(rowNo int) model.OccupancyImportIssue {
	return model.OccupancyImportIssue{
		RowNo:          rowNo,
		ErrorType:      "B",
		ErrorCode:      dataScopeDeniedCode,
		Reason:         studentDormWriteScopeMessage,
		Suggestion:     "请移除该行或调整当前角色数据范围",
		AffectedFields: []string{"studentNo", "building", "roomNo", "bedNo"},
	}
}

func collectOccupancyImportScopeIssues(db *gorm.DB, scope *service.ResolvedUserDataScope, rows []model.OccupancyImportRow) ([]model.OccupancyImportIssue, error) {
	if scope == nil || scope.All || len(rows) == 0 {
		return nil, nil
	}

	studentNos := make([]string, 0, len(rows))
	buildings := make([]string, 0, len(rows))
	seenStudentNos := make(map[string]struct{})
	seenBuildings := make(map[string]struct{})
	for _, row := range rows {
		if row.StudentNo != nil {
			studentNo := strings.TrimSpace(*row.StudentNo)
			if studentNo != "" {
				if _, ok := seenStudentNos[studentNo]; !ok {
					studentNos = append(studentNos, studentNo)
					seenStudentNos[studentNo] = struct{}{}
				}
			}
		}
		if row.Building != nil {
			building := strings.TrimSpace(*row.Building)
			if building != "" {
				if _, ok := seenBuildings[building]; !ok {
					buildings = append(buildings, building)
					seenBuildings[building] = struct{}{}
				}
			}
		}
	}

	studentMap, err := loadStudentsByStudentNos(db, studentNos)
	if err != nil {
		return nil, err
	}
	dormMap, err := loadDormsByBuildingRooms(db, buildings)
	if err != nil {
		return nil, err
	}

	issues := make([]model.OccupancyImportIssue, 0)
	for _, row := range rows {
		studentNo := ""
		if row.StudentNo != nil {
			studentNo = strings.TrimSpace(*row.StudentNo)
		}
		building := ""
		if row.Building != nil {
			building = strings.TrimSpace(*row.Building)
		}
		roomNo := ""
		if row.RoomNo != nil {
			roomNo = strings.TrimSpace(*row.RoomNo)
		}
		if studentNo == "" || !hasDormLocation(building, roomNo) {
			continue
		}

		student, studentOk := studentMap[studentNo]
		dorm, dormOk := dormMap[fmt.Sprintf("%s|%s", building, roomNo)]
		if !studentOk || !dormOk {
			continue
		}
		if !scopeAllowsStudent(scope, &student) || !scopeAllowsDorm(scope, &dorm) {
			issues = append(issues, buildOccupancyImportScopeIssue(row.RowNo))
		}
	}
	return issues, nil
}

func ensureOccupancyImportRowsWritable(db *gorm.DB, scope *service.ResolvedUserDataScope, rows []model.OccupancyImportRow) error {
	issues, err := collectOccupancyImportScopeIssues(db, scope, rows)
	if err != nil {
		return err
	}
	if len(issues) > 0 {
		return errors.New(studentDormWriteScopeMessage)
	}
	return nil
}
