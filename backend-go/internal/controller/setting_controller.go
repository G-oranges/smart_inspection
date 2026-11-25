package controller

import (
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/my-project/backend-go/internal/middleware"
	"github.com/my-project/backend-go/internal/model"
	"github.com/my-project/backend-go/internal/service"
	"gorm.io/gorm"
)

type SettingController struct {
	db *gorm.DB
}

func NewSettingController(db *gorm.DB) *SettingController {
	return &SettingController{db: db}
}

func (ctrl *SettingController) GetSettings(c *gin.Context) {
	var settings model.SystemSettings
	if err := ctrl.db.First(&settings).Error; err != nil {
		// 如果不存在则初始化一个默认的
		settings = model.SystemSettings{ID: 1, InspectionDefaultScore: 100, AppealWindowDays: service.DefaultAppealWindowDays}
	}
	// 包裹在 settings 键中，与前端解析逻辑匹配
	c.JSON(http.StatusOK, gin.H{"settings": settings})
}

func (ctrl *SettingController) UpdateSettings(c *gin.Context) {
	// 强制权限校验（纵深防御）
	if !middleware.CheckPermissionInController(c, "SYSTEM_SETTINGS") {
		c.JSON(http.StatusForbidden, gin.H{"message": "权限不足"})
		return
	}

	var payload struct {
		model.SystemSettings
		AppealWindowDays *int `json:"appealWindowDays"`
	}
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "参数错误"})
		return
	}

	req := payload.SystemSettings
	req.ID = 1 // 强制更新 ID 为 1 的记录
	save := ctrl.db
	if payload.AppealWindowDays != nil {
		if *payload.AppealWindowDays < 1 || *payload.AppealWindowDays > 36500 {
			c.JSON(http.StatusBadRequest, gin.H{"message": "申诉时限须为 1 至 36500 天"})
			return
		}
		req.AppealWindowDays = *payload.AppealWindowDays
	} else {
		save = save.Omit("AppealWindowDays")
	}
	if err := save.Save(&req).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}
	if err := ctrl.db.First(&req, 1).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}

	// 记录更新审计日志
	operatorID, _ := c.Get("userId")
	operatorName, _ := c.Get("fullName")
	service.LogAudit(service.AuditLogParams{
		Action:       service.AuditActionUpdate,
		Module:       service.AuditModuleSettings,
		Description:  "更新系统设置",
		NewValue:     req,
		OperatorID:   fmt.Sprintf("%v", operatorID),
		OperatorName: fmt.Sprintf("%v", operatorName),
		IPAddress:    c.ClientIP(),
	})

	c.JSON(http.StatusOK, gin.H{"settings": req})
}
