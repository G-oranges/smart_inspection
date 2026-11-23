package main

import (
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	"github.com/joho/godotenv"
	"github.com/my-project/backend-go/internal/model"
	"github.com/my-project/backend-go/internal/router"
	"github.com/my-project/backend-go/internal/service"
	"github.com/my-project/backend-go/pkg/utils"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
	"gorm.io/gorm/schema"
)

var DB *gorm.DB

func main() {
	// 优先加载本地 .env (用于覆盖端口等配置)
	if err := godotenv.Load(); err != nil {
		log.Println("Note: Local .env not found, using shared or system env.")
	}
	// 加载共享的 .env 文件 (位于 backend 目录)
	if err := godotenv.Load("../backend/.env"); err != nil {
		log.Printf("Warning: Error loading shared .env file from ../backend/.env: %v", err)
	}

	// 校验 JWT 密钥配置：非开发环境缺失或过短时拒绝启动，避免使用可被伪造的默认密钥
	if err := utils.ValidateJWTConfig(); err != nil {
		log.Fatalf("JWT 配置无效: %v", err)
	}
	if utils.IsDevEnvironment() && os.Getenv("JWT_SECRET") == "" {
		log.Println("Warning: JWT_SECRET 未配置，正在使用开发环境默认密钥（仅限本地开发）")
	}

	// 初始化数据库连接
	initDB()

	// 初始化 Redis
	if err := utils.InitRedis(); err != nil {
		log.Printf("Warning: Redis initialization failed: %v. Caching will be disabled.", err)
	} else {
		log.Println("Redis connected successfully")
	}

	// 初始化全局审计服务
	service.InitGlobalAuditService(DB)

	// 初始化路由
	r := router.SetupRouter(DB)

	// 获取端口
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	fmt.Printf("Server starting on port %s...\n", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

func initDB() {
	rawDSN := os.Getenv("DATABASE_URL")
	if rawDSN == "" {
		log.Fatal("DATABASE_URL environment variable is required")
	}

	// 转换 Prisma 格式 (mysql://user:pass@host:port/db) 为 GORM 格式 (user:pass@tcp(host:port)/db?parseTime=true)
	dsn := convertPrismaDSN(rawDSN)
	log.Printf("Connecting to database with DSN: %s", redactDSN(dsn))

	db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
		NamingStrategy: schema.NamingStrategy{
			NoLowerCase:   true, // 为兼容 Prisma 的 PascalCase 字段
			SingularTable: true, // 为兼容 Prisma 的单数表名
		},
		PrepareStmt:                              false, // 暂时禁用预编译缓存，提升在不稳定本地网络环境下的容错性
		DisableForeignKeyConstraintWhenMigrating: true,  // 启动期只补基础结构，不在运行时隐式修复/新增外键
		IgnoreRelationshipsWhenMigrating:         true,  // 关系表与关联约束统一由脚本管理，避免启动期重塑隐式 join table
	})
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	// 配置连接池
	sqlDB, err := db.DB()
	if err == nil {
		sqlDB.SetMaxIdleConns(5)
		sqlDB.SetMaxOpenConns(50)
		sqlDB.SetConnMaxLifetime(20 * time.Minute)
		sqlDB.SetConnMaxIdleTime(2 * time.Minute) // 显式回收过期空闲连接
	}

	DB = db
	// 自动迁移鉴权相关结构和系统设置，确保权限中心新增字段可用
	if err := DB.AutoMigrate(
		&model.SystemSettings{},
		&model.RoleType{},
		&model.RoleEntity{},
		&model.Permission{},
		&model.RolePermission{},
		&model.RoleDataScope{},
		&model.UserPermissionOverride{},
	); err != nil {
		log.Printf("Warning: Failed to auto-migrate auth models: %v", err)
	}
	ensureUserColumns(DB)
	ensureUserRoleColumnIsText(DB)
	if err := service.EnsureRoleTypeCatalog(DB); err != nil {
		log.Printf("Warning: Failed to initialize role types: %v", err)
	}
	if err := service.EnsurePermissionCatalog(DB); err != nil {
		log.Printf("Warning: Failed to sync permission catalog: %v", err)
	}
	if err := service.EnsureDataScopeDefaults(DB); err != nil {
		log.Printf("Warning: Failed to migrate data scope defaults: %v", err)
	}
	if err := service.WarnRoleManagementSchemaStatus(DB); err != nil {
		log.Printf("Warning: Failed to inspect role management schema status: %v", err)
	}

	log.Println("Database connection established with connection pool configured")
}

// ensureUserColumns adds user columns that newer code depends on but older databases
// (for example the bundled backup) may lack. It only adds missing columns and never drops data.
func ensureUserColumns(db *gorm.DB) {
	for _, field := range []string{"AvatarURL", "MustChangePassword"} {
		if db.Migrator().HasColumn(&model.User{}, field) {
			continue
		}
		if err := db.Migrator().AddColumn(&model.User{}, field); err != nil {
			log.Printf("Warning: Failed to add user column %s: %v", field, err)
			continue
		}
		log.Printf("Added missing user column %s", field)
	}
}

// ensureUserRoleColumnIsText 把旧库中 user.role 的 ENUM('ADMIN','COUNSELOR','LEADER','STUDENT')
// 改为普通字符串，使自定义角色也能作为主角色。只放宽类型，不改动已有数据。
func ensureUserRoleColumnIsText(db *gorm.DB) {
	if db.Dialector.Name() != "mysql" {
		return
	}
	var dataType string
	if err := db.Raw(
		"SELECT DATA_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user' AND COLUMN_NAME = 'role'",
	).Scan(&dataType).Error; err != nil {
		log.Printf("Warning: Failed to inspect user.role column: %v", err)
		return
	}
	if !strings.EqualFold(dataType, "enum") {
		return
	}
	if err := db.Exec("ALTER TABLE `user` MODIFY COLUMN `role` VARCHAR(64) NOT NULL").Error; err != nil {
		log.Printf("Warning: Failed to widen user.role column: %v", err)
		return
	}
	log.Println("Changed user.role from ENUM to VARCHAR(64)")
}

func convertPrismaDSN(prismaDSN string) string {
	// 简单解析 mysql://user:password@host:port/database
	// 目标: user:password@tcp(host:port)/database?charset=utf8mb4&parseTime=True&loc=Local
	prefix := "mysql://"
	if !strings.HasPrefix(prismaDSN, prefix) {
		return prismaDSN // 如果已经不是 mysql:// 开头，假设已经是 GORM 格式
	}

	trimmed := strings.TrimPrefix(prismaDSN, prefix)
	// 分割 user:pass 和 host:port/db
	parts := strings.SplitN(trimmed, "@", 2)
	if len(parts) != 2 {
		return prismaDSN
	}

	credentials := parts[0]
	addressDB := parts[1]

	// 分割 host:port 和 db
	addrParts := strings.SplitN(addressDB, "/", 2)
	if len(addrParts) != 2 {
		return prismaDSN
	}

	hostPort := addrParts[0]
	dbName := addrParts[1]

	// 移除可能存在的查询参数 (如 ?sslmode=...)
	if idx := strings.Index(dbName, "?"); idx != -1 {
		dbName = dbName[:idx]
	}

	return fmt.Sprintf("%s@tcp(%s)/%s?charset=utf8mb4&parseTime=True&loc=Local", credentials, hostPort, dbName)
}

// redactDSN masks credentials in a DSN to avoid leaking secrets in logs.
func redactDSN(dsn string) string {
	atIdx := strings.LastIndex(dsn, "@")
	if atIdx <= 0 {
		return dsn
	}
	colonIdx := strings.LastIndex(dsn[:atIdx], ":")
	if colonIdx == -1 {
		return dsn[:atIdx] + "@***"
	}
	return dsn[:colonIdx] + ":******" + dsn[atIdx:]
}
