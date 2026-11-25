package controller

import (
	"bytes"
	"encoding/json"
	"image"
	"image/png"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/my-project/backend-go/internal/model"
	"github.com/my-project/backend-go/internal/repository"
	"github.com/my-project/backend-go/internal/service"
)

func TestAppealPrivatePhotosAndStudentIdentity(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := newWriteScopeTestDB(t)
	if err := db.AutoMigrate(&model.Appeal{}, &model.Inspection{}, &model.SystemSettings{}); err != nil {
		t.Fatal(err)
	}
	score := 90
	for _, row := range []any{
		&model.Dormitory{ID: "dorm"},
		&model.Student{ID: "owner", FullName: "Owner", UserID: strPtr("owner-user"), DormID: strPtr("dorm")},
		&model.Student{ID: "other", FullName: "Other", UserID: strPtr("other-user"), DormID: strPtr("dorm")},
		&model.Inspection{ID: "inspection", DormID: strPtr("dorm"), TotalScore: &score, CreatedAt: time.Now().Add(-time.Hour)},
	} {
		if err := db.Create(row).Error; err != nil {
			t.Fatal(err)
		}
	}
	ctrl := NewAppealController(db, service.NewAppealService(db, repository.NewAppealRepository(db), nil))
	ctrl.photos.uploadDir = t.TempDir()
	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("userId", c.GetHeader("X-Test-User"))
		c.Set("role", model.RoleStudent)
	})
	router.POST("/api/appeals/photos", ctrl.UploadPhoto)
	router.POST("/api/appeals", ctrl.Create)
	router.GET("/api/appeals/:id/photos/:photoId", ctrl.GetPhoto)
	request := func(method, path, user, contentType string, body []byte) *httptest.ResponseRecorder {
		req := httptest.NewRequest(method, path, bytes.NewReader(body))
		req.Header.Set("X-Test-User", user)
		req.Header.Set("Content-Type", contentType)
		resp := httptest.NewRecorder()
		router.ServeHTTP(resp, req)
		return resp
	}

	var buffer bytes.Buffer
	form := multipart.NewWriter(&buffer)
	imagePart, err := form.CreateFormFile("file", "photo.png")
	if err != nil {
		t.Fatal(err)
	}
	if err := png.Encode(imagePart, image.NewRGBA(image.Rect(0, 0, 2, 2))); err != nil {
		t.Fatal(err)
	}
	if err := form.Close(); err != nil {
		t.Fatal(err)
	}
	upload := request(http.MethodPost, "/api/appeals/photos", "owner-user", form.FormDataContentType(), buffer.Bytes())
	var uploaded struct {
		PhotoID string `json:"photoId"`
	}
	if err := json.Unmarshal(upload.Body.Bytes(), &uploaded); upload.Code != http.StatusCreated || err != nil || uploaded.PhotoID == "" {
		t.Fatalf("upload: %d %s (%v)", upload.Code, upload.Body, err)
	}

	payload, _ := json.Marshal(map[string]any{
		"studentId": "other", "inspectionId": "inspection", "content": "请复核本宿舍查寝情况", "photos": []string{uploaded.PhotoID},
	})
	if resp := request(http.MethodPost, "/api/appeals", "other-user", "application/json", payload); resp.Code != http.StatusBadRequest {
		t.Fatalf("other student attached private upload: %d %s", resp.Code, resp.Body)
	}
	created := request(http.MethodPost, "/api/appeals", "owner-user", "application/json", payload)
	var appeal struct {
		StudentID string   `json:"studentId"`
		Photos    []string `json:"photos"`
	}
	if err := json.Unmarshal(created.Body.Bytes(), &appeal); created.Code != http.StatusCreated || err != nil || appeal.StudentID != "owner" || len(appeal.Photos) != 1 {
		t.Fatalf("create: %d %s (%v)", created.Code, created.Body, err)
	}
	if resp := request(http.MethodGet, appeal.Photos[0], "other-user", "", nil); resp.Code != http.StatusForbidden {
		t.Fatalf("other student read evidence: %d %s", resp.Code, resp.Body)
	}
	if resp := request(http.MethodGet, appeal.Photos[0], "owner-user", "", nil); resp.Code != http.StatusOK || resp.Header().Get("Cache-Control") != "private, no-store" || resp.Header().Get("Content-Type") != "image/png" {
		t.Fatalf("owner read: %d, %v", resp.Code, resp.Header())
	}
}
