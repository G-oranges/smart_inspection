🍎 宿舍管理界面 (DormManagementPage) Apple HIG 审计报告
📊 总体评估
当前界面已具备较好的 Apple 风格基础（毛玻璃效果、圆角卡片、系统色值），但仍有多个方面可以进一步向 iOS / macOS 原生标准看齐。以下是按优先级排列的优化方案：

🎯 一、交互逻辑与用户体验
1.1 📱 移动端：批量选择操作的"渐进式披露"不够清晰
现状问题：

底部操作栏 (.bottom-selection-bar) 在选中项目时突然弹出，缺少清晰的操作优先级引导
按钮组使用 Tooltip 提示禁用原因，但移动端无 hover，导致用户无法理解为何按钮不可用
Apple HIG 原则： Progressive Disclosure - 仅在需要时展示复杂选项

优化方案：

1. 将底部操作栏改为 iOS Action Sheet 风格：
   - 初始状态：仅显示"选中 N 项" + "操作"按钮（触发 Action）
   - 点击"操作"后：弹出底部 Action Sheet，列出所有可用操作
2. 禁用按钮直接隐藏，而非灰度呈现（减少认知负担）
3. 添加 haptic 反馈模拟：
   - 选中卡片时添加 `active:scale-[0.98]` 按压动画
   - 批量操作成功后使用 `Modal.success` 替代静默更新
     1.2 🖥️ 桌面端：表格操作列按钮视觉层级混乱
     现状问题：

操作列中"详情" / "编辑" / "删除"均为 type="link" 文字按钮
在深色模式下对比度不足，且缺少图标焦点
Apple HIG 原则： macOS 表格的行内操作应通过 hover 显现，而非始终可见

优化方案：

jsx
// 建议改为悬停显示操作按钮组
const ActionCell = ({ record, visible }) => (

  <div className={`
    flex gap-1 transition-opacity
    ${visible ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}
  `}>
    <Button icon={<EyeOutlined />} type="text" size="small" />
    <Button icon={<EditOutlined />} type="text" size="small" />
    <Popconfirm ...>
      <Button icon={<DeleteOutlined />} type="text" danger size="small" />
    </Popconfirm>
  </div>
);
🎨 二、视觉设计精细度
2.1 📈 统计卡片 (AppleStatCard) 的信息密度与层级优化
现状问题：

dotColor 小圆点仅用于装饰，未传达实际状态语义
分子/分母形式 (value/subValue) 在移动端阅读困难
Apple HIG 原则： 数据驾驶舱应聚焦"下一个动作"，而非堆砌数字

优化方案：

当前呈现 优化后呈现
127/240 人 (入住率) 127 人 已入住 + 底部细线进度条 (53%) + 右上角趋势箭头
50/30 间 (男/女分布) 改为圆环图 (Donut Chart) 或直接 50 间 男生 vs 30 间 女生 分行显示
jsx
// 建议增加 Trend 指示器
<AppleStatCard
value={dormStats.occupiedSum}
label="已入住"
unit="人"
trend={+3.2} // 较上周
progressPercent={53}
/>
2.2 🏠 移动端卡片 (mobile-compact-card) 的视觉精致度
现状问题：

卡片网格使用 grid-template-columns: repeat(2, 1fr) 强制 2 列，在横屏或 iPad 上存在大量空白
Tag 颜色 (blue / magenta) 过于鲜艳，与 iOS 淡雅风格冲突
优化方案：

css
/_ 动态列宽适配 _/
.compact-card-grid {
grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
}
/_ Tag 降饱和度 _/
.gender-tag-male { background: #E8F4FF; color: #177DDC; }
.gender-tag-female { background: #FFF0F6; color: #C41D7F; }
2.3 🔍 搜索栏与筛选控件的一致性
现状问题：

搜索框 .apple-search-input 使用 !rounded-2xl，但下拉筛选 Select 的 ant-select-selector 使用 rounded-xl
两者高度不一致：搜索框 h-11，部分 Select 默认高度
Apple HIG 原则： 工具栏元素应视觉高度统一（iOS 标准 44pt）

优化方案：

css
.apple-filter-control {
@apply h-11 rounded-2xl;
}
📐 三、布局与响应式
3.1 💻 桌面端：缺少"宽屏信息密度"优化
现状问题：

2560px 宽屏下，页面 max-width 未限制，表格行拉伸过宽，眼轨距离过长
左侧边栏与内容区域无视觉分隔
Apple HIG 原则： macOS Finder 在超宽屏幕上使用"分栏布局"而非单列拉伸

优化方案：

jsx
// PageLayout.jsx 添加分栏容器

<div className="max-w-[1600px] mx-auto xl:grid xl:grid-cols-[280px,1fr] xl:gap-8">
  {/* 左侧：筛选面板固定 */}
  <aside className="hidden xl:block sticky top-4 h-fit">{filters}</aside>
  
  {/* 右侧：表格内容 */}
  <main>{children}</main>
</div>
3.2 📲 移动端：筛选抽屉 (Filter Drawer) 的操作路径
现状问题：

底部固定按钮区 (absolute bottom-0) 遮挡筛选项，当筛选器过多时无法滚动到底
"取消" 与 "确认结果" 语义接近，增加决策成本
优化方案：

jsx
// 改为 iOS 标准 Picker 交互
<Drawer placement="bottom" height="auto" className="ios-picker-drawer">
{/_ 内容区使用 safe-area padding _/}

  <div className="pb-[calc(env(safe-area-inset-bottom)+80px)]">
    {filterContent}
  </div>
  
  {/* 固定底部使用 iOS 风格双色按钮 */}
  <div className="ios-picker-footer">
    <Button className="text-ios-red">重置</Button>
    <Button className="text-ios-blue font-semibold">应用</Button>
  </div>
</Drawer>
⚡ 四、微交互与反馈
4.1 🔄 加载状态过渡
现状问题：

数据加载时使用 AntD 默认 Spinner，与整体风格割裂
表格切换筛选条件时无骨架屏，出现闪烁
优化方案：

jsx
// 添加 iOS 风格加载骨架
{loading ? (

  <div className="animate-pulse space-y-4">
    {[...Array(5)].map((_, i) => (
      <div key={i} className="h-16 bg-ios-gray rounded-2xl" />
    ))}
  </div>
) : (
  <GlassTable {...} />
)}
4.2 ✨ 批量操作成功的庆祝反馈
现状问题：

批量入住/退宿成功仅弹出 Modal.success，缺少情感化设计
Apple HIG 原则： Delight 用户，提供适度的"成就感"反馈

优化方案：

jsx
// 成功后添加 Confetti 动效（轻量级）
import confetti from 'canvas-confetti';
const onBatchSuccess = () => {
confetti({ particleCount: 60, spread: 50, origin: { y: 0.6 } });
message.success({ content: '操作成功', icon: <span>🎉</span> });
};
🛠️ 五、技术债与代码健康
5.1 📝 Modal 组件属性废弃警告
现存警告：

[antd: Modal] destroyOnClose is deprecated. Please use destroyOnHidden instead.
修复： 所有 <Modal destroyOnClose> 替换为 <Modal destroyOnHidden>

5.2 🧹 CSS 类命名一致性
现存问题：

.active-press 在
index.css
中重复定义（第 1244 行、第 1512 行）
.apple-input 同样存在重复声明
建议： 合并重复样式，使用 Tailwind @layer 规范管理

5.3 📦 表单逻辑代码重复
现存问题：

"新增宿舍" Modal/Drawer 的表单代码几乎完全复制（第 1092-1146 行 vs 第 1170-1225 行）
建议： 抽取 DormForm.jsx 通用组件

📋 优化优先级排序
优先级 类别 项目 预期工时 用户价值
P0 交互 移动端底部操作栏 Action Sheet 化 2h ⭐⭐⭐⭐⭐
P0 视觉 搜索栏/筛选控件高度统一 0.5h ⭐⭐⭐⭐
P1 布局 宽屏分栏布局 3h ⭐⭐⭐⭐
P1 视觉 统计卡片进度条增强 2h ⭐⭐⭐⭐
P2 交互 表格悬停显示操作按钮 1.5h ⭐⭐⭐
P2 微交互 加载骨架屏 1h ⭐⭐⭐
P3 技术债 Modal 废弃属性修复 0.5h ⭐⭐
P3 技术债 CSS 类去重 1h ⭐⭐
P3 代码 抽取 DormForm 通用组件 2h ⭐⭐
🖼️ 概念视觉参考
如果需要，我可以为以下场景生成设计稿预览图：

移动端底部 Action Sheet 交互示意图
宽屏分栏布局 桌面端预览图
增强型统计卡片 设计稿
以上是基于当前代码的完整优化方案。请告诉我：

哪些优化项目你希望我优先实施？
是否需要我生成某些方案的视觉预览？
有没有其他特定的交互场景你希望深入讨论？
