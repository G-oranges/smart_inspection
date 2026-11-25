package controller

import (
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/my-project/backend-go/internal/middleware"
	"github.com/my-project/backend-go/internal/service"
)

type DashboardController struct {
	service service.DashboardService
}

func NewDashboardController(service service.DashboardService) *DashboardController {
	return &DashboardController{service: service}
}

func (ctrl *DashboardController) GetSummary(c *gin.Context) {
	userID, _ := c.Get("userId")
	rangeKey := c.Query("range")
	stats, err := ctrl.service.GetSummaryWithRange(fmt.Sprintf("%v", userID), rangeKey, middleware.CheckPermissionInController(c, "APPEAL_VIEW"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, stats)
}
