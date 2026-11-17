# 修复：表格配置接口无限循环请求

## 问题描述

停留在学生管理界面时，后端 `/api/table-config?tableKey=studentList` 接口每秒被请求十余次，形成无限循环。

## 根因分析

`useTableColumns` hook（位于 `frontend/src/hooks/useTableColumns.ts`）的 `useEffect` 依赖数组包含 `fetchConfig`：

```ts
useEffect(() => {
  // ... 调用 fetchConfig 加载列配置
}, [fetchConfig, tableKey]);
```

而调用方（StudentManagementPage 等）传入的 `fetchConfig` 是**内联匿名函数**，每次渲染创建新引用：

```tsx
fetchConfig: studentPageActions.fetchTableConfig
  ? async (tableKey) => { ... }  // ← 每次渲染都是新函数
  : undefined,
```

**循环路径**：
1. 组件渲染 → 创建新的 `fetchConfig` 函数引用
2. `useEffect` 检测到 `fetchConfig` 变化 → 触发请求
3. 请求完成 → `setColumns` 更新状态
4. 状态更新 → 组件重新渲染 → 回到步骤 1

## 修复方案

使用 `useRef` 稳定化 `fetchConfig` 和 `saveConfig` 引用（与已有的 `defaultColumnsRef` 策略一致）：

```ts
const fetchConfigRef = useRef(fetchConfig);
fetchConfigRef.current = fetchConfig;
const saveConfigRef = useRef(saveConfig);
saveConfigRef.current = saveConfig;

useEffect(() => {
  const currentFetchConfig = fetchConfigRef.current;
  // ... 使用 currentFetchConfig
}, [tableKey]); // ← 仅依赖 tableKey
```

## 影响范围

此修复一次性解决了所有管理页面的同类问题：
- StudentManagementPage
- TeacherManagementPage  
- DormManagementPage
- AccountPermissionPage

BuildingManagementPage 未传入 `fetchConfig`，不受影响。

## 修改文件

- `frontend/src/hooks/useTableColumns.ts`
