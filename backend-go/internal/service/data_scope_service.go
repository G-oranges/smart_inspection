package service

import (
	"encoding/json"
	"errors"
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
	// DormIDs 由学院/专业/班级范围推导：范围内学生入住的宿舍，同样可见
	DormIDs map[string]struct{}
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
			DormIDs:   make(map[string]struct{}),
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

// 数据范围模式。
//   - SELF：仅本人相关数据（学生为本人宿舍；教职工没有本人宿舍，相当于无数据）
//   - OWN_COLLEGE：本人所在学院（取账号的部门/学院，学生取学籍中的学院）
const (
	DataScopeModeAll        = "ALL"
	DataScopeModeAcademic   = "ACADEMIC"
	DataScopeModeDormitory  = "DORMITORY"
	DataScopeModeCustom     = "CUSTOM"
	DataScopeModeSelf       = "SELF"
	DataScopeModeOwnCollege = "OWN_COLLEGE"
)

// DefaultDataScopeModeForRole 角色没有配置数据范围时的默认模式：
// 管理员为全部数据，学生为仅本人，其余角色为本学院。
func DefaultDataScopeModeForRole(roleCode string) string {
	switch strings.ToUpper(strings.TrimSpace(roleCode)) {
	case model.RoleAdmin:
		return DataScopeModeAll
	case model.RoleStudent:
		return DataScopeModeSelf
	default:
		return DataScopeModeOwnCollege
	}
}

// ResolveUserDataScope 计算用户的数据范围。
//  1. 账号单独设置了数据范围时，只按账号设置计算
//  2. 否则按用户所有有效角色的范围取并集；角色未配置时使用 DefaultDataScopeModeForRole
//
// 学院、专业、班级规则按层级收窄；范围内学生入住的宿舍也一并可见。
func ResolveUserDataScope(db *gorm.DB, user *model.User) (*ResolvedUserDataScope, error) {
	scope := newResolvedUserDataScope()
	if user == nil {
		return scope, nil
	}
	resolver := &scopeResolver{db: db, user: user, scope: scope}

	if user.ID != "" {
		var userScope model.UserDataScope
		err := db.Where("userId = ?", user.ID).First(&userScope).Error
		if err == nil {
			rules, err := decodeScopeRules(userScope.RulesJSON)
			if err != nil {
				return nil, err
			}
			if err := resolver.apply(strings.ToUpper(strings.TrimSpace(userScope.ScopeMode)), rules); err != nil {
				return nil, err
			}
			return resolver.finish()
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) && !isMissingTableError(err) {
			return nil, err
		}
	}

	roles, err := ResolveUserEffectiveRoles(db, user)
	if err != nil {
		return nil, err
	}
	if len(roles) == 0 {
		return scope, nil
	}

	roleIDs := make([]string, 0, len(roles))
	for _, role := range roles {
		if strings.TrimSpace(role.ID) != "" {
			roleIDs = append(roleIDs, role.ID)
		}
	}
	scopesByRoleID := make(map[string]model.RoleDataScope)
	if len(roleIDs) > 0 {
		var storedScopes []model.RoleDataScope
		if err := db.Where("roleId IN ?", roleIDs).Find(&storedScopes).Error; err != nil {
			return nil, err
		}
		for _, item := range storedScopes {
			scopesByRoleID[item.RoleID] = item
		}
	}

	for _, role := range roles {
		mode := DefaultDataScopeModeForRole(role.Code)
		var rules RoleDataScopeRules
		if stored, exists := scopesByRoleID[role.ID]; exists && strings.TrimSpace(role.ID) != "" {
			mode = strings.ToUpper(strings.TrimSpace(stored.ScopeMode))
			if mode == "" {
				mode = strings.ToUpper(strings.TrimSpace(stored.PresetCode))
			}
			if mode == "" {
				mode = DataScopeModeAll
			}
			if rules, err = decodeScopeRules(stored.RulesJSON); err != nil {
				return nil, err
			}
		}
		if err := resolver.apply(mode, rules); err != nil {
			return nil, err
		}
		if scope.All {
			return scope, nil
		}
	}

	return resolver.finish()
}

type scopeResolver struct {
	db         *gorm.DB
	user       *model.User
	scope      *ResolvedUserDataScope
	selfMerged bool
	ownCollege *string
}

func (r *scopeResolver) apply(mode string, rules RoleDataScopeRules) error {
	switch mode {
	case DataScopeModeAll:
		r.scope.All = true
	case DataScopeModeSelf:
		if !r.selfMerged {
			r.selfMerged = true
			return mergeSelfScope(r.db, r.user, r.scope)
		}
	case DataScopeModeOwnCollege:
		college, err := r.userCollege()
		if err != nil {
			return err
		}
		if college != "" {
			r.scope.mergeAcademicRules(map[string][]string{"college": {college}})
		}
	case DataScopeModeAcademic, DataScopeModeDormitory, DataScopeModeCustom:
		if mode != DataScopeModeDormitory {
			narrowed, err := narrowAcademicRules(r.db, rules.Academic)
			if err != nil {
				return err
			}
			r.scope.mergeAcademicRules(narrowed)
		}
		if mode != DataScopeModeAcademic {
			r.scope.mergeDormitoryRules(rules.Dormitory)
		}
	default:
		// 未知模式按最严格处理：不授予任何数据
	}
	return nil
}

func (r *scopeResolver) userCollege() (string, error) {
	if r.ownCollege == nil {
		college, err := ResolveUserCollege(r.db, r.user)
		if err != nil {
			return "", err
		}
		r.ownCollege = &college
	}
	return *r.ownCollege, nil
}

// finish 把学院/专业/班级范围内学生入住的宿舍加入可见宿舍。
func (r *scopeResolver) finish() (*ResolvedUserDataScope, error) {
	if r.scope.All || !r.scope.HasAcademicAccess() {
		return r.scope, nil
	}
	academicOnly := newResolvedUserDataScope()
	academicOnly.Academic = r.scope.Academic
	var dormIDs []string
	if err := ApplyAcademicScopeToStudentQuery(r.db.Model(&model.Student{}), academicOnly).
		Where("student.dormId IS NOT NULL AND student.dormId <> ''").
		Distinct("student.dormId").
		Pluck("student.dormId", &dormIDs).Error; err != nil {
		return nil, err
	}
	for _, dormID := range dormIDs {
		if trimmed := strings.TrimSpace(dormID); trimmed != "" {
			r.scope.Dormitory.DormIDs[trimmed] = struct{}{}
		}
	}
	return r.scope, nil
}

// ResolveUserCollege 返回账号所属学院：优先取账号的部门，其次学生学籍中的学院、教职工档案中的部门。
func ResolveUserCollege(db *gorm.DB, user *model.User) (string, error) {
	if user == nil {
		return "", nil
	}
	if department := strings.TrimSpace(ptrToString(user.Department)); department != "" {
		return department, nil
	}
	profile, err := findIdentityProfile(db, user, true, false)
	if err != nil {
		return "", err
	}
	if profile != nil {
		return strings.TrimSpace(ptrToString(profile.Department)), nil
	}
	return "", nil
}

func decodeScopeRules(raw []byte) (RoleDataScopeRules, error) {
	var rules RoleDataScopeRules
	if len(raw) == 0 {
		return rules, nil
	}
	err := json.Unmarshal(raw, &rules)
	return rules, err
}

// isMissingTableError 兼容尚未建表的旧库/测试库（如 userdatascope、teacher）。
func isMissingTableError(err error) bool {
	if err == nil {
		return false
	}
	message := err.Error()
	return strings.Contains(message, "no such table") || strings.Contains(message, "Error 1146")
}

// narrowAcademicRules 按“学院 > 专业 > 班级”层级收窄规则：
// 若所选专业属于所选学院，则该学院只保留所选专业；若所选班级属于所选专业/学院，则只保留所选班级。
// 不属于任何已选上级的专业/班级照常生效（与其他规则取并集）。
func narrowAcademicRules(db *gorm.DB, rules map[string][]string) (map[string][]string, error) {
	colleges := toSet(rules["college"])
	majors := toSet(rules["major"])
	classNames := toSet(rules["className"])
	resultColleges := toSet(rules["college"])
	resultMajors := toSet(rules["major"])

	type academicRow struct {
		College   *string `gorm:"column:college"`
		Major     *string `gorm:"column:major"`
		ClassName *string `gorm:"column:className"`
	}

	if len(majors) > 0 && len(colleges) > 0 {
		var rows []academicRow
		if err := db.Model(&model.Student{}).Distinct("college", "major").
			Where("major IN ?", sortedMapKeys(majors)).Scan(&rows).Error; err != nil {
			return nil, err
		}
		for _, row := range rows {
			if college := strings.TrimSpace(ptrToString(row.College)); college != "" {
				if _, ok := colleges[college]; ok {
					delete(resultColleges, college)
				}
			}
		}
	}
	if len(classNames) > 0 && (len(majors) > 0 || len(colleges) > 0) {
		var rows []academicRow
		if err := db.Model(&model.Student{}).Distinct("college", "major", "className").
			Where("className IN ?", sortedMapKeys(classNames)).Scan(&rows).Error; err != nil {
			return nil, err
		}
		for _, row := range rows {
			if major := strings.TrimSpace(ptrToString(row.Major)); major != "" {
				if _, ok := majors[major]; ok {
					delete(resultMajors, major)
				}
			}
			if college := strings.TrimSpace(ptrToString(row.College)); college != "" {
				if _, ok := colleges[college]; ok {
					delete(resultColleges, college)
				}
			}
		}
	}

	return map[string][]string{
		"college":   sortedMapKeys(resultColleges),
		"major":     sortedMapKeys(resultMajors),
		"className": sortedMapKeys(classNames),
	}, nil
}

func toSet(values []string) map[string]struct{} {
	set := make(map[string]struct{}, len(values))
	for _, value := range values {
		if trimmed := strings.TrimSpace(value); trimmed != "" {
			set[trimmed] = struct{}{}
		}
	}
	return set
}

func ptrToString(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

// mergeSelfScope 把“本人相关数据”并入范围：学生为其入住的宿舍房间；未入住或非学生时不增加任何数据。
func mergeSelfScope(db *gorm.DB, user *model.User, scope *ResolvedUserDataScope) error {
	if user == nil {
		return nil
	}
	var student model.Student
	err := db.Preload("Dorm").Where("userId = ?", user.ID).First(&student).Error
	if err != nil && strings.TrimSpace(user.Username) != "" {
		err = db.Preload("Dorm").Where("studentNo = ?", user.Username).First(&student).Error
	}
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil
		}
		return err
	}
	dorm := student.Dorm
	if dorm == nil || dorm.Building == nil || dorm.RoomNo == nil {
		return nil
	}
	floor := 0
	if dorm.Floor != nil {
		floor = *dorm.Floor
	}
	scope.mergeDormitoryRules(map[string][]string{
		"room": {strings.TrimSpace(*dorm.Building) + "::" + strconv.Itoa(floor) + "::" + strings.TrimSpace(*dorm.RoomNo)},
	})
	return nil
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

	hasAnyScope := len(dormScope.Buildings) > 0 || len(dormScope.Floors) > 0 || len(dormScope.Rooms) > 0 || len(dormScope.DormIDs) > 0
	if !hasAnyScope {
		return query.Where("1 = 0")
	}

	condition := query.Session(&gorm.Session{NewDB: true})
	started := false
	if len(dormScope.DormIDs) > 0 {
		condition = condition.Where("id IN ?", dormScope.DormIDs)
		started = true
	}

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

func (scope *ResolvedUserDataScope) AllowsStudentAcademic(student *model.Student) bool {
	if scope == nil || scope.All {
		return true
	}
	if student == nil || !scope.HasAcademicAccess() {
		return false
	}

	college := strings.TrimSpace(ptrToString(student.College))
	if college != "" {
		if _, ok := scope.Academic.Colleges[college]; ok {
			return true
		}
	}

	major := strings.TrimSpace(ptrToString(student.Major))
	if major != "" {
		if _, ok := scope.Academic.Majors[major]; ok {
			return true
		}
	}

	className := strings.TrimSpace(ptrToString(student.ClassName))
	if className != "" {
		if _, ok := scope.Academic.ClassNames[className]; ok {
			return true
		}
	}

	return false
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
	return len(s.Dormitory.Buildings) > 0 || len(s.Dormitory.Floors) > 0 || len(s.Dormitory.Rooms) > 0 || len(s.Dormitory.DormIDs) > 0
}

// AllowsDormID 宿舍是否因“范围内学生入住”而可见。
func (s *ResolvedUserDataScope) AllowsDormID(dormID string) bool {
	if s == nil || s.All {
		return true
	}
	_, ok := s.Dormitory.DormIDs[strings.TrimSpace(dormID)]
	return ok
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
		DormIDs:   sortedMapKeys(s.Dormitory.DormIDs),
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
