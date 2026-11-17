package controller

import (
	"fmt"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/my-project/backend-go/internal/middleware"
	"github.com/my-project/backend-go/internal/model"
	"github.com/my-project/backend-go/internal/repository"
	"github.com/my-project/backend-go/internal/service"
	"gorm.io/gorm"
)

type AuditController struct {
	db *gorm.DB
}

func NewAuditController(db *gorm.DB) *AuditController {
	return &AuditController{db: db}
}

func (ctrl *AuditController) GetLogs(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "10"))

	// 获取筛选参数
	keyword := c.Query("keyword")
	dateFrom := c.Query("dateFrom")
	dateTo := c.Query("dateTo")

	var logs []model.AuditLog
	var total int64

	db := ctrl.db.Model(&model.AuditLog{}).Preload("Operator")

	// 应用筛选条件
	if actions := c.QueryArray("action"); len(actions) > 0 {
		db = db.Where("action IN ?", actions)
	}
	if modules := c.QueryArray("module"); len(modules) > 0 {
		db = db.Where("module IN ?", modules)
	}
	if keyword != "" {
		searchPattern := "%" + keyword + "%"
		db = db.Where("(description LIKE ? OR targetName LIKE ? OR operatorName LIKE ?)",
			searchPattern, searchPattern, searchPattern)
	}
	if dateFrom != "" {
		db = db.Where("createdAt >= ?", dateFrom)
	}
	if dateTo != "" {
		db = db.Where("createdAt <= ?", dateTo)
	}

	// 排序
	db = db.Order("createdAt DESC")

	// 计算总数（应用筛选后）
	db.Count(&total)

	err := db.Scopes(repository.Paginate(page, pageSize)).Find(&logs).Error
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}

	// 格式化为前端期望的格式
	items := make([]gin.H, 0, len(logs))
	for _, log := range logs {
		item := gin.H{
			"id":           log.ID,
			"action":       log.Action,
			"module":       log.Module,
			"targetId":     log.TargetID,
			"targetName":   log.TargetName,
			"description":  log.Description,
			"operatorId":   log.OperatorID,
			"operatorName": log.OperatorName,
			"ipAddress":    log.IPAddress,
			"createdAt":    log.CreatedAt,
		}
		if log.Operator != nil {
			item["operator"] = gin.H{
				"id":       log.Operator.ID,
				"username": log.Operator.Username,
				"fullName": log.Operator.FullName,
			}
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

// GetStats 获取审计日志统计
func (ctrl *AuditController) GetStats(c *gin.Context) {
	// 按操作类型统计
	var byAction []struct {
		Action string `gorm:"column:action"`
		Count  int64  `gorm:"column:count"`
	}
	ctrl.db.Model(&model.AuditLog{}).
		Select("action, COUNT(*) as count").
		Group("action").
		Scan(&byAction)

	// 按模块统计
	var byModule []struct {
		Module string `gorm:"column:module"`
		Count  int64  `gorm:"column:count"`
	}
	ctrl.db.Model(&model.AuditLog{}).
		Select("module, COUNT(*) as count").
		Group("module").
		Scan(&byModule)

	// 总数
	var total int64
	ctrl.db.Model(&model.AuditLog{}).Count(&total)

	c.JSON(http.StatusOK, gin.H{
		"total":    total,
		"byAction": byAction,
		"byModule": byModule,
	})
}

// GetOptions 获取审计日志筛选选项
func (ctrl *AuditController) GetOptions(c *gin.Context) {
	// 操作类型中文标签
	actionLabels := map[string]string{
		"CREATE":            "创建",
		"UPDATE":            "更新",
		"DELETE":            "删除",
		"LOGIN":             "登录",
		"LOGOUT":            "登出",
		"LOGIN_FAILED":      "登录失败",
		"PERMISSION_CHANGE": "权限变更",
		"PASSWORD_RESET":    "密码重置",
		"DISABLE":           "禁用",
		"ENABLE":            "启用",
		"IMPORT":            "导入",
		"EXPORT":            "导出",
	}

	// 模块中文标签
	moduleLabels := map[string]string{
		"USER":       "用户管理",
		"DORM":       "宿舍管理",
		"STUDENT":    "学生管理",
		"TEACHER":    "教师管理",
		"TASK":       "任务管理",
		"INSPECTION": "查寝记录",
		"PERMISSION": "权限配置",
		"ROLE":       "角色管理",
		"SETTINGS":   "系统设置",
		"AUTH":       "身份认证",
	}

	// 获取所有不同的 action 值
	var actions []string
	ctrl.db.Model(&model.AuditLog{}).
		Distinct("action").
		Pluck("action", &actions)

	// 转换为 {value, label} 格式
	actionOptions := make([]gin.H, 0, len(actions))
	for _, action := range actions {
		label := actionLabels[action]
		if label == "" {
			label = action
		}
		actionOptions = append(actionOptions, gin.H{
			"value": action,
			"label": label,
		})
	}

	// 获取所有不同的 module 值
	var modules []string
	ctrl.db.Model(&model.AuditLog{}).
		Distinct("module").
		Pluck("module", &modules)

	// 转换为 {value, label} 格式
	moduleOptions := make([]gin.H, 0, len(modules))
	for _, module := range modules {
		label := moduleLabels[module]
		if label == "" {
			label = module
		}
		moduleOptions = append(moduleOptions, gin.H{
			"value": module,
			"label": label,
		})
	}

	// 获取所有操作者
	var operators []struct {
		ID       string `gorm:"column:operatorId"`
		FullName string `gorm:"column:operatorName"`
	}
	ctrl.db.Model(&model.AuditLog{}).
		Distinct("operatorId", "operatorName").
		Where("operatorId IS NOT NULL").
		Scan(&operators)

	// 转换操作者为 {value, label} 格式
	operatorOptions := make([]gin.H, 0, len(operators))
	for _, op := range operators {
		operatorOptions = append(operatorOptions, gin.H{
			"value": op.ID,
			"label": op.FullName,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"actions":   actionOptions,
		"modules":   moduleOptions,
		"operators": operatorOptions,
	})
}

// DeleteLogs 批量删除审计日志
func (ctrl *AuditController) DeleteLogs(c *gin.Context) {
	// 二次权限校验（纵深防御）
	if !middleware.CheckPermissionInController(c, "PERMISSION_MANAGE") {
		c.JSON(http.StatusForbidden, gin.H{"message": "Forbidden: 权限不足"})
		return
	}

	var req struct {
		Ids []string `json:"ids"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "参数错误"})
		return
	}

	if len(req.Ids) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"message": "请选择要删除的记录"})
		return
	}

	if err := ctrl.db.Where("id IN ?", req.Ids).Delete(&model.AuditLog{}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "删除失败: " + err.Error()})
		return
	}

	// 记录删除审计日志的操作（这本身也是敏感操作）
	operatorID, _ := c.Get("userId")
	operatorName, _ := c.Get("fullName")
	service.LogAudit(service.AuditLogParams{
		Action:       service.AuditActionDelete,
		Module:       "AUDIT",
		Description:  fmt.Sprintf("删除 %d 条审计日志", len(req.Ids)),
		NewValue:     map[string]interface{}{"deletedIds": req.Ids, "count": len(req.Ids)},
		OperatorID:   fmt.Sprintf("%v", operatorID),
		OperatorName: fmt.Sprintf("%v", operatorName),
		IPAddress:    c.ClientIP(),
	})

	c.JSON(http.StatusOK, gin.H{"message": "删除成功", "count": len(req.Ids)})
}
