package service

import (
	"errors"
	"testing"

	"gorm.io/datatypes"
)

func TestAppealDeductionAdjustmentValidation(t *testing.T) {
	config, err := deductionConfig(datatypes.JSON(`[
		{"code":"A","points":3,"maxPoints":9,"enabled":true},
		{"code":"B","points":10,"maxPoints":"20"},
		{"code":"OFF","points":5,"enabled":false}
	]`))
	if err != nil {
		t.Fatal(err)
	}
	rows := []DeductionRow{{ID: "a", Code: "A", Count: 2, Locations: []string{"阳台"}}}
	for name, adjustments := range map[string][]DeductionAdjustment{
		"existing":      {{Code: "A", Action: "add", Count: appealValue(1)}},
		"disabled":      {{Code: "OFF", Action: "add", Count: appealValue(1)}},
		"over maximum":  {{Code: "B", Action: "add", Count: appealValue(3)}},
		"repeat code":   {{Code: "A", Action: "keep"}, {Code: "A", Action: "remove"}},
		"missing code":  {{Code: "B", Action: "remove"}},
		"invalid count": {{Code: "A", Action: "update", Count: appealValue(0)}},
	} {
		t.Run(name, func(t *testing.T) {
			if _, err := applyDeductionAdjustments(rows, adjustments, config); !errors.Is(err, ErrAppealInvalid) {
				t.Fatalf("expected invalid adjustment, got %v", err)
			}
		})
	}
	result, err := applyDeductionAdjustments(rows, []DeductionAdjustment{{Code: "A", Action: "update", Count: appealValue(3), Locations: appealValue([]string{})}}, config)
	if err != nil || result[0].Count != 3 || len(result[0].Locations) != 0 || rows[0].Count != 2 {
		t.Fatalf("update incorrect: %+v (%v)", result, err)
	}
	result, err = applyDeductionAdjustments(rows, []DeductionAdjustment{{Code: "A", Action: "remove"}}, config)
	if err != nil || len(result) != 0 {
		t.Fatalf("remove incorrect: %+v (%v)", result, err)
	}
}

func TestAppealScoreClamped(t *testing.T) {
	for _, tc := range []struct {
		name           string
		original, want int
		adjustment     DeductionAdjustment
	}{
		{"minimum", 1, 0, DeductionAdjustment{Code: "B", Action: "add", Count: appealValue(2)}},
		{"maximum", 98, 100, DeductionAdjustment{Code: "A", Action: "remove"}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			f := newAppealFixture(t)
			if err := f.db.Table("inspection").Where("id = ?", f.input.InspectionID).UpdateColumn("totalScore", tc.original).Error; err != nil {
				t.Fatal(err)
			}
			appeal := f.submit(t)
			in := f.decision(appeal.ID)
			in.Adjustments = []DeductionAdjustment{tc.adjustment}
			result, err := f.service.ProcessAppeal(in)
			if err != nil || result.AdjustedScore == nil || *result.AdjustedScore != tc.want {
				t.Fatalf("expected %d, got %+v (%v)", tc.want, result, err)
			}
		})
	}
}
