# Figma Design System Rules

这些规则用于指导 Codex 在本项目中处理 Figma-to-code、code-to-Figma 与设计系统对齐任务。所有 Figma 相关工作默认遵循以下约束，除非用户明确要求偏离。

## Project Facts

- 前端技术栈：React 18 + TypeScript + Vite
- UI 基础库：Ant Design 6、`@ant-design/icons`
- 样式组织：全局 CSS 入口 + token 化组件覆盖层 + 局部 Tailwind 工具类
- 全局样式入口：`frontend/src/styles/index.css`
- 设计令牌真相源：`frontend/src/styles/base/tokens.css`
- 通用 UI 组件目录：`frontend/src/components/common`
- 页面装配层目录：`frontend/src/pages/*`

## Design System Source Of Truth

### Tokens

- 颜色、圆角、玻璃面板、按钮、文本、阴影、过渡均以 `frontend/src/styles/base/tokens.css` 为唯一真相源。
- 只允许扩展和使用 `--co-*` 变量。
- 不要新增 `--color-*`、`--glass-*`、`--radius-*` 旧变量体系。
- 如果 Figma 设计需要新的 token，先在规范层提出，再决定是否进入代码；不要在实现阶段直接硬编码。

### Style Entry

- `frontend/src/styles/index.css` 是唯一全局样式入口。
- 不要新增第二个全局样式入口，也不要重新创建 `App.css` 或 `src/index.css`。

### Management Theme

- 管理类页面必须以 `management-theme-page` 作为主题容器。
- 管理页公共样式接口沿用当前代码中的历史命名：
  `dorm-toolbar-*`、`dorm-table-*`、`dorm-table-head*`、`dorm-table-wrapper`。
- 即使这些类名带有 “dorm” 语义，也应视为当前有效的管理页公共契约；不要为相同职责新造第二套前缀。

## Component Reuse Rules

优先复用以下通用组件与模式，不要在 Figma 实现或代码实现中重复发明：

- 统计卡：`frontend/src/components/common/AppleStatCard.tsx`
- 桌面筛选面板：`frontend/src/components/common/FilterDropdownPanel.tsx`
- 移动高级筛选：`frontend/src/components/common/MobileAdvancedFilter.tsx`
- 移动操作表：`frontend/src/components/common/IOSActionSheet.tsx`
- 学院/专业/班级级联：`frontend/src/components/common/CollegeMajorClassCascader.tsx`
- 统计承载层：`frontend/src/components/stats/CollapsibleStatsBoard.tsx`

页面层职责：

- `frontend/src/pages/*` 负责装配、路由、业务态和页面布局
- `frontend/src/components/common/*` 负责无业务依赖的通用 UI
- 业务子模块可以在 `frontend/src/pages/<feature>/*` 下拆分，但应继续复用公共契约

## Styling Rules

- 先用现有 token 和全局组件契约表达设计，不要优先加一堆新的 Tailwind 原子类。
- 管理页按钮先复用 `apple-btn-primary` / `apple-btn-secondary`，再叠加 `dorm-toolbar-button*`。
- 高密度表单统一复用 `apple-form` + `apple-form-compact` + `form-item-inline-switch`。
- 移动端列表优先复用 `mobile-compact-card`。
- 桌面筛选优先 `FilterDropdownPanel`，移动筛选优先 `MobileAdvancedFilter`。
- 不要新增与现有管理页结构重叠的工具栏、表格头、表格 wrapper 基类。

## Figma MCP Workflow

处理 Figma 相关任务时，按以下顺序执行：

1. 先确认任务是“从代码抽规范到 Figma”还是“从 Figma 还原到代码”
2. 若涉及现有设计文件，先获取文件上下文、节点上下文或设计系统规则
3. 将 Figma 输出映射回本项目现有 token、组件和页面结构
4. 在代码实现时优先复用已有组件，不要把 Figma 参考代码原样落库
5. 在设计规范输出时保留 “Figma 表达名称 <-> 代码类名/组件名” 的双向映射

### For code-to-Figma tasks

- 先从代码中提取 token、组件模式和页面骨架，再决定 Figma 文件结构。
- Figma 中可以使用中性命名，如 `Management / Toolbar / Primary`，但必须记录它对应的代码类名或组件。
- 管理页样板默认以学生管理页为首个模板，不要擅自换成其它页面。

### For figma-to-code tasks

- 把 Figma 设计视为视觉与交互参考，而不是本项目最终代码风格。
- 必须映射到：
  `frontend/src/styles/base/tokens.css`
  `frontend/src/styles/index.css`
  `frontend/src/components/common`
  `frontend/src/pages/*`
- 禁止为 Figma 落地新增第二套管理页样式前缀或第二套颜色体系。

## Assets And Icons

- 图标优先使用 `@ant-design/icons`，保持与现有代码一致。
- 不要为了匹配 Figma 临时引入新的 icon 包，除非现有系统无法覆盖且用户明确要求。
- 当前本地静态资源目录为 `frontend/src/assets`。
- 图片资源应优先复用现有文件或由 Figma/设计任务明确提供，不要随意制造占位资源体系。

## Student Management Template Mapping

学生管理页是当前管理类页面的首个样板模板，关键映射如下：

- 页面壳：`frontend/src/pages/StudentManagementPage.tsx`
- 统计区：`frontend/src/pages/student/StudentStats.tsx`
- 桌面工具栏：`frontend/src/pages/student/StudentToolbar.tsx`
- 移动搜索与高级筛选：`frontend/src/pages/student/StudentMobileFilters.tsx`
- 表单弹窗 / 抽屉：`frontend/src/pages/student/modals/StudentFormModal.tsx`

Figma 中若需要建立样板页，应覆盖三种状态：

- desktop list view
- mobile list entry + advanced filter drawer
- create/edit form modal/drawer

## Hard Bans

- 不要为新设计规范继续扩展旧变量体系
- 不要跳过 `management-theme-page` 直接套管理页子类
- 不要在新管理页里混用 `macos-table` 与 `dorm-table`
- 不要把 marketing hero、装饰性 dashboard card mosaic 带进管理类工作面
- 不要把 Figma 里的抽象命名写成与代码完全断开的体系
- 不要在未确认可编辑权限时假设可以直接写入当前 Figma 团队文件
