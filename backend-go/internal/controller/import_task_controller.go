package controller

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/my-project/backend-go/internal/service"
)

// ImportTaskController 导入任务控制器
type ImportTaskController struct {
	taskService service.ImportTaskService
}

// NewImportTaskController 创建导入任务控制器
func NewImportTaskController() *ImportTaskController {
	return &ImportTaskController{
		taskService: service.GetImportTaskService(),
	}
}

// GetProgress 获取导入任务进度
// GET /api/import/progress/:jobId
func (c *ImportTaskController) GetProgress(ctx *gin.Context) {
	jobId := ctx.Param("jobId")
	if jobId == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"message": "缺少 jobId 参数"})
		return
	}

	progress, err := c.taskService.GetProgress(jobId)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"message": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, progress)
}
