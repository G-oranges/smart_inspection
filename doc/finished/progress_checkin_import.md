# 入住导入向导 + 学生住宿展示改造 进展文档

## 任务概述

将通用导入向导引入「入住管理系统」，并改造「学生管理界面」住宿信息展示逻辑：

- 学生表中的楼栋/楼层/床位冗余字段改为从入住事实源（DormBed.studentId）联查展示

## 基线对齐结果 ✅ 已完成

### 1. Student 表冗余住宿字段（需废弃）

| 字段名         | DB Column  | 类型     | 描述        |
| -------------- | ---------- | -------- | ----------- |
| `DormID`       | `dormId`   | \*string | 宿舍关联 ID |
| `DormBuilding` | `building` | \*string | 楼栋名称    |
| `DormRoomNo`   | `roomNo`   | \*string | 房间号      |
| `BedNo`        | `bedNo`    | \*string | 床位号      |

### 2. 入住事实源

- **唯一事实源**：`DormBed.StudentID`（无独立 Occupancy 表）
- **关系链**：`Student ← DormBed(studentId) → Dormitory → Building`
- **DormBed 结构**：`{ID, DormID, BedNo, StudentID, Status}`

### 3. 可复用的 V2 导入 Schema

```go
// Preview/Execute Request
type XxxImportPreviewRequest { Rows []XxxImportRow }
type XxxImportExecuteRequest { Strategy string, Rows []XxxImportRow }

// Response
type XxxImportPreviewResponse { TotalCount, PassCount, IssueCount, Issues[] }
type XxxImportExecuteResponse { TotalCount, CreatedCount, UpdatedCount, SkippedCount,
                                FailedCount, SuccessCount, FailedRows[] }

// Issue (A: 格式/必填, B: 引用不存在, C: 冲突)
type XxxImportIssue { RowNo, ErrorType, ErrorCode, Reason, Suggestion, AffectedFields[] }
```

### 4. 现有 V2 接口路径

| 模块     | Preview                                     | Execute                                     |
| -------- | ------------------------------------------- | ------------------------------------------- |
| 宿舍     | `/api/v2/infra/dorms/import/preview`        | `/api/v2/infra/dorms/import/execute`        |
| 学生     | `/api/v2/students/import/preview`           | `/api/v2/students/import/execute`           |
| **入住** | `/api/v2/occupancy/import/preview` (待新增) | `/api/v2/occupancy/import/execute` (待新增) |

---

## 阶段进展

###- [x] **阶段 1：入住管理导入向导集成**

- [x] A. 前端配置引入 (`CHECKIN_IMPORT_CONFIG`)
- [x] B. 后端模型补齐 (`OccupancyImportRow` 等)
- [x] C. 后端接口实现 (`PreviewImportOccupancyV2`, `ImportOccupancyV2`)
- [x] D. 路由注册与权限绑定
- [x] E. 冲突策略实现 (`OVERWRITE` -> 退宿重分)
- [x] F. 前端页面接入 (`OccupancyManagementPage` 按钮替换与向导加载)

- [x] **阶段 2：学生管理住宿信息“读路径切换”**
  - [x] A. 后端分页列表 API 改造 (`Preload("Bed.Dorm")`)
  - [x] B. 后端导出 API 改造
  - [x] C. 前端展示字段映射（DTO 兼容性保持）

- [x] **阶段 3：数据一致性治理与“写路径”断开**
  - [x] A. 后端更新逻辑限制 (`Omit("dormId", ...)`)
  - [x] B. 前端编辑表单隐藏冗余字段并添加提示

- [x] **阶段 4：冗余字段正式下线**
  - [x] A. 前端字段设置与文档标记
  - [ ] B. 数据库物理字段删除（建议观察一个版本后再执行）

---

## 改动文件清单（预计）

### 前端

- `frontend/src/constants/importConfigs.js` - 完善 CHECKIN_IMPORT_CONFIG
- `frontend/src/pages/OccupancyManagementPage.jsx` - 接入导入向导（或寻找实际页面名）
- `frontend/src/pages/StudentManagementPage.jsx` - 改造住宿展示

### 后端

- `backend-go/internal/model/import.go` - 新增入住导入数据结构
- `backend-go/internal/controller/occupancy_controller.go` - 新增 V2 导入接口
- `backend-go/internal/service/*` - 新增入住导入服务逻辑
- `backend-go/cmd/server/routes.go` - 注册新路由

---

_最后更新：2026-01-20 08:30_
