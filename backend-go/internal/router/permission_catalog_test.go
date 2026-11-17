package router

import (
	"os"
	"regexp"
	"testing"

	"github.com/my-project/backend-go/internal/service"
)

// 路由里引用的每个权限编码都必须在权限清单中，否则这个权限在角色配置界面里无法勾选，任何人都用不了对应接口。
func TestRouterPermissionsExistInCatalog(t *testing.T) {
	source, err := os.ReadFile("router.go")
	if err != nil {
		t.Fatalf("read router.go: %v", err)
	}
	catalog := map[string]bool{}
	for _, def := range service.PermissionCatalog {
		catalog[def.Code] = true
	}

	calls := regexp.MustCompile(`RequirePermission\(([^)]*)\)`).FindAllStringSubmatch(string(source), -1)
	if len(calls) == 0 {
		t.Fatalf("no RequirePermission calls found")
	}
	codePattern := regexp.MustCompile(`"([A-Z_]+)"`)
	used := map[string]bool{}
	for _, call := range calls {
		for _, match := range codePattern.FindAllStringSubmatch(call[1], -1) {
			used[match[1]] = true
			if !catalog[match[1]] {
				t.Errorf("router uses %s, which is missing from service.PermissionCatalog", match[1])
			}
		}
	}
	for code := range catalog {
		if !used[code] {
			t.Errorf("catalog permission %s is not enforced by any route", code)
		}
	}
}
