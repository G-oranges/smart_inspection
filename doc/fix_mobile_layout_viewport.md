# 移动端布局与安全区域修复 (最终策略)

## 问题回顾

此前尝试为移动端加入 `viewport-fit=cover` 并配合 `env(safe-area-inset-top)` 将顶部导航栏渲染为沉浸式。但是这种处理在普通手机端浏览器中表现为顶部出现异常的空白留白，效果并不符合简单的“状态栏下方操作栏”需求。

## 回归与修复内容

取消了沉浸式安全区域强占位，恢复了标准的 Web App 移动端排版形式，使得所有的顶部操作按钮（深浅切换、标题、头像）能够贴死在浏览器的物理可视区域最顶端。

### 具体修改

1. **移除 `viewport-fit=cover`**:
   在 `frontend/index.html` 中回退：

   ```html
   <meta
     name="viewport"
     content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"
   />
   ```

2. **去除 Header 的顶部安全边距**:
   `frontend/src/layouts/AppLayout.tsx` 中移动端的 `<header>` 不再使用强制的 `paddingTop: env(safe-area-inset-top)`，也不会套用双层 `div`，直接以 `fixed top-0` 定位在浏览器最顶部。

   ```tsx
   <header className="fixed top-0 left-0 right-0 z-50 co-header h-12 flex items-center px-4">
     ...
   </header>
   ```

3. **恢复主内容区的定距 Margin**:
   不再使用包含 `env` 的 calc 计算，重新将 `<main>` 区块的顶边距设置为标准的 Tailwind class `mt-12`（刚好对应上方 header 占据的 48px），确保内容与 header 不重叠。

### 总结

经过这一调整，平板端的 `100dvh` (包含滚动修复) 得以保留，同时手机端也不会因为安全区域计算产生任何顶部的“透明断层或留白”，操作栏已经回到了真正意义上的最顶部 (`top: 0`)。
