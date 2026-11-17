Fix Plan

Critical: 服务端缺少授权校验（可创建/删除用户、改权限、删审计日志等）。方案：定义权限模型与“敏感路由 → 权限码/角色”的映射；在 AuthMiddleware 后增加 RequirePermission/RequireRole 中间件统一校验并返回 403；在控制器内补上关键操作的二次校验（如删除审计、权限变更仅 ADMIN）；把权限计算缓存（已有 PermissionService）并在请求上下文注入；前端仅作为 UI 限制而不作为安全边界。涉及：router.go (line 86)、user_controller.go (line 167)、permission_controller.go (line 50)、audit_controller.go (line 229)。测试：未授权/越权访问返回 403；管理员可正常操作；审计日志记录包含操作者与原因。

High: ORDER BY 注入（排序字段直接拼接）。方案：对 sortField/sortOrder 采用白名单映射（类似 infra_repository.go 已有实现），非法值回退默认；统一封装排序验证函数复用；对外仅暴露可排序字段列表。涉及：extended_controller.go (line 105)、extended_controller.go (line 1027)。测试：输入 sortField=createdAt desc;drop… 被拒绝并回退默认；正常排序不受影响。

High: 密钥与敏感配置处理不安全（默认 JWT 密钥、明文凭证、日志打印 DSN）。方案：移除生产环境默认密钥兜底，强制 JWT_SECRET/JWT_REFRESH_SECRET 存在（开发环境可用明确的 DEV 标识）；仓库移除真实 .env，改为 .env.example 并加入 .gitignore；禁用或脱敏 DSN 日志；轮换数据库与 SMTP 密码。涉及：jwt.go (line 28)、.env (line 5)、.env (line 21)、main.go (line 68)。测试：无密钥启动在非 DEV 环境直接失败；日志不输出明文 DSN。

Medium: 登出未撤销 refresh token，Redis 不可用时黑名单失效。方案：为 refresh token 加 jti 并存服务端（Redis/DB），登出时撤销该 jti；刷新时校验 jti 有效且未撤销；Redis 不可用时走 DB 兜底或直接拒绝刷新（fail closed）；考虑 token 轮转 + 旧 token 立即黑名单。涉及：auth_controller.go (line 204)、redis.go (line 89)、auth_service.go (line 123)。测试：登出后 refresh 失效；Redis 断开时刷新策略符合预期。

Medium: 用户禁用/改密后旧 token 仍可用。方案：在 token 中加入 tokenVersion 或 passwordChangedAt，中间件校验与 DB 一致；禁用/改密时递增版本或更新时间戳；可选“全设备登出”策略。涉及：auth.go (line 31)、auth_service.go (line 90)。测试：禁用后立即 403；改密后旧 token 失效。

Medium: 初始/种子账号密码可预测。方案：取消“用户名即密码”和硬编码默认密码；生成随机初始密码并强制首次登录改密（新增 mustChangePassword 标志）；或仅通过管理员设置/邮件重置入口发放；为种子账号在部署后立刻要求改密。涉及：crypto.go (line 56)、user_service.go (line 82)。测试：新用户首次登录强制改密；默认密码不可预测。

Medium: Excel 导入无大小限制且全量读入内存，可能 DoS。方案：设置 MaxMultipartMemory 和 io.LimitReader；对上传大小、类型做硬限制；对大文件引入异步队列或分页解析；复用 UploadController 的类型校验逻辑。涉及：extended_controller.go (line 461)、infra_controller.go (line 585)。测试：超大文件被拒绝；正常文件仍可导入。

Medium: 前端将 token 存在 localStorage（XSS 风险）。方案：切换为 HttpOnly + Secure + SameSite 的 cookie（refresh token）+ 内存 access token；为写操作启用 CSRF 令牌；配合 CSP 降低 XSS 风险；减少 localStorage 中的用户信息。涉及：api.js (line 11)、useAuth.js (line 11)。测试：XSS 无法读取 token；刷新仍可续期。

Low: 前端权限校验 fail-open（角色矩阵未加载时默认放行）。方案：改为 fail-closed 或显示加载态；只有权限数据就绪才渲染敏感操作入口；仍以服务端授权为主。涉及：useAuth.js (line 140)。测试：权限未加载时按钮隐藏/禁用。

Low: check-email 公开接口存在用户名枚举且无限制。方案：统一返回“已发送/请检查邮箱”的泛化信息；添加速率限制与验证码（失败阈值触发）；审计与报警。涉及：auth_controller.go (line 286)、auth_service.go (line 193)。测试：不存在用户也返回同样响应；触发频率限制后阻断。



Mobile UI/UX 检查报告

High: 视口禁止缩放（user-scalable=no），影响移动端无障碍与小屏可读性。方案：移除 maximum-scale=1.0, user-scalable=no 或允许缩放。涉及：frontend/index.html:8。

High: 移动端触控目标过小（分页按钮 24px、高频操作按钮/标题下拉触发器缺少 44px 最小尺寸），误触风险高。方案：为分页控件与关键按钮设置 min-height/min-width 44px，或使用 size="large" 与更大的 padding。涉及：frontend/src/App.css:5224、frontend/src/App.css:698、frontend/src/components/ResponsiveDataView.jsx:158、frontend/src/components/MobileDataCard.jsx:81。

Medium: 顶部安全区只作用于 header，主内容区仅 mt-12，刘海屏设备可能出现内容被 header 遮挡。方案：主内容区使用 calc(48px + env(safe-area-inset-top)) 作为 padding-top 或 margin-top。涉及：frontend/src/layouts/AppLayout.jsx:56、frontend/src/layouts/AppLayout.jsx:78。

Medium: 移动端容器使用 h-screen/min-h-screen（100vh）可能在 iOS 浏览器地址栏收起/弹出时造成跳动或底部遮挡。方案：改用 100dvh/100svh 或 JS 计算 --vh。涉及：frontend/src/layouts/AppLayout.jsx:53、frontend/src/layouts/AppLayout.jsx:323、frontend/src/pages/ResultEntryPage.jsx:896。

Medium: 固定底部操作栏未叠加 safe-area，Home 指示条设备上存在遮挡风险。方案：底部 padding/bottom 使用 calc(... + env(safe-area-inset-bottom))。涉及：frontend/src/pages/ResultEntryPage.jsx:1230、frontend/index.html:46。

Low: 移动端识别仅靠 innerWidth < 768，横屏或大屏手机可能误判为桌面布局。方案：结合 pointer: coarse 或 userAgentData，或提供手动切换。涉及：frontend/src/hooks/useMobile.js:8。
