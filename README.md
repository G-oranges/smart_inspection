# 🏠 智慧宿舍卫生查寝管理系统

> 一款采用 **Apple Human Interface Guidelines** 设计语言的现代化宿舍管理系统，支持移动端 iOS 风格与桌面端 macOS 风格的自适应切换。

本项目采用前后端分离架构，前端使用 **React 18 + Vite + Ant Design v6** 构建高保真原型系统，后端使用 **Go (Gin + GORM)** 提供 RESTful API。系统集成了 JWT 鉴权、Redis 令牌管理、RBAC 权限中心及毛玻璃 (Glassmorphism) 视觉系统。

---

## 📂 项目结构

```
D:\my-project
├── backend-go/          # Go API 服务 (Gin + GORM + Redis)
│   ├── cmd/             # 应用入口
│   ├── internal/        # 业务逻辑层
│   │   ├── controller/  # 控制器 (16 个模块)
│   │   ├── middleware/  # 中间件 (认证/权限/审计/限流)
│   │   ├── model/       # 数据模型
│   │   ├── repository/  # 数据访问层
│   │   ├── router/      # 路由配置
│   │   └── service/     # 业务服务层
│   └── pkg/             # 公共工具包
├── frontend/            # React SPA 前端
│   ├── src/
│   │   ├── components/  # 可复用组件 (32+)
│   │   ├── hooks/       # 自定义 Hooks (15+)
│   │   ├── layouts/     # 响应式布局
│   │   ├── pages/       # 功能页面 (15 个)
│   │   ├── services/    # API 服务封装
│   │   ├── theme/       # Ant Design 主题配置
│   │   └── utils/       # 工具函数
│   └── tailwind.config.js
└── doc/                 # 项目文档
```

---

## ✨ 核心特性

### 🎨 Apple HIG 设计语言

| 平台 | 设计风格 | 核心特性 |
|------|----------|----------|
| **移动端** | iOS 风格 | 大标题、毛玻璃导航栏、圆角卡片、底部悬浮药丸导航、`active:scale-95` 按压反馈 |
| **桌面端** | macOS 风格 | 半透明侧边栏、统一工具栏、细腻分隔线、可调整列宽的表格 |

### 🔐 安全与权限

- **JWT 双令牌机制**：Access Token + Refresh Token
- **Redis 黑名单**：支持令牌即时注销
- **RBAC 权限中心**：角色权限 + 用户覆盖 + 批量授权
- **服务端纵深防御**：中间件校验 + 控制器二次验证
- **审计日志**：所有敏感操作自动记录

### 📱 PWA 支持

- ✅ 离线访问（Service Worker 预缓存静态资源）
- ✅ 应用安装到主屏幕
- ✅ 自动更新检测与提示
- ✅ 网络状态实时指示器
- ✅ API 请求 NetworkFirst 策略

---

## 🛠️ 技术栈

### 前端

| 技术 | 版本 | 用途 |
|------|------|------|
| React | 18.3+ | UI 框架 |
| Vite | 5.4+ | 构建工具 |
| Ant Design | 6.0+ | UI 组件库 |
| Tailwind CSS | 3.4+ | 原子化 CSS |
| React Router | 6.28+ | 路由管理 |
| TanStack Query | 5.90+ | 数据获取与缓存 |
| Recharts | 3.5+ | 数据可视化 |
| xlsx | 0.18+ | Excel 导入导出 |

### 后端

| 技术 | 版本 | 用途 |
|------|------|------|
| Go | 1.24+ | 编程语言 |
| Gin | 1.9+ | Web 框架 |
| GORM | 1.30+ | ORM 框架 |
| MySQL | 8.0+ | 主数据库 |
| Redis | 3.0+ | 缓存与会话 |
| JWT | v5 | 身份认证 |

---

## 🚀 快速开始

### 1. 环境准备

- **Node.js** 18+
- **Go** 1.24+
- **MySQL** 8.0+
- **Redis** 3.0+

### 2. 后端启动

```powershell
cd backend-go

# 配置环境变量
# 编辑 .env 文件，设置 DATABASE_URL、SMTP 等配置

# 安装依赖
go mod download

# 运行服务 (默认端口 4001)
chcp 65001 && go run cmd/server/main.go
```

**环境变量说明**：

```env
PORT=4001
DATABASE_URL=mysql://root:password@localhost:3306/dorm_inspection

# 新用户初始密码（需符合复杂度要求）
DEFAULT_INITIAL_PASSWORD=YourPassword123!

# SMTP 配置（用于密码找回）
SMTP_HOST=smtp.example.com
SMTP_PORT=465
SMTP_USERNAME=your@email.com
SMTP_PASSWORD=your_password
```

### 3. 前端启动

```powershell
cd frontend

# 安装依赖
npm install

# 运行开发服务器 (默认端口 5173)
npm run dev
```

### 4. 默认登录

- **用户名**：`root`
- **密码**：`123456`

---

## 📄 功能模块

### 基础设施管理

| 页面 | 功能 |
|------|------|
| 楼栋管理 | 楼栋 CRUD、批量导入导出 |
| 宿舍管理 | 楼-层-室-床四级结构管理 |
| 学生管理 | 学生信息维护、宿舍分配 |
| 教师管理 | 教职工账号管理 |
| 入住管理 | 床位分配、调宿、退宿 |

### 查寝业务

| 页面 | 功能 |
|------|------|
| 任务发布 | 创建查寝任务、圈定检查范围 |
| 结果录入 | 移动端录入评分、拍照取证 |
| 结果查看 | 多维度统计与筛选 |
| 申诉处理 | 成绩申诉受理与审批 |

### 系统管理

| 页面 | 功能 |
|------|------|
| 账号权限 | RBAC 权限配置、用户覆盖 |
| 审计日志 | 操作日志查询与导出 |
| 系统设置 | 邮件服务、密码策略配置 |
| 仪表盘 | 数据概览与统计图表 |

---

## 🎯 开发规范

### API 规范

- 前端调用 API 时**不要**在末尾添加斜杠 `/`
- 后端已配置严格路由匹配以防止重定向丢头

### UI 开发规范

遵循 `migration-for-antdesignv6.md` 规范：

1. 使用 **Design Tokens** 通过 `ConfigProvider` 实现定制化
2. 所有表单控件高度统一为 **44px**（iOS 触控标准）
3. 使用 `apple-` 前缀的原子类覆盖 AntD 默认样式
4. 按钮圆角使用 **12px**（圆角矩形）而非胶囊形状

### Tailwind 扩展

项目已配置 iOS/macOS 专用设计令牌：

```javascript
// tailwind.config.js
colors: {
  ios: {
    blue: '#007AFF',
    gray: '#F2F2F7',
    'gray-dark': '#1C1C1E',
    green: '#34C759',
    red: '#FF3B30',
    // ...
  },
  macos: {
    sidebar: 'rgba(246, 246, 246, 0.6)',
    accent: '#007AFF',
  }
}
```

---

## 🔧 常用命令

### 后端

```powershell
# 查找占用端口的进程
netstat -ano | findstr :4001

# 终止进程
taskkill /PID <进程ID> /F

# 构建可执行文件
go build -o server.exe cmd/server/main.go
```

### 前端

```powershell
# 开发模式
npm run dev

# 生产构建
npm run build

# 代码检查
npm run lint

# 预览生产构建
npm run preview
```

---

## 📊 项目进展

- **当前阶段**：Phase 5 - 安全加固与稳定性优化
- **最后更新**：2026-01-27

### 已完成

- ✅ Ant Design v6 全面迁移
- ✅ Apple HIG 风格组件库
- ✅ 移动端悬浮药丸导航
- ✅ PWA 离线支持
- ✅ 表格列宽调整与操作列冻结
- ✅ WCAG 暗黑模式对比度修复
- ✅ 服务端授权中间件加固

详细进展请参阅 [`doc/project_progress.md`](./doc/project_progress.md)

---

## 📝 许可证

本项目仅供学习与内部使用。

---

_Created by Antigravity AI Assistant | Last Updated: 2026-01-27_
