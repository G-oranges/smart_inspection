package controller

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/my-project/backend-go/internal/model"
	"gorm.io/gorm"
)

// AvatarController 用户头像上传控制器
// 独立于照片上传，仅需登录即可使用
type AvatarController struct {
	db        *gorm.DB
	uploadDir string
}

// NewAvatarController 创建头像控制器
func NewAvatarController(db *gorm.DB) *AvatarController {
	return &AvatarController{
		db:        db,
		uploadDir: "./data/uploads/avatars",
	}
}

// UploadAvatar 上传并更新用户头像
// POST /api/uploads/avatar
func (ctrl *AvatarController) UploadAvatar(c *gin.Context) {
	// 1. 获取当前登录用户
	userID, exists := c.Get("userId")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"message": "未登录"})
		return
	}

	// 2. 获取上传文件
	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "未找到上传文件"})
		return
	}

	// 3. 文件大小限制：2MB（头像不需要太大）
	const maxAvatarSize = 2 * 1024 * 1024
	if file.Size > maxAvatarSize {
		c.JSON(http.StatusBadRequest, gin.H{
			"message": fmt.Sprintf("头像文件不能超过 2MB (当前: %.2fMB)", float64(file.Size)/(1024*1024)),
		})
		return
	}

	// 4. 检查扩展名
	ext := strings.ToLower(filepath.Ext(file.Filename))
	allowed := map[string]bool{".jpg": true, ".jpeg": true, ".png": true, ".webp": true}
	if !allowed[ext] {
		c.JSON(http.StatusBadRequest, gin.H{"message": "仅支持 JPG/PNG/WebP 格式"})
		return
	}

	// 5. 确保目录存在
	if err := os.MkdirAll(ctrl.uploadDir, 0755); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "创建目录失败"})
		return
	}

	// 6. 生成唯一文件名
	newFileName := fmt.Sprintf("avatar-%d-%s%s", time.Now().Unix(), uuid.New().String()[:8], ext)
	dst := filepath.Join(ctrl.uploadDir, newFileName)

	if err := c.SaveUploadedFile(file, dst); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "保存文件失败"})
		return
	}

	// 7. 更新用户 avatarUrl
	avatarURL := fmt.Sprintf("/uploads/avatars/%s", newFileName)

	result := ctrl.db.Model(&model.User{}).Where("id = ?", userID).Update("avatarUrl", avatarURL)
	if result.Error != nil {
		// 清理已上传的文件
		os.Remove(dst)
		c.JSON(http.StatusInternalServerError, gin.H{"message": "更新头像失败"})
		return
	}

	// 8. 删除旧头像文件（可选，忽略错误）
	var user model.User
	if err := ctrl.db.Select("avatarUrl").Where("id = ?", userID).First(&user).Error; err == nil {
		if user.AvatarURL != nil && *user.AvatarURL != "" && *user.AvatarURL != avatarURL {
			oldPath := filepath.Join("./data", strings.TrimPrefix(*user.AvatarURL, "/"))
			os.Remove(oldPath)
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"url":     avatarURL,
		"message": "头像已更新",
	})
}
