# 角色管理配置生效覆盖清单

更新时间：2026-04-17

## 已确认完善

### 角色、权限、用户接口

- `GET/POST/PUT/DELETE /api/roles`
- `PUT /api/roles/:id/status`
- `GET/PUT /api/roles/:id/data-scope`
- `GET/POST/PUT/DELETE /api/role-types`
- `PUT /api/role-types/:id/status`
- `GET /api/permissions/me`
- `GET/PUT /api/permissions/roles`
- `GET/PUT /api/permissions/users/:userId`
- `PUT /api/permissions/batch-overrides`
- `GET /api/users/executors`
- `GET/POST/PUT/DELETE /api/users`
- `PUT /api/users/:id/reset-password`
- `POST /api/users/:id/temporary-password`
- `GET/PUT /api/users/me`

结论：
- 这些接口不要求数据范围裁剪，但已纳入当前角色体系。
- 角色新增、编辑、删除、启停、角色类型管理、账号单独授权、主角色与多角色分配、执行人筛选都已和当前权限体系联动。

### 学生域

- `GET /api/students`
- `GET /api/students/table`
- `GET /api/students/filter-options`
- `POST /api/students`
- `PUT /api/students/:id`
- `DELETE /api/students`
- `POST /api/students/batch-delete`
- `PUT /api/students/batch-monitor`
- `POST /api/students/import/preview`
- `POST /api/students/import`
- `GET /api/students/export`
- `POST /api/v2/students/import/preview`
- `POST /api/v2/students/import/execute`
- `POST /api/v2/students/import/execute-async`

结论：
- 学生查询、筛选、导出、增删改、批量设置寝室长都已按 academic scope 生效。
- 学生导入链路本轮已补齐：
  - 预览接口会标记超出学籍范围的数据。
  - 执行接口在存在越权学生时整单拒绝。
  - V1/V2、同步/异步语义保持一致。

### 宿舍域与入住办理

- `GET /api/dorms`
- `GET /api/dorm-beds`
- `GET /api/dorms/buildings`
- `GET /api/dorms/floors`
- `GET /api/dorms/rooms`
- `GET /api/dorms/find`
- `GET /api/dorms/table`
- `GET /api/dorms/stats`
- `POST /api/dorms`
- `PUT /api/dorms/:id`
- `DELETE /api/dorms`
- `POST /api/dorms/batch-delete`
- `GET /api/dorms/:id/members`
- `POST /api/dorms/import/preview`
- `POST /api/dorms/import`
- `GET /api/dorms/export`
- `POST /api/dorms/batch-checkout`
- `POST /api/dorms/batch-checkout-students`
- `POST /api/dorms/batch-checkin`
- `POST /api/dorms/import-checkin`
- `POST /api/v2/infra/dorms/import/preview`
- `POST /api/v2/infra/dorms/import/execute`
- `POST /api/v2/infra/dorms/import/execute-async`
- `GET /api/occupancy/stats`
- `POST /api/occupancy/assign`
- `POST /api/occupancy/move`
- `POST /api/occupancy/swap`
- `POST /api/occupancy/checkout`
- `POST /api/v2/occupancy/import/preview`
- `POST /api/v2/occupancy/import/execute`
- `POST /api/v2/occupancy/import/execute-async`

结论：
- 宿舍查询、床位、楼栋/楼层/房间级联、精确定位、成员查询都已按 dormitory scope 生效。
- 宿舍写操作、批量入住/退宿、入住办理、宿舍导入、入住导入都已按“宿舍范围 + 学生范围”规则预检。

### 任务、结果、申诉、看板

- `POST /api/tasks`
- `GET /api/tasks`
- `GET /api/tasks/:id`
- `PUT /api/tasks/:id`
- `DELETE /api/tasks/:id`
- `POST /api/tasks/:id/inspections`
- `GET /api/tasks/:id/dorms/my`
- `GET /api/tasks/:id/inspections`
- `GET /api/inspections`
- `GET /api/inspections/mine`
- `PUT /api/inspections/:id`
- `POST /api/inspections/:id`
- `GET /api/inspections/export`
- `POST /api/appeals`
- `GET /api/appeals`
- `GET /api/appeals/mine`
- `PUT /api/appeals/:id/status`
- `GET /api/dashboard/summary`

结论：
- 任务列表、详情、创建、修改、删除已按可见宿舍范围约束。
- 检查结果列表、导出与申诉列表已按可见学生/宿舍范围约束。
- 看板汇总本轮已纳入角色配置生效链路，统计口径改为当前用户可见数据集，不再是全库无差别汇总。

### 认证与权限快照一致性

- `GET /api/auth/me`
- `GET /api/me`
- `POST /api/auth/logout`
- `POST /api/auth/verify-password`
- `PUT /api/auth/change-password`

结论：
- 这些接口不做数据范围裁剪，但角色启停、权限缓存失效、权限注入结果已经联动，当前用户权限快照不会继续沿用旧角色状态。

## 已确认不属于角色管理完善范围

### 公开认证与密码找回

- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/check-email`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`

结论：
- 这些接口属于认证与账户恢复，不参与角色数据范围控制。

### 教工、楼栋、系统设置、表格配置、上传、模板、进度

- `GET/POST/PUT/DELETE /api/teachers`
- `POST /api/teachers/import`
- `POST /api/teachers/import/preview`
- `GET /api/teachers/export`
- `POST /api/v2/teachers/import/preview`
- `POST /api/v2/teachers/import/execute`
- `POST /api/v2/teachers/import/execute-async`
- `GET/POST/PUT/DELETE /api/buildings`
- `GET /api/buildings/all`
- `GET /api/buildings/export`
- `POST /api/buildings/import`
- `POST /api/buildings/import/preview`
- `POST /api/v2/infra/buildings/import/preview`
- `POST /api/v2/infra/buildings/import/execute`
- `POST /api/v2/infra/buildings/import/execute-async`
- `GET/PUT /api/settings`
- `GET/PUT /api/table-config`
- `POST /api/uploads`
- `POST /api/uploads/batch`
- `POST /api/uploads/avatar`
- `GET /api/templates/:type`
- `GET /api/import/progress/:jobId`
- `GET /health`

结论：
- 这些接口当前只需要登录或权限控制，不属于角色数据范围控制目标。
- 本轮已确认它们不应被错误标记为“待补数据范围”的接口。

### 审计日志

- `GET /api/audit-logs`
- `GET /api/audit-logs/stats`
- `GET /api/audit-logs/options`
- `DELETE /api/audit-logs`

结论：
- 审计日志属于管理后台能力，按权限控制，不做数据范围裁剪。

## 待后续评估

- `GET /api/students/me`
- `PUT /api/students/me/contact`
- `GET /api/appeals/mine`
- `GET /api/inspections/mine`
- `GET /api/tasks/:id/dorms/my`

说明：
- 这些接口已经有自己的“当前登录人”或“当前执行人”语义，当前未发现明显越权漏口。
- 它们不属于本轮优先补口对象，但如果后续产品要把“个人视图”也纳入统一角色配置解释，需要单独再定规则。

## 说明

- 当前可以认定：后端核心业务接口已经完成角色权限与数据范围接入，学生导入与看板汇总这两个明显漏口也已在本轮补齐。
- 当前不能认定：所有接口都需要数据范围控制。对于认证、设置、表格配置、上传、模板、导入进度、楼栋/教工等接口，本轮结论是“只需要权限控制，不属于角色数据范围控制目标”。
- 如果后续继续收尾，下一步更适合做数据库层约束、迁移脚本，以及更完整的接口级/联调测试，而不是继续扩大数据范围接入面。
