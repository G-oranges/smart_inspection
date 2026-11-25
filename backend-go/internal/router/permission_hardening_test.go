package router

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/my-project/backend-go/internal/model"
	"github.com/my-project/backend-go/internal/service"
	"github.com/my-project/backend-go/pkg/utils"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

func performJSONRequest(router http.Handler, method, path, token string, body interface{}) *httptest.ResponseRecorder {
	var payload []byte
	if body != nil {
		payload, _ = json.Marshal(body)
	}
	req := httptest.NewRequest(method, path, bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)
	return resp
}

func roleIDByCode(t *testing.T, db *gorm.DB, code string) string {
	t.Helper()
	var role model.RoleEntity
	if err := db.Where("code = ?", code).First(&role).Error; err != nil {
		t.Fatalf("role %s not found: %v", code, err)
	}
	return role.ID
}

func permissionIDByCode(t *testing.T, db *gorm.DB, code string) string {
	t.Helper()
	var permission model.Permission
	if err := db.Where("code = ?", code).First(&permission).Error; err != nil {
		t.Fatalf("permission %s not found: %v", code, err)
	}
	return permission.ID
}

func setupHardeningRouter(t *testing.T) (*gin.Engine, *gorm.DB, authzSeed) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	db := setupAuthzTestDB(t)
	seed := seedAuthzData(t, db)
	return SetupRouter(db), db, seed
}

func TestHardening_AppealManagementRequiresIndependentPermissions(t *testing.T) {
	router, _, seed := setupHardeningRouter(t)
	for _, identity := range []struct{ id, role string }{
		{seed.studentUserID, "STUDENT"},
		{seed.leaderUserID, "LEADER"},
	} {
		token := mustAccessToken(t, identity.id, identity.role)
		if resp := performAuthzRequest(router, http.MethodGet, "/api/appeals", token); resp.Code != http.StatusForbidden {
			t.Fatalf("%s without APPEAL_VIEW: got %d", identity.role, resp.Code)
		}
		if resp := performAuthzRequest(router, http.MethodPut, "/api/appeals/test/status", token); resp.Code != http.StatusForbidden {
			t.Fatalf("%s without APPEAL_HANDLE: got %d", identity.role, resp.Code)
		}
	}
	if resp := performAuthzRequest(router, http.MethodGet, "/api/appeals/test/photos/test", ""); resp.Code != http.StatusUnauthorized {
		t.Fatalf("anonymous photo request: got %d", resp.Code)
	}
}

func TestAppealRouteVersionConflictAndCorrection(t *testing.T) {
	router, db, seed := setupHardeningRouter(t)
	if err := db.AutoMigrate(&model.Appeal{}, &model.Inspection{}, &model.Dormitory{}, &model.SystemSettings{}); err != nil {
		t.Fatal(err)
	}
	if err := service.EnsurePermissionCatalog(db); err != nil {
		t.Fatal(err)
	}
	dormID := uuid.NewString()
	score := 80
	inspection := model.Inspection{
		ID: uuid.NewString(), DormID: &dormID, TotalScore: &score,
		CreatedAt: time.Now().Add(-time.Hour), UpdatedAt: time.Now().Add(-time.Hour),
		Detail: datatypes.JSON(`[{"id":"row-1","code":"A","count":1,"locations":[]}]`),
	}
	if err := db.Create(&model.Dormitory{ID: dormID}).Error; err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Delete(&model.Dormitory{}, "id = ?", dormID) })
	if err := db.Create(&inspection).Error; err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		db.Delete(&model.Appeal{}, "inspectionId = ?", inspection.ID)
		db.Delete(&model.Inspection{}, "id = ?", inspection.ID)
	})
	if err := db.Model(&model.Student{}).Where("userId = ?", seed.studentUserID).Update("dormId", dormID).Error; err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		db.Model(&model.Student{}).Where("userId = ?", seed.studentUserID).Update("dormId", nil)
	})
	studentToken := mustAccessToken(t, seed.studentUserID, "STUDENT")
	created := performJSONRequest(router, http.MethodPost, "/api/appeals", studentToken, map[string]any{
		"inspectionId": inspection.ID, "content": "请复核本宿舍扣分记录",
	})
	var appeal model.Appeal
	if err := json.Unmarshal(created.Body.Bytes(), &appeal); created.Code != http.StatusCreated || err != nil || appeal.ID == "" {
		t.Fatalf("create: %d %s (%v)", created.Code, created.Body, err)
	}
	adminToken := mustAccessToken(t, seed.adminUserID, "ADMIN")
	path := "/api/appeals/" + appeal.ID
	preview := performAuthzRequest(router, http.MethodGet, path+"/deductions", adminToken)
	var details service.AppealDeductions
	if err := json.Unmarshal(preview.Body.Bytes(), &details); preview.Code != http.StatusOK || err != nil || details.InspectionVersion.IsZero() {
		t.Fatalf("deductions: %d %s (%v)", preview.Code, preview.Body, err)
	}
	input := map[string]any{
		"status": "approved", "inspectionVersion": details.InspectionVersion.Add(-time.Minute),
		"deductionAdjustments": []map[string]any{{"code": "A", "action": "remove"}},
	}
	conflict := performJSONRequest(router, http.MethodPut, path+"/status", adminToken, input)
	var failure struct {
		Code string `json:"code"`
	}
	if err := json.Unmarshal(conflict.Body.Bytes(), &failure); conflict.Code != http.StatusConflict || err != nil || failure.Code != "INSPECTION_CHANGED" {
		t.Fatalf("stale version: %d %s (%v)", conflict.Code, conflict.Body, err)
	}
	input["inspectionVersion"] = details.InspectionVersion
	approved := performJSONRequest(router, http.MethodPut, path+"/status", adminToken, input)
	if err := json.Unmarshal(approved.Body.Bytes(), &appeal); approved.Code != http.StatusOK || err != nil ||
		appeal.Inspection.TotalScore == nil || *appeal.Inspection.TotalScore != 82 || appeal.Status != model.AppealApproved {
		t.Fatalf("approve: %d %s (%v)", approved.Code, approved.Body, err)
	}
}

// 只有账号管理权限（无「权限配置」）的操作者，不能给别人分配管理员角色，也不能删除/重置管理员。
func TestHardening_AccountManagerCannotEscalateOrTouchAdmins(t *testing.T) {
	router, db, seed := setupHardeningRouter(t)
	counselorToken := mustAccessToken(t, seed.counselorUserID, "COUNSELOR")
	adminRoleID := roleIDByCode(t, db, "ADMIN")

	resp := performJSONRequest(router, http.MethodPut, "/api/users/"+seed.leaderUserID, counselorToken, map[string]interface{}{
		"roles": []string{adminRoleID}, "role": "ADMIN",
	})
	if resp.Code != http.StatusForbidden {
		t.Fatalf("grant ADMIN: expected 403, got %d %s", resp.Code, resp.Body.String())
	}
	resp = performJSONRequest(router, http.MethodPut, "/api/users/"+seed.counselorUserID, counselorToken, map[string]interface{}{
		"roles": []string{adminRoleID}, "role": "ADMIN",
	})
	if resp.Code != http.StatusForbidden {
		t.Fatalf("self escalation: expected 403, got %d", resp.Code)
	}
	resp = performJSONRequest(router, http.MethodDelete, "/api/users", counselorToken, map[string]interface{}{"ids": []string{seed.adminUserID}})
	if resp.Code != http.StatusForbidden {
		t.Fatalf("delete admin: expected 403, got %d", resp.Code)
	}
	resp = performJSONRequest(router, http.MethodPut, "/api/users/"+seed.adminUserID+"/reset-password", counselorToken, nil)
	if resp.Code != http.StatusForbidden {
		t.Fatalf("reset admin password: expected 403, got %d", resp.Code)
	}

	var leader model.User
	if err := db.First(&leader, "id = ?", seed.leaderUserID).Error; err != nil || leader.Role != "LEADER" {
		t.Fatalf("leader role must stay LEADER, got %q (%v)", leader.Role, err)
	}
}

// 管理员不能停用自己，也不能移除管理员角色的「权限配置」导致无人可管理权限。
func TestHardening_AdminLockoutPrevention(t *testing.T) {
	router, db, seed := setupHardeningRouter(t)
	adminToken := mustAccessToken(t, seed.adminUserID, "ADMIN")

	resp := performJSONRequest(router, http.MethodPut, "/api/users/"+seed.adminUserID, adminToken, map[string]interface{}{"isDisabled": true})
	if resp.Code != http.StatusForbidden {
		t.Fatalf("disable self: expected 403, got %d", resp.Code)
	}

	adminRoleID := roleIDByCode(t, db, "ADMIN")
	resp = performJSONRequest(router, http.MethodPut, "/api/permissions/roles/"+adminRoleID, adminToken, map[string]interface{}{
		"permissionIds": []string{permissionIDByCode(t, db, "USER_MANAGE")},
	})
	if resp.Code != http.StatusBadRequest {
		t.Fatalf("remove PERMISSION_MANAGE from ADMIN: expected 400, got %d", resp.Code)
	}
	resp = performJSONRequest(router, http.MethodPut, "/api/permissions/roles/"+adminRoleID, adminToken, map[string]interface{}{
		"permissionIds": []string{"missing-permission"},
	})
	if resp.Code != http.StatusBadRequest {
		t.Fatalf("unknown permission id: expected 400, got %d %s", resp.Code, resp.Body.String())
	}
	resp = performJSONRequest(router, http.MethodPut, "/api/permissions/roles/missing-role", adminToken, map[string]interface{}{"permissionIds": []string{}})
	if resp.Code != http.StatusNotFound {
		t.Fatalf("unknown role: expected 404, got %d", resp.Code)
	}
}

// “强制禁止”的例外授权必须存成禁止，并立即生效。
func TestHardening_DenyOverrideIsStoredAndEnforced(t *testing.T) {
	router, db, seed := setupHardeningRouter(t)
	adminToken := mustAccessToken(t, seed.adminUserID, "ADMIN")
	counselorToken := mustAccessToken(t, seed.counselorUserID, "COUNSELOR")

	if resp := performAuthzRequest(router, http.MethodGet, "/api/users", counselorToken); resp.Code != http.StatusOK {
		t.Fatalf("precondition: counselor should list users, got %d", resp.Code)
	}
	resp := performJSONRequest(router, http.MethodPut, "/api/permissions/users/"+seed.counselorUserID, adminToken, map[string]interface{}{
		"overrides": []map[string]interface{}{{"permissionId": permissionIDByCode(t, db, "USER_MANAGE"), "grant": false}},
	})
	if resp.Code != http.StatusOK {
		t.Fatalf("save override: expected 200, got %d %s", resp.Code, resp.Body.String())
	}

	var override model.UserPermissionOverride
	if err := db.Where("userId = ?", seed.counselorUserID).First(&override).Error; err != nil {
		t.Fatalf("override not saved: %v", err)
	}
	if override.Allow {
		t.Fatalf("deny override was stored as allow")
	}
	if resp := performAuthzRequest(router, http.MethodGet, "/api/users", counselorToken); resp.Code != http.StatusForbidden {
		t.Fatalf("deny override should apply immediately, got %d", resp.Code)
	}
}

// 停用角色、修改用户角色后，旧权限立即失效（不等缓存过期）。
func TestHardening_RoleChangesTakeEffectImmediately(t *testing.T) {
	router, db, seed := setupHardeningRouter(t)
	adminToken := mustAccessToken(t, seed.adminUserID, "ADMIN")
	counselorToken := mustAccessToken(t, seed.counselorUserID, "COUNSELOR")
	studentRoleID := roleIDByCode(t, db, "STUDENT")

	if resp := performAuthzRequest(router, http.MethodGet, "/api/users", counselorToken); resp.Code != http.StatusOK {
		t.Fatalf("precondition: expected 200, got %d", resp.Code)
	}
	resp := performJSONRequest(router, http.MethodPut, "/api/users/"+seed.counselorUserID, adminToken, map[string]interface{}{
		"roles": []string{studentRoleID}, "role": "STUDENT",
	})
	if resp.Code != http.StatusOK {
		t.Fatalf("change role: expected 200, got %d %s", resp.Code, resp.Body.String())
	}
	if resp := performAuthzRequest(router, http.MethodGet, "/api/users", counselorToken); resp.Code != http.StatusForbidden {
		t.Fatalf("old permissions must be revoked after role change, got %d", resp.Code)
	}

	// 自定义角色（附加给学生）停用后，学生不再拥有它带来的权限
	reviewer := model.RoleEntity{ID: uuid.NewString(), Code: "REVIEWER", Name: "审核员", TypeCode: "CUSTOM", Status: "ACTIVE"}
	if err := db.Create(&reviewer).Error; err != nil {
		t.Fatalf("create role: %v", err)
	}
	if err := db.Create(&model.RolePermission{ID: uuid.NewString(), RoleID: reviewer.ID, PermissionID: permissionIDByCode(t, db, "RESULT_VIEW")}).Error; err != nil {
		t.Fatalf("grant role permission: %v", err)
	}
	if err := db.Exec("INSERT INTO `_roleentitytouser` (A, B) VALUES (?, ?)", reviewer.ID, seed.studentUserID).Error; err != nil {
		t.Fatalf("assign role: %v", err)
	}
	studentToken := mustAccessToken(t, seed.studentUserID, "STUDENT")
	if perms := myPermissions(t, router, studentToken); !containsCode(perms, "RESULT_VIEW") {
		t.Fatalf("precondition: student should get RESULT_VIEW from the extra role, got %v", perms)
	}
	resp = performJSONRequest(router, http.MethodPut, "/api/roles/"+reviewer.ID+"/status", adminToken, map[string]interface{}{"status": "INACTIVE"})
	if resp.Code != http.StatusOK {
		t.Fatalf("disable role: expected 200, got %d %s", resp.Code, resp.Body.String())
	}
	if perms := myPermissions(t, router, studentToken); containsCode(perms, "RESULT_VIEW") {
		t.Fatalf("inactive role must not grant permissions, got %v", perms)
	}
}

func myPermissions(t *testing.T, router http.Handler, token string) []string {
	t.Helper()
	resp := performAuthzRequest(router, http.MethodGet, "/api/permissions/me", token)
	var body struct {
		Permissions []string `json:"permissions"`
	}
	if resp.Code != http.StatusOK || json.Unmarshal(resp.Body.Bytes(), &body) != nil {
		t.Fatalf("GET /api/permissions/me failed: %d %s", resp.Code, resp.Body.String())
	}
	return body.Permissions
}

func containsCode(values []string, target string) bool {
	for _, value := range values {
		if value == target {
			return true
		}
	}
	return false
}

// 只修改资料（如手机号）时，不能丢失用户的附加角色。
func TestHardening_EditingProfileKeepsExtraRoles(t *testing.T) {
	router, db, seed := setupHardeningRouter(t)
	adminToken := mustAccessToken(t, seed.adminUserID, "ADMIN")
	for _, code := range []string{"COUNSELOR", "LEADER"} {
		if err := db.Exec("INSERT INTO `_roleentitytouser` (A, B) VALUES (?, ?)", roleIDByCode(t, db, code), seed.counselorUserID).Error; err != nil {
			t.Fatalf("seed join row: %v", err)
		}
	}

	resp := performJSONRequest(router, http.MethodPut, "/api/users/"+seed.counselorUserID, adminToken, map[string]interface{}{"phone": "13800000000"})
	if resp.Code != http.StatusOK {
		t.Fatalf("update phone: expected 200, got %d %s", resp.Code, resp.Body.String())
	}
	var count int64
	db.Table("_roleentitytouser").Where("B = ?", seed.counselorUserID).Count(&count)
	if count != 2 {
		t.Fatalf("expected both roles to be kept, got %d", count)
	}

	var user model.User
	if err := db.Preload("Roles").First(&user, "id = ?", seed.counselorUserID).Error; err != nil || len(user.Roles) != 2 {
		t.Fatalf("Preload(Roles) should return 2 roles, got %d (%v)", len(user.Roles), err)
	}
}

// 新建账号/重置密码返回一次性随机密码；改密前只能访问少量接口。
func TestHardening_GeneratedPasswordsAndForcedChange(t *testing.T) {
	router, db, seed := setupHardeningRouter(t)
	adminToken := mustAccessToken(t, seed.adminUserID, "ADMIN")
	counselorRoleID := roleIDByCode(t, db, "COUNSELOR")

	resp := performJSONRequest(router, http.MethodPost, "/api/users", adminToken, map[string]interface{}{
		"username": "teacher", "fullName": "Teacher", "roles": []string{counselorRoleID}, "role": "COUNSELOR",
	})
	if resp.Code != http.StatusOK {
		t.Fatalf("create user: expected 200, got %d %s", resp.Code, resp.Body.String())
	}
	var created struct {
		ID              string `json:"id"`
		InitialPassword string `json:"initialPassword"`
	}
	_ = json.Unmarshal(resp.Body.Bytes(), &created)
	if created.ID == "" || !utils.IsStrongPassword(created.InitialPassword) || created.InitialPassword == "teacher" {
		t.Fatalf("expected a strong generated password, got %q", created.InitialPassword)
	}

	login := performJSONRequest(router, http.MethodPost, "/api/auth/login", "", map[string]string{"username": "teacher", "password": "teacher"})
	if login.Code != http.StatusUnauthorized {
		t.Fatalf("username as password must not work, got %d", login.Code)
	}
	login = performJSONRequest(router, http.MethodPost, "/api/auth/login", "", map[string]string{"username": "teacher", "password": created.InitialPassword})
	if login.Code != http.StatusOK {
		t.Fatalf("login with generated password: expected 200, got %d", login.Code)
	}
	var loginBody struct {
		AccessToken string `json:"accessToken"`
		User        struct {
			MustChangePassword bool `json:"mustChangePassword"`
		} `json:"user"`
	}
	_ = json.Unmarshal(login.Body.Bytes(), &loginBody)
	if !loginBody.User.MustChangePassword {
		t.Fatalf("new account must be flagged mustChangePassword")
	}
	blocked := performAuthzRequest(router, http.MethodGet, "/api/students/table", loginBody.AccessToken)
	if blocked.Code != http.StatusForbidden || !bytes.Contains(blocked.Body.Bytes(), []byte("PASSWORD_CHANGE_REQUIRED")) {
		t.Fatalf("expected PASSWORD_CHANGE_REQUIRED, got %d %s", blocked.Code, blocked.Body.String())
	}
	if me := performAuthzRequest(router, http.MethodGet, "/api/auth/me", loginBody.AccessToken); me.Code != http.StatusOK {
		t.Fatalf("auth/me must stay reachable, got %d", me.Code)
	}
	change := performJSONRequest(router, http.MethodPut, "/api/auth/change-password", loginBody.AccessToken, map[string]string{
		"oldPassword": created.InitialPassword, "newPassword": "N3w#Passw0rd",
	})
	if change.Code != http.StatusOK {
		t.Fatalf("change password: expected 200, got %d %s", change.Code, change.Body.String())
	}
	var user model.User
	db.First(&user, "id = ?", created.ID)
	if user.MustChangePassword {
		t.Fatalf("mustChangePassword should be cleared after changing password")
	}

	reset := performJSONRequest(router, http.MethodPut, "/api/users/"+created.ID+"/reset-password", adminToken, nil)
	var resetBody struct {
		NewPassword string `json:"newPassword"`
	}
	_ = json.Unmarshal(reset.Body.Bytes(), &resetBody)
	if reset.Code != http.StatusOK || !utils.IsStrongPassword(resetBody.NewPassword) {
		t.Fatalf("reset password: expected strong generated password, got %d %q", reset.Code, resetBody.NewPassword)
	}
	db.First(&user, "id = ?", created.ID)
	if !user.MustChangePassword {
		t.Fatalf("reset password must require a change on next login")
	}
}

// 执行人列表包含教职工联系方式，学生不能读取。
func TestHardening_ExecutorsRequireTaskPublish(t *testing.T) {
	router, _, seed := setupHardeningRouter(t)
	studentToken := mustAccessToken(t, seed.studentUserID, "STUDENT")
	if resp := performAuthzRequest(router, http.MethodGet, "/api/users/executors", studentToken); resp.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", resp.Code)
	}
	counselorToken := mustAccessToken(t, seed.counselorUserID, "COUNSELOR")
	if resp := performAuthzRequest(router, http.MethodGet, "/api/users/executors", counselorToken); resp.Code != http.StatusOK {
		t.Fatalf("task publisher should list executors, got %d", resp.Code)
	}
}

// 登录限流只统计失败；伪造 X-Forwarded-For 不能绕过。
func TestHardening_LoginLimiterCountsFailuresOnly(t *testing.T) {
	router, db, _ := setupHardeningRouter(t)
	hashed, _ := utils.HashPassword("C0rrect#Pass")
	user := model.User{ID: uuid.NewString(), Username: "limiter_user", Password: hashed, Role: "COUNSELOR", FullName: "Limiter", TokenVersion: 1}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("create user: %v", err)
	}

	for i := 0; i < 6; i++ {
		resp := performJSONRequest(router, http.MethodPost, "/api/auth/login", "", map[string]string{"username": "limiter_user", "password": "C0rrect#Pass"})
		if resp.Code != http.StatusOK {
			t.Fatalf("successful login %d should not be limited, got %d", i+1, resp.Code)
		}
	}
	for i := 0; i < 5; i++ {
		performJSONRequest(router, http.MethodPost, "/api/auth/login", "", map[string]string{"username": "limiter_user", "password": "wrong"})
	}
	req := httptest.NewRequest(http.MethodPost, "/api/auth/login", bytes.NewReader([]byte(`{"username":"limiter_user","password":"C0rrect#Pass"}`)))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Forwarded-For", "203.0.113.9")
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)
	if resp.Code != http.StatusTooManyRequests {
		t.Fatalf("after 5 failures the account should be limited even with a spoofed X-Forwarded-For, got %d", resp.Code)
	}
}

// 编辑/删除不存在的任务应返回 404，而不是 500。
func TestHardening_MissingTaskReturns404(t *testing.T) {
	router, db, seed := setupHardeningRouter(t)
	if err := db.AutoMigrate(&model.Task{}, &model.TaskDorm{}, &model.TaskExecutor{}); err != nil {
		t.Fatalf("migrate task tables: %v", err)
	}
	adminToken := mustAccessToken(t, seed.adminUserID, "ADMIN")
	missing := "/api/tasks/" + uuid.NewString()

	if resp := performJSONRequest(router, http.MethodPut, missing, adminToken, map[string]interface{}{"title": "x"}); resp.Code != http.StatusNotFound {
		t.Fatalf("update missing task: expected 404, got %d %s", resp.Code, resp.Body.String())
	}
	if resp := performJSONRequest(router, http.MethodDelete, missing, adminToken, nil); resp.Code != http.StatusNotFound {
		t.Fatalf("delete missing task: expected 404, got %d %s", resp.Code, resp.Body.String())
	}
}

// 批量例外授权只修改提交的功能点；inherit 删除例外；其他已有例外保持不变。
func TestHardening_BatchOverridesMergeInsteadOfReplace(t *testing.T) {
	router, db, seed := setupHardeningRouter(t)
	adminToken := mustAccessToken(t, seed.adminUserID, "ADMIN")
	userManage := permissionIDByCode(t, db, "USER_MANAGE")
	studentView := permissionIDByCode(t, db, "STUDENT_VIEW")

	resp := performJSONRequest(router, http.MethodPut, "/api/permissions/users/"+seed.counselorUserID, adminToken, map[string]interface{}{
		"overrides": []map[string]interface{}{{"permissionId": userManage, "grant": false}},
	})
	if resp.Code != http.StatusOK {
		t.Fatalf("seed override: %d %s", resp.Code, resp.Body.String())
	}
	resp = performJSONRequest(router, http.MethodPut, "/api/permissions/batch-overrides", adminToken, map[string]interface{}{
		"userIds":   []string{seed.counselorUserID},
		"overrides": []map[string]interface{}{{"permissionId": studentView, "grant": true}},
	})
	if resp.Code != http.StatusOK {
		t.Fatalf("batch update: %d %s", resp.Code, resp.Body.String())
	}
	var overrides []model.UserPermissionOverride
	db.Where("userId = ?", seed.counselorUserID).Find(&overrides)
	if len(overrides) != 2 {
		t.Fatalf("existing override must be kept, got %+v", overrides)
	}

	resp = performJSONRequest(router, http.MethodPut, "/api/permissions/batch-overrides", adminToken, map[string]interface{}{
		"userIds":   []string{seed.counselorUserID},
		"overrides": []map[string]interface{}{{"permissionId": userManage, "inherit": true}},
	})
	if resp.Code != http.StatusOK {
		t.Fatalf("batch inherit: %d %s", resp.Code, resp.Body.String())
	}
	overrides = nil
	db.Where("userId = ?", seed.counselorUserID).Find(&overrides)
	if len(overrides) != 1 || overrides[0].PermissionID != studentView || !overrides[0].Allow {
		t.Fatalf("inherit should remove only USER_MANAGE override, got %+v", overrides)
	}
}

// 账号单独数据范围：可设置、可读取、可恢复为跟随角色；仅权限管理员可操作。
func TestHardening_UserDataScopeEndpoints(t *testing.T) {
	router, db, seed := setupHardeningRouter(t)
	if err := db.AutoMigrate(&model.UserDataScope{}, &model.Dormitory{}); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	college := "工学院"
	if err := db.Model(&model.Student{}).Where("userId = ?", seed.studentUserID).Update("college", college).Error; err != nil {
		t.Fatalf("seed college: %v", err)
	}
	adminToken := mustAccessToken(t, seed.adminUserID, "ADMIN")
	path := "/api/permissions/users/" + seed.counselorUserID + "/data-scope"

	readScope := func() map[string]interface{} {
		resp := performAuthzRequest(router, http.MethodGet, path, adminToken)
		if resp.Code != http.StatusOK {
			t.Fatalf("get user scope: %d %s", resp.Code, resp.Body.String())
		}
		var body struct {
			DataScope map[string]interface{} `json:"dataScope"`
		}
		_ = json.Unmarshal(resp.Body.Bytes(), &body)
		return body.DataScope
	}
	if scope := readScope(); scope["inherited"] != true {
		t.Fatalf("expected inherited scope by default, got %v", scope)
	}

	resp := performJSONRequest(router, http.MethodPut, path, adminToken, map[string]interface{}{
		"scopeMode": "ACADEMIC", "presetCode": "ACADEMIC", "rules": map[string]interface{}{"academic": map[string]interface{}{"college": []string{college}}},
	})
	if resp.Code != http.StatusOK {
		t.Fatalf("save user scope: %d %s", resp.Code, resp.Body.String())
	}
	if scope := readScope(); scope["scopeMode"] != "ACADEMIC" || scope["inherited"] == true {
		t.Fatalf("expected saved ACADEMIC scope, got %v", scope)
	}

	counselorToken := mustAccessToken(t, seed.counselorUserID, "COUNSELOR")
	if resp := performJSONRequest(router, http.MethodPut, path, counselorToken, map[string]interface{}{"scopeMode": "ALL"}); resp.Code != http.StatusForbidden {
		t.Fatalf("non-admin must not change data scopes, got %d", resp.Code)
	}

	if resp := performAuthzRequest(router, http.MethodDelete, path, adminToken); resp.Code != http.StatusOK {
		t.Fatalf("delete user scope: %d", resp.Code)
	}
	if scope := readScope(); scope["inherited"] != true {
		t.Fatalf("expected inherited scope after delete, got %v", scope)
	}

	options := performAuthzRequest(router, http.MethodGet, "/api/permissions/scope-options", adminToken)
	if options.Code != http.StatusOK || !bytes.Contains(options.Body.Bytes(), []byte(college)) {
		t.Fatalf("scope options should list colleges from student data, got %d %s", options.Code, options.Body.String())
	}
}

// 本学院范围：辅导员能看到本学院学生入住的宿舍（并验证宿舍列表的范围过滤能正常执行 SQL）。
func TestHardening_OwnCollegeScopeShowsStudentsDorms(t *testing.T) {
	router, db, seed := setupHardeningRouter(t)
	if err := db.AutoMigrate(&model.Dormitory{}, &model.DormBed{}, &model.Building{}, &model.UserDataScope{}); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	building, floor := "7号楼", 3
	roomA, roomB := "301", "302"
	dormA := model.Dormitory{ID: uuid.NewString(), Building: &building, Floor: &floor, RoomNo: &roomA}
	dormB := model.Dormitory{ID: uuid.NewString(), Building: &building, Floor: &floor, RoomNo: &roomB}
	if err := db.Create(&[]model.Dormitory{dormA, dormB}).Error; err != nil {
		t.Fatalf("seed dorms: %v", err)
	}
	college := "工学院"
	if err := db.Model(&model.Student{}).Where("userId = ?", seed.studentUserID).Updates(map[string]interface{}{"college": college, "dormId": dormA.ID}).Error; err != nil {
		t.Fatalf("seed student: %v", err)
	}
	if err := db.Model(&model.User{}).Where("id = ?", seed.counselorUserID).Update("department", college).Error; err != nil {
		t.Fatalf("seed department: %v", err)
	}

	counselorToken := mustAccessToken(t, seed.counselorUserID, "COUNSELOR")
	resp := performAuthzRequest(router, http.MethodGet, "/api/dorms/table?page=1&pageSize=10", counselorToken)
	if resp.Code != http.StatusOK {
		t.Fatalf("dorm table: expected 200, got %d %s", resp.Code, resp.Body.String())
	}
	var body struct {
		Total int `json:"total"`
	}
	_ = json.Unmarshal(resp.Body.Bytes(), &body)
	if body.Total != 1 {
		t.Fatalf("counselor should see only the dorm of own-college students, got %d", body.Total)
	}
}
