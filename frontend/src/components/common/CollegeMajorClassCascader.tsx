import { useState, useMemo } from 'react';
import { Input, Tag, Empty, Button, Breadcrumb } from 'antd';
import { 
  SearchOutlined, 
  RightOutlined, 
  LeftOutlined, 
  CheckOutlined, 
  CloseOutlined 
} from '@ant-design/icons';
import { useAppContext } from '../../context/AppContext';
import { useStudentFilterOptions } from '../../hooks/useStudentFilterOptions';

interface CascaderValue {
  college?: string[];
  major?: string[];
  className?: string[];
}

interface CollegeMajorClassCascaderProps {
  value?: CascaderValue;
  onChange: (value: CascaderValue) => void;
  isMobile?: boolean;
}

interface OptionItem {
  label: string;
  value: string;
}

/**
 * 学院-专业-班级级联选择器
 * 支持桌面端三列布局和移动端分步布局
 * 
 * @param {Object} value - 当前选中的值 { college, major, className }
 * @param {Function} onChange - 变更回调
 * @param {Boolean} isMobile - 是否为移动端
 * @param {Function} onConfirm - 确认回调 (可选)
 */
const CollegeMajorClassCascader = ({
  value = {},
  onChange,
  isMobile = false,
}: CollegeMajorClassCascaderProps) => {
  useAppContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCollege, setActiveCollege] = useState<string | null>(value.college?.[0] || null);
  const [activeMajor, setActiveMajor] = useState<string | null>(value.major?.[0] || null);
  const selectedColleges = useMemo(() => value.college ?? [], [value.college]);
  const selectedMajors = useMemo(() => value.major ?? [], [value.major]);
  const selectedClasses = useMemo(() => value.className ?? [], [value.className]);
  
  // 移动端当前步骤: 0-学院, 1-专业, 2-班级
  const [currentStep, setCurrentStep] = useState(0);


  // 使用专用 API 获取筛选选项（不再依赖全量学生数据）
  const { data: filterOptionsData } = useStudentFilterOptions();
  const filterOptions = filterOptionsData || { colleges: [], majors: [], classNames: [] };

  // 中文拼音排序辅助函数
  const pinyinSort = (a: string, b: string) =>
    a.localeCompare(b, 'zh-CN', { sensitivity: 'base' });

  // 1. 基础数据准备 - 从 API 返回的数据转换为组件需要的格式
  const colleges = useMemo(() => {
    const sorted = [...(filterOptions.colleges || [])].sort(pinyinSort);
    return sorted.map(name => ({ label: name, value: name }));
  }, [filterOptions.colleges]);

  const majors = useMemo(() => {
    if (selectedColleges.length === 0) return [];
    // 从 API 返回的 majors 数组中过滤出选中学院下的专业
    const allMajors = filterOptions.majors || [];
    const filteredMajors = allMajors
      .flatMap((m) =>
        m.college && m.name && selectedColleges.includes(m.college)
          ? [m.name]
          : [],
      );
    // 去重并按拼音排序
    const uniqueMajors = [...new Set(filteredMajors)].sort(pinyinSort);
    return uniqueMajors.map(name => ({ label: name, value: name }));
  }, [filterOptions.majors, selectedColleges]);

  const classes = useMemo(() => {
    if (selectedMajors.length === 0) return [];
    // 从 API 返回的 classNames 数组中过滤出选中专业下的班级
    const allClasses = filterOptions.classNames || [];
    const filteredClasses = allClasses
      .flatMap((c) =>
        c.major && c.name && selectedMajors.includes(c.major)
          ? [c.name]
          : [],
      );
    // 去重并按拼音排序
    const uniqueClasses = [...new Set(filteredClasses)].sort(pinyinSort);
    return uniqueClasses.map(name => ({ label: name, value: name }));
  }, [filterOptions.classNames, selectedMajors]);

  // A-Z 索引辅助
  const getPinyinInitial = (str: string) => {
    // 简化处理：实际项目中可能需要 pinyin 库
    // 这里仅做演示，如果是字母则返回大写，否则返回 #
    const firstChar = str.charAt(0).toUpperCase();
    if (/[A-Z]/.test(firstChar)) return firstChar;
    return '#';
  };

  const _collegeGroups = useMemo(() => {
    const groups: Record<string, OptionItem[]> = {};
    colleges.forEach(c => {
      const initial = getPinyinInitial(c.label);
      if (!groups[initial]) groups[initial] = [];
      groups[initial].push(c);
    });
    return Object.keys(groups).sort().map(key => ({ title: key, items: groups[key] }));
  }, [colleges]);

  // 2. 交互处理
  const handleCollegeClick = (college: string) => {
    const isSelected = selectedColleges.includes(college);
    let newColleges = [];
    let newMajors = selectedMajors;
    let newClasses = selectedClasses;

    if (isSelected) {
      // 取消选中：移除学院及关联的专业和班级
      newColleges = selectedColleges.filter(v => v !== college);
      
      // 从 filterOptions 中找出该学院下的所有专业
      const collegeMajors = (filterOptions.majors || [])
        .filter(m => m.college === college)
        .map(m => m.name);
      newMajors = newMajors.filter(m => !collegeMajors.includes(m));
      
      // 从 filterOptions 中找出这些专业下的所有班级
      const majorClasses = (filterOptions.classNames || [])
        .filter(c => collegeMajors.includes(c.major))
        .map(c => c.name);
      newClasses = newClasses.filter(c => !majorClasses.includes(c));
    } else {
      // 选中
      newColleges = [...selectedColleges, college];
    }

    onChange({ 
      college: newColleges, 
      major: newMajors, 
      className: newClasses 
    });

    // 移动端点击后不自动跳转，允许继续多选学院
    // 如果用户想进入下一步，可以点击面包屑或通过其他方式（通常多选器会有"下一步"按钮，这里保持现状通过面包屑切换）
  };

  const handleMajorClick = (major: string) => {
    const isSelected = selectedMajors.includes(major);
    let newMajors = [];
    let newClasses = selectedClasses;

    if (isSelected) {
      // 取消选中：移除专业及关联的班级
      newMajors = selectedMajors.filter(v => v !== major);
      // 从 filterOptions 中找出该专业下的所有班级
      const majorClasses = (filterOptions.classNames || [])
        .filter(c => c.major === major)
        .map(c => c.name);
      newClasses = newClasses.filter(c => !majorClasses.includes(c));
    } else {
      // 选中
      newMajors = [...selectedMajors, major];
    }

    onChange({ 
      ...value, 
      major: newMajors, 
      className: newClasses 
    });
  };

  const handleClassClick = (cls: string) => {
    const isSelected = selectedClasses.includes(cls);
    const newClasses = isSelected 
        ? selectedClasses.filter(v => v !== cls)
        : [...selectedClasses, cls];
    onChange({ ...value, className: newClasses });
  };

  const clearSelection = (level: 'college' | 'major' | 'className') => {
    if (level === 'college') {
      setActiveCollege(null);
      setActiveMajor(null);
      onChange({ college: [], major: [], className: [] });
      if (isMobile) setCurrentStep(0);
    } else if (level === 'major') {
      setActiveMajor(null);
      onChange({ ...value, major: [], className: [] });
      if (isMobile) setCurrentStep(1);
    } else if (level === 'className') {
      onChange({ ...value, className: [] });
    }
  };

  // 3. 渲染辅助
  const renderList = (
    items: OptionItem[],
    selectedValue: string[] | string | undefined,
    onSelect: (value: string) => void,
    placeholder: string,
  ) => {
    const filtered = items.filter(item => 
      item.label.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
      <div className="flex flex-col h-full min-h-0 bg-white dark:bg-[#1C1C1E] rounded-xl overflow-hidden border border-black/5 dark:border-white/5">
        <div className="p-2 border-b border-black/5 dark:border-white/5 flex-shrink-0">
          <Input 
            prefix={<SearchOutlined className="text-gray-400" />}
            placeholder={placeholder}
            variant="filled"
            className="apple-input-compact"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            allowClear
          />
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-1">
          {filtered.length > 0 ? (
            filtered.map(item => {
              const isActive = Array.isArray(selectedValue) 
                ? selectedValue.includes(item.value)
                : selectedValue === item.value;
              
              return (
                <div 
                  key={item.value}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-all active:scale-[0.98] mb-0.5 ${
                    isActive 
                      ? 'bg-ios-blue/10 text-ios-blue font-medium' 
                      : 'hover:bg-gray-100 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300'
                  }`}
                  onClick={() => onSelect(item.value)}
                >
                  <span className="truncate flex-1">{item.label}</span>
                  {isActive ? <CheckOutlined className="text-xs" /> : <RightOutlined className="text-[10px] text-gray-300" />}
                </div>
              );
            })
          ) : (
            <div className="h-full flex items-center justify-center">
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无数据" />
            </div>
          )}
        </div>
      </div>
    );
  };

  // 桌面端布局
  const renderDesktop = () => (
    <div className="flex flex-col gap-3 min-w-[700px] h-[450px]">
      {/* 路径显示区 */}
      <div className="flex items-center gap-2 px-1">
        <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">当前选中：</span>
        <div className="flex flex-wrap gap-2">
          {selectedColleges.length > 0 && selectedColleges.map(c => (
            <Tag 
              key={`c-${c}`}
              closable 
              onClose={() => handleCollegeClick(c)}
              className="apple-chip-blue"
            >
              {c}
            </Tag>
          ))}
          {selectedMajors.length > 0 && selectedMajors.map(m => (
            <Tag 
              key={`m-${m}`}
              closable 
              onClose={() => handleMajorClick(m)}
              className="apple-chip-blue"
            >
              {m}
            </Tag>
          ))}
          {selectedClasses.length > 0 && selectedClasses.map(c => (
            <Tag 
              key={`cls-${c}`}
              closable 
              onClose={() => handleClassClick(c)}
              className="apple-chip-blue"
            >
              {c}
            </Tag>
          ))}
        </div>
      </div>

      {/* 三列视图 */}
      <div className="grid grid-cols-3 gap-3 flex-1 min-h-0">
        {/* 第一列: 学院 */}
        <div className="h-full min-h-0 overflow-hidden">
            {renderList(colleges, value.college, handleCollegeClick, "搜索学院…")}
        </div>

        {/* 第二列: 专业 */}
        <div className="h-full min-h-0 overflow-hidden">
          {selectedColleges.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center bg-gray-50 dark:bg-white/5 rounded-xl border border-dashed border-gray-200 dark:border-white/10 text-gray-400">
               <BankOutlined className="text-2xl mb-2 opacity-50" />
               <span className="text-sm">请先选择学院</span>
            </div>
          ) : (
            renderList(majors, value.major, handleMajorClick, "搜索专业…")
          )}
        </div>

        {/* 第三列: 班级 */}
        <div className="h-full min-h-0 overflow-hidden">
          {selectedMajors.length === 0 ? (
             <div className="h-full flex flex-col items-center justify-center bg-gray-50 dark:bg-white/5 rounded-xl border border-dashed border-gray-200 dark:border-white/10 text-gray-400">
                <TeamOutlined className="text-2xl mb-2 opacity-50" />
                <span className="text-sm">请先选择专业</span>
             </div>
          ) : (
            renderList(classes, value.className, handleClassClick, "搜索班级…")
          )}
        </div>
      </div>
    </div>
  );

  // 移动端分步布局
  const renderMobile = () => {
    const steps = [
      { key: 'college', label: '选择学院', items: colleges, active: selectedColleges, onSelect: handleCollegeClick, placeholder: '搜索学院…' },
      { key: 'major', label: '选择专业', items: majors, active: selectedMajors, onSelect: handleMajorClick, placeholder: '搜索专业…' },
      { key: 'className', label: '选择班级', items: classes, active: selectedClasses, onSelect: handleClassClick, placeholder: '搜索班级…' },
    ];

    const current = steps[currentStep];

    return (
      <div className="flex flex-col h-[70vh] w-full bg-gray-50 dark:bg-black">
        {/* 顶部路径与回退 */}
        <div className="bg-white/80 dark:bg-[#1C1C1E]/80 backdrop-blur-xl border-b border-black/5 dark:border-white/10 sticky top-0 z-10">
          <div className="flex items-center p-3">
            {currentStep > 0 && (
              <Button 
                type="text" 
                icon={<LeftOutlined />} 
                onClick={() => setCurrentStep(prev => prev - 1)}
                className="mr-2"
              />
            )}
            <div className="flex-1 overflow-x-auto no-scrollbar">
               <Breadcrumb separator={<RightOutlined className="text-[10px]" />}>
                 <Breadcrumb.Item className={currentStep === 0 ? "font-bold text-ios-blue" : "cursor-pointer"} onClick={() => setCurrentStep(0)}>学院</Breadcrumb.Item>
                 {activeCollege && (
                   <Breadcrumb.Item className={currentStep === 1 ? "font-bold text-ios-blue" : "cursor-pointer"} onClick={() => setCurrentStep(1)}>专业</Breadcrumb.Item>
                 )}
                 {activeMajor && (
                   <Breadcrumb.Item className={currentStep === 2 ? "font-bold text-ios-blue" : "cursor-pointer"} onClick={() => setCurrentStep(2)}>班级</Breadcrumb.Item>
                 )}
               </Breadcrumb>
            </div>
            {selectedClasses.length > 0 && (
                <Button type="link" onClick={() => clearSelection('className')} className="text-ios-blue">清空</Button>
            )}
          </div>
        </div>

        {/* 列表内容 */}
        <div className="flex-1 overflow-hidden p-4">
            <div className="mb-4">
              <Input 
                prefix={<SearchOutlined className="text-gray-400" />}
                placeholder={current.placeholder}
                className="apple-search-input !rounded-xl"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                allowClear
              />
            </div>
            <div className="bg-white dark:bg-[#1C1C1E] rounded-[20px] overflow-hidden shadow-sm h-[calc(100%-60px)] flex flex-col">
              <div className="overflow-y-auto flex-1 p-2">
                {current.items.length > 0 ? (
                  current.items.filter(i => i.label.toLowerCase().includes(searchTerm.toLowerCase())).map(item => {
                    const isActive = Array.isArray(current.active) 
                        ? current.active.includes(item.value)
                        : current.active === item.value;
                    return (
                      <div 
                        key={item.value}
                        className={`flex items-center justify-between px-4 py-3.5 border-b border-black/[0.03] dark:border-white/[0.03] last:border-none active:bg-gray-50 dark:active:bg-white/5 ${isActive ? 'text-ios-blue font-medium' : 'text-gray-800 dark:text-gray-200'}`}
                        onClick={() => current.onSelect(item.value)}
                      >
                        <span className="flex-1">{item.label}</span>
                        {isActive && <CheckOutlined className="text-ios-blue" />}
                      </div>
                    );
                  })
                ) : (
                   <Empty description="暂无相关数据" className="py-12" />
                )}
              </div>
            </div>
        </div>
        
        {/* 底部操作条 (移动端)
        <div className="p-4 bg-white/80 dark:bg-[#1C1C1E]/80 backdrop-blur-xl border-t border-black/5 dark:border-white/10 flex gap-3">
          <Button 
            block 
            size="large" 
            className="apple-btn-secondary !rounded-2xl"
            onClick={() => handleReset()}
          >
            重置
          </Button>
          <Button 
            block 
            size="large" 
            type="primary"
            className="apple-btn-primary !rounded-2xl"
            onClick={() => {
                if (onConfirm) onConfirm();
                // 自动关闭的逻辑通常在父级处理
            }}
          >
            完成
          </Button>
        </div> */}
      </div>
    );
  };

  return isMobile ? renderMobile() : renderDesktop();
};

// 模拟图标
function BankOutlined({ className }: { className?: string }) {
  return (
    <svg className={className} width="1em" height="1em" fill="currentColor" viewBox="0 0 1024 1024"><path d="M894 462c30.9 0 56 25.1 56 56v330c0 30.9-25.1 56-56 56H130c-30.9 0-56-25.1-56-56V518c0-30.9 25.1-56 56-56h764m-41.1 64H171.1v278h681.8V526zM512 82c161.4 0 304.3 88.9 381.2 220.8L811.8 348c-63.5-108.9-180.7-182-314.4-182s-250.9 73.1-314.4 182L101 302.8C177.9 170.9 320.6 82 512 82z"/></svg>
  );
}

function TeamOutlined({ className }: { className?: string }) {
  return (
    <svg className={className} width="1em" height="1em" fill="currentColor" viewBox="0 0 1024 1024"><path d="M820.8 743.6L712.5 682c-29.4-16.7-61.9-25.2-95.2-25.2h-31.4c-9.1 0-17.6-3.8-23.8-10.4-38.3-40.8-60.1-94.7-60.1-150.8 0-48.4 16-95.2 45.4-132.8 5.7-7.3 8.7-16.3 8.7-25.5v-24.6c0-91.1-74.1-165.2-165.2-165.2-91.1 0-165.2 74.1-165.2 165.2v24.6c0 9.2 3 18.2 8.7 25.5C312.9 400.8 329 447.6 329 496c0 56.1-21.8 110-60.1 150.8-6.2 6.6-14.7 10.4-23.8 10.4h-31.4c-33.3 0-65.8 8.5-95.2 25.2L10.2 743.6c-6.1 3.5-9.8 10-9.8 17.1V896c0 24.1 19.6 43.7 43.7 43.7h936c24.1 0 43.7-19.6 43.7-43.7V760.7c-.1-7.1-3.8-13.6-9.9-17.1zM111.4 828.5L245 752.6c11.6-6.6 24.4-10 37.6-10h31.4c29.5 0 57.3-12.2 77.3-33.5C421 677.1 439.4 632.4 439.4 585c0-29-8.4-56.9-24.1-81.4-.2-.3-.5-.7-.7-1-6.1-7.8-9.4-17.4-9.4-27.3v-24.6c0-29.6 24.1-53.7 53.7-53.7s53.7 24.1 53.7 53.7v24.6c0 9.9-3.2 19.5-9.4 27.3-.2.3-.5.7-.7 1-15.7 24.5-24.1 52.4-24.1 81.4 0 47.4 18.4 92.1 48.1 123.6 20 21.3 47.8 33.5 77.3 33.5h31.4c13.2 0 26 3.4 37.6 10l133.6 75.9v23.8H111.4v-23.8z"/></svg>
  );
}

export default CollegeMajorClassCascader;
