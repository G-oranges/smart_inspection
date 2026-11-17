# 工程护栏修复 - check-page-size.js

> **日期**：2026-02-01  
> **类型**：工程可靠性修复  
> **影响范围**：仅护栏脚本与文档，不触及业务代码

---

## 一、变更内容

### 1.1 `frontend/scripts/check-page-size.js`

**问题**：

- 原实现 `path.join(__dirname, '../src/pages')` 本身正确
- 但缺少 fallback 和明确的错误处理，当目录不存在时会抛出模糊的 Node.js 错误

**修复**：

- 新增 `resolvePagesDir()` 函数，增强路径解析逻辑
- 优先路径：`path.join(__dirname, '../src/pages')`（脚本位于 `frontend/scripts` 时）
- Fallback 路径：`path.join(process.cwd(), 'src/pages')`（支持从不同目录运行）
- 明确错误提示：当两个路径都找不到时，打印清晰的错误信息并 `exit(1)`

### 1.2 `doc/前端架构改造执行Checklist.md`

**问题**：

- 5.3 节描述阈值为 `目标 1000 / 警告 1500 / 错误 2000`
- 代码实际配置为 `目标 1000 / 警告 2000 / 错误 3000`
- 口径不一致，可能导致 reviewer 误判

**修复**：

- 更新 5.3 节描述为 `目标 1000 / 警告 2000 / 错误 3000`
- 新增路径解析策略说明

---

## 二、为什么这属于"工程可靠性修复"

1. **防御性编程**：增加 fallback 机制和明确错误提示，提高脚本在不同环境下的鲁棒性
2. **文档对齐**：消除文档与代码的口径差异，避免 reviewer 误判
3. **零业务影响**：不改变任何业务逻辑、阈值策略、组件代码
4. **零 eslint-disable**：无新增 lint 规则绕过

---

## 三、Hard Constraints 符合性

| 约束                                  | 状态 |
| ------------------------------------- | ---- |
| 不新增 eslint-disable                 | ✅   |
| 不改变阈值策略（仍是 1000/2000/3000） | ✅   |
| 仅修改护栏脚本与文档                  | ✅   |
| 不触及业务页面/Hook                   | ✅   |
| package.json 和 CI 配置不变           | ✅   |

---

## 四、本地验证

### 4.1 验证命令

```bash
# 从 frontend 目录运行（标准用法）
cd frontend
npm run lint:pagesize

# 或直接运行脚本
node scripts/check-page-size.js
```

### 4.2 预期输出

```
📊 Pages 文件行数检查报告

============================================================
文件                                     行数       状态
------------------------------------------------------------
StudentManagementPage.jsx                2396 ⚠️ WARN
AccountPermissionPage.jsx                2353 ⚠️ WARN
DormManagementPage.jsx                   2053 ⚠️ WARN
TaskPublishPage.jsx                      2012 ⚠️ WARN
ResultViewPage.jsx                       1657 📝 OK
ResultEntryPage.jsx                      1538 📝 OK
BuildingManagementPage.jsx               1349 📝 OK
TeacherManagementPage.jsx                1313 📝 OK
OccupancyManagementPage.jsx               779 ✅ GOOD
...
============================================================

配置: 目标 1000 行 | 警告 2000 行 | 错误 3000 行

⚠️ 检查通过（有警告）：部分文件超过 2000 行
```

### 4.3 错误情况验证

如果在错误目录下运行，将得到明确错误：

```
❌ 错误：无法找到 pages 目录
   尝试路径 1: /wrong/path/src/pages
   尝试路径 2: /current/cwd/src/pages
   请确保在正确的目录下运行此脚本，或检查 src/pages 目录是否存在。
```

---

## 五、变更文件清单

| 文件                                  | 操作 | 行数变化  |
| ------------------------------------- | ---- | --------- |
| `frontend/scripts/check-page-size.js` | 修改 | 82 → 108  |
| `doc/前端架构改造执行Checklist.md`    | 修改 | 738 → 739 |

---

## 六、回滚方式

```bash
git checkout HEAD -- frontend/scripts/check-page-size.js
git checkout HEAD -- doc/前端架构改造执行Checklist.md
```
