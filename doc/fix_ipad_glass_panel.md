# iPad Safari `.glass-panel` 显示异常修复

## 问题描述

- **现象**：浅色模式下 `.glass-panel` 出现黑色阴影和黑色边框；深色模式下出现白色阴影和白色边框
- **影响范围**：iPad 浏览器（Safari WebKit 内核）
- **电脑浏览器**：正常

## 根本原因

### `color-mix()` CSS 函数兼容性问题

`utilities.css` 中的 `.glass-panel` 使用了 `color-mix()` CSS 函数：

```css
/* 旧代码 */
.glass-panel {
  background: color-mix(in srgb, var(--co-on-primary) 50%, transparent);
  border: 1px solid color-mix(in srgb, var(--co-on-primary) 28%, transparent);
  box-shadow:
    0 12px 40px color-mix(in srgb, var(--co-text) 12%, transparent),
    0 0 0 1px color-mix(in srgb, var(--co-text) 4%, transparent);
}
```

`color-mix()` 在部分 iPad Safari 版本上解析失败时，浏览器会：

- 浅色模式：回退到 `--co-text` 原始色 `#1a1a2e`（深蓝黑色）→ 黑色阴影/边框
- 深色模式：回退到 `--co-on-primary` 原始色 `#ffffff`（白色）→ 白色阴影/边框

### 与 TypeScript 迁移的关系

TypeScript 迁移本身不是根因，但可能改变了 CSS 构建管线的处理方式（PostCSS / Vite 插件行为变化），导致 `color-mix()` 未被转译为兼容写法。

## 修复方案

将 `color-mix()` 替换为传统 `rgba()` 写法（100% 跨浏览器兼容）。

### 修改文件

- `frontend/src/styles/components/utilities.css`
  - `.glass-panel` / `.glass-panel-heavy` — 已修复
  - `.apple-shadow-*` — 已修复
  - `.card` / `.deduction-item-row` — 已修复

### 待处理（其他文件中的 color-mix）

以下文件仍使用 `color-mix()`，如 iPad 上出现类似问题需逐一替换：

- `table-macos.css` — 表格样式
- `task-publish.css` — 任务发布
- `task-publish-modal.css` — 任务发布弹窗
- `tag-apple.css` — 标签样式
- `pill-bar.css` — 底部导航
- `overlay.css` — 遮罩层
- `form-apple.css` — 表单样式
- `filter-panel.css` — 筛选面板
- `stats.css` — 统计卡片
- `result-detail-modal.css` — 结果详情弹窗

## 修复时间

- 2026-03-10
