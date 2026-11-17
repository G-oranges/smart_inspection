# 主题定制 & 头像管理 进展记录

> 更新时间: 2026-02-16

## 状态: ✅ 全部完成

## 三阶段实施

### 第一阶段：CSS 变量中台 ✅

- 扩展 `App.css` CSS 变量：`--app-bg-image`、`--error-bg`、`--info-bg`
- 替换 13 处硬编码背景色为 CSS 变量

### 第二阶段：背景主题定制 ✅

- 新增 `useThemeCustomization.js` Hook（5 套 CSS 渐变背景 + 暗色适配 + localStorage 持久化）
- 新增 `ThemeSettingsDrawer.jsx` iOS 风格底部选择面板
- 集成到 `App.jsx` + `AppLayout.jsx`，用户菜单新增"外观设置"入口

### 第三阶段：用户头像管理 ✅

- **后端**: User 模型新增 `AvatarURL` 字段，新增 `AvatarController`（`POST /api/uploads/avatar`，仅需登录）
- **前端**: 新增 `UserAvatar.jsx` 通用组件（优先上传头像 → 首字蓝圆 fallback）
- 账号管理表格新增头像列，`AppLayout` 全局头像替换为 `UserAvatar`
- `commonService.js` 新增 `uploadAvatar()` 方法

### 样式通透性专项优化 (2026-02-16) ✅

- **布局穿透**: `AppLayout.jsx` 移除 `bg-white` 实色遮罩，应用 `backdrop-blur` 和半透明色。
- **组件玻璃化**: `App.css` 全面覆盖 AntD 组件背景位半透明，支持亮/暗双模式背景穿透。
- **背景固定**: 设置 `background-attachment: fixed` 解决滚动断层。

## 构建验证

- `npx vite build` ✅ (4055 模块, exit 0)
- `go build ./...` ✅ (exit 0)
