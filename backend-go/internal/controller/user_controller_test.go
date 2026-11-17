package controller

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/my-project/backend-go/internal/model"
	"github.com/my-project/backend-go/internal/service"
)

func TestUserControllerGetUsersReturnsAllLinkedRoles(t *testing.T) {
	gin.SetMode(gin.TestMode)

	roleA := model.RoleEntity{ID: uuid.NewString(), Code: "COUNSELOR", Name: "辅导员", Status: "ACTIVE", TypeCode: "SYSTEM"}
	roleB := model.RoleEntity{ID: uuid.NewString(), Code: "CUSTOM_REVIEWER", Name: "审核员", Status: "ACTIVE", TypeCode: "CUSTOM"}
	controller := NewUserController(userServiceStub{
		users: []model.User{
			{
				ID:         uuid.NewString(),
				Username:   "multi-role",
				FullName:   "多角色用户",
				Role:       roleA.Code,
				Department: userControllerStringPtr("学生工作部"),
				Roles:      []model.RoleEntity{roleA, roleB},
			},
		},
		total: 1,
	})

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/api/users?page=1&pageSize=10", nil)

	controller.GetUsers(ctx)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", recorder.Code)
	}

	var response struct {
		Items []struct {
			Department *string `json:"department"`
			Roles      []struct {
				Code string `json:"code"`
			} `json:"roles"`
		} `json:"items"`
		Total int64 `json:"total"`
	}
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatalf("decode response failed: %v", err)
	}

	if response.Total != 1 || len(response.Items) != 1 {
		t.Fatalf("unexpected response payload: %#v", response)
	}
	if len(response.Items[0].Roles) != 2 {
		t.Fatalf("expected 2 roles in response, got %d", len(response.Items[0].Roles))
	}
	if got := userControllerPtrToStr(response.Items[0].Department); got != "学生工作部" {
		t.Fatalf("expected department 学生工作部, got %q", got)
	}
}

type userServiceStub struct {
	users []model.User
	total int64
	err   error
}

func (s userServiceStub) GetCurrentUser(id string) (*model.User, error) {
	return nil, nil
}

func (s userServiceStub) GetUsers(page, pageSize int, filters map[string]interface{}) ([]model.User, int64, error) {
	return s.users, s.total, s.err
}

func (s userServiceStub) GetExecutors(page, pageSize int, keyword, role string) ([]model.User, int64, error) {
	return nil, 0, nil
}

func (s userServiceStub) CreateUser(req service.CreateUserRequest) (*model.User, string, error) {
	return nil, "", nil
}

func (s userServiceStub) UpdateUser(id string, req service.UpdateUserRequest) error {
	return nil
}

func (s userServiceStub) DeleteUsers(ids []string, currentUserId string) error {
	return nil
}

func (s userServiceStub) ResetPassword(id string) (string, error) {
	return "", nil
}

func (s userServiceStub) AuthorizeUserCreate(op service.OperatorContext, req service.CreateUserRequest) error {
	return nil
}

func (s userServiceStub) AuthorizeUserUpdate(op service.OperatorContext, targetID string, req service.UpdateUserRequest) error {
	return nil
}

func (s userServiceStub) AuthorizeUserDelete(op service.OperatorContext, ids []string) error {
	return nil
}

func (s userServiceStub) AuthorizeCredentialReset(op service.OperatorContext, targetID string) error {
	return nil
}

func (s userServiceStub) GenerateTemporaryPassword(id string) (string, error) {
	return "", nil
}

func userControllerStringPtr(value string) *string {
	return &value
}

func userControllerPtrToStr(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}
