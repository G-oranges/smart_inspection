package service

import (
	"encoding/json"
	"strconv"
	"strings"

	"github.com/my-project/backend-go/internal/model"
	"github.com/my-project/backend-go/internal/repository"
	"gorm.io/gorm"
)

type ResolvedUserDataScope struct {
	All       bool
	Academic  ResolvedAcademicScope
	Dormitory ResolvedDormitoryScope
}

type ResolvedAcademicScope struct {
	Colleges   map[string]struct{}
	Majors     map[string]struct{}
	ClassNames map[string]struct{}
}

type ResolvedDormitoryScope struct {
	Buildings map[string]struct{}
	Floors    map[string]map[int]struct{}
	Rooms     map[string]map[int]map[string]struct{}
}

func newResolvedUserDataScope() *ResolvedUserDataScope {
	return &ResolvedUserDataScope{
		Academic: ResolvedAcademicScope{
			Colleges:   make(map[string]struct{}),
			Majors:     make(map[string]struct{}),
			ClassNames: make(map[string]struct{}),
		},
		Dormitory: ResolvedDormitoryScope{
			Buildings: make(map[string]struct{}),
			Floors:    make(map[string]map[int]struct{}),
			Rooms:     make(map[string]map[int]map[string]struct{}),
		},
	}
}

func ResolveUserDataScopeByUserID(db *gorm.DB, userID string) (*ResolvedUserDataScope, error) {
	var user model.User
	if err := db.Preload("Roles").First(&user, "id = ?", userID).Error; err != nil {
		return nil, err
	}
	return ResolveUserDataScope(db, &user)
}

func ResolveUserEffectiveRoles(db *gorm.DB, user *model.User) ([]model.RoleEntity, error) {
	if user == nil {
		return []model.RoleEntity{}, nil
	}

	rolesByCode := make(map[string]model.RoleEntity)
	for _, role := range user.Roles {
		normalized := normalizeRoleEntity(role)
		if normalized.Code == "" {
			continue
		}
		rolesByCode[normalized.Code] = normalized
	}

	primaryCode := strings.ToUpper(strings.TrimSpace(user.Role))
	if primaryCode != "" {
		if _, exists := rolesByCode[primaryCode]; !exists {
			var primaryRole model.RoleEntity
			if err := db.Where("code = ?", primaryCode).First(&primaryRole).Error; err == nil {
				rolesByCode[primaryCode] = normalizeRoleEntity(primaryRole)
			} else if _, ok := defaultRoleMeta[primaryCode]; ok {
				rolesByCode[primaryCode] = normalizeRoleEntity(model.RoleEntity{
					Code: primaryCode,
					Name: primaryCode,
				})
			}
		}
	}

	result := make([]model.RoleEntity, 0, len(rolesByCode))
	for _, role := range rolesByCode {
		if strings.EqualFold(strings.TrimSpace(role.Status), "INACTIVE") {
			continue
		}
		result = append(result, role)
	}
	return result, nil
}

func ResolveUserDataScope(db *gorm.DB, user *model.User) (*ResolvedUserDataScope, error) {
	scope := newResolvedUserDataScope()

	roles, err := ResolveUserEffectiveRoles(db, user)
	if err != nil {
		return nil, err
	}
	if len(roles) == 0 {
		return scope, nil
	}

	roleIDs := make([]string, 0, len(roles))
	for _, role := range roles {
		if strings.TrimSpace(role.ID) == "" {
			scope.All = true
			return scope, nil
		}
		roleIDs = append(roleIDs, role.ID)
	}

	var storedScopes []model.RoleDataScope
	if err := db.Where("roleId IN ?", roleIDs).Find(&storedScopes).Error; err != nil {
		return nil, err
	}

	scopesByRoleID := make(map[string]model.RoleDataScope, len(storedScopes))
	for _, item := range storedScopes {
		scopesByRoleID[item.RoleID] = item
	}

	for _, role := range roles {
		stored, exists := scopesByRoleID[role.ID]
		if !exists {
			scope.All = true
			return scope, nil
		}

		mode := strings.ToUpper(strings.TrimSpace(stored.ScopeMode))
		preset := strings.ToUpper(strings.TrimSpace(stored.PresetCode))
		if mode == "" {
			mode = preset
		}
		if mode == "" || mode == "ALL" || preset == "ALL" {
			scope.All = true
			return scope, nil
		}

		var rules RoleDataScopeRules
		if len(stored.RulesJSON) > 0 {
			if err := json.Unmarshal(stored.RulesJSON, &rules); err != nil {
				return nil, err
			}
		}

		switch mode {
		case "ACADEMIC":
			scope.mergeAcademicRules(rules.Academic)
		case "DORMITORY":
			scope.mergeDormitoryRules(rules.Dormitory)
		case "CUSTOM":
			scope.mergeAcademicRules(rules.Academic)
			scope.mergeDormitoryRules(rules.Dormitory)
		default:
			scope.All = true
			return scope, nil
		}
	}

	return scope, nil
}

func ApplyAcademicScopeToStudentQuery(query *gorm.DB, scope *ResolvedUserDataScope) *gorm.DB {
	if scope == nil || scope.All {
		return query
	}
	if !scope.HasAcademicAccess() {
		return query.Where("1 = 0")
	}

	colleges := scope.AcademicColleges()
	majors := scope.AcademicMajors()
	classNames := scope.AcademicClassNames()
	condition := query.Session(&gorm.Session{NewDB: true})
	started := false
	if len(colleges) > 0 {
		condition = condition.Where("student.college IN ?", colleges)
		started = true
	}
	if len(majors) > 0 {
		if started {
			condition = condition.Or("student.major IN ?", majors)
		} else {
			condition = condition.Where("student.major IN ?", majors)
			started = true
		}
	}
	if len(classNames) > 0 {
		if started {
			condition = condition.Or("student.className IN ?", classNames)
		} else {
			condition = condition.Where("student.className IN ?", classNames)
			started = true
		}
	}
	if !started {
		return query.Where("1 = 0")
	}
	return query.Where(condition)
}

func ApplyDormitoryScopeToDormQuery(query *gorm.DB, scope *ResolvedUserDataScope) *gorm.DB {
	if scope == nil || scope.All {
		return query
	}

	dormScope := scope.ToDormitoryScope()
	if dormScope == nil {
		return query.Where("1 = 0")
	}

	hasAnyScope := len(dormScope.Buildings) > 0 || len(dormScope.Floors) > 0 || len(dormScope.Rooms) > 0
	if !hasAnyScope {
		return query.Where("1 = 0")
	}

	condition := query.Session(&gorm.Session{NewDB: true})
	started := false

	if len(dormScope.Buildings) > 0 {
		condition = condition.Where("building IN ?", dormScope.Buildings)
		started = true
	}
	for _, floor := range dormScope.Floors {
		if floor.Building == "" {
			continue
		}
		if started {
			condition = condition.Or("(building = ? AND floor = ?)", floor.Building, floor.Floor)
		} else {
			condition = condition.Where("(building = ? AND floor = ?)", floor.Building, floor.Floor)
			started = true
		}
	}
	for _, room := range dormScope.Rooms {
		if room.Building == "" || room.RoomNo == "" {
			continue
		}
		if started {
			condition = condition.Or("(building = ? AND floor = ? AND roomNo = ?)", room.Building, room.Floor, room.RoomNo)
		} else {
			condition = condition.Where("(building = ? AND floor = ? AND roomNo = ?)", room.Building, room.Floor, room.RoomNo)
			started = true
		}
	}

	if !started {
		return query.Where("1 = 0")
	}
	return query.Where(condition)
}

func (s *ResolvedUserDataScope) HasAcademicAccess() bool {
	if s == nil || s.All {
		return true
	}
	return len(s.Academic.Colleges) > 0 || len(s.Academic.Majors) > 0 || len(s.Academic.ClassNames) > 0
}

func (s *ResolvedUserDataScope) HasDormitoryAccess() bool {
	if s == nil || s.All {
		return true
	}
	return len(s.Dormitory.Buildings) > 0 || len(s.Dormitory.Floors) > 0 || len(s.Dormitory.Rooms) > 0
}

func (s *ResolvedUserDataScope) AcademicColleges() []string {
	return sortedMapKeys(s.Academic.Colleges)
}

func (s *ResolvedUserDataScope) AcademicMajors() []string {
	return sortedMapKeys(s.Academic.Majors)
}

func (s *ResolvedUserDataScope) AcademicClassNames() []string {
	return sortedMapKeys(s.Academic.ClassNames)
}

func (s *ResolvedUserDataScope) AllowsBuilding(building string) bool {
	if s == nil || s.All {
		return true
	}
	building = strings.TrimSpace(building)
	if building == "" {
		return false
	}
	if _, ok := s.Dormitory.Buildings[building]; ok {
		return true
	}
	if _, ok := s.Dormitory.Floors[building]; ok {
		return true
	}
	if _, ok := s.Dormitory.Rooms[building]; ok {
		return true
	}
	return false
}

func (s *ResolvedUserDataScope) AllowsFloor(building string, floor int) bool {
	if s == nil || s.All {
		return true
	}
	building = strings.TrimSpace(building)
	if building == "" {
		return false
	}
	if _, ok := s.Dormitory.Buildings[building]; ok {
		return true
	}
	if allowedFloors, ok := s.Dormitory.Floors[building]; ok {
		if _, ok := allowedFloors[floor]; ok {
			return true
		}
	}
	if allowedRooms, ok := s.Dormitory.Rooms[building]; ok {
		if floors, ok := allowedRooms[floor]; ok && len(floors) > 0 {
			return true
		}
	}
	return false
}

func (s *ResolvedUserDataScope) AllowsRoom(building string, floor int, roomNo string) bool {
	if s == nil || s.All {
		return true
	}
	building = strings.TrimSpace(building)
	roomNo = strings.TrimSpace(roomNo)
	if building == "" || roomNo == "" {
		return false
	}
	if _, ok := s.Dormitory.Buildings[building]; ok {
		return true
	}
	if allowedFloors, ok := s.Dormitory.Floors[building]; ok {
		if _, ok := allowedFloors[floor]; ok {
			return true
		}
	}
	if allowedRooms, ok := s.Dormitory.Rooms[building]; ok {
		if rooms, ok := allowedRooms[floor]; ok {
			if _, ok := rooms[roomNo]; ok {
				return true
			}
		}
	}
	return false
}

func (s *ResolvedUserDataScope) ToDormitoryScope() *repository.DormitoryScope {
	if s == nil || s.All || !s.HasDormitoryAccess() {
		return nil
	}

	scope := &repository.DormitoryScope{
		Buildings: sortedMapKeys(s.Dormitory.Buildings),
		Floors:    make([]repository.DormitoryScopeFloor, 0),
		Rooms:     make([]repository.DormitoryScopeRoom, 0),
	}

	for building, floors := range s.Dormitory.Floors {
		for floor := range floors {
			scope.Floors = append(scope.Floors, repository.DormitoryScopeFloor{
				Building: building,
				Floor:    floor,
			})
		}
	}
	for building, floors := range s.Dormitory.Rooms {
		for floor, rooms := range floors {
			for room := range rooms {
				scope.Rooms = append(scope.Rooms, repository.DormitoryScopeRoom{
					Building: building,
					Floor:    floor,
					RoomNo:   room,
				})
			}
		}
	}

	return scope
}

func (s *ResolvedUserDataScope) mergeAcademicRules(rules map[string][]string) {
	for _, value := range rules["college"] {
		if trimmed := strings.TrimSpace(value); trimmed != "" {
			s.Academic.Colleges[trimmed] = struct{}{}
		}
	}
	for _, value := range rules["major"] {
		if trimmed := strings.TrimSpace(value); trimmed != "" {
			s.Academic.Majors[trimmed] = struct{}{}
		}
	}
	for _, value := range rules["className"] {
		if trimmed := strings.TrimSpace(value); trimmed != "" {
			s.Academic.ClassNames[trimmed] = struct{}{}
		}
	}
}

func (s *ResolvedUserDataScope) mergeDormitoryRules(rules map[string][]string) {
	for _, value := range rules["building"] {
		if trimmed := strings.TrimSpace(value); trimmed != "" {
			s.Dormitory.Buildings[trimmed] = struct{}{}
		}
	}
	for _, value := range rules["floor"] {
		building, floor, ok := parseDormFloorToken(value)
		if !ok {
			continue
		}
		if _, exists := s.Dormitory.Floors[building]; !exists {
			s.Dormitory.Floors[building] = make(map[int]struct{})
		}
		s.Dormitory.Floors[building][floor] = struct{}{}
	}
	for _, value := range rules["room"] {
		building, floor, roomNo, ok := parseDormRoomToken(value)
		if !ok {
			continue
		}
		if _, exists := s.Dormitory.Rooms[building]; !exists {
			s.Dormitory.Rooms[building] = make(map[int]map[string]struct{})
		}
		if _, exists := s.Dormitory.Rooms[building][floor]; !exists {
			s.Dormitory.Rooms[building][floor] = make(map[string]struct{})
		}
		s.Dormitory.Rooms[building][floor][roomNo] = struct{}{}
	}
}

func parseDormFloorToken(value string) (string, int, bool) {
	parts := strings.Split(strings.TrimSpace(value), "::")
	if len(parts) == 2 {
		floor, err := strconv.Atoi(strings.TrimSpace(parts[1]))
		if err != nil {
			return "", 0, false
		}
		return strings.TrimSpace(parts[0]), floor, true
	}
	if len(parts) == 1 {
		floor, err := strconv.Atoi(strings.TrimSpace(parts[0]))
		if err != nil {
			return "", 0, false
		}
		return "", floor, true
	}
	return "", 0, false
}

func parseDormRoomToken(value string) (string, int, string, bool) {
	parts := strings.Split(strings.TrimSpace(value), "::")
	if len(parts) != 3 {
		return "", 0, "", false
	}
	floor, err := strconv.Atoi(strings.TrimSpace(parts[1]))
	if err != nil {
		return "", 0, "", false
	}
	building := strings.TrimSpace(parts[0])
	roomNo := strings.TrimSpace(parts[2])
	if building == "" || roomNo == "" {
		return "", 0, "", false
	}
	return building, floor, roomNo, true
}

func sortedMapKeys(values map[string]struct{}) []string {
	result := make([]string, 0, len(values))
	for value := range values {
		result = append(result, value)
	}
	if len(result) <= 1 {
		return result
	}
	for index := 0; index < len(result)-1; index++ {
		for next := index + 1; next < len(result); next++ {
			if result[index] > result[next] {
				result[index], result[next] = result[next], result[index]
			}
		}
	}
	return result
}
