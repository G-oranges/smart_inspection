# 导入进度条真实进度回传实现进展

## 实施日期

2026-01-21

## 问题背景

用户反馈导入向导的进度条存在以下问题：

1. 进度百分比可能超过 100%（出现 105% 等异常值）
2. 进度条满格但后端仍在导入

## 根因分析

1. **百分比超限**：模拟进度逻辑中 `prev + Math.floor(Math.random() * 15)` 可能导致跳跃超过 95%，而条件检查在下一轮才生效
2. **进度条满格问题**：模拟进度与真实后端状态完全解耦，无法反映真实处理进度

## 解决方案：Polling（前端轮询真实进度）

### 后端改动

1. **新增 `import_task_service.go`**：导入任务管理器服务
   - 使用 Redis 存储任务状态（jobId → progress JSON）
   - 支持 CreateTask / UpdateProgress / CompleteTask / FailTask / GetProgress

2. **新增 `import_task_controller.go`**：进度查询控制器
   - GET `/api/import/progress/:jobId` - 获取任务进度

3. **新增路由**（`router.go`）：
   - `/api/import/progress/:jobId` - 进度查询
   - `/api/v2/students/import/execute-async` - 学生异步导入

4. **新增 `StudentService.BatchImportV2WithProgress`**：
   - 在导入循环中定期更新 Redis 进度
   - 更新频率：每处理 10 行或 5% 更新一次

### 前端改动

1. **重构 `handleExecute` 函数**：
   - 优先尝试调用异步 API（`/execute-async`）
   - 如果返回 `jobId`，进入轮询模式
   - 如果异步 API 不可用（404），降级为同步模式

2. **新增 `pollImportProgress` 函数**：
   - 轮询间隔：800ms
   - 最长轮询时间：5 分钟
   - 根据 `progress.status` 判断完成/失败

3. **修复同步模式的进度超限问题**：
   - 使用 `Math.min(currentProgress + increment, 95)` 确保不超过 95%
   - 使用局部变量 `currentProgress` 替代 `prev` 避免闭包问题

## 当前进度

- [x] 后端 import_task_service.go 创建
- [x] 后端 import_task_controller.go 创建
- [x] 后端 router.go 添加进度查询路由
- [x] 后端 StudentService.BatchImportV2WithProgress 实现
- [x] 后端编译通过
- [x] 前端 ImportWizardModal.jsx 重构
- [ ] 宿舍导入异步接口（TODO）
- [ ] 入住导入异步接口（TODO）
- [ ] 集成测试

## 文件变更清单

| 文件                                                       | 变更类型 | 说明                           |
| ---------------------------------------------------------- | -------- | ------------------------------ |
| `backend-go/internal/service/import_task_service.go`       | 新增     | 导入任务管理器                 |
| `backend-go/internal/controller/import_task_controller.go` | 新增     | 进度查询控制器                 |
| `backend-go/internal/router/router.go`                     | 修改     | 添加进度路由                   |
| `backend-go/internal/service/student_service.go`           | 修改     | 添加 BatchImportV2WithProgress |
| `backend-go/internal/controller/extended_controller.go`    | 修改     | 添加 ImportStudentsV2Async     |
| `frontend/src/components/common/ImportWizardModal.jsx`     | 修改     | 重构执行逻辑                   |

## API 接口说明

### 异步导入执行

```
POST /api/v2/students/import/execute-async
Request: { strategy: "SKIP"|"OVERWRITE", rows: [...] }
Response: { jobId: "uuid", message: "导入任务已创建" }
```

### 进度查询

```
GET /api/import/progress/:jobId
Response: {
  jobId: "uuid",
  status: "pending"|"running"|"completed"|"failed",
  total: 100,
  processed: 50,
  progress: 50,
  startedAt: "2026-01-21T18:00:00Z",
  completedAt: null,
  result: null,
  error: ""
}
```

## 后续工作

1. 为宿舍导入（infra）添加异步接口
2. 为入住导入（occupancy）添加异步接口
3. 考虑添加取消导入功能
4. 考虑添加导入历史记录
