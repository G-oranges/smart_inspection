package utils

import "testing"

func TestValidateSortParams(t *testing.T) {
	config := SortConfig{
		ValidFields: map[string]string{
			"studentNo": "student.studentNo",
			"fullName":  "student.fullName",
		},
		DefaultField: "studentNo",
		DefaultOrder: "ASC",
	}

	cases := []struct {
		name      string
		sortField string
		sortOrder string
		want      string
	}{
		{
			name:      "valid field and order",
			sortField: "fullName",
			sortOrder: "desc",
			want:      "student.fullName DESC",
		},
		{
			name:      "invalid field falls back",
			sortField: "createdAt desc;drop table student--",
			sortOrder: "asc",
			want:      "student.studentNo ASC",
		},
		{
			name:      "invalid order falls back",
			sortField: "fullName",
			sortOrder: "asc;delete",
			want:      "student.fullName ASC",
		},
		{
			name:      "descend alias",
			sortField: "fullName",
			sortOrder: "descend",
			want:      "student.fullName DESC",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := ValidateSortParams(tc.sortField, tc.sortOrder, config)
			if got != tc.want {
				t.Fatalf("expected %q, got %q", tc.want, got)
			}
		})
	}
}

func TestGetSortableFields(t *testing.T) {
	config := SortConfig{
		ValidFields: map[string]string{
			"b": "b",
			"a": "a",
			"c": "c",
		},
		DefaultField: "a",
		DefaultOrder: "ASC",
	}

	got := GetSortableFields(config)
	want := []string{"a", "b", "c"}
	if len(got) != len(want) {
		t.Fatalf("expected %d fields, got %d", len(want), len(got))
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("expected %v, got %v", want, got)
		}
	}
}
