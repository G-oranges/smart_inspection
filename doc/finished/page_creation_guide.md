# 新页面开发操作文档：管理后台通用模板

本可以帮助开发者快速创建与现有风格（如学生管理、宿舍管理）一致的新页面。

---

## 1. 后端接口需求 (Backend Requirements)

新页面通常需要支持标准的 CRUD 操作及导入导出。请确保后端 Controller（如 NodeJS/Express）提供以下标准接口：

### 1.1 基础 CRUD 接口

| 方法       | 路径                    | 描述                       | 参数示例                                                    |
| :--------- | :---------------------- | :------------------------- | :---------------------------------------------------------- |
| **GET**    | `/api/[resource]`       | 获取列表（全量或简单查询） | `?param1=value&param2=value`                                |
| **GET**    | `/api/[resource]/table` | **分页获取列表**（核心）   | `?page=1&pageSize=10&sortField=id&sortOrder=asc&...filters` |
| **GET**    | `/api/[resource]/:id`   | 获取详情                   | URL Params                                                  |
| **POST**   | `/api/[resource]`       | 创建新记录                 | Body: JSON 对象                                             |
| **PUT**    | `/api/[resource]/:id`   | 更新记录                   | Body: JSON 对象                                             |
| **DELETE** | `/api/[resource]`       | 删除记录（支持批量）       | Body: `{ ids: ["id1", "id2"] }`                             |

### 1.2 高级功能接口

| 方法     | 路径                           | 描述               | 参数示例                                                                                         |
| :------- | :----------------------------- | :----------------- | :----------------------------------------------------------------------------------------------- |
| **POST** | `/api/[resource]/batch-delete` | 按筛选条件批量删除 | Body: `{ filter: { ...queryParams } }`                                                           |
| **POST** | `/api/[resource]/import`       | Excel 导入         | Form-Data: [file](file:///d:/my_project_bychatgpt/frontend/src/services/studentService.js#45-48) |
| **GET**  | `/api/[resource]/export`       | Excel 导出         | Query Params (同 table 接口)                                                                     |

### 1.3 数据库模型 (Prisma 示例)

在 [schema.prisma](file:///d:/my_project_bychatgpt/backend/prisma/schema.prisma) 中定义模型时，建议包含标准字段：

```prisma
model ResourceName {
  id          String   @id @default(uuid()) @db.Char(36)
  // ... 业务字段
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  // ... 关联字段
}
```

---

## 2. 前端页面逻辑与布局 (Frontend Logic & Layout)

### 2.1 文件结构推荐

```
frontend/src/
  ├── pages/
  │   └── NewResourcePage.jsx      // 主页面组件
  ├── hooks/
  │   └── useNewResources.js       // 数据获取与状态管理 Hook
  ├── services/
  │   └── newResourceService.js    // API 请求封装
```

### 2.2 核心布局组件

页面应使用通用布局组件以保持一致性：

- **PageLayout**: 页面整体容器，负责标题、副标题、面包屑等头部信息。
- **ResponsiveDataView**: **关键组件**，自动处理 PC 端表格与移动端卡片视图的切换。

**代码模板结构 (NewResourcePage.jsx):**

```jsx
import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
// ... Ant Design 组件导入
import PageLayout from "../components/PageLayout";
import ResponsiveDataView from "../components/ResponsiveDataView";
import { useNewResources } from "../hooks/useNewResources"; // 自定义 Hook

export default function NewResourcePage() {
  // 1. URL 状态同步 (分页、筛选、排序)
  const [searchParams, setSearchParams] = useSearchParams();

  // 2. 本地状态管理
  const [filters, setFilters] = useState({ ... }); // 筛选状态
  const [modalOpen, setModalOpen] = useState(false); // 弹窗状态
  const [selectedIds, setSelectedIds] = useState([]); // 多选状态

  // 3. 数据 Hook 调用
  const {
    data,
    loading,
    fetchTable,
    createItem,
    updateItem,
    deleteItem
  } = useNewResources();

  // 4. 表格列定义 (Ant Design Columns)
  const columns = [ ... ];

  // 5. 渲染逻辑
  return (
    <div className="new-resource-page">
      <PageLayout
        title="页面标题"
        subtitle="页面描述..."
        extraHeroContent={...} // 顶部额外内容
      >
        {/* 顶部工具栏：筛选器 + 操作按钮 */}
        <div className="toolbar">...</div>

        {/* 核心数据视图 */}
        <ResponsiveDataView
          dataSource={data}
          columns={columns}
          loading={loading}
          // ... 分页配置
          // ... 移动端适配渲染
        />

        {/* 编辑/新增弹窗 */}
        <Modal ... />
      </PageLayout>
    </div>
  );
}
```

---

## 3. 风格与样式 (Styles & Aesthetics)

### 3.1 玻璃拟态 (Glassmorphism)

现有系统采用高质感的玻璃拟态风格，请复用以下 CSS 类或样式对象：

- **JS 样式对象 (常用作 Modal 或 Card 样式):**
  ```javascript
  const glassCardStyle = {
    background: "rgba(255, 255, 255, 0.7)",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    border: "1px solid rgba(255, 255, 255, 0.3)",
    borderRadius: 16,
    boxShadow: "0 8px 32px rgba(15, 76, 129, 0.1)",
  };
  ```
- **全局 CSS 类**:
  - `.glass-table`: 用于 Ant Design Table 组件，使其背景透明并应用模糊效果。
  - `.glass-card`: 用于普通容器。

### 3.2 移动端卡片风格

在移动端，表格行转为卡片。使用以下类名保持一致性：

- `.mobile-compact-card`: 卡片容器。
- `.compact-card-header`: 卡片头部（标题、状态标签）。
- `.compact-card-grid`: 卡片内容网格布局。
- `.compact-info-item` / `.compact-label` / `.compact-value`: 信息项样式。
- `.bottom-selection-bar`: **底部固定操作栏**，用于移动端批量操作。
- `.mobile-compact-card.selected`: 选中状态样式。

---

## 4. 操作交互 (Interactions)

### 4.1 URL 状态同步

**必须实现**：所有筛选条件、分页页码、排序字段必须同步到 URL Query Parameters。

- **优势**：刷新页面不丢失状态，便于分享特定视图。
- **实现**：使用 `useEffect` 监听状态变化并更新 `searchParams`，反之初始化时从 `searchParams` 读取状态。

### 4.2 反馈与确认

- **删除操作**：必须使用 `<Popconfirm>` 进行二次确认。
- **成功/失败提示**：使用全局 `message` 或局部 `Alert` 组件。
- **加载状态**：所有异步操作（搜索、提交、删除）必须展示 `loading` 状态（Button loading 或 Table loading）。

### 4.3 批量操作

如果支持批量删除/修改，需实现：

- 跨页全选逻辑（可选，参考 [StudentManagementPage](file:///d:/my_project_bychatgpt/frontend/src/pages/StudentManagementPage.jsx#101-1633) 中的 `selectAcrossPages`）。
- 底部或顶部的批量操作栏。

---

## 5. 特殊适配 (Special Adaptations)

### 5.1 移动端适配

现有模板通过 `hooks/useMobile.js` 和 `ResponsiveDataView` 组件实现了高度自动化的移动端适配。

- **PC 端**：显示标准 Table。
- **移动端**：自动切换为无限滚动的列表或卡片视图。
  - 需提供 `renderCard` 属性给 `ResponsiveDataView`，定义每条数据在移动端的渲染方式。
  - `renderCard` 需处理 `selected` 状态和 `onSelect` 回调以支持多选。
  - 筛选栏应在移动端折叠（使用 `Drawer` 组件，配合带徽标的筛选按钮）。
- **操作交互**：
  - **悬浮按钮 (FAB)**：使用 `FloatButton` 作为移动端的主要“新增”入口；使用 `FloatButton.BackTop` 提供返回顶部功能。
  - **底部固定栏**：当有选中项时，显示 `.bottom-selection-bar` 提供批量操作（如删除），同时隐藏 FAB。
  - **筛选布局**：移动端推荐布局为 `[搜索框 (flex:1)] [筛选按钮 (Badge)] [重置]`。

### 5.2 权限控制

前端需集成权限检查：

```javascript
const { hasPermission } = useAppContext();
const canEdit = hasPermission("RESOURCE_EDIT");

// 在渲染时控制按钮显隐
{
  canEdit && <Button>编辑</Button>;
}
```

---

## 6. 代码复用 (Reusable Code)

在创建新页面时，可直接复用以下组件/Hook，无需重写：

1.  **`src/components/PageLayout.jsx`**: 统一的页面头部和背景布局。
2.  **`src/components/ResponsiveDataView.jsx`**: 处理 Table/List 切换的核心组件。
3.  **`src/hooks/useMobile.js`**: 检测是否为移动端设备。
4.  **`src/hooks/useTableColumns.js`**: (可选) 如果需要支持用户自定义列显示/排序。
5.  **[src/context/AppContext.jsx](file:///d:/my_project_bychatgpt/frontend/src/context/AppContext.jsx)**: 获取当前用户、Token、全局权限方法。

### 快速开始步骤

1.  复制 [StudentManagementPage.jsx](file:///d:/my_project_bychatgpt/frontend/src/pages/StudentManagementPage.jsx) 作为起点。
2.  替换 `initialForm` 和 `columns` 定义。
3.  修改 `actions` 调用（指向新的 Service）。
4.  调整 `renderCard` 适配新的数据字段。
5.  在 [App.jsx](file:///d:/my_project_bychatgpt/frontend/src/App.jsx) 中注册路由。
