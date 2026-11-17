# 确认弹窗体系审计报告

> **审计日期**: 2026-02-07  
> **范围**: `frontend/src/` 全量代码  
> **目标**: 收集确认弹窗/交互现状、识别策略缺口、为未来统一设计提供数据支撑

---

## 1. 确认入口表面清单 (Confirm Surface Inventory)

### 1.1 Modal.confirm 使用位置

| 序号 | 文件路径                                          | 函数/位置                         | 操作类型       | 风险等级 | okText   | okType  | cancelText | className     | DB写操作 | 响应式适配 | 深色模式    |
| ---- | ------------------------------------------------- | --------------------------------- | -------------- | -------- | -------- | ------- | ---------- | ------------- | -------- | ---------- | ----------- |
| 1    | `layouts/AppLayout.jsx`                           | `confirmLogout`                   | 登出           | 中       | 确认退出 | danger  | 取消       | apple-modal   | ✅       | ❌ 无差异  | ✅ 依赖全局 |
| 2    | `pages/teacher/TeacherActionSheet.jsx`            | `handleDelete`                    | 批量删除教职工 | 高       | 确认     | danger  | 取消       | apple-confirm | ✅       | ❌ 无差异  | ⚠️ 仅浅色   |
| 3    | `pages/student/StudentActionSheet.jsx`            | 删除操作                          | 批量删除学生   | 高       | 确认删除 | danger  | 取消       | ❌ 无         | ✅       | ❌ 无差异  | ⚠️ 默认样式 |
| 4    | `pages/dorm/useDormActions.jsx`                   | `handleDeleteSingle`              | 单个删除宿舍   | 高       | ❌ 默认  | danger  | ❌ 默认    | ❌ 无         | ✅       | ❌ 无差异  | ⚠️ 默认样式 |
| 5    | `pages/dorm/useDormActions.jsx`                   | `handleBulkDelete`                | 批量删除宿舍   | 高       | ❌ 默认  | danger  | ❌ 默认    | ❌ 无         | ✅       | ❌ 无差异  | ⚠️ 默认样式 |
| 6    | `pages/building/useBuildingActions.jsx`           | `handleBulkDelete`                | 批量删除楼栋   | 高       | 确认删除 | danger  | 取消       | ❌ 无         | ✅       | ❌ 无差异  | ⚠️ 默认样式 |
| 7    | `pages/account-permission/useAccountActions.jsx`  | `handleBulkDelete`                | 批量删除用户   | 高       | 确认删除 | danger  | 取消       | ❌ 无         | ✅       | ❌ 无差异  | ⚠️ 默认样式 |
| 8    | `pages/account-permission/useAccountActions.jsx`  | `handleResetPassword`             | 重置密码       | 高       | 确认重置 | ❌ 默认 | 取消       | ❌ 无         | ✅       | ❌ 无差异  | ⚠️ 默认样式 |
| 9    | `pages/account-permission/useAccountActions.jsx`  | `handleToggleStatus`              | 切换用户状态   | 中       | 确认     | ❌ 默认 | 取消       | ❌ 无         | ✅       | ❌ 无差异  | ⚠️ 默认样式 |
| 10   | `pages/occupancy/useOccupancyActions.jsx`         | `handleBatchCheckout`             | 批量退宿       | 高       | 确认退宿 | ❌ 默认 | 取消       | ❌ 无         | ✅       | ❌ 无差异  | ⚠️ 默认样式 |
| 11   | `pages/occupancy/useOccupancyActions.jsx`         | `handleBatchCheckIn` (分配未完成) | 部分提交确认   | 中       | ❌ 默认  | ❌ 默认 | ❌ 默认    | ❌ 无         | ✅       | ❌ 无差异  | ⚠️ 默认样式 |
| 12   | `pages/result/useResultActions.jsx`               | `handleDeleteResults`             | 删除查寝记录   | 高       | 确定     | danger  | 取消       | apple-modal   | ✅       | ❌ 无差异  | ✅ 依赖全局 |
| 13   | `pages/admin-settings/useAdminSettingsActions.js` | `handleSave`                      | 保存系统设置   | 中       | 确认保存 | ❌ 默认 | 取消       | ❌ 无         | ✅       | ❌ 无差异  | ⚠️ 默认样式 |
| 14   | `pages/task-publish/useTaskPublishActions.jsx`    | `handleDeleteTask`                | 删除任务       | 高       | 确认删除 | danger  | ❌ 默认    | apple-modal   | ✅       | ❌ 无差异  | ✅ 依赖全局 |

### 1.2 Popconfirm 使用位置 (行内确认)

| 序号 | 文件路径                                           | 操作类型     | 风险等级 | okText    | cancelText | 备注       |
| ---- | -------------------------------------------------- | ------------ | -------- | --------- | ---------- | ---------- |
| 1    | `pages/teacher/TeacherColumns.jsx`                 | 单行删除     | 中       | 确定      | 取消       | 表格行内   |
| 2    | `pages/student/StudentColumns.jsx`                 | 单行删除     | 中       | 确定      | 取消       | 表格行内   |
| 3    | `pages/dorm/DormColumns.jsx`                       | 单行删除     | 中       | ✅ 自定义 | ✅ 自定义  | 表格行内   |
| 4    | `pages/building/BuildingColumns.jsx`               | 单行删除     | 中       | ✅ 自定义 | ✅ 自定义  | 表格行内   |
| 5    | `pages/occupancy/OccupancyColumns.jsx`             | 单行退宿     | 中       | ✅ 自定义 | ✅ 自定义  | 表格行内   |
| 6    | `pages/account-permission/UserColumns.jsx`         | 单行删除     | 中       | ✅ 自定义 | ✅ 自定义  | 表格行内   |
| 7    | `pages/account-permission/MonitorSetupSection.jsx` | 寝室长设置   | 低       | ✅ 自定义 | ✅ 自定义  | 功能确认   |
| 8    | `components/OccupancyHistory.jsx`                  | 批量删除历史 | 中       | 确定      | 取消       | 历史记录   |
| 9    | `layouts/AppLayout.jsx`                            | 角色切换     | 低       | 确定      | 取消       | 移动端菜单 |

### 1.3 IOSActionSheet 使用位置 (移动端底部抽屉)

| 序号 | 文件路径                                       | 操作类型       | 包含危险操作 | 内嵌二次确认     |
| ---- | ---------------------------------------------- | -------------- | ------------ | ---------------- |
| 1    | `pages/teacher/TeacherActionSheet.jsx`         | 编辑/删除      | ✅           | ✅ Modal.confirm |
| 2    | `pages/student/StudentActionSheet.jsx`         | 查看/编辑/删除 | ✅           | ✅ Modal.confirm |
| 3    | `pages/account-permission/UserActionSheet.jsx` | 删除           | ✅           | ✅ Modal.confirm |
| 4    | `layouts/AppLayout.jsx`                        | 用户菜单       | ❌           | ❌               |

---

## 2. DB 写操作映射 (DB-Write Action Map)

### 2.1 服务层写操作 → 确认状态

| 服务文件               | 方法名                      | HTTP方法 | 操作描述       | 前端确认状态        | 确认机制       |
| ---------------------- | --------------------------- | -------- | -------------- | ------------------- | -------------- |
| **authService.js**     |                             |          |                |                     |                |
|                        | `login`                     | POST     | 登录           | ❌ 无需确认         | -              |
|                        | `logout`                    | POST     | 登出           | ✅ 已有确认         | Modal.confirm  |
|                        | `changePassword`            | PUT      | 修改密码       | ⚠️ **待审视**       | 表单提交       |
|                        | `resetPassword`             | POST     | 忘记密码重置   | ❌ 无需确认         | 验证码流程     |
| **userService.js**     |                             |          |                |                     |                |
|                        | `createUser`                | POST     | 创建用户       | ❌ 无需确认         | 表单提交       |
|                        | `updateUser`                | PUT      | 更新用户       | ❌ 无需确认         | 表单提交       |
|                        | `deleteUsers`               | DELETE   | 删除用户       | ✅ 已有确认         | Modal.confirm  |
|                        | `resetPassword`             | POST     | 重置密码       | ✅ 已有确认         | Modal.confirm  |
|                        | `updateMe`                  | PUT      | 更新个人信息   | ❌ 无需确认         | 表单提交       |
|                        | `generateTemporaryPassword` | POST     | 生成临时密码   | ❌ 无需确认         | 按钮直接调用   |
| **teacherService.js**  |                             |          |                |                     |                |
|                        | `create`                    | POST     | 创建教职工     | ❌ 无需确认         | 表单提交       |
|                        | `update`                    | PUT      | 更新教职工     | ❌ 无需确认         | 表单提交       |
|                        | `delete`                    | DELETE   | 删除教职工     | ✅ 已有确认         | Modal.confirm  |
|                        | `import`                    | POST     | 导入教职工     | ✅ 已有确认         | 预览→确认流程  |
| **studentService.js**  |                             |          |                |                     |                |
|                        | `createStudent`             | POST     | 创建学生       | ❌ 无需确认         | 表单提交       |
|                        | `updateStudent`             | PUT      | 更新学生       | ❌ 无需确认         | 表单提交       |
|                        | `deleteStudents`            | DELETE   | 删除学生       | ✅ 已有确认         | Modal.confirm  |
|                        | `importStudents`            | POST     | 导入学生       | ✅ 已有确认         | 预览→确认流程  |
| **dormService.js**     |                             |          |                |                     |                |
|                        | `createDorm`                | POST     | 创建宿舍       | ❌ 无需确认         | 表单提交       |
|                        | `updateDorm`                | PUT      | 更新宿舍       | ❌ 无需确认         | 表单提交       |
|                        | `deleteDorm`                | DELETE   | 删除单个宿舍   | ✅ 已有确认         | Modal.confirm  |
|                        | `deleteDorms`               | DELETE   | 批量删除宿舍   | ✅ 已有确认         | Modal.confirm  |
|                        | `batchCheckout`             | POST     | 批量退宿       | ✅ 已有确认         | Modal.confirm  |
|                        | `batchCheckIn`              | POST     | 批量入住       | ⚠️ **部分确认**     | 仅不完整分配时 |
|                        | `batchCheckoutStudents`     | POST     | 学生批量退宿   | ✅ 已有确认         | Modal.confirm  |
|                        | `assignBed`                 | POST     | 分配床位       | ❌ 无确认           | 直接调用       |
|                        | `moveBed`                   | PUT      | 移动床位       | ❌ 无确认           | 直接调用       |
| **buildingService.js** |                             |          |                |                     |                |
|                        | `createBuilding`            | POST     | 创建楼栋       | ❌ 无需确认         | 表单提交       |
|                        | `updateBuilding`            | PUT      | 更新楼栋       | ❌ 无需确认         | 表单提交       |
|                        | `deleteBuilding`            | DELETE   | 删除单个楼栋   | ⚠️ **无确认**       | Popconfirm     |
|                        | `batchDeleteBuildings`      | DELETE   | 批量删除楼栋   | ✅ 已有确认         | Modal.confirm  |
|                        | `importBuildings`           | POST     | 导入楼栋       | ✅ 已有确认         | 预览→确认流程  |
| **taskService.js**     |                             |          |                |                     |                |
|                        | `createTask`                | POST     | 创建任务       | ❌ 无需确认         | 表单提交       |
|                        | `updateTask`                | PUT      | 更新任务       | ❌ 无需确认         | 表单提交       |
|                        | `deleteTask`                | DELETE   | 删除任务       | ✅ 已有确认         | Modal.confirm  |
|                        | `deleteInspection`          | DELETE   | 删除检查记录   | ✅ 已有确认         | Modal.confirm  |
|                        | `deleteInspections`         | DELETE   | 批量删除检查   | ✅ 已有确认         | Modal.confirm  |
|                        | `submitScore`               | POST/PUT | 提交评分       | ❌ 无需确认         | 表单提交       |
|                        | `adjustScore`               | PUT      | 调整评分       | ❌ 无需确认         | 表单提交       |
|                        | `createAppeal`              | POST     | 提交申诉       | ❌ 无需确认         | 表单提交       |
|                        | `handleAppeal`              | PUT      | 处理申诉       | ❌ 无需确认         | 表单提交       |
| **commonService.js**   |                             |          |                |                     |                |
|                        | `updateSettings`            | PUT      | 更新系统设置   | ✅ 已有确认         | Modal.confirm  |
|                        | `batchUpdateUserOverrides`  | POST     | 批量更新权限   | ❌ 无确认           | 直接调用       |
|                        | `batchSetMonitor`           | POST     | 批量设置寝室长 | ⚠️ **冲突时有确认** | 条件性确认     |

---

## 3. 全局确认实现详情 (Global Confirm Implementation Detail)

### 3.1 当前实现方式

项目采用 **Ant Design Modal.confirm** 作为主要全局确认机制：

```javascript
Modal.confirm({
  title: "确认标题",
  content: "确认内容描述",
  okText: "确认按钮文案",
  okType: "danger",           // 危险操作标红
  cancelText: "取消",
  className: "apple-modal",   // 自定义样式类 (不一致)
  onOk: async () => { ... },
  onCancel: () => { ... },
});
```

### 3.2 样式类使用统计

| 样式类名        | 使用次数 | 使用位置                                                 |
| --------------- | -------- | -------------------------------------------------------- |
| `apple-modal`   | 8+       | AppLayout, useResultActions, useTaskPublishActions 等    |
| `apple-confirm` | 1        | TeacherActionSheet                                       |
| `glass-modal`   | 15+      | 各种 Modal 组件                                          |
| **无样式类**    | 10+      | useDormActions, useBuildingActions, useAccountActions 等 |

### 3.3 样式定义 (index.css)

```css
/* 苹果风格 Modal */
.apple-modal .ant-modal-content {
  @apply rounded-[24px] overflow-hidden p-0 bg-transparent !important;
}

.glass-modal .ant-modal-content {
  background: rgba(255, 255, 255, 0.6) !important;
  backdrop-filter: blur(40px) saturate(210%) !important;
  -webkit-backdrop-filter: blur(40px) saturate(210%) !important;
  border: 1px solid rgba(255, 255, 255, 0.4) !important;
  box-shadow:
    0 20px 50px rgba(0, 0, 0, 0.1),
    0 0 0 1px rgba(0, 0, 0, 0.02) !important;
}

[data-theme="dark"] .glass-modal .ant-modal-content {
  background: rgba(28, 28, 30, 0.65) !important;
  border: 1px solid rgba(255, 255, 255, 0.12) !important;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5) !important;
}
```

**问题**: `apple-confirm` 类样式未定义，导致使用该类的确认弹窗可能回退到默认样式。

---

## 4. 响应式行为详情 (Responsive Behavior)

### 4.1 移动端检测机制

项目使用 `useMobile` hook 进行断点检测：

```javascript
// hooks/useMobile.js
export function useMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < breakpoint);
  // 监听 resize 事件
  ...
}
```

### 4.2 确认弹窗响应式现状

| 确认类型       | 桌面端    | 移动端   | 差异处理      |
| -------------- | --------- | -------- | ------------- |
| Modal.confirm  | 居中弹窗  | 居中弹窗 | ❌ **无差异** |
| Popconfirm     | 气泡弹出  | 气泡弹出 | ❌ **无差异** |
| IOSActionSheet | ❌ 不使用 | 底部抽屉 | ✅ 仅移动端   |

### 4.3 响应式适配缺口

1. **Modal.confirm 在移动端体验不佳**
   - 无底部弹出动画
   - 按钮尺寸未优化 (未达到 iOS HIG 推荐的 44px 触摸区域)
   - 无手势关闭支持

2. **Popconfirm 在移动端问题**
   - 气泡可能被遮挡或位置不合理
   - 触摸区域较小

3. **建议**: 移动端危险操作应统一使用 `IOSActionSheet` + 二次确认流程

---

## 5. 主题系统与 Token (Theme System & Tokens)

### 5.1 Tailwind 配置 (tailwind.config.js)

```javascript
colors: {
  ios: {
    blue: '#007AFF',
    gray: '#F2F2F7',
    'gray-dark': '#1C1C1E',
    'gray-label': '#3C3C4399',
    green: '#34C759',
    red: '#FF3B30',      // 危险操作色
    orange: '#FF9500',
    // ...
  },
  macos: {
    sidebar: 'rgba(246, 246, 246, 0.6)',
    'sidebar-dark': 'rgba(30, 30, 30, 0.6)',
    accent: '#007AFF',
  }
}
```

### 5.2 Ant Design 主题配置 (theme/antdTheme.js)

关键确认相关 Token:

```javascript
// 浅色模式
lightConfig: {
  token: {
    colorPrimary: "#007AFF",
    colorError: "#FF3B30",
    colorBgContainer: "#ffffff",
    borderRadius: 12,
    // ...
  },
  components: {
    Modal: {
      borderRadiusLG: 24,
      contentBg: 'rgba(255,255,255,0.85)',
      // ...
    },
    Button: {
      borderRadius: 10,
      // ...
    },
  }
}

// 深色模式
darkConfig: {
  token: {
    colorPrimary: "#0A84FF",
    colorError: "#FF453A",
    colorBgContainer: "#1C1C1E",
    // ...
  }
}
```

### 5.3 深色模式支持现状

| 组件           | 深色模式支持 | 备注                        |
| -------------- | ------------ | --------------------------- |
| glass-modal    | ✅ 完整      | 有 [data-theme="dark"] 规则 |
| apple-modal    | ⚠️ 部分      | 仅透明背景，依赖 AntD Token |
| apple-confirm  | ❌ 未定义    | 无样式规则                  |
| Popconfirm     | ✅ 默认      | 继承 AntD 主题              |
| IOSActionSheet | ✅ 完整      | 组件内部处理                |

---

## 6. 确认策略缺口分析 (Confirmation Policy Gaps)

### 6.1 高优先级缺口 (P0 - 高风险)

| 缺口描述                  | 影响范围 | 当前状态      | 建议方案                      |
| ------------------------- | -------- | ------------- | ----------------------------- |
| `assignBed` 无确认        | 入住管理 | 直接调用      | 添加 Modal.confirm 或内联确认 |
| `moveBed` 无确认          | 入住管理 | 直接调用      | 添加确认，显示影响的学生      |
| 单个楼栋删除无 Modal 确认 | 楼栋管理 | 仅 Popconfirm | 高风险操作应增加 Modal        |
| `batchCheckIn` 确认不完整 | 入住管理 | 仅部分场景    | 所有批量入住应有完整确认      |

### 6.2 中优先级缺口 (P1 - 体验问题)

| 缺口描述                           | 影响范围 | 当前状态           | 建议方案                       |
| ---------------------------------- | -------- | ------------------ | ------------------------------ |
| 确认弹窗样式不统一                 | 全局     | 混用多种 className | 统一使用 `apple-confirm-modal` |
| 移动端确认无底部弹出效果           | 移动端   | 居中弹窗           | 移动端使用底部弹出式确认       |
| `generateTemporaryPassword` 无确认 | 账号管理 | 直接调用           | 敏感操作应增加确认             |
| `changePassword` 无确认            | 个人设置 | 表单提交           | 密码更改应有二次确认           |

### 6.3 低优先级缺口 (P2 - 优化项)

| 缺口描述               | 影响范围 | 当前状态           | 建议方案                   |
| ---------------------- | -------- | ------------------ | -------------------------- |
| 确认弹窗文案风格不统一 | 全局     | 各自定义           | 制定文案规范               |
| 取消按钮样式一致性     | 全局     | 部分透明、部分实心 | 统一设计规范               |
| 深色模式适配不完整     | 部分确认 | 依赖默认           | 显式定义深色样式           |
| 无确认操作的撤销支持   | 全局     | 无                 | 考虑增加 Toast + Undo 机制 |

---

## 7. 统一点建议 (Proposed Unification Points)

### 7.1 统一确认组件 API 建议

创建 `useConfirm` Hook 或 `ConfirmProvider` 组件：

```typescript
interface ConfirmOptions {
  type: "danger" | "warning" | "info";
  title: string;
  content: React.ReactNode;
  okText?: string;
  cancelText?: string;
  onOk: () => Promise<void> | void;
  onCancel?: () => void;
}

// 使用示例
const { confirm } = useConfirm();
confirm({
  type: "danger",
  title: "确认删除",
  content: `确定要删除选中的 ${count} 条记录吗？`,
  okText: "删除",
  onOk: handleDelete,
});
```

### 7.2 响应式策略建议

```
桌面端 (>= 768px):
├── 高风险操作 → Modal.confirm (居中弹窗)
├── 中风险操作 → Modal.confirm 或 Popconfirm
└── 低风险操作 → Popconfirm 或无确认

移动端 (< 768px):
├── 高风险操作 → IOSActionSheet + Modal.confirm
├── 中风险操作 → IOSActionSheet 或底部 Drawer 确认
└── 低风险操作 → Popconfirm 或无确认
```

### 7.3 样式统一建议

1. **定义统一样式类**: `apple-confirm-modal`
2. **完善深色模式**: 所有确认弹窗显式定义 `[data-theme="dark"]` 规则
3. **按钮规范**:
   - 危险操作: `okType="danger"`, 红色 (#FF3B30)
   - 普通确认: 主色 (#007AFF)
   - 取消按钮: 透明背景 + 灰色文字

### 7.4 文案规范建议

| 操作类型 | 标题模板     | 内容模板                                        | okText | cancelText |
| -------- | ------------ | ----------------------------------------------- | ------ | ---------- |
| 单个删除 | 确认删除     | 确定要删除「{name}」吗？此操作不可撤销。        | 删除   | 取消       |
| 批量删除 | 确认批量删除 | 确定要删除选中的 {n} 条记录吗？此操作不可撤销。 | 删除   | 取消       |
| 重置密码 | 确认重置密码 | 重置后密码将恢复为初始值，请确认。              | 重置   | 取消       |
| 登出     | 确认退出     | 将清理本地会话与缓存，确认退出？                | 退出   | 取消       |
| 保存设置 | 确认保存     | 更改将立即生效，确认保存？                      | 保存   | 取消       |

---

## 8. 下一步行动建议

### 8.1 短期 (1-2 周)

- [ ] 定义 `apple-confirm` 样式规则，补全深色模式
- [ ] 统一所有 Modal.confirm 使用 `className: "apple-confirm-modal"`
- [ ] 为 `assignBed` 和 `moveBed` 添加确认

### 8.2 中期 (1 个月)

- [ ] 创建 `useConfirm` Hook 统一确认 API
- [ ] 移动端高风险操作改用底部弹出式确认
- [ ] 制定并应用确认文案规范

### 8.3 长期 (季度)

- [ ] 评估并实现 Toast + Undo 机制
- [ ] 增加确认操作的审计日志支持
- [ ] 考虑生物识别二次验证 (敏感操作)

---

## 附录

### A. 相关文件清单

```
frontend/src/
├── layouts/AppLayout.jsx          # 登出确认
├── hooks/useMobile.js             # 移动端检测
├── theme/antdTheme.js             # 主题配置
├── components/common/
│   ├── IOSActionSheet.jsx         # iOS 风格底部菜单
│   └── ImportWizardModal.jsx      # 导入向导
├── pages/
│   ├── teacher/
│   │   ├── TeacherActionSheet.jsx
│   │   └── useTeacherActions.jsx
│   ├── student/
│   │   ├── StudentActionSheet.jsx
│   │   └── useStudentActions.jsx
│   ├── dorm/
│   │   ├── DormColumns.jsx
│   │   └── useDormActions.jsx
│   ├── building/
│   │   ├── BuildingColumns.jsx
│   │   └── useBuildingActions.jsx
│   ├── occupancy/
│   │   └── useOccupancyActions.jsx
│   ├── account-permission/
│   │   ├── UserActionSheet.jsx
│   │   └── useAccountActions.jsx
│   ├── result/
│   │   └── useResultActions.jsx
│   ├── admin-settings/
│   │   └── useAdminSettingsActions.js
│   └── task-publish/
│       └── useTaskPublishActions.jsx
└── services/
    ├── authService.js
    ├── userService.js
    ├── teacherService.js
    ├── studentService.js
    ├── dormService.js
    ├── buildingService.js
    ├── taskService.js
    └── commonService.js
```

### B. 搜索关键词

审计过程中使用的搜索关键词：

- `Modal.confirm`
- `Popconfirm`
- `danger`
- `handleDelete`
- `okText`
- `cancelText`
- `apple-modal`
- `apple-confirm`
- `glass-modal`
- `useMobile`
- `method: "POST"`
- `method: "DELETE"`
- `method: "PUT"`

---

_报告生成完毕。本报告仅用于审计目的，不包含代码修改。_
