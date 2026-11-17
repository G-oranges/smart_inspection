# 修复：楼栋管理页面无限刷新问题

## 日期

2026-03-10

## 问题描述

打开楼栋管理页面后，列表一直在刷新（loading spinner 不停旋转），偶尔闪烁出数据但随即消失，无法正常显示具体数据。

## 根本原因

在 TypeScript 迁移过程中引入的 **React Hook 依赖循环（Dependency Loop）**。

### 触发链条

1. **组件渲染** → `BuildingManagementPage` 内的 `fetchFn` 是一个**内联匿名函数**：

   ```typescript
   // 迁移后的代码（有bug）
   fetchFn: (params, options) =>
     getBuildings(params as BuildingQueryParams, options);
   ```

   每次渲染都会创建一个新的函数引用。

2. **`useTableFetch` 中 `doFetch` 依赖 `fetchFn`**：

   ```typescript
   const doFetch = useCallback(
     async (signal) => {
       // ...使用 fetchFn...
     },
     [fetchFn, keepPreviousData],
   ); // ← fetchFn 变了，doFetch 就重建
   ```

3. **`useEffect` 依赖 `doFetch`**：

   ```typescript
   useEffect(() => {
     void doFetch(controller.signal);
   }, [depsKey, doFetch, enabled]); // ← doFetch 变了，effect 就重新执行
   ```

4. **`doFetch` 执行时 `setLoading(true)`** → 触发组件重新渲染 → 回到步骤 1 → **死循环！**

### 对比旧版本

| 版本      | `fetchFn` 写法                                                                       | 是否稳定                        |
| --------- | ------------------------------------------------------------------------------------ | ------------------------------- |
| 旧版 JS   | `fetchFn: getBuildings`                                                              | ✅ 直接传模块级函数引用，稳定   |
| 迁移后 TS | `fetchFn: (params, options) => getBuildings(params as BuildingQueryParams, options)` | ❌ 内联函数，每次渲染创建新引用 |

## 修复方案

### 1. 根本修复：`useTableFetch.ts` 中使用 ref 存储 `fetchFn`

与 `buildParams`/`onSuccess`/`onError` 一样，将 `fetchFn` 也存入 ref，使 `doFetch` 的 `useCallback` 不再依赖 `fetchFn` 引用。

```diff
+ const fetchFnRef = useRef(fetchFn);
  const buildParamsRef = useRef(buildParams);

+ fetchFnRef.current = fetchFn;
  buildParamsRef.current = buildParams;

  const doFetch = useCallback(async (signal) => {
-   const result = await fetchFn(params, { signal });
+   const result = await fetchFnRef.current(params, { signal });
  },
- [fetchFn, keepPreviousData],
+ [keepPreviousData],
  );
```

**影响范围**：所有使用 `useTableFetch` 的页面（Building/Teacher/Student/Dorm/Occupancy/Result）都自动受益。

### 2. 补充修复：`BuildingManagementPage.tsx` 直接传递函数引用

```diff
- fetchFn: (params, options) => getBuildings(params as BuildingQueryParams, options),
+ fetchFn: getBuildings as (...) => ...,
```

## 修改的文件

| 文件                                            | 修改内容                                                       |
| ----------------------------------------------- | -------------------------------------------------------------- |
| `frontend/src/hooks/useTableFetch.ts`           | 将 `fetchFn` 通过 ref 存储，移除 `doFetch` 对 `fetchFn` 的依赖 |
| `frontend/src/pages/BuildingManagementPage.tsx` | `fetchFn` 从内联函数改为直接传递 `getBuildings` 引用           |

## 验证结果

- ✅ 楼栋管理页面正常加载 37 条数据
- ✅ 无无限循环请求
- ✅ 分页、搜索、筛选功能正常
