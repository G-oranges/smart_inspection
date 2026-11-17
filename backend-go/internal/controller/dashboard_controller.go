package controller

import (
	"net/http"
	"fmt"

	"github.com/gin-gonic/gin"
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
	stats, err := ctrl.service.GetSummary(fmt.Sprintf("%v", userID))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, stats)
}
