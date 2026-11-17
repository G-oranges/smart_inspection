package controller

import (
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// 文件上传配置常量
const (
	// 单文件最大大小：10MB
	MaxFileSize = 10 * 1024 * 1024
	// 批量上传最大文件数
	MaxBatchFiles = 10
)

// 允许的图片 MIME 类型
var allowedMimeTypes = map[string]bool{
	"image/jpeg": true,
	"image/jpg":  true,
	"image/png":  true,
	"image/gif":  true,
	"image/webp": true,
	"image/bmp":  true,
}

// 允许的图片扩展名
var allowedExtensions = map[string]bool{
	".jpg":  true,
	".jpeg": true,
	".png":  true,
	".gif":  true,
	".webp": true,
	".bmp":  true,
}

type UploadController struct {
	uploadDir string
}

func NewUploadController(uploadDir string) *UploadController {
	return &UploadController{uploadDir: uploadDir}
}

// validateFile 验证上传文件的类型、扩展名和大小
func (ctrl *UploadController) validateFile(file *multipart.FileHeader) error {
	// 1. 检查文件大小
	if file.Size > MaxFileSize {
		return fmt.Errorf("文件大小超过限制，单张图片最大 10MB (当前: %.2fMB)", float64(file.Size)/(1024*1024))
	}

	// 2. 检查扩展名
	ext := strings.ToLower(filepath.Ext(file.Filename))
	if !allowedExtensions[ext] {
		return fmt.Errorf("不支持的文件扩展名: %s，仅支持 JPG、PNG、GIF、WebP、BMP 格式", ext)
	}

	// 3. 检查 MIME 类型（从文件头读取）
	src, err := file.Open()
	if err != nil {
		return fmt.Errorf("无法读取文件")
	}
	defer src.Close()

	// 读取前 512 字节用于 MIME 类型检测
	buffer := make([]byte, 512)
	_, err = src.Read(buffer)
	if err != nil && err != io.EOF {
		return fmt.Errorf("无法读取文件内容")
	}

	mimeType := http.DetectContentType(buffer)
	// DetectContentType 返回的类型可能带有 charset，只取主类型
	mimeType = strings.Split(mimeType, ";")[0]

	if !allowedMimeTypes[mimeType] {
		return fmt.Errorf("不支持的文件类型: %s，仅支持 JPG、PNG、GIF、WebP、BMP 格式图片", mimeType)
	}

	return nil
}

// ensureUploadDir 确保上传目录存在
func (ctrl *UploadController) ensureUploadDir() error {
	if _, err := os.Stat(ctrl.uploadDir); os.IsNotExist(err) {
		if err := os.MkdirAll(ctrl.uploadDir, 0755); err != nil {
			return err
		}
	}
	return nil
}

// generateFileName 生成唯一文件名
func (ctrl *UploadController) generateFileName(originalName string) string {
	ext := strings.ToLower(filepath.Ext(originalName))
	return fmt.Sprintf("%d-%s%s", time.Now().Unix(), uuid.New().String()[:8], ext)
}

// UploadFile 单文件上传接口
func (ctrl *UploadController) UploadFile(c *gin.Context) {
	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "未找到上传文件"})
		return
	}

	// 验证文件
	if err := ctrl.validateFile(file); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
		return
	}

	// 确保目录存在
	if err := ctrl.ensureUploadDir(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "创建上传目录失败"})
		return
	}

	// 生成唯一文件名
	newFileName := ctrl.generateFileName(file.Filename)
	dst := filepath.Join(ctrl.uploadDir, newFileName)

	if err := c.SaveUploadedFile(file, dst); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "保存文件失败"})
		return
	}

	// 返回前端可访问的路径
	c.JSON(http.StatusCreated, gin.H{
		"url":  fmt.Sprintf("/uploads/%s", newFileName),
		"name": file.Filename,
	})
}

// UploadBatch 批量上传接口（最多10张）
func (ctrl *UploadController) UploadBatch(c *gin.Context) {
	form, err := c.MultipartForm()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "解析上传文件失败"})
		return
	}

	files := form.File["files"]
	if len(files) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"message": "未收到文件"})
		return
	}

	if len(files) > MaxBatchFiles {
		c.JSON(http.StatusBadRequest, gin.H{"message": fmt.Sprintf("文件数量超过限制，每次最多上传 %d 张图片", MaxBatchFiles)})
		return
	}

	// 确保目录存在
	if err := ctrl.ensureUploadDir(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "创建上传目录失败"})
		return
	}

	// 处理每个文件
	results := make([]gin.H, 0, len(files))
	for _, file := range files {
		// 验证文件
		if err := ctrl.validateFile(file); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
			return
		}

		// 生成唯一文件名并保存
		newFileName := ctrl.generateFileName(file.Filename)
		dst := filepath.Join(ctrl.uploadDir, newFileName)

		if err := c.SaveUploadedFile(file, dst); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "保存文件失败: " + file.Filename})
			return
		}

		results = append(results, gin.H{
			"url":  fmt.Sprintf("/uploads/%s", newFileName),
			"name": file.Filename,
		})
	}

	c.JSON(http.StatusCreated, gin.H{
		"files": results,
		"count": len(results),
	})
}
