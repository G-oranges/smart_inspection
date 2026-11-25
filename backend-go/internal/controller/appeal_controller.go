package controller

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/my-project/backend-go/internal/middleware"
	"github.com/my-project/backend-go/internal/model"
	"github.com/my-project/backend-go/internal/repository"
	"github.com/my-project/backend-go/internal/service"
	"gorm.io/gorm"
)

type AppealController struct {
	db      *gorm.DB
	service *service.AppealService
	photos  *UploadController
}

func NewAppealController(db *gorm.DB, service *service.AppealService) *AppealController {
	return &AppealController{db: db, service: service, photos: NewUploadController("./data/appeal-photos")}
}

func appealError(err error) (int, string, string) {
	switch {
	case errors.Is(err, service.ErrAppealInvalid):
		return http.StatusBadRequest, "INVALID_APPEAL", err.Error()
	case errors.Is(err, service.ErrAppealExpired):
		return http.StatusBadRequest, "APPEAL_WINDOW_EXPIRED", err.Error()
	case errors.Is(err, service.ErrAppealForbidden):
		return http.StatusForbidden, "DATA_SCOPE_DENIED", err.Error()
	case errors.Is(err, gorm.ErrRecordNotFound):
		return http.StatusNotFound, "APPEAL_RESOURCE_NOT_FOUND", "未找到申诉或关联记录"
	case errors.Is(err, service.ErrAppealDuplicate):
		return http.StatusConflict, "APPEAL_ALREADY_PENDING", err.Error()
	case errors.Is(err, service.ErrAppealNotPending):
		return http.StatusConflict, "APPEAL_NOT_PENDING", err.Error()
	case errors.Is(err, service.ErrAppealInspectionChanged):
		return http.StatusConflict, "INSPECTION_CHANGED", err.Error()
	default:
		return http.StatusInternalServerError, "APPEAL_INTERNAL_ERROR", "申诉操作失败"
	}
}

func respondAppealError(c *gin.Context, err error) {
	status, code, message := appealError(err)
	c.JSON(status, gin.H{"code": code, "message": message})
}

func (ctrl *AppealController) currentStudent(c *gin.Context) (model.Student, error) {
	var student model.Student
	err := ctrl.db.Where("userId = ?", c.GetString("userId")).First(&student).Error
	return student, err
}

func (ctrl *AppealController) Create(c *gin.Context) {
	var req struct {
		InspectionID  string   `json:"inspectionId" binding:"required"`
		StudentID     string   `json:"studentId"`
		Content       string   `json:"content"`
		DisputedCodes []string `json:"disputedCodes"`
		Photos        []string `json:"photos"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		respondAppealError(c, service.ErrAppealInvalid)
		return
	}
	in := service.SubmitAppealInput{InspectionID: req.InspectionID, Content: req.Content, DisputedCodes: req.DisputedCodes,
		Photos: req.Photos, PhotoUploaderID: c.GetString("userId")}
	if c.GetString("role") == model.RoleStudent || req.StudentID == "" {
		student, err := ctrl.currentStudent(c)
		if err != nil {
			respondAppealError(c, err)
			return
		}
		in.StudentID = student.ID
	} else {
		if !middleware.CheckPermissionInController(c, "APPEAL_HANDLE") {
			respondAppealError(c, service.ErrAppealForbidden)
			return
		}
		scope, err := resolveDataScopeForCurrentUser(ctrl.db, c)
		if err != nil {
			respondAppealError(c, err)
			return
		}
		in.StudentID, in.Scope = req.StudentID, scope
	}
	if err := ctrl.validateAppealPhotos(in.PhotoUploaderID, in.Photos); err != nil {
		respondAppealError(c, err)
		return
	}
	appeal, err := ctrl.service.SubmitAppeal(in)
	if err != nil {
		respondAppealError(c, err)
		return
	}
	addAppealPhotoURLs(appeal)
	c.JSON(http.StatusCreated, appeal)
}

func appealQuery(c *gin.Context) (repository.AppealQuery, error) {
	q := repository.AppealQuery{
		Keyword: strings.TrimSpace(c.Query("keyword")), TaskID: c.Query("taskId"),
		BuildingID: c.Query("buildingId"), Status: c.Query("status"),
		SortBy: c.Query("sortBy"), SortOrder: c.Query("sortOrder"),
	}
	var err error
	q.Page, err = strconv.Atoi(c.DefaultQuery("page", "1"))
	if err != nil || q.Page < 1 || q.Page > 1_000_000 {
		return q, service.ErrAppealInvalid
	}
	q.PageSize, err = strconv.Atoi(c.DefaultQuery("pageSize", "10"))
	if err != nil || q.PageSize < 1 {
		return q, service.ErrAppealInvalid
	}
	switch q.Status {
	case "", model.AppealPending, model.AppealApproved, model.AppealRejected, model.AppealWithdrawn:
	default:
		return q, service.ErrAppealInvalid
	}
	if q.BuildingID != "" {
		if id, err := strconv.Atoi(q.BuildingID); err != nil || id < 1 {
			return q, service.ErrAppealInvalid
		}
	}
	for name, target := range map[string]**time.Time{"startAt": &q.StartAt, "endAt": &q.EndAt} {
		if value := c.Query(name); value != "" {
			parsed, err := time.Parse(time.RFC3339, value)
			if err != nil {
				return q, service.ErrAppealInvalid
			}
			*target = &parsed
		}
	}
	if q.StartAt != nil && q.EndAt != nil && q.StartAt.After(*q.EndAt) {
		return q, service.ErrAppealInvalid
	}
	return q, nil
}

func (ctrl *AppealController) scopedQuery(c *gin.Context) (repository.AppealQuery, error) {
	q, err := appealQuery(c)
	if err != nil {
		return q, err
	}
	scope, err := resolveDataScopeForCurrentUser(ctrl.db, c)
	if err != nil {
		return q, err
	}
	q.Scope = service.ApplyAppealScope(scope)
	return q, nil
}

func (ctrl *AppealController) list(c *gin.Context, q repository.AppealQuery) {
	appeals, total, err := ctrl.service.ListAppeals(q)
	if err != nil {
		respondAppealError(c, err)
		return
	}
	for i := range appeals {
		addAppealPhotoURLs(&appeals[i])
	}
	c.JSON(http.StatusOK, gin.H{"appeals": appeals, "total": total})
}

func (ctrl *AppealController) GetAppeals(c *gin.Context) {
	q, err := ctrl.scopedQuery(c)
	if err != nil {
		respondAppealError(c, err)
		return
	}
	ctrl.list(c, q)
}

func (ctrl *AppealController) GetMyAppeals(c *gin.Context) {
	student, err := ctrl.currentStudent(c)
	if err != nil {
		respondAppealError(c, err)
		return
	}
	q, err := appealQuery(c)
	if err != nil {
		respondAppealError(c, err)
		return
	}
	q.StudentID = student.ID
	ctrl.list(c, q)
}

func (ctrl *AppealController) GetStats(c *gin.Context) {
	q, err := ctrl.scopedQuery(c)
	if err != nil {
		respondAppealError(c, err)
		return
	}
	stats, err := ctrl.service.GetStats(q)
	if err != nil {
		respondAppealError(c, err)
		return
	}
	c.JSON(http.StatusOK, stats)
}

func (ctrl *AppealController) scopedDetail(c *gin.Context) (*model.Appeal, error) {
	appeal, err := ctrl.service.GetDetail(c.Param("id"))
	if err != nil {
		return nil, err
	}
	scope, err := resolveDataScopeForCurrentUser(ctrl.db, c)
	if err != nil {
		return nil, err
	}
	if len(filterAppealsByScope([]model.Appeal{*appeal}, scope)) == 0 {
		return nil, service.ErrAppealForbidden
	}
	return appeal, nil
}

func (ctrl *AppealController) GetDetail(c *gin.Context) {
	appeal, err := ctrl.scopedDetail(c)
	if err != nil {
		respondAppealError(c, err)
		return
	}
	addAppealPhotoURLs(appeal)
	c.JSON(http.StatusOK, appeal)
}

func (ctrl *AppealController) GetDeductions(c *gin.Context) {
	appeal, err := ctrl.scopedDetail(c)
	if err != nil {
		respondAppealError(c, err)
		return
	}
	deductions, err := ctrl.service.GetDeductions(appeal)
	if err != nil {
		respondAppealError(c, err)
		return
	}
	c.JSON(http.StatusOK, deductions)
}

type appealDecisionRequest struct {
	Status            string                        `json:"status"`
	Reply             string                        `json:"reply"`
	InspectionVersion time.Time                     `json:"inspectionVersion"`
	Adjustments       []service.DeductionAdjustment `json:"deductionAdjustments"`
	IDs               []string                      `json:"ids"`
}

func (ctrl *AppealController) decision(c *gin.Context) (appealDecisionRequest, service.ProcessAppealInput, error) {
	var req appealDecisionRequest
	var in service.ProcessAppealInput
	if err := c.ShouldBindJSON(&req); err != nil {
		return req, in, service.ErrAppealInvalid
	}
	scope, err := resolveDataScopeForCurrentUser(ctrl.db, c)
	if err != nil {
		return req, in, err
	}
	in = service.ProcessAppealInput{
		ID: c.Param("id"), Status: req.Status, Reply: req.Reply,
		OperatorID: c.GetString("userId"), InspectionVersion: req.InspectionVersion,
		Adjustments: req.Adjustments, Scope: service.ApplyAppealScope(scope),
	}
	return req, in, nil
}

func (ctrl *AppealController) UpdateStatus(c *gin.Context) {
	_, in, err := ctrl.decision(c)
	if err != nil {
		respondAppealError(c, err)
		return
	}
	appeal, err := ctrl.service.ProcessAppeal(in)
	if err != nil {
		respondAppealError(c, err)
		return
	}
	addAppealPhotoURLs(appeal)
	c.JSON(http.StatusOK, appeal)
}

func (ctrl *AppealController) BatchUpdateStatus(c *gin.Context) {
	req, in, err := ctrl.decision(c)
	if err != nil {
		respondAppealError(c, err)
		return
	}
	failures, err := ctrl.service.BatchProcess(req.IDs, in)
	if err != nil {
		respondAppealError(c, err)
		return
	}
	failed := []gin.H{}
	seen := map[string]bool{}
	for _, id := range req.IDs {
		if seen[id] {
			continue
		}
		seen[id] = true
		if err := failures[id]; err != nil {
			_, code, message := appealError(err)
			failed = append(failed, gin.H{"id": id, "code": code, "message": message})
		}
	}
	c.JSON(http.StatusOK, gin.H{"success": len(seen) - len(failed), "failed": failed})
}

func (ctrl *AppealController) Withdraw(c *gin.Context) {
	student, err := ctrl.currentStudent(c)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		err = service.ErrAppealForbidden
	}
	if err == nil {
		err = ctrl.service.WithdrawAppeal(c.Param("id"), student.ID)
	}
	if err != nil {
		respondAppealError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": model.AppealWithdrawn})
}

func addAppealPhotoURLs(appeal *model.Appeal) {
	var ids []string
	if len(appeal.Photos) == 0 || json.Unmarshal(appeal.Photos, &ids) != nil {
		return
	}
	for i := range ids {
		ids[i] = "/api/appeals/" + appeal.ID + "/photos/" + ids[i]
	}
	appeal.Photos, _ = json.Marshal(ids)
}
