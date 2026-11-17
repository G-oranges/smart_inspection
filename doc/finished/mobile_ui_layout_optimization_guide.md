# 移动端界面设计与布局优化规范

本规范旨在引导项目从“基础响应式布局”向“移动端深度优化”转型。通过提高信息密度 (Information Density)、强化视觉层级与交互微调，确保系统在手持设备上表现出极高的美观度与操作效率。

---

## 1. 核心组件重构原则

### 1.1 MobileDataCard 深度改造

以“宿舍管理”与“学生管理”页面为蓝本，建立统一的 `mobile-compact-card` 规范：

- **视觉风格**：
  - **背景**：采用 Glassmorphism 2.0，半透明背景 + 模糊自适应。
  - **边框**：1px 细边框，适配深色/浅色模式的透明度。
  - **头部 (Header)**：左侧为标题与副标题（如姓名+学号），右侧为状态标签 (Tag)。
  - **格栅内容 (Grid)**：使用 2 或 3 列网格展示核心字段。
- **点击交互逻辑**：
  - **全卡片点击**：点击卡片任何非操作项区域，均视为“选中/取消选中”操作。
  - **视觉反馈**：选中状态需有明显的边框高亮（Primary Color）和背景色块变深效果。
  - **操作预防**：点击复选框、下拉菜单按钮时，触发原生操作并阻止冒泡，不触发卡片选中逻辑。

### 1.2 专项组件标准

#### 1.2.1 FAB 悬浮按钮 (Floating Action Button)

- **定位**：固定在页面右下角 (`bottom: 32px`, `right: 24px`)。
- **样式**：圆形按钮 (直径 56px)，主色背景，高悬浮阴影 (`box-shadow: 0 8px 24px rgba(37, 99, 235, 0.35)`)。
- **逻辑**：仅用于当前页面的“主操作”，如“新增学生”、“发布任务”。

#### 1.2.2 选中吸底栏 (Selection Bottom Bar)

- **触发条件**：当 `selectedCount > 0` 时自动从底部滑入。
- **样式规范**：
  - **高度**：64px - 72px。
  - **背景**：毛玻璃效果 (`backdrop-filter: blur(20px)`) 叠加 `var(--color-surface)`。
  - **内容布局**：左侧显示“已选 N 项”数字，右侧提供 2-3 个核心批量操作按钮（如：批量删除、导出）。
- **交互目的**：将批量操作移入“大拇指操作热区”，减少顶部跨屏点击。

##### 按钮溢出处理规范

**问题**：当按钮数量达到 3-4 个（取消、详情、编辑、删除）时，在窄屏幕设备上容易导致吸底栏换行或溢出。

**解决方案（已实现）**：

1. **极窄屏幕图标化 (`@media max-width: 380px`)**：

   - 隐藏按钮文字，仅保留图标
   - 缩小按钮尺寸（`height: 26px`, `padding: 0 8px`）
   - 要求：**所有按钮必须包含 `icon` 属性**

2. **中等窄屏幕缩放 (`@media 381px - 420px`)**：

   - 减小按钮字号和内边距
   - 保留文字 + 图标组合

3. **按钮图标规范**：
   | 按钮 | 图标 |
   |-----|------|
   | 取消 | `<ReloadOutlined />` |
   | 详情 | `<EyeOutlined />` |
   | 编辑 | `<EditOutlined />` |
   | 删除 | `<DeleteOutlined />` |
   | 修改 | `<EditOutlined />` |

**代码示例**：

```jsx
<Button size="small" icon={<ReloadOutlined />}>取消</Button>
<Button size="small" icon={<EyeOutlined />}>详情</Button>
<Button size="small" type="primary" icon={<EditOutlined />}>编辑</Button>
<Button size="small" danger icon={<DeleteOutlined />}>删除</Button>
```

### 1.3 详情查看操作 (Detail View Action)

**参考实现**：`ResultViewPage.jsx` 的详情弹窗模式。

- **桌面端**：
  - 在表格右侧的"操作"列中添加"详情"按钮（使用 `EyeOutlined` 图标）。
  - 始终显示（无论是否有编辑权限），编辑/删除按钮根据权限显示。
  - 点击后弹出 `Modal`，内部使用 Ant Design `Descriptions` 组件展示完整信息。
- **移动端**：
  - **单选触发**：在吸底栏中，仅当 `selectedIds.length === 1` 时显示"详情"按钮。
  - 点击后弹出同一 `Modal`，内容自适应移动端宽度。
- **Modal 规范**：
  - 标题：`{数据类型}详情`（如"学生详情"、"宿舍详情"）。
  - Footer：左侧"关闭"按钮，右侧"编辑"按钮（如有权限）。
  - 类名：`glass-modal`（应用全局毛玻璃样式）。
  - 内容：使用 `Descriptions bordered size="small" column={2}` 展示所有关键字段。

### 1.4 核心指标卡片 (Stat Cards) 瘦身规范

针对仪表盘顶部的“多维指标卡片” (`stat-card`, `premium-glass`)，在移动端需执行“极致紧凑”策略，防止指标堆叠导致图表被挤出首屏：

- **从堆叠转网格 (Layout Shift)**：
  - 强制由 `xs={24}` (单列全宽) 调整为 `xs={12}` (两列双排) 或水平滑动列表。
- **视觉去重 (Visual Reduction)**：
  - **隐藏装饰背景**：移动端隐藏 `stat-icon-bg` 背景大图标，仅保留数值与标签，减少视觉干扰。
  - **数值扁平化**：
    - 主数值字号阶梯缩减（如从 `2.5rem` 降至 `1.5rem`）。
    - 带有分母的数值（如 `已住/总数`）改用单行展示，不再使用垂直分隔。
- **排版压缩 (Tightening)**：
  - 卡片内边距 (Padding) 从 `24px` 压缩至 `12px` 或更小。
  - 将原本垂直居中的内容改为左对齐，以适应两列网格布局。
- **设计目标**：确保在手机端首屏（高度约 800px）内不仅能看到 4 个核心指标，还能完整展示第一个趋势图表。

### 1.5 加载与反馈增强

- **骨架屏 (Skeleton)**：将现有的全局 `Spin` 替换为卡片颗粒度的骨架屏，减少加载时的视觉跳动。
- **无限滚动 (Infinite Scroll)**：在数据量适中的列表页，优先考虑“滚动加载”替代“分页器”。

---

## 2. 信息层级与内容策略 (Content Strategy)

### 2.1 视觉降噪：以视觉替文字

- **状态 (Status)**：直接使用 Ant Design `Tag` 或颜色圆点表示，不再重复书写 `状态：`。
- **动作图标**：联系方式、位置等信息优先使用图标（如 `PhoneOutlined`）代替文字 Label。
- **进度可视化**：如宿舍人数等容量类数据，使用微型进度条 (`Progress steps`) 代替 `3/4人` 文字。

### 2.2 字段合并 (Field Merging)

禁止机械地将表格列转为卡片行。

- **标题组合**：`Title: 张三` + `Subtitle: | 2023001` (学号直接并入标题行)。
- **二级信息并列**：`计算机学院 · 软件工程班` (用分隔符合并原本属于两行的信息)。

---

## 3. 全局显示覆盖规范 (CSS)

```css
@media (max-width: 768px) {
  /* 1. 紧凑型卡片通用样式 */
  .mobile-compact-card {
    background: var(--glass-card-bg);
    border: 1px solid var(--glass-border);
    border-radius: 12px;
    padding: 12px;
    margin-bottom: 12px;
    transition: all 0.2s ease;
    cursor: pointer;
  }

  .mobile-compact-card.selected {
    border-color: var(--color-primary);
    background: var(--color-primary-50);
    box-shadow: 0 4px 12px rgba(37, 99, 235, 0.1);
  }

  /* 2. 吸底操作栏动画 */
  .selection-bottom-bar {
    animation: slideUp 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
  }
}
```

---

## 4. 模块化管理要求

- **零硬编码**：移动端布局的所有间距、字号需在 `antdTheme.js` 中定义。
- **样式解耦**：移动端特有的 CSS 类独立维护，避免污染桌面端 Table 样式。

_最后更新：2025-12-27_
