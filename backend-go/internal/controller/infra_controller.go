package controller

import (
	"fmt"
	"io"
	"log"
	"net/http"
	"sort"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/my-project/backend-go/internal/model"
	"github.com/my-project/backend-go/internal/repository"
	"github.com/my-project/backend-go/internal/service"
	"github.com/my-project/backend-go/pkg/utils"
	"gorm.io/gorm"
)

type InfrastructureController struct {
	db      *gorm.DB
	service service.InfrastructureService
}

func NewInfrastructureController(db *gorm.DB, service service.InfrastructureService) *InfrastructureController {
	return &InfrastructureController{db: db, service: service}
}

func (ctrl *InfrastructureController) resolveCurrentUserDataScope(c *gin.Context) (*service.ResolvedUserDataScope, error) {
	userID, _ := c.Get("userId")
	return service.ResolveUserDataScopeByUserID(ctrl.db, fmt.Sprintf("%v", userID))
}

func filterDormitoriesByScope(dorms []model.Dormitory, scope *service.ResolvedUserDataScope) []model.Dormitory {
	if scope == nil || scope.All {
		return dorms
	}

	filtered := make([]model.Dormitory, 0, len(dorms))
	for _, dorm := range dorms {
		building := ptrToStr(dorm.Building)
		floor := 0
		if dorm.Floor != nil {
			floor = *dorm.Floor
		}
		roomNo := ptrToStr(dorm.RoomNo)
		if scope.AllowsRoom(building, floor, roomNo) {
			filtered = append(filtered, dorm)
		}
	}
	return filtered
}

func filterBuildingsByScope(buildings []model.Building, scope *service.ResolvedUserDataScope) []model.Building {
	if scope == nil || scope.All {
		return buildings
	}

	filtered := make([]model.Building, 0, len(buildings))
	for _, building := range buildings {
		if scope.AllowsBuilding(building.Name) {
			filtered = append(filtered, building)
		}
	}
	return filtered
}

func (ctrl *InfrastructureController) GetBuildings(c *gin.Context) {
	buildings, err := ctrl.service.GetBuildings()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}
	scope, err := ctrl.resolveCurrentUserDataScope(c)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "获取数据范围失败"})
		return
	}
	if !scope.All && !scope.HasDormitoryAccess() {
		c.JSON(http.StatusOK, []model.Building{})
		return
	}
	buildings = filterBuildingsByScope(buildings, scope)
	c.JSON(http.StatusOK, buildings)
}

func (ctrl *InfrastructureController) GetDormitories(c *gin.Context) {
	scope, err := ctrl.resolveCurrentUserDataScope(c)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "获取数据范围失败"})
		return
	}
	if !scope.All && !scope.HasDormitoryAccess() {
		c.JSON(http.StatusOK, gin.H{"dormitories": []gin.H{}})
		return
	}

	// 前端 useDorms.js 期望返回 { dormitories: [...] } 格式的全量数据
	// 不使用分页，直接返回所有数据用于统计计算
	dorms, _, err := ctrl.service.GetDormitories(1, 999999, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}
	dorms = filterDormitoriesByScope(dorms, scope)

	// 格式化数据，确保包含 occupiedCount 字段
	type dormStudentAggregate struct {
		DormID  *string `gorm:"column:dormId"`
		College *string `gorm:"column:college"`
		Grade   *string `gorm:"column:grade"`
	}

	dormIDs := make([]string, 0, len(dorms))
	for _, d := range dorms {
		if d.ID != "" {
			dormIDs = append(dormIDs, d.ID)
		}
	}

	collegesByDorm := make(map[string][]string)
	gradesByDorm := make(map[string][]string)
	if len(dormIDs) > 0 {
		var rows []dormStudentAggregate
		if err := ctrl.db.Model(&model.Student{}).
			Select("dormId, college, grade").
			Where("dormId IN ?", dormIDs).
			Find(&rows).Error; err == nil {
			collegeSets := make(map[string]map[string]struct{})
			gradeSets := make(map[string]map[string]struct{})
			for _, row := range rows {
				if row.DormID == nil || *row.DormID == "" {
					continue
				}
				dormID := *row.DormID
				if row.College != nil && *row.College != "" {
					if _, ok := collegeSets[dormID]; !ok {
						collegeSets[dormID] = make(map[string]struct{})
					}
					collegeSets[dormID][*row.College] = struct{}{}
				}
				if row.Grade != nil && *row.Grade != "" {
					if _, ok := gradeSets[dormID]; !ok {
						gradeSets[dormID] = make(map[string]struct{})
					}
					gradeSets[dormID][*row.Grade] = struct{}{}
				}
			}

			for dormID, set := range collegeSets {
				values := make([]string, 0, len(set))
				for value := range set {
					values = append(values, value)
				}
				sort.Strings(values)
				collegesByDorm[dormID] = values
			}

			for dormID, set := range gradeSets {
				values := make([]string, 0, len(set))
				for value := range set {
					values = append(values, value)
				}
				sort.Strings(values)
				gradesByDorm[dormID] = values
			}
		}
	}

	result := make([]gin.H, 0, len(dorms))
	for _, d := range dorms {
		// 计算入住人数
		occupied := 0
		for _, bed := range d.Beds {
			if bed.StudentID != nil && *bed.StudentID != "" {
				occupied++
			}
		}
		grades := gradesByDorm[d.ID]
		if len(grades) == 0 && d.Grade != nil && *d.Grade != "" {
			grades = []string{*d.Grade}
		}
		result = append(result, gin.H{
			"id":            d.ID,
			"campus":        d.Campus,
			"building":      d.Building,
			"floor":         d.Floor,
			"roomNo":        d.RoomNo,
			"capacity":      d.Capacity,
			"gender":        d.Gender,
			"grade":         d.Grade,
			"dormColleges":  collegesByDorm[d.ID],
			"dormGrades":    grades,
			"occupiedCount": occupied,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"dormitories": result,
	})
}

func (ctrl *InfrastructureController) GetDormBeds(c *gin.Context) {
	scope, err := ctrl.resolveCurrentUserDataScope(c)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "获取数据范围失败"})
		return
	}
	if !scope.All && !scope.HasDormitoryAccess() {
		c.JSON(http.StatusOK, gin.H{"dormBeds": []gin.H{}})
		return
	}

	// 前端期望返回 { dormBeds: [...] } 格式
	var dormId *string
	if did := c.Query("dormId"); did != "" {
		dormId = &did
	}

	beds, _, err := ctrl.service.GetDormBeds(1, 999999, dormId)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}
	beds = filterDormBedsByScope(beds, scope)

	// 格式化返回数据，添加 studentName 等前端需要的字段
	result := make([]gin.H, 0, len(beds))
	for _, bed := range beds {
		var studentName *string
		var studentNo *string
		var studentCollege *string
		var studentGrade *string
		if bed.Student != nil {
			studentName = &bed.Student.FullName
			studentNo = bed.Student.StudentNo
			studentCollege = bed.Student.College
			studentGrade = bed.Student.Grade
		}
		result = append(result, gin.H{
			"id":          bed.ID,
			"dormId":      bed.DormID,
			"bedNo":       bed.BedNo,
			"studentId":   bed.StudentID,
			"studentName": studentName,
			"studentNo":   studentNo,
			"college":     studentCollege,
			"grade":       studentGrade,
			"status":      bed.Status,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"dormBeds": result,
	})
}

// FindDorm 根据具体位置查找单个宿舍
func (ctrl *InfrastructureController) FindDorm(c *gin.Context) {
	scope, err := ctrl.resolveCurrentUserDataScope(c)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "获取数据范围失败"})
		return
	}
	if !scope.All && !scope.HasDormitoryAccess() {
		c.JSON(http.StatusOK, gin.H{"dorm": nil})
		return
	}

	building := c.Query("building")
	floorStr := c.Query("floor")
	roomNo := c.Query("roomNo")
	campus := c.Query("campus")

	if building == "" || floorStr == "" || roomNo == "" {
		c.JSON(http.StatusBadRequest, gin.H{"message": "位置参数不完整"})
		return
	}

	floor, _ := strconv.Atoi(floorStr)

	params := repository.DormPageParams{
		Page:     1,
		PageSize: 1,
		Building: []string{building},
		Floor:    []int{floor},
		Search:   roomNo,
		Campus:   campus,
	}

	params.Scope = scope.ToDormitoryScope()
	dorms, _, err := ctrl.service.GetDormsTable(params)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}

	if len(dorms) == 0 {
		c.JSON(http.StatusOK, gin.H{"dorm": nil})
		return
	}

	// 查找精确匹配的 roomNo
	var matched *model.Dormitory
	for _, d := range dorms {
		if d.RoomNo != nil && *d.RoomNo == roomNo {
			matched = &d
			break
		}
	}

	if matched == nil {
		c.JSON(http.StatusOK, gin.H{"dorm": nil})
		return
	}

	c.JSON(http.StatusOK, gin.H{"dorm": matched})
}

// GetFloors 获取楼层列表（根据楼栋筛选）
func (ctrl *InfrastructureController) GetFloors(c *gin.Context) {
	scope, err := ctrl.resolveCurrentUserDataScope(c)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "获取数据范围失败"})
		return
	}

	building := c.Query("building")
	if building == "" {
		c.JSON(http.StatusOK, gin.H{"floors": []int{}})
		return
	}
	if !scope.All && (!scope.HasDormitoryAccess() || !scope.AllowsBuilding(building)) {
		c.JSON(http.StatusOK, gin.H{"floors": []int{}})
		return
	}

	floors, err := ctrl.service.GetFloors(building)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}
	if !scope.All {
		filtered := make([]int, 0, len(floors))
		for _, floor := range floors {
			if scope.AllowsFloor(building, floor) {
				filtered = append(filtered, floor)
			}
		}
		floors = filtered
	}
	c.JSON(http.StatusOK, gin.H{"floors": floors})
}

// GetRooms 获取房间列表（根据楼栋和楼层筛选）- 返回完整宿舍对象
func (ctrl *InfrastructureController) GetRooms(c *gin.Context) {
	scope, err := ctrl.resolveCurrentUserDataScope(c)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "获取数据范围失败"})
		return
	}

	building := c.Query("building")
	floorStr := c.Query("floor")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "100"))

	if building == "" {
		c.JSON(http.StatusOK, gin.H{"items": []gin.H{}, "total": 0})
		return
	}
	if !scope.All && (!scope.HasDormitoryAccess() || !scope.AllowsBuilding(building)) {
		c.JSON(http.StatusOK, gin.H{"items": []gin.H{}, "total": 0, "page": page, "pageSize": pageSize})
		return
	}

	// 限制 pageSize
	if pageSize > 200 {
		pageSize = 200
	}
	if pageSize <= 0 {
		pageSize = 100
	}
	if page <= 0 {
		page = 1
	}

	// 使用 DormPageParams 查询完整数据
	params := repository.DormPageParams{
		Page:      page,
		PageSize:  pageSize,
		Building:  []string{building}, // Building 是 []string 类型
		SortField: "roomNo",
		SortOrder: "asc",
	}

	// 楼层筛选
	if floorStr != "" {
		floor, _ := strconv.Atoi(floorStr)
		params.Floor = []int{floor} // Floor 是 []int 类型
	}
	params.Scope = scope.ToDormitoryScope()

	dorms, total, err := ctrl.service.GetDormsTable(params)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}

	// 格式化结果，添加 occupiedCount
	items := make([]gin.H, 0, len(dorms))
	for _, d := range dorms {
		occupiedCount := 0
		for _, bed := range d.Beds {
			if bed.StudentID != nil && *bed.StudentID != "" {
				occupiedCount++
			}
		}
		items = append(items, gin.H{
			"id":            d.ID,
			"campus":        d.Campus,
			"building":      d.Building,
			"floor":         d.Floor,
			"roomNo":        d.RoomNo,
			"capacity":      d.Capacity,
			"gender":        d.Gender,
			"grade":         d.Grade,
			"occupiedCount": occupiedCount,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"items":    items,
		"total":    total,
		"page":     page,
		"pageSize": pageSize,
	})
}

// GetDormsBuildings 获取宿舍楼栋列表（为前端 /api/dorms/buildings 提供兼容）
func (ctrl *InfrastructureController) GetDormsBuildings(c *gin.Context) {
	scope, err := ctrl.resolveCurrentUserDataScope(c)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "获取数据范围失败"})
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "100"))

	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 10
	}

	buildings, err := ctrl.service.GetBuildings()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}
	if !scope.All && !scope.HasDormitoryAccess() {
		c.JSON(http.StatusOK, gin.H{
			"buildings": []gin.H{},
			"total":     0,
			"page":      page,
			"pageSize":  pageSize,
		})
		return
	}
	buildings = filterBuildingsByScope(buildings, scope)
	// 转换为前端期望的格式（items 数组，带 campus 和 building 字段）
	result := make([]gin.H, 0, len(buildings))
	for _, b := range buildings {
		result = append(result, gin.H{
			"id":       b.ID,
			"name":     b.Name,
			"campus":   b.Campus,
			"floors":   b.Floors,
			"building": b.Name, // 兼容字段 - 前端使用 building 作为显示名
		})
	}

	// 分页处理
	total := len(result)
	start := (page - 1) * pageSize
	end := start + pageSize
	if start >= total {
		result = []gin.H{}
	} else if end > total {
		result = result[start:]
	} else {
		result = result[start:end]
	}

	// 返回与前端 useBuildings() hook 期望的格式
	c.JSON(http.StatusOK, gin.H{
		"buildings": result,
		"total":     total,
		"page":      page,
		"pageSize":  pageSize,
	})
}

// GetBuildingsAll 获取所有楼栋列表（供筛选器下拉框使用）
func (ctrl *InfrastructureController) GetBuildingsAll(c *gin.Context) {
	scope, err := ctrl.resolveCurrentUserDataScope(c)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "获取数据范围失败"})
		return
	}

	buildings, err := ctrl.service.GetBuildingsLite()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}
	if !scope.All && !scope.HasDormitoryAccess() {
		c.JSON(http.StatusOK, []model.Building{})
		return
	}
	buildings = filterBuildingsByScope(buildings, scope)
	c.JSON(http.StatusOK, buildings)
}

// GetDormsTable 获取分页宿舍列表（支持筛选排序）
func (ctrl *InfrastructureController) GetDormsTable(c *gin.Context) {
	scope, err := ctrl.resolveCurrentUserDataScope(c)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "获取数据范围失败"})
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "10"))
	search := c.Query("search")
	sortField := c.DefaultQuery("sortField", "roomNo")
	sortOrder := c.DefaultQuery("sortOrder", "asc")

	// 解析数组参数
	buildings := c.QueryArray("building")
	grades := c.QueryArray("grade")
	genders := c.QueryArray("gender")
	colleges := c.QueryArray("college")
	majors := c.QueryArray("major")
	classNames := c.QueryArray("className")
	occupancyStatus := c.QueryArray("occupancyStatus") // 入住状态: full/partial/empty

	// 解析楼层（可能是多个）
	var floors []int
	for _, f := range c.QueryArray("floor") {
		if f != "" {
			if fv, err := strconv.Atoi(f); err == nil {
				floors = append(floors, fv)
			}
		}
	}

	params := repository.DormPageParams{
		Page:            page,
		PageSize:        pageSize,
		Search:          search,
		Building:        buildings,
		Floor:           floors,
		Grade:           grades,
		Gender:          genders,
		College:         colleges,
		Major:           majors,
		ClassName:       classNames,
		OccupancyStatus: occupancyStatus,
		SortField:       sortField,
		SortOrder:       sortOrder,
	}
	if !scope.All && !scope.HasDormitoryAccess() {
		c.JSON(http.StatusOK, gin.H{"items": []gin.H{}, "total": 0, "page": page, "pageSize": pageSize})
		return
	}
	params.Scope = scope.ToDormitoryScope()

	dorms, total, err := ctrl.service.GetDormsTable(params)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}

	// 格式化输出为前端期望的结构
	items := make([]gin.H, 0, len(dorms))
	for _, d := range dorms {
		occupiedCount := 0
		// 格式化床位数据供前端卡片视图使用
		bedsData := make([]gin.H, 0, len(d.Beds))
		for _, bed := range d.Beds {
			isOccupied := bed.StudentID != nil && *bed.StudentID != ""
			if isOccupied {
				occupiedCount++
			}
			bedItem := gin.H{
				"id":        bed.ID,
				"bedNo":     bed.BedNo,
				"studentId": bed.StudentID,
				"status":    bed.Status,
			}
			// 添加学生信息（如果已入住）
			if bed.Student != nil {
				bedItem["studentName"] = bed.Student.FullName
				bedItem["studentNo"] = bed.Student.StudentNo
				bedItem["gender"] = bed.Student.Gender
				bedItem["college"] = bed.Student.College
				bedItem["grade"] = bed.Student.Grade
			}
			bedsData = append(bedsData, bedItem)
		}

		item := gin.H{
			"id":            d.ID,
			"campus":        d.Campus,
			"building":      d.Building,
			"floor":         d.Floor,
			"roomNo":        d.RoomNo,
			"capacity":      d.Capacity,
			"gender":        d.Gender,
			"grade":         d.Grade,
			"buildingId":    d.BuildingID,
			"occupiedCount": occupiedCount,
			"createdAt":     d.CreatedAt,
			"beds":          bedsData, // 添加床位详情数组
		}
		// 如果有楼栋引用，添加楼栋名称
		if d.BuildingRef != nil {
			item["buildingName"] = d.BuildingRef.Name
		}
		items = append(items, item)
	}

	c.JSON(http.StatusOK, gin.H{
		"items":    items,
		"total":    total,
		"page":     page,
		"pageSize": pageSize,
	})
}

// CreateDorm 创建宿舍
func (ctrl *InfrastructureController) CreateDorm(c *gin.Context) {
	var dorm model.Dormitory
	if err := c.ShouldBindJSON(&dorm); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "无效的请求数据"})
		return
	}
	scope, err := ctrl.resolveCurrentUserDataScope(c)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "获取数据范围失败"})
		return
	}
	floor := 0
	if dorm.Floor != nil {
		floor = *dorm.Floor
	}
	if !scopeAllowsDormLocation(scope, ptrToStr(dorm.Building), floor, ptrToStr(dorm.RoomNo)) {
		c.JSON(http.StatusForbidden, gin.H{"message": dormWriteScopeMessage})
		return
	}

	if err := ctrl.service.CreateDorm(&dorm); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "创建宿舍失败: " + err.Error()})
		return
	}

	// 记录创建审计日志
	operatorID, _ := c.Get("userId")
	operatorName, _ := c.Get("fullName")
	roomDesc := fmt.Sprintf("%v-%v", ptrToStr(dorm.Building), ptrToStr(dorm.RoomNo))
	service.LogAudit(service.AuditLogParams{
		Action:       service.AuditActionCreate,
		Module:       service.AuditModuleDorm,
		TargetID:     dorm.ID,
		TargetName:   roomDesc,
		Description:  fmt.Sprintf("创建宿舍 %s", roomDesc),
		NewValue:     map[string]interface{}{"campus": dorm.Campus, "building": dorm.Building, "roomNo": dorm.RoomNo},
		OperatorID:   fmt.Sprintf("%v", operatorID),
		OperatorName: fmt.Sprintf("%v", operatorName),
		IPAddress:    c.ClientIP(),
	})

	c.JSON(http.StatusCreated, dorm)
}

// UpdateDorm 更新宿舍
func (ctrl *InfrastructureController) UpdateDorm(c *gin.Context) {
	id := c.Param("id")
	var dorm model.Dormitory
	if err := c.ShouldBindJSON(&dorm); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "无效的请求数据"})
		return
	}
	scope, err := ctrl.resolveCurrentUserDataScope(c)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "获取数据范围失败"})
		return
	}
	if err := ensureDormsWritable(ctrl.db, scope, []string{id}, dormWriteScopeMessage); err != nil {
		c.JSON(http.StatusForbidden, gin.H{"message": err.Error()})
		return
	}
	floor := 0
	if dorm.Floor != nil {
		floor = *dorm.Floor
	}
	if !scopeAllowsDormLocation(scope, ptrToStr(dorm.Building), floor, ptrToStr(dorm.RoomNo)) {
		c.JSON(http.StatusForbidden, gin.H{"message": dormWriteScopeMessage})
		return
	}

	if err := ctrl.service.UpdateDorm(id, &dorm); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "更新宿舍失败: " + err.Error()})
		return
	}

	// 记录更新审计日志
	operatorID, _ := c.Get("userId")
	operatorName, _ := c.Get("fullName")
	roomDesc := fmt.Sprintf("%v-%v", ptrToStr(dorm.Building), ptrToStr(dorm.RoomNo))
	service.LogAudit(service.AuditLogParams{
		Action:       service.AuditActionUpdate,
		Module:       service.AuditModuleDorm,
		TargetID:     id,
		TargetName:   roomDesc,
		Description:  fmt.Sprintf("更新宿舍 %s 信息", roomDesc),
		OperatorID:   fmt.Sprintf("%v", operatorID),
		OperatorName: fmt.Sprintf("%v", operatorName),
		IPAddress:    c.ClientIP(),
	})

	c.JSON(http.StatusOK, gin.H{"message": "更新成功"})
}

// DeleteDorms 批量删除宿舍（支持 ids 列表或 filter 筛选条件）
func (ctrl *InfrastructureController) DeleteDorms(c *gin.Context) {
	var req struct {
		Ids    []string               `json:"ids"`
		Filter map[string]interface{} `json:"filter"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "无效的请求数据"})
		return
	}

	var targetIds []string

	if len(req.Ids) > 0 {
		targetIds = req.Ids
	} else if len(req.Filter) > 0 {
		ids, err := ctrl.resolveDormIdsByFilter(req.Filter)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"message": "筛选条件解析失败: " + err.Error()})
			return
		}
		targetIds = ids
	} else {
		c.JSON(http.StatusBadRequest, gin.H{"message": "请指定要删除的宿舍 ID 或筛选条件"})
		return
	}

	if len(targetIds) == 0 {
		c.JSON(http.StatusOK, gin.H{"message": "没有匹配的宿舍", "deletedCount": 0})
		return
	}
	scope, err := ctrl.resolveCurrentUserDataScope(c)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "获取数据范围失败"})
		return
	}
	if err := ensureDormsWritable(ctrl.db, scope, targetIds, dormWriteScopeMessage); err != nil {
		c.JSON(http.StatusForbidden, gin.H{"message": err.Error()})
		return
	}

	if err := ctrl.service.DeleteDorms(targetIds); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "删除宿舍失败: " + err.Error()})
		return
	}

	// 记录删除审计日志
	operatorID, _ := c.Get("userId")
	operatorName, _ := c.Get("fullName")
	service.LogAudit(service.AuditLogParams{
		Action:       service.AuditActionDelete,
		Module:       service.AuditModuleDorm,
		Description:  fmt.Sprintf("批量删除 %d 个宿舍", len(targetIds)),
		NewValue:     map[string]interface{}{"deletedCount": len(targetIds)},
		OperatorID:   fmt.Sprintf("%v", operatorID),
		OperatorName: fmt.Sprintf("%v", operatorName),
		IPAddress:    c.ClientIP(),
	})

	c.JSON(http.StatusOK, gin.H{"message": "删除成功", "deleted": len(targetIds), "deletedCount": len(targetIds)})
}

// resolveDormIdsByFilter 根据筛选条件获取宿舍 ID 列表
func (ctrl *InfrastructureController) resolveDormIdsByFilter(filter map[string]interface{}) ([]string, error) {
	if len(filter) == 0 {
		return nil, fmt.Errorf("筛选条件不能为空，以防止误删所有宿舍")
	}

	params := repository.DormPageParams{
		PageSize: 100000, // 大页面以获取所有匹配结果
	}

	// 解析楼栋筛选
	if building, ok := filter["building"].(string); ok && building != "" {
		params.Building = []string{building}
	}

	// 解析楼层筛选
	if floor, ok := filter["floor"].(float64); ok {
		params.Floor = []int{int(floor)}
	}

	// 解析性别筛选
	if gender, ok := filter["gender"].(string); ok && gender != "" {
		params.Gender = []string{gender}
	}

	// 解析年级筛选
	if grade, ok := filter["grade"].(string); ok && grade != "" {
		params.Grade = []string{grade}
	}

	// 解析搜索关键字
	if search, ok := filter["search"].(string); ok && search != "" {
		params.Search = search
	}

	dorms, _, err := ctrl.service.GetDormsTable(params)
	if err != nil {
		return nil, err
	}

	ids := make([]string, 0, len(dorms))
	for _, d := range dorms {
		ids = append(ids, d.ID)
	}

	return ids, nil
}

// GetDormMembers 获取宿舍成员
func (ctrl *InfrastructureController) GetDormMembers(c *gin.Context) {
	id := c.Param("id")
	scope, err := ctrl.resolveCurrentUserDataScope(c)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "获取数据范围失败"})
		return
	}
	if !scope.All && !scope.HasDormitoryAccess() {
		c.JSON(http.StatusOK, gin.H{"members": []model.Student{}})
		return
	}

	var dorm model.Dormitory
	if err := ctrl.db.Select("id, building, floor, roomNo").First(&dorm, "id = ?", id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			c.JSON(http.StatusOK, gin.H{"members": []model.Student{}})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"message": "获取宿舍信息失败: " + err.Error()})
		return
	}
	if !scopeAllowsDorm(scope, &dorm) {
		c.JSON(http.StatusOK, gin.H{"members": []model.Student{}})
		return
	}

	students, err := ctrl.service.GetDormMembers(id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "获取宿舍成员失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"members": students,
	})
}

// PreviewImportDorms 预览导入宿舍
func (ctrl *InfrastructureController) PreviewImportDorms(c *gin.Context) {
	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "未接收到上传文件"})
		return
	}

	src, err := file.Open()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "无法打开文件"})
		return
	}
	defer src.Close()

	fileBytes, err := io.ReadAll(src)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "读取内容失败"})
		return
	}

	rows, err := utils.ParseExcelFromBytes(fileBytes)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Excel 解析失败: " + err.Error()})
		return
	}

	columnMappings := map[string][]string{
		"campus":   {"campus", "Campus", "校区"},
		"building": {"building", "Building", "楼栋", "宿舍楼"},
		"floor":    {"floor", "Floor", "楼层"},
		"roomNo":   {"roomNo", "RoomNo", "宿舍号", "房间号"},
		"capacity": {"capacity", "Capacity", "可住人数", "容量"},
		"gender":   {"gender", "Gender", "宿舍性别", "性别限制"},
		"grade":    {"grade", "Grade", "年级", "所属年级"},
	}

	dorms := make([]*model.Dormitory, 0, len(rows))
	for _, row := range rows {
		campus := utils.GetValueFromRow(row, columnMappings["campus"])
		building := utils.GetValueFromRow(row, columnMappings["building"])
		roomNo := utils.GetValueFromRow(row, columnMappings["roomNo"])
		floor, _ := strconv.Atoi(utils.GetValueFromRow(row, columnMappings["floor"]))
		capacity, _ := strconv.Atoi(utils.GetValueFromRow(row, columnMappings["capacity"]))
		gender := utils.GetValueFromRow(row, columnMappings["gender"])
		grade := utils.GetValueFromRow(row, columnMappings["grade"])

		dorm := model.Dormitory{
			ID:       uuid.New().String(),
			Campus:   &campus,
			Building: &building,
			RoomNo:   &roomNo,
			Capacity: &capacity,
			Gender:   &gender,
			Grade:    &grade,
			Version:  1,
		}
		if floor != 0 {
			dorm.Floor = &floor
		}
		dorms = append(dorms, &dorm)
	}

	result, err := ctrl.service.PreviewImportDorms(dorms)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "预览失败: " + err.Error()})
		return
	}
	scope, err := ctrl.resolveCurrentUserDataScope(c)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "获取数据范围失败"})
		return
	}
	scopeErrors := collectLegacyDormImportScopeErrors(scope, dorms)
	if len(scopeErrors) > 0 {
		result.InvalidItems = append(result.InvalidItems, scopeErrors...)
		result.InvalidCount += len(scopeErrors)
	}

	c.JSON(http.StatusOK, result)
}

// ImportDorms 导入宿舍
func (ctrl *InfrastructureController) ImportDorms(c *gin.Context) {
	resolution := c.DefaultQuery("resolution", "overwrite")
	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "未接收到上传文件"})
		return
	}

	src, err := file.Open()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "无法打开文件"})
		return
	}
	defer src.Close()

	fileBytes, err := io.ReadAll(src)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "读取内容失败"})
		return
	}

	rows, err := utils.ParseExcelFromBytes(fileBytes)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Excel 解析失败: " + err.Error()})
		return
	}

	columnMappings := map[string][]string{
		"campus":   {"campus", "Campus", "校区"},
		"building": {"building", "Building", "楼栋", "宿舍楼"},
		"floor":    {"floor", "Floor", "楼层"},
		"roomNo":   {"roomNo", "RoomNo", "宿舍号", "房间号"},
		"capacity": {"capacity", "Capacity", "可住人数", "容量"},
		"gender":   {"gender", "Gender", "宿舍性别", "性别限制"},
		"grade":    {"grade", "Grade", "年级", "所属年级"},
	}

	dorms := make([]*model.Dormitory, 0, len(rows))
	for _, row := range rows {
		campus := utils.GetValueFromRow(row, columnMappings["campus"])
		building := utils.GetValueFromRow(row, columnMappings["building"])
		roomNo := utils.GetValueFromRow(row, columnMappings["roomNo"])

		if campus == "" || building == "" || roomNo == "" {
			continue
		}

		floor, _ := strconv.Atoi(utils.GetValueFromRow(row, columnMappings["floor"]))
		capacity, _ := strconv.Atoi(utils.GetValueFromRow(row, columnMappings["capacity"]))
		gender := utils.GetValueFromRow(row, columnMappings["gender"])
		grade := utils.GetValueFromRow(row, columnMappings["grade"])

		dorm := model.Dormitory{
			ID:       uuid.New().String(),
			Campus:   &campus,
			Building: &building,
			RoomNo:   &roomNo,
			Capacity: &capacity,
			Gender:   &gender,
			Grade:    &grade,
			Version:  1,
		}
		if floor != 0 {
			dorm.Floor = &floor
		}
		dorms = append(dorms, &dorm)
	}
	scope, err := ctrl.resolveCurrentUserDataScope(c)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "获取数据范围失败"})
		return
	}
	if err := ensureDormLocationsWritable(scope, dorms, dormWriteScopeMessage); err != nil {
		c.JSON(http.StatusForbidden, gin.H{"message": err.Error()})
		return
	}

	successCount, failedCount, err := ctrl.service.BatchImportDorms(dorms, resolution)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "导入失败: " + err.Error()})
		return
	}

	// 记录审计日志
	operatorID, _ := c.Get("userId")
	operatorName, _ := c.Get("fullName")
	service.LogAudit(service.AuditLogParams{
		Action:       service.AuditActionImport,
		Module:       service.AuditModuleDorm,
		Description:  fmt.Sprintf("导入宿舍数据，成功 %d 条，失败 %d 条", successCount, failedCount),
		NewValue:     map[string]interface{}{"successCount": successCount, "failedCount": failedCount},
		OperatorID:   fmt.Sprintf("%v", operatorID),
		OperatorName: fmt.Sprintf("%v", operatorName),
		IPAddress:    c.ClientIP(),
	})

	c.JSON(http.StatusOK, gin.H{
		"successCount": successCount,
		"failedCount":  failedCount,
		"message":      fmt.Sprintf("导入完成：成功 %d 条，失败 %d 条", successCount, failedCount),
	})
}

// ExportDorms 导出宿舍
func (ctrl *InfrastructureController) ExportDorms(c *gin.Context) {
	scope, err := ctrl.resolveCurrentUserDataScope(c)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "获取数据范围失败"})
		return
	}
	if !scope.All && !scope.HasDormitoryAccess() {
		c.JSON(http.StatusOK, []model.Dormitory{})
		return
	}

	params := repository.DormPageParams{PageSize: 10000}
	params.Scope = scope.ToDormitoryScope()
	dorms, _, err := ctrl.service.GetDormsTable(params)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "导出失败"})
		return
	}
	c.JSON(http.StatusOK, dorms)
}

// BatchCheckout 批量退宿
func (ctrl *InfrastructureController) BatchCheckout(c *gin.Context) {
	var req struct {
		DormIds []string `json:"dormIds"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "请求参数错误", "error": err.Error()})
		return
	}

	if len(req.DormIds) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"message": "请选择需要退宿的宿舍"})
		return
	}
	scope, err := ctrl.resolveCurrentUserDataScope(c)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "获取数据范围失败"})
		return
	}
	if err := ensureBatchCheckoutDormsWritable(ctrl.db, scope, req.DormIds); err != nil {
		c.JSON(http.StatusForbidden, gin.H{"message": err.Error()})
		return
	}

	// 获取操作者 ID
	operatorID := ""
	if user, exists := c.Get("user"); exists {
		if u, ok := user.(model.User); ok {
			operatorID = u.ID
		}
	}
	if operatorID == "" {
		operatorID = "system"
	}

	affectedCount, err := ctrl.service.BatchCheckout(req.DormIds, operatorID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "批量退宿失败", "error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":       true,
		"affectedCount": affectedCount,
		"message":       fmt.Sprintf("批量退宿成功，共处理 %d 名学生", affectedCount),
	})
}

// BatchCheckIn 批量入住
func (ctrl *InfrastructureController) BatchCheckIn(c *gin.Context) {
	var req struct {
		Assignments []service.CheckInAssignment `json:"assignments"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "请求参数错误", "error": err.Error()})
		return
	}

	if len(req.Assignments) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"message": "请提供入住分配列表"})
		return
	}
	scope, err := ctrl.resolveCurrentUserDataScope(c)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "获取数据范围失败"})
		return
	}
	if err := ensureBatchCheckInWritable(ctrl.db, scope, req.Assignments); err != nil {
		c.JSON(http.StatusForbidden, gin.H{"message": err.Error()})
		return
	}

	// 获取操作者 ID
	operatorID := ""
	if user, exists := c.Get("user"); exists {
		if u, ok := user.(model.User); ok {
			operatorID = u.ID
		}
	}
	if operatorID == "" {
		operatorID = "system"
	}

	successCount, failedCount, errors, err := ctrl.service.BatchCheckIn(req.Assignments, operatorID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "批量入住失败", "error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":      true,
		"successCount": successCount,
		"failedCount":  failedCount,
		"errors":       errors,
		"message":      fmt.Sprintf("批量入住完成：成功 %d 人，失败 %d 人", successCount, failedCount),
	})
}

// BatchCheckoutStudents 批量学生退宿
func (ctrl *InfrastructureController) BatchCheckoutStudents(c *gin.Context) {
	var req struct {
		StudentIds []string `json:"studentIds"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "请求参数错误", "error": err.Error()})
		return
	}

	if len(req.StudentIds) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"message": "请选择学生"})
		return
	}
	scope, err := ctrl.resolveCurrentUserDataScope(c)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "获取数据范围失败"})
		return
	}
	if err := ensureStudentsWritable(ctrl.db, scope, req.StudentIds, true, studentDormWriteScopeMessage); err != nil {
		c.JSON(http.StatusForbidden, gin.H{"message": err.Error()})
		return
	}

	// 获取操作者 ID
	operatorID := ""
	if user, exists := c.Get("user"); exists {
		if u, ok := user.(model.User); ok {
			operatorID = u.ID
		}
	}
	if operatorID == "" {
		operatorID = "system"
	}

	affectedCount, err := ctrl.service.BatchCheckoutStudents(req.StudentIds, operatorID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "批量退宿失败", "error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":       true,
		"affectedCount": affectedCount,
		"message":       fmt.Sprintf("批量退宿办理完成，共退宿 %d 名学生", affectedCount),
	})
}

// ImportCheckIn Excel 批量入住
func (ctrl *InfrastructureController) ImportCheckIn(c *gin.Context) {
	file, _, err := c.Request.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "请上传文件", "error": err.Error()})
		return
	}
	defer file.Close()

	// 读取文件内容
	fileBytes, err := io.ReadAll(file)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "读取文件失败", "error": err.Error()})
		return
	}

	// 解析 Excel（返回 []map[string]string）
	rows, err := utils.ParseExcelFromBytes(fileBytes)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "解析 Excel 失败", "error": err.Error()})
		return
	}

	if len(rows) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"message": "Excel 文件为空或没有数据行"})
		return
	}

	// 解析数据行
	var assignments []service.CheckInAssignment
	var errors []string

	for i, row := range rows {
		rowNum := i + 2 // Excel 行号从 2 开始（包含表头行）

		// 从 map 中获取值（支持中英文表头）
		studentNo := row["学号"]
		if studentNo == "" {
			studentNo = row["studentNo"]
		}
		building := row["楼栋"]
		if building == "" {
			building = row["building"]
		}
		roomNo := row["房间号"]
		if roomNo == "" {
			roomNo = row["roomNo"]
		}
		bedNo := row["床位"]
		if bedNo == "" {
			bedNo = row["bedNo"]
		}

		if studentNo == "" {
			errors = append(errors, fmt.Sprintf("第 %d 行: 学号为空", rowNum))
			continue
		}
		if building == "" || roomNo == "" {
			errors = append(errors, fmt.Sprintf("第 %d 行: 楼栋或房间号为空", rowNum))
			continue
		}

		// 查找学生 ID
		var student model.Student
		if err := ctrl.db.Where("studentNo = ?", studentNo).First(&student).Error; err != nil {
			errors = append(errors, fmt.Sprintf("第 %d 行: 学号 %s 不存在", rowNum, studentNo))
			continue
		}

		// 查找宿舍 ID
		var dorm model.Dormitory
		if err := ctrl.db.Where("building = ? AND roomNo = ?", building, roomNo).First(&dorm).Error; err != nil {
			errors = append(errors, fmt.Sprintf("第 %d 行: 宿舍 %s-%s 不存在", rowNum, building, roomNo))
			continue
		}

		assignments = append(assignments, service.CheckInAssignment{
			StudentID: student.ID,
			DormID:    dorm.ID,
			BedNo:     bedNo,
		})
	}

	if len(assignments) == 0 && len(errors) > 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"message": "所有数据均无效",
			"errors":  errors,
		})
		return
	}
	scope, err := ctrl.resolveCurrentUserDataScope(c)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "获取数据范围失败"})
		return
	}
	if err := ensureBatchCheckInWritable(ctrl.db, scope, assignments); err != nil {
		c.JSON(http.StatusForbidden, gin.H{"message": err.Error()})
		return
	}

	// 获取操作者 ID
	operatorID := ""
	if user, exists := c.Get("user"); exists {
		if u, ok := user.(model.User); ok {
			operatorID = u.ID
		}
	}
	if operatorID == "" {
		operatorID = "system"
	}

	// 调用批量入住
	successCount, failedCount, checkInErrors, err := ctrl.service.BatchCheckIn(assignments, operatorID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "批量入住失败", "error": err.Error()})
		return
	}

	// 合并错误
	allErrors := append(errors, checkInErrors...)

	c.JSON(http.StatusOK, gin.H{
		"success":      true,
		"successCount": successCount,
		"failedCount":  failedCount + len(errors),
		"errors":       allErrors,
		"message":      fmt.Sprintf("Excel 导入完成：成功 %d 人，失败 %d 人", successCount, failedCount+len(errors)),
	})
}

// PreviewImportDormsV2 预览导入宿舍 (V2 向导式)
func (ctrl *InfrastructureController) PreviewImportDormsV2(c *gin.Context) {
	var req model.DormImportPreviewRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "数据格式错误: " + err.Error()})
		return
	}

	log.Printf("PreviewImportDormsV2 rows=%d", len(req.Rows))

	// Top 3 修复：后端行数上限校验（默认 1000 行）
	const maxPreviewRows = 1000
	if len(req.Rows) > maxPreviewRows {
		c.JSON(http.StatusRequestEntityTooLarge, gin.H{
			"message": fmt.Sprintf("数据行数超出后端处理限制（最大 %d 行，当前 %d 行）", maxPreviewRows, len(req.Rows)),
		})
		return
	}

	result, err := ctrl.service.PreviewImportDormsV2(req.Rows)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "预览失败: " + err.Error()})
		return
	}
	scope, err := ctrl.resolveCurrentUserDataScope(c)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "获取数据范围失败"})
		return
	}
	scopeIssues := collectDormImportScopeIssues(scope, req.Rows)
	if len(scopeIssues) > 0 {
		result.Issues = append(result.Issues, scopeIssues...)
		result.IssueCount += len(scopeIssues)
		result.PassCount = result.TotalCount - result.IssueCount
	}

	c.JSON(http.StatusOK, result)
}

// ImportDormsV2 执行导入宿舍 (V2 向导式)
func (ctrl *InfrastructureController) ImportDormsV2(c *gin.Context) {
	var req model.DormImportExecuteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "数据格式错误: " + err.Error()})
		return
	}

	log.Printf("ImportDormsV2 rows=%d, strategy=%s", len(req.Rows), req.Strategy)

	// Top 3 修复：后端行数上限校验（默认 1000 行）
	const maxExecuteRows = 1000
	if len(req.Rows) > maxExecuteRows {
		c.JSON(http.StatusRequestEntityTooLarge, gin.H{
			"message": fmt.Sprintf("数据行数超出后端处理限制（最大 %d 行，当前 %d 行）", maxExecuteRows, len(req.Rows)),
		})
		return
	}

	// strategy 白名单校验
	if req.Strategy != "SKIP" && req.Strategy != "OVERWRITE" {
		c.JSON(http.StatusBadRequest, gin.H{
			"message": fmt.Sprintf("非法的策略值: %s，仅支持 SKIP 或 OVERWRITE", req.Strategy),
		})
		return
	}
	scope, err := ctrl.resolveCurrentUserDataScope(c)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "获取数据范围失败"})
		return
	}
	if err := ensureDormImportRowsWritable(scope, req.Rows); err != nil {
		c.JSON(http.StatusForbidden, gin.H{"message": err.Error()})
		return
	}

	result, err := ctrl.service.BatchImportDormsV2(req.Rows, req.Strategy)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "导入执行失败: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, result)
}

// ImportDormsV2Async V2版本异步导入宿舍（支持进度轮询）
func (ctrl *InfrastructureController) ImportDormsV2Async(c *gin.Context) {
	var req model.DormImportExecuteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "数据格式错误: " + err.Error()})
		return
	}

	if len(req.Rows) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"message": "导入数据为空"})
		return
	}
	scope, err := ctrl.resolveCurrentUserDataScope(c)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "获取数据范围失败"})
		return
	}
	if err := ensureDormImportRowsWritable(scope, req.Rows); err != nil {
		c.JSON(http.StatusForbidden, gin.H{"message": err.Error()})
		return
	}

	// 创建任务
	taskService := service.GetImportTaskService()
	jobId, err := taskService.CreateTask(len(req.Rows))
	if err != nil {
		// Redis 不可用，降级为同步执行
		ctrl.ImportDormsV2(c)
		return
	}

	// 提取审计信息（必须在主 goroutine 中提取）
	operatorID, _ := c.Get("userId")
	operatorName, _ := c.Get("fullName")
	clientIP := c.ClientIP()

	// 启动后台任务
	go func() {
		result, execErr := ctrl.service.BatchImportDormsV2WithProgress(req.Rows, req.Strategy, jobId, taskService)

		if execErr != nil {
			taskService.FailTask(jobId, execErr)
			return
		}

		// 标记完成
		taskService.CompleteTask(jobId, result)

		// 记录审计日志
		service.LogAudit(service.AuditLogParams{
			Action:      service.AuditActionImport,
			Module:      service.AuditModuleDorm,
			Description: fmt.Sprintf("V2异步导入宿舍数据，成功 %d 条（新增 %d，更新 %d），跳过 %d 条，失败 %d 条", result.SuccessCount, result.CreatedCount, result.UpdatedCount, result.SkippedCount, result.FailedCount),
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
	c.JSON(http.StatusAccepted, gin.H{
		"jobId":   jobId,
		"message": "导入任务已创建，请轮询进度接口获取状态",
	})
}
