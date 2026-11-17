package utils

import (
	"bytes"
	"fmt"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/xuri/excelize/v2"
)

// GetValueFromRow 从行数据中获取值，支持多列名匹配
func GetValueFromRow(row map[string]string, keys []string) string {
	for _, key := range keys {
		if val, ok := row[key]; ok && val != "" {
			return strings.TrimSpace(val)
		}
	}
	return ""
}

// ExcelColumn 定义 Excel 列配置
type ExcelColumn struct {
	Header string  // 列标题
	Field  string  // 数据字段名
	Width  float64 // 列宽度
}

// sanitizeExcelValue prevents Excel formula injection by escaping risky prefixes.
func sanitizeExcelValue(value interface{}) interface{} {
	text, ok := value.(string)
	if !ok {
		return value
	}
	trimmed := strings.TrimLeft(text, " \t\r\n")
	if trimmed == "" {
		return text
	}
	switch trimmed[0] {
	case '=', '+', '-', '@':
		return "'" + text
	default:
		return text
	}
}

// CreateExcelFromMaps 从 map 数据创建 Excel 文件
func CreateExcelFromMaps(data []map[string]interface{}, columns []ExcelColumn, sheetName string) (*excelize.File, error) {
	f := excelize.NewFile()

	// 删除默认的 Sheet1 并创建新的工作表
	index, err := f.NewSheet(sheetName)
	if err != nil {
		return nil, err
	}
	f.DeleteSheet("Sheet1")
	f.SetActiveSheet(index)

	// 写入表头
	for i, col := range columns {
		cell, _ := excelize.CoordinatesToCellName(i+1, 1)
		f.SetCellValue(sheetName, cell, col.Header)
		if col.Width > 0 {
			colName, _ := excelize.ColumnNumberToName(i + 1)
			f.SetColWidth(sheetName, colName, colName, col.Width)
		}
	}

	// 写入数据
	for rowIdx, row := range data {
		for colIdx, col := range columns {
			cell, _ := excelize.CoordinatesToCellName(colIdx+1, rowIdx+2)
			if val, ok := row[col.Field]; ok {
				f.SetCellValue(sheetName, cell, sanitizeExcelValue(val))
			}
		}
	}

	return f, nil
}

// SendExcelResponse 发送 Excel 文件作为 HTTP 响应
func SendExcelResponse(c *gin.Context, f *excelize.File, filenamePrefix string) error {
	// 生成带时间戳的文件名
	timestamp := time.Now().Format("20060102_150405")
	filename := fmt.Sprintf("%s_%s.xlsx", filenamePrefix, timestamp)

	c.Header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	c.Header("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))

	// 写入响应
	if err := f.Write(c.Writer); err != nil {
		return err
	}

	return nil
}

// ParseExcelFile 解析上传的 Excel 文件，返回行数据
func ParseExcelFile(data []byte, sheetIndex int) ([]map[string]string, error) {
	f, err := excelize.OpenReader(bytes.NewReader(data))
	if err != nil {
		return nil, fmt.Errorf("无法解析 Excel 文件: %w", err)
	}
	defer f.Close()

	sheets := f.GetSheetList()
	if len(sheets) == 0 {
		return nil, fmt.Errorf("Excel 文件中没有工作表")
	}

	sheetName := sheets[0]
	if sheetIndex >= 0 && sheetIndex < len(sheets) {
		sheetName = sheets[sheetIndex]
	} else if sheetIndex < 0 || sheetIndex >= len(sheets) {
		return nil, fmt.Errorf("指定的 sheetIndex (%d) 超出范围，有效范围是 0 到 %d", sheetIndex, len(sheets)-1)
	}

	rows, err := f.GetRows(sheetName)
	if err != nil {
		return nil, err
	}

	if len(rows) < 2 {
		return nil, fmt.Errorf("Excel 文件中没有数据行或只有表头")
	}

	headers := rows[0]
	result := make([]map[string]string, 0, len(rows)-1)

	for i := 1; i < len(rows); i++ {
		row := rows[i]
		rowMap := make(map[string]string)
		for j, header := range headers {
			if j < len(row) {
				rowMap[header] = row[j]
			} else {
				rowMap[header] = ""
			}
		}
		result = append(result, rowMap)
	}

	return result, nil
}

// ParseExcelFromBytes 从字节解析 Excel 文件
func ParseExcelFromBytes(data []byte) ([]map[string]string, error) {
	f, err := excelize.OpenReader(bytes.NewReader(data))
	if err != nil {
		return nil, fmt.Errorf("无法解析 Excel 文件: %w", err)
	}
	defer f.Close()

	sheets := f.GetSheetList()
	if len(sheets) == 0 {
		return nil, fmt.Errorf("Excel 文件中没有工作表")
	}

	sheetName := sheets[0]
	rows, err := f.GetRows(sheetName)
	if err != nil {
		return nil, err
	}

	if len(rows) < 2 {
		return nil, fmt.Errorf("Excel 文件中没有数据行或只有表头")
	}

	headers := rows[0]
	result := make([]map[string]string, 0, len(rows)-1)

	for i := 1; i < len(rows); i++ {
		row := rows[i]
		rowMap := make(map[string]string)
		for j, header := range headers {
			if j < len(row) {
				rowMap[header] = row[j]
			} else {
				rowMap[header] = ""
			}
		}
		result = append(result, rowMap)
	}

	return result, nil
}
