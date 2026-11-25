package router

import (
	"log"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/my-project/backend-go/internal/controller"
	"github.com/my-project/backend-go/internal/middleware"
	"github.com/my-project/backend-go/internal/repository"
	"github.com/my-project/backend-go/internal/service"
	"gorm.io/gorm"
)

// trustedProxiesFromEnv 读取 TRUSTED_PROXIES（逗号分隔的 IP/CIDR）；未配置时返回 nil，表示不信任任何代理。
func trustedProxiesFromEnv() []string {
	raw := strings.TrimSpace(os.Getenv("TRUSTED_PROXIES"))
	if raw == "" {
		return nil
	}
	proxies := make([]string, 0)
	for _, item := range strings.Split(raw, ",") {
		if trimmed := strings.TrimSpace(item); trimmed != "" {
			proxies = append(proxies, trimmed)
		}
	}
	return proxies
}

func SetupRouter(db *gorm.DB) *gin.Engine {
	r := gin.Default()
	// 默认不信任任何代理转发的 IP（防止伪造 X-Forwarded-For 绕过限流）；
	// 部署在反向代理后时，通过 TRUSTED_PROXIES（逗号分隔）显式配置代理地址。
	if err := r.SetTrustedProxies(trustedProxiesFromEnv()); err != nil {
		log.Printf("Warning: invalid TRUSTED_PROXIES: %v", err)
		_ = r.SetTrustedProxies(nil)
	}
	// 启用尾随斜杠重定向，这样 /api/users/ 会自动重定向到 /api/users
	r.RedirectTrailingSlash = true
	r.RedirectFixedPath = false

	// 初始化服务和控制器
	authService := service.NewAuthService(db)
	authController := controller.NewAuthControllerWithDB(authService, db)

	permissionService := service.NewPermissionService(db)

	userRepo := repository.NewUserRepository(db)
	userService := service.NewUserService(userRepo, db, service.WithPermissionCacheInvalidator(permissionService.InvalidateCacheForUsers))
	userController := controller.NewUserController(userService)

	infraRepo := repository.NewInfrastructureRepository(db)
	infraService := service.NewInfrastructureService(infraRepo)
	infraController := controller.NewInfrastructureController(db, infraService)

	taskRepo := repository.NewTaskRepository(db)
	taskService := service.NewTaskService(taskRepo, infraRepo, db)
	taskController := controller.NewTaskController(db, taskService)

	inspectionRepo := repository.NewInspectionRepository(db)
	inspectionService := service.NewInspectionService(inspectionRepo)
	inspectionController := controller.NewInspectionController(db, inspectionService)

	appealRepo := repository.NewAppealRepository(db)
	appealService := service.NewAppealService(db, appealRepo, service.NewAuditService(db))
	appealController := controller.NewAppealController(db, appealService)

	dashboardService := service.NewDashboardService(db)
	dashboardController := controller.NewDashboardController(dashboardService)

	settingController := controller.NewSettingController(db)
	auditController := controller.NewAuditController(db)
	uploadController := controller.NewUploadController("./data/uploads")
	avatarController := controller.NewAvatarController(db)

	studentRepo := repository.NewStudentRepository(db)
	studentService := service.NewStudentService(studentRepo, db)
	studentController := controller.NewStudentController(db, studentService)

	teacherRepo := repository.NewTeacherRepository(db)
	teacherService := service.NewTeacherService(teacherRepo, db)
	teacherController := controller.NewTeacherController(db, teacherService)

	buildingController := controller.NewBuildingController(db, infraService)
	roleController := controller.NewRoleController(db, permissionService)
	permissionController := controller.NewPermissionController(permissionService)

	// 静态资源服务
	r.Static("/uploads", "./data/uploads")

	// 登录失败限流：同一 IP+账号 15 分钟内最多失败 5 次；同一 IP 15 分钟内最多失败 30 次。
	// 使用 Redis 实现，支持多实例部署；Redis 不可用时自动降级为内存模式
	loginAccountLimiter := middleware.NewDistributedRateLimiter("login-account", 15*time.Minute, 5)
	loginIPLimiter := middleware.NewDistributedRateLimiter("login-ip", 15*time.Minute, 30)
	// 找回密码相关公开接口：同一 IP 15 分钟内最多 10 次
	passwordRecoveryLimiter := middleware.NewDistributedRateLimiter("password-recovery", 15*time.Minute, 10)
	recoveryLimit := middleware.SimpleRateLimiter(passwordRecoveryLimiter, "操作过于频繁，请稍后再试")

	// API 路由组
	api := r.Group("/api")
	{
		// 公开路由
		auth := api.Group("/auth")
		{
			auth.POST("/login", middleware.LoginFailureRateLimiter(loginAccountLimiter, loginIPLimiter), authController.Login)
			auth.POST("/refresh", authController.Refresh)
			// 忘记密码相关（公开接口，无需登录）
			auth.POST("/check-email", recoveryLimit, authController.CheckUserEmail) // 检查用户绑定的邮箱
			auth.POST("/forgot-password", recoveryLimit, authController.ForgotPassword)
			auth.POST("/reset-password", recoveryLimit, authController.ResetPassword)
		}

		// 受保护路由
		protected := api.Group("")
		protected.Use(middleware.AuthMiddleware())
		protected.Use(middleware.PermissionInjector(db, permissionService))
		{
			protected.POST("/auth/verify-password", authController.VerifyPassword)
			protected.PUT("/auth/change-password", authController.ChangePassword)
			// 用户模块
			users := protected.Group("/users")
			{
				users.GET("/me", userController.GetMe)
				users.PUT("/me", userController.UpdateMe)

				// 执行人列表含教职工联系方式，仅发布任务的人需要
				users.GET("/executors", middleware.RequirePermission("TASK_PUBLISH", "TASK_EDIT"), userController.GetExecutors)
				users.GET("", middleware.RequirePermission("USER_MANAGE"), userController.GetUsers)
				users.POST("", middleware.RequirePermission("USER_MANAGE"), userController.CreateUser)
				users.PUT("/:id", middleware.RequirePermission("USER_MANAGE"), userController.UpdateUser)
				users.PUT("/:id/reset-password", middleware.RequirePermission("USER_MANAGE"), userController.ResetPassword)
				users.POST("/:id/temporary-password", middleware.RequirePermission("USER_MANAGE"), userController.GenerateTemporaryPassword)
				users.DELETE("", middleware.RequirePermission("USER_MANAGE"), userController.DeleteUsers)
			}

			// 学生模块
			students := protected.Group("/students")
			{
				students.GET("", middleware.RequirePermission("STUDENT_VIEW"), studentController.GetStudents)
				students.GET("/table", middleware.RequirePermission("STUDENT_VIEW"), studentController.GetStudentTable)
				students.GET("/filter-options", middleware.RequirePermission("STUDENT_VIEW"), studentController.GetFilterOptions)
				students.POST("", middleware.RequirePermission("STUDENT_EDIT"), studentController.CreateStudent)
				students.PUT("/:id", middleware.RequirePermission("STUDENT_EDIT"), studentController.UpdateStudent)
				students.DELETE("", middleware.RequirePermission("STUDENT_EDIT"), studentController.DeleteStudents)
				students.POST("/batch-delete", middleware.RequirePermission("STUDENT_EDIT"), studentController.DeleteStudents) // 兼容 Node.js 路由
				students.GET("/me", studentController.GetMe)
				students.PUT("/me/contact", studentController.UpdateMyContact)
				students.PUT("/batch-monitor", middleware.RequirePermission("STUDENT_EDIT"), studentController.BatchMonitor)
				students.POST("/import", middleware.RequirePermission("STUDENT_IMPORT"), studentController.ImportStudents)
				students.POST("/import/preview", middleware.RequirePermission("STUDENT_IMPORT"), studentController.PreviewImportStudents)
				students.GET("/export", middleware.RequirePermission("STUDENT_EXPORT"), studentController.ExportStudents)
			}

			// 教工模块
			teachers := protected.Group("/teachers")
			{
				teachers.GET("", middleware.RequirePermission("TEACHER_MANAGE"), teacherController.GetTeachers)
				teachers.POST("", middleware.RequirePermission("TEACHER_MANAGE"), teacherController.CreateTeacher)
				teachers.PUT("/:id", middleware.RequirePermission("TEACHER_MANAGE"), teacherController.UpdateTeacher)
				teachers.DELETE("", middleware.RequirePermission("TEACHER_MANAGE"), teacherController.DeleteTeachers)
				teachers.POST("/import", middleware.RequirePermission("TEACHER_IMPORT"), teacherController.ImportTeachers)
				teachers.POST("/import/preview", middleware.RequirePermission("TEACHER_IMPORT"), teacherController.PreviewImportTeachers)
				teachers.GET("/export", middleware.RequirePermission("TEACHER_EXPORT"), teacherController.ExportTeachers)
			}

			// 楼栋管理模块
			buildings := protected.Group("/buildings")
			{
				buildings.GET("", middleware.RequirePermission("SYSTEM_SETTINGS"), buildingController.GetBuildingTable)
				buildings.GET("/all", middleware.RequirePermission("SYSTEM_SETTINGS"), infraController.GetBuildingsAll)
				buildings.GET("/export", middleware.RequirePermission("SYSTEM_SETTINGS"), buildingController.ExportBuildings)
				buildings.POST("", middleware.RequirePermission("SYSTEM_SETTINGS"), buildingController.CreateBuilding)
				buildings.POST("/import", middleware.RequirePermission("SYSTEM_SETTINGS"), buildingController.ImportBuildings)
				buildings.POST("/import/preview", middleware.RequirePermission("SYSTEM_SETTINGS"), buildingController.PreviewImportBuildings)
				buildings.PUT("/:id", middleware.RequirePermission("SYSTEM_SETTINGS"), buildingController.UpdateBuilding)
				buildings.DELETE("/:id", middleware.RequirePermission("SYSTEM_SETTINGS"), buildingController.DeleteBuilding)
				buildings.DELETE("/batch", middleware.RequirePermission("SYSTEM_SETTINGS"), buildingController.BatchDeleteBuildings)
			}

			// 角色模块
			roles := protected.Group("/roles")
			{
				roles.GET("", middleware.RequirePermission("PERMISSION_MANAGE"), roleController.GetRoles)
				roles.POST("", middleware.RequirePermission("PERMISSION_MANAGE"), roleController.CreateRole)
				roles.PUT("/:id", middleware.RequirePermission("PERMISSION_MANAGE"), roleController.UpdateRole)
				roles.PUT("/:id/status", middleware.RequirePermission("PERMISSION_MANAGE"), roleController.UpdateRoleStatus)
				roles.DELETE("/:id", middleware.RequirePermission("PERMISSION_MANAGE"), roleController.DeleteRole)
				roles.GET("/:id/data-scope", middleware.RequirePermission("PERMISSION_MANAGE"), permissionController.GetRoleDataScope)
				roles.PUT("/:id/data-scope", middleware.RequirePermission("PERMISSION_MANAGE"), permissionController.SaveRoleDataScope)
			}
			roleTypes := protected.Group("/role-types")
			{
				roleTypes.GET("", middleware.RequirePermission("PERMISSION_MANAGE"), roleController.GetRoleTypes)
				roleTypes.POST("", middleware.RequirePermission("PERMISSION_MANAGE"), roleController.CreateRoleType)
				roleTypes.PUT("/:id", middleware.RequirePermission("PERMISSION_MANAGE"), roleController.UpdateRoleType)
				roleTypes.PUT("/:id/status", middleware.RequirePermission("PERMISSION_MANAGE"), roleController.UpdateRoleTypeStatus)
				roleTypes.DELETE("/:id", middleware.RequirePermission("PERMISSION_MANAGE"), roleController.DeleteRoleType)
			}

			// 基础设施模块 - 宿舍相关
			protected.GET("/dorms", middleware.RequirePermission("DORM_VIEW"), infraController.GetDormitories)
			protected.GET("/dorm-beds", middleware.RequirePermission("DORM_VIEW"), infraController.GetDormBeds)

			// 前端兼容路由 - dorms 子路由
			occupancyController := controller.NewOccupancyController(db)
			dorms := protected.Group("/dorms")
			{
				dorms.GET("/buildings", middleware.RequirePermission("DORM_VIEW"), infraController.GetDormsBuildings)
				dorms.GET("/floors", middleware.RequirePermission("DORM_VIEW"), infraController.GetFloors)
				dorms.GET("/rooms", middleware.RequirePermission("DORM_VIEW"), infraController.GetRooms)
				dorms.GET("/find", middleware.RequirePermission("DORM_VIEW"), infraController.FindDorm) // 精确定位
				dorms.GET("/table", middleware.RequirePermission("DORM_VIEW"), infraController.GetDormsTable)
				dorms.GET("/stats", middleware.RequirePermission("DORM_VIEW"), occupancyController.GetStats)

				// 宿舍 CRUD
				dorms.POST("", middleware.RequirePermission("DORM_EDIT"), infraController.CreateDorm)
				dorms.PUT("/:id", middleware.RequirePermission("DORM_EDIT"), infraController.UpdateDorm)
				dorms.DELETE("", middleware.RequirePermission("DORM_EDIT"), infraController.DeleteDorms)
				dorms.GET("/:id/members", middleware.RequirePermission("DORM_VIEW"), infraController.GetDormMembers)

				// 兼容旧接口
				dorms.POST("/batch-delete", middleware.RequirePermission("DORM_EDIT"), infraController.DeleteDorms)
				dorms.POST("/import", middleware.RequirePermission("DORM_IMPORT"), infraController.ImportDorms)
				dorms.POST("/import/preview", middleware.RequirePermission("DORM_IMPORT"), infraController.PreviewImportDorms)
				dorms.GET("/export", middleware.RequirePermission("DORM_EXPORT"), infraController.ExportDorms)

				// 批量入住管理
				dorms.POST("/batch-checkout", middleware.RequirePermission("DORM_CHECKIN_MANAGE", "DORM_EDIT"), infraController.BatchCheckout)
				dorms.POST("/batch-checkout-students", middleware.RequirePermission("DORM_CHECKIN_MANAGE", "DORM_EDIT"), infraController.BatchCheckoutStudents)
				dorms.POST("/batch-checkin", middleware.RequirePermission("DORM_CHECKIN_MANAGE", "DORM_EDIT"), infraController.BatchCheckIn)
				dorms.POST("/import-checkin", middleware.RequirePermission("DORM_CHECKIN_MANAGE", "DORM_EDIT"), infraController.ImportCheckIn)
			}

			// v2 增强型导入接口
			v2Infra := protected.Group("/v2/infra")
			{
				v2Dorms := v2Infra.Group("/dorms")
				{
					v2Dorms.POST("/import/preview", middleware.RequirePermission("DORM_IMPORT"), infraController.PreviewImportDormsV2)
					v2Dorms.POST("/import/execute", middleware.RequirePermission("DORM_IMPORT"), infraController.ImportDormsV2)
					v2Dorms.POST("/import/execute-async", middleware.RequirePermission("DORM_IMPORT"), infraController.ImportDormsV2Async)
				}
				v2Buildings := v2Infra.Group("/buildings")
				{
					v2Buildings.POST("/import/preview", middleware.RequirePermission("SYSTEM_SETTINGS"), buildingController.PreviewImportBuildingsV2)
					v2Buildings.POST("/import/execute", middleware.RequirePermission("SYSTEM_SETTINGS"), buildingController.ImportBuildingsV2)
					v2Buildings.POST("/import/execute-async", middleware.RequirePermission("SYSTEM_SETTINGS"), buildingController.ImportBuildingsV2Async)
				}
			}

			// v2 学生导入接口
			v2Students := protected.Group("/v2/students")
			{
				v2Students.POST("/import/preview", middleware.RequirePermission("STUDENT_IMPORT"), studentController.PreviewImportStudentsV2)
				v2Students.POST("/import/execute", middleware.RequirePermission("STUDENT_IMPORT"), studentController.ImportStudentsV2)
				v2Students.POST("/import/execute-async", middleware.RequirePermission("STUDENT_IMPORT"), studentController.ImportStudentsV2Async)
			}

			v2Teachers := protected.Group("/v2/teachers")
			{
				v2Teachers.POST("/import/preview", middleware.RequirePermission("TEACHER_IMPORT"), teacherController.PreviewImportTeachersV2)
				v2Teachers.POST("/import/execute", middleware.RequirePermission("TEACHER_IMPORT"), teacherController.ImportTeachersV2)
				v2Teachers.POST("/import/execute-async", middleware.RequirePermission("TEACHER_IMPORT"), teacherController.ImportTeachersV2Async)
			}

			// v2 入住导入接口
			v2Occupancy := protected.Group("/v2/occupancy")
			{
				v2Occupancy.POST("/import/preview", middleware.RequirePermission("DORM_CHECKIN_MANAGE", "DORM_EDIT"), occupancyController.PreviewImportOccupancyV2)
				v2Occupancy.POST("/import/execute", middleware.RequirePermission("DORM_CHECKIN_MANAGE", "DORM_EDIT"), occupancyController.ImportOccupancyV2)
				v2Occupancy.POST("/import/execute-async", middleware.RequirePermission("DORM_CHECKIN_MANAGE", "DORM_EDIT"), occupancyController.ImportOccupancyV2Async)
			}

			// 导入任务进度查询（通用）
			importTaskController := controller.NewImportTaskController()
			protected.GET("/import/progress/:jobId", importTaskController.GetProgress)

			// 入住管理模块
			occupancy := protected.Group("/occupancy")
			{
				occupancy.GET("/stats", middleware.RequirePermission("DORM_VIEW"), occupancyController.GetStats)
				occupancy.POST("/assign", middleware.RequirePermission("DORM_CHECKIN_MANAGE", "DORM_EDIT"), occupancyController.AssignBed)
				occupancy.POST("/move", middleware.RequirePermission("DORM_CHECKIN_MANAGE", "DORM_EDIT"), occupancyController.MoveBed)
				occupancy.POST("/swap", middleware.RequirePermission("DORM_CHECKIN_MANAGE", "DORM_EDIT"), occupancyController.SwapBed)
				occupancy.POST("/checkout", middleware.RequirePermission("DORM_CHECKIN_MANAGE", "DORM_EDIT"), occupancyController.CheckoutStudent)
			}

			// 任务模块
			tasks := protected.Group("/tasks")
			{
				tasks.POST("", middleware.RequirePermission("TASK_PUBLISH"), taskController.CreateTask)
				tasks.GET("", middleware.RequirePermission("TASK_PUBLISH", "TASK_EDIT", "TASK_DELETE", "RESULT_RECORD", "RESULT_VIEW"), taskController.GetTasks)
				tasks.GET("/:id", middleware.RequirePermission("TASK_PUBLISH", "TASK_EDIT", "TASK_DELETE", "RESULT_RECORD", "RESULT_VIEW"), taskController.GetTaskByID)
				tasks.PUT("/:id", middleware.RequirePermission("TASK_EDIT"), taskController.UpdateTask)
				tasks.DELETE("/:id", middleware.RequirePermission("TASK_DELETE"), taskController.DeleteTask)
				tasks.POST("/:id/inspections", middleware.RequirePermission("RESULT_RECORD"), taskController.SubmitTaskInspection) // 新增查寝结果提交接口
				tasks.GET("/:id/dorms/my", middleware.RequirePermission("RESULT_RECORD"), taskController.GetMyAssignedDorms)       // 移动端分配宿舍
				// 兼容路由：GET /api/tasks/:id/inspections -> 获取任务的查寝结果
				tasks.GET("/:id/inspections", middleware.RequirePermission("RESULT_VIEW", "RESULT_RECORD"), func(c *gin.Context) {
					taskId := c.Param("id")
					c.Request.URL.RawQuery = "taskId=" + taskId + "&" + c.Request.URL.RawQuery
					inspectionController.GetInspections(c)
				})
			}

			// 查寝模块
			inspections := protected.Group("/inspections")
			{
				inspections.GET("", middleware.RequirePermission("RESULT_VIEW", "RESULT_RECORD"), inspectionController.GetInspections)
				inspections.GET("/mine", middleware.RequirePermission("RESULT_RECORD"), inspectionController.GetMyInspections) // 移动端我的检查
				inspections.PUT("/:id", middleware.RequirePermission("RESULT_RECORD"), inspectionController.SubmitResult)
				inspections.POST("/:id", middleware.RequirePermission("RESULT_RECORD"), inspectionController.SubmitResult)    // 兼容前端可能使用的 POST
				inspections.GET("/export", middleware.RequirePermission("RESULT_EXPORT"), inspectionController.ExportResults) // 导出
			}

			// 申诉模块
			appeals := protected.Group("/appeals")
			{
				appeals.POST("", appealController.Create)
				appeals.GET("/mine", appealController.GetMyAppeals)
				appeals.POST("/photos", appealController.UploadPhoto)
				appeals.GET("", middleware.RequirePermission("APPEAL_VIEW"), appealController.GetAppeals)
				appeals.GET("/stats", middleware.RequirePermission("APPEAL_VIEW"), appealController.GetStats)
				appeals.PUT("/batch/status", middleware.RequirePermission("APPEAL_HANDLE"), appealController.BatchUpdateStatus)
				appeals.GET("/:id", middleware.RequirePermission("APPEAL_VIEW"), appealController.GetDetail)
				appeals.GET("/:id/deductions", middleware.RequirePermission("APPEAL_HANDLE"), appealController.GetDeductions)
				appeals.GET("/:id/photos/:photoId", appealController.GetPhoto)
				appeals.PUT("/:id/status", middleware.RequirePermission("APPEAL_HANDLE"), appealController.UpdateStatus)
				appeals.PUT("/:id/withdraw", appealController.Withdraw)
			}

			// 看板统计
			protected.GET("/dashboard/summary", dashboardController.GetSummary)

			// 系统设置
			protected.GET("/settings", settingController.GetSettings)
			protected.PUT("/settings", middleware.RequirePermission("SYSTEM_SETTINGS"), settingController.UpdateSettings)

			// 审计日志
			protected.GET("/audit-logs", middleware.RequirePermission("PERMISSION_MANAGE"), auditController.GetLogs)
			protected.GET("/audit-logs/stats", middleware.RequirePermission("PERMISSION_MANAGE"), auditController.GetStats)
			protected.GET("/audit-logs/options", middleware.RequirePermission("PERMISSION_MANAGE"), auditController.GetOptions)
			protected.DELETE("/audit-logs", middleware.RequirePermission("PERMISSION_MANAGE"), auditController.DeleteLogs)

			// 表格配置
			tableConfigController := controller.NewTableConfigController(db)
			protected.GET("/table-config", tableConfigController.GetConfig)
			protected.PUT("/table-config", tableConfigController.SaveConfig)

			// 文件上传
			protected.POST("/uploads", middleware.RequirePermission("RESULT_RECORD"), uploadController.UploadFile)
			protected.POST("/uploads/batch", middleware.RequirePermission("RESULT_RECORD"), uploadController.UploadBatch)
			// 头像上传（仅需登录，无功能权限要求）
			protected.POST("/uploads/avatar", avatarController.UploadAvatar)

			// 导入模板
			templateController := controller.NewTemplateController()
			protected.GET("/templates/:type", templateController.GetTemplate)

			// --- 认证相关路由（已重构到 AuthController）---
			protected.GET("/auth/me", authController.GetMe)
			protected.POST("/auth/logout", authController.Logout)

			// 权限模块
			protected.GET("/permissions/me", permissionController.GetMyPermissions)
			protected.GET("/permissions/roles", middleware.RequirePermission("PERMISSION_MANAGE"), permissionController.GetRoleMatrix)
			protected.PUT("/permissions/roles/:roleId", middleware.RequirePermission("PERMISSION_MANAGE"), permissionController.UpdateRolePermissions)
			protected.GET("/permissions/users/:userId", middleware.RequirePermission("PERMISSION_MANAGE"), permissionController.GetUserOverrides)
			protected.PUT("/permissions/users/:userId", middleware.RequirePermission("PERMISSION_MANAGE"), permissionController.UpdateUserOverrides)
			protected.PUT("/permissions/batch-overrides", middleware.RequirePermission("PERMISSION_MANAGE"), permissionController.BatchUpdateUserOverrides)
			// 账号单独数据范围（存在时覆盖角色范围）与数据范围可选项
			protected.GET("/permissions/users/:userId/data-scope", middleware.RequirePermission("PERMISSION_MANAGE"), permissionController.GetUserDataScope)
			protected.PUT("/permissions/users/:userId/data-scope", middleware.RequirePermission("PERMISSION_MANAGE"), permissionController.SaveUserDataScope)
			protected.DELETE("/permissions/users/:userId/data-scope", middleware.RequirePermission("PERMISSION_MANAGE"), permissionController.DeleteUserDataScope)
			protected.GET("/permissions/scope-options", middleware.RequirePermission("PERMISSION_MANAGE"), permissionController.GetScopeOptions)

			// 兼容旧版的测试路由
			protected.GET("/me", authController.GetMe)
		}
	}

	// 健康检查
	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status": "ok",
			"system": "go-backend",
		})
	})

	return r
}
