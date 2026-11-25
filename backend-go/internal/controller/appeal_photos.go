package controller

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"slices"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/my-project/backend-go/internal/middleware"
	"github.com/my-project/backend-go/internal/model"
	"github.com/my-project/backend-go/internal/service"
	"gorm.io/gorm"
)

func (ctrl *AppealController) appealPhotoPath(userID, photoID string) (string, bool) {
	ext := filepath.Ext(photoID)
	if userID == "" || !allowedExtensions[ext] {
		return "", false
	}
	id, err := uuid.Parse(strings.TrimSuffix(photoID, ext))
	if err != nil || id.String()+ext != photoID {
		return "", false
	}
	hash := sha256.Sum256([]byte(userID))
	return filepath.Join(ctrl.photos.uploadDir, hex.EncodeToString(hash[:]), photoID), true
}

func (ctrl *AppealController) UploadPhoto(c *gin.Context) {
	if !middleware.CheckPermissionInController(c, "APPEAL_HANDLE") {
		if _, err := ctrl.currentStudent(c); err != nil {
			if err == gorm.ErrRecordNotFound {
				err = service.ErrAppealForbidden
			}
			respondAppealError(c, err)
			return
		}
	}
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, MaxFileSize+64*1024)
	file, err := c.FormFile("file")
	if err != nil {
		respondAppealError(c, service.ErrAppealInvalid)
		return
	}
	if err := ctrl.photos.validateFile(file); err != nil {
		respondAppealError(c, fmt.Errorf("%w: %v", service.ErrAppealInvalid, err))
		return
	}
	photoID := uuid.NewString() + strings.ToLower(filepath.Ext(file.Filename))
	path, ok := ctrl.appealPhotoPath(c.GetString("userId"), photoID)
	if !ok {
		respondAppealError(c, service.ErrAppealForbidden)
		return
	}
	if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		respondAppealError(c, err)
		return
	}
	if err := c.SaveUploadedFile(file, path); err != nil {
		_ = os.Remove(path)
		respondAppealError(c, err)
		return
	}
	c.JSON(http.StatusCreated, gin.H{"photoId": photoID})
}

func (ctrl *AppealController) validateAppealPhotos(userID string, photos []string) error {
	if len(photos) > MaxBatchFiles {
		return fmt.Errorf("%w: 每条申诉最多上传 %d 张图片", service.ErrAppealInvalid, MaxBatchFiles)
	}
	seen := map[string]bool{}
	for _, photo := range photos {
		path, ok := ctrl.appealPhotoPath(userID, photo)
		if !ok || seen[photo] {
			return fmt.Errorf("%w: 图片标识无效或重复", service.ErrAppealInvalid)
		}
		seen[photo] = true
		info, err := os.Stat(path)
		if os.IsNotExist(err) || (err == nil && !info.Mode().IsRegular()) {
			return fmt.Errorf("%w: 图片不存在或不属于当前账号", service.ErrAppealInvalid)
		}
		if err != nil {
			return err
		}
	}
	return nil
}

func (ctrl *AppealController) GetPhoto(c *gin.Context) {
	appeal, err := ctrl.service.GetDetail(c.Param("id"))
	if err != nil {
		respondAppealError(c, err)
		return
	}
	var student model.Student
	err = ctrl.db.Select("id").Where("userId = ?", c.GetString("userId")).First(&student).Error
	if err != nil && err != gorm.ErrRecordNotFound {
		respondAppealError(c, err)
		return
	}
	if student.ID != appeal.StudentID {
		if !middleware.CheckPermissionInController(c, "APPEAL_VIEW", "APPEAL_HANDLE") {
			respondAppealError(c, service.ErrAppealForbidden)
			return
		}
		scope, err := resolveDataScopeForCurrentUser(ctrl.db, c)
		if err != nil {
			respondAppealError(c, err)
			return
		}
		if len(filterAppealsByScope([]model.Appeal{*appeal}, scope)) == 0 {
			respondAppealError(c, service.ErrAppealForbidden)
			return
		}
	}
	var photos []string
	photoID := c.Param("photoId")
	if appeal.PhotoUploaderID == nil || json.Unmarshal(appeal.Photos, &photos) != nil || !slices.Contains(photos, photoID) {
		respondAppealError(c, gorm.ErrRecordNotFound)
		return
	}
	path, ok := ctrl.appealPhotoPath(*appeal.PhotoUploaderID, photoID)
	if !ok {
		respondAppealError(c, gorm.ErrRecordNotFound)
		return
	}
	file, err := os.Open(path)
	if os.IsNotExist(err) {
		respondAppealError(c, gorm.ErrRecordNotFound)
		return
	}
	if err != nil {
		respondAppealError(c, err)
		return
	}
	defer file.Close()
	info, err := file.Stat()
	if err != nil || !info.Mode().IsRegular() {
		respondAppealError(c, gorm.ErrRecordNotFound)
		return
	}
	c.Header("Cache-Control", "private, no-store")
	c.Header("X-Content-Type-Options", "nosniff")
	if contentType := mime.TypeByExtension(filepath.Ext(photoID)); contentType != "" {
		c.Header("Content-Type", contentType)
	}
	http.ServeContent(c.Writer, c.Request, photoID, info.ModTime(), file)
}
