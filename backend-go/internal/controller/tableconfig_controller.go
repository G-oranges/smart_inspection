package controller

import (
	"encoding/json"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/my-project/backend-go/internal/model"
	"gorm.io/gorm"
)

type TableConfigController struct {
	db *gorm.DB
}

func NewTableConfigController(db *gorm.DB) *TableConfigController {
	return &TableConfigController{db: db}
}

// GetConfig 获取表格配置
func (ctrl *TableConfigController) GetConfig(c *gin.Context) {
	tableKey := c.Query("tableKey")
	if tableKey == "" {
		c.JSON(http.StatusBadRequest, gin.H{"message": "缺少 tableKey"})
		return
	}

	userId, _ := c.Get("userId")
	userIdStr, _ := userId.(string)

	var configRecord *model.TableConfig
	source := "default"

	// 先查用户级配置
	if userIdStr != "" {
		var userConfig model.TableConfig
		err := ctrl.db.Where("tableKey = ? AND userId = ?", tableKey, userIdStr).
			Order("updatedAt DESC").
			First(&userConfig).Error
		if err == nil {
			configRecord = &userConfig
			source = "user"
		}
	}

	// 如果没有用户级配置，查角色级配置
	if configRecord == nil {
		var roleIds []string
		ctrl.db.Table("_roleentitytouser").
			Select("A").
			Where("B = ?", userIdStr).
			Pluck("A", &roleIds)

		if len(roleIds) > 0 {
			var roleConfig model.TableConfig
			err := ctrl.db.Where("tableKey = ? AND roleId IN ?", tableKey, roleIds).
				Order("updatedAt DESC").
				First(&roleConfig).Error
			if err == nil {
				configRecord = &roleConfig
				source = "role"
			}
		}
	}

	var config interface{} = nil
	if configRecord != nil {
		json.Unmarshal([]byte(configRecord.ConfigJson), &config)
	}

	c.JSON(http.StatusOK, gin.H{
		"config": config,
		"source": source,
	})
}

// SaveConfig 保存表格配置
func (ctrl *TableConfigController) SaveConfig(c *gin.Context) {
	var body struct {
		TableKey string        `json:"tableKey"`
		Config   []interface{} `json:"config"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "无效的请求体"})
		return
	}

	if body.TableKey == "" || len(body.Config) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"message": "配置格式不正确"})
		return
	}

	userId, _ := c.Get("userId")
	userIdStr, _ := userId.(string)

	configJson, _ := json.Marshal(body.Config)

	// Upsert: 先尝试找到现有记录
	var existing model.TableConfig
	err := ctrl.db.Where("tableKey = ? AND userId = ?", body.TableKey, userIdStr).
		First(&existing).Error

	if err == nil {
		// 更新现有记录
		ctrl.db.Model(&existing).Update("configJson", string(configJson))
	} else {
		// 创建新记录
		newConfig := model.TableConfig{
			ID:         uuid.New().String(),
			TableKey:   body.TableKey,
			ConfigJson: string(configJson),
			UserID:     &userIdStr,
		}
		ctrl.db.Create(&newConfig)
	}

	c.JSON(http.StatusOK, gin.H{"message": "字段配置已保存"})
}
