/**
 * 数据范围编辑相关的纯函数（角色范围与账号单独范围共用）。
 * @module pages/account-permission/scopeUtils
 */

import type {
  EntityId,
  RoleDataScope,
  RoleDataScopeRules,
  ScopeOptionsResponse,
  ScopePresetCode,
} from '../../types/service';

export type ScopeEditorMode = ScopePresetCode | 'INHERIT';

export const PRESET_OPTIONS: Array<{ value: ScopePresetCode; label: string }> = [
  { value: 'OWN_COLLEGE', label: '本学院' },
  { value: 'SELF', label: '仅本人数据' },
  { value: 'ACADEMIC', label: '按学院范围' },
  { value: 'DORMITORY', label: '按楼栋范围' },
  { value: 'CUSTOM', label: '自定义组合（学院 + 楼栋）' },
  { value: 'ALL', label: '全部数据' },
];

/** 账号单独设置时额外提供“跟随角色”选项 */
export const INHERIT_OPTION = { value: 'INHERIT' as const, label: '跟随角色（不单独设置）' };

export const PRESET_HINTS: Record<ScopeEditorMode, string> = {
  INHERIT: '该账号按其角色的数据范围计算；多个角色时合并生效。',
  OWN_COLLEGE:
    '只看本人所在学院（账号的部门/学院）的学生，以及这些学生入住的宿舍、查寝结果和任务。账号未填写学院时看不到数据。',
  SELF: '学生只能看到本人宿舍的数据；教职工没有本人宿舍，相当于看不到他人数据。',
  ACADEMIC: '可见所选学院/专业/班级的学生，以及这些学生入住的宿舍、查寝结果和任务。',
  DORMITORY: '可见所选楼栋/楼层/房间的宿舍、查寝结果和任务；看不到学生名单。',
  CUSTOM: '学院规则与楼栋规则同时生效，可见范围为两者合并。',
  ALL: '可见全校全部数据，请仅授予管理类角色。',
};

export const SCOPE_DEFAULTS_HINT = '未配置时：管理员为全部数据，学生为仅本人，其他角色为本学院。';

export const ACADEMIC_RULE_HINT =
  '按层级收窄：选了学院再选其下的专业，只看这些专业；再选其下的班级，只看这些班级。不属于已选学院的专业或班级会额外加入。';

/** 权限模块编码 -> 中文名称 */
export const PERMISSION_MODULE_LABELS: Record<string, string> = {
  user: '用户管理',
  account: '权限配置',
  system: '系统设置',
  student: '学生信息',
  teacher: '教职工',
  dorm: '宿舍与入住',
  task: '查寝任务',
  result: '查寝结果',
};

export function permissionModuleLabel(module: string): string {
  return PERMISSION_MODULE_LABELS[module.toLowerCase()] || module;
}

export function createEmptyRules(): RoleDataScopeRules {
  return {
    academic: { college: [], major: [], className: [] },
    dormitory: { building: [], floor: [], room: [] },
  };
}

export function createDefaultScope(roleId?: EntityId): RoleDataScope {
  return { roleId, scopeMode: 'OWN_COLLEGE', presetCode: 'OWN_COLLEGE', rules: createEmptyRules() };
}

export function normalizeScope(roleId: EntityId | undefined, value?: RoleDataScope | null): RoleDataScope {
  const fallback = createDefaultScope(roleId);
  const mode = value?.presetCode || value?.scopeMode || fallback.presetCode;
  return {
    ...fallback,
    ...value,
    roleId: value?.roleId ?? roleId,
    scopeMode: String(mode),
    presetCode: mode as ScopePresetCode | string,
    rules: {
      ...createEmptyRules(),
      ...(value?.rules || {}),
      academic: { ...createEmptyRules().academic, ...(value?.rules?.academic || {}) },
      dormitory: { ...createEmptyRules().dormitory, ...(value?.rules?.dormitory || {}) },
    },
  };
}

export function resetScopeForPreset(scope: RoleDataScope, preset: ScopeEditorMode): RoleDataScope {
  const nextScope = normalizeScope(scope.roleId, scope);
  nextScope.scopeMode = preset;
  nextScope.presetCode = preset;
  if (preset === 'ALL' || preset === 'SELF' || preset === 'OWN_COLLEGE' || preset === 'INHERIT') {
    nextScope.rules = createEmptyRules();
  }
  if (preset === 'ACADEMIC') {
    nextScope.rules = { ...nextScope.rules, dormitory: createEmptyRules().dormitory };
  }
  if (preset === 'DORMITORY') {
    nextScope.rules = { ...nextScope.rules, academic: createEmptyRules().academic };
  }
  return nextScope;
}

export function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value && value.trim()))));
}

type AcademicRecord = NonNullable<ScopeOptionsResponse['academic']>[number];

/**
 * 级联选项：专业只列出已选学院下的专业，班级只列出已选专业（或学院）下的班级。
 * 已选中的值即使不在过滤结果里也保留，避免已有配置在界面上“消失”。
 */
export function buildAcademicOptions(records: AcademicRecord[] = [], selected: RoleDataScopeRules['academic']) {
  const selectedColleges = selected?.college || [];
  const selectedMajors = selected?.major || [];
  const majorRecords = selectedColleges.length
    ? records.filter((record) => selectedColleges.includes(record.college))
    : records;
  const classRecords = selectedMajors.length
    ? records.filter((record) => selectedMajors.includes(record.major))
    : majorRecords;
  return {
    colleges: uniqueStrings(records.map((item) => item.college)),
    majors: uniqueStrings([...majorRecords.map((item) => item.major), ...selectedMajors]),
    classNames: uniqueStrings([...classRecords.map((item) => item.className), ...(selected?.className || [])]),
  };
}

export type DormTreeNode = { title: string; value: string; key: string; children?: DormTreeNode[] };

export function buildDormTree(dorms: ScopeOptionsResponse['dorms'] = []): DormTreeNode[] {
  const byBuilding = new Map<string, Map<string, string[]>>();
  dorms.forEach((item) => {
    const building = String(item.building || '').trim();
    const floor = String(item.floor ?? '').trim();
    const room = String(item.roomNo || '').trim();
    if (!building) {
      return;
    }
    const floorMap = byBuilding.get(building) || new Map<string, string[]>();
    const rooms = floorMap.get(floor) || [];
    if (room) {
      rooms.push(room);
    }
    floorMap.set(floor, rooms);
    byBuilding.set(building, floorMap);
  });

  const treeData: DormTreeNode[] = [];
  byBuilding.forEach((floorMap, building) => {
    treeData.push({
      title: building,
      key: `B::${building}`,
      value: `B::${building}`,
      children: Array.from(floorMap.entries()).map(([floor, rooms]) => ({
        title: floor ? `${floor} 层` : '未分层',
        key: `F::${building}::${floor}`,
        value: `F::${building}::${floor}`,
        children: rooms
          .sort((left, right) => left.localeCompare(right, 'zh-CN'))
          .map((room) => ({
            title: room,
            key: `R::${building}::${floor}::${room}`,
            value: `R::${building}::${floor}::${room}`,
          })),
      })),
    });
  });
  return treeData.sort((left, right) => left.title.localeCompare(right.title, 'zh-CN'));
}

export function dormTreeValuesFromRules(scope: RoleDataScope): string[] {
  const dormitory = scope.rules?.dormitory;
  return [
    ...(dormitory?.building || []).map((value) => `B::${value}`),
    ...(dormitory?.floor || []).map((value) => `F::${value}`),
    ...(dormitory?.room || []).map((value) => `R::${value}`),
  ];
}

export function updateDormRulesFromTree(scope: RoleDataScope, values: string[]): RoleDataScope {
  const nextScope = normalizeScope(scope.roleId, scope);
  const pick = (prefix: string) => values.filter((value) => value.startsWith(prefix)).map((value) => value.slice(3));
  nextScope.rules = {
    ...nextScope.rules,
    dormitory: { building: pick('B::'), floor: pick('F::'), room: pick('R::') },
  };
  return nextScope;
}
