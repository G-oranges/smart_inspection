package model

import (
	"time"

	"gorm.io/datatypes"
)

// Role 枚举
const (
	RoleAdmin     = "ADMIN"
	RoleCounselor = "COUNSELOR"
	RoleLeader    = "LEADER"
	RoleStudent   = "STUDENT"
)

// AppealStatus 枚举
const (
	AppealPending  = "pending"
	AppealApproved = "approved"
	AppealRejected = "rejected"
)

// BedStatus 枚举
const (
	BedAvailable   = "available"
	BedOccupied    = "occupied"
	BedMaintenance = "maintenance"
)

// RoleEntity 模型
type RoleEntity struct {
	ID          string           `gorm:"column:id;primaryKey;type:char(36)" json:"id"`
	Code        string           `gorm:"column:code;unique;not null" json:"code"`
	Name        string           `gorm:"column:name;not null" json:"name"`
	TypeCode    string           `gorm:"column:typeCode;size:32;default:'SYSTEM'" json:"typeCode"`
	TypeName    string           `gorm:"-" json:"typeName,omitempty"`
	Description *string          `gorm:"column:description;type:text" json:"description"`
	IsSystem    bool             `gorm:"column:isSystem;default:false" json:"isSystem"`
	Sort        int              `gorm:"column:sort;default:100" json:"sort"`
	Status      string           `gorm:"column:status;size:16;default:'ACTIVE'" json:"status"`
	CreatedAt   time.Time        `gorm:"column:createdAt;autoCreateTime" json:"createdAt"`
	UpdatedAt   time.Time        `gorm:"column:updatedAt;autoUpdateTime" json:"updatedAt"`
	Permissions []RolePermission `gorm:"foreignKey:RoleID" json:"permissions,omitempty"`
	// Join table columns follow the legacy Prisma layout: A = roleentity.id, B = user.id.
	Users        []User         `gorm:"many2many:_roleentitytouser;joinForeignKey:A;joinReferences:B" json:"users,omitempty"`
	TableConfigs []TableConfig  `gorm:"foreignKey:RoleID" json:"tableConfigs,omitempty"`
	DataScope    *RoleDataScope `gorm:"foreignKey:RoleID" json:"dataScope,omitempty"`
}

func (RoleEntity) TableName() string {
	return "roleentity"
}

// RoleType 角色类型模型
type RoleType struct {
	ID          string    `gorm:"column:id;primaryKey;type:char(36)" json:"id"`
	Code        string    `gorm:"column:code;unique;not null" json:"code"`
	Name        string    `gorm:"column:name;not null" json:"name"`
	Description *string   `gorm:"column:description;type:text" json:"description"`
	IsSystem    bool      `gorm:"column:isSystem;default:false" json:"isSystem"`
	Sort        int       `gorm:"column:sort;default:100" json:"sort"`
	Status      string    `gorm:"column:status;size:16;default:'ACTIVE'" json:"status"`
	CreatedAt   time.Time `gorm:"column:createdAt;autoCreateTime" json:"createdAt"`
	UpdatedAt   time.Time `gorm:"column:updatedAt;autoUpdateTime" json:"updatedAt"`
}

func (RoleType) TableName() string {
	return "roletype"
}

// Permission 模型
type Permission struct {
	ID        string                   `gorm:"column:id;primaryKey;type:char(36)" json:"id"`
	Code      string                   `gorm:"column:code;unique;not null" json:"code"`
	Name      string                   `gorm:"column:name;not null" json:"name"`
	Module    string                   `gorm:"column:module;not null" json:"module"`
	Roles     []RolePermission         `gorm:"foreignKey:PermissionID" json:"roles,omitempty"`
	Overrides []UserPermissionOverride `gorm:"foreignKey:PermissionID" json:"overrides,omitempty"`
}

func (Permission) TableName() string {
	return "permission"
}

// RolePermission 模型
type RolePermission struct {
	ID           string     `gorm:"column:id;primaryKey;type:char(36)" json:"id"`
	RoleID       string     `gorm:"column:roleId;type:char(36);uniqueIndex:idx_role_permission" json:"roleId"`
	Role         RoleEntity `gorm:"foreignKey:RoleID" json:"role,omitempty"`
	PermissionID string     `gorm:"column:permissionId;type:char(36);uniqueIndex:idx_role_permission" json:"permissionId"`
	Permission   Permission `gorm:"foreignKey:PermissionID" json:"permission,omitempty"`
}

func (RolePermission) TableName() string {
	return "rolepermission"
}

// RoleDataScope 模型
type RoleDataScope struct {
	ID         string         `gorm:"column:id;primaryKey;type:char(36)" json:"id"`
	RoleID     string         `gorm:"column:roleId;type:char(36);uniqueIndex:idx_role_data_scope" json:"roleId"`
	Role       RoleEntity     `gorm:"foreignKey:RoleID" json:"role,omitempty"`
	ScopeMode  string         `gorm:"column:scopeMode;size:32;default:'ALL'" json:"scopeMode"`
	PresetCode string         `gorm:"column:presetCode;size:32;default:'ALL'" json:"presetCode"`
	RulesJSON  datatypes.JSON `gorm:"column:rulesJson;type:json" json:"rules"`
	UpdatedBy  *string        `gorm:"column:updatedBy;type:char(36)" json:"updatedBy"`
	CreatedAt  time.Time      `gorm:"column:createdAt;autoCreateTime" json:"createdAt"`
	UpdatedAt  time.Time      `gorm:"column:updatedAt;autoUpdateTime" json:"updatedAt"`
}

func (RoleDataScope) TableName() string {
	return "roledatascope"
}

// UserDataScope 给单个账号单独设置的数据范围；存在时以它为准，不再按角色计算。
type UserDataScope struct {
	ID        string         `gorm:"column:id;primaryKey;type:char(36)" json:"id"`
	UserID    string         `gorm:"column:userId;type:char(36);uniqueIndex:idx_user_data_scope" json:"userId"`
	ScopeMode string         `gorm:"column:scopeMode;size:32;not null" json:"scopeMode"`
	RulesJSON datatypes.JSON `gorm:"column:rulesJson;type:json" json:"rules"`
	UpdatedBy *string        `gorm:"column:updatedBy;type:char(36)" json:"updatedBy"`
	CreatedAt time.Time      `gorm:"column:createdAt;autoCreateTime" json:"createdAt"`
	UpdatedAt time.Time      `gorm:"column:updatedAt;autoUpdateTime" json:"updatedAt"`
}

func (UserDataScope) TableName() string {
	return "userdatascope"
}

// AppMigration 记录已执行过的一次性数据迁移，防止重复执行。
type AppMigration struct {
	Name      string    `gorm:"column:name;primaryKey;size:128" json:"name"`
	AppliedAt time.Time `gorm:"column:appliedAt;autoCreateTime" json:"appliedAt"`
}

func (AppMigration) TableName() string {
	return "appmigration"
}

// UserPermissionOverride 模型
type UserPermissionOverride struct {
	ID           string     `gorm:"column:id;primaryKey;type:char(36)" json:"id"`
	UserID       string     `gorm:"column:userId;type:char(36);uniqueIndex:idx_user_permission" json:"userId"`
	User         User       `gorm:"foreignKey:UserID" json:"user,omitempty"`
	PermissionID string     `gorm:"column:permissionId;type:char(36);uniqueIndex:idx_user_permission" json:"permissionId"`
	Permission   Permission `gorm:"foreignKey:PermissionID" json:"permission,omitempty"`
	// No GORM default here: with default:true, GORM would turn an explicit false (deny) into true.
	Allow bool `gorm:"column:allow" json:"allow"`
}

func (UserPermissionOverride) TableName() string {
	return "userpermissionoverride"
}

// User 模型
type User struct {
	ID                  string                   `gorm:"column:id;primaryKey;type:char(36)" json:"id"`
	Username            string                   `gorm:"column:username;unique;not null" json:"username"`
	Password            string                   `gorm:"column:password;not null" json:"-"`
	Role                string                   `gorm:"column:role;not null" json:"role"`
	FullName            string                   `gorm:"column:fullName;not null" json:"fullName"`
	Email               *string                  `gorm:"column:email" json:"email"`
	Phone               *string                  `gorm:"column:phone" json:"phone"`
	Department          *string                  `gorm:"column:department" json:"department"`
	IsDisabled          bool                     `gorm:"column:isDisabled;default:false" json:"isDisabled"`
	TokenVersion        int                      `gorm:"column:tokenVersion;default:1" json:"-"` // Token 版本号，禁用/改密时递增
	MustChangePassword  bool                     `gorm:"column:mustChangePassword;not null;default:false" json:"mustChangePassword"`
	UserType            *string                  `gorm:"column:userType" json:"userType"`
	Dorm                *Dormitory               `gorm:"foreignKey:DormID" json:"dorm,omitempty"`
	DormID              *string                  `gorm:"column:dormId;type:char(36)" json:"dormId"`
	CreatedAt           time.Time                `gorm:"column:createdAt;autoCreateTime" json:"createdAt"`
	Students            []Student                `gorm:"foreignKey:UserID" json:"students,omitempty"`
	Tasks               []Task                   `gorm:"foreignKey:CreatedByID" json:"tasks,omitempty"`
	PermissionOverrides []UserPermissionOverride `gorm:"foreignKey:UserID" json:"permissionOverrides,omitempty"`
	CreatedInspections  []Inspection             `gorm:"foreignKey:CreatedByID" json:"createdInspections,omitempty"`
	ReviewedInspections []Inspection             `gorm:"foreignKey:ReviewedByID" json:"reviewedInspections,omitempty"`
	ExecutorTasks       []TaskExecutor           `gorm:"foreignKey:ExecutorID" json:"executorTasks,omitempty"`
	ExecutorDorms       []TaskExecutorDorm       `gorm:"foreignKey:ExecutorID" json:"executorDorms,omitempty"`
	// Join table columns follow the legacy Prisma layout: A = roleentity.id, B = user.id.
	Roles        []RoleEntity  `gorm:"many2many:_roleentitytouser;joinForeignKey:B;joinReferences:A" json:"roles,omitempty"`
	TableConfigs []TableConfig `gorm:"foreignKey:UserID" json:"tableConfigs,omitempty"`
	AuditLogs    []AuditLog    `gorm:"foreignKey:OperatorID" json:"auditLogs,omitempty"`
	AvatarURL    *string       `gorm:"column:avatarUrl;type:varchar(512)" json:"avatarUrl"`
}

func (User) TableName() string {
	return "user"
}

// Dormitory 模型
type Dormitory struct {
	ID                  string             `gorm:"column:id;primaryKey;type:char(36)" json:"id"`
	Campus              *string            `gorm:"column:campus" json:"campus"`
	Building            *string            `gorm:"column:building" json:"building"`
	Floor               *int               `gorm:"column:floor" json:"floor"`
	RoomNo              *string            `gorm:"column:roomNo" json:"roomNo"`
	Capacity            *int               `gorm:"column:capacity" json:"capacity"`
	Gender              *string            `gorm:"column:gender" json:"gender"`
	Grade               *string            `gorm:"column:grade" json:"grade"`
	CounselorID         *string            `gorm:"column:counselorId" json:"counselorId"`
	CreatedAt           time.Time          `gorm:"column:createdAt;autoCreateTime" json:"createdAt"`
	Beds                []DormBed          `gorm:"foreignKey:DormID" json:"beds,omitempty"`
	Students            []Student          `gorm:"foreignKey:DormID" json:"students,omitempty"`
	Users               []User             `gorm:"foreignKey:DormID" json:"users,omitempty"`
	Tasks               []TaskDorm         `gorm:"foreignKey:DormID" json:"tasks,omitempty"`
	Inspections         []Inspection       `gorm:"foreignKey:DormID" json:"inspections,omitempty"`
	ExecutorAssignments []TaskExecutorDorm `gorm:"foreignKey:DormID" json:"executorAssignments,omitempty"`
	BuildingRef         *Building          `gorm:"foreignKey:BuildingID" json:"buildingRef,omitempty"`
	BuildingID          *int               `gorm:"column:buildingId" json:"buildingId"`
	Version             int                `gorm:"column:version;default:1" json:"version"`
}

func (Dormitory) TableName() string {
	return "dormitory"
}

// Building 模型
type Building struct {
	ID          int         `gorm:"column:id;primaryKey;autoIncrement" json:"id"`
	Name        string      `gorm:"column:name;unique;not null" json:"name"`
	Campus      string      `gorm:"column:campus;not null" json:"campus"`
	Type        *string     `gorm:"column:type" json:"type"`
	ContactInfo *string     `gorm:"column:contactInfo" json:"contactInfo"`
	Floors      int         `gorm:"column:floors;not null" json:"floors"`
	HasElevator bool        `gorm:"column:hasElevator;default:false" json:"hasElevator"`
	Dorms       []Dormitory `gorm:"foreignKey:BuildingID" json:"dorms,omitempty"`
	CreatedAt   time.Time   `gorm:"column:createdAt;autoCreateTime" json:"createdAt"`
	UpdatedAt   time.Time   `gorm:"column:updatedAt;autoUpdateTime" json:"updatedAt"`
}

func (Building) TableName() string {
	return "building"
}

// DormBed 模型
type DormBed struct {
	ID        string    `gorm:"column:id;primaryKey;type:char(36)" json:"id"`
	Dorm      Dormitory `gorm:"foreignKey:DormID" json:"dorm,omitempty"`
	DormID    string    `gorm:"column:dormId;type:char(36);uniqueIndex:idx_dorm_bed" json:"dormId"`
	BedNo     string    `gorm:"column:bedNo;uniqueIndex:idx_dorm_bed" json:"bedNo"`
	Student   *Student  `gorm:"foreignKey:StudentID" json:"student,omitempty"`
	StudentID *string   `gorm:"column:studentId;type:char(36);unique" json:"studentId"`
	Status    string    `gorm:"column:status;default:'available'" json:"status"`
}

func (DormBed) TableName() string {
	return "dormbed"
}

// ResidencyLog 模型
type ResidencyLog struct {
	ID        int       `gorm:"column:id;primaryKey;autoIncrement" json:"id"`
	StudentID string    `gorm:"column:studentId;type:char(36)" json:"studentId"`
	Type      string    `gorm:"column:type" json:"type"`
	PrevDorm  *string   `gorm:"column:prevDorm" json:"prevDorm"`
	CurrDorm  *string   `gorm:"column:currDorm" json:"currDorm"`
	Operator  string    `gorm:"column:operator" json:"operator"`
	Reason    *string   `gorm:"column:reason" json:"reason"`
	CreatedAt time.Time `gorm:"column:createdAt;autoCreateTime" json:"createdAt"`
	Student   Student   `gorm:"foreignKey:StudentID" json:"student,omitempty"`
}

func (ResidencyLog) TableName() string {
	return "residencylog"
}

// Student 模型
type Student struct {
	ID              string         `gorm:"column:id;primaryKey;type:char(36)" json:"id"`
	StudentNo       *string        `gorm:"column:studentNo;unique" json:"studentNo"`
	FullName        string         `gorm:"column:fullName;not null" json:"fullName"`
	Grade           *string        `gorm:"column:grade" json:"grade"`
	Gender          *string        `gorm:"column:gender" json:"gender"`
	EducationLevel  *string        `gorm:"column:educationLevel" json:"educationLevel"`
	College         *string        `gorm:"column:college" json:"college"`
	Major           *string        `gorm:"column:major" json:"major"`
	ClassName       *string        `gorm:"column:className" json:"className"`
	Status          *string        `gorm:"column:status" json:"status"`
	Dorm            *Dormitory     `gorm:"foreignKey:DormID" json:"dorm,omitempty"`
	DormID          *string        `gorm:"column:dormId;type:char(36)" json:"dormId"`
	DormBuilding    *string        `gorm:"column:building" json:"building"`
	DormRoomNo      *string        `gorm:"column:roomNo" json:"roomNo"`
	BedNo           *string        `gorm:"column:bedNo" json:"bedNo"`
	Phone           *string        `gorm:"column:phone" json:"phone"`
	Mobile          *string        `gorm:"column:mobile" json:"mobile"`
	QQ              *string        `gorm:"column:qq" json:"qq"`
	IDType          *string        `gorm:"column:idType" json:"idType"`
	IDNumber        *string        `gorm:"column:idNumber" json:"idNumber"`
	PoliticalStatus *string        `gorm:"column:politicalStatus" json:"politicalStatus"`
	BirthDate       *time.Time     `gorm:"column:birthDate" json:"birthDate"`
	Ethnicity       *string        `gorm:"column:ethnicity" json:"ethnicity"`
	NativePlace     *string        `gorm:"column:nativePlace" json:"nativePlace"`
	SourcePlace     *string        `gorm:"column:sourcePlace" json:"sourcePlace"`
	HomeAddress     *string        `gorm:"column:homeAddress" json:"homeAddress"`
	IsMonitor       bool           `gorm:"column:isMonitor;default:false" json:"isMonitor"`
	User            *User          `gorm:"foreignKey:UserID" json:"user,omitempty"`
	UserID          *string        `gorm:"column:userId;type:char(36)" json:"userId"`
	CreatedAt       time.Time      `gorm:"column:createdAt;autoCreateTime" json:"createdAt"`
	Appeals         []Appeal       `gorm:"foreignKey:StudentID" json:"appeals,omitempty"`
	Bed             *DormBed       `gorm:"foreignKey:StudentID" json:"bed,omitempty"`
	ResidencyLogs   []ResidencyLog `gorm:"foreignKey:StudentID" json:"residencyLogs,omitempty"`
}

func (Student) TableName() string {
	return "student"
}

// Teacher 模型
type Teacher struct {
	ID         string    `gorm:"column:id;primaryKey;type:char(36)" json:"id"`
	FullName   string    `gorm:"column:fullName;not null" json:"fullName"`
	EmployeeNo *string   `gorm:"column:employeeNo;unique" json:"employeeNo"`
	Gender     *string   `gorm:"column:gender" json:"gender"`
	Department *string   `gorm:"column:department" json:"department"`
	Mobile     *string   `gorm:"column:mobile" json:"mobile"`
	Classes    *string   `gorm:"column:classes" json:"classes"`
	CreatedAt  time.Time `gorm:"autoCreateTime" json:"createdAt"`
	UpdatedAt  time.Time `gorm:"autoUpdateTime" json:"updatedAt"`
}

func (Teacher) TableName() string {
	return "teacher"
}

// Task 模型
type Task struct {
	ID             string             `gorm:"column:id;primaryKey;type:char(36)" json:"id"`
	Title          string             `gorm:"column:title;not null" json:"title"`
	Date           *time.Time         `gorm:"column:date" json:"date"`
	TimeSlot       *string            `gorm:"column:timeSlot" json:"timeSlot"`
	Executor       *string            `gorm:"column:executor" json:"executor"`
	Notes          *string            `gorm:"column:notes" json:"notes"`
	Description    *string            `gorm:"column:description" json:"description"`
	Deadline       *time.Time         `gorm:"column:deadline" json:"deadline"`
	Status         *string            `gorm:"column:status;default:'scheduled'" json:"status"`
	RoleRequired   *string            `gorm:"column:roleRequired" json:"roleRequired"`
	ScoringItems   datatypes.JSON     `gorm:"column:scoringItems" json:"scoringItems"`
	CreatedBy      *User              `gorm:"foreignKey:CreatedByID" json:"createdBy,omitempty"`
	CreatedByID    *string            `gorm:"column:createdById;type:char(36)" json:"createdById"`
	CreatedAt      time.Time          `gorm:"column:createdAt;autoCreateTime" json:"createdAt"`
	UpdatedAt      time.Time          `gorm:"column:updatedAt;autoUpdateTime" json:"updatedAt"`
	Dorms          []TaskDorm         `gorm:"foreignKey:TaskID" json:"dorms,omitempty"`
	Inspections    []Inspection       `gorm:"foreignKey:TaskID" json:"inspections,omitempty"`
	Executors      []TaskExecutor     `gorm:"foreignKey:TaskID" json:"executors,omitempty"`
	ExecutorDorms  []TaskExecutorDorm `gorm:"foreignKey:TaskID" json:"executorDorms,omitempty"`
	InspectedCount int                `gorm:"-" json:"inspectedCount"` // 虚拟字段，用于汇总统计
}

func (Task) TableName() string {
	return "task"
}

// TaskDorm 模型
type TaskDorm struct {
	ID     string    `gorm:"column:id;primaryKey;type:char(36)" json:"id"`
	Task   Task      `gorm:"foreignKey:TaskID" json:"task,omitempty"`
	TaskID string    `gorm:"column:taskId;type:char(36);uniqueIndex:idx_task_dorm" json:"taskId"`
	Dorm   Dormitory `gorm:"foreignKey:DormID" json:"dorm,omitempty"`
	DormID string    `gorm:"column:dormId;type:char(36);uniqueIndex:idx_task_dorm" json:"dormId"`
}

func (TaskDorm) TableName() string {
	return "taskdorm"
}

// TaskExecutor 模型
type TaskExecutor struct {
	ID         string    `gorm:"column:id;primaryKey;type:char(36)" json:"id"`
	Task       Task      `gorm:"foreignKey:TaskID" json:"task,omitempty"`
	TaskID     string    `gorm:"column:taskId;type:char(36);uniqueIndex:idx_task_executor" json:"taskId"`
	Executor   User      `gorm:"foreignKey:ExecutorID" json:"executor,omitempty"`
	ExecutorID string    `gorm:"column:executorId;type:char(36);uniqueIndex:idx_task_executor" json:"executorId"`
	CreatedAt  time.Time `gorm:"column:createdAt;autoCreateTime" json:"createdAt"`
}

func (TaskExecutor) TableName() string {
	return "taskexecutor"
}

// TaskExecutorDorm 模型
type TaskExecutorDorm struct {
	ID         string    `gorm:"column:id;primaryKey;type:char(36)" json:"id"`
	Task       Task      `gorm:"foreignKey:TaskID" json:"task,omitempty"`
	TaskID     string    `gorm:"column:taskId;type:char(36);uniqueIndex:idx_task_executor_dorm" json:"taskId"`
	Executor   User      `gorm:"foreignKey:ExecutorID" json:"executor,omitempty"`
	ExecutorID string    `gorm:"column:executorId;type:char(36);uniqueIndex:idx_task_executor_dorm" json:"executorId"`
	Dorm       Dormitory `gorm:"foreignKey:DormID" json:"dorm,omitempty"`
	DormID     string    `gorm:"column:dormId;type:char(36);uniqueIndex:idx_task_executor_dorm" json:"dormId"`
}

func (TaskExecutorDorm) TableName() string {
	return "taskexecutordorm"
}

// Inspection 模型
type Inspection struct {
	ID           string         `gorm:"column:id;primaryKey;type:char(36)" json:"id"`
	Task         *Task          `gorm:"foreignKey:TaskID" json:"task,omitempty"`
	TaskID       *string        `gorm:"column:taskId;type:char(36)" json:"taskId"`
	Dorm         *Dormitory     `gorm:"foreignKey:DormID" json:"dorm,omitempty"`
	DormID       *string        `gorm:"column:dormId;type:char(36)" json:"dormId"`
	DormColleges []string       `gorm:"-" json:"dormColleges,omitempty"`
	DormGrades   []string       `gorm:"-" json:"dormGrades,omitempty"`
	TotalScore   *int           `gorm:"column:totalScore" json:"totalScore"`
	Comments     *string        `gorm:"column:comments" json:"comments"`
	Photos       datatypes.JSON `gorm:"column:photoUrls" json:"photos"` // Prisma uses photoUrls
	Detail       datatypes.JSON `gorm:"column:detail" json:"detail"`
	CreatedBy    *User          `gorm:"foreignKey:CreatedByID" json:"createdBy,omitempty"`
	CreatedByID  *string        `gorm:"column:createdById;type:char(36)" json:"createdById"`
	ReviewedBy   *User          `gorm:"foreignKey:ReviewedByID" json:"reviewedBy,omitempty"`
	ReviewedByID *string        `gorm:"column:reviewedById;type:char(36)" json:"reviewedById"`
	CreatedAt    time.Time      `gorm:"column:createdAt;autoCreateTime" json:"createdAt"`
	UpdatedAt    time.Time      `gorm:"column:updatedAt;autoUpdateTime" json:"updatedAt"`
	Appeals      []Appeal       `gorm:"foreignKey:InspectionID" json:"appeals,omitempty"`
}

func (Inspection) TableName() string {
	return "inspection"
}

// Appeal 模型
type Appeal struct {
	ID           string     `gorm:"column:id;primaryKey;type:char(36)" json:"id"`
	Inspection   Inspection `gorm:"foreignKey:InspectionID" json:"inspection,omitempty"`
	InspectionID string     `gorm:"column:inspectionId;type:char(36)" json:"inspectionId"`
	Student      Student    `gorm:"foreignKey:StudentID" json:"student,omitempty"`
	StudentID    string     `gorm:"column:studentId;type:char(36)" json:"studentId"`
	Content      string     `gorm:"column:content;not null" json:"content"`
	Status       string     `gorm:"column:status;default:'pending'" json:"status"`
	Reply        *string    `gorm:"column:reply" json:"reply"`
	CreatedAt    time.Time  `gorm:"column:createdAt;autoCreateTime" json:"createdAt"`
	UpdatedAt    time.Time  `gorm:"column:updatedAt;autoUpdateTime" json:"updatedAt"`
}

func (Appeal) TableName() string {
	return "appeal"
}

// SystemSettings 模型
type SystemSettings struct {
	ID                     int            `gorm:"column:id;primaryKey;autoIncrement" json:"id"`
	GradingRules           datatypes.JSON `gorm:"column:gradingRules;not null" json:"gradingRules"`
	InspectionDefaultScore int            `gorm:"column:inspectionDefaultScore;default:100" json:"inspectionDefaultScore"`
	StudentContactEditable bool           `gorm:"column:studentContactEditable;default:false" json:"studentContactEditable"`
	ContactEmailDomains    datatypes.JSON `gorm:"column:contactEmailDomains" json:"contactEmailDomains"`

	DeductionItems  datatypes.JSON `gorm:"column:deductionItems" json:"deductionItems"`
	LocationOptions datatypes.JSON `gorm:"column:locationOptions" json:"locationOptions"`
	UpdatedAt       time.Time      `gorm:"column:updatedAt;autoUpdateTime" json:"updatedAt"`
}

func (SystemSettings) TableName() string {
	return "systemsettings"
}

// TableConfig 模型
type TableConfig struct {
	ID         string      `gorm:"column:id;primaryKey;type:char(36)" json:"id"`
	TableKey   string      `gorm:"column:tableKey;not null" json:"tableKey"`
	ConfigJson string      `gorm:"column:configJson;type:longtext;not null" json:"configJson"`
	User       *User       `gorm:"foreignKey:UserID" json:"user,omitempty"`
	UserID     *string     `gorm:"column:userId;type:char(36)" json:"userId"`
	Role       *RoleEntity `gorm:"foreignKey:RoleID" json:"role,omitempty"`
	RoleID     *string     `gorm:"column:roleId;type:char(36)" json:"roleId"`
	CreatedAt  time.Time   `gorm:"column:createdAt;autoCreateTime" json:"createdAt"`
	UpdatedAt  time.Time   `gorm:"column:updatedAt;autoUpdateTime" json:"updatedAt"`
}

func (TableConfig) TableName() string {
	return "tableconfig"
}

// AuditLog 模型
type AuditLog struct {
	ID           string         `gorm:"column:id;primaryKey;type:char(36)" json:"id"`
	Action       string         `gorm:"column:action;not null;index" json:"action"`
	Module       string         `gorm:"column:module;not null;index" json:"module"`
	TargetID     *string        `gorm:"column:targetId;type:char(36);index" json:"targetId"`
	TargetName   *string        `gorm:"column:targetName" json:"targetName"`
	Description  *string        `gorm:"column:description;type:text" json:"description"`
	OldValue     datatypes.JSON `gorm:"column:oldValue" json:"oldValue"`
	NewValue     datatypes.JSON `gorm:"column:newValue" json:"newValue"`
	IPAddress    *string        `gorm:"column:ipAddress" json:"ipAddress"`
	UserAgent    *string        `gorm:"column:userAgent;type:text" json:"userAgent"`
	Operator     *User          `gorm:"foreignKey:OperatorID" json:"operator,omitempty"`
	OperatorID   *string        `gorm:"column:operatorId;type:char(36);index" json:"operatorId"`
	OperatorName *string        `gorm:"column:operatorName" json:"operatorName"`
	CreatedAt    time.Time      `gorm:"column:createdAt;autoCreateTime;index" json:"createdAt"`
}

func (AuditLog) TableName() string {
	return "auditlog"
}
