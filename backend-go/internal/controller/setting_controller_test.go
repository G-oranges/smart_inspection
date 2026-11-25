package controller

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/my-project/backend-go/internal/model"
)

func TestSettingsAppealWindowSurvivesLegacyUpdate(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := newWriteScopeTestDB(t)
	if err := db.AutoMigrate(&model.SystemSettings{}); err != nil {
		t.Fatal(err)
	}
	ctrl := NewSettingController(db)
	r := gin.New()
	r.Use(func(c *gin.Context) { c.Set("permissions", []string{"SYSTEM_SETTINGS"}) })
	r.GET("/settings", ctrl.GetSettings)
	r.PUT("/settings", ctrl.UpdateSettings)
	request := func(method, body string, want int) model.SystemSettings {
		t.Helper()
		req := httptest.NewRequest(method, "/settings", strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		resp := httptest.NewRecorder()
		r.ServeHTTP(resp, req)
		var result struct {
			Settings model.SystemSettings `json:"settings"`
		}
		if err := json.Unmarshal(resp.Body.Bytes(), &result); err != nil || resp.Code != want {
			t.Fatalf("expected %d, got %d %s (%v)", want, resp.Code, resp.Body, err)
		}
		return result.Settings
	}
	if got := request(http.MethodGet, "", http.StatusOK).AppealWindowDays; got != 7 {
		t.Fatalf("expected default 7, got %d", got)
	}
	request(http.MethodPut, `{"gradingRules":[]}`, http.StatusOK)
	if got := request(http.MethodPut, `{"gradingRules":[],"appealWindowDays":30}`, http.StatusOK).AppealWindowDays; got != 30 {
		t.Fatalf("expected 30, got %d", got)
	}
	if got := request(http.MethodPut, `{"gradingRules":[]}`, http.StatusOK).AppealWindowDays; got != 30 {
		t.Fatalf("legacy update reset window to %d", got)
	}
	request(http.MethodPut, `{"gradingRules":[],"appealWindowDays":0}`, http.StatusBadRequest)
}
