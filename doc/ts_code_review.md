# TypeScript 代码审查报告

> 审查时间：2026-03-10  
> 审查范围：`frontend/src/` 下全部 124 个 `.ts/.tsx` 文件  
> TypeScript 编译检查：✅ `tsc --noEmit` 零错误通过  
> **修复状态：✅ 所有可修复问题已全部修复并通过 `tsc --noEmit` 验证**

---

## 一、总体评价

**代码质量整体良好**。转 TS 后类型定义清晰，工程结构规范。以下是按严重程度分类的具体问题和优化建议。

---

## 二、🔴 性能缺陷（建议尽快修复）

### 2.1 `useMobile` 缺少防抖 — 高频重渲染

**文件**: `hooks/useMobile.ts`

```typescript
// ❌ 当前：每次 resize 事件都立即触发 setIsMobile
window.addEventListener("resize", checkMobile);
```

`resize` 事件在拖拽调整窗口大小时每秒可触发 60+ 次。每次调用 `setIsMobile` 都会触发整个组件树重渲染（因为 `useMobile` 在 `App.tsx`、`ThemeWrapper`、`ImportWizardModal`、各管理页面等多处调用）。

**修复建议**: 添加防抖或改用 `matchMedia` 事件监听：

```typescript
// ✅ 方案 A：使用 matchMedia（推荐，精确且高效）
useEffect(() => {
  const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
  const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
  setIsMobile(mql.matches);
  mql.addEventListener("change", handler);
  return () => mql.removeEventListener("change", handler);
}, [breakpoint]);
```

**影响**: 每个使用 `useMobile()` 的组件都受影响，当前至少 5+ 个关键组件直接调用。

---

### 2.2 `useTableFetch` 中 `JSON.stringify(deps)` 性能隐患

**文件**: `hooks/useTableFetch.ts:77`

```typescript
const depsKey = JSON.stringify(deps); // ❌ 每次渲染都执行 JSON.stringify
```

`deps` 是外部传入的数组，每次渲染都做 `JSON.stringify`。如果 deps 包含复杂对象（如 pagination 对象），每次渲染都会产生序列化开销。更关键的是 `JSON.stringify` 的结果作为 `useEffect` 依赖项，**对象引用变化但值不变时也会触发重新 fetch**。

当前代码中 `DormManagementPage` 等页面传入的 deps 包含 `pagination.current`、`sortField` 等**原始类型**，所以问题不大。但这是一个脆弱的设计模式。

**建议**: 保持当前行为但在类型层面约束 deps 只允许原始类型：

```typescript
deps?: readonly (string | number | boolean | null | undefined)[];
```

---

### 2.3 `useThemeCustomization` 中 `MutationObserver` + `useEffect` 双重执行

**文件**: `hooks/useThemeCustomization.ts:142-160`

```typescript
// 第一个 useEffect: MutationObserver 监听 data-theme 变化
useEffect(() => {
  const observer = new MutationObserver(() => {
    applyBackground(bgPreset, customBgUrl, isDark);
  });
  // ...
}, [bgPreset, customBgUrl, applyBackground]);

// 第二个 useEffect: 直接在状态变化时应用
useEffect(() => {
  applyBackground(bgPreset, customBgUrl, isDark);
}, [bgPreset, customBgUrl, applyBackground]);
```

当 `bgPreset` 或 `customBgUrl` 变化时，两个 effect 都会触发 `applyBackground`，导致**同一操作执行两次**。MutationObserver 用于监听**外部**主题切换，但它和第二个 effect 的依赖项重叠了。

**建议**: 分离关注点，MutationObserver 只响应主题变化（不依赖 bgPreset/customBgUrl），以避免双重执行。

---

### 2.4 `AppProvider` 中庞大的 `actions` 对象未做稳定化

**文件**: `App.tsx:223-380`

`actions` useMemo 有 **约 50 个依赖项**。任何一个 hook 返回值引用变化都会重建整个 actions 对象，由此联动 `contextValue` 引用变化，导致**所有消费 AppContext 的组件重渲染**。

这是当前架构的最大性能瓶颈—— 但由于 actions 本身只是函数引用，且各 hook 使用了 `useCallback`，实际触发的频率并不高。需要注意的是，如果任何一个 hook（如 `useDorms`、`useStudents`）的 callback 依赖项发生变化（例如 `dormsLoaded`/`studentsLoaded` 状态翻转），会导致全量重渲染。

**缓解方案**: 长期可以考虑拆分 Context 或使用 `useContextSelector` 等方案。短期内无需修改，但需知晓此风险。

---

### 2.5 `ImportWizardModal` 巨型组件（2700+ 行）

**文件**: `components/common/ImportWizardModal.tsx` — 2703 行

单文件 2700+ 行是非常高的复杂度。虽然不是传统意义上的"bug"，但会导致：

- 任何状态变化触发整个组件 re-render（内含 20+ 个 useState）
- 难以进行局部优化和代码维护

**建议**：将各步骤拆分为独立子组件，每步骤只接收自己需要的 props。

---

## 三、🟡 逻辑问题（有潜在 Bug 但不影响核心功能）

### 3.1 `useAuth` 中 `userRoles` 未做 useMemo，每次返回新数组

**文件**: `hooks/useAuth.ts:270`

```typescript
return {
  // ...
  userRoles: user?.roles || [], // ❌ 每次渲染创建新的空数组
};
```

当 `user` 为 null 或 `user.roles` 不存在时，每次渲染都创建一个新的 `[]` 引用。如果下游组件将 `userRoles` 作为 `useEffect` 或 `useMemo` 的依赖项，会导致不必要的重渲染或重计算。

**修复**:

```typescript
const EMPTY_ROLES: RoleLike[] = [];
// ...
userRoles: user?.roles || EMPTY_ROLES,
```

---

### 3.2 `useTableColumns` 中 `defaultColumns` 作为 useEffect 依赖项

**文件**: `hooks/useTableColumns.ts:68`

```typescript
useEffect(() => {
  // ... 加载配置
}, [fetchConfig, tableKey, defaultColumns]); // ❌ defaultColumns 如果每次传新引用会无限循环
```

如果调用方每次渲染都传入一个新的 `defaultColumns` 数组（例如内联定义 `[{...}, {...}]`），会导致 useEffect **无限循环加载**。

**当前状态**: 查看使用方代码，`DormManagementPage` 等都通过模块常量传入，所以目前安全。但这是一个容易被打破的隐含约定。

**建议**: 在 Hook 内对 `defaultColumns` 做 `useRef` 或要求调用方做 `useMemo`。

---

### 3.3 `useDorms` / `useStudents` 中 `dormsLoaded`/`studentsLoaded` 作为 `useCallback` 依赖

**文件**: `hooks/useDorms.ts:37`、`hooks/useStudents.ts:43`

```typescript
const fetchDorms = useCallback(
  async (force = false) => {
    // ...
    if (dormsLoaded && !force) return;
    // ...
  },
  [activeRole?.code, user?.role, dormsLoaded], // ❌ dormsLoaded 变化时重建 callback
);
```

`dormsLoaded` 从 `false` 变为 `true` 后，callback 引用变化，可能引发依赖该 callback 的 useMemo/useEffect 重新执行。例如 `App.tsx` 中的 actions 对象会重建。

**建议**: 用 ref 追踪 loaded 状态而不是放在依赖数组中：

```typescript
const dormsLoadedRef = useRef(false);
// 在 callback 内读取 dormsLoadedRef.current
```

---

### 3.4 `filterUtils.ts` 中 `normalizeDateRange` 的类型安全隐患

**文件**: `utils/filterUtils.ts:99`

```typescript
if (typeof value?.valueOf === "function") return Number(value.valueOf());
```

`value` 的类型是 `unknown`，直接用 `?.` 链式调用 `valueOf` 在 TS strict 模式下理论上不应通过（因为 unknown 上不能访问属性）。但由于此处的 `value` 来自数组元素且经过了 null check，TS 推断为 `{}` 类型因而通过。这段代码的意图是检测 dayjs 对象，建议改为更明确的写法：

```typescript
if (value && typeof (value as { valueOf?: unknown }).valueOf === "function") {
  return Number((value as { valueOf: () => unknown }).valueOf());
}
```

---

### 3.5 `useAuth` 中 `refreshUser` 依赖 `token` 状态，且被 useEffect 调用

**文件**: `hooks/useAuth.ts:194-200`

```typescript
useEffect(() => {
  if (!token) return;
  void refreshUser();
}, [refreshUser, token]);
```

`refreshUser` 依赖于 `handleLogout` 和 `token`。`handleLogout` 依赖于 `user?.id`。当 login 成功后：

1. `token` 变化 → effect 触发 → `refreshUser()` 执行
2. `refreshUser` 返回后 `setUser(fetchedUser)` → `user` 变化
3. `handleLogout` 因 `user?.id` 变化而重建 → `refreshUser` 重建
4. `refreshUser` 重建 → **effect 再次触发**

但因为第二次调用时 `refreshUser` 内部的 `token` 未变，请求结果相同，用户无感知。但这是**一次多余的网络请求**。

**修复**: 用 ref 追踪 token 避免重复调用：

```typescript
const tokenRef = useRef(token);
tokenRef.current = token;
// refreshUser 使用 tokenRef.current 而非 token
```

---

## 四、🟢 代码质量建议（非紧急）

### 4.1 类型定义中大量使用 `ServiceRecord`（`Record<string, unknown>`）

`types/service.ts` 中的许多 response 类型使用 `ServiceRecord` 作为 list item 类型：

```typescript
export interface StudentsListResponse {
  students?: ServiceRecord[]; // 太宽泛
}
```

既然已迁移到 TS，建议逐步定义具体的实体类型（如 `Student`、`Dorm`），替换 `ServiceRecord`。这不仅提高类型安全性，还能让 IDE 提供更好的自动补全。

### 4.2 `AppActions` 类型过于宽松

```typescript
export interface AppActions extends Record<string, unknown> {
  changePassword?: (...) => Promise<unknown>;
}
```

`extends Record<string, unknown>` 允许任意属性，使类型检查形同虚设。页面组件中需要 `as DormPageActions` 等断言来获取具体类型。建议定义完整的 AppActions 接口。

### 4.3 `App.tsx` 中 `useThemeCustomization` 在未登录时也执行

`useThemeCustomization()` 在 `App` 组件顶层调用，即使用户未登录也会创建 MutationObserver、读写 localStorage。虽然开销极小，但从职责分离角度不理想。

### 4.4 `confirm.ts` 定时器类型声明良好

`ReturnType<typeof setInterval>` 的使用是 TS 最佳实践，很好地解决了 Node/Browser 环境下 timer 类型不同的问题。 ✅

### 4.5 `useBulkSelection` 的 `WidenId` 类型正确但可读性可改进

```typescript
type WidenId<TId extends string | number> = TId extends string
  ? string
  : number;
```

这用于解决 literal type 宽化问题（如 `"abc"` → `string`），设计正确。

---

## 五、✅ 做得好的方面

| 项目                         | 评价                                                                              |
| ---------------------------- | --------------------------------------------------------------------------------- |
| **类型定义体系**             | `types/` 目录结构清晰，api、app、table、service、import 分层合理                  |
| **泛型使用**                 | `useTableFetch<T>`、`useTableStateCore<TFilters>` 等泛型设计成熟                  |
| **Ref pattern**              | `buildParamsRef`、`onSuccessRef` 等避免闭包陷阱的模式运用正确                     |
| **AbortController 竞态处理** | `useTableFetch` 中的请求竞态和取消逻辑完备                                        |
| **Token 刷新**               | `refreshAccessToken` 使用 Promise 缓存避免并发刷新，设计正确                      |
| **懒加载路由**               | `routePrefetch.ts` 的按角色预加载策略设计精巧                                     |
| **React Query 集成**         | `useMyPermissions`、`useDashboardSummary` 等合理利用 staleTime 和 placeholderData |
| **TSConfig 配置**            | `strict: true` + `strictNullChecks: true` + `noImplicitAny: true` 是最佳实践      |

---

## 六、优先级建议

| 优先级 | 问题                                              | 预计影响                                                |
| ------ | ------------------------------------------------- | ------------------------------------------------------- | -------------------- |
| **P0** | 2.1 `useMobile` 防抖                              | ✅ 已修复 — 改用 matchMedia API                         |
| **P1** | 2.3 `useThemeCustomization` 双重执行              | ✅ 已修复 — MutationObserver 通过 ref 读取状态          |
| **P1** | 3.1 `userRoles` 空数组引用不稳定                  | ✅ 已修复 — 使用模块常量 EMPTY_ROLES                    |
| **P1** | 3.5 `useAuth` 登录后双重 refreshUser              | ✅ 已修复 — token/user 通过 ref 读取                    |
| **P2** | 3.3 loaded 作为 callback 依赖                     | ✅ 已修复 — 改为 useRef (useDorms/useStudents/useUsers) |
| **P2** | 2.2 deps JSON.stringify                           | ✅ 已修复 — 类型约束只允许原始类型                      |
| **P2** | 3.2 `useTableColumns` defaultColumns 无限循环风险 | ✅ 已修复 — 使用 useRef 稳定化                          |
| **P2** | 3.4 filterUtils valueOf 类型安全                  | ✅ 已修复 — 显式类型窄化                                |
| **P3** | 4.1 ServiceRecord 类型细化                        | 🔵 建议后续迭代                                         |
| **P3** | 4.2 AppActions 类型完善                           | 🔵 建议后续迭代                                         | 编辑器体验和类型安全 |
