/**
 * PanelSelect - 桌面端使用筛选面板（FilterDropdownPanel）样式弹层的 Select
 *
 * 保留 antd Select 的输入框、表单集成与取值方式，只替换桌面端下拉弹层：
 * 搜索框 + 「全部/全选」快捷按钮 + 选项按钮网格 + 已选提示，与楼栋筛选器一致。
 * 移动端直接渲染原生 antd Select。
 */

import React, { useMemo, useState } from 'react';
import { Empty, Input, Select } from 'antd';
import type { SelectProps } from 'antd';
import type { DefaultOptionType } from 'antd/es/select';
import { SearchOutlined } from '@ant-design/icons';

import { useMobile } from '../../hooks/useMobile';

type PanelValue = string | number;

interface PanelOption {
  value: PanelValue;
  label: React.ReactNode;
  disabled?: boolean;
}

/** 选项多于该数量时显示搜索框 */
const SEARCH_THRESHOLD = 8;

function normalizeOptions(
  options: DefaultOptionType[] | undefined,
  children: React.ReactNode,
): PanelOption[] {
  if (options?.length) {
    return options.flatMap((option) => {
      const group = (option as { options?: DefaultOptionType[] }).options;
      if (group) return normalizeOptions(group, null);
      return [
        {
          value: option.value as PanelValue,
          label: option.label ?? String(option.value),
          disabled: Boolean(option.disabled),
        },
      ];
    });
  }
  // 兼容 <Select.Option> 子元素写法
  return React.Children.toArray(children).flatMap((child) => {
    if (!React.isValidElement(child)) return [];
    const props = child.props as {
      value?: PanelValue;
      children?: React.ReactNode;
      label?: React.ReactNode;
      disabled?: boolean;
    };
    if (props.value === undefined) return [];
    return [
      {
        value: props.value,
        label: props.children ?? props.label ?? String(props.value),
        disabled: Boolean(props.disabled),
      },
    ];
  });
}

function labelText(label: React.ReactNode): string {
  if (typeof label === 'string' || typeof label === 'number') return String(label);
  if (Array.isArray(label)) return label.map(labelText).join('');
  if (React.isValidElement(label)) {
    return labelText((label.props as { children?: React.ReactNode }).children);
  }
  return '';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- 与 antd Select 的默认泛型保持一致
export default function PanelSelect<ValueType = any, OptionType extends DefaultOptionType = DefaultOptionType>(
  props: SelectProps<ValueType, OptionType>,
) {
  const isMobile = useMobile();
  const [open, setOpen] = useState(false);
  const [keyword, setKeyword] = useState('');
  const { options, children, mode, value, onChange, popupClassName, classNames, ...rest } = props;

  const panelOptions = useMemo(() => normalizeOptions(options as DefaultOptionType[] | undefined, children), [options, children]);

  if (isMobile) {
    return <Select<ValueType, OptionType> {...props} />;
  }

  const isMultiple = mode === 'multiple' || mode === 'tags';
  const selected: PanelValue[] = isMultiple
    ? ((value as PanelValue[] | undefined) ?? [])
    : value === undefined || value === null || value === ''
      ? []
      : [value as PanelValue];
  const enabledOptions = panelOptions.filter((option) => !option.disabled);
  const searchable = panelOptions.length > SEARCH_THRESHOLD;
  const visibleOptions = keyword.trim()
    ? panelOptions.filter((option) =>
        labelText(option.label).toLowerCase().includes(keyword.trim().toLowerCase()),
      )
    : panelOptions;

  const emit = (next: PanelValue[]) => {
    const pick = (v: PanelValue) => panelOptions.find((option) => option.value === v);
    if (isMultiple) {
      onChange?.(next as ValueType, next.map(pick).filter(Boolean) as never);
    } else {
      onChange?.(next[0] as ValueType, pick(next[0]) as never);
      setOpen(false);
    }
  };

  const toggleOption = (option: PanelOption) => {
    if (option.disabled) return;
    if (!isMultiple) {
      emit([option.value]);
      return;
    }
    emit(
      selected.includes(option.value)
        ? selected.filter((v) => v !== option.value)
        : [...selected, option.value],
    );
  };

  const allSelected =
    enabledOptions.length > 0 && enabledOptions.every((option) => selected.includes(option.value));

  const panel = (
    // management-theme-page 提供与管理页筛选面板相同的主题变量
    <div className="management-theme-page">
      <div
        className="filter-dropdown-panel filter-expanded-panel panel-select-panel"
        // 阻止弹层内点击让 Select 失焦关闭
        onMouseDown={(event) => {
          if (!(event.target as HTMLElement).closest('input')) event.preventDefault();
        }}
      >
        <div className="filter-panel-content">
          {searchable && (
            <div className="filter-search-box">
              <Input
                placeholder="搜索..."
                prefix={<SearchOutlined className="text-gray-400" />}
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                onKeyDown={(event) => event.stopPropagation()}
                allowClear
                className="filter-search-input"
              />
            </div>
          )}

          {isMultiple && (
            <div className="filter-quick-actions">
              <button
                type="button"
                className={`filter-quick-btn ${selected.length === 0 ? 'active' : ''}`}
                onClick={() => emit([])}
              >
                全部
              </button>
              {enabledOptions.length > 1 && (
                <button
                  type="button"
                  className={`filter-quick-btn ${allSelected ? 'active' : ''}`}
                  onClick={() => emit(allSelected ? [] : enabledOptions.map((option) => option.value))}
                >
                  {allSelected ? '取消全选' : '全选'}
                </button>
              )}
            </div>
          )}

          {visibleOptions.length > 0 ? (
            <div className="filter-options-grid">
              {visibleOptions.map((option) => (
                <button
                  type="button"
                  key={String(option.value)}
                  disabled={option.disabled}
                  className={`filter-option-btn ${selected.includes(option.value) ? 'selected' : ''}`}
                  onClick={() => toggleOption(option)}
                >
                  <span>{option.label}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="filter-empty">
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="无匹配数据" />
            </div>
          )}

          {isMultiple && selected.length > 0 && (
            <div className="filter-selected-summary">
              已选择 <strong>{selected.length}</strong> 项
              <button type="button" className="filter-clear-btn" onClick={() => emit([])}>
                清空
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <Select<ValueType, OptionType>
      {...rest}
      mode={mode}
      value={value}
      onChange={onChange}
      options={panelOptions as unknown as OptionType[]}
      showSearch={false}
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setKeyword('');
      }}
      classNames={{
        ...classNames,
        popup: {
          ...(classNames?.popup ?? {}),
          root: ['panel-select-dropdown', popupClassName, classNames?.popup?.root]
            .filter(Boolean)
            .join(' '),
        },
      }}
      popupRender={() => panel}
    />
  );
}
