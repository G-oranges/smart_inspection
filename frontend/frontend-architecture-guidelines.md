# 前端架构规范 (Frontend Architecture Guidelines)

> 版本: 1.0.0 | 更新日期: 2026-02-01

## 一、目录结构与职责边界

```
src/
├── pages/           # 页面组件（路由级别）
├── components/      # 可复用组件
│   └── common/      # 通用 UI 组件（无业务依赖）
├── hooks/           # 自定义 Hooks
├── utils/           # 纯函数工具
├── services/        # API 服务层
├── context/         # React Context
├── constants/       # 常量定义
├── layouts/         # 布局组件
├── theme/           # 主题配置
└── assets/          # 静态资源
```

### 1.1 Pages（页面组件）

**职责**：

- 路由入口，负责组合 hooks、子组件、业务逻辑
- 调用 hooks 获取状态和数据
- 渲染页面布局和子组件

**约束**：

- ⚠️ 单文件最大 2000 行（过渡期），目标 ≤ 1000 行
- ⚠️ 单函数最大 300 行
- 禁止在 pages 中定义可复用的 UI 组件
- 禁止直接调用 fetch/axios，必须通过 services

### 1.2 Hooks（自定义 Hooks）

**职责**：

- 封装可复用的状态逻辑
- 封装副作用（数据获取、订阅、定时器等）

**核心 Hooks**：
| Hook | 职责 |
|------|------|
| `useTableState` | 表格状态管理 + URL 同步 |
| `useTableFetch` | 表格数据加载（依赖驱动） |
| `useBulkSelection` | 批量选择（跨页选择） |
| `useMobile` | 移动端检测 |
| `useAppContext` | 全局上下文访问 |

**约束**：

- ⚠️ 单文件最大 500 行
- ⚠️ 单函数最大 150 行
- deps 只允许标量，禁止对象直接放 deps
- 回调函数使用 useRef 固化

### 1.3 Utils（纯函数工具）

**职责**：

- 纯函数：输入确定 → 输出确定
- 无副作用、无状态

**核心工具**：
| 工具 | 职责 |
|------|------|
| `tableParamsBuilder.js` | 创建表格参数构建函数 |
| `permissions.js` | 权限计算工具 |

**约束**：

- 禁止 import React
- 禁止访问 DOM、window、localStorage（除非明确标注）
- 100% 可测试

### 1.4 Components（组件）

**common/** - 通用 UI 组件：

- 无业务逻辑依赖
- Props 驱动，高度可配置
- 例如：`IOSActionSheet`、`AppleStatCard`、`FilterDropdownPanel`

**业务组件**：

- 与特定业务相关但可跨页面复用
- 例如：`StudentFormModal`、`DormGridSelector`

**约束**：

- 禁止直接调用 context（通过 props 传入）
- 禁止调用 services

### 1.5 Services（API 服务）

**职责**：

- 封装后端 API 调用
- 处理请求/响应转换
- 统一错误处理

**约束**：

- 只在 context/actions 或 hooks 中调用
- 禁止在 components 中直接调用

### 1.6 Constants（常量）

**职责**：

- 业务常量（状态枚举、配置项）
- 导入配置

**约束**：

- 只放纯数据，禁止函数
- 命名全大写 + 下划线

---

## 二、表格统一体系

### 2.1 三件套 Hooks

```jsx
// 1. 批量选择
const bulk = useBulkSelection();

// 2. 表格状态（含 URL 同步）
const table = useTableState({
  filterKeys: PAGE_FILTER_KEYS,
  defaultSortField: 'id',
  syncUrl: true,
  onApply: bulk.clearSelection,
  onReset: bulk.clearSelection,
});

// 3. 数据加载
const { data, loading, error } = useTableFetch({
  fetchFn: actions.fetchPageTable,
  buildParams: () => buildPageTableParams(...),
  deps: [table.pagination.current, ..., table.appliedFiltersKey],
  keepPreviousData: true,
});
```

### 2.2 参数构建器

```jsx
// 在组件外层定义
const PAGE_FILTER_KEYS = ["field1", "field2"];
const buildPageTableParams = createBuildTableParams({
  filterKeys: PAGE_FILTER_KEYS,
  normalizers: {
    /* 可选 */
  },
});
```

### 2.3 Hard Constraints

| 规则               | 说明                                  |
| ------------------ | ------------------------------------- |
| draft 改动不请求   | 只有 apply/reset 才触发 fetch         |
| draft 改动不写 URL | 只有 apply/reset 才写 URL             |
| deps 只允许标量    | 禁止 `appliedFilters` 对象直接放 deps |
| StrictMode ≤ 2 次  | 首屏最多 2 次请求                     |
| 操作 1 次请求      | 搜索/翻页/排序/重置 每次 1 次         |
| URL 可恢复         | back/forward 状态一致                 |

---

## 三、复用准入清单

### 3.1 新增 Hook 准入

| 检查项     | 要求               |
| ---------- | ------------------ |
| 命名       | use + PascalCase   |
| 职责单一   | 只做一件事         |
| 无业务耦合 | 不 import 具体页面 |
| 行数       | ≤ 500 行           |
| 测试       | 有对应测试用例     |

### 3.2 新增 Utils 准入

| 检查项        | 要求                     |
| ------------- | ------------------------ |
| 纯函数        | 无副作用                 |
| 无 React 依赖 | 不 import React          |
| 行数          | ≤ 200 行                 |
| 导出          | 单一职责，不导出巨型对象 |

### 3.3 新增 Component 准入

| 检查项         | 要求                          |
| -------------- | ----------------------------- |
| Props 驱动     | 不直接读 context              |
| 不调用 service | API 通过 props/callback 传入  |
| 样式隔离       | 使用 className 或 CSS Modules |
| 可测试         | 可独立 mount                  |

---

## 四、代码风格约定

### 4.1 Imports 顺序

```jsx
// 1. React 及核心库
import { useState, useEffect } from "react";

// 2. 第三方库
import { Button, Modal } from "antd";

// 3. 项目内 hooks
import { useTableState } from "../hooks/useTableState.js";

// 4. 项目内 utils/constants
import { createBuildTableParams } from "../utils/tableParamsBuilder.js";

// 5. 项目内 components
import PageLayout from "../components/PageLayout";

// 6. 项目内 services
import { studentService } from "../services/studentService";
```

### 4.2 命名约定

| 类型         | 规则              | 示例                     |
| ------------ | ----------------- | ------------------------ |
| 页面组件     | PascalCase + Page | `StudentManagementPage`  |
| Hook         | use + PascalCase  | `useTableState`          |
| Utils 函数   | camelCase         | `createBuildTableParams` |
| 常量         | UPPER_SNAKE_CASE  | `FILTER_KEYS`            |
| 筛选字段数组 | PAGE_FILTER_KEYS  | `STUDENT_FILTER_KEYS`    |

---

## 五、迁移检查清单

新迁移/新建页面必须完成：

- [ ] 使用 `useTableState` 管理表格状态
- [ ] 使用 `useTableFetch` 加载数据
- [ ] 使用 `useBulkSelection` 管理选择（如需要）
- [ ] 筛选字段 `FILTER_KEYS` 定义在组件外层
- [ ] 参数构建器 `buildXxxTableParams` 定义在组件外层
- [ ] deps 只使用标量（appliedFiltersKey 等）
- [ ] npm run build 通过
- [ ] Network 验收通过（参考 Checklist）
- [ ] 文件行数 ≤ 2000（目标 ≤ 1000）

---

## 六、版本历史

| 版本  | 日期       | 说明                      |
| ----- | ---------- | ------------------------- |
| 1.0.0 | 2026-02-01 | 初版，基于 P0-P1 迁移经验 |
