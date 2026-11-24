/**
 * 数据范围编辑器：角色范围与账号单独范围共用。
 * 可选项来自后端 /api/permissions/scope-options（全量学院/专业/班级与楼栋/楼层/房间）。
 * @module pages/account-permission/DataScopeEditor
 */

import { useMemo } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { Alert, Radio, Spin, Tooltip, TreeSelect } from 'antd';
import PanelSelect from '../../components/common/PanelSelect';

import type { RoleDataScope, ScopeOptionsResponse } from '../../types/service';
import {
  INHERIT_OPTION,
  PRESET_HINTS,
  PRESET_OPTIONS,
  SCOPE_DEFAULTS_HINT,
  buildAcademicOptions,
  buildDormTree,
  dormTreeValuesFromRules,
  normalizeScope,
  resetScopeForPreset,
  updateDormRulesFromTree,
} from './scopeUtils';
import type { ScopeEditorMode } from './scopeUtils';

interface DataScopeEditorProps {
  value: RoleDataScope;
  onChange: Dispatch<SetStateAction<RoleDataScope>>;
  options: ScopeOptionsResponse | null;
  optionsError?: string;
  loading?: boolean;
  /** 账号单独设置时显示“跟随角色”选项 */
  allowInherit?: boolean;
}

export default function DataScopeEditor({
  value,
  onChange,
  options,
  optionsError,
  loading,
  allowInherit,
}: DataScopeEditorProps) {
  const mode = (value.presetCode || 'OWN_COLLEGE') as ScopeEditorMode;
  const academicOptions = useMemo(
    () => buildAcademicOptions(options?.academic, value.rules?.academic),
    [options?.academic, value.rules?.academic],
  );
  const dormTreeData = useMemo(() => buildDormTree(options?.dorms), [options?.dorms]);
  const presetOptions = allowInherit ? [INHERIT_OPTION, ...PRESET_OPTIONS] : PRESET_OPTIONS;

  if (loading) {
    return (
      <div className="role-list-empty">
        <Spin />
      </div>
    );
  }

  const updateAcademic = (field: 'college' | 'major' | 'className', next: string[]) =>
    onChange((prev) =>
      normalizeScope(prev.roleId, {
        ...prev,
        rules: { ...prev.rules, academic: { ...prev.rules?.academic, [field]: next } },
      }),
    );

  return (
    <div className="role-scope-editor">
      <Radio.Group
        className="role-scope-presets"
        value={mode}
        onChange={(event) => onChange((prev) => resetScopeForPreset(prev, event.target.value as ScopeEditorMode))}
        options={presetOptions}
      />
      <Alert
        type={mode === 'ALL' ? 'warning' : 'info'}
        showIcon
        message={PRESET_HINTS[mode] || PRESET_HINTS.OWN_COLLEGE}
        description={optionsError || `${SCOPE_DEFAULTS_HINT}多角色合并生效，用户单独设置优先。`}
      />

      {mode === 'ACADEMIC' || mode === 'CUSTOM' ? (
        <div className="role-scope-block">
          <div className="role-scope-block__title">学院范围</div>
          <div className="role-scope-grid">
            <PanelSelect
              mode="multiple"
              allowClear
              placeholder="学院"
              value={value.rules?.academic?.college || []}
              options={academicOptions.colleges.map((item) => ({ value: item, label: item }))}
              onChange={(next) => updateAcademic('college', next)}
            />
            <PanelSelect
              mode="multiple"
              allowClear
              placeholder="专业（可选）"
              value={value.rules?.academic?.major || []}
              options={academicOptions.majors.map((item) => ({ value: item, label: item }))}
              onChange={(next) => updateAcademic('major', next)}
            />
            <PanelSelect
              mode="multiple"
              allowClear
              placeholder="班级（可选）"
              value={value.rules?.academic?.className || []}
              options={academicOptions.classNames.map((item) => ({ value: item, label: item }))}
              onChange={(next) => updateAcademic('className', next)}
            />
          </div>
        </div>
      ) : null}

      {mode === 'DORMITORY' || mode === 'CUSTOM' ? (
        <div className="role-scope-block">
          <div className="role-scope-block__title">楼栋范围</div>
          <TreeSelect
            treeCheckable
            showSearch
            allowClear
            treeData={dormTreeData}
            value={dormTreeValuesFromRules(value)}
            onChange={(next) => onChange((prev) => updateDormRulesFromTree(prev, (next as string[]) || []))}
            placeholder="选择楼栋 / 楼层 / 房间"
            treeNodeLabelProp="label"
            showCheckedStrategy={TreeSelect.SHOW_PARENT}
            maxTagCount={6}
            maxTagPlaceholder={(omitted) => (
              <Tooltip title={omitted.map((item) => item.label).map((label, index) => <div key={index}>{label}</div>)}>
                <span>+{omitted.length}</span>
              </Tooltip>
            )}
            style={{ width: '100%' }}
            dropdownStyle={{ maxHeight: 360, overflow: 'auto' }}
          />
        </div>
      ) : null}
    </div>
  );
}
