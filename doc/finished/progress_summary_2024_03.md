# 项目进展总结 - 2024-03-?? (本次会话)

## 核心进展

### 1. 前端智能玻璃拟态系统 (Glassmorphism) 全面应用

- **全局样式抽取**: 在 `index.css` 中建立了 `智能玻璃拟态系统`，包含 `--glass-fallback-bg` 和 `--glass-dynamic-bg` 等变量。
- **特性检测引入**: 使用 `@supports` 规则，仅在支持 `backdrop-filter` 的设备（现代桌面端、iOS、高性能 Android）上开启模糊效果。
- **智能降级方案**: 在不支持模糊的移动端或旧版浏览器上，自动切换为高不透明度 (`0.95`) 的背景色，彻底解决了移动端 UI 元素「显示不直观或残缺」的问题。
- **移动端增强**: 针对 768px 以下设备增加了背景不透明度，确保在各种光照环境下均有出色的阅读体验。
- **页面一致性更正**:
  - `BuildingSelectPage.jsx`: 应用了 `.glass-card`。
  - `TaskPublishPage.jsx`: 移除了内联 `glassCardStyle`，统一使用 `.glass-card`。
  - `ResultViewPage.jsx`: 移除了内联样式，统一使用 `.glass-card`。
  - `StudentManagementPage.jsx`: 样式重构，并修复了因 JSX 结构导致的空白页问题。
  - `AdminSettingsPage.jsx`: 移除了冗余内联样式。
  - `AccountPermissionPage.jsx`: 移除了冗余内联样式。
  - `ResultEntryPage.jsx`: 移除了冗余内联样式，优化了底部粘性栏的玻璃效果。
  - `DormManagementPage.jsx`: 统一样式至 `.glass-card`。

### 2. 后端「占位符超限」关键阻碍解决 (Error 1390)

- **根本原因分析**: GORM 的 `FindByID` 默认执行了深度 `Preload`（包含 Dorms, Executors, ExecutorDorms 等），当一个任务关联上万个宿舍时，MySQL 预处理语句的占位符数量（限制为 65535）会迅速爆表。
- **Repository 优化**:
  - 新增 `FindBasicByID`: 仅查询任务基本信息。
  - 新增 `FindWithDormIDsByID`: 仅查询任务及关联表的 ID，不加载数万个完整的 `Dormitory` 对象。
  - 改进 `Update`: 使用 `map[string]interface{}` 形式的 `Updates`，严格禁止 GORM 在保存任务时尝试同步关联表数据。
- **Service 逻辑重构**:
  - `UpdateTask`: 改用 `FindWithDormIDsByID` 并在更新时显式控制字段，避免了无效的深度加载。
  - `CreateTask`: 返回结果也切换为轻量级查询。
- **Controller 调整**:
  - 更新和删除操作前的状态查询均已切换为轻量级方法，彻底消除了更新截止日期或状态时的保存报错。

### 3. 环境与配置验证

- **API 基准地址**: 确认 `VITE_API_BASE` 为空是正确的，利用 Vite Proxy 走相对路径在移动端测试环境中最为稳健。

## 下一步建议

1. **多端回归测试**: 在真实的 Android Chrome 和 iOS Safari 上刷新页面，确认玻璃效果是否已平滑降级（显示为纯色块而非透明块）。
2. **性能监控**: 虽然解决了报错，但上万条宿舍数据的传输对前端内存仍有压力，建议后续在任务编辑弹窗中引入「虚拟滚动」或「异步分批加载」宿舍列表。
