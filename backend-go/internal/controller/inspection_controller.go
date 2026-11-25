package controller

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/my-project/backend-go/internal/model"
	"github.com/my-project/backend-go/internal/repository"
	"github.com/my-project/backend-go/internal/service"
	"github.com/my-project/backend-go/pkg/utils"
	"gorm.io/gorm"
)

type InspectionController struct {
	db      *gorm.DB
	service service.InspectionService
}

func NewInspectionController(db *gorm.DB, service service.InspectionService) *InspectionController {
	return &InspectionController{db: db, service: service}
}

func (ctrl *InspectionController) GetInspections(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "10"))

	var taskId *string
	if tid := c.Query("taskId"); tid != "" {
		taskId = &tid
	}

	var dormId *string
	if did := c.Query("dormId"); did != "" {
		dormId = &did
	}

	scope, err := resolveDataScopeForCurrentUser(ctrl.db, c)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "获取数据范围失败"})
		return
	}
	if !scope.All && !scope.HasDormitoryAccess() {
		c.JSON(http.StatusOK, gin.H{"inspections": []gin.H{}, "total": 0})
		return
	}

	inspections, total, err := ctrl.service.GetInspections(page, pageSize, taskId, dormId)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}
	inspections = filterInspectionsByScope(inspections, scope)
	total = int64(len(inspections))
	start, end := paginateRange(page, pageSize, len(inspections))
	inspections = inspections[start:end]

	formatted := make([]gin.H, 0, len(inspections))
	for _, ins := range inspections {
		formatted = append(formatted, gin.H{
			"id":           ins.ID,
			"taskId":       ins.TaskID,
			"dormId":       ins.DormID,
			"dormColleges": ins.DormColleges,
			"dormGrades":   ins.DormGrades,
			"totalScore":   ins.TotalScore,
			"comments":     ins.Comments,
			"photoUrls":    ins.Photos, // 映射到前端需要的字段名
			"detail":       ins.Detail,
			"createdById":  ins.CreatedByID,
			"createdBy":    ins.CreatedBy, // 检查人信息（含 fullName）
			"reviewedById": ins.ReviewedByID,
			"reviewedBy":   ins.ReviewedBy, // 实际提交人信息（含 fullName）
			"createdAt":    ins.CreatedAt,  // 检查时间（即执行人提交结果的时间）
			"updatedAt":    ins.UpdatedAt,
			"dorm":         ins.Dorm,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"inspections": formatted,
		"total":       total,
	})
}

func (ctrl *InspectionController) SubmitResult(c *gin.Context) {
	id := c.Param("id")
	var req service.UpdateInspectionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "参数错误"})
		return
	}

	userID, _ := c.Get("userId")
	inspection, err := ctrl.service.SubmitResult(id, req, userID.(string))
	if err != nil {
		if errors.Is(err, repository.ErrInspectionChanged) {
			respondAppealError(c, err)
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"inspection": inspection})
}

// GetMyInspections 获取当前用户的检查记录（移动端）
func (ctrl *InspectionController) GetMyInspections(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "10"))
	userID, _ := c.Get("userId")

	inspections, total, err := ctrl.service.GetMyInspections(page, pageSize, userID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"inspections": inspections,
		"total":       total,
	})
}

// ExportResults 导出检查结果
func (ctrl *InspectionController) ExportResults(c *gin.Context) {
	taskId := c.Query("taskId")
	var tid *string
	if taskId != "" {
		tid = &taskId
	}

	scope, err := resolveDataScopeForCurrentUser(ctrl.db, c)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "获取数据范围失败"})
		return
	}
	if !scope.All && !scope.HasDormitoryAccess() {
		results := []model.Inspection{}
		ctrl.sendInspectionExport(c, results)
		return
	}

	results, err := ctrl.service.ExportResults(tid)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}
	results = filterInspectionsByScope(results, scope)
	ctrl.sendInspectionExport(c, results)
}

func (ctrl *InspectionController) sendInspectionExport(c *gin.Context, results []model.Inspection) {
	// 定义导出列
	columns := []utils.ExcelColumn{
		{Header: "任务名称", Field: "taskName", Width: 20},
		{Header: "检查日期", Field: "taskDate", Width: 12},
		{Header: "校区", Field: "campus", Width: 12},
		{Header: "楼栋", Field: "building", Width: 12},
		{Header: "楼层", Field: "floor", Width: 8},
		{Header: "房间号", Field: "roomNo", Width: 10},
		{Header: "可住人数", Field: "capacity", Width: 10},
		{Header: "宿舍性别", Field: "gender", Width: 10},
		{Header: "宿舍年级", Field: "grade", Width: 10},
		{Header: "寝室分数", Field: "score", Width: 10},
		{Header: "备注", Field: "comments", Width: 25},
	}

	// 转换数据为 map
	data := make([]map[string]interface{}, 0, len(results))
	for _, ins := range results {
		taskName := ""
		taskDate := ""
		if ins.Task != nil {
			taskName = ins.Task.Title
			if ins.Task.Date != nil {
				taskDate = ins.Task.Date.Format("2006-01-02")
			}
		}

		dormInfo := map[string]interface{}{
			"campus":   "",
			"building": "",
			"floor":    "",
			"roomNo":   "",
			"capacity": "",
			"gender":   "",
			"grade":    "",
		}
		if ins.Dorm != nil {
			if ins.Dorm.Campus != nil {
				dormInfo["campus"] = *ins.Dorm.Campus
			}
			if ins.Dorm.Building != nil {
				dormInfo["building"] = *ins.Dorm.Building
			}
			if ins.Dorm.Floor != nil {
				dormInfo["floor"] = *ins.Dorm.Floor
			}
			if ins.Dorm.RoomNo != nil {
				dormInfo["roomNo"] = *ins.Dorm.RoomNo
			}
			if ins.Dorm.Capacity != nil {
				dormInfo["capacity"] = *ins.Dorm.Capacity
			}
			if ins.Dorm.Gender != nil {
				dormInfo["gender"] = *ins.Dorm.Gender
			}
			if ins.Dorm.Grade != nil {
				dormInfo["grade"] = *ins.Dorm.Grade
			}
		}

		score := ""
		if ins.TotalScore != nil {
			score = strconv.Itoa(*ins.TotalScore)
		}

		comments := ""
		if ins.Comments != nil {
			comments = *ins.Comments
		}

		row := map[string]interface{}{
			"taskName": taskName,
			"taskDate": taskDate,
			"campus":   dormInfo["campus"],
			"building": dormInfo["building"],
			"floor":    dormInfo["floor"],
			"roomNo":   dormInfo["roomNo"],
			"capacity": dormInfo["capacity"],
			"gender":   dormInfo["gender"],
			"grade":    dormInfo["grade"],
			"score":    score,
			"comments": comments,
		}
		data = append(data, row)
	}

	// 创建 Excel 文件
	excelFile, err := utils.CreateExcelFromMaps(data, columns, "查寝结果")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "生成 Excel 失败"})
		return
	}

	// 发送 Excel 响应
	if err := utils.SendExcelResponse(c, excelFile, "inspections"); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "发送文件失败"})
		return
	}
}
