# 宿舍管理页分页器样式统一

## 任务目标
将学生管理页面表格下方的分页器样式（包括分页器、每页显示数选择器、跳转输入框）完整应用到宿舍管理页面的卡片视图和缩略视图底部。

## 完成情况：✅ 已完成

### 根本原因分析

学生管理页面使用 `ResponsiveDataView` → `GlassTable` → AntD `Table`（`size="middle"`），AntD Table 会自动将内嵌分页器设为 `size="small"`，导致分页按钮尺寸为 **24px**。

宿舍管理页面的卡片/缩略视图使用独立的 `<Pagination>` 组件，默认渲染为标准尺寸（32px），加上 CSS 中硬编码为 36px，导致分页按钮明显偏大。

### 变更内容

#### 1. `DormManagementPage.tsx` — 分页组件属性调整
- 卡片视图和缩略视图的 `<Pagination>` 组件新增 `size="small"` prop，匹配学生管理表格的小尺寸分页器
- 移除了无效的 `className="apple-pagination px-4 pb-4"`（`apple-pagination` 无 CSS 定义，Tailwind padding 与 `.dorm-pagination-shell` 冲突）

#### 2. `dorm-management.css` — 分页按钮尺寸调整
- 页码按钮尺寸：`36px` → `24px`
- 按钮圆角：`10px` → `6px`
- 行高：`34px` → `22px`

### 最终对齐验证

| 样式属性 | 学生管理表格分页 | 宿舍卡片/缩略分页 |
|---------|---------------|-----------------|
| 分页组件 size | small（Table 自动设置）| small（显式 prop）|
| 按钮尺寸 | 24px × 24px | ✅ 24px × 24px |
| 按钮圆角 | 6px | ✅ 6px |
| 下拉选择器高度 | 25px | ✅ 25px |
| 跳转输入框宽 | 56px | ✅ 56px |
| 容器背景 | 半透明 + border-top | ✅ 一致 |
| showSizeChanger | ✅ | ✅ |
| showQuickJumper | ✅ | ✅ |
| showTotal | ✅ | ✅ |

### 涉及文件
- `frontend/src/pages/DormManagementPage.tsx`
- `frontend/src/styles/components/dorm-management.css`
