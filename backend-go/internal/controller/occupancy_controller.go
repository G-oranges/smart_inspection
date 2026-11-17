package controller

import (
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/my-project/backend-go/internal/model"
	"github.com/my-project/backend-go/internal/service"
	"gorm.io/gorm"
)

type OccupancyController struct {
	db *gorm.DB
}

func NewOccupancyController(db *gorm.DB) *OccupancyController {
	return &OccupancyController{db: db}
}

// GetStats 获取入住管理统计数据
func (ctrl *OccupancyController) GetStats(c *gin.Context) {
	// 总宿舍数
	var totalDorms int64
	ctrl.db.Model(&model.Dormitory{}).Count(&totalDorms)

	// 总床位数（从 dormitory.capacity 汇总）
	var totalBedsSum struct {
		Total int64 `gorm:"column:total"`
	}
	ctrl.db.Model(&model.Dormitory{}).Select("COALESCE(SUM(capacity), 0) as total").Scan(&totalBedsSum)
	totalBeds := totalBedsSum.Total

	// 已入住床位数（从 dormbed 表统计 studentId 非空的记录）
	var occupiedBeds int64
	ctrl.db.Model(&model.DormBed{}).Where("studentId IS NOT NULL AND studentId != ''").Count(&occupiedBeds)

	// 本月移动次数
	now := time.Now()
	firstDayOfMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
	var monthlyMoves int64
	ctrl.db.Model(&model.ResidencyLog{}).
		Where("type = ? AND createdAt >= ?", "MOVE", firstDayOfMonth).
		Count(&monthlyMoves)

	// 计算入住率
	var occupancyRate float64 = 0
	if totalBeds > 0 {
		occupancyRate = float64(occupiedBeds) / float64(totalBeds) * 100
		occupancyRate = float64(int(occupancyRate*100)) / 100 // 保留两位小数
	}

	c.JSON(http.StatusOK, gin.H{
		"totalDorms":    totalDorms,
		"totalBeds":     totalBeds,
		"occupiedBeds":  occupiedBeds,
		"monthlyMoves":  monthlyMoves,
		"availableBeds": maxInt64(0, totalBeds-occupiedBeds),
		"occupancyRate": occupancyRate,
	})
}

// AssignBed 分配入住 (Check-in)
func (ctrl *OccupancyController) AssignBed(c *gin.Context) {
	var req struct {
		DormID    string `json:"dormId" binding:"required"`
		BedNo     string `json:"bedNo" binding:"required"`
		StudentID string `json:"studentId" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "缺少必要参数"})
		return
	}
	scope, err := resolveDataScopeForCurrentUser(ctrl.db, c)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "获取数据范围失败"})
		return
	}
	if err := ensureStudentAndDormWritable(ctrl.db, scope, req.StudentID, req.DormID); err != nil {
		c.JSON(http.StatusForbidden, gin.H{"message": err.Error()})
		return
	}

	var dormDesc string
	operatorUsername := "system"
	if username, exists := c.Get("fullName"); exists {
		operatorUsername = fmt.Sprintf("%v", username)
	}

	// 开始事务
	err = ctrl.db.Transaction(func(tx *gorm.DB) error {
		// 1. 查找床位
		var bed model.DormBed
		if err := tx.Where("dormId = ? AND bedNo = ?", req.DormID, req.BedNo).First(&bed).Error; err != nil {
			return err
		}

		// 2. 检查床位是否已被占用
		if bed.StudentID != nil && *bed.StudentID != "" {
			return gorm.ErrRecordNotFound // 床位已被占用
		}

		// 3. 更新床位信息
		if err := tx.Model(&bed).Updates(map[string]interface{}{
			"studentId": req.StudentID,
			"status":    "occupied",
		}).Error; err != nil {
			return err
		}

		// 4. 更新学生宿舍信息
		var dorm model.Dormitory
		if err := tx.First(&dorm, "id = ?", req.DormID).Error; err != nil {
			return err
		}

		if err := tx.Model(&model.Student{}).Where("id = ?", req.StudentID).Updates(map[string]interface{}{
			"dormId":   req.DormID,
			"building": dorm.Building,
			"roomNo":   dorm.RoomNo,
			"bedNo":    req.BedNo,
		}).Error; err != nil {
			return err
		}

		// 5. 创建 ResidencyLog 记录
		dormDesc = fmt.Sprintf("%s-%s-%s", ptrToStr(dorm.Building), ptrToStr(dorm.RoomNo), req.BedNo)
		residencyLog := model.ResidencyLog{
			StudentID: req.StudentID,
			Type:      "CHECK_IN",
			CurrDorm:  &dormDesc,
			Operator:  operatorUsername,
		}
		if err := tx.Create(&residencyLog).Error; err != nil {
			return err
		}

		return nil
	})

	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "分配失败: " + err.Error()})
		return
	}

	// 记录审计日志
	operatorID, _ := c.Get("userId")
	operatorName, _ := c.Get("fullName")
	ipAddress := c.ClientIP()
	service.LogAudit(service.AuditLogParams{
		Action:       service.AuditActionUpdate,
		Module:       service.AuditModuleDorm,
		TargetID:     req.StudentID,
		Description:  fmt.Sprintf("办理学生入住：分配到宿舍 %s 床位 %s", dormDesc, req.BedNo),
		NewValue:     map[string]interface{}{"dormId": req.DormID, "bedNo": req.BedNo, "studentId": req.StudentID},
		OperatorID:   fmt.Sprintf("%v", operatorID),
		OperatorName: fmt.Sprintf("%v", operatorName),
		IPAddress:    ipAddress,
	})

	c.JSON(http.StatusOK, gin.H{"message": "分配成功"})
}

// MoveBed 迁宿 (Move)
func (ctrl *OccupancyController) MoveBed(c *gin.Context) {
	var req struct {
		StudentID    string `json:"studentId" binding:"required"`
		TargetDormID string `json:"targetDormId" binding:"required"`
		TargetBedNo  string `json:"targetBedNo" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "缺少必要参数"})
		return
	}
	scope, err := resolveDataScopeForCurrentUser(ctrl.db, c)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "获取数据范围失败"})
		return
	}
	if err := ensureMoveWritable(ctrl.db, scope, req.StudentID, req.TargetDormID); err != nil {
		c.JSON(http.StatusForbidden, gin.H{"message": err.Error()})
		return
	}

	var prevDormDesc, currDormDesc string
	operatorUsername := "system"
	if username, exists := c.Get("fullName"); exists {
		operatorUsername = fmt.Sprintf("%v", username)
	}

	err = ctrl.db.Transaction(func(tx *gorm.DB) error {
		// 0. 获取学生当前位置
		var student model.Student
		if err := tx.First(&student, "id = ?", req.StudentID).Error; err != nil {
			return err
		}
		prevDormDesc = fmt.Sprintf("%s-%s-%s", ptrToStr(student.DormBuilding), ptrToStr(student.DormRoomNo), ptrToStr(student.BedNo))

		// 1. 释放原床位
		if err := tx.Model(&model.DormBed{}).
			Where("studentId = ?", req.StudentID).
			Updates(map[string]interface{}{
				"studentId": nil,
				"status":    "available",
			}).Error; err != nil {
			return err
		}

		// 2. 查找新床位
		var newBed model.DormBed
		if err := tx.Where("dormId = ? AND bedNo = ?", req.TargetDormID, req.TargetBedNo).First(&newBed).Error; err != nil {
			return err
		}

		// 3. 检查新床位是否已被占用
		if newBed.StudentID != nil && *newBed.StudentID != "" {
			return gorm.ErrRecordNotFound
		}

		// 4. 分配新床位
		if err := tx.Model(&newBed).Updates(map[string]interface{}{
			"studentId": req.StudentID,
			"status":    "occupied",
		}).Error; err != nil {
			return err
		}

		// 5. 更新学生宿舍信息
		var dorm model.Dormitory
		if err := tx.First(&dorm, "id = ?", req.TargetDormID).Error; err != nil {
			return err
		}

		if err := tx.Model(&model.Student{}).Where("id = ?", req.StudentID).Updates(map[string]interface{}{
			"dormId":   req.TargetDormID,
			"building": dorm.Building,
			"roomNo":   dorm.RoomNo,
			"bedNo":    req.TargetBedNo,
		}).Error; err != nil {
			return err
		}

		// 6. 创建 ResidencyLog 记录
		currDormDesc = fmt.Sprintf("%s-%s-%s", ptrToStr(dorm.Building), ptrToStr(dorm.RoomNo), req.TargetBedNo)
		residencyLog := model.ResidencyLog{
			StudentID: req.StudentID,
			Type:      "MOVE",
			PrevDorm:  &prevDormDesc,
			CurrDorm:  &currDormDesc,
			Operator:  operatorUsername,
		}
		if err := tx.Create(&residencyLog).Error; err != nil {
			return err
		}

		return nil
	})

	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "迁宿失败: " + err.Error()})
		return
	}

	// 记录审计日志
	operatorID, _ := c.Get("userId")
	operatorName, _ := c.Get("fullName")
	ipAddress := c.ClientIP()
	service.LogAudit(service.AuditLogParams{
		Action:       service.AuditActionUpdate,
		Module:       service.AuditModuleDorm,
		TargetID:     req.StudentID,
		Description:  fmt.Sprintf("迁宿: 学生移至 %s 床位 %s", req.TargetDormID, req.TargetBedNo),
		NewValue:     map[string]interface{}{"targetDormId": req.TargetDormID, "targetBedNo": req.TargetBedNo, "studentId": req.StudentID},
		OperatorID:   fmt.Sprintf("%v", operatorID),
		OperatorName: fmt.Sprintf("%v", operatorName),
		IPAddress:    ipAddress,
	})

	c.JSON(http.StatusOK, gin.H{"message": "迁宿成功"})
}

// SwapBed 互换床位 (Swap)
func (ctrl *OccupancyController) SwapBed(c *gin.Context) {
	var req struct {
		StudentID1 string `json:"studentId1" binding:"required"`
		StudentID2 string `json:"studentId2" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "缺少学生 ID"})
		return
	}
	scope, err := resolveDataScopeForCurrentUser(ctrl.db, c)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "获取数据范围失败"})
		return
	}
	if err := ensureSwapWritable(ctrl.db, scope, []string{req.StudentID1, req.StudentID2}); err != nil {
		c.JSON(http.StatusForbidden, gin.H{"message": err.Error()})
		return
	}

	operatorUsername := "system"
	if username, exists := c.Get("fullName"); exists {
		operatorUsername = fmt.Sprintf("%v", username)
	}

	err = ctrl.db.Transaction(func(tx *gorm.DB) error {
		// 1. 获取两个学生的床位信息
		var bed1, bed2 model.DormBed
		if err := tx.Where("studentId = ?", req.StudentID1).First(&bed1).Error; err != nil {
			return err
		}
		if err := tx.Where("studentId = ?", req.StudentID2).First(&bed2).Error; err != nil {
			return err
		}

		// 保存原始床位信息用于后续更新学生表和 ResidencyLog
		bed1ID := bed1.ID
		bed1DormID := bed1.DormID
		bed1BedNo := bed1.BedNo
		bed2DormID := bed2.DormID
		bed2BedNo := bed2.BedNo

		// 2. 使用三步置换来避免唯一索引冲突 (studentId 是唯一的)
		// 步骤 2.1: 先将床位1的 studentId 设为 NULL
		if err := tx.Model(&model.DormBed{}).Where("id = ?", bed1ID).Update("studentId", nil).Error; err != nil {
			return err
		}
		// 步骤 2.2: 将床位2的 studentId 设为 学生1
		if err := tx.Model(&model.DormBed{}).Where("studentId = ?", req.StudentID2).Update("studentId", req.StudentID1).Error; err != nil {
			return err
		}
		// 步骤 2.3: 将床位1的 studentId 设为 学生2
		if err := tx.Model(&model.DormBed{}).Where("id = ?", bed1ID).Update("studentId", req.StudentID2).Error; err != nil {
			return err
		}

		// 3. 更新学生的宿舍信息
		var dorm1, dorm2 model.Dormitory
		tx.First(&dorm1, "id = ?", bed1DormID)
		tx.First(&dorm2, "id = ?", bed2DormID)

		s1Desc := fmt.Sprintf("%s-%s-%s", ptrToStr(dorm1.Building), ptrToStr(dorm1.RoomNo), bed1BedNo)
		s2Desc := fmt.Sprintf("%s-%s-%s", ptrToStr(dorm2.Building), ptrToStr(dorm2.RoomNo), bed2BedNo)

		// 学生1 -> 床位2的宿舍信息
		tx.Model(&model.Student{}).Where("id = ?", req.StudentID1).Updates(map[string]interface{}{
			"dormId":   bed2DormID,
			"building": dorm2.Building,
			"roomNo":   dorm2.RoomNo,
			"bedNo":    bed2BedNo,
		})

		// 学生2 -> 床位1的宿舍信息
		tx.Model(&model.Student{}).Where("id = ?", req.StudentID2).Updates(map[string]interface{}{
			"dormId":   bed1DormID,
			"building": dorm1.Building,
			"roomNo":   dorm1.RoomNo,
			"bedNo":    bed1BedNo,
		})

		// 4. 创建 ResidencyLog 记录 (为两个学生各创建一条)
		residencyLog1 := model.ResidencyLog{
			StudentID: req.StudentID1,
			Type:      "EXCHANGE",
			PrevDorm:  &s1Desc,
			CurrDorm:  &s2Desc,
			Operator:  operatorUsername,
		}
		if err := tx.Create(&residencyLog1).Error; err != nil {
			return err
		}

		residencyLog2 := model.ResidencyLog{
			StudentID: req.StudentID2,
			Type:      "EXCHANGE",
			PrevDorm:  &s2Desc,
			CurrDorm:  &s1Desc,
			Operator:  operatorUsername,
		}
		if err := tx.Create(&residencyLog2).Error; err != nil {
			return err
		}

		return nil
	})

	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "互换失败: " + err.Error()})
		return
	}

	// 记录审计日志
	operatorID, _ := c.Get("userId")
	operatorName, _ := c.Get("fullName")
	ipAddress := c.ClientIP()
	service.LogAudit(service.AuditLogParams{
		Action:       service.AuditActionUpdate,
		Module:       service.AuditModuleDorm,
		Description:  fmt.Sprintf("互换床位: 学生 %s 与 %s 互换", req.StudentID1, req.StudentID2),
		NewValue:     map[string]interface{}{"studentId1": req.StudentID1, "studentId2": req.StudentID2},
		OperatorID:   fmt.Sprintf("%v", operatorID),
		OperatorName: fmt.Sprintf("%v", operatorName),
		IPAddress:    ipAddress,
	})

	c.JSON(http.StatusOK, gin.H{"message": "互换成功"})
}

// CheckoutStudent 退宿 (Checkout)
func (ctrl *OccupancyController) CheckoutStudent(c *gin.Context) {
	var req struct {
		StudentID string `json:"studentId" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "缺少学生 ID"})
		return
	}
	scope, err := resolveDataScopeForCurrentUser(ctrl.db, c)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "获取数据范围失败"})
		return
	}
	if err := ensureStudentsWritable(ctrl.db, scope, []string{req.StudentID}, true, studentDormWriteScopeMessage); err != nil {
		c.JSON(http.StatusForbidden, gin.H{"message": err.Error()})
		return
	}

	var prevDormDesc string
	operatorUsername := "system"
	if username, exists := c.Get("fullName"); exists {
		operatorUsername = fmt.Sprintf("%v", username)
	}

	err = ctrl.db.Transaction(func(tx *gorm.DB) error {
		// 0. 获取学生当前位置
		var student model.Student
		if err := tx.First(&student, "id = ?", req.StudentID).Error; err != nil {
			return err
		}
		prevDormDesc = fmt.Sprintf("%s-%s-%s", ptrToStr(student.DormBuilding), ptrToStr(student.DormRoomNo), ptrToStr(student.BedNo))

		// 1. 释放床位
		if err := tx.Model(&model.DormBed{}).
			Where("studentId = ?", req.StudentID).
			Updates(map[string]interface{}{
				"studentId": nil,
				"status":    "available",
			}).Error; err != nil {
			return err
		}

		// 2. 清除学生宿舍信息（后续将被联查替代，暂时保留同步更新）
		if err := tx.Model(&model.Student{}).Where("id = ?", req.StudentID).Updates(map[string]interface{}{
			"dormId":   nil,
			"building": nil,
			"roomNo":   nil,
			"bedNo":    nil,
		}).Error; err != nil {
			return err
		}

		// 3. 创建 ResidencyLog 记录
		residencyLog := model.ResidencyLog{
			StudentID: req.StudentID,
			Type:      "CHECK_OUT",
			PrevDorm:  &prevDormDesc,
			Operator:  operatorUsername,
		}
		if err := tx.Create(&residencyLog).Error; err != nil {
			return err
		}

		return nil
	})

	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "退宿失败: " + err.Error()})
		return
	}

	// 记录审计日志
	operatorID, _ := c.Get("userId")
	operatorName, _ := c.Get("fullName")
	ipAddress := c.ClientIP()
	service.LogAudit(service.AuditLogParams{
		Action:       service.AuditActionUpdate,
		Module:       service.AuditModuleDorm,
		TargetID:     req.StudentID,
		Description:  fmt.Sprintf("办理学生退宿：从 %s 退出", prevDormDesc),
		OperatorID:   fmt.Sprintf("%v", operatorID),
		OperatorName: fmt.Sprintf("%v", operatorName),
		IPAddress:    ipAddress,
	})

	c.JSON(http.StatusOK, gin.H{"message": "退宿成功"})
}

// PreviewImportOccupancyV2 预览入住导入 (V2) - 优化版：批量预加载避免 N+1
func (ctrl *OccupancyController) PreviewImportOccupancyV2(c *gin.Context) {
	var req model.OccupancyImportPreviewRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "请求格式无效: " + err.Error()})
		return
	}

	resp := model.OccupancyImportPreviewResponse{
		TotalCount: len(req.Rows),
		Issues:     []model.OccupancyImportIssue{},
	}

	if resp.TotalCount == 0 {
		c.JSON(http.StatusOK, resp)
		return
	}

	// --- 1. 批量预加载数据 ---
	studentNos := []string{}
	buildingRoomPairs := []string{}
	for _, r := range req.Rows {
		if r.StudentNo != nil && *r.StudentNo != "" {
			studentNos = append(studentNos, *r.StudentNo)
		}
		if r.Building != nil && *r.Building != "" && r.RoomNo != nil && *r.RoomNo != "" {
			buildingRoomPairs = append(buildingRoomPairs, fmt.Sprintf("%s|%s", *r.Building, *r.RoomNo))
		}
	}

	// 查询学生
	var students []model.Student
	studentMap := make(map[string]model.Student)
	ctrl.db.Where("studentNo IN ?", studentNos).Find(&students)
	for _, s := range students {
		studentMap[ptrToStr(s.StudentNo)] = s
	}

	// 查询对应的宿舍 (通过 Building + RoomNo 组合查询)
	var dorms []model.Dormitory
	dormMap := make(map[string]model.Dormitory)
	// 简单起见，按楼栋过滤后在内存匹配，或执行复合查询
	uniqueBuildings := []string{}
	uBuildMap := make(map[string]bool)
	for _, r := range req.Rows {
		if r.Building != nil && !uBuildMap[*r.Building] {
			uniqueBuildings = append(uniqueBuildings, *r.Building)
			uBuildMap[*r.Building] = true
		}
	}
	ctrl.db.Where("building IN ?", uniqueBuildings).Find(&dorms)
	for _, d := range dorms {
		dormMap[fmt.Sprintf("%s|%s", ptrToStr(d.Building), ptrToStr(d.RoomNo))] = d
	}

	// 查询涉及的所有床位及当前占用情况
	dormIDs := []string{}
	for _, d := range dormMap {
		dormIDs = append(dormIDs, d.ID)
	}
	var beds []model.DormBed
	bedMap := make(map[string]model.DormBed)
	if len(dormIDs) > 0 {
		ctrl.db.Where("dormId IN ?", dormIDs).Find(&beds)
		for _, b := range beds {
			bedMap[fmt.Sprintf("%s|%s", b.DormID, b.BedNo)] = b
		}
	}

	// --- 2. 逐行校验 ---
	for _, row := range req.Rows {
		// A. 基础字段完整性
		if row.StudentNo == nil || *row.StudentNo == "" || row.Building == nil || *row.Building == "" ||
			row.RoomNo == nil || *row.RoomNo == "" || row.BedNo == nil || *row.BedNo == "" {
			resp.IssueCount++
			resp.Issues = append(resp.Issues, model.OccupancyImportIssue{
				RowNo:      row.RowNo,
				ErrorType:  "A",
				ErrorCode:  model.ErrMissingRequiredField,
				Reason:     "必填信息缺失",
				Suggestion: "请检查并补齐学号、楼栋、房间和床位号",
			})
			continue
		}

		// B. 实体存在性 (B类)
		student, sOk := studentMap[*row.StudentNo]
		if !sOk {
			resp.IssueCount++
			resp.Issues = append(resp.Issues, model.OccupancyImportIssue{
				RowNo:          row.RowNo,
				ErrorType:      "B",
				ErrorCode:      model.ErrStudentNotFound,
				Reason:         fmt.Sprintf("学号 [%s] 不存在", *row.StudentNo),
				Suggestion:     "请先在学生管理中录入该学生",
				AffectedFields: []string{"studentNo"},
			})
			continue
		}

		dorm, dOk := dormMap[fmt.Sprintf("%s|%s", *row.Building, *row.RoomNo)]
		if !dOk {
			resp.IssueCount++
			resp.Issues = append(resp.Issues, model.OccupancyImportIssue{
				RowNo:          row.RowNo,
				ErrorType:      "B",
				ErrorCode:      model.ErrDormNotFound,
				Reason:         fmt.Sprintf("宿舍 [%s %s] 未定义", *row.Building, *row.RoomNo),
				Suggestion:     "请先核对楼栋/房间号是否正确",
				AffectedFields: []string{"building", "roomNo"},
			})
			continue
		}

		bed, bOk := bedMap[fmt.Sprintf("%s|%s", dorm.ID, *row.BedNo)]
		if !bOk {
			resp.IssueCount++
			resp.Issues = append(resp.Issues, model.OccupancyImportIssue{
				RowNo:          row.RowNo,
				ErrorType:      "B",
				ErrorCode:      model.ErrBedNotFound,
				Reason:         fmt.Sprintf("床位 [%s] 不存在", *row.BedNo),
				Suggestion:     "该宿舍内没有此床位号，请核对",
				AffectedFields: []string{"bedNo"},
			})
			continue
		}

		// C. 冲突校验 (C类)
		// 1) 该学生是否已经在其他床位？
		var currentBed model.DormBed
		hasCurrent := ctrl.db.Where("studentId = ?", student.ID).First(&currentBed).Error == nil
		if hasCurrent && currentBed.ID != bed.ID {
			resp.IssueCount++
			resp.Issues = append(resp.Issues, model.OccupancyImportIssue{
				RowNo:          row.RowNo,
				ErrorType:      "C",
				ErrorCode:      model.ErrStudentAlreadyIn,
				Reason:         fmt.Sprintf("该生目前已在 %s-%s", ptrToStr(student.DormBuilding), ptrToStr(student.DormRoomNo)),
				Suggestion:     "覆盖策略：迁宿（自动释放原床位）；跳过策略：维持现状",
				AffectedFields: []string{"studentNo"},
			})
		}

		// 2) 目标床位是否被他人占用？
		if bed.StudentID != nil && *bed.StudentID != "" && *bed.StudentID != student.ID {
			resp.IssueCount++
			resp.Issues = append(resp.Issues, model.OccupancyImportIssue{
				RowNo:          row.RowNo,
				ErrorType:      "C",
				ErrorCode:      model.ErrBedAlreadyOccupied,
				Reason:         "目标床位已被另一名学生占用",
				Suggestion:     "不支持自动抢占他人床位，请核对数据或手动处理",
				AffectedFields: []string{"bedNo"},
			})
		}
	}
	scope, err := resolveDataScopeForCurrentUser(ctrl.db, c)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "获取数据范围失败"})
		return
	}
	scopeIssues, err := collectOccupancyImportScopeIssues(ctrl.db, scope, req.Rows)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "获取数据范围失败"})
		return
	}
	if len(scopeIssues) > 0 {
		resp.IssueCount += len(scopeIssues)
		resp.Issues = append(resp.Issues, scopeIssues...)
	}

	resp.PassCount = resp.TotalCount - resp.IssueCount
	c.JSON(http.StatusOK, resp)
}

// ImportOccupancyV2 执行入住导入 (V2) - 实现严格冲突语义与批量事务
func (ctrl *OccupancyController) ImportOccupancyV2(c *gin.Context) {
	var req model.OccupancyImportExecuteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "请求格式无效: " + err.Error()})
		return
	}
	scope, err := resolveDataScopeForCurrentUser(ctrl.db, c)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "获取数据范围失败"})
		return
	}
	if err := ensureOccupancyImportRowsWritable(ctrl.db, scope, req.Rows); err != nil {
		c.JSON(http.StatusForbidden, gin.H{"message": err.Error()})
		return
	}

	resp := model.OccupancyImportExecuteResponse{
		TotalCount: len(req.Rows),
	}

	operatorUsername := "system"
	if username, exists := c.Get("fullName"); exists {
		operatorUsername = fmt.Sprintf("%v", username)
	}

	// 事务块
	err = ctrl.db.Transaction(func(tx *gorm.DB) error {
		for _, row := range req.Rows {
			// A. 获取实体
			var student model.Student
			if err := tx.Where("studentNo = ?", *row.StudentNo).First(&student).Error; err != nil {
				resp.FailedCount++
				continue
			}

			var dorm model.Dormitory
			if err := tx.Where("building = ? AND roomNo = ?", *row.Building, *row.RoomNo).First(&dorm).Error; err != nil {
				resp.FailedCount++
				continue
			}

			var targetBed model.DormBed
			if err := tx.Where("dormId = ? AND bedNo = ?", dorm.ID, *row.BedNo).First(&targetBed).Error; err != nil {
				resp.FailedCount++
				continue
			}

			// B. 冲突语义判定 (关键逻辑)
			// 1. 检查目标床位是否被他人占用 (不可抢占性质)
			if targetBed.StudentID != nil && *targetBed.StudentID != "" && *targetBed.StudentID != student.ID {
				resp.FailedCount++
				resp.FailedRows = append(resp.FailedRows, model.OccupancyImportIssue{
					RowNo:     row.RowNo,
					ErrorCode: model.ErrBedAlreadyOccupied,
					Reason:    "目标床位已被他人占用，导入失败（不允许自动抢占）",
				})
				continue
			}

			// 2. 检查学生目前是否已有其他床位
			var oldBed model.DormBed
			hasOld := tx.Where("studentId = ?", student.ID).First(&oldBed).Error == nil

			if hasOld {
				// 2.1 幂等判定：已经在目标床位了
				if oldBed.ID == targetBed.ID {
					resp.SkippedCount++
					resp.SuccessCount++
					continue
				}

				// 2.2 冲突判定：在别的床位
				if req.Strategy == "SKIP" {
					resp.SkippedCount++
					continue
				}

				// OVERWRITE: 释放旧座 (同一事务)
				if err := tx.Model(&oldBed).Updates(map[string]interface{}{
					"studentId": nil,
					"status":    "available",
				}).Error; err != nil {
					resp.FailedCount++
					continue
				}
				resp.UpdatedCount++
			} else {
				resp.CreatedCount++
			}

			// C. 执行入住分配
			if err := tx.Model(&targetBed).Updates(map[string]interface{}{
				"studentId": student.ID,
				"status":    "occupied",
			}).Error; err != nil {
				resp.FailedCount++
				continue
			}

			// 同步冗余字段 (阶段3过渡)
			tx.Model(&student).Updates(map[string]interface{}{
				"dormId":   dorm.ID,
				"building": dorm.Building,
				"roomNo":   dorm.RoomNo,
				"bedNo":    targetBed.BedNo,
			})

			// 记录流水
			currDormDesc := fmt.Sprintf("%s-%s-%s", ptrToStr(dorm.Building), ptrToStr(dorm.RoomNo), targetBed.BedNo)
			logType := "CHECK_IN"
			if hasOld {
				logType = "MOVE"
			}
			tx.Create(&model.ResidencyLog{
				StudentID: student.ID,
				Type:      logType,
				CurrDorm:  &currDormDesc,
				Operator:  operatorUsername,
			})

			resp.SuccessCount++
		}
		return nil
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "导入处理失败: " + err.Error()})
		return
	}

	// 审计日志...
	operatorID, _ := c.Get("userId")
	operatorName, _ := c.Get("fullName")
	service.LogAudit(service.AuditLogParams{
		Action:       service.AuditActionImport,
		Module:       service.AuditModuleDorm,
		Description:  fmt.Sprintf("入住信息导入: 成功%d, 其中新入%d, 迁宿%d, 跳过%d, 失败%d", resp.SuccessCount, resp.CreatedCount, resp.UpdatedCount, resp.SkippedCount, resp.FailedCount),
		NewValue:     resp,
		OperatorID:   fmt.Sprintf("%v", operatorID),
		OperatorName: fmt.Sprintf("%v", operatorName),
		IPAddress:    c.ClientIP(),
	})

	c.JSON(http.StatusOK, resp)
}

// ImportOccupancyV2Async V2版本异步入住导入（支持进度轮询）
func (ctrl *OccupancyController) ImportOccupancyV2Async(c *gin.Context) {
	var req model.OccupancyImportExecuteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "请求格式无效: " + err.Error()})
		return
	}

	if len(req.Rows) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"message": "导入数据为空"})
		return
	}
	scope, err := resolveDataScopeForCurrentUser(ctrl.db, c)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "获取数据范围失败"})
		return
	}
	if err := ensureOccupancyImportRowsWritable(ctrl.db, scope, req.Rows); err != nil {
		c.JSON(http.StatusForbidden, gin.H{"message": err.Error()})
		return
	}

	// 创建任务
	taskService := service.GetImportTaskService()
	jobId, createErr := taskService.CreateTask(len(req.Rows))
	if createErr != nil {
		// Redis 不可用，降级为同步执行
		ctrl.ImportOccupancyV2(c)
		return
	}

	// 提取审计信息（必须在主 goroutine 中提取）
	operatorID, _ := c.Get("userId")
	operatorName, _ := c.Get("fullName")
	clientIP := c.ClientIP()
	operatorUsername := "system"
	if username, exists := c.Get("fullName"); exists {
		operatorUsername = fmt.Sprintf("%v", username)
	}

	// 复制需要的变量到闭包
	db := ctrl.db
	rows := req.Rows
	strategy := req.Strategy

	// 启动后台任务
	go func() {
		resp := model.OccupancyImportExecuteResponse{
			TotalCount: len(rows),
		}

		// 事务块
		txErr := db.Transaction(func(tx *gorm.DB) error {
			for i, row := range rows {
				// 更新进度
				taskService.UpdateProgress(jobId, i+1)

				// A. 获取实体
				var student model.Student
				if err := tx.Where("studentNo = ?", *row.StudentNo).First(&student).Error; err != nil {
					resp.FailedCount++
					continue
				}

				var dorm model.Dormitory
				if err := tx.Where("building = ? AND roomNo = ?", *row.Building, *row.RoomNo).First(&dorm).Error; err != nil {
					resp.FailedCount++
					continue
				}

				var targetBed model.DormBed
				if err := tx.Where("dormId = ? AND bedNo = ?", dorm.ID, *row.BedNo).First(&targetBed).Error; err != nil {
					resp.FailedCount++
					continue
				}

				// B. 冲突语义判定 (关键逻辑)
				// 1. 检查目标床位是否被他人占用 (不可抢占性质)
				if targetBed.StudentID != nil && *targetBed.StudentID != "" && *targetBed.StudentID != student.ID {
					resp.FailedCount++
					resp.FailedRows = append(resp.FailedRows, model.OccupancyImportIssue{
						RowNo:     row.RowNo,
						ErrorCode: model.ErrBedAlreadyOccupied,
						Reason:    "目标床位已被他人占用，导入失败（不允许自动抢占）",
					})
					continue
				}

				// 2. 检查学生目前是否已有其他床位
				var oldBed model.DormBed
				hasOld := tx.Where("studentId = ?", student.ID).First(&oldBed).Error == nil

				if hasOld {
					// 2.1 幂等判定：已经在目标床位了
					if oldBed.ID == targetBed.ID {
						resp.SkippedCount++
						resp.SuccessCount++
						continue
					}

					// 2.2 冲突判定：在别的床位
					if strategy == "SKIP" {
						resp.SkippedCount++
						continue
					}

					// OVERWRITE: 释放旧座 (同一事务)
					if err := tx.Model(&oldBed).Updates(map[string]interface{}{
						"studentId": nil,
						"status":    "available",
					}).Error; err != nil {
						resp.FailedCount++
						continue
					}
					resp.UpdatedCount++
				} else {
					resp.CreatedCount++
				}

				// C. 执行入住分配
				if err := tx.Model(&targetBed).Updates(map[string]interface{}{
					"studentId": student.ID,
					"status":    "occupied",
				}).Error; err != nil {
					resp.FailedCount++
					continue
				}

				// 同步冗余字段 (阶段3过渡)
				tx.Model(&student).Updates(map[string]interface{}{
					"dormId":   dorm.ID,
					"building": dorm.Building,
					"roomNo":   dorm.RoomNo,
					"bedNo":    targetBed.BedNo,
				})

				// 记录流水
				currDormDesc := fmt.Sprintf("%s-%s-%s", ptrToStr(dorm.Building), ptrToStr(dorm.RoomNo), targetBed.BedNo)
				logType := "CHECK_IN"
				if hasOld {
					logType = "MOVE"
				}
				tx.Create(&model.ResidencyLog{
					StudentID: student.ID,
					Type:      logType,
					CurrDorm:  &currDormDesc,
					Operator:  operatorUsername,
				})

				resp.SuccessCount++
			}
			return nil
		})

		if txErr != nil {
			taskService.FailTask(jobId, txErr)
			return
		}

		// 标记完成
		taskService.CompleteTask(jobId, resp)

		// 审计日志
		service.LogAudit(service.AuditLogParams{
			Action:       service.AuditActionImport,
			Module:       service.AuditModuleDorm,
			Description:  fmt.Sprintf("V2异步入住导入: 成功%d, 其中新入%d, 迁宿%d, 跳过%d, 失败%d", resp.SuccessCount, resp.CreatedCount, resp.UpdatedCount, resp.SkippedCount, resp.FailedCount),
			NewValue:     resp,
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

func maxInt64(a, b int64) int64 {
	if a > b {
		return a
	}
	return b
}
