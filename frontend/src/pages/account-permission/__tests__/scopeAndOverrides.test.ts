import { describe, expect, it } from 'vitest';

import { buildOverrides } from '../overrideUtils';
import {
  buildAcademicOptions,
  buildDormTree,
  normalizeScope,
  permissionModuleLabel,
  resetScopeForPreset,
  updateDormRulesFromTree,
} from '../scopeUtils';

const records = [
  { college: '工学院', major: '机械', className: '机械1班' },
  { college: '工学院', major: '电气', className: '电气1班' },
  { college: '理学院', major: '数学', className: '数学1班' },
];

describe('buildAcademicOptions', () => {
  it('lists every option when nothing is selected', () => {
    const options = buildAcademicOptions(records, {});
    expect(options.colleges).toEqual(['工学院', '理学院']);
    expect(options.majors).toEqual(['机械', '电气', '数学']);
  });

  it('cascades majors and classes from the selected parents', () => {
    const byCollege = buildAcademicOptions(records, { college: ['工学院'] });
    expect(byCollege.majors).toEqual(['机械', '电气']);
    expect(byCollege.classNames).toEqual(['机械1班', '电气1班']);

    const byMajor = buildAcademicOptions(records, { college: ['工学院'], major: ['机械'] });
    expect(byMajor.classNames).toEqual(['机械1班']);
  });

  it('keeps already selected values visible even if they fall outside the filter', () => {
    const options = buildAcademicOptions(records, { college: ['工学院'], major: ['数学'], className: ['数学1班'] });
    expect(options.majors).toContain('数学');
    expect(options.classNames).toContain('数学1班');
  });
});

describe('scope helpers', () => {
  it('clears rules when switching to a mode without rules', () => {
    const scope = normalizeScope('r1', {
      presetCode: 'CUSTOM',
      rules: { academic: { college: ['工学院'] }, dormitory: { building: ['1号楼'] } },
    });
    for (const mode of ['ALL', 'SELF', 'OWN_COLLEGE', 'INHERIT'] as const) {
      const next = resetScopeForPreset(scope, mode);
      expect(next.presetCode).toBe(mode);
      expect(next.rules?.academic?.college).toEqual([]);
      expect(next.rules?.dormitory?.building).toEqual([]);
    }
    expect(resetScopeForPreset(scope, 'ACADEMIC').rules?.academic?.college).toEqual(['工学院']);
    expect(resetScopeForPreset(scope, 'ACADEMIC').rules?.dormitory?.building).toEqual([]);
  });

  it('defaults to OWN_COLLEGE when no mode is given', () => {
    expect(normalizeScope(undefined, null).presetCode).toBe('OWN_COLLEGE');
  });

  it('builds the dorm tree and maps selections back to rules', () => {
    const tree = buildDormTree([
      { building: '1号楼', floor: 2, roomNo: '201' },
      { building: '1号楼', floor: 2, roomNo: '202' },
    ]);
    expect(tree[0].children?.[0].children?.map((node) => node.title)).toEqual(['201', '202']);
    const next = updateDormRulesFromTree(normalizeScope('r1', null), ['B::2号楼', 'R::1号楼::2::201']);
    expect(next.rules?.dormitory).toEqual({ building: ['2号楼'], floor: [], room: ['1号楼::2::201'] });
  });

  it('shows Chinese module names', () => {
    expect(permissionModuleLabel('dorm')).toBe('宿舍与入住');
    expect(permissionModuleLabel('unknown_module')).toBe('unknown_module');
  });
});

describe('buildOverrides', () => {
  it('sends only the permissions that changed relative to the baseline', () => {
    const baseline = { p1: 'deny' as const, p2: 'grant' as const };
    const next = { p1: 'deny' as const, p2: 'inherit' as const, p3: 'grant' as const };
    expect(buildOverrides(next, baseline)).toEqual([
      { permissionId: 'p2', grant: false, inherit: true },
      { permissionId: 'p3', grant: true, inherit: false },
    ]);
  });

  it('returns nothing when nothing changed', () => {
    expect(buildOverrides({ p1: 'grant' }, { p1: 'grant' })).toEqual([]);
    expect(buildOverrides({ p1: 'inherit' }, {})).toEqual([]);
  });
});
