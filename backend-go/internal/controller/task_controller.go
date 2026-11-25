package controller

import (
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/my-project/backend-go/internal/model"
	"github.com/my-project/backend-go/internal/repository"
	"github.com/my-project/backend-go/internal/service"
	"gorm.io/gorm"
)

type TaskController struct {
	db      *gorm.DB
	service service.TaskService
}

func NewTaskController(db *gorm.DB, service service.TaskService) *TaskController {
	return &TaskController{db: db, service: service}
}

func (ctrl *TaskController) CreateTask(c *gin.Context) {
	var req service.CreateTaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "参数错误: " + err.Error()})
		return
	}
	scope, err := resolveDataScopeForCurrentUser(ctrl.db, c)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "获取数据范围失败"})
		return
	}
	if err := ensureTaskRequestedDormsWritable(ctrl.db, scope, req.DormIds); err != nil {
		c.JSON(http.StatusForbidden, gin.H{"message": err.Error()})
		return
	}

	userID, _ := c.Get("userId")
	task, err := ctrl.service.CreateTask(req, userID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}

	// 记录创建审计日志
	operatorName, _ := c.Get("fullName")
	service.LogAudit(service.AuditLogParams{
		Action:       service.AuditActionCreate,
		Module:       service.AuditModuleTask,
		TargetID:     task.ID,
		TargetName:   task.Title,
		Description:  fmt.Sprintf("创建查寝任务: %s", task.Title),
		NewValue:     map[string]interface{}{"title": task.Title, "date": task.Date},
		OperatorID:   fmt.Sprintf("%v", userID),
		OperatorName: fmt.Sprintf("%v", operatorName),
		IPAddress:    c.ClientIP(),
	})

	c.JSON(http.StatusCreated, gin.H{"task": task})
}

func (ctrl *TaskController) GetTasks(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "10"))

	scope, err := resolveDataScopeForCurrentUser(ctrl.db, c)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "获取数据范围失败"})
		return
	}
	if !scope.All && !scope.HasDormitoryAccess() {
		c.JSON(http.StatusOK, gin.H{"tasks": []gin.H{}, "total": 0})
		return
	}

	tasks, _, err := ctrl.service.GetTasks(1, 10000)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}
	tasks = filterTasksByScope(tasks, scope)
	total := len(tasks)
	start, end := paginateRange(page, pageSize, total)
	tasks = tasks[start:end]

	// 格式化返回数据，添加 dormIds, executorIds, createdByName
	formattedTasks := make([]gin.H, 0, len(tasks))
	for _, t := range tasks {
		// 提取 dormIds
		dormIds := make([]string, 0, len(t.Dorms))
		for _, d := range t.Dorms {
			dormIds = append(dormIds, d.DormID)
		}

		// 提取完整的执行人信息 (ID + 姓名)
		executors := make([]gin.H, 0, len(t.Executors))
		executorIds := make([]string, 0, len(t.Executors))
		for _, e := range t.Executors {
			name := "未知"
			if e.Executor.FullName != "" {
				name = e.Executor.FullName
			}
			executors = append(executors, gin.H{
				"id":       e.ExecutorID,
				"fullName": name,
			})
			executorIds = append(executorIds, e.ExecutorID)
		}

		createdByName := "未知"
		if t.CreatedBy != nil {
			createdByName = t.CreatedBy.FullName
		}

		formattedTasks = append(formattedTasks, gin.H{
			"id":              t.ID,
			"title":           t.Title,
			"date":            t.Date,
			"timeSlot":        t.TimeSlot,
			"executor":        t.Executor,
			"notes":           t.Notes,
			"description":     t.Description,
			"deadline":        t.Deadline,
			"status":          t.Status,
			"roleRequired":    t.RoleRequired,
			"scoringItems":    t.ScoringItems,
			"createdById":     t.CreatedByID,
			"createdByName":   createdByName,
			"createdAt":       t.CreatedAt,
			"dormIds":         dormIds,
			"executorIds":     executorIds,
			"executors":       executors,
			"inspectionCount": t.InspectedCount,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"tasks": formattedTasks,
		"total": total,
	})
}

func (ctrl *TaskController) GetTaskByID(c *gin.Context) {
	id := c.Param("id")
	scope, err := resolveDataScopeForCurrentUser(ctrl.db, c)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "获取数据范围失败"})
		return
	}
	if !scope.All && !scope.HasDormitoryAccess() {
		c.JSON(http.StatusNotFound, gin.H{"message": "任务不存在"})
		return
	}

	task, err := ctrl.service.GetTaskByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"message": "任务不存在"})
		return
	}
	filteredTask, ok := filterTaskForScope(*task, scope)
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{"message": "任务不存在"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"task": filteredTask})
}

// findTaskOr404 读取任务；不存在时直接写入 404 响应并返回 false。
func (ctrl *TaskController) findTaskOr404(c *gin.Context, id string) (*model.Task, bool) {
	task, err := ctrl.service.GetTaskWithDormIDsByID(id)
	if err != nil || task == nil {
		if err == nil || errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"message": "任务不存在"})
			return nil, false
		}
		c.JSON(http.StatusInternalServerError, gin.H{"message": "读取任务失败"})
		return nil, false
	}
	return task, true
}

func (ctrl *TaskController) DeleteTask(c *gin.Context) {
	id := c.Param("id")
	// 先确认任务存在：不存在时返回 404，而不是走到后面变成 500 或误报成功
	task, ok := ctrl.findTaskOr404(c, id)
	if !ok {
		return
	}
	scope, err := resolveDataScopeForCurrentUser(ctrl.db, c)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "获取数据范围失败"})
		return
	}
	if err := ensureTaskCurrentDormsWritable(ctrl.db, scope, id); err != nil {
		c.JSON(http.StatusForbidden, gin.H{"message": err.Error()})
		return
	}

	if err := ctrl.service.DeleteTask(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}

	// 记录删除审计日志
	userID, _ := c.Get("userId")
	operatorName, _ := c.Get("fullName")
	taskTitle := task.Title
	service.LogAudit(service.AuditLogParams{
		Action:       service.AuditActionDelete,
		Module:       service.AuditModuleTask,
		TargetID:     id,
		TargetName:   taskTitle,
		Description:  fmt.Sprintf("删除查寝任务: %s", taskTitle),
		OperatorID:   fmt.Sprintf("%v", userID),
		OperatorName: fmt.Sprintf("%v", operatorName),
		IPAddress:    c.ClientIP(),
	})

	c.Status(http.StatusNoContent)
}

func (ctrl *TaskController) UpdateTask(c *gin.Context) {
	id := c.Param("id")
	// 获取更新前的任务（同时用于存在性校验和审计对比；使用较轻量的方法，避免大规模关联导致占位符超限）
	oldTask, ok := ctrl.findTaskOr404(c, id)
	if !ok {
		return
	}
	scope, err := resolveDataScopeForCurrentUser(ctrl.db, c)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "获取数据范围失败"})
		return
	}
	if err := ensureTaskCurrentDormsWritable(ctrl.db, scope, id); err != nil {
		c.JSON(http.StatusForbidden, gin.H{"message": err.Error()})
		return
	}

	var req service.UpdateTaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "参数错误: " + err.Error()})
		return
	}
	if len(req.DormIds) > 0 {
		if err := ensureTaskRequestedDormsWritable(ctrl.db, scope, req.DormIds); err != nil {
			c.JSON(http.StatusForbidden, gin.H{"message": err.Error()})
			return
		}
	}

	task, err := ctrl.service.UpdateTask(id, req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}

	// 记录更新审计日志，含字段变更详情
	changes := buildTaskChanges(oldTask, task, req)
	userID, _ := c.Get("userId")
	operatorName, _ := c.Get("fullName")
	service.LogAudit(service.AuditLogParams{
		Action:       service.AuditActionUpdate,
		Module:       service.AuditModuleTask,
		TargetID:     task.ID,
		TargetName:   task.Title,
		Description:  changes.description,
		OldValue:     changes.oldValue,
		NewValue:     changes.newValue,
		OperatorID:   fmt.Sprintf("%v", userID),
		OperatorName: fmt.Sprintf("%v", operatorName),
		IPAddress:    c.ClientIP(),
	})

	c.JSON(http.StatusOK, gin.H{"task": task})
}

// GetMyAssignedDorms 获取当前执行者分配的宿舍（移动端）
func (ctrl *TaskController) GetMyAssignedDorms(c *gin.Context) {
	taskId := c.Param("id")
	userID, _ := c.Get("userId")

	building := c.Query("building")
	floor := c.Query("floor")
	campus := c.Query("campus")
	search := c.Query("search")

	dorms, err := ctrl.service.GetMyAssignedDorms(taskId, userID.(string), building, floor, campus, search)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"dorms": dorms})
}

// SubmitTaskInspection 按任务和宿舍录入分数（用于首次或特定任务录入）
func (ctrl *TaskController) SubmitTaskInspection(c *gin.Context) {
	taskId := c.Param("id")
	userID, _ := c.Get("userId")

	type SubmitReq struct {
		DormId     string      `json:"dormId"`
		TotalScore int         `json:"totalScore"`
		Comments   string      `json:"comments"`
		PhotoUrls  []string    `json:"photoUrls"`
		Detail     interface{} `json:"detail"`
	}

	var req SubmitReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "参数错误"})
		return
	}

	if req.DormId == "" {
		c.JSON(http.StatusBadRequest, gin.H{"message": "宿舍ID缺失"})
		return
	}

	err := ctrl.service.SubmitTaskInspection(taskId, req.DormId, userID.(string), req.TotalScore, req.Comments, req.PhotoUrls, req.Detail)
	if err != nil {
		if errors.Is(err, repository.ErrInspectionChanged) {
			respondAppealError(c, err)
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "结果已保存"})
}

// taskChangesResult 存储任务变更对比结果
type taskChangesResult struct {
	description string
	oldValue    map[string]interface{}
	newValue    map[string]interface{}
}

// buildTaskChanges 构建任务更新的变更详情
func buildTaskChanges(oldTask, newTask *model.Task, req service.UpdateTaskRequest) taskChangesResult {
	if oldTask == nil || newTask == nil {
		return taskChangesResult{
			description: fmt.Sprintf("更新查寝任务: %s", newTask.Title),
		}
	}

	changes := []string{}
	oldValue := map[string]interface{}{}
	newValue := map[string]interface{}{}

	// 检查标题变更
	if req.Title != nil && oldTask.Title != newTask.Title {
		changes = append(changes, fmt.Sprintf("标题: \"%s\" → \"%s\"", oldTask.Title, newTask.Title))
		oldValue["title"] = oldTask.Title
		newValue["title"] = newTask.Title
	}

	// 检查日期变更
	formatDate := func(t *time.Time) string {
		if t == nil {
			return "未设置"
		}
		return t.Format("2006-01-02 15:04")
	}
	if req.Date != nil {
		oldDate := formatDate(oldTask.Date)
		newDate := formatDate(newTask.Date)
		if oldDate != newDate {
			changes = append(changes, fmt.Sprintf("日期: %s → %s", oldDate, newDate))
			oldValue["date"] = oldTask.Date
			newValue["date"] = newTask.Date
		}
	}

	// 检查时间段变更
	if req.TimeSlot != nil {
		oldTS := ""
		if oldTask.TimeSlot != nil {
			oldTS = *oldTask.TimeSlot
		}
		if oldTS != *req.TimeSlot {
			changes = append(changes, fmt.Sprintf("时间段: \"%s\" → \"%s\"", oldTS, *req.TimeSlot))
			oldValue["timeSlot"] = oldTS
			newValue["timeSlot"] = *req.TimeSlot
		}
	}

	// 检查状态变更
	if req.Status != nil {
		oldStatus := ""
		if oldTask.Status != nil {
			oldStatus = *oldTask.Status
		}
		if oldStatus != *req.Status {
			changes = append(changes, fmt.Sprintf("状态: \"%s\" → \"%s\"", oldStatus, *req.Status))
			oldValue["status"] = oldStatus
			newValue["status"] = *req.Status
		}
	}

	// 检查所需角色变更
	if req.RoleRequired != nil {
		oldRole := ""
		if oldTask.RoleRequired != nil {
			oldRole = *oldTask.RoleRequired
		}
		if oldRole != *req.RoleRequired {
			changes = append(changes, fmt.Sprintf("所需角色: \"%s\" → \"%s\"", oldRole, *req.RoleRequired))
			oldValue["roleRequired"] = oldRole
			newValue["roleRequired"] = *req.RoleRequired
		}
	}

	// 检查描述变更
	if req.Description != nil {
		oldDesc := ""
		if oldTask.Description != nil {
			oldDesc = *oldTask.Description
		}
		if oldDesc != *req.Description {
			changes = append(changes, "描述已更新")
			oldValue["description"] = oldDesc
			newValue["description"] = *req.Description
		}
	}

	// 检查截止时间变更
	if req.Deadline != nil {
		oldDeadline := formatDate(oldTask.Deadline)
		newDeadline := formatDate(newTask.Deadline)
		if oldDeadline != newDeadline {
			changes = append(changes, fmt.Sprintf("截止时间: %s → %s", oldDeadline, newDeadline))
			oldValue["deadline"] = oldTask.Deadline
			newValue["deadline"] = newTask.Deadline
		}
	}

	// 检查备注变更
	if req.Notes != nil {
		oldNotes := ""
		newNotes := ""
		if oldTask.Notes != nil {
			oldNotes = *oldTask.Notes
		}
		if newTask.Notes != nil {
			newNotes = *newTask.Notes
		}
		if oldNotes != newNotes {
			changes = append(changes, "备注已更新")
			oldValue["notes"] = oldNotes
			newValue["notes"] = newNotes
		}
	}

	// 检查评分项变更
	if req.ScoringItems != nil {
		changes = append(changes, "评分标准已更新")
		oldValue["scoringItems"] = oldTask.ScoringItems
		newValue["scoringItems"] = newTask.ScoringItems
	}

	// 检查宿舍数量变更
	if len(req.DormIds) > 0 {
		oldCount := len(oldTask.Dorms)
		newCount := len(newTask.Dorms)
		if oldCount != newCount {
			changes = append(changes, fmt.Sprintf("宿舍数量: %d → %d", oldCount, newCount))
			oldValue["dormCount"] = oldCount
			newValue["dormCount"] = newCount
		}
	}

	// 检查执行人数量变更
	if len(req.ExecutorIds) > 0 {
		oldCount := len(oldTask.Executors)
		newCount := len(newTask.Executors)
		if oldCount != newCount {
			changes = append(changes, fmt.Sprintf("执行人数量: %d → %d", oldCount, newCount))
			oldValue["executorCount"] = oldCount
			newValue["executorCount"] = newCount
		}
	}

	description := fmt.Sprintf("更新查寝任务: %s", newTask.Title)
	if len(changes) > 0 {
		description = fmt.Sprintf("更新查寝任务 \"%s\": %s", newTask.Title, strings.Join(changes, "; "))
	}

	return taskChangesResult{
		description: description,
		oldValue:    oldValue,
		newValue:    newValue,
	}
}
