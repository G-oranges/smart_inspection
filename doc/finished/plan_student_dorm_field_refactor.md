# 学生住宿冗余字段全链路处理方案

## 1. 背景与问题

### 1.1 当前数据模型现状

在 `student` 表中，存在以下与住宿相关的冗余字段：

| 字段名     | 类型        | 说明       | 问题                                    |
| ---------- | ----------- | ---------- | --------------------------------------- |
| `dormId`   | char(36) FK | 关联宿舍ID | 外键约束，空字符串会导致约束失败        |
| `building` | varchar     | 楼栋名称   | 冗余存储，与 dormitory 表数据可能不一致 |
| `roomNo`   | varchar     | 房间号     | 冗余存储，与 dormitory 表数据可能不一致 |
| `bedNo`    | varchar     | 床位号     | 冗余存储，与 dormbed 表数据可能不一致   |

同时，系统中存在正规化的住宿关联：

- `dormbed` 表：通过 `studentId` 字段关联学生，包含 `dormId` 和 `bedNo`
- `dormitory` 表：包含 `building`、`roomNo` 等宿舍信息

### 1.2 问题表现

1. **外键约束冲突**：新建学生时不填写宿舍信息，前端传递空字符串 `""`，数据库外键检查失败
2. **数据冗余**：同一份住宿信息存储在两处（student 表冗余字段 + dormbed 关联）
3. **数据不一致风险**：当通过入住/调宿接口修改 dormbed 时，student 表的冗余字段可能未同步更新
4. **维护成本高**：每次住宿变更需要同时更新多处

### 1.3 目标架构

**核心原则**：学生的住宿信息应**仅通过 `dormbed` 表关联**获取，`student` 表不再存储任何住宿冗余字段。

```
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│   student   │ 1───1 │   dormbed   │ N───1 │  dormitory  │
│             │       │             │       │             │
│ id          │◄──────│ studentId   │       │ id          │
│ fullName    │       │ dormId      │──────►│ building    │
│ studentNo   │       │ bedNo       │       │ roomNo      │
│ ...         │       │ status      │       │ floor       │
│             │       │             │       │ ...         │
│ ─────────── │       └─────────────┘       └─────────────┘
│ ❌ dormId   │  (待删除)
│ ❌ building │  (待删除)
│ ❌ roomNo   │  (待删除)
│ ❌ bedNo    │  (待删除)
└─────────────┘
```

---

## 2. 分阶段实施计划

### Phase 1：紧急修复（✅ 已完成 2026-01-21）

**目标**：解决当前 "新建学生报外键约束错误" 的问题，不改变数据模型。

#### 2.1.1 前端修复

**文件**：`frontend/src/pages/StudentManagementPage.jsx`

在 `handleFormSubmit` 函数中，提交前清理空字符串：

```javascript
const payload = {
  // ... 其他字段
  // 住宿字段：空字符串转为 null，避免外键约束问题
  dormId: form.dormId || null,
  bedNo: form.bedNo || null,
  // building 和 roomNo 是冗余的展示字段，不应由前端提交
};
```

#### 2.1.2 后端兜底

**文件**：`backend-go/internal/service/student_service.go`

在 `CreateStudent` 方法开头增加防御性处理：

```go
func (s *studentService) CreateStudent(student *model.Student) error {
    // 防御性处理：空字符串视为无宿舍
    if student.DormID != nil && *student.DormID == "" {
        student.DormID = nil
    }
    if student.DormBuilding != nil && *student.DormBuilding == "" {
        student.DormBuilding = nil
    }
    if student.DormRoomNo != nil && *student.DormRoomNo == "" {
        student.DormRoomNo = nil
    }
    if student.BedNo != nil && *student.BedNo == "" {
        student.BedNo = nil
    }
    // ... 原有逻辑
}
```

**预期效果**：即使前端传空字符串，后端也能正确处理为 NULL，不再触发外键约束错误。

---

### Phase 2：读路径切换（✅ 已完成 2026-01-21）

**目标**：所有读取学生住宿信息的地方，改为从 `dormbed` 关联获取，忽略冗余字段。

#### 2.2.1 后端查询层

**文件**：`backend-go/internal/controller/extended_controller.go` - `GetStudentTable`

**现状**（已实现）：

```go
// 从实时关联中提取住宿信息 (读路径切换)
var building, roomNo, bedNo string
if s.Bed != nil {
    dormID = &s.Bed.DormID
    bedNo = s.Bed.BedNo
    building = ptrToStr(s.Bed.Dorm.Building)
    roomNo = ptrToStr(s.Bed.Dorm.RoomNo)
}
```

**已完成**：

| 接口              | 状态                      |
| ----------------- | ------------------------- |
| `GetStudentTable` | ✅ 已使用 Bed.Dorm 关联   |
| `ExportStudents`  | ✅ 已使用 Bed.Dorm 关联   |
| `GetStudents`     | ✅ 已切换到 Bed.Dorm 关联 |
| `GetMe`           | ✅ 已切换到 Bed.Dorm 关联 |

#### 2.2.2 前端展示层

**文件**：`frontend/src/pages/StudentManagementPage.jsx`

确保表格渲染器使用 API 返回的 `building`、`roomNo`、`bedNo`（来自后端关联查询），而非学生对象上的冗余字段。

**现状**（已正确）：

```javascript
const STUDENT_RENDERERS = {
  building: (student) => student.building || "-", // 从 API 获取
  roomNo: (student) => student.roomNo || "-",
  bedNo: (student) => student.bedNo || "-",
};
```

---

### Phase 3：写路径隔离（中期）

**目标**：`student` 表的 CRUD 操作不再写入住宿冗余字段；住宿变更仅通过专用接口处理 `dormbed` 表。

#### 2.3.1 后端 Service 层

**文件**：`backend-go/internal/service/student_service.go`

修改 `CreateStudent` 和 `UpdateStudent`，使用 GORM 的 `Omit` 确保不写入冗余字段：

```go
// CreateStudent
if err := tx.Omit("dormId", "building", "roomNo", "bedNo").Create(student).Error; err != nil {
    return err
}

// UpdateStudent
if err := tx.Model(&model.Student{}).Where("id = ?", id).
    Omit("dormId", "building", "roomNo", "bedNo").
    Updates(student).Error; err != nil {
    return err
}
```

#### 2.3.2 前端表单调整

**文件**：`frontend/src/pages/StudentManagementPage.jsx`

1. 从新建/编辑表单中**移除**宿舍选择下拉框
2. 住宿信息改为只读展示区域，显示来自接口的关联数据
3. 住宿变更入口改为独立的 "入住/调宿" 按钮，调用专用接口

#### 2.3.3 住宿专用接口（已有）

确保以下接口正确操作 `dormbed` 表：

- `POST /api/occupancy/check-in` - 入住
- `POST /api/occupancy/check-out` - 退宿
- `POST /api/occupancy/transfer` - 调宿

---

### Phase 4：数据迁移与字段删除（后期）

**目标**：彻底删除 `student` 表中的冗余字段。

#### 2.4.1 数据一致性校验

在删除字段前，需验证 `student` 表冗余字段与 `dormbed` 关联数据一致：

```sql
-- 检查不一致的记录
SELECT s.id, s.studentNo, s.dormId AS student_dormId, db.dormId AS bed_dormId
FROM student s
LEFT JOIN dormbed db ON s.id = db.studentId
WHERE s.dormId IS NOT NULL
  AND (db.dormId IS NULL OR s.dormId != db.dormId);
```

若存在不一致，需手动或脚本修复后再继续。

#### 2.4.2 数据库迁移脚本

```sql
-- Step 1: 删除外键约束
ALTER TABLE student DROP FOREIGN KEY Student_dormId_fkey;

-- Step 2: 删除冗余字段
ALTER TABLE student
  DROP COLUMN dormId,
  DROP COLUMN building,
  DROP COLUMN roomNo,
  DROP COLUMN bedNo;
```

#### 2.4.3 后端模型更新

**文件**：`backend-go/internal/model/models.go`

移除 `Student` 结构体中的相关字段：

```go
type Student struct {
    // ... 其他字段保留
    // 删除以下行：
    // Dorm         *Dormitory `gorm:"foreignKey:DormID" json:"dorm,omitempty"`
    // DormID       *string    `gorm:"column:dormId;type:char(36)" json:"dormId"`
    // DormBuilding *string    `gorm:"column:building" json:"building"`
    // DormRoomNo   *string    `gorm:"column:roomNo" json:"roomNo"`
    // BedNo        *string    `gorm:"column:bedNo" json:"bedNo"`
}
```

---

## 3. 涉及文件清单

| 阶段 | 文件路径                                                | 修改类型 | 说明                      |
| ---- | ------------------------------------------------------- | -------- | ------------------------- |
| P1   | `frontend/src/pages/StudentManagementPage.jsx`          | 修改     | 空字符串转 null           |
| P1   | `backend-go/internal/service/student_service.go`        | 修改     | 空字符串防御处理          |
| P2   | `backend-go/internal/controller/extended_controller.go` | 确认     | 确保所有查询使用 Bed 关联 |
| P3   | `backend-go/internal/service/student_service.go`        | 修改     | Omit 冗余字段             |
| P3   | `frontend/src/pages/StudentManagementPage.jsx`          | 修改     | 移除表单中宿舍选择        |
| P4   | 数据库                                                  | DDL      | 删除字段                  |
| P4   | `backend-go/internal/model/models.go`                   | 修改     | 移除模型字段              |

---

## 4. 风险与回滚

### 4.1 风险评估

| 风险                    | 影响 | 缓解措施                         |
| ----------------------- | ---- | -------------------------------- |
| P1 修复后旧数据不一致   | 低   | 仅影响新数据，不触及历史         |
| P3 隔离后导入功能受影响 | 中   | 导入接口需同步调整，入住逻辑前置 |
| P4 删除字段后无法回滚   | 高   | 删除前必须完成数据校验和备份     |

### 4.2 回滚策略

- **P1/P2/P3**：代码级回滚，通过 Git 恢复
- **P4**：需从备份恢复数据库结构

---

## 5. 执行时间线

| 阶段    | 预计耗时 | 前置条件                        |
| ------- | -------- | ------------------------------- |
| Phase 1 | 0.5h     | 无                              |
| Phase 2 | 1h       | P1 完成                         |
| Phase 3 | 2h       | P2 完成 + 入住接口可用          |
| Phase 4 | 1h       | P3 稳定运行 2 周 + 数据校验通过 |

---

## 6. 执行记录

| 阶段    | 完成时间         | 备注                                               |
| ------- | ---------------- | -------------------------------------------------- |
| Phase 1 | 2026-01-21 16:54 | 前端空字符串转 null + 后端防御性处理               |
| Phase 2 | 2026-01-21 16:55 | GetStudents、GetMe 接口已切换到 Bed.Dorm 关联      |
| Phase 3 | 2026-01-21 17:07 | 后端 Create 使用 Omit + 前端移除 dormId/bedNo 字段 |
| Phase 4 | 待执行           | 需 P3 稳定运行后执行                               |

## 7. 下一步行动

**Phase 3 已完成**，建议：

1. 稳定运行观察 1-2 周
2. 执行数据一致性校验（见 Phase 4 的 SQL 脚本）
3. 确认无问题后执行 Phase 4 删除冗余字段
