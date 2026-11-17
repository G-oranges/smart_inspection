package repository

import (
	"gorm.io/gorm"
)

// Pagination 基础分页结构
type Pagination struct {
	Page     int `json:"page"`
	PageSize int `json:"pageSize"`
}

// Scopes 提供通用的 GORM Scopes
func Paginate(page, pageSize int) func(db *gorm.DB) *gorm.DB {
	return func(db *gorm.DB) *gorm.DB {
		if page <= 0 {
			page = 1
		}
		switch {
		case pageSize > 5000:
			pageSize = 5000
		case pageSize <= 0:
			pageSize = 10 // 默认 10 条
		}

		offset := (page - 1) * pageSize
		return db.Offset(offset).Limit(pageSize)
	}
}

// PaginateUnlimited 不限制 pageSize 的分页函数，用于全量数据获取
func PaginateUnlimited(page, pageSize int) func(db *gorm.DB) *gorm.DB {
	return func(db *gorm.DB) *gorm.DB {
		if page <= 0 {
			page = 1
		}
		if pageSize <= 0 {
			pageSize = 10000 // 默认大值
		}
		offset := (page - 1) * pageSize
		return db.Offset(offset).Limit(pageSize)
	}
}
