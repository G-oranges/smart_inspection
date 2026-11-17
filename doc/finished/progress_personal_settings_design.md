# 进展记录 - 个人中心与系统设置设计方案

## 任务背景

用户需要为现有的 Apple-like 暗色玻璃拟态查寝系统设计左下角个人入口、个人信息页面及相关功能脑暴（角色切换、密码修改、资料管理、工作台统计等）。

## 当前进度

- [x] **需求分析**: 深入理解 Apple HIG 原则及系统现有玻璃拟态视觉风格。
- [x] **Token 定义**: 整理并补齐色彩、圆角、阴影、动效及毛玻璃相关的设计 Token。
- [x] **桌面端方案设计**: 定义了左下角 User Card 入口、浮层菜单及右侧抽屉式个人中心。
- [x] **移动端方案设计**: 定义了悬浮 Profile Chip 入口及底部门推式 Action Sheet 布局。
- [x] **功能映射**: 将前端 UI 区块与后端 Go 接口（myProfile, updateMyContact, changePassword 等）进行一一对应。
- [x] **交互规约**: 明确了角色即时切换、退出二次确认、表单脏检查等核心逻辑。
- [x] **规范文档输出**: 已在 `doc/personal_settings_design_spec.md` 提交完整的设计规范。

## 下一步计划

- [ ] 待用户确认设计方案。
- [ ] 基于方案编写相关 React 组件（如 UserCard, ProfileDrawer, RoleSwitcher）。
- [ ] 对接后端相关个人信息与权限接口。

## 备注

- 本次任务仅输出设计方案与规范，不涉及代码修改。
- 设计方案完全兼容现有的 `tailwind.config.js` 与 `index.css` 变量体系。
