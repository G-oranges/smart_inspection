import {
  useMemo,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  type UIEvent,
} from 'react';
import { Alert, Button, Empty, Input, Segmented, Space, Tag } from 'antd';
import {
  AppstoreOutlined,
  BarsOutlined,
  FilterOutlined,
  ReloadOutlined,
  SearchOutlined,
  TableOutlined,
} from '@ant-design/icons';

import GlassTable from '../../../components/GlassTable';
import DormGridSelector from '../../../components/DormGridSelector';
import FilterDropdownPanel from '../../../components/common/FilterDropdownPanel';
import MobileAdvancedFilter from '../../../components/common/MobileAdvancedFilter';
import { createEmptyDormFilters } from '../taskPublishSchema';
import { areDormFiltersEqual, resolveDormColleges, resolveDormGrades } from '../utils';

import type { EntityId } from '../../../types/service';
import type { DormFiltersState, TaskDorm, TaskPublishViewMode } from '../types';

const HISTORICAL_DORM_LABEL = '历史宿舍';
const READONLY_DORM_REASON = '已超出当前数据范围，仅保留展示';

interface DormSelectionStepProps {
  isMobile: boolean;
  dorms: TaskDorm[];
  draftDormFilters: DormFiltersState;
  setDraftDormFilters: Dispatch<SetStateAction<DormFiltersState>>;
  appliedDormFilters: DormFiltersState;
  setAppliedDormFilters: Dispatch<SetStateAction<DormFiltersState>>;
  draftDormSearch: string;
  setDraftDormSearch: Dispatch<SetStateAction<string>>;
  appliedDormSearch: string;
  setAppliedDormSearch: Dispatch<SetStateAction<string>>;
  selectedDormIds: EntityId[];
  setSelectedDormIds: Dispatch<SetStateAction<EntityId[]>>;
  visibleCount: number;
  setVisibleCount: Dispatch<SetStateAction<number>>;
  viewMode: TaskPublishViewMode;
  setViewMode: Dispatch<SetStateAction<TaskPublishViewMode>>;
  mobileFilterOpen: boolean;
  setMobileFilterOpen: Dispatch<SetStateAction<boolean>>;
}

interface DormFilterConfigItem {
  key: keyof DormFiltersState;
  label: string;
  options: Array<{ label: string; value: string }>;
  value: string[];
  onChange: (values: string[]) => void;
}

function renderDormGrades(dorm: TaskDorm, compact = false): ReactNode {
  const dormGrades = resolveDormGrades(dorm);
  if (dormGrades.length === 0) {
    return <span className="text-xs text-gray-400">-</span>;
  }

  return (
    <div className="flex flex-wrap gap-1">
      {dormGrades.map((grade, index) => (
        <span
          key={`${String(dorm.id || 'dorm')}-grade-${index}`}
          className={`font-medium ${compact ? 'text-[11px]' : 'text-xs'} text-gray-600 dark:text-gray-400`}
        >
          {grade}
          {index < dormGrades.length - 1 ? ',' : ''}
        </span>
      ))}
    </div>
  );
}

function renderDormColleges(dorm: TaskDorm, compact = false): ReactNode {
  if (dorm._readonly) {
    return (
      <Tag className={`!m-0 border-none bg-amber-100 text-amber-700 ${compact ? 'scale-90' : ''}`}>
        当前不可操作
      </Tag>
    );
  }

  const dormColleges = resolveDormColleges(dorm);
  if (dormColleges.length === 0) {
    return <span className="text-xs text-gray-400">-</span>;
  }

  const display = dormColleges.slice(0, 2);
  const remainder = dormColleges.length - display.length;
  return (
    <Space size={4} wrap>
      {display.map((college, index) => (
        <Tag
          key={`${String(dorm.id || 'dorm')}-college-${index}`}
          className={`ant-tag-blue !m-0 ${compact ? 'scale-90' : ''}`}
        >
          {college}
        </Tag>
      ))}
      {remainder > 0 ? (
        <Tag className={`apple-tag-gray !m-0 ${compact ? 'scale-90' : ''}`}>+{remainder}</Tag>
      ) : null}
    </Space>
  );
}

function buildDormFilterConfig(
  campuses: string[],
  buildings: string[],
  floors: Array<string | number>,
  grades: string[],
  colleges: string[],
  draftDormFilters: DormFiltersState,
  setDraftDormFilters: Dispatch<SetStateAction<DormFiltersState>>,
): DormFilterConfigItem[] {
  const createMultiSelectFilter = (
    key: keyof DormFiltersState,
    label: string,
    options: Array<{ label: string; value: string }>,
    onChange?: (values: string[]) => void,
  ): DormFilterConfigItem => ({
    key,
    label,
    options,
    value: draftDormFilters[key] || [],
    onChange:
      onChange ||
      ((values) => {
        setDraftDormFilters((prev) => ({ ...prev, [key]: values }));
      }),
  });

  return [
    createMultiSelectFilter(
      'campus',
      '校区',
      campuses.map((campus) => ({ label: campus, value: campus })),
    ),
    createMultiSelectFilter(
      'building',
      '楼栋',
      buildings.map((building) => ({ label: building, value: building })),
      (values) =>
        setDraftDormFilters((prev) => ({
          ...prev,
          building: values,
          floor: [],
        })),
    ),
    createMultiSelectFilter(
      'floor',
      '楼层',
      floors.map((floor) => ({ label: `${floor}F`, value: String(floor) })),
    ),
    createMultiSelectFilter(
      'grade',
      '年级',
      grades.map((grade) => ({ label: grade, value: grade })),
    ),
    createMultiSelectFilter(
      'college',
      '学院',
      colleges.map((college) => ({ label: college, value: college })),
    ),
  ];
}

function matchesSingleValueFilter(selectedValues: string[], candidate: unknown): boolean {
  return selectedValues.length === 0 || selectedValues.includes(String(candidate ?? ''));
}

function matchesAnyValueFilter(selectedValues: string[], candidates: string[]): boolean {
  return selectedValues.length === 0 || selectedValues.some((value) => candidates.includes(value));
}

function buildDormTableColumns(isMobile: boolean) {
  if (isMobile) {
    return [
      {
        title: '楼栋',
        key: 'building',
        width: 108,
        className: 'text-[11px]',
        render: (_value: unknown, record: TaskDorm) => (
          <div className="flex flex-col gap-1">
            <span>{record.building || '-'}</span>
            {record._readonly ? <Tag className="!m-0 border-none bg-amber-100 text-amber-700">只读</Tag> : null}
          </div>
        ),
      },
      { title: '房号', dataIndex: 'roomNo', key: 'roomNo', width: 90, className: 'text-[11px]' },
      {
        title: '年级',
        key: 'grade',
        width: 70,
        className: 'text-[11px]',
        render: (_value: unknown, record: TaskDorm) => renderDormGrades(record, true),
      },
      {
        title: '学院',
        key: 'college',
        width: 90,
        className: 'text-[11px]',
        render: (_value: unknown, record: TaskDorm) => renderDormColleges(record, true),
      },
    ];
  }

  return [
    {
      title: '楼栋',
      key: 'building',
      render: (_value: unknown, record: TaskDorm) => (
        <div className="flex items-center gap-2">
          <span>{record.building || '-'}</span>
          {record._readonly ? <Tag className="!m-0 border-none bg-amber-100 text-amber-700">只读</Tag> : null}
        </div>
      ),
    },
    { title: '房间号', dataIndex: 'roomNo', key: 'roomNo' },
    {
      title: '年级',
      key: 'grade',
      render: (_value: unknown, record: TaskDorm) => renderDormGrades(record),
    },
    {
      title: '学院',
      key: 'college',
      render: (_value: unknown, record: TaskDorm) => renderDormColleges(record),
    },
  ];
}

interface DormSelectionControlsProps {
  activeFilterCount: number;
  draftDormSearch: string;
  dormOptions: TaskDorm[];
  dormFilters: DormFilterConfigItem[];
  handleDormReset: () => void;
  handleDormSearch: () => void;
  isDormDirty: boolean;
  isMobile: boolean;
  lockedSelectedDormIds: EntityId[];
  selectedDormIds: EntityId[];
  setSelectedDormIds: Dispatch<SetStateAction<EntityId[]>>;
  setDraftDormSearch: Dispatch<SetStateAction<string>>;
  setMobileFilterOpen: Dispatch<SetStateAction<boolean>>;
  setViewMode: Dispatch<SetStateAction<TaskPublishViewMode>>;
  viewMode: TaskPublishViewMode;
}

function DormSelectionControls({
  activeFilterCount,
  draftDormSearch,
  dormOptions,
  dormFilters,
  handleDormReset,
  handleDormSearch,
  isDormDirty,
  isMobile,
  lockedSelectedDormIds,
  selectedDormIds,
  setSelectedDormIds,
  setDraftDormSearch,
  setMobileFilterOpen,
  setViewMode,
  viewMode,
}: DormSelectionControlsProps) {
  if (isMobile) {
    return (
      <div className="flex flex-col gap-2 mb-2">
        <div className="flex items-center gap-2">
          <Input
            variant="filled"
            value={draftDormSearch}
            onChange={(event) => setDraftDormSearch(event.target.value)}
            onPressEnter={handleDormSearch}
            placeholder="搜房号..."
            className="flex-1 h-9 text-xs"
            prefix={<SearchOutlined className="opacity-40 text-xs" />}
            allowClear
          />
          <Button
            type="primary"
            icon={<SearchOutlined />}
            onClick={handleDormSearch}
            disabled={!isDormDirty}
            className="apple-btn-primary h-9 rounded-xl px-4 text-xs active:scale-95 transition-all border-none"
          >
            搜索
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button
            icon={<FilterOutlined />}
            onClick={() => setMobileFilterOpen(true)}
            className={`rounded-xl h-9 text-xs ${activeFilterCount > 0 ? 'border-ios-blue text-ios-blue' : ''}`}
          >
            筛选{activeFilterCount > 0 ? `(${activeFilterCount})` : ''}
          </Button>
          <Button
            onClick={handleDormReset}
            icon={<ReloadOutlined />}
            className="h-9 rounded-xl border-none bg-gray-100/60 dark:bg-white/5 text-gray-600 dark:text-gray-300 text-xs active:scale-95 transition-all px-3"
          >
            重置
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 mb-6">
      <div className="dorm-toolbar-shell">
        <div className="dorm-toolbar-row dorm-toolbar-row-main">
          <Input
            value={draftDormSearch}
            onChange={(event) => setDraftDormSearch(event.target.value)}
            onPressEnter={handleDormSearch}
            placeholder="搜索宿舍、楼栋..."
            className="apple-search-input dorm-toolbar-search !bg-gray-100/50 dark:!bg-white/5 border-none flex-1 min-w-[220px]"
            prefix={<SearchOutlined className="text-gray-400" />}
            allowClear
          />
          <Button
            type="primary"
            icon={<SearchOutlined />}
            onClick={handleDormSearch}
            disabled={!isDormDirty}
            className="apple-btn-primary dorm-toolbar-button dorm-toolbar-button-primary active:scale-95 transition-all border-none"
          >
            搜索
          </Button>
          <Button
            onClick={handleDormReset}
            icon={<ReloadOutlined />}
            className="dorm-toolbar-button dorm-toolbar-button-subtle active:scale-95 transition-all"
          >
            重置
          </Button>
        </div>
        <div className="dorm-toolbar-row dorm-toolbar-row-actions">
          <Button
            className="dorm-toolbar-button dorm-toolbar-button-subtle task-publish-selection-action-btn active:scale-95 transition-all"
            onClick={() =>
              setSelectedDormIds(
                Array.from(
                  new Set([
                    ...selectedDormIds,
                    ...dormOptions
                      .filter((dorm) => !dorm._readonly)
                      .map((dorm) => dorm.id)
                      .filter((id): id is EntityId => id !== undefined && id !== null),
                  ]),
                ),
              )
            }
            disabled={dormOptions.length === 0}
          >
            全选筛选结果
          </Button>
          <Button
            className="dorm-toolbar-button dorm-toolbar-button-subtle task-publish-selection-action-btn active:scale-95 transition-all"
            onClick={() => setSelectedDormIds(lockedSelectedDormIds)}
            disabled={selectedDormIds.length === 0}
          >
            清空选择
          </Button>
        </div>
      </div>
      <div className="dorm-toolbar-row dorm-toolbar-row-filters">
        <div className="flex-1">
          <FilterDropdownPanel filters={dormFilters} />
        </div>
        <div className="dorm-view-switcher">
          <Segmented
            value={viewMode}
            onChange={(value) => setViewMode(value as TaskPublishViewMode)}
            className="apple-segmented"
            options={[
              { value: 'list', icon: <BarsOutlined />, label: '列表' },
              { value: 'mini', icon: <TableOutlined />, label: '缩略' },
              { value: 'card', icon: <AppstoreOutlined />, label: '卡片' },
            ]}
          />
        </div>
      </div>
    </div>
  );
}

interface DormSelectionSummaryProps {
  dormOptions: TaskDorm[];
  isMobile: boolean;
  lockedSelectedDormIds: EntityId[];
  selectedDormIds: EntityId[];
  setSelectedDormIds: Dispatch<SetStateAction<EntityId[]>>;
}

function DormSelectionSummary({
  dormOptions,
  isMobile,
  lockedSelectedDormIds,
  selectedDormIds,
  setSelectedDormIds,
}: DormSelectionSummaryProps) {
  return (
    <div
      className={`flex items-center justify-between mb-2 bg-gray-50 dark:bg-white/5 ${isMobile ? 'p-2 rounded-xl text-[10px]' : 'p-3 rounded-2xl text-sm'} border border-black/5 dark:border-white/5`}
    >
      <div className="text-gray-600 dark:text-gray-400">
        匹配 <span className="font-bold text-blue-600 dark:text-blue-400">{dormOptions.length}</span>
        ，选 <span className="font-bold text-orange-600 dark:text-orange-500">{selectedDormIds.length}</span>
      </div>
      {isMobile ? (
        <Space size={4}>
          <Button
            size="small"
            className="rounded-lg text-[10px] h-6 px-2"
            onClick={() =>
              setSelectedDormIds(
                Array.from(
                  new Set([
                    ...selectedDormIds,
                    ...dormOptions
                      .filter((dorm) => !dorm._readonly)
                      .map((dorm) => dorm.id)
                      .filter((id): id is EntityId => id !== undefined && id !== null),
                  ]),
                ),
              )
            }
          >
            全选
          </Button>
          <Button
            size="small"
            type="text"
            className="rounded-lg text-gray-400 text-[10px] h-6 px-2"
            onClick={() => setSelectedDormIds(lockedSelectedDormIds)}
          >
            清空
          </Button>
        </Space>
      ) : null}
    </div>
  );
}

interface DormSelectionResultsProps {
  handleScroll: (event: UIEvent<HTMLDivElement>) => void;
  lockedSelectedDormIds: EntityId[];
  noResultsDescription: string;
  isMobile: boolean;
  selectedDormIds: EntityId[];
  setSelectedDormIds: Dispatch<SetStateAction<EntityId[]>>;
  viewMode: TaskPublishViewMode;
  visibleDorms: TaskDorm[];
}

function DormSelectionResults({
  handleScroll,
  lockedSelectedDormIds,
  noResultsDescription,
  isMobile,
  selectedDormIds,
  setSelectedDormIds,
  viewMode,
  visibleDorms,
}: DormSelectionResultsProps) {
  if (visibleDorms.length === 0) {
    return (
      <div className={`rounded-3xl border border-dashed border-slate-200 bg-slate-50/70 ${isMobile ? 'py-8' : 'py-12'}`}>
        <Empty description={noResultsDescription} image={Empty.PRESENTED_IMAGE_SIMPLE} />
      </div>
    );
  }

  return (
    <div
      className={`overflow-y-auto scrollbar-hide ${isMobile ? 'min-h-[200px] max-h-[280px]' : 'min-h-[300px] max-h-[400px] pr-2'}`}
      onScroll={handleScroll}
    >
      {viewMode === 'list' ? (
        <GlassTable
          size="small"
          dataSource={visibleDorms}
          columns={buildDormTableColumns(isMobile)}
          rowKey="id"
          pagination={false}
          rowSelection={{
            type: 'checkbox',
            selectedRowKeys: selectedDormIds,
            getCheckboxProps: (record: TaskDorm) => ({
              disabled: record._readonly === true,
            }),
            onChange: (keys) =>
              setSelectedDormIds(
                Array.from(new Set([...lockedSelectedDormIds, ...(keys as EntityId[])])),
              ),
          }}
          className={isMobile ? 'task-publish-table-mobile' : 'task-publish-table'}
        />
      ) : (
        <DormGridSelector
          dataSource={visibleDorms}
          selectedRowKeys={selectedDormIds}
          onChange={setSelectedDormIds}
          viewMode={viewMode === 'mini' ? 'mini' : 'card'}
          grid={
            isMobile
              ? { gutter: 8, xs: 2, sm: 2 }
              : { gutter: 12, xs: 2, sm: 2, md: 3, lg: 3, xl: 3, xxl: 4 }
          }
        />
      )}
    </div>
  );
}

export default function DormSelectionStep({
  isMobile,
  dorms,
  draftDormFilters,
  setDraftDormFilters,
  appliedDormFilters,
  setAppliedDormFilters,
  draftDormSearch,
  setDraftDormSearch,
  appliedDormSearch,
  setAppliedDormSearch,
  selectedDormIds,
  setSelectedDormIds,
  visibleCount,
  setVisibleCount,
  viewMode,
  setViewMode,
  mobileFilterOpen,
  setMobileFilterOpen,
}: DormSelectionStepProps) {
  const dormList = useMemo(() => (Array.isArray(dorms) ? dorms : []), [dorms]);
  const accessibleDormMap = useMemo(() => {
    const nextMap = new Map<string, TaskDorm>();
    dormList.forEach((dorm) => {
      if (dorm.id === undefined || dorm.id === null) {
        return;
      }
      nextMap.set(String(dorm.id), dorm);
    });
    return nextMap;
  }, [dormList]);
  const lockedSelectedDorms = useMemo<TaskDorm[]>(
    () =>
      selectedDormIds
        .filter((id) => !accessibleDormMap.has(String(id)))
        .map((id) => ({
          id,
          building: HISTORICAL_DORM_LABEL,
          roomNo: `ID ${String(id)}`,
          campus: '',
          _readonly: true,
          _readonlyReason: READONLY_DORM_REASON,
        })),
    [accessibleDormMap, selectedDormIds],
  );
  const lockedSelectedDormIds = useMemo(
    () =>
      lockedSelectedDorms
        .map((dorm) => dorm.id)
        .filter((id): id is EntityId => id !== undefined && id !== null),
    [lockedSelectedDorms],
  );
  const dormListWithHistorical = useMemo(
    () => [...lockedSelectedDorms, ...dormList],
    [dormList, lockedSelectedDorms],
  );
  const selectedWritableCount = useMemo(
    () => selectedDormIds.filter((id) => accessibleDormMap.has(String(id))).length,
    [accessibleDormMap, selectedDormIds],
  );
  const hasWritableDorms = dormList.length > 0;
  const isDormDirty = useMemo(() => {
    if (draftDormSearch.trim() !== appliedDormSearch.trim()) {
      return true;
    }

    return !areDormFiltersEqual(draftDormFilters, appliedDormFilters);
  }, [appliedDormFilters, appliedDormSearch, draftDormFilters, draftDormSearch]);

  const campuses = useMemo(
    () =>
      Array.from(
        new Set(
          dormList
            .filter((item) => !item._readonly)
            .map((item) => item.campus)
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort(),
    [dormList],
  );
  const buildings = useMemo(
    () =>
      Array.from(
        new Set(
          dormList
            .filter((item) => !item._readonly)
            .map((item) => item.building)
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort(),
    [dormList],
  );
  const floors = useMemo(
    () =>
      Array.from(
        new Set(
          dormList
            .filter((item) => !item._readonly)
            .map((item) => item.floor)
            .filter((value): value is string | number => value !== null && value !== undefined),
        ),
      ).sort((left, right) => Number(left) - Number(right)),
    [dormList],
  );
  const grades = useMemo(
    () =>
      Array.from(
        new Set(
          dormList
            .filter((dorm) => !dorm._readonly)
            .flatMap((dorm) => resolveDormGrades(dorm))
            .filter(Boolean),
        ),
      ).sort(),
    [dormList],
  );
  const colleges = useMemo(
    () =>
      Array.from(
        new Set(
          dormList
            .filter((dorm) => !dorm._readonly)
            .flatMap((dorm) => resolveDormColleges(dorm))
            .filter(Boolean),
        ),
      ).sort(),
    [dormList],
  );

  const dormOptions = useMemo(() => {
    const keyword = appliedDormSearch.trim().toLowerCase();

    return dormListWithHistorical
      .filter((dorm) => {
        if (dorm._readonly) {
          if (!keyword) {
            return true;
          }
          return (
            (dorm.building || '').toLowerCase().includes(keyword) ||
            String(dorm.roomNo || '').toLowerCase().includes(keyword) ||
            (dorm._readonlyReason || '').toLowerCase().includes(keyword)
          );
        }
        if (!matchesSingleValueFilter(appliedDormFilters.campus, dorm.campus)) {
          return false;
        }
        if (!matchesSingleValueFilter(appliedDormFilters.building, dorm.building)) {
          return false;
        }
        if (!matchesSingleValueFilter(appliedDormFilters.floor, dorm.floor)) {
          return false;
        }
        if (!matchesAnyValueFilter(appliedDormFilters.grade, resolveDormGrades(dorm))) {
          return false;
        }
        if (!matchesAnyValueFilter(appliedDormFilters.college, resolveDormColleges(dorm))) {
          return false;
        }

        if (!keyword) {
          return true;
        }

        return (
          (dorm.building || '').toLowerCase().includes(keyword) ||
          String(dorm.roomNo || '').toLowerCase().includes(keyword) ||
          (dorm.campus || '').toLowerCase().includes(keyword)
        );
      })
      .sort((left, right) =>
        left._readonly !== right._readonly
          ? Number(Boolean(left._readonly)) - Number(Boolean(right._readonly))
          : left.building === right.building
          ? String(left.roomNo || '').localeCompare(String(right.roomNo || ''))
          : String(left.building || '').localeCompare(String(right.building || '')),
      );
  }, [appliedDormFilters, appliedDormSearch, dormListWithHistorical]);

  const visibleDorms = useMemo(() => dormOptions.slice(0, visibleCount), [dormOptions, visibleCount]);
  const dormFilters = useMemo(
    () =>
      buildDormFilterConfig(
        campuses,
        buildings,
        floors,
        grades,
        colleges,
        draftDormFilters,
        setDraftDormFilters,
      ),
    [buildings, campuses, colleges, draftDormFilters, floors, grades, setDraftDormFilters],
  );

  const activeFilterCount = [
    ...draftDormFilters.campus,
    ...draftDormFilters.building,
    ...draftDormFilters.floor,
    ...draftDormFilters.grade,
    ...draftDormFilters.college,
  ].length;

  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = event.currentTarget;
    if (scrollHeight - scrollTop - clientHeight < 200 && visibleCount < dormOptions.length) {
      setVisibleCount((prev) => Math.min(prev + 50, dormOptions.length));
    }
  };

  const handleDormSearch = () => {
    if (!isDormDirty) {
      return;
    }

    setAppliedDormFilters({
      campus: [...draftDormFilters.campus],
      building: [...draftDormFilters.building],
      floor: [...draftDormFilters.floor],
      grade: [...draftDormFilters.grade],
      college: [...draftDormFilters.college],
    });
    setAppliedDormSearch(draftDormSearch);
    setVisibleCount(50);
  };

  const handleDormReset = () => {
    setDraftDormFilters(createEmptyDormFilters());
    setAppliedDormFilters(createEmptyDormFilters());
    setDraftDormSearch('');
    setAppliedDormSearch('');
    setVisibleCount(50);
  };
  const noResultsDescription = hasWritableDorms
    ? '当前筛选条件下没有可选宿舍'
    : '当前数据范围下暂无可分配宿舍';

  return (
    <div className={isMobile ? 'py-1' : 'py-4'}>
      {lockedSelectedDorms.length > 0 ? (
        <Alert
          type="warning"
          showIcon
          className="mb-4"
          message="当前任务包含历史宿舍"
          description={`已保留 ${lockedSelectedDorms.length} 间历史宿舍的展示，但这些宿舍已超出当前数据范围，当前页面不可操作，提交时以后端校验为准。`}
        />
      ) : null}
      {!hasWritableDorms ? (
        <Alert
          type="info"
          showIcon
          className="mb-4"
          message="当前没有可写宿舍"
          description="当前角色数据范围下暂无可分配宿舍。若需继续操作，请联系管理员调整角色数据范围。"
        />
      ) : null}
      <DormSelectionControls
        activeFilterCount={activeFilterCount}
        draftDormSearch={draftDormSearch}
        dormOptions={dormOptions}
        dormFilters={dormFilters}
        handleDormReset={handleDormReset}
        handleDormSearch={handleDormSearch}
        isDormDirty={isDormDirty}
        isMobile={isMobile}
        lockedSelectedDormIds={lockedSelectedDormIds}
        selectedDormIds={selectedDormIds}
        setSelectedDormIds={setSelectedDormIds}
        setDraftDormSearch={setDraftDormSearch}
        setMobileFilterOpen={setMobileFilterOpen}
        setViewMode={setViewMode}
        viewMode={viewMode}
      />

      <DormSelectionSummary
        dormOptions={dormOptions}
        isMobile={isMobile}
        lockedSelectedDormIds={lockedSelectedDormIds}
        selectedDormIds={selectedDormIds}
        setSelectedDormIds={setSelectedDormIds}
      />
      {lockedSelectedDorms.length > 0 ? (
        <div className={`mb-4 text-xs ${isMobile ? '' : 'px-1'} text-amber-700`}>
          当前已选 {selectedWritableCount} 间可操作宿舍，另有 {lockedSelectedDorms.length} 间历史宿舍仅保留展示。
        </div>
      ) : null}

      <DormSelectionResults
        handleScroll={handleScroll}
        lockedSelectedDormIds={lockedSelectedDormIds}
        noResultsDescription={noResultsDescription}
        isMobile={isMobile}
        selectedDormIds={selectedDormIds}
        setSelectedDormIds={setSelectedDormIds}
        viewMode={viewMode}
        visibleDorms={visibleDorms}
      />

      <MobileAdvancedFilter
        open={mobileFilterOpen}
        onClose={() => setMobileFilterOpen(false)}
        title="宿舍筛选"
        filters={dormFilters}
        onReset={handleDormReset}
        onConfirm={() => setMobileFilterOpen(false)}
      />
    </div>
  );
}
