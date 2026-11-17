import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Input, Empty } from 'antd';
import { SearchOutlined, DownOutlined, UpOutlined } from '@ant-design/icons';

interface FilterOption {
  label: string;
  value: string;
}

interface FilterConfig {
  key: string;
  label: string;
  options?: FilterOption[];
  value?: string[];
  onChange: (values: string[]) => void;
  multiple?: boolean;
  searchable?: boolean;
  customRender?: React.ReactNode;
}

interface FilterDropdownPanelProps {
  filters?: FilterConfig[];
  onReset?: () => void;
  className?: string;
  alwaysShowReset?: boolean;
}

/**
 * 可展开筛选面板组件
 * 类似图片中的下拉筛选交互，点击筛选项后展开详细选项面板
 * 
 * @param {Array} filters - 筛选配置数组
 *   @param {string} filters[].key - 唯一标识
 *   @param {string} filters[].label - 显示标签
 *   @param {Array} filters[].options - 选项数组 [{label, value}]
 *   @param {Array} filters[].value - 当前选中值数组
 *   @param {function} filters[].onChange - 值变更回调 (newValue) => void
 *   @param {boolean} filters[].multiple - 是否多选 (默认 true)
 *   @param {boolean} filters[].searchable - 是否可搜索 (默认 true)
 * @param {function} onReset - 重置所有筛选回调
 * @param {function} onConfirm - 确认筛选回调 (可选，用于移动端)
 * @param {boolean} alwaysShowReset - 是否始终显示重置按钮
 */
const FilterDropdownPanel = ({
  filters = [],
  className = '',
}: FilterDropdownPanelProps) => {
  // 当前展开的筛选项 key
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  // 搜索关键词 (每个筛选项独立)
  const [searchTerms, setSearchTerms] = useState<Record<string, string>>({});
  const [panelPosition, setPanelPosition] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);
  const [expandedPanelThemeClass, setExpandedPanelThemeClass] = useState('');
  const [expandedPanelThemeStyle, setExpandedPanelThemeStyle] = useState<React.CSSProperties>({});

  const panelRef = useRef<HTMLDivElement | null>(null);
  const triggerRowRef = useRef<HTMLDivElement | null>(null);
  const expandedPanelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const root = panelRef.current;
    if (!root) {
      return;
    }

    const themeHost = root.closest('.dorm-management-page, .management-theme-page');
    if (!themeHost) {
      setExpandedPanelThemeClass('');
      return;
    }

    const themeClasses = [
      themeHost.classList.contains('management-theme-page')
        ? 'filter-expanded-panel-management-theme'
        : '',
      themeHost.classList.contains('dorm-management-page')
        ? 'filter-expanded-panel-dorm-theme'
        : '',
    ]
      .filter(Boolean)
      .join(' ');

    setExpandedPanelThemeClass(themeClasses);

    const computedStyle = window.getComputedStyle(themeHost);
    const panelBg = computedStyle.getPropertyValue('--dorm-pagination-bg').trim();
    const panelBorder = computedStyle.getPropertyValue('--dorm-toolbar-border').trim();
    const optionBg = computedStyle.getPropertyValue('--dorm-toolbar-bg').trim();

    if (!panelBg || !panelBorder || !optionBg) {
      setExpandedPanelThemeStyle({});
      return;
    }

    const themeStyle = {} as React.CSSProperties & Record<string, string>;
    themeStyle['--filter-panel-bg'] = `color-mix(in srgb, ${panelBg} 84%, transparent)`;
    themeStyle['--filter-panel-border'] = panelBorder;
    themeStyle['--filter-panel-blur'] = '22px';
    themeStyle['--filter-option-bg'] = `color-mix(in srgb, ${optionBg} 88%, transparent)`;
    themeStyle['--filter-option-border'] = `color-mix(in srgb, ${panelBorder} 92%, rgba(255, 255, 255, 0.12))`;
    themeStyle['--filter-option-surface'] =
      `color-mix(in srgb, ${panelBg} 22%, ${themeStyle['--filter-option-bg']})`;
    themeStyle['--filter-option-border-strong'] =
      `color-mix(in srgb, ${themeStyle['--filter-option-border']} 94%, rgba(255, 255, 255, 0.14))`;
    themeStyle['--filter-btn-hover-border'] =
      `color-mix(in srgb, var(--co-primary) 24%, ${panelBorder})`;
    setExpandedPanelThemeStyle(themeStyle);
  }, [className]);

  useEffect(() => {
    if (!expandedKey) {
      setPanelPosition(null);
      return;
    }

    const updatePosition = () => {
      const trigger = triggerRowRef.current;
      if (!trigger) {
        return;
      }

      const rect = trigger.getBoundingClientRect();
      const viewportPadding = 24;
      const availableHeight = Math.max(280, window.innerHeight - rect.bottom - viewportPadding);
      setPanelPosition({
        top: rect.bottom + 8,
        left: rect.left,
        width: rect.width,
        maxHeight: availableHeight,
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [expandedKey]);

  // 点击外部关闭面板
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      // 检查点击是否在面板内
      const isInsideTrigger = panelRef.current && target && panelRef.current.contains(target);
      const isInsideExpandedPanel =
        expandedPanelRef.current && target && expandedPanelRef.current.contains(target);
      
      // 检查点击是否在 Ant Design 的 Portal 弹出层中 (如 DatePicker, Select 展开项)
      const isPortal = target?.closest('.ant-picker-dropdown') || 
                       target?.closest('.ant-select-dropdown') ||
                       target?.closest('.ant-dropdown') ||
                       target?.closest('.ant-picker-panel-container');

      if (!isInsideTrigger && !isInsideExpandedPanel && !isPortal) {
        setExpandedKey(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 切换展开状态
  const toggleExpand = (key: string) => {
    setExpandedKey(expandedKey === key ? null : key);
  };

  // 更新搜索词
  const updateSearchTerm = (key: string, term: string) => {
    setSearchTerms(prev => ({ ...prev, [key]: term }));
  };

  // 选中/取消选中某个选项
  const handleOptionClick = (filter: FilterConfig, optionValue: string) => {
    const currentValue = filter.value || [];
    const isMultiple = filter.multiple !== false;
    
    if (isMultiple) {
      // 多选模式
      const newValue = currentValue.includes(optionValue)
        ? currentValue.filter((v) => v !== optionValue)
        : [...currentValue, optionValue];
      filter.onChange(newValue);
    } else {
      // 单选模式
      filter.onChange(currentValue.includes(optionValue) ? [] : [optionValue]);
      setExpandedKey(null); // 单选后关闭面板
    }
  };

  // 全选/取消全选
  const handleSelectAll = (filter: FilterConfig) => {
    const currentValue = filter.value || [];
    const allValues = (filter.options || []).map((option) => option.value);
    if (currentValue.length === allValues.length) {
      filter.onChange([]);
    } else {
      filter.onChange(allValues);
    }
  };

  // 获取筛选后的选项
  const getFilteredOptions = (filter: FilterConfig): FilterOption[] => {
    const searchTerm = searchTerms[filter.key] || '';
    if (!searchTerm) return filter.options || [];
    return (filter.options || []).filter((opt) => 
      opt.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
      String(opt.value).toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  const expandedPanelContent = expandedKey && panelPosition
    ? createPortal(
        <div
          ref={expandedPanelRef}
          className={`filter-expanded-panel filter-expanded-panel-floating ${expandedPanelThemeClass}`.trim()}
          style={{
            position: 'fixed',
            top: panelPosition.top,
            left: panelPosition.left,
            width: panelPosition.width,
            maxHeight: panelPosition.maxHeight,
            zIndex: 12000,
            ...expandedPanelThemeStyle,
          }}
        >
          {filters.filter(f => f.key === expandedKey).map((filter) => {
            const filteredOptions = getFilteredOptions(filter);
            const currentValue = filter.value || [];
            const searchable = filter.searchable !== false;
            
            return (
              <div key={filter.key} className="filter-panel-content">
                {/* 搜索框 */}
                {searchable && !filter.customRender && (
                  <div className="filter-search-box">
                    <Input
                      placeholder={`搜索${filter.label}...`}
                      prefix={<SearchOutlined className="text-gray-400" />}
                      value={searchTerms[filter.key] || ''}
                      onChange={(e) => updateSearchTerm(filter.key, e.target.value)}
                      allowClear
                      className="filter-search-input"
                    />
                  </div>
                )}

                {/* 自定义渲染内容 */}
                {filter.customRender ? (
                  <div className="filter-custom-content p-4">
                    {filter.customRender}
                  </div>
                ) : (
                  <>
                    {/* 快捷操作按钮 */}
                    <div className="filter-quick-actions">
                      <button
                        className={`filter-quick-btn ${currentValue.length === 0 ? 'active' : ''}`}
                        onClick={() => filter.onChange([])}
                      >
                        全部
                      </button>
                      {filter.multiple !== false && (filter.options?.length ?? 0) > 1 && (
                        <button
                          className={`filter-quick-btn ${currentValue.length === (filter.options?.length ?? 0) ? 'active' : ''}`}
                          onClick={() => handleSelectAll(filter)}
                        >
                          {currentValue.length === (filter.options?.length ?? 0) ? '取消全选' : '全选'}
                        </button>
                      )}
                    </div>

                    {/* 选项列表 */}
                    {filteredOptions?.length > 0 ? (
                      <div className="filter-options-grid">
                        {filteredOptions.map((option) => {
                          const isSelected = currentValue?.includes(option.value);
                          return (
                            <button
                              key={option.value}
                              className={`filter-option-btn ${isSelected ? 'selected' : ''}`}
                              onClick={() => handleOptionClick(filter, option.value)}
                            >
                              <span>{option.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="filter-empty">
                        <Empty 
                          image={Empty.PRESENTED_IMAGE_SIMPLE} 
                          description="无匹配数据"
                        />
                      </div>
                    )}
                  </>
                )}

                {/* 已选提示 */}
                {currentValue.length > 0 && (
                  <div className="filter-selected-summary">
                    已选择 <strong>{currentValue.length}</strong> 项
                    <button 
                      className="filter-clear-btn"
                      onClick={() => filter.onChange([])}
                    >
                      清空
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>,
        document.body,
      )
    : null;

  return (
    <div ref={panelRef} className={`filter-dropdown-panel ${className}`}>
      {/* 筛选触发按钮行 */}
      <div ref={triggerRowRef} className="filter-trigger-row">
        {filters.map((filter) => {
          const selectedCount = filter.value?.length ?? 0;
          const hasValue = selectedCount > 0;
          const isExpanded = expandedKey === filter.key;
          
          return (
            <button
              key={filter.key}
              className={`filter-trigger-btn ${hasValue ? 'active' : ''} ${isExpanded ? 'expanded' : ''}`}
              onClick={() => toggleExpand(filter.key)}
            >
              <span className="filter-trigger-label">
                {filter.label}
                {hasValue && (
                  <span className="filter-trigger-count">{selectedCount}</span>
                )}
              </span>
              {isExpanded ? <UpOutlined className="filter-trigger-icon" /> : <DownOutlined className="filter-trigger-icon" />}
            </button>
          );
        })}
      </div>

      {expandedPanelContent}
    </div>
  );
};

export default FilterDropdownPanel;
