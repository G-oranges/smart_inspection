package utils

import (
	"sort"
	"strings"
)

// SortConfig defines allowed sort fields and defaults.
type SortConfig struct {
	ValidFields  map[string]string
	DefaultField string
	DefaultOrder string
}

// ValidateSortParams returns a safe ORDER BY clause from user input.
func ValidateSortParams(sortField, sortOrder string, config SortConfig) string {
	field := config.DefaultField
	if sortField != "" {
		if _, ok := config.ValidFields[sortField]; ok {
			field = sortField
		}
	}

	dbColumn := config.ValidFields[field]
	if dbColumn == "" {
		dbColumn = field
	}

	order := normalizeSortOrder(sortOrder, config.DefaultOrder)
	return dbColumn + " " + order
}

// GetSortableFields returns a stable list of allowed sort fields.
func GetSortableFields(config SortConfig) []string {
	fields := make([]string, 0, len(config.ValidFields))
	for field := range config.ValidFields {
		fields = append(fields, field)
	}
	sort.Strings(fields)
	return fields
}

func normalizeSortOrder(sortOrder, defaultOrder string) string {
	order := strings.ToLower(strings.TrimSpace(sortOrder))
	switch order {
	case "asc", "ascend":
		return "ASC"
	case "desc", "descend":
		return "DESC"
	}

	if strings.EqualFold(defaultOrder, "DESC") {
		return "DESC"
	}
	return "ASC"
}
