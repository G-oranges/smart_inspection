package controller

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/my-project/backend-go/internal/model"
	"github.com/my-project/backend-go/internal/service"
	"gorm.io/gorm"
)

type AppealController struct {
	db      *gorm.DB
	service service.AppealService
}

func NewAppealController(db *gorm.DB, service service.AppealService) *AppealController {
	return &AppealController{db: db, service: service}
}

func (ctrl *AppealController) Create(c *gin.Context) {
	var req struct {
		InspectionID string `json:"inspectionId" binding:"required"`
		StudentID    string `json:"studentId"`
		Content      string `json:"content" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "参数错误"})
		return
	}

	studentID := req.StudentID
	if studentID == "" {
		// 如果未提供 studentId，尝试从当前登录用户推断
		userID, _ := c.Get("userId")
		if userID != nil {
			var student model.Student
			if err := ctrl.db.Where("userId = ?", userID.(string)).First(&student).Error; err == nil {
				studentID = student.ID
			}
		}
	}

	if studentID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"message": "无法确定学生身份"})
		return
	}

	appeal, err := ctrl.service.SubmitAppeal(req.InspectionID, studentID, req.Content)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, appeal)
}

func (ctrl *AppealController) GetAppeals(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "10"))
	status := c.Query("status")

	scope, err := resolveDataScopeForCurrentUser(ctrl.db, c)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "获取数据范围失败"})
		return
	}
	if !scope.All && !scope.HasAcademicAccess() && !scope.HasDormitoryAccess() {
		c.JSON(http.StatusOK, gin.H{"appeals": []model.Appeal{}, "total": 0})
		return
	}

	appeals, _, err := ctrl.service.GetAppeals(1, 10000, status)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}
	appeals = filterAppealsByScope(appeals, scope)
	total := len(appeals)
	start, end := paginateRange(page, pageSize, total)
	appeals = appeals[start:end]

	c.JSON(http.StatusOK, gin.H{
		"appeals": appeals,
		"total":   total,
	})
}

func (ctrl *AppealController) UpdateStatus(c *gin.Context) {
	id := c.Param("id")
	var req struct {
		Status string `json:"status" binding:"required"`
		Reply  string `json:"reply"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "参数错误"})
		return
	}

	if err := ctrl.service.ProcessAppeal(id, req.Status, req.Reply); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "审批成功"})
}

// GetMyAppeals 获取当前学生的申诉记录（移动端）
func (ctrl *AppealController) GetMyAppeals(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "10"))
	userID, _ := c.Get("userId")

	// 1. 获取学生 ID
	var student model.Student
	if err := ctrl.db.Where("userId = ?", userID.(string)).First(&student).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"message": "未找到学生信息"})
		return
	}

	// 2. 获取申诉记录
	appeals, total, err := ctrl.service.GetMyAppeals(page, pageSize, student.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"appeals": appeals,
		"total":   total,
	})
}
