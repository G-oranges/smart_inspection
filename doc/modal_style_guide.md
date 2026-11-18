# 桌面端弹窗统一规范（co-modal）

> 适用范围：所有桌面端（>= 768px）的 `antd Modal`。移动端底部抽屉、ActionSheet、全屏弹窗不受此规范约束。
> 样式实现：`frontend/src/styles/components/overlay.css`（`co-modal` 段落）
> 宽度档位：`frontend/src/components/common/modalSizes.ts`

## 1. 整改前的问题

| 问题 | 涉及弹窗 |
| --- | --- |
| 旧样式失效：`glass-modal` / `apple-modal` 写的是 `.ant-modal-content`，AntD 6 已改为 `.ant-modal-container`，覆盖层全部不生效，弹窗实际只剩各自的内联样式 | 全部使用 `glass-modal` / `apple-modal` 的弹窗 |
| 标题字号、字重各写各的（`text-lg`、`text-xl`、`text-base`，有的带 `text-gray-800`） | 宿舍、教职工、楼栋、批量入住、结果详情、床位详情、录入页弹窗 |
| 标题前有无意义的图标或色块 | 宿位异动（指南针）、导入向导（蓝色方块）、字段设置（蓝色竖条）、版本更新（蓝色刷新图标） |
| 标题冗长或带修饰语 | “精细化批量入住分配”、“生成临时密码成功”、“办理宿位异动”、“编辑宿舍信息” |
| 宽度无规律：300 / 400 / 420 / 540 / 560 / 580 / 600 / 680 / 700 / 720 / 760 / 780 / 880 / 900 / 1000，部分用默认 520 | 全部 |
| 有的居中、有的 `top: 20`、有的贴顶 | 宿位异动、用户表单、角色、楼栋、学生详情等 |
| 内容过长时没有统一滚动，部分只靠 `maxHeight: 70vh` 内联兜底，部分直接溢出屏幕 | 学生表单、宿位异动、批量入住、导入预检 |
| 按钮写法不一：`apple-btn-*`、默认按钮、`bg-ios-blue` 圆角大按钮、`rounded-xl`、`px-8`，有的按钮带装饰图标 | 录入页弹窗、任务发布、楼栋详情、字段设置 |
| 导入向导在组件内部注入 `.apple-modal` 全局样式，污染其它弹窗 | `ImportWizardModal` |

## 2. 统一规范

### 2.1 用法

```tsx
import { MODAL_WIDTH } from "@/components/common/modalSizes"; // 按相对路径引入

<Modal
  open={open}
  title="编辑宿舍"
  centered
  width={MODAL_WIDTH.md}
  className="co-modal"
  onCancel={onClose}
  footer={[
    <Button key="cancel" className="apple-btn-secondary" onClick={onClose}>取消</Button>,
    <Button key="ok" type="primary" className="apple-btn-primary" onClick={onOk}>保存</Button>,
  ]}
>
  ...
</Modal>
```

必须同时具备：`className="co-modal"`、`centered`、`width={MODAL_WIDTH.*}`。

### 2.2 宽度档位

| 档位 | 宽度 | 用途 |
| --- | --- | --- |
| `sm` | 480 | 确认、提示、单字段输入、修改密码 |
| `md` | 640 | 常规表单、详情 |
| `lg` | 880 | 导入预检、多步骤表单、字段设置、含表格的管理弹窗 |
| `xl` | 1080 | 左右分栏工作区（入住分配、宿位异动） |

窗口不足时宽度自动收缩为 `100vw - 4rem`。

### 2.3 结构与尺寸

| 部分 | 规则 |
| --- | --- |
| 容器 | 圆角 `--co-radius-xl`，背景 `--co-bg`，1px `--co-glass-border` 描边，阴影 `--co-glass-shadow-lg`；最大高度 `100vh - 4rem` |
| 标题栏 | 内边距 20px 24px 16px，底部 1px 分隔线；标题 18px / 600 / `--co-text` |
| 关闭按钮 | 右上角，颜色 `--co-text-muted` |
| 内容区 | 内边距 20px 24px；超出高度时内容区内部滚动，标题栏和底栏固定，保证内容在电脑端完整可见 |
| 底栏 | 内边距 16px 24px，顶部 1px 分隔线，按钮右对齐，间距 12px |

### 2.4 标题

- 只用一个纯文本主标题，不加副标题、说明行、图标、色块。
- 标题用“动作 + 对象”或“对象 + 详情”，4 到 8 个字：`新增宿舍`、`编辑教职工`、`学生详情`、`宿舍导入预检`。
- 不在 `title` 里写 `<span className="text-lg font-bold">` 之类的样式，字号字重由 `co-modal` 统一。
- 必要的提示放进内容区第一行，不放在标题里。

### 2.5 按钮

- 取消 / 关闭：`apple-btn-secondary`；主操作：`type="primary"` + `apple-btn-primary`；危险操作：`type="primary" danger`。
- 主按钮放最右，一个弹窗只有一个主按钮。
- 按钮不加装饰图标，不加 `px-8`、`rounded-xl`、`bg-ios-blue`、`size="large"`、`block`。
- 自定义 footer 用 `<div className="co-modal-footer">`；需要左右分组（如“恢复默认”在左）时加 `co-modal-footer--split`，左侧次要操作用 `type="text"`。

### 2.6 颜色

- 弹窗只使用 `--co-*` token：背景 `--co-bg`，文字 `--co-text` / `--co-text-secondary` / `--co-text-muted`，强调只用主色按钮。
- 不在标题、外框、概览块上额外叠加蓝/绿/橙等底色；状态信息用 antd `Alert` / `Tag` 的语义色即可。

### 2.7 特殊情况

- 内容自带完整布局（导入向导）：追加 `co-modal--flush`，内容区去掉内边距，由内部自行滚动。
- 移动端需要全屏或底部样式时，只在移动端去掉 `co-modal`，例如 `className={isMobile ? "result-detail-modal" : "result-detail-modal co-modal"}`。
- `Modal.confirm` 统一走 `frontend/src/utils/confirm.ts`，不在此规范内。

## 3. 已整改弹窗清单

| 弹窗 | 文件 | 标题 | 宽度 |
| --- | --- | --- | --- |
| 修改密码（新版布局） | `layouts/AppLayout.tsx` | 修改密码 / 请先修改密码 | sm |
| 修改密码（旧布局） | `components/Layout.tsx` | 修改密码 | sm |
| 床位详情 | `components/BedDetailModal.tsx` | N号床 | sm |
| 宿位异动 / 入住分配 | `components/ResidencyAdjustModal.tsx` | 宿位异动 / 入住分配 | xl |
| 字段设置 | `components/TableFieldSettings.tsx` | 传入标题 | lg |
| 导入向导 | `components/common/ImportWizardModal.tsx` | 配置标题 | lg + flush |
| 导入向导加载中 | `components/common/LazyImportWizardModal.tsx` | 无 | sm |
| 版本更新 | `components/common/PWAUpdatePrompt.tsx` | 发现新版本 | sm |
| 用户新增/编辑 | `pages/account-permission/UserFormModal.tsx` | 新增用户 / 编辑用户 | md |
| 临时密码 | `pages/account-permission/TempPasswordModal.tsx` | 临时密码 | sm |
| 角色新增/编辑、角色类型新增/编辑 | `pages/account-permission/RoleManagementSection.tsx` | 原标题 | md |
| 角色类型管理 | `pages/account-permission/RoleManagementSection.tsx` | 角色类型管理 | lg |
| 寝室长冲突确认 | `pages/account-permission/MonitorSetupSection.tsx` | 寝室长冲突确认 | md |
| 楼栋表单 / 详情 / 导入预检 | `pages/building/modals/*` | 原标题 | md / md / lg |
| 宿舍新增 / 编辑 / 详情 / 导入预检 | `pages/dorm/modals/*` | 新增宿舍 / 编辑宿舍 / 宿舍详情 / 宿舍导入预检 | md / md / md / lg |
| 学生表单 / 详情 / 导入预检 | `pages/student/modals/*` | 原标题 | lg / md / lg |
| 教职工表单 / 导入预检 | `pages/teacher/modals/*` | 新增教职工 / 编辑教职工 / 教职工导入预检 | md / lg |
| 批量入住分配 | `pages/occupancy/BatchCheckInModal.tsx` | 批量入住分配 | xl |
| 任务发布 | `pages/task-publish/TaskPreviewModal.tsx` | 发布任务 / 编辑任务 | lg（移动端全屏不变） |
| 查寝结果详情 | `pages/result/modals/ResultDetailModal.tsx` | 查寝结果详情 | md（移动端全屏不变） |
| 基础分 / 发现位置 / 宿舍成员 / 确认离开 | `pages/result-entry/modals/*` | 基础分 / 选择发现位置 / 宿舍成员 / 确认离开 | sm / md / sm / sm |

未纳入：`UploadActionSheetModal`（移动端 ActionSheet 形态）、`IOSActionSheet`、`MobileAdvancedFilter`、各类 `Drawer`。

## 4. 新增弹窗检查项

- [ ] 有 `className="co-modal"`、`centered`、`width={MODAL_WIDTH.*}`
- [ ] 标题为纯文本，无图标、色块、副标题
- [ ] 按钮使用 `apple-btn-secondary` / `apple-btn-primary`，无装饰图标
- [ ] 未写 `bodyStyle`、`style={{ top }}`、内联 `maxHeight`
- [ ] 未新增 `.ant-modal-*` 全局覆盖，也未新增颜色变量
