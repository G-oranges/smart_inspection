# UI 重构进展：对齐 iOS/macOS 视觉一致性

## 核心目标

将所有管理类页面（学生、教师、宿舍、楼栋、入住）的 UI/UX 对齐 `DormManagementPage` 的高标准，严格遵循 Apple HIG 规范。

## 进展追踪

- [x] **学生管理页面 (StudentManagementPage.jsx)**

  - [x] 桌面端：引入 `FilterDropdownPanel`，优化筛选布局。
  - [x] 移动端：单行搜索筛选条，重构 FAB (Portal 挂载)。
  - [x] 样式：应用 `apple-search-input` 与 `apple-btn` 三态。
  - [x] 统计：使用 `AppleStatCard` 规范。

- [x] **师资管理页面 (TeacherManagementPage.jsx)**

  - [x] 桌面端：对齐 `DormManagementPage` 筛选与操作样式，引入 `FilterDropdownPanel`。
  - [x] 移动端：引入 `MobileAdvancedFilter`，重构 FAB (Portal 挂载)。
  - [x] 核心：重构教职工卡片为 `mobile-compact-card` 紧凑样式，对齐宿舍管理。
  - [x] 弹窗：重构教职工新增/编辑弹窗 (Modal & Drawer)。
  - [x] 导入：升级预检预览弹窗视觉效果。

- [x] **宿舍管理页面 (DormManagementPage.jsx)**

  - [x] 核心：建立 UI 参照标准（Card/Table/Filter）
  - [x] 二次打磨：同步全选/单选视觉指示器 (CheckCircleOutlined)
  - [x] 样式：对齐 SF Pro 字体栈与 Hero Summary 规范

- [x] **入住管理页面 (OccupancyManagementPage.jsx)**

  - [x] 桌面端：筛选栏下拉面板重构 (FilterDropdownPanel)
  - [x] 移动端：高级筛选集成 (MobileAdvancedFilter)
  - [x] 核心：入退宿流程弹窗视觉对齐，重构移动端 FAB 为模式切换按钮
  - [x] 交互：修复 `ResponsiveDataView` 单选逻辑，确保单选模式下精准控制
  - [x] 逻辑：修正混合批量选择（已入住+未入住）时的 ActionSheet 计数显示
  - [x] 统计与标题栏升级

- [x] **楼栋管理页面 (BuildingManagementPage.jsx)**
  - [x] 桌面端：筛选栏下拉面板布局修复 (对齐搜索框下方)，解决数据列消失的兜底逻辑。
  - [x] 移动端：单行筛选条 & 高级筛选面板，重现 FAB 按钮组交互。
  - [x] 核心：FAB 悬浮按钮组与 ActionSheet Portal 化，术语全线统一为“楼栋管理”。
  - [x] 样式：移动端卡片选中视觉适配，解决 Inset Grouped 嵌套问题。

## 关键技术规范

1. **Search Input**: 统一使用 `apple-search-input` 类，无边框，带微阴影。
2. **Buttons**: 桌面端 `apple-btn-primary/secondary`，移动端 `apple-btn-ios`。
3. **Filtering**: 桌面端 `FilterDropdownPanel`，移动端 `MobileAdvancedFilter`。
4. **FAB**: 必须使用 `createPortal` 挂载到 body。
5. **Stats**: 统一使用 `AppleStatCard`。
