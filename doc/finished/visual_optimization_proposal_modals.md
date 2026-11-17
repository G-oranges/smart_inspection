# 🎨 视觉优化美化方案：Modal 弹窗与表单统一重构

## 1. 方案背景 (Background)

为了进一步提升系统的原生感与精致度，本方案旨在将当前的“网页风格”弹窗升级为“iOS/macOS 原生卡片风格”。核心目标是消除杂乱的线条感（Line-heavy UI），引入填充式设计（Filled Style），并统一所有交互组件的触控高度与视觉规格。

## 2. 核心设计原则 (Core Principles)

- **去线条化 (De-lining)**: 移除输入框边框，改用背景色区分，减少视觉噪音。
- **触控优先 (Touch-friendly)**: 统一 44px 触控高度（iOS 标准），增加点击余量。
- **层次感 (Layering)**: 使用大圆角 (24px) 与弥散阴影，营造悬浮卡片质感。
- **结构化布局 (Structured Layout)**: 统一使用垂直布局 (Vertical Layout)，增强信息流可读性。

---

## 3. 具体美化建议 (Design Specifications)

### 3.1 弹窗容器 (Modal Container)

- **圆角 (Border Radius)**: 由默认值提升至 `24px`。
- **阴影 (Shadow)**: 引入更柔和、范围更广的弥散阴影 (`boxShadowSecondary`)。
- **边距 (Padding)**: 增加内容区外边距至 `32px`，避免紧凑感。
- **标题栏 (Header)**:
  - 移除标题下方的分割线。
  - 标题字号提升至 `20px`，并加粗。
  - 背景与内容区统一，实现无缝过渡。

### 3.2 输入框与下拉框 (Inputs & Selects)

- **视觉风格**: 彻底切换为 **“填充模式” (Filled)**。
  - 背景色：浅色模式下为 `#F2F2F7` (Apple System Gray 6)；深色模式下为 `rgba(255, 255, 255, 0.1)`。
  - 边框：设为 `transparent`，仅在聚焦时提供微弱光晕反馈。
- **尺寸规格**:
  - 高度：强制统一为 `44px`。
  - 圆角：统一为 `12px`。
- **交互反馈**:
  - 取消默认的蓝色外边框（Outline），改为内部光圈或无边框平滑过渡。

### 3.3 表单布局 (Form Layout)

- **排列方式**: 统一改为 **垂直布局 (`layout="vertical"`)**。
- **标签样式**: 标签位于输入框正上方，字号 `14px`，颜色采用次要文本色，减轻视觉重量。
- **间距**: 增加表单项 (`Form.Item`) 之间的垂直间距，维持呼吸感。

### 3.4 按钮系统 (Button System)

- **主按钮 (Primary)**:
  - 颜色：Apple Blue (`#007AFF`)。
  - 形状：全圆角胶囊形 (`borderRadius: 22`) 或 `12px` 圆角。
  - 动效：加入 `active:scale-95` 点击缩放反馈。
- **次要按钮 (Cancel/Default)**:
  - 样式：改为灰色填充效果，与输入框风格统一。
- **位置**: 在 Modal Footer 中推荐等宽分布或右侧紧凑排列。

---

## 4. 技术实施方案 (Implementation Plan)

通过修改 `src/theme/antdTheme.js` 中的 `Design Token` 即可实现全局生效，无需修改业务页面代码：

### 4.1 Token 配置预览 (Theme Overrides)

```javascript
components: {
  Input: {
    controlHeight: 44,
    colorBgContainer: '#F2F2F7',   // 浅色模式背景
    colorBorder: 'transparent',
    borderRadius: 12,
    activeBorderColor: '#007AFF',
    hoverBorderColor: 'transparent',
    controlOutlineWidth: 0,        // 移除强力光圈
  },
  Select: {
    controlHeight: 44,
    colorBgContainer: '#F2F2F7',
    colorBorder: 'transparent',
    borderRadius: 12,
  },
  Modal: {
    borderRadiusLG: 24,
    headerBg: 'transparent',
    footerBg: 'transparent',
    titleFontSize: 20,
    paddingContentHorizontalLG: 32,
    paddingMD: 32,
  },
  Button: {
    controlHeight: 44,
    borderRadius: 22,
    defaultBg: '#F2F2F7',
    defaultBorderColor: 'transparent',
  }
}
```

---

## 5. 预期效果对比 (Expected Outcome)

| 特性           | 优化前                  | 优化后                      |
| :------------- | :---------------------- | :-------------------------- |
| **弹窗圆角**   | 16px (较为生硬)         | **24px (圆润现代)**         |
| **输入框样式** | 白底灰边 (线框感重)     | **灰底填充 (块状感，极简)** |
| **点击舒适度** | 32px/40px (偏窄)        | **44px (宽大易触)**         |
| **视觉流向**   | 水平对齐 (可能参差不齐) | **垂直对齐 (逻辑清晰)**     |
| **系统感**     | 网页工具                | **iOS 原生 App 体验**       |
