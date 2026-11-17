package model

// 错误码定义
const (
	ErrMissingRequiredField = "MISSING_REQUIRED_FIELD"
	ErrInvalidEnumValue     = "INVALID_ENUM_VALUE"
	ErrValueOutOfRange      = "VALUE_OUT_OF_RANGE"
	ErrBuildingNotFound     = "BUILDING_NOT_FOUND"
	ErrDuplicateEntryInDB   = "DUPLICATE_ENTRY_IN_DB"

	// 入住导入专用错误码
	ErrStudentNotFound    = "STUDENT_NOT_FOUND"    // 学号对应学生不存在
	ErrDormNotFound       = "DORM_NOT_FOUND"       // 楼栋/房间号对应宿舍不存在
	ErrBedNotFound        = "BED_NOT_FOUND"        // 床位不存在
	ErrStudentAlreadyIn   = "STUDENT_ALREADY_IN"   // 学生已入住（冲突：C类）
	ErrBedAlreadyOccupied = "BED_ALREADY_OCCUPIED" // 床位已被占用（冲突：C类）
)

// DormImportRow 宿舍导入行数据（经过前端映射后）
type DormImportRow struct {
	RowNo    int     `json:"rowNo"`
	Campus   *string `json:"campus"`
	Building *string `json:"building"`
	Floor    *int    `json:"floor"`
	RoomNo   *string `json:"roomNo"`
	Capacity *int    `json:"capacity"`
	Gender   *string `json:"gender"`
	Grade    *string `json:"grade"`
}

// DormImportIssue 导入异常/问题记录项
type DormImportIssue struct {
	RowNo          int      `json:"rowNo"`
	ErrorType      string   `json:"errorType"` // A: 格式/必填错误, B: 引用/逻辑错误, C: 提示性冲突
	ErrorCode      string   `json:"errorCode"`
	Reason         string   `json:"reason"`
	Suggestion     string   `json:"suggestion"`
	AffectedFields []string `json:"affectedFields,omitempty"`
}

// DormImportPreviewRequest 预览预检请求体
type DormImportPreviewRequest struct {
	Rows []DormImportRow `json:"rows"`
}

// DormImportPreviewResponse 预览预检响应体
type DormImportPreviewResponse struct {
	TotalCount int               `json:"totalCount"`
	PassCount  int               `json:"passCount"`
	IssueCount int               `json:"issueCount"`
	Issues     []DormImportIssue `json:"issues"`
}

// DormImportExecuteRequest 导入执行请求体
type DormImportExecuteRequest struct {
	Strategy string          `json:"strategy"` // OVERWRITE | SKIP
	Rows     []DormImportRow `json:"rows"`
}

// DormImportExecuteResponse 导入执行响应体
type DormImportExecuteResponse struct {
	TotalCount   int               `json:"totalCount"`
	CreatedCount int               `json:"createdCount"`
	UpdatedCount int               `json:"updatedCount"`
	SkippedCount int               `json:"skippedCount"`
	FailedCount  int               `json:"failedCount"`
	SuccessCount int               `json:"successCount"` // CreatedCount + UpdatedCount
	FailedRows   []DormImportIssue `json:"failedRows"`
}

// --- 旧结构兼容占位 (保留以防止大面积编译错误，待全部迁出后可删除) ---

type ImportPreviewResult struct {
	Total         int              `json:"total"`
	ValidCount    int              `json:"validCount"`
	InvalidCount  int              `json:"invalidCount"`
	ConflictCount int              `json:"conflictCount"`
	NewCount      int              `json:"newCount"`
	InvalidItems  []ImportError    `json:"invalidItems"`
	Conflicts     []ImportConflict `json:"conflicts"`
	GlobalErrors  []string         `json:"globalErrors"`
}

type ImportError struct {
	Row       int    `json:"row"`
	Field     string `json:"field"`
	ErrorType string `json:"errorType"`
	Reason    string `json:"reason"`
	Content   string `json:"content"`
}

type ImportConflict struct {
	Row          int    `json:"row"`
	Identifier   string `json:"identifier"`
	Name         string `json:"name"`
	ExistingName string `json:"existingName"`
	ConflictType string `json:"conflictType"`
}

type ImportRequest struct {
	Resolution string `json:"resolution"`
}

// ========== 学生导入 V2 数据结构 ==========

// StudentImportRow 学生导入行数据（经过前端映射后）
type StudentImportRow struct {
	RowNo           int     `json:"rowNo"`
	StudentNo       *string `json:"studentNo"`
	FullName        *string `json:"fullName"`
	Gender          *string `json:"gender"`
	Grade           *string `json:"grade"`
	College         *string `json:"college"`
	Major           *string `json:"major"`
	ClassName       *string `json:"className"`
	EducationLevel  *string `json:"educationLevel"`
	Status          *string `json:"status"`
	Mobile          *string `json:"mobile"`
	IsMonitor       *bool   `json:"isMonitor"`
	IDType          *string `json:"idType"`
	IDNumber        *string `json:"idNumber"`
	PoliticalStatus *string `json:"politicalStatus"`
	Ethnicity       *string `json:"ethnicity"`
	NativePlace     *string `json:"nativePlace"`
	HomeAddress     *string `json:"homeAddress"`
	Phone           *string `json:"phone"`
	QQ              *string `json:"qq"`
}

// StudentImportIssue 学生导入异常/问题记录项
type StudentImportIssue struct {
	RowNo          int      `json:"rowNo"`
	ErrorType      string   `json:"errorType"` // A: 格式/必填错误, B: 引用/逻辑错误, C: 提示性冲突
	ErrorCode      string   `json:"errorCode"`
	Reason         string   `json:"reason"`
	Suggestion     string   `json:"suggestion"`
	AffectedFields []string `json:"affectedFields,omitempty"`
}

// StudentImportPreviewRequest 学生导入预览请求体
type StudentImportPreviewRequest struct {
	Rows []StudentImportRow `json:"rows"`
}

// StudentImportPreviewResponse 学生导入预览响应体
type StudentImportPreviewResponse struct {
	TotalCount int                  `json:"totalCount"`
	PassCount  int                  `json:"passCount"`
	IssueCount int                  `json:"issueCount"`
	Issues     []StudentImportIssue `json:"issues"`
}

// StudentImportExecuteRequest 学生导入执行请求体
type StudentImportExecuteRequest struct {
	Strategy string             `json:"strategy"` // OVERWRITE | SKIP
	Rows     []StudentImportRow `json:"rows"`
}

// StudentImportExecuteResponse 学生导入执行响应体
type StudentImportExecuteResponse struct {
	TotalCount   int                  `json:"totalCount"`
	CreatedCount int                  `json:"createdCount"`
	UpdatedCount int                  `json:"updatedCount"`
	SkippedCount int                  `json:"skippedCount"`
	FailedCount  int                  `json:"failedCount"`
	SuccessCount int                  `json:"successCount"` // CreatedCount + UpdatedCount
	FailedRows   []StudentImportIssue `json:"failedRows"`
}

// ========== 教职工导入 V2 数据结构 ==========

// TeacherImportRow 教职工导入行数据（经过前端映射后）
type TeacherImportRow struct {
	RowNo      int     `json:"rowNo"`
	EmployeeNo *string `json:"employeeNo"`
	FullName   *string `json:"fullName"`
	Gender     *string `json:"gender"`
	Department *string `json:"department"`
	Mobile     *string `json:"mobile"`
	Classes    *string `json:"classes"`
}

// TeacherImportIssue 教职工导入异常/问题记录项
type TeacherImportIssue struct {
	RowNo          int      `json:"rowNo"`
	ErrorType      string   `json:"errorType"` // A: 格式/必填错误, B: 引用/逻辑错误, C: 提示性冲突
	ErrorCode      string   `json:"errorCode"`
	Reason         string   `json:"reason"`
	Suggestion     string   `json:"suggestion"`
	AffectedFields []string `json:"affectedFields,omitempty"`
}

// TeacherImportPreviewRequest 教职工导入预览请求体
type TeacherImportPreviewRequest struct {
	Rows []TeacherImportRow `json:"rows"`
}

// TeacherImportPreviewResponse 教职工导入预览响应体
type TeacherImportPreviewResponse struct {
	TotalCount int                  `json:"totalCount"`
	PassCount  int                  `json:"passCount"`
	IssueCount int                  `json:"issueCount"`
	Issues     []TeacherImportIssue `json:"issues"`
}

// TeacherImportExecuteRequest 教职工导入执行请求体
type TeacherImportExecuteRequest struct {
	Strategy string            `json:"strategy"` // OVERWRITE | SKIP
	Rows     []TeacherImportRow `json:"rows"`
}

// TeacherImportExecuteResponse 教职工导入执行响应体
type TeacherImportExecuteResponse struct {
	TotalCount   int                  `json:"totalCount"`
	CreatedCount int                  `json:"createdCount"`
	UpdatedCount int                  `json:"updatedCount"`
	SkippedCount int                  `json:"skippedCount"`
	FailedCount  int                  `json:"failedCount"`
	SuccessCount int                  `json:"successCount"` // CreatedCount + UpdatedCount
	FailedRows   []TeacherImportIssue `json:"failedRows"`
}

// ========== 楼栋导入 V2 数据结构 ==========

// BuildingImportRow 楼栋导入行数据（经过前端映射后）
type BuildingImportRow struct {
	RowNo       int     `json:"rowNo"`
	Name        *string `json:"name"`
	Campus      *string `json:"campus"`
	Type        *string `json:"type"`
	Floors      *int    `json:"floors"`
	HasElevator *string `json:"hasElevator"`
	ContactInfo *string `json:"contactInfo"`
}

// BuildingImportIssue 楼栋导入异常/问题记录项
type BuildingImportIssue struct {
	RowNo          int      `json:"rowNo"`
	ErrorType      string   `json:"errorType"` // A: 格式/必填错误, B: 引用/逻辑错误, C: 提示性冲突
	ErrorCode      string   `json:"errorCode"`
	Reason         string   `json:"reason"`
	Suggestion     string   `json:"suggestion"`
	AffectedFields []string `json:"affectedFields,omitempty"`
}

// BuildingImportPreviewRequest 楼栋导入预览请求体
type BuildingImportPreviewRequest struct {
	Rows []BuildingImportRow `json:"rows"`
}

// BuildingImportPreviewResponse 楼栋导入预览响应体
type BuildingImportPreviewResponse struct {
	TotalCount int                   `json:"totalCount"`
	PassCount  int                   `json:"passCount"`
	IssueCount int                   `json:"issueCount"`
	Issues     []BuildingImportIssue `json:"issues"`
}

// BuildingImportExecuteRequest 楼栋导入执行请求体
type BuildingImportExecuteRequest struct {
	Strategy string             `json:"strategy"` // OVERWRITE | SKIP
	Rows     []BuildingImportRow `json:"rows"`
}

// BuildingImportExecuteResponse 楼栋导入执行响应体
type BuildingImportExecuteResponse struct {
	TotalCount   int                   `json:"totalCount"`
	CreatedCount int                   `json:"createdCount"`
	UpdatedCount int                   `json:"updatedCount"`
	SkippedCount int                   `json:"skippedCount"`
	FailedCount  int                   `json:"failedCount"`
	SuccessCount int                   `json:"successCount"` // CreatedCount + UpdatedCount
	FailedRows   []BuildingImportIssue `json:"failedRows"`
}

// ========== 入住导入 V2 数据结构 ==========

// OccupancyImportRow 入住导入行数据（经过前端映射后）
type OccupancyImportRow struct {
	RowNo     int     `json:"rowNo"`
	StudentNo *string `json:"studentNo"` // 学号
	Building  *string `json:"building"`  // 楼栋名称
	RoomNo    *string `json:"roomNo"`    // 房间号
	BedNo     *string `json:"bedNo"`     // 床位号
}

// OccupancyImportIssue 入住导入异常/问题记录项
type OccupancyImportIssue struct {
	RowNo          int      `json:"rowNo"`
	ErrorType      string   `json:"errorType"` // A: 格式/必填错误, B: 引用不存在, C: 冲突
	ErrorCode      string   `json:"errorCode"`
	Reason         string   `json:"reason"`
	Suggestion     string   `json:"suggestion"`
	AffectedFields []string `json:"affectedFields,omitempty"`
}

// OccupancyImportPreviewRequest 入住导入预览请求体
type OccupancyImportPreviewRequest struct {
	Rows []OccupancyImportRow `json:"rows"`
}

// OccupancyImportPreviewResponse 入住导入预览响应体
type OccupancyImportPreviewResponse struct {
	TotalCount int                    `json:"totalCount"`
	PassCount  int                    `json:"passCount"`
	IssueCount int                    `json:"issueCount"`
	Issues     []OccupancyImportIssue `json:"issues"`
}

// OccupancyImportExecuteRequest 入住导入执行请求体
type OccupancyImportExecuteRequest struct {
	Strategy string               `json:"strategy"` // OVERWRITE | SKIP
	Rows     []OccupancyImportRow `json:"rows"`
}

// OccupancyImportExecuteResponse 入住导入执行响应体
type OccupancyImportExecuteResponse struct {
	TotalCount   int                    `json:"totalCount"`
	CreatedCount int                    `json:"createdCount"` // 新入住数
	UpdatedCount int                    `json:"updatedCount"` // 迁宿/覆盖数
	SkippedCount int                    `json:"skippedCount"`
	FailedCount  int                    `json:"failedCount"`
	SuccessCount int                    `json:"successCount"` // CreatedCount + UpdatedCount
	FailedRows   []OccupancyImportIssue `json:"failedRows"`
}
