package controller

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/my-project/backend-go/pkg/utils"
)

type TemplateController struct{}

func NewTemplateController() *TemplateController {
	return &TemplateController{}
}

func (ctrl *TemplateController) GetTemplate(c *gin.Context) {
	templateType := c.Param("type")

	var rows []map[string]interface{}
	var columns []utils.ExcelColumn
	var sheetName string

	switch templateType {
	case "dorms":
		sheetName = "宿舍导入模板"
		columns = []utils.ExcelColumn{
			{Header: "校区", Field: "campus", Width: 15},
			{Header: "楼栋", Field: "building", Width: 15},
			{Header: "楼层", Field: "floor", Width: 10},
			{Header: "房间号", Field: "roomNo", Width: 12},
			{Header: "可住人数", Field: "capacity", Width: 12},
			{Header: "宿舍性别", Field: "gender", Width: 12},
			{Header: "宿舍年级", Field: "grade", Width: 12},
		}
		rows = []map[string]interface{}{
			{
				"campus":   "东校区",
				"building": "1栋",
				"floor":    3,
				"roomNo":   "301",
				"capacity": 4,
				"gender":   "男",
				"grade":    "2024",
			},
		}
	case "students":
		sheetName = "学生导入模板"
		columns = []utils.ExcelColumn{
			{Header: "学号", Field: "studentNo", Width: 15},
			{Header: "姓名", Field: "fullName", Width: 12},
			{Header: "年级", Field: "grade", Width: 10},
			{Header: "性别", Field: "gender", Width: 8},
			{Header: "培养层次", Field: "educationLevel", Width: 12},
			{Header: "学院", Field: "college", Width: 20},
			{Header: "专业", Field: "major", Width: 20},
			{Header: "班级", Field: "className", Width: 15},
			{Header: "学籍状态", Field: "status", Width: 10},
			{Header: "宿舍楼栋", Field: "building", Width: 12},
			{Header: "宿舍号", Field: "roomNo", Width: 10},
			{Header: "床位号", Field: "bedNo", Width: 8},
			{Header: "联系电话", Field: "phone", Width: 15},
			{Header: "手机号", Field: "mobile", Width: 15},
			{Header: "QQ号", Field: "qq", Width: 12},
			{Header: "证件类型", Field: "idType", Width: 12},
			{Header: "证件号", Field: "idNumber", Width: 20},
			{Header: "政治面貌", Field: "politicalStatus", Width: 12},
			{Header: "出生日期", Field: "birthDate", Width: 15},
			{Header: "民族", Field: "ethnicity", Width: 10},
			{Header: "籍贯", Field: "nativePlace", Width: 15},
			{Header: "生源地", Field: "sourcePlace", Width: 12},
			{Header: "家庭地址", Field: "homeAddress", Width: 30},
			{Header: "是否宿舍长", Field: "isMonitor", Width: 12},
		}
		rows = []map[string]interface{}{
			{
				"studentNo":       "20240001",
				"fullName":        "张三",
				"grade":           "2024",
				"gender":          "男",
				"educationLevel":  "本科",
				"college":         "计算机学院",
				"major":           "软件工程",
				"className":       "软工2401",
				"status":          "在读",
				"building":        "1栋",
				"roomNo":          "301",
				"bedNo":           "1",
				"phone":           "13800000000",
				"mobile":          "13800000001",
				"qq":              "123456",
				"idType":          "身份证",
				"idNumber":        "440101200001010000",
				"politicalStatus": "团员",
				"birthDate":       "2004-01-01",
				"ethnicity":       "汉族",
				"nativePlace":     "广东广州",
				"sourcePlace":     "广东",
				"homeAddress":     "广东省广州市天河区XX路",
				"isMonitor":       "否",
			},
		}
	case "teachers":
		sheetName = "教职工导入模板"
		columns = []utils.ExcelColumn{
			{Header: "姓名", Field: "fullName", Width: 12},
			{Header: "工号", Field: "employeeNo", Width: 15},
			{Header: "性别", Field: "gender", Width: 8},
			{Header: "院系", Field: "department", Width: 20},
			{Header: "手机号", Field: "mobile", Width: 15},
			{Header: "负责班级", Field: "classes", Width: 30},
		}
		rows = []map[string]interface{}{
			{
				"fullName":   "李老师",
				"employeeNo": "T2024001",
				"gender":     "女",
				"department": "计算机学院",
				"mobile":     "13800000002",
				"classes":    "软工2401,软工2402",
			},
		}
	case "buildings":
		sheetName = "楼栋导入模板"
		columns = []utils.ExcelColumn{
			{Header: "楼栋名称", Field: "name", Width: 15},
			{Header: "校区", Field: "campus", Width: 15},
			{Header: "类型", Field: "type", Width: 10},
			{Header: "楼层数", Field: "floors", Width: 10},
			{Header: "是否有电梯", Field: "hasElevator", Width: 12},
			{Header: "联系方式", Field: "contactInfo", Width: 20},
		}
		rows = []map[string]interface{}{
			{
				"name":        "荟园1栋",
				"campus":      "本部",
				"type":        "男",
				"floors":      6,
				"hasElevator": "是",
				"contactInfo": "宿管热线：123456",
			},
		}
	default:
		c.JSON(http.StatusNotFound, gin.H{"message": "模板类型不存在"})
		return
	}

	f, err := utils.CreateExcelFromMaps(rows, columns, sheetName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "生成模板失败"})
		return
	}

	utils.SendExcelResponse(c, f, templateType+"_template")
}
