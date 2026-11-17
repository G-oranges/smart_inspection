# 账号与权限管理页面检查与修复进展

## 检查时间

2025-12-26

## 检查范围

### 账号与权限管理页面

- 前端文件：`frontend/src/pages/AccountPermissionPage.jsx`
- 后端相关文件：
  - `backend-go/internal/controller/user_controller.go`
  - `backend-go/internal/service/user_service.go`
  - `backend-go/internal/repository/user_repository.go`
  - `backend-go/internal/controller/permission_controller.go`
  - `backend-go/internal/service/student_service.go`
  - `backend-go/internal/service/teacher_service.go`

---

## 发现的问题与修复

### 问题 1: 单条删除按钮的逻辑错误 ✅ 已修复

**问题描述**：
在用户列表的操作列中，单条删除按钮的 `onConfirm` 回调存在 bug：先使用 `setSelectedIds` 设置状态，然后立即调用 `handleBulkDelete()`。由于 React 的 `setState` 是异步的，`handleBulkDelete` 可能使用旧的 `selectedIds` 值。

**原始代码**：

```jsx
onConfirm={() => {
  setSelectedIds([user.id]);      // 异步操作
  setSelectAcrossPages(false);
  handleBulkDelete();              // 可能拿不到最新的 selectedIds
}}
```

**修复后代码**：

```jsx
onConfirm={async () => {
  if (!deleteUsers) return;
  setBatchLoading(true);
  try {
    await deleteUsers({ ids: [user.id] });  // 直接传入用户 ID
    setUserMessage("删除成功");
    setReloadFlag((prev) => prev + 1);
  } catch (err) {
    setUserMessage(err.message || "删除失败");
  } finally {
    setBatchLoading(false);
  }
}}
```

**修改文件**：`frontend/src/pages/AccountPermissionPage.jsx`

---

### 问题 2: 角色名称映射错误 ✅ 已修复

**问题描述**：
后端 `user_controller.go` 中的角色名称映射将 `LEADER` 翻译为"楼栋长"，但按业务需求应该是"学生干部"。

系统定义的四种标准角色：

- `ADMIN` → 管理员
- `COUNSELOR` → 辅导员
- `LEADER` → 学生干部
- `STUDENT` → 学生

**修改文件**：

1. `backend-go/internal/controller/user_controller.go`
   - 第 73 行：`"LEADER": "楼栋长"` → `"LEADER": "学生干部"`
   - 第 134 行注释：更新为"学生干部"
2. `backend-go/internal/repository/user_repository.go`
   - 第 80 行注释：更新为"学生干部"

---

### 问题 3: 关于"寝室长"说明

**澄清**：寝室长（Monitor）不是角色类型，而是学生的一个属性，表示该学生是否是其所在宿舍的寝室长。

- 字段：`Student.isMonitor`（布尔值）
- 类型：宿舍成员类型（寝室长/普通成员）
- 不属于权限系统中的角色（Role）

---

## 学生/教职工与账号同步逻辑确认

### 学生同步逻辑 ✅ 正常

**位置**：`backend-go/internal/service/student_service.go`

当创建或更新学生时，系统会自动同步到 User 表：

- 账号（username）= 学号（studentNo）
- 密码（password）= 学号（studentNo）
- 角色（role）= STUDENT
- 用户类型（userType）= STUDENT

**触发点**：

- `CreateStudent()` - 创建学生时同步
- `UpdateStudent()` - 更新学生时同步
- `BatchImport()` - 批量导入时同步

### 教职工同步逻辑 ✅ 正常

**位置**：`backend-go/internal/service/teacher_service.go`

当创建或更新教职工时，系统会自动同步到 User 表：

- 账号（username）= 工号（employeeNo）
- 密码（password）= 工号（employeeNo）
- 角色（role）= COUNSELOR
- 用户类型（userType）= TEACHER

**触发点**：

- `Create()` - 创建教职工时同步
- `Update()` - 更新教职工时同步
- `BatchImport()` - 批量导入时同步

---

## 待确认事项

1. 如果账号列表中没有显示学生和教职工同步的账号，可能原因：

   - 学生/教职工信息中的学号/工号字段为空
   - 学生/教职工还未通过正常流程创建（需要通过学生管理/教职工管理页面创建）
   - 数据库中已存在同名用户名但角色不是 STUDENT/COUNSELOR（系统会跳过同步以保证安全）

2. 建议检查：
   - 在学生管理页面导入或创建学生后，查看账号列表是否自动出现对应账号
   - 在教职工管理页面导入或创建教职工后，查看账号列表是否自动出现对应账号

---

## 修复状态总结

| 问题                | 状态        | 修改文件                                   |
| ------------------- | ----------- | ------------------------------------------ |
| 单条删除逻辑 bug    | ✅ 已修复   | `AccountPermissionPage.jsx`                |
| LEADER 角色名称错误 | ✅ 已修复   | `user_controller.go`, `user_repository.go` |
| 寝室长说明          | ✅ 已澄清   | 无需修改                                   |
| 学生/教职工同步     | ✅ 逻辑正常 | 无需修改                                   |

---

## 后续建议

1. 刷新浏览器页面验证前端修复效果
2. 后端已重启，刷新账号列表验证角色名称显示正确
3. 如账号列表仍未显示学生/教职工账号，请检查学生/教职工表中的学号/工号字段是否有数据
