# API 重定向问题修复进展

## 问题概述

在"账号与权限管理"页面，用户列表无法正常加载，页面显示"failed to fetch"错误。

## 问题根源分析

经过深入调试，发现问题由以下原因导致：

### 1. 前端发送带有尾随斜杠的请求

前端的 `buildQueryString` 函数在处理某些参数时导致 URL 变成 `/api/users/?page=1&pageSize=10`。

### 2. 后端路由组配置错误

在 `backend-go/internal/router/router.go` 中，受保护路由组的定义存在问题：

```go
// 错误的配置
protected := api.Group("/")  // 这会导致路径变成 /api//users
```

### 3. RedirectTrailingSlash 设置导致重定向循环

由于 `RedirectTrailingSlash = false` 且路由不匹配，后端返回 404。
当启用 `RedirectTrailingSlash = true` 后，又因为路由组的双斜杠问题导致无限重定向。

## 修复方案

### 1. 修复 buildQueryString 函数 (frontend/src/utils/api.js)

- 跳过 undefined、null 和空字符串
- 正确处理空数组，不将其添加到查询参数中

```javascript
export const buildQueryString = (params = {}) => {
  const searchParams = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    // 跳过 undefined, null, 空字符串
    if (value === undefined || value === null || value === "") return;

    // 处理数组：跳过空数组
    if (Array.isArray(value)) {
      if (value.length === 0) return;
      value.forEach((item) => {
        if (item !== undefined && item !== null && item !== "") {
          searchParams.append(key, item);
        }
      });
      return;
    }

    searchParams.append(key, value);
  });
  return searchParams.toString();
};
```

### 2. 启用尾随斜杠重定向 (backend-go/internal/router/router.go)

```go
// 之前
r.RedirectTrailingSlash = false

// 之后
r.RedirectTrailingSlash = true
```

### 3. 修复路由组配置 (backend-go/internal/router/router.go)

```go
// 之前 - 导致双斜杠 /api//users
protected := api.Group("/")

// 之后 - 正确的路径 /api/users
protected := api.Group("")
```

## 修复结果

- ✅ 后端正确处理带尾随斜杠的请求（301 重定向到标准 URL）
- ✅ 用户列表成功加载，显示 257 条记录
- ✅ 分页功能正常工作
- ✅ 无错误消息

## 修改的文件

1. `frontend/src/utils/api.js` - 改进 buildQueryString 函数
2. `backend-go/internal/router/router.go` - 修复路由组配置和启用尾随斜杠重定向

## 完成时间

2025-12-26 11:50
