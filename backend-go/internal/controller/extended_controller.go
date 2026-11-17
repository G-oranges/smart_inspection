package controller

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/my-project/backend-go/internal/model"
	"github.com/my-project/backend-go/internal/service"
	"github.com/my-project/backend-go/pkg/utils"
	"gorm.io/gorm"
)

var studentSortConfig = utils.SortConfig{
	ValidFields: map[string]string{
		"studentNo":      "student.studentNo",
		"fullName":       "student.fullName",
		"grade":          "student.grade",
		"educationLevel": "student.educationLevel",
		"college":        "student.college",
		"major":          "student.major",
		"className":      "student.className",
		"gender":         "student.gender",
		"status":         "student.status",
		"building":       "student.building",
		"roomNo":         "student.roomNo",
		"bedNo":          "student.bedNo",
	},
	DefaultField: "studentNo",
	DefaultOrder: "ASC",
}

var studentSortableFields = utils.GetSortableFields(studentSortConfig)

var buildingSortConfig = utils.SortConfig{
	ValidFields: map[string]string{
		"name":        "building.name",
		"campus":      "building.campus",
		"type":        "building.`type`",
		"floors":      "building.floors",
		"hasElevator": "building.hasElevator",
		"createdAt":   "building.createdAt",
		"updatedAt":   "building.updatedAt",
	},
	DefaultField: "name",
	DefaultOrder: "ASC",
}

var buildingSortableFields = utils.GetSortableFields(buildingSortConfig)

// StudentController 学生管理控制器
type StudentController struct {
	db      *gorm.DB
	service service.StudentService
}

func NewStudentController(db *gorm.DB, s service.StudentService) *StudentController {
	return &StudentController{db: db, service: s}
}

// GetStudents 获取学生列表（全量，用于下拉）
func (c *StudentController) GetStudents(ctx *gin.Context) {
	userID, _ := ctx.Get("userId")
	scope, err := service.ResolveUserDataScopeByUserID(c.db, fmt.Sprintf("%v", userID))
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"message": "获取数据范围失败"})
		return
	}
	if !scope.All && !scope.HasAcademicAccess() {
		ctx.JSON(http.StatusOK, gin.H{"students": []gin.H{}})
		return
	}

	var students []model.Student
	query := service.ApplyAcademicScopeToStudentQuery(c.db.Model(&model.Student{}), scope)
	// Phase 2: 通过 Bed.Dorm 关联获取住宿信息，而非冗余字段
	if err := query.Preload("Bed.Dorm").Find(&students).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}

	// 格式化输出，确保住宿信息来自关联查询
	result := make([]gin.H, 0, len(students))
	for _, s := range students {
		var building, roomNo, bedNo string
		var dormID *string
		if s.Bed != nil {
			dormID = &s.Bed.DormID
			bedNo = s.Bed.BedNo
			building = ptrToStr(s.Bed.Dorm.Building)
			roomNo = ptrToStr(s.Bed.Dorm.RoomNo)
		}
		result = append(result, gin.H{
			"id":        s.ID,
			"studentNo": s.StudentNo,
			"fullName":  s.FullName,
			"gender":    s.Gender,
			"grade":     s.Grade,
			"dormId":    dormID,
			"building":  building,
			"roomNo":    roomNo,
			"bedNo":     bedNo,
		})
	}
	ctx.JSON(http.StatusOK, gin.H{"students": result})
}

// GetStudentTable 获取学生分页列表
func (c *StudentController) GetStudentTable(ctx *gin.Context) {
	page, _ := strconv.Atoi(ctx.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(ctx.DefaultQuery("pageSize", "10"))
	search := ctx.Query("search")

	// 限制 pageSize
	if pageSize > 100 {
		pageSize = 100
	}
	if pageSize <= 0 {
		pageSize = 10
	}
	if page <= 0 {
		page = 1
	}

	var students []model.Student
	var total int64

	userID, _ := ctx.Get("userId")
	scope, err := service.ResolveUserDataScopeByUserID(c.db, fmt.Sprintf("%v", userID))
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"message": "获取数据范围失败"})
		return
	}
	if !scope.All && !scope.HasAcademicAccess() {
		ctx.JSON(http.StatusOK, gin.H{
			"items":          []gin.H{},
			"total":          0,
			"page":           page,
			"pageSize":       pageSize,
			"sortableFields": studentSortableFields,
		})
		return
	}

	query := service.ApplyAcademicScopeToStudentQuery(c.db.Model(&model.Student{}), scope)

	// 搜索条件
	if search != "" {
		searchPattern := "%" + search + "%"
		query = query.Where("fullName LIKE ? OR studentNo LIKE ?", searchPattern, searchPattern)
	}

	// 筛选条件
	if grade := ctx.QueryArray("grade"); len(grade) > 0 {
		query = query.Where("grade IN ?", grade)
	}
	if gender := ctx.QueryArray("gender"); len(gender) > 0 {
		query = query.Where("gender IN ?", gender)
	}
	if building := ctx.QueryArray("building"); len(building) > 0 {
		// TODO (Phase 4): 此处冗余字段 building 将被删除。
		// 重构方向：需改为 JOIN dormbed ON student.id = dormbed.studentId JOIN dormitory ON dormbed.dormId = dormitory.id
		// 然后通过 dormitory.building 进行筛选。
		query = query.Where("building IN ?", building)
	}

	if college := ctx.QueryArray("college"); len(college) > 0 {
		query = query.Where("college IN ?", college)
	}
	if major := ctx.QueryArray("major"); len(major) > 0 {
		query = query.Where("major IN ?", major)
	}
	if className := ctx.QueryArray("className"); len(className) > 0 {
		query = query.Where("className IN ?", className)
	}
	if roomNo := ctx.QueryArray("roomNo"); len(roomNo) > 0 {
		// TODO (Phase 4): 此处冗余字段 roomNo 将被删除。
		// 重构方向：同 building，需改为联查 dormitory 表进行筛选。
		query = query.Where("roomNo IN ?", roomNo)
	}

	if floor := ctx.QueryArray("floor"); len(floor) > 0 {
		query = query.Joins("JOIN dormitory ON student.dormId = dormitory.id").Where("dormitory.floor IN ?", floor)
	}

	if status := ctx.Query("status"); status != "" {
		switch status {
		case "occupied":
			query = query.Where("student.dormId IS NOT NULL AND student.dormId != ''")
		case "none":
			query = query.Where("student.dormId IS NULL OR student.dormId = ''")
		}
	}

	// 获取总数
	query.Count(&total)

	// 排序
	sortField := ctx.DefaultQuery("sortField", "studentNo")
	sortOrder := ctx.DefaultQuery("sortOrder", "asc")
	orderClause := utils.ValidateSortParams(sortField, sortOrder, studentSortConfig)
	query = query.Order(orderClause)

	// 分页
	offset := (page - 1) * pageSize
	if err := query.Preload("Bed.Dorm").Offset(offset).Limit(pageSize).Find(&students).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}

	// 格式化结果
	items := make([]gin.H, 0, len(students))
	for _, s := range students {
		// 从实时关联中提取住宿信息 (读路径切换)
		var building, roomNo, bedNo string
		var dormID *string
		if s.Bed != nil {
			dormID = &s.Bed.DormID
			bedNo = s.Bed.BedNo
			building = ptrToStr(s.Bed.Dorm.Building)
			roomNo = ptrToStr(s.Bed.Dorm.RoomNo)
		}

		items = append(items, gin.H{
			"id":              s.ID,
			"studentNo":       s.StudentNo,
			"fullName":        s.FullName,
			"gender":          s.Gender,
			"grade":           s.Grade,
			"college":         s.College,
			"major":           s.Major,
			"className":       s.ClassName,
			"educationLevel":  s.EducationLevel,
			"status":          s.Status,
			"phone":           s.Phone,
			"mobile":          s.Mobile,
			"qq":              s.QQ,
			"idType":          s.IDType,
			"idNumber":        s.IDNumber,
			"politicalStatus": s.PoliticalStatus,
			"ethnicity":       s.Ethnicity,
			"nativePlace":     s.NativePlace,
			"homeAddress":     s.HomeAddress,
			"dormId":          dormID,
			"dormBuilding":    building,
			"dormRoomNo":      roomNo,
			"bedNo":           bedNo,
			"isMonitor":       s.IsMonitor,
			"building":        building,
			"roomNo":          roomNo,
		})
	}

	ctx.JSON(http.StatusOK, gin.H{
		"items":          items,
		"total":          total,
		"page":           page,
		"pageSize":       pageSize,
		"sortableFields": studentSortableFields,
	})
}

// CreateStudent 创建学生
func (c *StudentController) CreateStudent(ctx *gin.Context) {
	var student model.Student
	if err := ctx.ShouldBindJSON(&student); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"message": "无效的请求数据"})
		return
	}
	scope, err := service.ResolveUserDataScopeByUserID(c.db, fmt.Sprintf("%v", ctx.MustGet("userId")))
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"message": "获取数据范围失败"})
		return
	}
	if err := ensureStudentPayloadWritable(scope, &student, studentWriteScopeMessage); err != nil {
		ctx.JSON(http.StatusForbidden, gin.H{"message": err.Error()})
		return
	}

	if err := c.service.CreateStudent(&student); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"message": "创建学生失败: " + err.Error()})
		return
	}

	// 记录审计日志
	operatorID, _ := ctx.Get("userId")
	operatorName, _ := ctx.Get("fullName")
	service.LogAudit(service.AuditLogParams{
		Action:       service.AuditActionCreate,
		Module:       service.AuditModuleStudent,
		TargetID:     student.ID,
		TargetName:   student.FullName,
		Description:  fmt.Sprintf("创建学生 %s (学号: %s)", student.FullName, ptrToStr(student.StudentNo)),
		NewValue:     map[string]interface{}{"studentNo": student.StudentNo, "fullName": student.FullName},
		OperatorID:   fmt.Sprintf("%v", operatorID),
		OperatorName: fmt.Sprintf("%v", operatorName),
		IPAddress:    ctx.ClientIP(),
	})

	ctx.JSON(http.StatusCreated, student)
}

// UpdateStudent 更新学生
func (c *StudentController) UpdateStudent(ctx *gin.Context) {
	id := ctx.Param("id")
	var student model.Student
	if err := ctx.ShouldBindJSON(&student); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"message": "无效的请求数据"})
		return
	}
	scope, err := service.ResolveUserDataScopeByUserID(c.db, fmt.Sprintf("%v", ctx.MustGet("userId")))
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"message": "获取数据范围失败"})
		return
	}
	if err := ensureStudentUpdateWritable(c.db, scope, id, &student, studentWriteScopeMessage); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			ctx.JSON(http.StatusNotFound, gin.H{"message": "学生不存在"})
			return
		}
		ctx.JSON(http.StatusForbidden, gin.H{"message": err.Error()})
		return
	}

	if err := c.service.UpdateStudent(id, &student); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"message": "更新学生失败: " + err.Error()})
		return
	}

	// 记录更新审计日志
	operatorID, _ := ctx.Get("userId")
	operatorName, _ := ctx.Get("fullName")
	service.LogAudit(service.AuditLogParams{
		Action:       service.AuditActionUpdate,
		Module:       service.AuditModuleStudent,
		TargetID:     id,
		TargetName:   student.FullName,
		Description:  fmt.Sprintf("更新学生 %s 的信息", student.FullName),
		OperatorID:   fmt.Sprintf("%v", operatorID),
		OperatorName: fmt.Sprintf("%v", operatorName),
		IPAddress:    ctx.ClientIP(),
	})

	ctx.JSON(http.StatusOK, gin.H{"message": "更新成功"})
}

// DeleteStudents 批量删除学生（支持 ids 列表或 filter 筛选条件）
func (c *StudentController) DeleteStudents(ctx *gin.Context) {
	var req struct {
		Ids    []string               `json:"ids"`
		Filter map[string]interface{} `json:"filter"`
	}
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"message": "无效的请求数据"})
		return
	}

	var targetIds []string

	if len(req.Ids) > 0 {
		// 使用提供的 ID 列表
		targetIds = req.Ids
	} else if len(req.Filter) > 0 {
		// 根据筛选条件查询 ID
		ids, err := c.resolveStudentIdsByFilter(req.Filter)
		if err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"message": "筛选条件解析失败: " + err.Error()})
			return
		}
		targetIds = ids
	} else {
		ctx.JSON(http.StatusBadRequest, gin.H{"message": "请提供学生ID或筛选条件"})
		return
	}

	if len(targetIds) == 0 {
		ctx.JSON(http.StatusOK, gin.H{"message": "没有匹配的学生", "deleted": 0})
		return
	}
	scope, err := service.ResolveUserDataScopeByUserID(c.db, fmt.Sprintf("%v", ctx.MustGet("userId")))
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"message": "获取数据范围失败"})
		return
	}
	if err := ensureStudentsWritable(c.db, scope, targetIds, false, studentWriteScopeMessage); err != nil {
		ctx.JSON(http.StatusForbidden, gin.H{"message": err.Error()})
		return
	}

	if err := c.service.DeleteStudents(targetIds); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"message": "删除学生失败: " + err.Error()})
		return
	}

	// 记录删除审计日志
	operatorID, _ := ctx.Get("userId")
	operatorName, _ := ctx.Get("fullName")
	service.LogAudit(service.AuditLogParams{
		Action:       service.AuditActionDelete,
		Module:       service.AuditModuleStudent,
		Description:  fmt.Sprintf("批量删除 %d 个学生", len(targetIds)),
		NewValue:     map[string]interface{}{"deletedCount": len(targetIds)},
		OperatorID:   fmt.Sprintf("%v", operatorID),
		OperatorName: fmt.Sprintf("%v", operatorName),
		IPAddress:    ctx.ClientIP(),
	})

	ctx.JSON(http.StatusOK, gin.H{"message": "删除成功", "deleted": len(targetIds)})
}

// resolveStudentIdsByFilter 根据筛选条件获取学生 ID 列表
func (c *StudentController) resolveStudentIdsByFilter(filter map[string]interface{}) ([]string, error) {
	query := c.db.Model(&model.Student{}).Select("id")

	// 防止空筛选条件导致全表删除
	if len(filter) == 0 {
		return nil, fmt.Errorf("筛选条件不能为空，以防止误删所有学生")
	}

	// 年级筛选
	if grade, ok := filter["grade"].(string); ok && grade != "" {
		query = query.Where("grade = ?", grade)
	}

	// 性别筛选
	if gender, ok := filter["gender"].(string); ok && gender != "" {
		query = query.Where("gender = ?", gender)
	}

	// 楼栋筛选
	if building, ok := filter["building"].(string); ok && building != "" {
		query = query.Where("dormBuilding = ?", building)
	}

	// 学院筛选
	if college, ok := filter["college"].(string); ok && college != "" {
		query = query.Where("college = ?", college)
	}

	// 班级筛选
	if className, ok := filter["className"].(string); ok && className != "" {
		query = query.Where("className = ?", className)
	}

	// 关键字搜索
	if keyword, ok := filter["search"].(string); ok && keyword != "" {
		searchPattern := "%" + keyword + "%"
		query = query.Where("(studentNo LIKE ? OR fullName LIKE ? OR dormBuilding LIKE ? OR dormRoomNo LIKE ?)",
			searchPattern, searchPattern, searchPattern, searchPattern)
	}

	var ids []string
	if err := query.Pluck("id", &ids).Error; err != nil {
		return nil, err
	}

	return ids, nil
}

// GetMe 获取当前登录学生信息
func (c *StudentController) GetMe(ctx *gin.Context) {
	userId, _ := ctx.Get("userId")
	userIdStr := userId.(string)

	var student model.Student
	// Phase 2: 通过 Bed.Dorm 关联获取住宿信息
	if err := c.db.Preload("Bed.Dorm").Where("userId = ?", userIdStr).First(&student).Error; err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"message": "未找到学生信息"})
		return
	}

	// 格式化输出，确保住宿信息来自关联查询
	var building, roomNo, bedNo string
	var dormID *string
	if student.Bed != nil {
		dormID = &student.Bed.DormID
		bedNo = student.Bed.BedNo
		building = ptrToStr(student.Bed.Dorm.Building)
		roomNo = ptrToStr(student.Bed.Dorm.RoomNo)
	}

	ctx.JSON(http.StatusOK, gin.H{
		"id":              student.ID,
		"studentNo":       student.StudentNo,
		"fullName":        student.FullName,
		"gender":          student.Gender,
		"grade":           student.Grade,
		"college":         student.College,
		"major":           student.Major,
		"className":       student.ClassName,
		"educationLevel":  student.EducationLevel,
		"status":          student.Status,
		"mobile":          student.Mobile,
		"phone":           student.Phone,
		"qq":              student.QQ,
		"idType":          student.IDType,
		"idNumber":        student.IDNumber,
		"politicalStatus": student.PoliticalStatus,
		"birthDate":       student.BirthDate,
		"ethnicity":       student.Ethnicity,
		"nativePlace":     student.NativePlace,
		"sourcePlace":     student.SourcePlace,
		"homeAddress":     student.HomeAddress,
		"isMonitor":       student.IsMonitor,
		"dormId":          dormID,
		"building":        building,
		"roomNo":          roomNo,
		"bedNo":           bedNo,
		"createdAt":       student.CreatedAt,
	})
}

// UpdateMyContact 学生更新联系方式
// 同时更新 Student 表和 User 表，确保数据一致性
func (c *StudentController) UpdateMyContact(ctx *gin.Context) {
	userId, _ := ctx.Get("userId")
	userIdStr := userId.(string)

	// 检查系统设置是否允许学生编辑联系方式
	var settings model.SystemSettings
	if err := c.db.First(&settings).Error; err == nil {
		if !settings.StudentContactEditable {
			ctx.JSON(http.StatusForbidden, gin.H{"message": "系统当前不允许学生自行修改联系方式"})
			return
		}
	}

	var req struct {
		Mobile string `json:"mobile"`
		Phone  string `json:"phone"`
		QQ     string `json:"qq"`
	}
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"message": "无效的请求数据"})
		return
	}

	// 使用事务同时更新 Student 表和 User 表
	tx := c.db.Begin()

	// 1. 更新 Student 表
	if err := tx.Model(&model.Student{}).Where("userId = ?", userIdStr).Updates(map[string]interface{}{
		"mobile": req.Mobile,
		"phone":  req.Phone,
		"qq":     req.QQ,
	}).Error; err != nil {
		tx.Rollback()
		ctx.JSON(http.StatusInternalServerError, gin.H{"message": "更新联系方式失败"})
		return
	}

	// 2. 同步更新 User 表的 phone 字段（优先使用 phone，其次 mobile）
	userPhone := req.Phone
	if userPhone == "" {
		userPhone = req.Mobile
	}
	if userPhone != "" {
		if err := tx.Model(&model.User{}).Where("id = ?", userIdStr).Update("phone", userPhone).Error; err != nil {
			tx.Rollback()
			ctx.JSON(http.StatusInternalServerError, gin.H{"message": "同步用户联系方式失败"})
			return
		}
	}

	tx.Commit()
	ctx.JSON(http.StatusOK, gin.H{"message": "更新成功"})
}

// BatchMonitor 批量设置寝室长
func (c *StudentController) BatchMonitor(ctx *gin.Context) {
	var req struct {
		StudentIds      []string `json:"studentIds"`
		ReplaceExisting *bool    `json:"replaceExisting"`
	}
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"message": "无效的请求数据"})
		return
	}
	scope, err := service.ResolveUserDataScopeByUserID(c.db, fmt.Sprintf("%v", ctx.MustGet("userId")))
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"message": "获取数据范围失败"})
		return
	}
	if err := ensureStudentsWritable(c.db, scope, req.StudentIds, true, studentDormWriteScopeMessage); err != nil {
		ctx.JSON(http.StatusForbidden, gin.H{"message": err.Error()})
		return
	}

	result, err := c.service.BatchMonitor(req.StudentIds, req.ReplaceExisting)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"message": "设置寝室长失败: " + err.Error()})
		return
	}

	// 如果只是检测冲突，不记录审计日志
	if req.ReplaceExisting == nil {
		ctx.JSON(http.StatusOK, result)
		return
	}

	// 记录审计日志
	operatorID, _ := ctx.Get("userId")
	operatorName, _ := ctx.Get("fullName")
	service.LogAudit(service.AuditLogParams{
		Action:      service.AuditActionUpdate,
		Module:      service.AuditModuleStudent,
		Description: fmt.Sprintf("批量设置寝室长：设置 %d 人，撤销 %d 人", result.SetCount, result.RevokeCount),
		NewValue: map[string]interface{}{
			"setCount":    result.SetCount,
			"revokeCount": result.RevokeCount,
		},
		OperatorID:   fmt.Sprintf("%v", operatorID),
		OperatorName: fmt.Sprintf("%v", operatorName),
		IPAddress:    ctx.ClientIP(),
	})

	ctx.JSON(http.StatusOK, gin.H{
		"success":     true,
		"setCount":    result.SetCount,
		"revokeCount": result.RevokeCount,
		"message":     fmt.Sprintf("已设置 %d 名寝室长", result.SetCount) + map[bool]string{true: fmt.Sprintf("，撤销 %d 名原寝室长", result.RevokeCount), false: ""}[result.RevokeCount > 0],
	})
}

// ImportStudents 导入学生
// PreviewImportStudents 预览学生导入
func (c *StudentController) PreviewImportStudents(ctx *gin.Context) {
	file, err := ctx.FormFile("file")
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"message": "未接收到上传文件"})
		return
	}

	src, err := file.Open()
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"message": "无法打开上传文件"})
		return
	}
	defer src.Close()

	fileBytes, _ := io.ReadAll(src)
	rows, err := utils.ParseExcelFromBytes(fileBytes)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"message": "解析 Excel 失败: " + err.Error()})
		return
	}

	result, err := c.service.PreviewImport(rows)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"message": "预检失败: " + err.Error()})
		return
	}

	scope, err := service.ResolveUserDataScopeByUserID(c.db, fmt.Sprintf("%v", ctx.MustGet("userId")))
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"message": "获取数据范围失败"})
		return
	}
	scopeErrors := collectLegacyStudentImportScopeErrors(scope, buildLegacyImportStudents(rows))
	if len(scopeErrors) > 0 {
		result.InvalidItems = append(result.InvalidItems, scopeErrors...)
		result.InvalidCount += len(scopeErrors)
	}

	ctx.JSON(http.StatusOK, result)
}

// ImportStudents 导入学生
func (c *StudentController) ImportStudents(ctx *gin.Context) {
	resolution := ctx.DefaultQuery("resolution", "overwrite") // 获取决策参数
	file, err := ctx.FormFile("file")
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"message": "未接收到上传文件"})
		return
	}

	// 打开上传的文件
	src, err := file.Open()
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"message": "无法打开上传文件"})
		return
	}
	defer src.Close()

	// 读取文件内容
	fileBytes := make([]byte, file.Size)
	if _, err := src.Read(fileBytes); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"message": "读取文件失败"})
		return
	}

	// 解析 Excel
	rows, err := utils.ParseExcelFromBytes(fileBytes)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
		return
	}

	successCount := 0
	failedCount := 0
	students := make([]*model.Student, 0, len(rows))

	// 定义列名映射（支持多语言表头）
	columnMappings := map[string][]string{
		"studentNo":       {"studentNo", "StudentNo", "学号", "學號"},
		"fullName":        {"fullName", "FullName", "姓名"},
		"grade":           {"grade", "Grade", "年级"},
		"gender":          {"gender", "Gender", "性别"},
		"college":         {"college", "学院"},
		"major":           {"major", "专业"},
		"className":       {"className", "班级"},
		"phone":           {"phone", "Phone", "联系电话", "联系方式"},
		"mobile":          {"mobile", "手机号", "移动电话"},
		"building":        {"building", "Building", "宿舍楼栋", "楼栋"},
		"roomNo":          {"roomNo", "RoomNo", "宿舍号", "宿舍房间"},
		"bedNo":           {"bedNo", "BedNo", "床位号"},
		"educationLevel":  {"educationLevel", "EducationLevel", "学历层次", "培养层次"},
		"status":          {"status", "Status", "学籍状态"},
		"idType":          {"idType", "IDType", "证件类型"},
		"idNumber":        {"idNumber", "IDNumber", "证件号码"},
		"politicalStatus": {"politicalStatus", "PoliticalStatus", "政治面貌"},
		"ethnicity":       {"ethnicity", "Ethnicity", "民族"},
		"nativePlace":     {"nativePlace", "NativePlace", "籍贯"},
		"sourcePlace":     {"sourcePlace", "SourcePlace", "生源地"},
		"homeAddress":     {"homeAddress", "HomeAddress", "家庭住址"},
		"qq":              {"qq", "QQ", "QQ号"},
	}

	for _, row := range rows {
		student := model.Student{
			ID:       uuid.New().String(),
			FullName: utils.GetValueFromRow(row, columnMappings["fullName"]),
		}
		if sno := utils.GetValueFromRow(row, columnMappings["studentNo"]); sno != "" {
			student.StudentNo = &sno
		}
		if grade := utils.GetValueFromRow(row, columnMappings["grade"]); grade != "" {
			student.Grade = &grade
		}
		if gender := utils.GetValueFromRow(row, columnMappings["gender"]); gender != "" {
			student.Gender = &gender
		}
		if college := utils.GetValueFromRow(row, columnMappings["college"]); college != "" {
			student.College = &college
		}
		if major := utils.GetValueFromRow(row, columnMappings["major"]); major != "" {
			student.Major = &major
		}
		if className := utils.GetValueFromRow(row, columnMappings["className"]); className != "" {
			student.ClassName = &className
		}
		if phone := utils.GetValueFromRow(row, columnMappings["phone"]); phone != "" {
			student.Phone = &phone
		}
		if mobile := utils.GetValueFromRow(row, columnMappings["mobile"]); mobile != "" {
			student.Mobile = &mobile
		}
		if building := utils.GetValueFromRow(row, columnMappings["building"]); building != "" {
			student.DormBuilding = &building
		}
		if roomNo := utils.GetValueFromRow(row, columnMappings["roomNo"]); roomNo != "" {
			student.DormRoomNo = &roomNo
		}
		if bedNo := utils.GetValueFromRow(row, columnMappings["bedNo"]); bedNo != "" {
			student.BedNo = &bedNo
		}
		if eduLevel := utils.GetValueFromRow(row, columnMappings["educationLevel"]); eduLevel != "" {
			student.EducationLevel = &eduLevel
		}
		if status := utils.GetValueFromRow(row, columnMappings["status"]); status != "" {
			student.Status = &status
		}
		if idType := utils.GetValueFromRow(row, columnMappings["idType"]); idType != "" {
			student.IDType = &idType
		}
		if idNumber := utils.GetValueFromRow(row, columnMappings["idNumber"]); idNumber != "" {
			student.IDNumber = &idNumber
		}
		if polStatus := utils.GetValueFromRow(row, columnMappings["politicalStatus"]); polStatus != "" {
			student.PoliticalStatus = &polStatus
		}
		if ethnicity := utils.GetValueFromRow(row, columnMappings["ethnicity"]); ethnicity != "" {
			student.Ethnicity = &ethnicity
		}
		if nativePlace := utils.GetValueFromRow(row, columnMappings["nativePlace"]); nativePlace != "" {
			student.NativePlace = &nativePlace
		}
		if sourcePlace := utils.GetValueFromRow(row, columnMappings["sourcePlace"]); sourcePlace != "" {
			student.SourcePlace = &sourcePlace
		}
		if homeAddress := utils.GetValueFromRow(row, columnMappings["homeAddress"]); homeAddress != "" {
			student.HomeAddress = &homeAddress
		}
		if qq := utils.GetValueFromRow(row, columnMappings["qq"]); qq != "" {
			student.QQ = &qq
		}

		// 验证必填字段
		if student.FullName == "" {
			failedCount++
			continue
		}

		students = append(students, &student)
	}

	// 批量导入（支持冲突策略）
	if len(students) > 0 {
		scope, err := service.ResolveUserDataScopeByUserID(c.db, fmt.Sprintf("%v", ctx.MustGet("userId")))
		if err != nil {
			ctx.JSON(http.StatusInternalServerError, gin.H{"message": "获取数据范围失败"})
			return
		}
		if err := ensureLegacyStudentImportWritable(scope, students); err != nil {
			ctx.JSON(http.StatusForbidden, gin.H{"message": err.Error()})
			return
		}
		success, failed, err := c.service.BatchImport(students, resolution)
		if err != nil {
			ctx.JSON(http.StatusInternalServerError, gin.H{"message": "批量导入失败: " + err.Error()})
			return
		}
		successCount = success
		failedCount += failed
	}

	// 记录审计日志
	operatorID, _ := ctx.Get("userId")
	operatorName, _ := ctx.Get("fullName")
	service.LogAudit(service.AuditLogParams{
		Action:       service.AuditActionImport,
		Module:       service.AuditModuleStudent,
		Description:  fmt.Sprintf("导入学生数据，成功 %d 条，失败 %d 条", successCount, failedCount),
		NewValue:     map[string]interface{}{"successCount": successCount, "failedCount": failedCount},
		OperatorID:   fmt.Sprintf("%v", operatorID),
		OperatorName: fmt.Sprintf("%v", operatorName),
		IPAddress:    ctx.ClientIP(),
	})

	ctx.JSON(http.StatusOK, gin.H{
		"successCount": successCount,
		"failedCount":  failedCount,
		"message":      fmt.Sprintf("导入完成：成功 %d 条，失败 %d 条", successCount, failedCount),
	})
}

// ExportStudents 导出学生
func (c *StudentController) ExportStudents(ctx *gin.Context) {
	userID, _ := ctx.Get("userId")
	scope, err := service.ResolveUserDataScopeByUserID(c.db, fmt.Sprintf("%v", userID))
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"message": "获取数据范围失败"})
		return
	}

	var students []model.Student
	query := c.db.Model(&model.Student{})
	if !scope.All {
		if !scope.HasAcademicAccess() {
			students = []model.Student{}
		} else {
			query = service.ApplyAcademicScopeToStudentQuery(query, scope)
			if err := query.Preload("Bed.Dorm").Find(&students).Error; err != nil {
				ctx.JSON(http.StatusInternalServerError, gin.H{"message": "导出失败"})
				return
			}
		}
	} else if err := query.Preload("Bed.Dorm").Find(&students).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"message": "导出失败"})
		return
	}

	// 定义导出列
	columns := []utils.ExcelColumn{
		{Header: "学号", Field: "studentNo", Width: 15},
		{Header: "姓名", Field: "fullName", Width: 12},
		{Header: "性别", Field: "gender", Width: 8},
		{Header: "年级", Field: "grade", Width: 10},
		{Header: "学院", Field: "college", Width: 20},
		{Header: "专业", Field: "major", Width: 20},
		{Header: "班级", Field: "className", Width: 15},
		{Header: "联系电话", Field: "phone", Width: 15},
		{Header: "楼栋", Field: "building", Width: 12},
		{Header: "宿舍号", Field: "roomNo", Width: 10},
		{Header: "床位号", Field: "bedNo", Width: 8},
		{Header: "是否寝室长", Field: "isMonitor", Width: 12},
	}

	// 转换数据为 map
	data := make([]map[string]interface{}, 0, len(students))
	for _, s := range students {
		var building, roomNo, bedNo string
		if s.Bed != nil {
			bedNo = s.Bed.BedNo
			building = ptrToStr(s.Bed.Dorm.Building)
			roomNo = ptrToStr(s.Bed.Dorm.RoomNo)
		}

		row := map[string]interface{}{
			"studentNo": ptrToStr(s.StudentNo),
			"fullName":  s.FullName,
			"gender":    ptrToStr(s.Gender),
			"grade":     ptrToStr(s.Grade),
			"college":   ptrToStr(s.College),
			"major":     ptrToStr(s.Major),
			"className": ptrToStr(s.ClassName),
			"phone":     ptrToStr(s.Phone),
			"building":  building,
			"roomNo":    roomNo,
			"bedNo":     bedNo,
			"isMonitor": s.IsMonitor,
		}
		data = append(data, row)
	}

	// 创建 Excel 文件
	excelFile, err := utils.CreateExcelFromMaps(data, columns, "学生信息")
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"message": "生成 Excel 失败"})
		return
	}

	// 发送 Excel 响应
	if err := utils.SendExcelResponse(ctx, excelFile, "students"); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"message": "发送文件失败"})
		return
	}
}

// GetFilterOptions 获取学生筛选选项（学院、专业、班级、年级去重列表）
// 用于前端级联筛选器，避免加载全量学生数据
func (c *StudentController) GetFilterOptions(ctx *gin.Context) {
	type MajorOption struct {
		Name    string `json:"name"`
		College string `json:"college"`
	}
	type ClassOption struct {
		Name  string `json:"name"`
		Major string `json:"major"`
	}

	userID, _ := ctx.Get("userId")
	scope, err := service.ResolveUserDataScopeByUserID(c.db, fmt.Sprintf("%v", userID))
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"message": "获取数据范围失败"})
		return
	}
	if !scope.All && !scope.HasAcademicAccess() {
		ctx.JSON(http.StatusOK, gin.H{
			"colleges":   []string{},
			"majors":     []MajorOption{},
			"classNames": []ClassOption{},
			"grades":     []string{},
		})
		return
	}

	// 查询去重的学院列表
	var colleges []string
	if err := service.ApplyAcademicScopeToStudentQuery(c.db.Model(&model.Student{}), scope).
		Distinct("college").
		Where("college IS NOT NULL AND college != ''").
		Order("college ASC").
		Pluck("college", &colleges).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"message": "获取学院列表失败"})
		return
	}

	// 查询专业列表（带学院关联）
	var majorRows []struct {
		Major   string `gorm:"column:major"`
		College string `gorm:"column:college"`
	}
	if err := service.ApplyAcademicScopeToStudentQuery(c.db.Model(&model.Student{}), scope).
		Select("DISTINCT major, college").
		Where("major IS NOT NULL AND major != ''").
		Order("college ASC, major ASC").
		Find(&majorRows).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"message": "获取专业列表失败"})
		return
	}
	majors := make([]MajorOption, 0, len(majorRows))
	for _, row := range majorRows {
		majors = append(majors, MajorOption{
			Name:    row.Major,
			College: row.College,
		})
	}

	// 查询班级列表（带专业关联）
	var classRows []struct {
		ClassName string `gorm:"column:className"`
		Major     string `gorm:"column:major"`
	}
	if err := service.ApplyAcademicScopeToStudentQuery(c.db.Model(&model.Student{}), scope).
		Select("DISTINCT className, major").
		Where("className IS NOT NULL AND className != ''").
		Order("major ASC, className ASC").
		Find(&classRows).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"message": "获取班级列表失败"})
		return
	}
	classNames := make([]ClassOption, 0, len(classRows))
	for _, row := range classRows {
		classNames = append(classNames, ClassOption{
			Name:  row.ClassName,
			Major: row.Major,
		})
	}

	// 查询去重的年级列表
	var grades []string
	if err := service.ApplyAcademicScopeToStudentQuery(c.db.Model(&model.Student{}), scope).
		Distinct("grade").
		Where("grade IS NOT NULL AND grade != ''").
		Order("grade DESC").
		Pluck("grade", &grades).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"message": "获取年级列表失败"})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"colleges":   colleges,
		"majors":     majors,
		"classNames": classNames,
		"grades":     grades,
	})
}

// PreviewImportStudentsV2 V2版本预览学生导入
func (c *StudentController) PreviewImportStudentsV2(ctx *gin.Context) {
	var req model.StudentImportPreviewRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"message": "请求格式无效: " + err.Error()})
		return
	}

	result, err := c.service.PreviewImportV2(req.Rows)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"message": "预检失败: " + err.Error()})
		return
	}

	scope, err := service.ResolveUserDataScopeByUserID(c.db, fmt.Sprintf("%v", ctx.MustGet("userId")))
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"message": "获取数据范围失败"})
		return
	}
	scopeIssues := collectStudentImportScopeIssues(scope, req.Rows)
	if len(scopeIssues) > 0 {
		result.Issues = append(result.Issues, scopeIssues...)
		result.IssueCount += len(scopeIssues)
		result.PassCount = result.TotalCount - result.IssueCount
		if result.PassCount < 0 {
			result.PassCount = 0
		}
	}

	ctx.JSON(http.StatusOK, result)
}

// ImportStudentsV2 V2版本导入学生
func (c *StudentController) ImportStudentsV2(ctx *gin.Context) {
	var req model.StudentImportExecuteRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"message": "请求格式无效: " + err.Error()})
		return
	}
	scope, err := service.ResolveUserDataScopeByUserID(c.db, fmt.Sprintf("%v", ctx.MustGet("userId")))
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"message": "获取数据范围失败"})
		return
	}
	if err := ensureStudentImportRowsWritable(scope, req.Rows); err != nil {
		ctx.JSON(http.StatusForbidden, gin.H{"message": err.Error()})
		return
	}

	result, err := c.service.BatchImportV2(req.Rows, req.Strategy)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"message": "导入执行失败: " + err.Error()})
		return
	}

	// 记录审计日志
	operatorID, _ := ctx.Get("userId")
	operatorName, _ := ctx.Get("fullName")
	service.LogAudit(service.AuditLogParams{
		Action:      service.AuditActionImport,
		Module:      service.AuditModuleStudent,
		Description: fmt.Sprintf("V2导入学生数据，成功 %d 条（新增 %d，更新 %d），跳过 %d 条，失败 %d 条", result.SuccessCount, result.CreatedCount, result.UpdatedCount, result.SkippedCount, result.FailedCount),
		NewValue: map[string]interface{}{
			"successCount": result.SuccessCount,
			"createdCount": result.CreatedCount,
			"updatedCount": result.UpdatedCount,
			"skippedCount": result.SkippedCount,
			"failedCount":  result.FailedCount,
		},
		OperatorID:   fmt.Sprintf("%v", operatorID),
		OperatorName: fmt.Sprintf("%v", operatorName),
		IPAddress:    ctx.ClientIP(),
	})

	ctx.JSON(http.StatusOK, result)
}

// ImportStudentsV2Async V2版本异步导入学生（支持进度轮询）
func (c *StudentController) ImportStudentsV2Async(ctx *gin.Context) {
	var req model.StudentImportExecuteRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"message": "请求格式无效: " + err.Error()})
		return
	}

	if len(req.Rows) == 0 {
		ctx.JSON(http.StatusBadRequest, gin.H{"message": "导入数据为空"})
		return
	}
	scope, err := service.ResolveUserDataScopeByUserID(c.db, fmt.Sprintf("%v", ctx.MustGet("userId")))
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"message": "获取数据范围失败"})
		return
	}
	if err := ensureStudentImportRowsWritable(scope, req.Rows); err != nil {
		ctx.JSON(http.StatusForbidden, gin.H{"message": err.Error()})
		return
	}

	// 创建任务
	taskService := service.GetImportTaskService()
	jobId, err := taskService.CreateTask(len(req.Rows))
	if err != nil {
		// Redis 不可用，降级为同步执行
		c.ImportStudentsV2(ctx)
		return
	}

	// 提取审计信息（必须在主 goroutine 中提取）
	operatorID, _ := ctx.Get("userId")
	operatorName, _ := ctx.Get("fullName")
	clientIP := ctx.ClientIP()

	// 启动后台任务
	go func() {
		result, execErr := c.service.BatchImportV2WithProgress(req.Rows, req.Strategy, jobId, taskService)

		if execErr != nil {
			taskService.FailTask(jobId, execErr)
			return
		}

		// 标记完成
		taskService.CompleteTask(jobId, result)

		// 记录审计日志
		service.LogAudit(service.AuditLogParams{
			Action:      service.AuditActionImport,
			Module:      service.AuditModuleStudent,
			Description: fmt.Sprintf("V2异步导入学生数据，成功 %d 条（新增 %d，更新 %d），跳过 %d 条，失败 %d 条", result.SuccessCount, result.CreatedCount, result.UpdatedCount, result.SkippedCount, result.FailedCount),
			NewValue: map[string]interface{}{
				"jobId":        jobId,
				"successCount": result.SuccessCount,
				"createdCount": result.CreatedCount,
				"updatedCount": result.UpdatedCount,
				"skippedCount": result.SkippedCount,
				"failedCount":  result.FailedCount,
			},
			OperatorID:   fmt.Sprintf("%v", operatorID),
			OperatorName: fmt.Sprintf("%v", operatorName),
			IPAddress:    clientIP,
		})
	}()

	// 立即返回 jobId
	ctx.JSON(http.StatusAccepted, gin.H{
		"jobId":   jobId,
		"message": "导入任务已创建，请轮询进度接口获取状态",
	})
}

func buildLegacyImportStudents(rows []map[string]string) []*model.Student {
	columnMappings := map[string][]string{
		"studentNo": {"studentNo", "StudentNo", "学号", "學號"},
		"fullName":  {"fullName", "FullName", "姓名"},
		"college":   {"college", "学院"},
		"major":     {"major", "专业"},
		"className": {"className", "班级"},
	}

	students := make([]*model.Student, 0, len(rows))
	for _, row := range rows {
		student := &model.Student{
			FullName:  utils.GetValueFromRow(row, columnMappings["fullName"]),
			StudentNo: nil,
			College:   nil,
			Major:     nil,
			ClassName: nil,
		}
		if studentNo := utils.GetValueFromRow(row, columnMappings["studentNo"]); studentNo != "" {
			student.StudentNo = &studentNo
		}
		if college := utils.GetValueFromRow(row, columnMappings["college"]); college != "" {
			student.College = &college
		}
		if major := utils.GetValueFromRow(row, columnMappings["major"]); major != "" {
			student.Major = &major
		}
		if className := utils.GetValueFromRow(row, columnMappings["className"]); className != "" {
			student.ClassName = &className
		}
		students = append(students, student)
	}
	return students
}

// TeacherController 教工管理控制器
type TeacherController struct {
	db      *gorm.DB
	service service.TeacherService
}

func NewTeacherController(db *gorm.DB, s service.TeacherService) *TeacherController {
	return &TeacherController{db: db, service: s}
}

// GetTeachers 获取教工列表（分页）
func (c *TeacherController) GetTeachers(ctx *gin.Context) {
	page, _ := strconv.Atoi(ctx.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(ctx.DefaultQuery("pageSize", "10"))
	search := ctx.Query("search")
	departments := ctx.QueryArray("department")

	teachers, total, err := c.service.Search(page, pageSize, search, departments)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"items": teachers,
		"total": total,
	})
}

// CreateTeacher 创建教工
func (c *TeacherController) CreateTeacher(ctx *gin.Context) {
	var teacher model.Teacher
	if err := ctx.ShouldBindJSON(&teacher); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"message": "无效的请求数据"})
		return
	}

	if err := c.service.Create(&teacher); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"message": "创建教工失败: " + err.Error()})
		return
	}

	ctx.JSON(http.StatusCreated, teacher)
}

// UpdateTeacher 更新教工信息
func (c *TeacherController) UpdateTeacher(ctx *gin.Context) {
	id := ctx.Param("id")
	var teacher model.Teacher
	if err := ctx.ShouldBindJSON(&teacher); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"message": "无效的请求数据"})
		return
	}

	if err := c.service.Update(id, &teacher); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"message": "更新教工信息失败: " + err.Error()})
		return
	}

	// 记录更新审计日志
	operatorID, _ := ctx.Get("userId")
	operatorName, _ := ctx.Get("fullName")
	service.LogAudit(service.AuditLogParams{
		Action:       service.AuditActionUpdate,
		Module:       service.AuditModuleTeacher,
		TargetID:     id,
		TargetName:   teacher.FullName,
		Description:  fmt.Sprintf("更新教工 %s 的信息", teacher.FullName),
		OperatorID:   fmt.Sprintf("%v", operatorID),
		OperatorName: fmt.Sprintf("%v", operatorName),
		IPAddress:    ctx.ClientIP(),
	})

	ctx.JSON(http.StatusOK, gin.H{"message": "更新成功"})
}

// DeleteTeachers 批量删除教工
func (c *TeacherController) DeleteTeachers(ctx *gin.Context) {
	var req struct {
		Ids []string `json:"ids"`
	}
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"message": "无效的请求数据"})
		return
	}

	if err := c.service.Delete(req.Ids); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"message": "删除教工失败: " + err.Error()})
		return
	}

	// 记录删除审计日志
	operatorID, _ := ctx.Get("userId")
	operatorName, _ := ctx.Get("fullName")
	service.LogAudit(service.AuditLogParams{
		Action:       service.AuditActionDelete,
		Module:       service.AuditModuleTeacher,
		Description:  fmt.Sprintf("删除 %d 个教工", len(req.Ids)),
		NewValue:     map[string]interface{}{"deletedIds": req.Ids, "count": len(req.Ids)},
		OperatorID:   fmt.Sprintf("%v", operatorID),
		OperatorName: fmt.Sprintf("%v", operatorName),
		IPAddress:    ctx.ClientIP(),
	})

	ctx.JSON(http.StatusOK, gin.H{"message": "删除成功", "deleted": len(req.Ids)})
}

// PreviewImportTeachers 预览教工导入
func (c *TeacherController) PreviewImportTeachers(ctx *gin.Context) {
	file, err := ctx.FormFile("file")
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"message": "未接收到上传文件"})
		return
	}

	src, err := file.Open()
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"message": "无法打开上传文件"})
		return
	}
	defer src.Close()

	fileBytes, _ := io.ReadAll(src)
	rows, err := utils.ParseExcelFromBytes(fileBytes)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"message": "解析 Excel 失败: " + err.Error()})
		return
	}

	result, err := c.service.PreviewImport(rows)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"message": "预检失败: " + err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, result)
}

// ImportTeachers 导入教工
func (c *TeacherController) ImportTeachers(ctx *gin.Context) {
	resolution := ctx.DefaultQuery("resolution", "overwrite")
	file, err := ctx.FormFile("file")
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"message": "未接收到上传文件"})
		return
	}

	src, err := file.Open()
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"message": "无法打开上传文件"})
		return
	}
	defer src.Close()

	fileBytes, err := io.ReadAll(src)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"message": "读取文件失败"})
		return
	}

	rows, err := utils.ParseExcelFromBytes(fileBytes)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"message": "解析 Excel 失败: " + err.Error()})
		return
	}

	// 定义字段映射
	columnMappings := map[string][]string{
		"fullName":   {"姓名", "fullName", "Full Name"},
		"employeeNo": {"工号", "employeeNo", "Employee No", "工号（同步账号）"},
		"gender":     {"性别", "gender"},
		"department": {"院系", "部门", "department", "院系/部门"},
		"mobile":     {"手机号", "联系电话", "mobile", "phone"},
		"classes":    {"所带班级", "负责班级", "classes"},
	}

	successCount := 0
	failedCount := 0
	teachers := make([]*model.Teacher, 0, len(rows))

	for _, row := range rows {
		teacher := model.Teacher{
			ID: uuid.New().String(),
		}

		teacher.FullName = utils.GetValueFromRow(row, columnMappings["fullName"])
		if eno := utils.GetValueFromRow(row, columnMappings["employeeNo"]); eno != "" {
			teacher.EmployeeNo = &eno
		}

		if gender := utils.GetValueFromRow(row, columnMappings["gender"]); gender != "" {
			teacher.Gender = &gender
		}
		if dept := utils.GetValueFromRow(row, columnMappings["department"]); dept != "" {
			teacher.Department = &dept
		}
		if mobile := utils.GetValueFromRow(row, columnMappings["mobile"]); mobile != "" {
			teacher.Mobile = &mobile
		}
		if classes := utils.GetValueFromRow(row, columnMappings["classes"]); classes != "" {
			teacher.Classes = &classes
		}

		// 验证必填字段
		if teacher.FullName == "" || teacher.EmployeeNo == nil {
			failedCount++
			continue
		}

		teachers = append(teachers, &teacher)
	}

	// 批量导入（支持冲突策略）
	if len(teachers) > 0 {
		success, failed, err := c.service.BatchImport(teachers, resolution)
		if err != nil {
			ctx.JSON(http.StatusInternalServerError, gin.H{"message": "批量导入失败: " + err.Error()})
			return
		}
		successCount = success
		failedCount += failed
	}

	// 记录审计日志
	operatorID, _ := ctx.Get("userId")
	operatorName, _ := ctx.Get("fullName")
	service.LogAudit(service.AuditLogParams{
		Action:       service.AuditActionImport,
		Module:       service.AuditModuleTeacher,
		Description:  fmt.Sprintf("导入教工数据，成功 %d 条，失败 %d 条", successCount, failedCount),
		NewValue:     map[string]interface{}{"successCount": successCount, "failedCount": failedCount},
		OperatorID:   fmt.Sprintf("%v", operatorID),
		OperatorName: fmt.Sprintf("%v", operatorName),
		IPAddress:    ctx.ClientIP(),
	})

	ctx.JSON(http.StatusOK, gin.H{
		"successCount": successCount,
		"failedCount":  failedCount,
		"message":      fmt.Sprintf("导入完成：成功 %d 条，失败 %d 条", successCount, failedCount),
	})
}

// PreviewImportTeachersV2 V2版本预览教工导入
func (c *TeacherController) PreviewImportTeachersV2(ctx *gin.Context) {
	var req model.TeacherImportPreviewRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"message": "请求格式无效: " + err.Error()})
		return
	}

	result, err := c.service.PreviewImportV2(req.Rows)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"message": "预检失败: " + err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, result)
}

// ImportTeachersV2 V2版本导入教工
func (c *TeacherController) ImportTeachersV2(ctx *gin.Context) {
	var req model.TeacherImportExecuteRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"message": "请求格式无效: " + err.Error()})
		return
	}

	result, err := c.service.BatchImportV2(req.Rows, req.Strategy)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"message": "导入执行失败: " + err.Error()})
		return
	}

	operatorID, _ := ctx.Get("userId")
	operatorName, _ := ctx.Get("fullName")
	service.LogAudit(service.AuditLogParams{
		Action:      service.AuditActionImport,
		Module:      service.AuditModuleTeacher,
		Description: fmt.Sprintf("V2导入教工数据，成功 %d 条（新增 %d，更新 %d），跳过 %d 条，失败 %d 条", result.SuccessCount, result.CreatedCount, result.UpdatedCount, result.SkippedCount, result.FailedCount),
		NewValue: map[string]interface{}{
			"successCount": result.SuccessCount,
			"createdCount": result.CreatedCount,
			"updatedCount": result.UpdatedCount,
			"skippedCount": result.SkippedCount,
			"failedCount":  result.FailedCount,
		},
		OperatorID:   fmt.Sprintf("%v", operatorID),
		OperatorName: fmt.Sprintf("%v", operatorName),
		IPAddress:    ctx.ClientIP(),
	})

	ctx.JSON(http.StatusOK, result)
}

// ImportTeachersV2Async V2版本异步导入教工（支持进度轮询）
func (c *TeacherController) ImportTeachersV2Async(ctx *gin.Context) {
	var req model.TeacherImportExecuteRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"message": "请求格式无效: " + err.Error()})
		return
	}

	if len(req.Rows) == 0 {
		ctx.JSON(http.StatusBadRequest, gin.H{"message": "导入数据为空"})
		return
	}

	taskService := service.GetImportTaskService()
	jobId, err := taskService.CreateTask(len(req.Rows))
	if err != nil {
		c.ImportTeachersV2(ctx)
		return
	}

	operatorID, _ := ctx.Get("userId")
	operatorName, _ := ctx.Get("fullName")
	clientIP := ctx.ClientIP()

	go func() {
		result, execErr := c.service.BatchImportV2WithProgress(req.Rows, req.Strategy, jobId, taskService)
		if execErr != nil {
			taskService.FailTask(jobId, execErr)
			return
		}

		taskService.CompleteTask(jobId, result)

		service.LogAudit(service.AuditLogParams{
			Action:      service.AuditActionImport,
			Module:      service.AuditModuleTeacher,
			Description: fmt.Sprintf("V2异步导入教工数据，成功 %d 条（新增 %d，更新 %d），跳过 %d 条，失败 %d 条", result.SuccessCount, result.CreatedCount, result.UpdatedCount, result.SkippedCount, result.FailedCount),
			NewValue: map[string]interface{}{
				"jobId":        jobId,
				"successCount": result.SuccessCount,
				"createdCount": result.CreatedCount,
				"updatedCount": result.UpdatedCount,
				"skippedCount": result.SkippedCount,
				"failedCount":  result.FailedCount,
			},
			OperatorID:   fmt.Sprintf("%v", operatorID),
			OperatorName: fmt.Sprintf("%v", operatorName),
			IPAddress:    clientIP,
		})
	}()

	ctx.JSON(http.StatusAccepted, gin.H{
		"jobId":   jobId,
		"message": "导入任务已创建，请轮询进度接口获取状态",
	})
}

// ExportTeachers 导出教工
func (c *TeacherController) ExportTeachers(ctx *gin.Context) {
	var teachers []model.Teacher
	if err := c.db.Find(&teachers).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"message": "导出失败"})
		return
	}

	columns := []utils.ExcelColumn{
		{Header: "工号", Field: "employeeNo", Width: 15},
		{Header: "姓名", Field: "fullName", Width: 12},
		{Header: "性别", Field: "gender", Width: 8},
		{Header: "部门", Field: "department", Width: 20},
		{Header: "手机号", Field: "mobile", Width: 15},
		{Header: "负责班级", Field: "classes", Width: 25},
	}

	data := make([]map[string]interface{}, 0, len(teachers))
	for _, t := range teachers {
		row := map[string]interface{}{
			"employeeNo": ptrToStr(t.EmployeeNo),
			"fullName":   t.FullName,
			"gender":     ptrToStr(t.Gender),
			"department": ptrToStr(t.Department),
			"mobile":     ptrToStr(t.Mobile),
			"classes":    ptrToStr(t.Classes),
		}
		data = append(data, row)
	}

	excelFile, err := utils.CreateExcelFromMaps(data, columns, "教工信息")
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"message": "生成 Excel 失败"})
		return
	}

	if err := utils.SendExcelResponse(ctx, excelFile, "teachers"); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"message": "发送文件失败"})
		return
	}
}

// RoleController 角色管理控制器
type RoleController struct {
	db                *gorm.DB
	permissionService *service.PermissionService
}

// NewRoleController 创建新的角色控制器
func NewRoleController(db *gorm.DB, permissionService *service.PermissionService) *RoleController {
	return &RoleController{db: db, permissionService: permissionService}
}

// GetRoles 获取角色列表
func (c *RoleController) GetRoles(ctx *gin.Context) {
	roles, err := c.listRoles()
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}
	// 前端期望的格式是 { roles: [...] }
	ctx.JSON(http.StatusOK, gin.H{"roles": roles})
}

// BuildingController 楼栋管理控制器
type BuildingController struct {
	db      *gorm.DB
	service service.InfrastructureService
}

func NewBuildingController(db *gorm.DB, s service.InfrastructureService) *BuildingController {
	return &BuildingController{db: db, service: s}
}

// GetBuildingTable 获取楼栋分页列表
func (c *BuildingController) GetBuildingTable(ctx *gin.Context) {
	page, _ := strconv.Atoi(ctx.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(ctx.DefaultQuery("pageSize", "10"))
	search := ctx.Query("search")

	// 限制 pageSize
	if pageSize > 100 {
		pageSize = 100
	}
	if pageSize <= 0 {
		pageSize = 10
	}
	if page <= 0 {
		page = 1
	}

	var buildings []model.Building
	var total int64

	query := c.db.Model(&model.Building{})

	// 搜索条件
	if search != "" {
		searchPattern := "%" + search + "%"
		query = query.Where("name LIKE ?", searchPattern)
	}

	// 筛选条件
	if campus := ctx.QueryArray("campus"); len(campus) > 0 {
		query = query.Where("campus IN ?", campus)
	}
	if buildingType := ctx.QueryArray("type"); len(buildingType) > 0 {
		query = query.Where("type IN ?", buildingType)
	}

	// 获取总数
	query.Count(&total)

	// 排序
	sortField := ctx.DefaultQuery("sortField", "name")
	sortOrder := ctx.DefaultQuery("sortOrder", "asc")
	orderClause := utils.ValidateSortParams(sortField, sortOrder, buildingSortConfig)
	query = query.Order(orderClause)

	// 分页, Preload Dorms 来计算关联宿舍数量
	offset := (page - 1) * pageSize
	if err := query.Preload("Dorms").Offset(offset).Limit(pageSize).Find(&buildings).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}

	// 格式化结果，添加 dormCount
	items := make([]gin.H, 0, len(buildings))
	for _, b := range buildings {
		items = append(items, gin.H{
			"id":          b.ID,
			"name":        b.Name,
			"campus":      b.Campus,
			"type":        b.Type,
			"floors":      b.Floors,
			"hasElevator": b.HasElevator,
			"contactInfo": b.ContactInfo,
			"dormCount":   len(b.Dorms), // 计算关联宿舍数量
			"createdAt":   b.CreatedAt,
			"updatedAt":   b.UpdatedAt,
		})
	}

	ctx.JSON(http.StatusOK, gin.H{
		"items":          items,
		"total":          total,
		"sortableFields": buildingSortableFields,
	})
}

// CreateBuilding 创建楼栋
func (c *BuildingController) CreateBuilding(ctx *gin.Context) {
	var building model.Building
	if err := ctx.ShouldBindJSON(&building); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"message": "无效的请求数据"})
		return
	}

	if err := c.service.CreateBuilding(&building); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"message": "创建楼栋失败: " + err.Error()})
		return
	}

	// 记录审计日志
	operatorID, _ := ctx.Get("userId")
	operatorName, _ := ctx.Get("fullName")
	service.LogAudit(service.AuditLogParams{
		Action:       service.AuditActionCreate,
		Module:       service.AuditModuleDorm,
		TargetID:     fmt.Sprintf("%d", building.ID),
		TargetName:   building.Name,
		Description:  fmt.Sprintf("创建楼栋 %s", building.Name),
		NewValue:     map[string]interface{}{"name": building.Name, "campus": building.Campus},
		OperatorID:   fmt.Sprintf("%v", operatorID),
		OperatorName: fmt.Sprintf("%v", operatorName),
		IPAddress:    ctx.ClientIP(),
	})

	ctx.JSON(http.StatusCreated, building)
}

// UpdateBuilding 更新楼栋信息
func (c *BuildingController) UpdateBuilding(ctx *gin.Context) {
	id, _ := strconv.Atoi(ctx.Param("id"))
	var building model.Building
	if err := ctx.ShouldBindJSON(&building); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"message": "无效的请求数据"})
		return
	}

	if err := c.service.UpdateBuilding(id, &building); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"message": "更新楼栋失败: " + err.Error()})
		return
	}

	// 记录审计日志
	operatorID, _ := ctx.Get("userId")
	operatorName, _ := ctx.Get("fullName")
	service.LogAudit(service.AuditLogParams{
		Action:       service.AuditActionUpdate,
		Module:       service.AuditModuleDorm,
		TargetID:     fmt.Sprintf("%d", id),
		TargetName:   building.Name,
		Description:  fmt.Sprintf("更新楼栋 %s", building.Name),
		OperatorID:   fmt.Sprintf("%v", operatorID),
		OperatorName: fmt.Sprintf("%v", operatorName),
		IPAddress:    ctx.ClientIP(),
	})

	ctx.JSON(http.StatusOK, gin.H{"message": "更新成功"})
}

// DeleteBuilding 删除单体楼栋
func (c *BuildingController) DeleteBuilding(ctx *gin.Context) {
	id, _ := strconv.Atoi(ctx.Param("id"))

	// 先获取楼栋信息用于审计日志
	var building model.Building
	c.db.First(&building, id)

	if err := c.service.DeleteBuilding(id); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"message": "删除楼栋失败: " + err.Error()})
		return
	}

	// 记录审计日志
	operatorID, _ := ctx.Get("userId")
	operatorName, _ := ctx.Get("fullName")
	service.LogAudit(service.AuditLogParams{
		Action:       service.AuditActionDelete,
		Module:       service.AuditModuleDorm,
		TargetID:     fmt.Sprintf("%d", id),
		TargetName:   building.Name,
		Description:  fmt.Sprintf("删除楼栋 %s", building.Name),
		OperatorID:   fmt.Sprintf("%v", operatorID),
		OperatorName: fmt.Sprintf("%v", operatorName),
		IPAddress:    ctx.ClientIP(),
	})

	ctx.JSON(http.StatusOK, gin.H{"message": "删除成功"})
}

// BatchDeleteBuildings 批量删除楼栋
func (c *BuildingController) BatchDeleteBuildings(ctx *gin.Context) {
	var req struct {
		Ids []int `json:"ids"`
	}
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"message": "无效的请求数据"})
		return
	}

	if err := c.service.DeleteBuildings(req.Ids); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"message": "批量删除楼栋失败: " + err.Error()})
		return
	}

	// 记录审计日志
	operatorID, _ := ctx.Get("userId")
	operatorName, _ := ctx.Get("fullName")
	service.LogAudit(service.AuditLogParams{
		Action:       service.AuditActionDelete,
		Module:       service.AuditModuleDorm,
		Description:  fmt.Sprintf("批量删除 %d 个楼栋", len(req.Ids)),
		OperatorID:   fmt.Sprintf("%v", operatorID),
		OperatorName: fmt.Sprintf("%v", operatorName),
		IPAddress:    ctx.ClientIP(),
	})

	ctx.JSON(http.StatusOK, gin.H{"message": "批量删除成功"})
}

// PreviewImportBuildings 预览楼栋导入
func (c *BuildingController) PreviewImportBuildings(ctx *gin.Context) {
	file, err := ctx.FormFile("file")
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"message": "未接收到上传文件"})
		return
	}

	src, err := file.Open()
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"message": "无法打开上传文件"})
		return
	}
	defer src.Close()

	fileBytes, err := io.ReadAll(src)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"message": "读取内容失败"})
		return
	}

	rows, err := utils.ParseExcelFromBytes(fileBytes)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
		return
	}

	columnMappings := map[string][]string{
		"name":        {"name", "Name", "楼栋名称", "名称"},
		"campus":      {"campus", "Campus", "校区"},
		"type":        {"type", "Type", "类型"},
		"floors":      {"floors", "Floors", "楼层数"},
		"hasElevator": {"hasElevator", "HasElevator", "有电梯", "电梯"},
		"contactInfo": {"contactInfo", "ContactInfo", "联系方式"},
	}

	buildings := make([]*model.Building, 0, len(rows))
	for _, row := range rows {
		building := model.Building{
			Name: utils.GetValueFromRow(row, columnMappings["name"]),
		}
		if campus := utils.GetValueFromRow(row, columnMappings["campus"]); campus != "" {
			building.Campus = campus
		}
		if buildingType := utils.GetValueFromRow(row, columnMappings["type"]); buildingType != "" {
			building.Type = &buildingType
		}
		if floors := utils.GetValueFromRow(row, columnMappings["floors"]); floors != "" {
			if f, err := strconv.Atoi(floors); err == nil {
				building.Floors = f
			}
		}
		if hasElevator := utils.GetValueFromRow(row, columnMappings["hasElevator"]); hasElevator != "" {
			building.HasElevator = hasElevator == "是" || hasElevator == "true" || hasElevator == "1"
		}
		if contactInfo := utils.GetValueFromRow(row, columnMappings["contactInfo"]); contactInfo != "" {
			building.ContactInfo = &contactInfo
		}
		buildings = append(buildings, &building)
	}

	result, err := c.service.PreviewImportBuildings(buildings)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"message": "预览失败: " + err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, result)
}

// ImportBuildings 导入楼栋
func (c *BuildingController) ImportBuildings(ctx *gin.Context) {
	resolution := ctx.DefaultQuery("resolution", "overwrite")
	file, err := ctx.FormFile("file")
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"message": "未接收到上传文件"})
		return
	}

	src, err := file.Open()
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"message": "无法打开上传文件"})
		return
	}
	defer src.Close()

	fileBytes, err := io.ReadAll(src)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"message": "读取内容失败"})
		return
	}

	rows, err := utils.ParseExcelFromBytes(fileBytes)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
		return
	}

	columnMappings := map[string][]string{
		"name":        {"name", "Name", "楼栋名称", "名称"},
		"campus":      {"campus", "Campus", "校区"},
		"type":        {"type", "Type", "类型"},
		"floors":      {"floors", "Floors", "楼层数"},
		"hasElevator": {"hasElevator", "HasElevator", "有电梯", "电梯"},
		"contactInfo": {"contactInfo", "ContactInfo", "联系方式"},
	}

	buildings := make([]*model.Building, 0, len(rows))
	for _, row := range rows {
		building := model.Building{
			Name: utils.GetValueFromRow(row, columnMappings["name"]),
		}
		if campus := utils.GetValueFromRow(row, columnMappings["campus"]); campus != "" {
			building.Campus = campus
		}

		if building.Name == "" || building.Campus == "" {
			continue
		}

		if buildingType := utils.GetValueFromRow(row, columnMappings["type"]); buildingType != "" {
			building.Type = &buildingType
		}
		if floors := utils.GetValueFromRow(row, columnMappings["floors"]); floors != "" {
			if f, err := strconv.Atoi(floors); err == nil {
				building.Floors = f
			}
		}
		if hasElevator := utils.GetValueFromRow(row, columnMappings["hasElevator"]); hasElevator != "" {
			building.HasElevator = hasElevator == "是" || hasElevator == "true" || hasElevator == "1"
		}
		if contactInfo := utils.GetValueFromRow(row, columnMappings["contactInfo"]); contactInfo != "" {
			building.ContactInfo = &contactInfo
		}
		buildings = append(buildings, &building)
	}

	successCount, failedCount, err := c.service.BatchImportBuildings(buildings, resolution)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"message": "导入失败: " + err.Error()})
		return
	}

	operatorID, _ := ctx.Get("userId")
	operatorName, _ := ctx.Get("fullName")
	service.LogAudit(service.AuditLogParams{
		Action:       service.AuditActionImport,
		Module:       service.AuditModuleDorm,
		Description:  fmt.Sprintf("导入楼栋数据，成功 %d 条，失败 %d 条", successCount, failedCount),
		NewValue:     map[string]interface{}{"successCount": successCount, "failedCount": failedCount},
		OperatorID:   fmt.Sprintf("%v", operatorID),
		OperatorName: fmt.Sprintf("%v", operatorName),
		IPAddress:    ctx.ClientIP(),
	})

	ctx.JSON(http.StatusOK, gin.H{
		"successCount": successCount,
		"failedCount":  failedCount,
		"message":      fmt.Sprintf("导入完成：成功 %d 条，失败 %d 条", successCount, failedCount),
	})
}

// PreviewImportBuildingsV2 V2版本预览楼栋导入
func (c *BuildingController) PreviewImportBuildingsV2(ctx *gin.Context) {
	var req model.BuildingImportPreviewRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"message": "请求格式无效: " + err.Error()})
		return
	}

	result, err := c.service.PreviewImportBuildingsV2(req.Rows)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"message": "预检失败: " + err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, result)
}

// ImportBuildingsV2 V2版本导入楼栋
func (c *BuildingController) ImportBuildingsV2(ctx *gin.Context) {
	var req model.BuildingImportExecuteRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"message": "请求格式无效: " + err.Error()})
		return
	}

	result, err := c.service.BatchImportBuildingsV2(req.Rows, req.Strategy)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"message": "导入执行失败: " + err.Error()})
		return
	}

	operatorID, _ := ctx.Get("userId")
	operatorName, _ := ctx.Get("fullName")
	service.LogAudit(service.AuditLogParams{
		Action:      service.AuditActionImport,
		Module:      service.AuditModuleDorm,
		Description: fmt.Sprintf("V2导入楼栋数据，成功 %d 条（新增 %d，更新 %d），跳过 %d 条，失败 %d 条", result.SuccessCount, result.CreatedCount, result.UpdatedCount, result.SkippedCount, result.FailedCount),
		NewValue: map[string]interface{}{
			"successCount": result.SuccessCount,
			"createdCount": result.CreatedCount,
			"updatedCount": result.UpdatedCount,
			"skippedCount": result.SkippedCount,
			"failedCount":  result.FailedCount,
		},
		OperatorID:   fmt.Sprintf("%v", operatorID),
		OperatorName: fmt.Sprintf("%v", operatorName),
		IPAddress:    ctx.ClientIP(),
	})

	ctx.JSON(http.StatusOK, result)
}

// ImportBuildingsV2Async V2版本异步导入楼栋（支持进度轮询）
func (c *BuildingController) ImportBuildingsV2Async(ctx *gin.Context) {
	var req model.BuildingImportExecuteRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"message": "请求格式无效: " + err.Error()})
		return
	}

	if len(req.Rows) == 0 {
		ctx.JSON(http.StatusBadRequest, gin.H{"message": "导入数据为空"})
		return
	}

	taskService := service.GetImportTaskService()
	jobId, err := taskService.CreateTask(len(req.Rows))
	if err != nil {
		c.ImportBuildingsV2(ctx)
		return
	}

	operatorID, _ := ctx.Get("userId")
	operatorName, _ := ctx.Get("fullName")
	clientIP := ctx.ClientIP()

	go func() {
		result, execErr := c.service.BatchImportBuildingsV2WithProgress(req.Rows, req.Strategy, jobId, taskService)
		if execErr != nil {
			taskService.FailTask(jobId, execErr)
			return
		}

		taskService.CompleteTask(jobId, result)

		service.LogAudit(service.AuditLogParams{
			Action:      service.AuditActionImport,
			Module:      service.AuditModuleDorm,
			Description: fmt.Sprintf("V2异步导入楼栋数据，成功 %d 条（新增 %d，更新 %d），跳过 %d 条，失败 %d 条", result.SuccessCount, result.CreatedCount, result.UpdatedCount, result.SkippedCount, result.FailedCount),
			NewValue: map[string]interface{}{
				"jobId":        jobId,
				"successCount": result.SuccessCount,
				"createdCount": result.CreatedCount,
				"updatedCount": result.UpdatedCount,
				"skippedCount": result.SkippedCount,
				"failedCount":  result.FailedCount,
			},
			OperatorID:   fmt.Sprintf("%v", operatorID),
			OperatorName: fmt.Sprintf("%v", operatorName),
			IPAddress:    clientIP,
		})
	}()

	ctx.JSON(http.StatusAccepted, gin.H{
		"jobId":   jobId,
		"message": "导入任务已创建，请轮询进度接口获取状态",
	})
}

// ExportBuildings 导出楼栋
func (c *BuildingController) ExportBuildings(ctx *gin.Context) {
	var buildings []model.Building
	if err := c.db.Find(&buildings).Error; err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"message": "导出失败"})
		return
	}

	columns := []utils.ExcelColumn{
		{Header: "楼栋名称", Field: "name", Width: 15},
		{Header: "校区", Field: "campus", Width: 12},
		{Header: "类型", Field: "type", Width: 10},
		{Header: "楼层数", Field: "floors", Width: 8},
		{Header: "有电梯", Field: "hasElevator", Width: 8},
		{Header: "联系方式", Field: "contactInfo", Width: 20},
	}

	data := make([]map[string]interface{}, 0, len(buildings))
	for _, b := range buildings {
		hasElevator := "否"
		if b.HasElevator {
			hasElevator = "是"
		}
		row := map[string]interface{}{
			"name":        b.Name,
			"campus":      b.Campus,
			"type":        ptrToStr(b.Type),
			"floors":      strconv.Itoa(b.Floors),
			"hasElevator": hasElevator,
			"contactInfo": ptrToStr(b.ContactInfo),
		}
		data = append(data, row)
	}

	excelFile, err := utils.CreateExcelFromMaps(data, columns, "楼栋信息")
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"message": "生成 Excel 失败"})
		return
	}

	if err := utils.SendExcelResponse(ctx, excelFile, "buildings"); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"message": "发送文件失败"})
		return
	}
}

// ptrToStr 安全地将字符串指针转换为字符串
func ptrToStr(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}
