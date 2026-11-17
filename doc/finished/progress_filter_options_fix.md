# 筛选器选项修复进展

## 更新时间

2026-01-22 01:25

## 问题描述

用户导入学生信息和入住信息后，界面的学院/专业/班级级联筛选和楼栋筛选功能点击后无任何选项。

## 问题分析

### 问题一：楼栋筛选无选项

**根本原因**：前后端返回字段不匹配

- 后端 `/api/dorms/buildings` 返回 `{ items: [...] }`
- 前端 `useBuildings()` hook 期望 `{ buildings: [...] }`
- 导致 `buildingsData?.buildings` 始终为 `undefined`

**解决方案**：修改后端返回字段名从 `items` 改为 `buildings`

### 问题二：学院/专业/班级筛选无选项

**根本原因**：原实现依赖全量学生数据加载

- 筛选选项从 `data.students` 中使用 `useMemo` 提取
- 如果全量学生数据未加载完成或为空，筛选器无选项
- 性能问题：学生数据量大时，加载慢

**解决方案**：新增专用 API `/api/students/filter-options`

- 后端直接查询去重后的学院/专业/班级/年级列表
- 专业和班级带上父级关联字段，支持前端级联过滤
- 前端使用 React Query Hook 管理缓存

## 已完成的修改

### 后端修改

#### 1. 修复楼栋筛选返回格式

**文件**: `backend-go/internal/controller/infra_controller.go`

- `GetDormsBuildings` 方法返回字段从 `"items"` 改为 `"buildings"`

#### 2. 新增学生筛选选项 API

**文件**: `backend-go/internal/controller/extended_controller.go`

- 新增 `GetFilterOptions` 方法
- 查询去重的学院、专业（带学院关联）、班级（带专业关联）、年级列表
- 返回格式：

```json
{
  "colleges": ["信息学院", "管理学院", ...],
  "majors": [
    { "name": "计算机科学", "college": "信息学院" },
    ...
  ],
  "classNames": [
    { "name": "计科2301", "major": "计算机科学" },
    ...
  ],
  "grades": ["2024", "2023", ...]
}
```

**文件**: `backend-go/internal/router/router.go`

- 新增路由 `GET /api/students/filter-options`

### 前端修改

#### 1. 新增 Service 方法

**文件**: `frontend/src/services/studentService.js`

- 新增 `getFilterOptions(token)` 方法

#### 2. 新增 React Query Hook

**文件**: `frontend/src/hooks/useStudentFilterOptions.js` (新建)

- `useStudentFilterOptions()` Hook
- 5分钟缓存策略

#### 3. 修改 StudentManagementPage

**文件**: `frontend/src/pages/StudentManagementPage.jsx`

- 导入 `useStudentFilterOptions` Hook
- 替换原来从 `data.students` 提取的 `useMemo` 逻辑
- 改为使用 Hook 返回的数据
- 保留级联过滤逻辑（学院→专业→班级）

## 技术优势

| 对比项   | 原实现             | 新实现                |
| -------- | ------------------ | --------------------- |
| 数据来源 | 全量学生数据       | 专用 API              |
| 性能     | 差（加载全量数据） | 好（仅查询选项）      |
| 缓存     | 与学生数据耦合     | 独立 React Query 缓存 |
| 可复用性 | 仅限当前页面       | Hook 可多处复用       |
| 级联支持 | 前端内存过滤       | 后端返回关联关系      |

## 验证方式

1. 重启后端服务
2. 刷新前端页面
3. 点击楼栋筛选器 → 应显示楼栋选项（前提 building 表有数据）
4. 点击学院/专业/班级筛选器 → 应显示从 student 表提取的选项
5. 测试级联过滤：选择学院后，专业下拉只显示该学院下的专业

## 待验证

- [x] 楼栋筛选正常显示 ✅
- [x] 学院筛选正常显示 ✅ (2026-01-22 11:20 验证通过)
- [x] 专业筛选正常显示（级联）✅ (2026-01-22 11:20 验证通过)
- [x] 班级筛选正常显示（级联）✅ (2026-01-22 11:20 验证通过)
- [x] 年级筛选正常显示 ✅

## 额外修复 (2026-01-22 11:20)

### 问题二的补充修复

在首次实现后发现 majors 和 classNames 的字段值仍为空，经分析发现两个问题：

1. **后端 GORM 字段绑定问题**：
   - 匿名结构体字段 `Major`/`College`/`ClassName` 缺少 `gorm:"column:..."` 标签
   - GORM 无法将 SQL 查询结果 `major`/`college`/`className` 映射到 Go 结构体字段
   - **修复**：添加明确的 column 标签

2. **前端组件未更新**：
   - `CollegeMajorClassCascader.jsx` 组件仍然从 `data.students` 提取选项
   - 由于学生数据是分页加载的，无法获取全量选项
   - **修复**：导入并使用 `useStudentFilterOptions` Hook

### 修复的文件

- `backend-go/internal/controller/extended_controller.go` - 添加 GORM 列名标签
- `frontend/src/components/common/CollegeMajorClassCascader.jsx` - 使用新 Hook

### 最终验证

截图确认三列级联选择器正常工作：

- 学院列表：17 个学院正常显示
- 专业列表：选择学院后正确过滤
- 班级列表：选择专业后正确过滤
