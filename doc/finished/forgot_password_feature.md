# 忘记密码功能实现进度

> 更新时间：2025-12-27

## 一、功能概述

实现了基于邮箱验证的忘记密码功能，用户可以通过绑定的邮箱接收验证码来重置密码。

## 二、已完成的工作

### 后端（Go）

| 文件                                     | 修改内容                                                                | 状态 |
| ---------------------------------------- | ----------------------------------------------------------------------- | ---- |
| `pkg/email/email.go`                     | 新增邮件服务工具包，支持 SMTP 发送验证码邮件                            | ✅   |
| `internal/service/auth_service.go`       | 添加 `ForgotPassword` 和 `ResetPasswordByCode` 方法                     | ✅   |
| `internal/controller/auth_controller.go` | 添加 `ForgotPassword` 和 `ResetPassword` 接口处理                       | ✅   |
| `internal/router/router.go`              | 注册 `/api/auth/forgot-password` 和 `/api/auth/reset-password` 公开路由 | ✅   |
| `.env`                                   | 添加 SMTP 邮件服务配置模板                                              | ✅   |
| `go.mod` / `go.sum`                      | 添加 `gopkg.in/gomail.v2` 依赖                                          | ✅   |

### 前端（React）

| 文件                                    | 修改内容                                          | 状态 |
| --------------------------------------- | ------------------------------------------------- | ---- |
| `src/components/ForgotPasswordForm.jsx` | 新增忘记密码表单组件（三步流程）                  | ✅   |
| `src/components/LoginForm.jsx`          | 添加"忘记密码？"链接                              | ✅   |
| `src/services/authService.js`           | 添加 `forgotPassword` 和 `resetPassword` API 方法 | ✅   |
| `src/App.jsx`                           | 集成忘记密码流程切换逻辑                          | ✅   |
| `src/App.css`                           | 添加忘记密码表单样式                              | ✅   |

## 三、API 接口说明

### 1. 发送验证码

```
POST /api/auth/forgot-password
Content-Type: application/json

{
  "email": "user@example.com"
}
```

**响应**：

- 成功：`{ "message": "验证码已发送到您的邮箱，请查收", "success": true }`
- 失败：`{ "message": "错误信息" }`

### 2. 重置密码

```
POST /api/auth/reset-password
Content-Type: application/json

{
  "email": "user@example.com",
  "code": "123456",
  "newPassword": "NewPassword123!"
}
```

**响应**：

- 成功：`{ "message": "密码重置成功，请使用新密码登录", "success": true }`
- 失败：`{ "message": "错误信息" }`

## 四、安全机制

1. **验证码有效期**：5 分钟
2. **速率限制**：每个邮箱 1 分钟内只能请求一次验证码
3. **密码强度校验**：新密码必须不少于 8 位，包含大小写字母、数字及标点符号
4. **审计日志**：记录密码重置请求和成功重置事件

## 五、配置说明

在 `backend-go/.env` 文件中配置以下参数：

### 密码策略配置

```env
# ===== 密码策略配置 =====
# 新用户初始密码（导入学生/教职工自动同步账号时使用）
# 必须符合密码复杂度要求：不少于8位，包含大小写字母、数字及标点符号
DEFAULT_INITIAL_PASSWORD=YourPassword123!
```

### SMTP 邮件服务配置

```env
# ===== SMTP 邮件服务配置（腾讯企业邮箱）=====
SMTP_HOST=smtp.exmail.qq.com
SMTP_PORT=465
SMTP_USERNAME=your_email@your_domain.com
SMTP_PASSWORD=your_password_or_auth_code
SMTP_FROM_NAME=宿舍查寝系统
SMTP_FROM=
SMTP_SSL=true
```

**注意**：

- 请将上述配置替换为实际的邮箱账号和密码/授权码
- 建议使用邮箱授权码而非登录密码，以提高安全性
- 腾讯企业邮箱需要在管理后台开启 SMTP 服务
- `SMTP_FROM_NAME` 用于设置中文发件人显示名称
- `SMTP_FROM` 可留空，默认使用 `SMTP_USERNAME`

## 六、初始密码配置化说明

### 修改的文件

| 文件                                  | 修改内容                                                                  |
| ------------------------------------- | ------------------------------------------------------------------------- |
| `pkg/utils/crypto.go`                 | 新增 `GetDefaultInitialPassword()` 和 `HashDefaultInitialPassword()` 函数 |
| `internal/service/user_service.go`    | 使用 `utils.GetDefaultInitialPassword()` 替代硬编码常量                   |
| `internal/service/student_service.go` | 账号同步使用 `utils.HashDefaultInitialPassword()`                         |
| `internal/service/teacher_service.go` | 账号同步使用 `utils.HashDefaultInitialPassword()`                         |
| `.env`                                | 新增 `DEFAULT_INITIAL_PASSWORD` 配置项                                    |

### 影响范围

- ✅ 导入学生数据自动同步账号
- ✅ 导入教职工数据自动同步账号
- ✅ 管理员手动创建账号
- ✅ 管理员重置用户密码
- ❌ 种子账号（root, admin, teacher, student, counselor）保持用户名作为密码

## 七、使用前提

1. 用户必须在账号管理中绑定有效的邮箱地址
2. 后端必须正确配置 SMTP 邮件服务参数
3. Redis 服务必须正常运行（用于存储验证码）

## 八、测试步骤

1. **配置邮件服务**：在 `.env` 中填入正确的 SMTP 配置
2. **重启后端服务**：运行 `go run cmd/server/main.go`
3. **测试流程**：
   - 访问登录页，点击"忘记密码？"链接
   - 输入已绑定的邮箱地址
   - 查收邮件获取验证码
   - 输入验证码和新密码完成重置

## 九、待办事项

- [x] 实现配置化初始密码
- [ ] 为测试账号绑定邮箱地址
- [ ] 配置实际的 SMTP 邮件服务参数
- [ ] 进行完整的功能测试
