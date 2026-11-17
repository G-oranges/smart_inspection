# 导入向导推广与样式减法进展文档

## 1. 现状评估与资产审计 (材料清单)

根据对 `ImportWizardModal.jsx` 及相关配置的分析，现整理“最小可用材料清单”如下：

### 1) 现状证据 (现状长什么样)

- **信息架构 (步骤列表):**

  1. **下载模板**: 获取由 `config` 驱动的 Excel 示例或空模板。
  2. **上传文件**: 支持 `.xls/.xlsx`，解析 Sheet，支持行数和大小校验。
  3. **字段映射**: 桌面端使用 Table 映射，移动端使用半屏弹窗，支持自动模糊匹配。
  4. **数据预检**: 核心逻辑区，展示统计、过滤错误（A/B/C 类），支持错误行下载。
  5. **确认策略**: 处理冲突（跳过或覆盖）。
  6. **执行工作**: 展示结果面板，提供失败明细和异常报告下载。

- **交互特征:**

  - 采用 **Side Steps** 布局（左侧导航，右侧内容）。
  - 大量使用 **Apple HIG** 元素：`rounded-2xl`, `backdrop-blur`, `ios-blue` (#007AFF)。
  - **移动端**: 采用 TabBar 切换感，关键操作位于底部固定栏。

- **数据/后端模型:**
  - **预览响应 (V2):** `{ totalCount, passCount, issueCount, issues: [{ rowNo, errorType, reason, suggestion, affectedFields }] }`
  - **执行响应 (V2):** `{ totalCount, successCount, failedCount, createdCount, updatedCount, skippedCount, failedRows: [...] }`

### 2) 设计约束 (减法边界)

- **样式 Token (Tailwind):**
  - `colors: { ios: { blue, gray, red, green } }`
  - `borderRadius: { 'apple-xl': '20px' }`
  - `shadow: 'ios'`
- **复用资产 (可用组件):**
  - Ant Design v6 基础组件：`Steps`, `Upload`, `Select`, `Typography`, `Table`, `Result`, `Button`.
  - 系统内置样式类：`.apple-button-blue`, `.apple-select`.

### 3) 实施输入 (改进入口)

- **代码入口**: `frontend/src/components/common/ImportWizardModal.jsx`
- **减法目标 (3-5 条):**
  1. **视觉噪音减法**: 简化 Step 1 的说明文字，将非核心说明放入 Tooltip 或收纳。
  2. **层级扁平化**: 优化 Step 4 的错误过滤卡片，减少嵌套阴影。
  3. **移动端高度优化**: 针对小屏幕，将 Steps 导航改为顶部紧凑进度条，腾出空间展示映射表格。
  4. **文案一致性**: 统一所有按钮文案（如“下一步” vs “继续”）及位置。
  5. **错误呈现优化**: 将分散的错误 Tag 聚合为“可操作的错误面板”，通过筛选器快速定位问题。

## 2. 推广推广计划 (模块接入)

- [x] **宿舍信息导入**: 已初步实现配置化。
- [ ] **学生信息导入**: 规划中（待补充 `fields` 配置）。
- [ ] **入住信息导入**: 规划中（待补充 `fields` 配置）。

---

**更新时间**: 2026-01-15 11:30

## 1. 任务背景

为了使导入向导（ImportWizardModal）能够推广到学生导入、入住导入等其他模块，需要消除现有的业务硬编码，并解决识别出的 P1 级稳定性风险（行号错位、缺失字段 panic、表头脏数据等）。

### A. 通用化重构 (Generalization)

- **配置驱动架构**：
  - 更新 `frontend/src/constants/importConfigs.js`，将所有模块特定内容（标题、注意事项、示例数据、编码字段列表、API 地址、唯一键提示）转化为配置项。
  - 移除了 `ImportWizardModal.jsx` 中关于“宿舍”的所有硬编码文案。
- **预处理器解码**：
  - `importPreprocessor.js` 现在接收外部传入的 `codeFields` 列表，不再硬编码内部字段名。
- **动态模板支持**：
  - 下载模板时的示例数据和列顺序完全由 `config.fields` 定义，确保模板与解析逻辑强一致。

### B. P1 风险收敛 (Robustness)

- **B4 行号一致性修复**：
  - 在 `XLSX.utils.sheet_to_json` 中保留 `blankrows: true`。
  - 修复了因为过滤空行导致 `rowNo` 与 Excel 物理行号不符的问题，确保错误行导出时的行号精准。
- **B5 表头边界防御**：
  - **空表头阻断**：识别到第一行无表头时在 Step 2 强制阻断。
  - **重复表头阻断**：当 Excel 出现同名表头时（如两个“校区”列），立即提示并阻断映射。
  - **不可见字符清洗**：自动剔除表头中的 `\u200B`（零宽空格）等不可见字符，防止映射匹配失败。
- **B6 后端执行防御**：
  - 在 `BatchImportDormsV2` 中增加了必填字段的 `nil` 指针兜底校验。
  - 若前端绕过校验发送缺失核心字段的数据，后端不再返回 500 Panic，而是捕获为 `failedRows` 并返回 HTTP 200。

### C. 统计一致性修复 (Consistency)

- 修改了 `passCount` 的计算方式，使用 `Set(rowNo)` 去重统计，解决了单行包含多个错误时统计数据偏高的问题。

## 3. 回归测试结果 (Verified)

- [x] **UI 呈现**：注意事项列表渲染正确，文案无硬编码痕迹。
- [x] **后端稳定性**：构造非法 Payload 请求 Execute API，后端返回结构化错误码 `MISSING_REQUIRED_FIELD`，无 Panic。
- [x] **表头容错**：输入含空格和零宽空格的表头，识别成功。
- [x] **重复检测**：输入重复列名，UI 正确弹出拦截提示。

## 4. 后续操作规范

新增导入模块时，仅需在 `importConfigs.js` 中新增配置对象，并在页面调用 `ImportWizardModal` 时通过 `config` prop 传入即可，无需修改任何组件底层逻辑。

---

## 5. 桌面端 UI 优化（减法式改造）

**更新时间**: 2026-01-15 13:20

### 改造目标

针对桌面端导入向导 Modal 进行"减法"式 UI 优化，解决以下问题：

1. **Footer 主操作混乱**：Step 5 同时有"下一步"和"开始导入"，Step 6 同时有多个 primary 按钮
2. **Step 4 下载按钮位置不当**："下载错误行"放在 Footer，与主操作混杂
3. **左侧 Steps 栏噪音过大**：占用过宽(w-64)，有冗余装饰(英文 IMPORT PROGRESS)
4. **Tailwind 动态 class 构建风险**：`bg-${color}-50/50` 等动态拼接在构建时可能丢失

### 实施内容

#### A. Footer 主操作收敛

- 新增 `getPrimaryAction()` useMemo 函数，集中计算各步骤的主按钮 (text/onClick/disabled/loading)
- **任何步骤 Footer 右侧只渲染 1 个主按钮**：
  - Step 1/2/3：主按钮为"下一步"
  - Step 4（预检）：主按钮为"继续导入（n 行）"
  - Step 5（策略）：主按钮为"开始导入"
  - Step 6（完成）：主按钮为"完成退出"
- 彻底移除了 Step 4/5 时额外渲染的第二个 primary 按钮
- Step 6 不再显示"上一步"和"取消"，仅保留"继续导入"次要按钮

#### B. Step 4 下载按钮移位

- 从 Footer 移除 `current===3 && hasErrorRows` 的下载按钮
- 将其移动到 Step 4 "问题明细清单"卡片 header 右侧，与过滤 Select 同行
- 样式改为小号次按钮 (`size="small" rounded-full`)，视觉上不抢主操作

#### C. Steps 左侧降噪

- 宽度从 `w-64` 缩到 `w-56`
- **移除**英文"IMPORT PROGRESS"标题
- Steps 描述文字降级：`text-gray-400` → `text-gray-300`，`text-[11px]` → `text-[10px]`
- 底部版权信息简化，移除"基于 Apple HIG 设计规范"

#### D. 修复 Tailwind 动态 class

- 新增显式映射常量 `STAT_CLASS_MAP`，覆盖 blue/green/red/orange 四色
- 统计卡渲染改用 `cls.bg`/`cls.border`/`cls.text`，确保构建后样式稳定

### 验收确认

- [x] 桌面端任一步 Footer 右侧仅有一个蓝色主按钮
- [x] Step 5 只有"开始导入"作为主操作，不再出现"下一步"
- [x] Step 4 下载错误行按钮出现在问题明细 header 右侧
- [x] Step 4 统计卡样式不依赖 Tailwind 动态类
- [x] 左侧 Steps 视觉存在感降低但可读性仍足够
