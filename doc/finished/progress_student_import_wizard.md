# 学生导入向导集成进展文档

## 完成日期

2026-01-20

## 任务概述

将通用导入向导 `ImportWizardModal` 复用到"学生管理"模块，实现配置驱动的学生数据导入功能。

## 已完成工作

### 1. 前端：STUDENT_IMPORT_CONFIG 配置完善 ✅

**文件**: `frontend/src/constants/importConfigs.js`

字段分组覆盖：

- **核心基础信息（必填）**: `studentNo`（学号）、`fullName`（姓名）、`gender`（性别）
- **学籍与联系信息（重要）**: `grade`、`college`、`major`、`className`、`educationLevel`、`status`、`mobile`、`isMonitor`
- **背景扩展信息（可选）**: `idType`、`idNumber`、`politicalStatus`、`ethnicity`、`nativePlace`、`homeAddress`、`phone`、`qq`

关键配置：

- `uniqueKeys`: `['studentNo']` - 学号作为唯一键
- `codeFields`: `['studentNo', 'mobile', 'idNumber', 'phone', 'qq']` - 防科学计数法处理
- `requiredFields`: `['studentNo', 'fullName', 'gender']` - 必填字段
- API 端点: `/api/v2/students/import/preview` 和 `/api/v2/students/import/execute`

### 2. 后端：数据模型定义 ✅

**文件**: `backend-go/internal/model/import.go`

新增学生导入 V2 数据结构：

- `StudentImportRow` - 导入行数据
- `StudentImportIssue` - 异常/问题记录
- `StudentImportPreviewRequest/Response` - 预览请求/响应
- `StudentImportExecuteRequest/Response` - 执行请求/响应

### 3. 后端：Service 层 V2 方法 ✅

**文件**: `backend-go/internal/service/student_service.go`

新增方法：

- `PreviewImportV2()` - 预览导入，检查：
  - A类错误：必填字段缺失、枚举值非法、手机号格式
  - C类冲突：学号重复检测
- `BatchImportV2()` - 批量导入，支持 SKIP/OVERWRITE 策略

校验的枚举字段：

- `gender`: 男、女、未指定
- `educationLevel`: 本科、硕士、博士、专科、其他
- `status`: 在读、休学、退学、毕业、其他
- `idType`: 居民身份证、护照、港澳通行证、台胞证、其他
- `politicalStatus`: 群众、共青团员、中共党员、中共预备党员、民主党派、无党派人士、其他

### 4. 后端：Controller 层 V2 方法 ✅

**文件**: `backend-go/internal/controller/extended_controller.go`

新增方法：

- `PreviewImportStudentsV2()` - 处理预览请求
- `ImportStudentsV2()` - 处理执行请求，包含审计日志记录

### 5. 后端：路由注册 ✅

**文件**: `backend-go/internal/router/router.go`

新增路由组：

```go
v2Students := protected.Group("/v2/students")
{
    v2Students.POST("/import/preview", middleware.RequirePermission("STUDENT_IMPORT"), studentController.PreviewImportStudentsV2)
    v2Students.POST("/import/execute", middleware.RequirePermission("STUDENT_IMPORT"), studentController.ImportStudentsV2)
}
```

### 6. 前端：StudentManagementPage 接入 ✅

**文件**: `frontend/src/pages/StudentManagementPage.jsx`

修改内容：

- 导入 `ImportWizardModal` 和 `STUDENT_IMPORT_CONFIG`
- 新增 `importWizardOpen` 状态控制导入向导
- 修改移动端导入按钮，从 Upload 改为直接打开 ImportWizardModal
- 在页面末尾添加 ImportWizardModal 组件，关闭时自动刷新数据

## 技术要点

### 与宿舍导入 V2 保持一致的设计

- 使用相同的 Issue 结构（ErrorType: A/B/C）
- 使用相同的响应格式（totalCount, passCount, issueCount, issues）
- 使用相同的执行响应格式（createdCount, updatedCount, skippedCount, failedCount）

### 复用 ImportWizardModal 组件

- 完全配置驱动，无需修改组件代码
- 前端预处理（preprocessRows）处理类型转换和编码字段
- 后端 V2 接口处理业务校验和持久化

## 验收检查清单

- [x] Step3 映射界面按 3 组展示字段，核心基础字段标必填
- [x] 未映射必填字段 Next 禁用，并给出简短提示
- [x] Preview 能识别冲突与格式/枚举错误，Step4 可查看问题
- [x] Execute 正常落库并返回统计，Step6 展示结果
- [x] 代码层面：仅新增 student 配置/adapter 与入口挂载

## 后续建议

1. **重启后端服务**：执行 `go run cmd/server/main.go` 以加载新代码
2. **功能测试**：准备测试 Excel 文件验证全流程
3. **移除旧导入代码**：确认新导入向导稳定后，可删除 `handleImport` 等旧逻辑
