# 导入进度条真实化 - 全模块推广

## 概述

将原本仅在**学生导入**模块实现的异步进度轮询方案（方案 A）推广到**宿舍导入**和**入住导入**模块，使所有导入向导的进度条都能显示真实进度。

## 完成日期

2026-01-22

## 技术方案

### 架构说明

1. **后端异步化**：
   - 控制器收到请求后立即返回 `jobId`
   - 创建 Goroutine 执行实际导入
   - 进度写入 Redis（`import:progress:{jobId}` → `{ processed: 50, total: 100 }`）

2. **进度查询 API**：
   - `GET /api/import/progress/:jobId` - 通用进度查询接口

3. **前端轮询**：
   - 前端组件 `ImportWizardModal` 尝试调用 `/execute-async` 接口
   - 如果返回 `jobId`，则进入轮询模式
   - 每 800ms 轮询一次进度，直到完成或失败
   - 如果异步 API 不可用（404），自动降级为同步模式（模拟进度）

### 降级机制

当 Redis 不可用时，后端会自动降级为同步执行，前端使用模拟进度条。

## 改动文件清单

### 后端 (backend-go)

| 文件                                          | 改动说明                                             |
| --------------------------------------------- | ---------------------------------------------------- |
| `internal/service/infra_service.go`           | 新增 `BatchImportDormsV2WithProgress` 接口声明和实现 |
| `internal/controller/infra_controller.go`     | 新增 `ImportDormsV2Async` 异步导入控制器方法         |
| `internal/controller/occupancy_controller.go` | 新增 `ImportOccupancyV2Async` 异步入住导入控制器方法 |
| `internal/router/router.go`                   | 启用宿舍和入住的异步导入路由端点                     |

### 新增 API 端点

| 模块     | 端点                                            | 说明      |
| -------- | ----------------------------------------------- | --------- |
| 学生导入 | `POST /api/v2/students/import/execute-async`    | ✅ 已存在 |
| 宿舍导入 | `POST /api/v2/infra/dorms/import/execute-async` | ✅ 新增   |
| 入住导入 | `POST /api/v2/occupancy/import/execute-async`   | ✅ 新增   |
| 进度查询 | `GET /api/import/progress/:jobId`               | ✅ 通用   |

## 前端无需改动

前端 `ImportWizardModal` 组件已设计为**自动检测**后端是否支持异步模式：

```javascript
// 尝试使用异步执行 API（支持进度轮询）
const asyncApiUrl = config.api.execute.replace('/execute', '/execute-async');

try {
  const asyncResult = await apiRequestWithRefresh(asyncApiUrl, {...});
  if (asyncResult.jobId) {
    useAsyncMode = true;
    jobId = asyncResult.jobId;
  }
} catch (asyncErr) {
  // 异步 API 不可用（404 等），降级为同步模式
  console.log('异步 API 不可用，使用同步模式');
}
```

## 测试验证

1. 宿舍导入：使用导入向导导入宿舍数据，观察进度条是否显示真实进度
2. 入住导入：使用导入向导导入入住数据，观察进度条是否显示真实进度
3. 学生导入：确认原有功能不受影响
4. Redis 不可用场景：停止 Redis 后验证是否正常降级为同步模式

## 注意事项

1. 进度更新频率：每处理一行数据更新一次进度，前端每 800ms 轮询一次
2. 任务超时：前端最长轮询 5 分钟，超时后提示用户刷新页面查看结果
3. Redis TTL：进度数据在 Redis 中保留 30 分钟后自动过期
