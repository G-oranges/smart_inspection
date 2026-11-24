# 智慧宿舍卫生查寝管理系统

> 一款采用 **Apple Human Interface Guidelines** 设计语言的现代化宿舍管理系统，支持移动端 iOS 风格与桌面端 macOS 风格的自适应切换。

本项目采用前后端分离架构，前端使用 **React 18 + Vite + Ant Design v6** 构建，后端使用 **Go (Gin + GORM)** 提供 RESTful API。系统集成了 JWT 鉴权、Redis 令牌管理、RBAC 权限中心及毛玻璃 (Glassmorphism) 视觉系统。

---

## 项目结构

```text
智慧宿舍项目/
├── backend-go/          # Go API 服务 (Gin + GORM + MySQL + Redis)
│   ├── cmd/             # 应用入口 (cmd/server/main.go)
│   ├── internal/        # 业务逻辑层
│   │   ├── controller/  # 控制器
│   │   ├── middleware/  # 中间件 (认证/权限/审计/限流)
│   │   ├── model/       # 数据模型
│   │   ├── repository/  # 数据访问层
│   │   ├── router/      # 路由配置
│   │   └── service/     # 业务服务层
│   ├── pkg/             # 公共工具包
│   └── scripts/         # 数据库与运维脚本
├── frontend/            # React SPA 前端
│   ├── src/
│   │   ├── components/  # 可复用组件
│   │   ├── hooks/       # 自定义 Hooks
│   │   ├── layouts/     # 响应式布局
│   │   ├── pages/       # 功能页面
│   │   ├── services/    # API 服务封装
│   │   ├── styles/      # 全局样式与设计令牌
│   │   ├── theme/       # Ant Design 主题配置
│   │   └── utils/       # 工具函数
│   └── tailwind.config.js
└── doc/                 # 项目文档
```

---

## 核心特性

### Apple HIG 设计语言

| 平台 | 设计风格 | 核心特性 |
|------|----------|----------|
| **移动端** | iOS 风格 | 大标题、毛玻璃导航栏、圆角卡片、底部悬浮药丸导航、`active:scale-95` 按压反馈 |
| **桌面端** | macOS 风格 | 半透明侧边栏、统一工具栏、细腻分隔线、可调整列宽的表格 |

### 安全与权限

- **JWT 双令牌机制**：Access Token + Refresh Token
- **Redis 黑名单**：支持令牌即时注销
- **RBAC 权限中心**：角色权限 + 用户覆盖 + 批量授权
- **服务端纵深防御**：中间件校验 + 控制器二次验证
- **审计日志**：所有敏感操作自动记录

### PWA 支持

- 离线访问（Service Worker 预缓存静态资源）
- 应用安装到主屏幕
- 自动更新检测与提示
- 网络状态实时指示器
- API 请求 NetworkFirst 策略

---

## 技术栈

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
| MySQL | 5.7+ / 8.0+ | 主数据库 |
| Redis | 3.0+ | 缓存与会话（可选，未启动时自动降级） |
| JWT | v5 | 身份认证 |

---

## 快速开始

### 1. 环境准备

- **Node.js** 18+
- **Go** 1.24+
- **MySQL** 5.7+ 或 8.0+
- **Redis** 3.0+（可选，用于令牌黑名单与缓存）

### 2. 启动 MySQL 数据库

根据操作系统启动本地 MySQL 服务（默认端口 `3306`）：

**Windows（以管理员身份运行 PowerShell 或 CMD）：**

```powershell
# 查看本机 MySQL 服务名称（常见为 MySQL80 或 mysql）
Get-Service *mysql*

# 启动 MySQL 服务
net start MySQL80
# 若服务名为 mysql，则执行：
# net start mysql
```

**macOS (Homebrew)：**

```bash
brew services start mysql
```

**Linux (systemd)：**

```bash
sudo systemctl start mysql
```

**创建数据库（首次启动时执行）：**

```powershell
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS dorm_inspection DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

### 3. 启动后端服务

```powershell
cd backend-go

# 首次运行：参考 .env.example 创建并编辑 .env 文件
Copy-Item .env.example .env

# 安装依赖
go mod download

# 启动服务（与前端代理对齐的默认端口为 4002；如终端中文乱码可先执行 chcp 65001）
go run ./cmd/server
```

**环境变量说明（`backend-go/.env`）：**

```env
PORT=4002
DATABASE_URL=mysql://root:password@127.0.0.1:3306/dorm_inspection
REDIS_ADDR=127.0.0.1:6379

# 运行环境：development / dev / local / test 视为开发环境；不设置则按生产环境处理
APP_ENV=development
# Access Token 签名密钥（非开发环境必填，至少 32 字节）
JWT_SECRET=your_at_least_32_bytes_secret_key

# 新用户初始密码（需符合复杂度要求：不少于 8 位，包含大小写字母、数字及标点符号）
DEFAULT_INITIAL_PASSWORD=YourPassword123!

# SMTP 配置（用于密码找回）
SMTP_HOST=smtp.example.com
SMTP_PORT=465
SMTP_USERNAME=your@email.com
SMTP_PASSWORD=your_password
```

### 4. 启动前端服务

```powershell
cd frontend

# 安装依赖
npm install

# 启动开发服务器（默认端口 5173，监听 0.0.0.0，代理 /api 与 /uploads 至 http://localhost:4002）
npm run dev
```

启动后在浏览器访问 `http://localhost:5173`。

### 5. 默认登录

- **用户名**：`root`
- **密码**：`123456`

---

## 功能模块

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

## 开发规范

### API 规范

- 前端调用 API 时**不要**在末尾添加斜杠 `/`
- 后端已配置严格路由匹配以防止重定向丢头

### UI 开发规范

请遵循 [`doc/style_handbook.md`](./doc/style_handbook.md) 与 [`doc/modal_style_guide.md`](./doc/modal_style_guide.md)：

1. 统一使用 `frontend/src/styles/base/tokens.css` 中的 `--co-*` 设计令牌
2. 唯一全局样式入口为 `frontend/src/styles/index.css`
3. 复用 `frontend/src/components/common` 中的公共组件与 `.co-*` 样式类
4. 桌面端弹窗统一遵循 `co-modal` 与 `MODAL_WIDTH` 规范

---

## 常用命令

### MySQL

```powershell
# 启动 / 停止 MySQL 服务（Windows，服务名按本机实际为准）
net start MySQL80
net stop MySQL80

# 登录 MySQL 客户端
mysql -u root -p
```

### 后端 (`backend-go`)

```powershell
# 启动开发服务
go run ./cmd/server

# 运行测试
go test ./...

# 构建可执行文件
go build -o server.exe ./cmd/server

# 查找占用 4002 端口的进程
netstat -ano | findstr :4002

# 终止指定进程
taskkill /PID <进程ID> /F
```

### 前端 (`frontend`)

```powershell
# 开发模式（监听 0.0.0.0:5173）
npm run dev

# 类型检查
npm run typecheck

# 代码检查与样式护栏
npm run lint
npm run lint:styleguard

# 单元测试
npm run test

# 完整本地 CI 校验
npm run ci

# 生产构建与预览
npm run build
npm run preview
```

---

## 许可证

本项目仅供学习与内部使用。
