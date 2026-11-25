package service

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
	"github.com/my-project/backend-go/internal/model"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

// 操作类型常量
const (
	AuditActionCreate           = "CREATE"
	AuditActionUpdate           = "UPDATE"
	AuditActionDelete           = "DELETE"
	AuditActionLogin            = "LOGIN"
	AuditActionLogout           = "LOGOUT"
	AuditActionLoginFailed      = "LOGIN_FAILED"
	AuditActionPermissionChange = "PERMISSION_CHANGE"
	AuditActionPasswordReset    = "PASSWORD_RESET"
	AuditActionDisable          = "DISABLE"
	AuditActionEnable           = "ENABLE"
	AuditActionImport           = "IMPORT"
	AuditActionExport           = "EXPORT"
)

// 模块常量
const (
	AuditModuleUser       = "USER"
	AuditModuleDorm       = "DORM"
	AuditModuleStudent    = "STUDENT"
	AuditModuleTeacher    = "TEACHER"
	AuditModuleTask       = "TASK"
	AuditModuleInspection = "INSPECTION"
	AuditModulePermission = "PERMISSION"
	AuditModuleRole       = "ROLE"
	AuditModuleSettings   = "SETTINGS"
	AuditModuleAuth       = "AUTH"
)

// AuditService 审计日志服务接口
type AuditService interface {
	Log(params AuditLogParams) error
}

// AuditLogParams 审计日志参数
type AuditLogParams struct {
	Action       string      // 操作类型
	Module       string      // 模块名称
	TargetID     string      // 被操作资源ID
	TargetName   string      // 被操作资源名称
	Description  string      // 操作描述
	OldValue     interface{} // 变更前的值
	NewValue     interface{} // 变更后的值
	OperatorID   string      // 操作者ID
	OperatorName string      // 操作者名称
	IPAddress    string      // IP地址
	UserAgent    string      // 用户代理
}

type auditService struct {
	db *gorm.DB
}

// NewAuditService 创建审计日志服务
func NewAuditService(db *gorm.DB) AuditService {
	return &auditService{db: db}
}

// Log 记录审计日志
func (s *auditService) Log(params AuditLogParams) error {
	// 创建基础日志对象，仅在主协程生成必要 ID 和时间
	// 避免在主协程进行数据库查询或复杂的序列化
	now := time.Now()
	id := uuid.New().String()

	// 异步处理：获取名称、序列化数据并写入数据库
	go func() {
		if err := s.write(params, now, id, false); err != nil {
			println("Failed to create audit log async:", err.Error())
		}
	}()
	return nil
}

func (s *auditService) write(params AuditLogParams, now time.Time, id string, strict bool) error {
	operatorName := params.OperatorName
	// 如果 OperatorName 为空或无效，尝试从数据库查询
	if operatorName == "" || operatorName == "<nil>" || operatorName == "%!v(MISSING)" {
		if params.OperatorID != "" && params.OperatorID != "<nil>" {
			var user model.User
			// 仅查询 FullName 字段
			if err := s.db.Select("fullName").Where("id = ?", params.OperatorID).First(&user).Error; err == nil {
				operatorName = user.FullName
			}
		}
		if operatorName == "" {
			operatorName = "系统"
		}
	}

	// 处理可选字段的 nil 值，避免违反外键约束 (空字符串 != NULL)
	var targetIDPtr, operatorIDPtr, ipAddressPtr, userAgentPtr, targetNamePtr, descriptionPtr, operatorNamePtr *string

	if params.TargetID != "" {
		tID := params.TargetID
		targetIDPtr = &tID
	}
	if params.TargetName != "" {
		tName := params.TargetName
		targetNamePtr = &tName
	}
	if params.Description != "" {
		desc := params.Description
		descriptionPtr = &desc
	}
	if params.OperatorID != "" && params.OperatorID != "<nil>" {
		oID := params.OperatorID
		operatorIDPtr = &oID
	}
	if operatorName != "" {
		oName := operatorName
		operatorNamePtr = &oName
	}
	if params.IPAddress != "" {
		ip := params.IPAddress
		ipAddressPtr = &ip
	}
	if params.UserAgent != "" {
		ua := params.UserAgent
		userAgentPtr = &ua
	}

	logEntry := model.AuditLog{
		ID:           id,
		Action:       params.Action,
		Module:       params.Module,
		TargetID:     targetIDPtr,
		TargetName:   targetNamePtr,
		Description:  descriptionPtr,
		OperatorID:   operatorIDPtr,
		OperatorName: operatorNamePtr,
		IPAddress:    ipAddressPtr,
		UserAgent:    userAgentPtr,
		CreatedAt:    now,
	}

	// 序列化 OldValue 和 NewValue
	if params.OldValue != nil {
		data, err := json.Marshal(params.OldValue)
		if err != nil && strict {
			return err
		}
		logEntry.OldValue = datatypes.JSON(data)
	}
	if params.NewValue != nil {
		data, err := json.Marshal(params.NewValue)
		if err != nil && strict {
			return err
		}
		logEntry.NewValue = datatypes.JSON(data)
	}

	return s.db.Create(&logEntry).Error
}

// 全局审计服务实例（方便在各处调用）
var globalAuditService AuditService

// InitGlobalAuditService 初始化全局审计服务
func InitGlobalAuditService(db *gorm.DB) {
	globalAuditService = NewAuditService(db)
}

// LogAudit 全局快捷函数
func LogAudit(params AuditLogParams) {
	if globalAuditService != nil {
		globalAuditService.Log(params)
	}
}
