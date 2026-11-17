import React, { useState, useMemo } from 'react';
import { Drawer, Input } from 'antd';
import { SearchOutlined, CloseOutlined } from '@ant-design/icons';

interface MobileFilterOption {
  label: string;
  value: string;
}

interface MobileFilterConfig {
  key: string;
  label: string;
  options?: MobileFilterOption[];
  value?: string[];
  onChange?: (values: string[]) => void;
  searchable?: boolean;
  customRender?: React.ReactNode;
  showAlphabetIndex?: boolean;
}

interface MobileAdvancedFilterProps {
  open: boolean;
  onClose: () => void;
  filters?: MobileFilterConfig[];
  onReset?: () => void;
  onConfirm?: () => void;
  title?: string;
}

/**
 * 移动端高级筛选面板组件
 * 参考 iOS 系统设置风格：左侧筛选项列表，右侧筛选内容
 * 
 * @param {boolean} open - 是否打开
 * @param {function} onClose - 关闭回调
 * @param {Array} filters - 筛选配置数组
 * @param {function} onReset - 重置回调
 * @param {function} onConfirm - 确认回调
 */
const MobileAdvancedFilter = ({ 
  open, 
  onClose, 
  filters = [], 
  onReset,
  onConfirm,
  title = '全部筛选',
}: MobileAdvancedFilterProps) => {
  // 当前选中的筛选项索引
  const [activeFilterIndex, setActiveFilterIndex] = useState(0);
  // 筛选项搜索关键字
  const [searchKeyword, setSearchKeyword] = useState('');

  // 当前激活的筛选配置
  const activeFilter = filters[activeFilterIndex];
  
  // 过滤后的选项列表
  const filteredOptions = useMemo(() => {
    if (!activeFilter?.options) return [];
    if (!searchKeyword.trim()) return activeFilter.options;
    return activeFilter.options.filter((opt) => 
      opt.label?.toLowerCase().includes(searchKeyword.toLowerCase())
    );
  }, [activeFilter, searchKeyword]);

  // 计算每个筛选项的已选数量
  const getSelectedCount = (filter: MobileFilterConfig) => {
    return Array.isArray(filter.value) ? filter.value.length : 0;
  };

  // 处理选项点击
  const handleOptionClick = (optionValue: string) => {
    const currentValues = Array.isArray(activeFilter?.value) ? [...activeFilter.value] : [];
    const index = currentValues.indexOf(optionValue);
    
    if (index > -1) {
      currentValues.splice(index, 1);
    } else {
      currentValues.push(optionValue);
    }
    
    activeFilter?.onChange?.(currentValues);
  };

  // 处理全选
  const handleSelectAll = () => {
    const allValues = filteredOptions.map((opt) => opt.value);
    activeFilter?.onChange?.(allValues);
  };

  // 处理取消全选
  const handleDeselectAll = () => {
    activeFilter?.onChange?.([]);
  };

  // 判断是否已选中
  const isSelected = (optionValue: string) => {
    return Array.isArray(activeFilter?.value) && activeFilter.value.includes(optionValue);
  };

  // 处理确认
  const handleConfirm = () => {
    onConfirm?.();
    onClose();
  };

  // 处理重置
  const handleReset = () => {
    onReset?.();
  };

  return (
    <Drawer
      title={null}
      placement="bottom"
      onClose={onClose}
      open={open}
      height="100vh"
      zIndex={1001}
      className="mobile-advanced-filter-drawer"
      closable={false}
      styles={{
        body: { padding: 0, display: 'flex', flexDirection: 'column' },
        header: { display: 'none' },
      }}
    >
      {/* 顶部标题栏 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-white/10 bg-white dark:bg-zinc-900">
        <button 
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-white active:scale-95 transition-all"
        >
          <CloseOutlined className="text-lg" />
        </button>
        <h2 className="text-[17px] font-bold text-black dark:text-white">{title}</h2>
        <div className="w-8" /> {/* 占位 */}
      </div>

      {/* 主内容区：左右分栏 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 左侧：筛选项列表 - iOS 风格优化 */}
        <div className="w-[88px] bg-[#F5F5F7] dark:bg-zinc-800/80 overflow-y-auto flex flex-col">
          {filters.map((filter, index) => {
            const count = getSelectedCount(filter);
            const isActive = index === activeFilterIndex;
            
            return (
              <button
                key={filter.key}
                onClick={() => {
                  setActiveFilterIndex(index);
                  setSearchKeyword('');
                }}
                className={`
                  relative py-4 px-2 text-center transition-all duration-200
                  ${isActive 
                    ? 'bg-white dark:bg-zinc-900' 
                    : 'hover:bg-white/50 dark:hover:bg-white/5'
                  }
                  active:scale-[0.98]
                `}
              >
                {/* 激活指示条 - 左侧竖线 */}
                {isActive && (
                  <div className="absolute left-0 top-3 bottom-3 w-[3px] bg-ios-blue rounded-r-full" />
                )}
                
                {/* 筛选项名称 */}
                <span className={`
                  text-[14px] leading-tight block
                  ${isActive 
                    ? 'text-ios-blue font-semibold' 
                    : 'text-gray-500 dark:text-gray-400 font-medium'
                  }
                `}>
                  {filter.label}
                </span>
                
                {/* 已选数量角标 */}
                {count > 0 && (
                  <span className={`
                    inline-block mt-1.5 text-[10px] font-bold rounded-full px-1.5 min-w-[18px]
                    ${isActive 
                      ? 'bg-ios-blue text-white' 
                      : 'bg-ios-blue/15 text-ios-blue'
                    }
                  `}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* 右侧：筛选内容 */}
        <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-zinc-900">
          {/* 筛选项标题和工具栏 */}
          <div className="px-4 py-3 border-b border-gray-100 dark:border-white/10">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[15px] font-bold text-black dark:text-white">
                {activeFilter.label}
              </h3>
              <div className="flex gap-2">
                <button 
                  onClick={handleSelectAll}
                  className="text-[12px] text-ios-blue font-medium px-2 py-1 rounded-lg active:bg-ios-blue/10 transition-colors"
                >
                  全选
                </button>
                <button 
                  onClick={handleDeselectAll}
                  className="text-[12px] text-gray-400 font-medium px-2 py-1 rounded-lg active:bg-gray-100 dark:active:bg-white/5 transition-colors"
                >
                  清空
                </button>
              </div>
            </div>
            
            {/* 搜索框 (如果选项较多) */}
            {activeFilter.searchable !== false && !activeFilter.customRender && (activeFilter.options?.length || 0) > 8 && (
              <Input
                placeholder="搜索..."
                prefix={<SearchOutlined className="text-gray-400" />}
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                className="mobile-filter-search-input"
                allowClear
              />
            )}
          </div>

          {/* 快捷字母索引 (如果是纯字母/数字选项) */}
          {activeFilter.showAlphabetIndex && (
            <div className="px-4 py-2 border-b border-gray-100 dark:border-white/10 overflow-x-auto hide-scrollbar">
              <div className="flex gap-2 text-[12px]">
                <button className="px-2 py-1 rounded bg-ios-blue/10 text-ios-blue font-bold">已选</button>
                <button className="px-2 py-1 rounded text-gray-500">全部</button>
                {['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'].map(letter => (
                  <button 
                    key={letter}
                    className="px-1.5 py-1 rounded text-gray-400 hover:text-ios-blue"
                  >
                    {letter}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 选项列表 */}
          <div className="flex-1 overflow-y-auto px-4 py-3">
            {activeFilter.customRender ? (
              <div className="filter-custom-content">
                {activeFilter.customRender}
              </div>
            ) : filteredOptions?.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-gray-400">
                <span className="text-[14px]">无匹配数据！</span>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {filteredOptions.map((option) => {
                  const selected = isSelected(option.value);
                  return (
                    <button
                      key={option.value}
                      onClick={() => handleOptionClick(option.value)}
                      className={`
                        px-4 py-2.5 rounded-xl text-[14px] font-medium
                        transition-all active:scale-95
                        ${selected 
                          ? 'bg-ios-blue text-white shadow-sm shadow-ios-blue/30' 
                          : 'bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-300'
                        }
                      `}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 底部操作栏 */}
      <div className="flex gap-3 px-4 py-4 border-t border-gray-100 dark:border-white/10 bg-white dark:bg-zinc-900"
        style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))' }}
      >
        <button
          onClick={handleReset}
          className="flex-1 h-12 rounded-2xl bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-300 font-semibold text-[15px] active:scale-[0.98] transition-all"
        >
          重置
        </button>
        <button
          onClick={handleConfirm}
          className="flex-[2] h-12 rounded-2xl bg-ios-blue text-white font-semibold text-[15px] shadow-lg shadow-ios-blue/30 active:scale-[0.98] transition-all"
        >
          完成
        </button>
      </div>
    </Drawer>
  );
};

export default MobileAdvancedFilter;
