package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestRequirePermission_DeniesWhenMissing(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.GET("/test",
		withPermissions([]string{"USER_MANAGE"}),
		RequirePermission("PERMISSION_MANAGE"),
		func(c *gin.Context) {
			c.Status(http.StatusOK)
		},
	)

	resp := performRequest(router, http.MethodGet, "/test")
	if resp.Code != http.StatusForbidden {
		t.Fatalf("expected status %d, got %d", http.StatusForbidden, resp.Code)
	}
}

func TestRequirePermission_AllowsWhenPresent(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.GET("/test",
		withPermissions([]string{"PERMISSION_MANAGE"}),
		RequirePermission("PERMISSION_MANAGE"),
		func(c *gin.Context) {
			c.Status(http.StatusOK)
		},
	)

	resp := performRequest(router, http.MethodGet, "/test")
	if resp.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, resp.Code)
	}
}

func TestRequirePermission_DeniesWhenPermissionsMissing(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.GET("/test",
		RequirePermission("PERMISSION_MANAGE"),
		func(c *gin.Context) {
			c.Status(http.StatusOK)
		},
	)

	resp := performRequest(router, http.MethodGet, "/test")
	if resp.Code != http.StatusForbidden {
		t.Fatalf("expected status %d, got %d", http.StatusForbidden, resp.Code)
	}
}

func TestRequireRole_DeniesWhenMissing(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.GET("/test",
		withRole("STUDENT"),
		RequireRole("ADMIN"),
		func(c *gin.Context) {
			c.Status(http.StatusOK)
		},
	)

	resp := performRequest(router, http.MethodGet, "/test")
	if resp.Code != http.StatusForbidden {
		t.Fatalf("expected status %d, got %d", http.StatusForbidden, resp.Code)
	}
}

func TestRequireRole_AllowsWhenPresent(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.GET("/test",
		withRole("ADMIN"),
		RequireRole("ADMIN"),
		func(c *gin.Context) {
			c.Status(http.StatusOK)
		},
	)

	resp := performRequest(router, http.MethodGet, "/test")
	if resp.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, resp.Code)
	}
}

func TestCheckPermissionInController(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("permissions", []string{"PERMISSION_MANAGE"})

	if !CheckPermissionInController(c, "PERMISSION_MANAGE") {
		t.Fatalf("expected permission check to pass")
	}
	if CheckPermissionInController(c, "USER_MANAGE") {
		t.Fatalf("expected permission check to fail for missing code")
	}
}

func TestCheckRoleInController(t *testing.T) {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Set("role", "ADMIN")

	if !CheckRoleInController(c, "ADMIN") {
		t.Fatalf("expected role check to pass")
	}
	if CheckRoleInController(c, "STUDENT") {
		t.Fatalf("expected role check to fail for missing role")
	}
}

func withPermissions(perms []string) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Set("permissions", perms)
		c.Next()
	}
}

func withRole(role string) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Set("role", role)
		c.Next()
	}
}

func performRequest(router http.Handler, method, path string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, nil)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)
	return resp
}
