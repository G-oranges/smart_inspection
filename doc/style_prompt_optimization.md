# 操作规范提示词优化建议

> **状态**：已落地（2026-03-05）
> **落地文件**：`/.agent/rules/操作规范.md`
> **用途**：作为样式规范治理的决策记录，不再作为待办建议文档。

---

## 一、核心问题诊断

历史上，操作规范提示词存在以下问题：

### 1. 未绑定现有设计令牌体系

提示词中提到 "iOS 蓝 `#007AFF`"、"System Gray" 等颜色，但实际项目已有完整的 `--co-*` 变量体系。AI 不知道应该使用哪些变量，导致每次产出样式时硬编码颜色值。

### 2. 缺少"已有组件"清单

提示词要求 AI "从零构建"组件样式，但项目已有 `.co-glass-panel`、`.co-glass-card`、`.mobile-compact-card` 等成熟组件类。AI 不了解这些，所以每次重复造轮子。

### 3. Tailwind vs CSS 类的边界模糊

提示词说 "使用 Tailwind CSS 处理所有视觉细节"，但实际项目大量使用自定义 CSS 类（`.co-*`、`.glass-*`），且 AntD 覆盖全部在 CSS 中完成。需要明确两者分工。

### 4. 样式文件落点不明确

提示词未指定新样式应该写在哪里，导致所有样式都堆积在 `frontend/src/App.css`（约 5805 行，2026-03-05）。

---

## 二、已采用的提示词内容（已落地到操作规范）

```markdown
### CSS 样式规范（必须严格遵守）

#### 变量体系

- **必须使用** `--co-*` 变量（定义在 `frontend/src/styles/base/tokens.css`）
- **禁止使用** `--color-*` 旧变量或硬编码颜色值
- 颜色速查：
  - 主色：`var(--co-primary)` (#3c83f6)
  - 成功：`var(--co-success)` (#34C759)
  - 警告：`var(--co-warning)` (#FF9500)
  - 错误：`var(--co-error)` (#FF3B30)
  - 正文：`var(--co-text)`
  - 二级文字：`var(--co-text-secondary)`
  - 辅助文字：`var(--co-text-muted)`

#### 已有组件类（直接使用，禁止重复定义）

**玻璃容器**：

- `.co-glass-panel` — 通用面板
- `.co-glass-card` — 卡片（带 hover 上浮）
- `.co-glass-input` — 输入框
- `.co-glass-btn` — 次要按钮
- `.co-glass-btn-primary` — 主要按钮

**动效**：

- `.co-animate-in` — 入场淡入
- `.co-press` — 移动端按压反馈
- `.co-hover-lift` — 桌面端 hover 上浮
- `.co-stagger` — 列表交错入场

**布局**：

- `.co-pill-bar` — 移动端底栏
- `.co-sidebar-nav-item` — 桌面端导航项

**业务组件**：

- `.mobile-compact-card` — 移动端列表卡片
- `.stat-card.premium-glass` — 统计指标卡
- `.filter-trigger-btn` — 筛选触发按钮

#### Tailwind 与 CSS 类的分工

| 场景                        | 使用                             |
| --------------------------- | -------------------------------- |
| 布局（flex/grid/间距/对齐） | Tailwind utility                 |
| 颜色、背景、阴影、圆角      | `--co-*` 变量                    |
| 可复用组件样式              | `.co-*` 类                       |
| AntD 组件覆盖               | CSS 选择器覆盖（已全局处理）     |
| 页面特有业务样式            | 在 `frontend/src/styles/components/` 新建文件 |

#### 新增样式的文件规范

- **通用组件样式** → `frontend/src/styles/components/` 下新建或追加
- **页面特有样式** → `frontend/src/styles/components/` 下按模块新建（如 `task.css`）
- **禁止向 `frontend/src/App.css` 追加任何新样式**
- 新文件需在 `frontend/src/styles/index.css` 中 `@import`

#### 深色模式

- 使用 `[data-theme="dark"]` 选择器
- 颜色一律用 `--co-*` 变量（自动切换亮/暗）
- AntD 组件深色适配已全局覆盖，无需重复处理

#### 响应式

- 断点：`md:` (768px) 区分移动/桌面
- 移动端用 `.co-pill-bar` 底部导航
- 桌面端用 `.co-sidebar-nav-item` 侧栏导航
```

---

## 三、已添加到操作规范的引用段落

在操作规范顶部“核心输入”部分，已加入如下内容：

```markdown
### 强制参考文档

在编写任何前端页面/组件之前，**必须先阅读以下文档**：

1. `doc/style_handbook.md` — 项目样式手册（设计令牌、组件类速查、开发指南）
2. `frontend/src/styles/base/tokens.css` — 设计令牌定义（唯一真相源）
3. `frontend/src/styles/components/glass.css` — 玻璃拟态组件类
4. `frontend/src/styles/components/animations.css` — 动画类

新增页面必须优先从手册中选用已有组件类，禁止自行创建相同功能的新类。
```

---

## 四、效果对比

| 维度     | 优化前                    | 优化后                        |
| -------- | ------------------------- | ----------------------------- |
| 颜色来源 | 每次硬编码 `#007AFF` 等   | 统一 `var(--co-primary)`      |
| 组件创建 | 每页各写一套玻璃卡片样式  | 复用 `.co-glass-card`         |
| 样式文件 | 全堆 `frontend/src/App.css`（约5805行） | 分模块到 `frontend/src/styles/components/` |
| 深色模式 | 每组件手动适配            | 变量自动切换 + 全局覆盖       |
| 新人上手 | 看不懂用哪套变量          | 查手册即可                    |
