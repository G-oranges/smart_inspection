package service

import (
	"encoding/json"
	"fmt"
	"math"
	"strconv"
	"strings"

	"gorm.io/datatypes"
)

type DeductionRow struct {
	ID        string   `json:"id"`
	Code      string   `json:"code"`
	Count     int      `json:"count"`
	Locations []string `json:"locations"`
	Points    *int     `json:"points,omitempty"`
}

type DeductionAdjustment struct {
	Code      string    `json:"code"`
	Action    string    `json:"action"`
	Locations *[]string `json:"locations"`
	Count     *int      `json:"count"`
}

type deductionItem struct {
	Code      string          `json:"code"`
	Name      string          `json:"name"`
	Points    json.RawMessage `json:"points"`
	MaxPoints json.RawMessage `json:"maxPoints"`
	Enabled   *bool           `json:"enabled"`
}

func deductionNumber(value json.RawMessage) (*int, error) {
	raw := strings.Trim(string(value), "\"")
	if raw == "" || raw == "null" {
		return nil, nil
	}
	n, err := strconv.ParseInt(raw, 10, 32)
	if err != nil || n < 0 {
		return nil, fmt.Errorf("%w: 扣分设置中的分值无效", ErrAppealInvalid)
	}
	v := int(n)
	return &v, nil
}

func deductionConfig(raw datatypes.JSON) (map[string]deductionItem, error) {
	var items []deductionItem
	if len(raw) != 0 {
		if err := json.Unmarshal(raw, &items); err != nil {
			return nil, err
		}
	}
	if len(items) == 0 {
		items = []deductionItem{
			{Code: "A", Name: "垃圾未倒", Points: json.RawMessage("2")},
			{Code: "B", Name: "桌面杂乱", Points: json.RawMessage("3")},
			{Code: "C", Name: "违规电器", Points: json.RawMessage("10")},
		}
	}
	config := make(map[string]deductionItem, len(items))
	for _, item := range items {
		config[item.Code] = item
	}
	return config, nil
}

func ParseDeductionRows(raw datatypes.JSON) ([]DeductionRow, error) {
	rows := []DeductionRow{}
	if len(raw) == 0 {
		return rows, nil
	}
	if err := json.Unmarshal(raw, &rows); err != nil {
		return nil, fmt.Errorf("%w: 查寝扣分明细格式无效", ErrAppealInvalid)
	}
	if rows == nil {
		rows = []DeductionRow{}
	}
	return rows, nil
}

func resolveDeductionPoints(rows, snapshot []DeductionRow, config map[string]deductionItem) error {
	previous := make(map[string]*int, len(snapshot))
	for _, row := range snapshot {
		previous[row.Code] = row.Points
	}
	for i := range rows {
		row := &rows[i]
		if item, ok := config[row.Code]; ok {
			points, err := deductionNumber(item.Points)
			if err != nil {
				return err
			}
			if points == nil {
				zero := 0
				points = &zero
			}
			row.Points = points
		} else {
			row.Points = previous[row.Code]
		}
	}
	return nil
}

func applyDeductionAdjustments(rows []DeductionRow, adjustments []DeductionAdjustment, config map[string]deductionItem) ([]DeductionRow, error) {
	result := append([]DeductionRow{}, rows...)
	seen := make(map[string]bool, len(adjustments))
	for _, adjustment := range adjustments {
		code := adjustment.Code
		if code == "" || seen[code] {
			return nil, fmt.Errorf("%w: 扣分项为空或重复", ErrAppealInvalid)
		}
		seen[code] = true
		if adjustment.Count != nil && (*adjustment.Count < 1 || *adjustment.Count > math.MaxInt32) {
			return nil, fmt.Errorf("%w: 扣分次数无效", ErrAppealInvalid)
		}
		index := -1
		for i := range result {
			if result[i].Code == code {
				if index >= 0 {
					return nil, fmt.Errorf("%w: 查寝记录包含重复扣分项 %s", ErrAppealInvalid, code)
				}
				index = i
			}
		}
		item, configured := config[code]
		if adjustment.Action == "add" {
			if index >= 0 || !configured || (item.Enabled != nil && !*item.Enabled) || adjustment.Count == nil {
				return nil, fmt.Errorf("%w: 无法新增扣分项 %s", ErrAppealInvalid, code)
			}
			result = append(result, DeductionRow{Code: code, Locations: []string{}})
			index = len(result) - 1
		} else if index < 0 {
			return nil, fmt.Errorf("%w: 扣分项 %s 不在查寝记录中", ErrAppealInvalid, code)
		}

		switch adjustment.Action {
		case "remove":
			result = append(result[:index], result[index+1:]...)
			continue
		case "keep":
			continue
		case "update":
			if adjustment.Count == nil && adjustment.Locations == nil {
				return nil, fmt.Errorf("%w: 修改扣分项须指定次数或位置", ErrAppealInvalid)
			}
		case "add":
		default:
			return nil, fmt.Errorf("%w: 无效的扣分操作", ErrAppealInvalid)
		}
		row := &result[index]
		if adjustment.Count != nil {
			row.Count = *adjustment.Count
		}
		if adjustment.Locations != nil {
			row.Locations = *adjustment.Locations
		}
		if row.Count < 1 || row.Count > math.MaxInt32 {
			return nil, fmt.Errorf("%w: 扣分次数无效", ErrAppealInvalid)
		}
		if configured {
			limit, err := deductionNumber(item.MaxPoints)
			if err != nil {
				return nil, err
			}
			points, err := deductionNumber(item.Points)
			if err != nil {
				return nil, err
			}
			if limit != nil && points != nil && int64(*points)*int64(row.Count) > int64(*limit) {
				return nil, fmt.Errorf("%w: 扣分项 %s 超出扣分上限", ErrAppealInvalid, code)
			}
		}
	}
	return result, nil
}

func sumDeduction(rows []DeductionRow) (int64, error) {
	var sum int64
	for _, row := range rows {
		if row.Points == nil || *row.Points < 0 || *row.Points > math.MaxInt32 || row.Count < 1 || row.Count > math.MaxInt32 {
			return 0, fmt.Errorf("%w: 无法确定扣分项 %s 的分值或次数", ErrAppealInvalid, row.Code)
		}
		deduction := int64(*row.Points) * int64(row.Count)
		if sum > math.MaxInt64-100-deduction {
			return 0, fmt.Errorf("%w: 扣分总额超出范围", ErrAppealInvalid)
		}
		sum += deduction
	}
	return sum, nil
}
