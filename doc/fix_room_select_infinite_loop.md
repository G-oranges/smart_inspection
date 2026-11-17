# 修复：查寝流程房间选择页无限请求死循环

## 问题描述

在查寝流程中，点击楼层后进入房间选择页面（`/tasks/entry/buildings/:building/floors/:floor/rooms`），
页面无法正常显示房间号卡片，始终停留在骨架屏加载状态。

## 根因分析

### 后端状态 ✅

后端完全正常：
- API `GET /api/tasks/:id/dorms/my` 返回 HTTP 200
- SQL 查询正确返回 36 条宿舍记录
- 数据结构完整包含 roomNo 等字段

### 前端 Bug 🐛 — `useEffect` / `useCallback` 依赖链导致无限循环

**受影响文件**：
- `frontend/src/pages/RoomSelectPage.tsx`
- `frontend/src/pages/FloorSelectPage.tsx`
- `frontend/src/pages/BuildingSelectPage.tsx`

**死循环触发链路**：

```
1. actions 对象依赖 rawActions (AppContext.actions)
2. rawActions 内部的 fetchInspections 回调依赖 loaded.inspections 状态
3. loadRooms useCallback 依赖 actions → loadRooms 在 actions 变化时重建
4. useEffect 依赖 loadRooms → loadRooms 重建时重新触发
5. loadRooms 执行 → setLoading(true) → 组件重渲染
6. loadInspections useEffect 也依赖 actions.loadInspections
7. loadInspections 执行 → 更新全局 inspections 状态
8. AppContext 重新计算 → rawActions 重建 → actions 重建
9. 回到步骤 3，死循环
```

**具体表现**：
- API 请求无限重复发送（日志中同一请求出现 4+ 次）
- 页面始终显示骨架屏（loading 状态不断被设为 true）
- 浏览器性能急剧下降

## 修复方案

使用 `useRef` 存储最新的 `actions` 引用，在 `useCallback` 和 `useEffect` 内部
通过 ref 访问 actions，避免将不稳定的 actions 对象放入依赖数组。

### 核心变更

```tsx
// ❌ 修复前 — actions 在依赖数组中，导致死循环
const loadRooms = useCallback(async () => {
  const result = await actions.fetchAssignedDorms(taskId, params);
  ...
}, [actions, taskId, ...]);

// ✅ 修复后 — 通过 ref 访问最新 actions，依赖稳定
const actionsRef = useRef(actions);
actionsRef.current = actions;

const loadRooms = useCallback(async () => {
  const currentActions = actionsRef.current;
  const result = await currentActions.fetchAssignedDorms(taskId, params);
  ...
}, [taskId, ...]); // 不再依赖 actions
```

### 修改的文件

| 文件 | 变更 |
|------|------|
| `RoomSelectPage.tsx` | `loadRooms` 和 `loadInspections` 的 useEffect 移除 actions 依赖 |
| `FloorSelectPage.tsx` | `loadFloors` 的 useCallback 移除 actions 依赖 |
| `BuildingSelectPage.tsx` | `loadTasks` 和 `loadAssignedDorms` 移除 actions 依赖 |
| `ResultEntryPage.tsx` | 用 `useMemo` 包裹 `createResultEntryActions` |
| `result-entry/useResultEntryActions.ts` | 6 个 useEffect 全部移除 actions 依赖，改用 actionsRef |

## 验证结果

修复后页面正常显示：
- 36 间房间卡片正确渲染
- 搜索过滤功能正常
- 待检查/已完成标签切换正常
- API 请求仅发送必要次数，无重复

## 日期

2026-04-09
