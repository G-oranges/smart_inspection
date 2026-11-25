import type { Dispatch, Key, SetStateAction } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Col, FloatButton } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  DashboardOutlined,
  FileSearchOutlined,
  SafetyCertificateOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';

import { useAppContext } from '../context/AppContext';
import GlassTable from '../components/GlassTable';
import PageLayout from '../components/PageLayout';
import TableFieldSettings from '../components/TableFieldSettings';
import PermissionDeniedState from '../components/common/PermissionDeniedState';
import { resultViewPermissionPreset } from '../components/common/permissionDeniedPresets';
import ResponsiveDataView from '../components/ResponsiveDataView';
import AppleStatCard from '../components/common/AppleStatCard';
import CollapsibleStatsBoard, {
  type StatSegment,
} from '../components/stats/CollapsibleStatsBoard';
import { useMobile } from '../hooks/useMobile';
import { useResultTableState } from '../hooks/useResultTableState';
import { useBulkSelection } from '../hooks/useBulkSelection';
import { useTableFetch } from '../hooks/useTableFetch';
import { useTableColumns } from '../hooks/useTableColumns';
import { useResizableColumns } from '../hooks/useResizableColumns';
import { gradeLabelFromRules } from '../utils/settings';
import { AppealCreateModal, useAppealActions } from './appeal';
import type { AppealCandidateInspection } from './appeal/modals/AppealCreateModal';
import {
  createActionColumn,
  createBaseColumns,
  RESULT_DEFAULT_COLUMNS,
  RESULT_TABLE_KEY,
  ResultActionSheet,
  ResultDetailModal,
  ResultFilters,
  ResultMobileCard,
  useResultActions,
} from './result';

import type { AppealRecord, EntityId, ServiceRecord } from '../types/service';
import type { PaginationState } from '../types/table';
import type {
  RatingForScore,
  ResultAppealRecord,
  ResultColumnConfig,
  ResultDormBedRecord,
  ResultFiltersState,
  ResultInspectionRecord,
  ResultPageActions,
  ResultPageData,
  ResultTaskRecord,
} from './result/types';

type ResizableResultColumn = ColumnsType<ResultInspectionRecord>[number] & {
  key?: string | number;
  dataIndex?: string | number | readonly (string | number)[];
  width?: number;
  fixed?: boolean | 'left' | 'right';
  onHeaderCell?: () => {
    width: number;
    onResize: (...args: unknown[]) => void;
  };
  [key: string]: unknown;
};

interface ResultStatsProps {
  inspections: ResultInspectionRecord[];
  appeals: ResultAppealRecord[];
  totalCount: number;
}

interface ResultListSectionProps {
  isMobile: boolean;
  filteredInspections: ResultInspectionRecord[];
  selectedResultIds: EntityId[];
  setSelectedResultIds: Dispatch<SetStateAction<EntityId[]>>;
  pagination: PaginationState;
  setPagination: Dispatch<SetStateAction<PaginationState>>;
  totalCount: number;
  ratingForScore: RatingForScore;
  canAdjust: boolean;
  tableColumns: ColumnsType<ResultInspectionRecord>;
  onSortChange: (field: string, order: 'asc' | 'desc' | null) => void;
}

interface ResultViewContentProps {
  allAppeals: ResultAppealRecord[];
  allInspections: ResultInspectionRecord[];
  canAdjust: boolean;
  collegeOptions: string[];
  draftFilters: ResultFiltersState;
  exporting: boolean;
  filteredInspections: ResultInspectionRecord[];
  gradeOptions: string[];
  handleDeleteResults: (ids: EntityId[]) => Promise<void>;
  handleExport?: () => Promise<void>;
  handleRefresh: () => Promise<void>;
  handleResetFilters: () => void;
  handleSearch: () => void;
  isDirty: boolean;
  isMobile: boolean;
  levelOptions: string[];
  onOpenSettings: () => void;
  onSortChange: (field: string, order: 'asc' | 'desc' | null) => void;
  pageTasks?: ResultTaskRecord[];
  pagination: PaginationState;
  ratingForScore: RatingForScore;
  selectedResultIds: EntityId[];
  setDraftFilters: Dispatch<SetStateAction<ResultFiltersState>>;
  setPagination: Dispatch<SetStateAction<PaginationState>>;
  setSelectedResultIds: Dispatch<SetStateAction<EntityId[]>>;
  tableColumns: ColumnsType<ResultInspectionRecord>;
  totalCount: number;
}

interface ResultViewOverlaysProps {
  actionSheetOpen: boolean;
  activeRoleCode?: string;
  appealByInspectionId: Map<string, ResultAppealRecord>;
  canAdjust: boolean;
  canViewAppeals: boolean;
  detail: ReturnType<typeof useResultActions>['detail'];
  filteredInspections: ResultInspectionRecord[];
  handleCloseDetail: () => void;
  handleDeleteResults: (ids: EntityId[]) => Promise<void>;
  handleModifyNavigation: (inspection: ResultInspectionRecord) => void;
  handleOpenDetail: (inspection: ResultInspectionRecord) => Promise<void>;
  isMobile: boolean;
  onOpenAppealCreate: (inspection: ResultInspectionRecord) => void;
  onViewAppeal: (appealId: EntityId) => void;
  ratingForScore: RatingForScore;
  selectedResultIds: EntityId[];
  setActionSheetOpen: Dispatch<SetStateAction<boolean>>;
  settings: ReturnType<typeof useAppContext>['settings'];
}

function toArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function ResultStats({ inspections, appeals, totalCount }: ResultStatsProps) {
  const today = dayjs().startOf('day');
  const todayCount = inspections.filter((inspection) => {
    if (!inspection.createdAt) {
      return false;
    }
    return dayjs(inspection.createdAt).isAfter(today);
  }).length;
  const pendingAppeals = appeals.filter((appeal) => appeal.status === 'pending').length;
  const avgScore =
    inspections.length > 0
      ? (
          inspections.reduce((total, inspection) => total + (inspection.totalScore || 0), 0) /
          inspections.length
        ).toFixed(1)
      : 0;

  return (
    <>
      <Col xs={12} sm={12} md={6}>
        <AppleStatCard
          icon={<FileSearchOutlined />}
          value={totalCount}
          label="累计查寝记录"
          dotColor="blue"
        />
      </Col>
      <Col xs={12} sm={12} md={6}>
        <AppleStatCard
          icon={<DashboardOutlined />}
          value={todayCount}
          label="今日新增"
          unit="条"
          dotColor="green"
        />
      </Col>
      <Col xs={12} sm={12} md={6}>
        <AppleStatCard
          icon={<SafetyCertificateOutlined />}
          value={avgScore}
          label="平均得分"
          unit="分"
          dotColor="orange"
        />
      </Col>
      <Col xs={12} sm={12} md={6}>
        <AppleStatCard
          icon={<WarningOutlined />}
          value={pendingAppeals}
          label="待处理申诉"
          unit="条"
          dotColor="purple"
        />
      </Col>
    </>
  );
}

function mapResultStatsToSegments(
  inspections: ResultInspectionRecord[],
  appeals: ResultAppealRecord[],
  totalCount: number,
): StatSegment[] {
  const today = dayjs().startOf('day');
  const todayCount = inspections.filter((inspection) => {
    if (!inspection.createdAt) {
      return false;
    }
    return dayjs(inspection.createdAt).isAfter(today);
  }).length;
  const pendingAppeals = appeals.filter((appeal) => appeal.status === 'pending').length;
  const avgScore =
    inspections.length > 0
      ? (
          inspections.reduce((total, inspection) => total + (inspection.totalScore || 0), 0) /
          inspections.length
        ).toFixed(1)
      : 0;

  return [
    {
      id: 'result-total',
      icon: <FileSearchOutlined />,
      value: totalCount,
      label: '记录',
      tone: 'blue',
    },
    {
      id: 'result-today',
      icon: <DashboardOutlined />,
      value: todayCount,
      label: '今日',
      unit: '条',
      tone: 'green',
    },
    {
      id: 'result-average',
      icon: <SafetyCertificateOutlined />,
      value: avgScore,
      label: '平均分',
      unit: '分',
      tone: 'orange',
    },
    {
      id: 'result-appeals',
      icon: <WarningOutlined />,
      value: pendingAppeals,
      label: '待处理申诉',
      unit: '条',
      tone: 'purple',
    },
  ];
}

function ResultListSection({
  isMobile,
  filteredInspections,
  selectedResultIds,
  setSelectedResultIds,
  pagination,
  setPagination,
  totalCount,
  ratingForScore,
  canAdjust,
  tableColumns,
  onSortChange,
}: ResultListSectionProps) {
  return (
    <div className="space-y-4">
      <div className="table-head dorm-table-head mb-4">
        <div className="flex items-center gap-2">
          <div className="dorm-table-head-accent" />
          <h3 className="dorm-table-head-title">查寝结果列表</h3>
        </div>
      </div>

      <div className={`table-wrapper${isMobile ? '' : ' dorm-table-wrapper'}`}>
        {isMobile ? (
          <ResponsiveDataView<ResultInspectionRecord>
            isMobile={true}
            dataSource={filteredInspections}
            loading={false}
            rowKey="id"
            emptyText="暂无查寝记录"
            selectedKeys={selectedResultIds}
            onSelectChange={(keys: Key[]) => setSelectedResultIds(keys as EntityId[])}
            pagination={{
              current: pagination.current,
              pageSize: pagination.pageSize,
              total: totalCount,
            }}
            onPaginationChange={(page: number, size?: number) =>
              setPagination((prev) => ({
                ...prev,
                current: page,
                pageSize: size || prev.pageSize,
              }))
            }
            renderCard={(
              record: ResultInspectionRecord,
              _index: number,
              options: { selected: boolean; onSelect?: (selected: boolean) => void },
            ) => (
              <ResultMobileCard
                record={record}
                selected={options.selected}
                onSelect={options.onSelect}
                ratingForScore={ratingForScore}
              />
            )}
          />
        ) : (
          <GlassTable<ResultInspectionRecord>
            dataSource={filteredInspections}
            rowKey="id"
            useSkeleton={false}
            resizable={true}
            rowSelection={
              canAdjust
                ? {
                    selectedRowKeys: selectedResultIds,
                    onChange: (keys) => setSelectedResultIds(keys as EntityId[]),
                    preserveSelectedRowKeys: true,
                  }
                : undefined
            }
            pagination={{
              ...pagination,
              total: totalCount,
            }}
            onChange={(nextPagination, _filters, sorter) => {
              setPagination((prev) => ({
                ...prev,
                current: nextPagination.current || prev.current,
                pageSize: nextPagination.pageSize || prev.pageSize,
              }));
              const activeSorter = Array.isArray(sorter) ? sorter[0] : sorter;
              const field =
                activeSorter?.columnKey !== undefined && activeSorter?.columnKey !== null
                  ? String(activeSorter.columnKey)
                  : activeSorter?.field !== undefined && activeSorter?.field !== null
                    ? String(activeSorter.field)
                    : '';
              if (!activeSorter?.order || !field) {
                onSortChange('', null);
              } else {
                onSortChange(field, activeSorter.order === 'ascend' ? 'asc' : 'desc');
              }
            }}
            className="dorm-table"
            scroll={{ x: 'max-content' }}
            columns={tableColumns}
          />
        )}
      </div>
    </div>
  );
}

function ResultViewLoadingState() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
    </div>
  );
}

function ResultViewAccessDenied({ navigateHome }: { navigateHome: () => void }) {
  return (
    <PermissionDeniedState
      {...resultViewPermissionPreset}
      actionText="返回首页"
      onAction={navigateHome}
    />
  );
}

function ResultViewContent({
  allAppeals,
  allInspections,
  canAdjust,
  collegeOptions,
  draftFilters,
  exporting,
  filteredInspections,
  gradeOptions,
  handleDeleteResults,
  handleExport,
  handleRefresh,
  handleResetFilters,
  handleSearch,
  isDirty,
  isMobile,
  levelOptions,
  onOpenSettings,
  onSortChange,
  pageTasks,
  pagination,
  ratingForScore,
  selectedResultIds,
  setDraftFilters,
  setPagination,
  setSelectedResultIds,
  tableColumns,
  totalCount,
}: ResultViewContentProps) {
  return (
    <div className="result-view-page management-theme-page">
      <PageLayout
        statsLayout="custom"
        stats={
          <CollapsibleStatsBoard
            expandedContent={
              <ResultStats
                inspections={allInspections}
                appeals={allAppeals}
                totalCount={totalCount}
              />
            }
            segments={mapResultStatsToSegments(
              allInspections,
              allAppeals,
              totalCount,
            )}
          />
        }
        filters={
          <ResultFilters
            isMobile={isMobile}
            tasks={pageTasks}
            gradeOptions={gradeOptions}
            collegeOptions={collegeOptions}
            levelOptions={levelOptions}
            draftFilters={draftFilters}
            setDraftFilters={setDraftFilters}
            isDirty={isDirty}
            handleSearch={handleSearch}
            handleResetFilters={handleResetFilters}
            handleRefresh={() => {
              void handleRefresh();
            }}
            handleExport={
              handleExport
                ? () => {
                    void handleExport();
                  }
                : undefined
            }
            exporting={exporting}
            totalCount={totalCount}
            canAdjust={canAdjust}
            selectedResultIds={selectedResultIds}
            handleDeleteResults={(ids: EntityId[]) => {
              void handleDeleteResults(ids);
            }}
            onOpenSettings={onOpenSettings}
          />
        }
      >
        <ResultListSection
          isMobile={isMobile}
          filteredInspections={filteredInspections}
          selectedResultIds={selectedResultIds}
          setSelectedResultIds={setSelectedResultIds}
          pagination={pagination}
          setPagination={setPagination}
          totalCount={totalCount}
          ratingForScore={ratingForScore}
          canAdjust={canAdjust}
          tableColumns={tableColumns}
          onSortChange={onSortChange}
        />
      </PageLayout>
    </div>
  );
}

function ResultViewOverlays({
  actionSheetOpen,
  activeRoleCode,
  appealByInspectionId,
  canAdjust,
  canViewAppeals,
  detail,
  filteredInspections,
  handleCloseDetail,
  handleDeleteResults,
  handleModifyNavigation,
  handleOpenDetail,
  isMobile,
  onOpenAppealCreate,
  onViewAppeal,
  ratingForScore,
  selectedResultIds,
  setActionSheetOpen,
  settings,
}: ResultViewOverlaysProps) {
  return (
    <>
      <ResultDetailModal
        detail={detail}
        canAdjust={canAdjust}
        isMobile={isMobile}
        settings={settings}
        ratingForScore={ratingForScore}
        onClose={handleCloseDetail}
        onModify={handleModifyNavigation}
      />

      {isMobile ? (
        <>
          <FloatButton.BackTop
            style={{
              right: 24,
              bottom: selectedResultIds.length > 0 ? 100 : 80,
            }}
          />
          <ResultActionSheet
            open={actionSheetOpen}
            onClose={() => setActionSheetOpen(false)}
            selectedIds={selectedResultIds}
            filteredInspections={filteredInspections}
            canAdjust={canAdjust}
            canViewAppeals={canViewAppeals}
            activeRoleCode={activeRoleCode}
            appealByInspectionId={appealByInspectionId}
            onOpenDetail={(inspection: ResultInspectionRecord) => {
              void handleOpenDetail(inspection);
            }}
            onDeleteResults={(ids: EntityId[]) => {
              void handleDeleteResults(ids);
            }}
            onOpenAppealCreate={onOpenAppealCreate}
            onViewAppeal={onViewAppeal}
          />
        </>
      ) : null}
    </>
  );
}

interface ResultInspectionDataParams {
  activeRoleCode?: string;
  appliedFilters: ResultFiltersState;
  pageData: ResultPageData;
  ratingForScore: RatingForScore;
  settings: ReturnType<typeof useAppContext>['settings'];
  tableSortField: string;
  tableSortOrder: 'asc' | 'desc';
}

function useResultInspectionData({
  activeRoleCode,
  appliedFilters,
  pageData,
  ratingForScore,
  settings,
  tableSortField,
  tableSortOrder,
}: ResultInspectionDataParams) {
  const allInspections = toArray<ResultInspectionRecord>(pageData.inspections);
  const inspections = useMemo(
    () =>
      activeRoleCode === 'STUDENT'
        ? toArray<ResultInspectionRecord>(pageData.myInspections)
        : allInspections,
    [activeRoleCode, allInspections, pageData.myInspections],
  );
  const allAppeals = toArray<ResultAppealRecord>(pageData.appeals);
  const appeals = useMemo(
    () =>
      activeRoleCode === 'STUDENT'
        ? toArray<ResultAppealRecord>(pageData.myAppeals)
        : allAppeals,
    [activeRoleCode, allAppeals, pageData.myAppeals],
  );

  const dormBedMap = useMemo(() => {
    const map = new Map<EntityId, ResultDormBedRecord[]>();
    toArray<ResultDormBedRecord>(pageData.dormBeds).forEach((bed) => {
      const dormId = bed.dormId || bed.dorm?.id;
      if (dormId === undefined || dormId === null) {
        return;
      }
      const cachedBeds = map.get(dormId) || [];
      cachedBeds.push(bed);
      map.set(dormId, cachedBeds);
    });
    return map;
  }, [pageData.dormBeds]);

  const decoratedInspections = useMemo<ResultInspectionRecord[]>(() => {
    const tasks = toArray<ServiceRecord>(pageData.tasks);
    const dorms = toArray<ServiceRecord>(pageData.dorms);

    return inspections.map((record) => {
      const task = tasks.find((item) => item.id === record.taskId) || record.task || null;
      const dorm = dorms.find((item) => item.id === record.dormId) || record.dorm || null;
      return {
        ...record,
        task: task as ResultInspectionRecord['task'],
        dorm: dorm as ResultInspectionRecord['dorm'],
      };
    });
  }, [inspections, pageData.dorms, pageData.tasks]);

  const resolveDormBeds = useCallback(
    (record: ResultInspectionRecord): ResultDormBedRecord[] => {
      const dorm = record.dorm;
      if (!dorm) {
        return [];
      }

      const beds = dorm.beds || dorm.dormBeds;
      if (Array.isArray(beds) && beds.length > 0) {
        return beds;
      }

      const dormId = dorm.id || record.dormId;
      if (dormId === undefined || dormId === null) {
        return [];
      }
      return dormBedMap.get(dormId) || [];
    },
    [dormBedMap],
  );

  const resolveDormColleges = useCallback(
    (record: ResultInspectionRecord): string[] => {
      if (Array.isArray(record.dormColleges) && record.dormColleges.length > 0) {
        return record.dormColleges;
      }

      const colleges = resolveDormBeds(record)
        .map((bed) => bed.college || bed.student?.college)
        .filter((value): value is string => Boolean(value));
      return [...new Set(colleges)];
    },
    [resolveDormBeds],
  );

  const resolveDormGrades = useCallback(
    (record: ResultInspectionRecord): string[] => {
      if (Array.isArray(record.dormGrades) && record.dormGrades.length > 0) {
        return record.dormGrades;
      }

      const studentGrades = resolveDormBeds(record)
        .map((bed) => bed.grade || bed.student?.grade)
        .filter((value): value is string => Boolean(value));
      if (studentGrades.length > 0) {
        return [...new Set(studentGrades)];
      }
      if (record.dorm?.grade) {
        return [record.dorm.grade];
      }
      return [];
    },
    [resolveDormBeds],
  );

  const gradeOptions = useMemo(
    () =>
      Array.from(
        new Set(
          decoratedInspections.flatMap((record) => resolveDormGrades(record)),
        ),
      ).sort((left, right) => left.localeCompare(right, 'zh-CN')),
    [decoratedInspections, resolveDormGrades],
  );

  const collegeOptions = useMemo(
    () =>
      Array.from(
        new Set(
          decoratedInspections.flatMap((record) => resolveDormColleges(record)),
        ),
      ).sort((left, right) => left.localeCompare(right, 'zh-CN')),
    [decoratedInspections, resolveDormColleges],
  );

  const levelOptions = useMemo(
    () => settings?.gradingRules?.map((rule) => rule.label).filter(Boolean) || [],
    [settings?.gradingRules],
  );

  const filteredInspections = useMemo(() => {
    return decoratedInspections
      .filter((record) => {
        if (appliedFilters.keyword?.trim()) {
          const keyword = appliedFilters.keyword.trim().toLowerCase();
          const building = record.dorm?.building?.trim();
          const roomNo = record.dorm?.roomNo?.trim();
          const combinedDormLabels =
            building && roomNo
              ? [`${building}-${roomNo}`, `${building}${roomNo}`]
              : [];
          const keywordTargets = [
            record.task?.title,
            building,
            roomNo,
            ...combinedDormLabels,
            record.recordedByName,
            record.reviewedBy?.fullName,
            record.createdBy?.fullName,
            record.comments,
            ...resolveDormColleges(record),
            ...resolveDormGrades(record),
          ]
            .filter((value): value is string => Boolean(value))
            .join(' ')
            .toLowerCase();

          if (!keywordTargets.includes(keyword)) {
            return false;
          }
        }
        if (
          appliedFilters.taskId?.length > 0 &&
          !appliedFilters.taskId.includes(record.taskId as EntityId)
        ) {
          return false;
        }
        if (appliedFilters.grade?.length > 0) {
          const dormGrades = resolveDormGrades(record);
          if (!dormGrades.some((grade) => appliedFilters.grade.includes(grade))) {
            return false;
          }
        }
        if (appliedFilters.college?.length > 0) {
          const dormColleges = resolveDormColleges(record);
          if (!dormColleges.some((college) => appliedFilters.college.includes(college))) {
            return false;
          }
        }
        if (
          appliedFilters.level?.length > 0 &&
          !appliedFilters.level.includes(ratingForScore(record.totalScore))
        ) {
          return false;
        }
        if (
          appliedFilters.gender?.length > 0 &&
          !appliedFilters.gender.includes(String(record.dorm?.gender || ''))
        ) {
          return false;
        }
        if (appliedFilters.dateRange && appliedFilters.dateRange.length === 2) {
          const [start, end] = appliedFilters.dateRange;
          if (record.task?.date) {
            const taskDate = dayjs(record.task.date);
            if (taskDate.isBefore(start, 'day') || taskDate.isAfter(end, 'day')) {
              return false;
            }
          } else if (record.createdAt) {
            const createDate = dayjs(record.createdAt);
            if (createDate.isBefore(start, 'day') || createDate.isAfter(end, 'day')) {
              return false;
            }
          }
        }
        return true;
      })
      .sort((left, right) => {
        if (tableSortField) {
          const direction = tableSortOrder === 'asc' ? 1 : -1;
          if (tableSortField === 'taskTitle') {
            return (
              String(left.task?.title || '').localeCompare(
                String(right.task?.title || ''),
                'zh-CN',
              ) * direction
            );
          }
          if (tableSortField === 'dorm') {
            const leftLabel = `${left.dorm?.building || ''}-${left.dorm?.roomNo || ''}`;
            const rightLabel = `${right.dorm?.building || ''}-${right.dorm?.roomNo || ''}`;
            return leftLabel.localeCompare(rightLabel, 'zh-CN', { numeric: true }) * direction;
          }
          if (tableSortField === 'college') {
            const leftCol = resolveDormColleges(left).join(',');
            const rightCol = resolveDormColleges(right).join(',');
            return leftCol.localeCompare(rightCol, 'zh-CN') * direction;
          }
          if (tableSortField === 'gradeGroup') {
            const leftGrade = resolveDormGrades(left).join(',');
            const rightGrade = resolveDormGrades(right).join(',');
            return leftGrade.localeCompare(rightGrade, 'zh-CN', { numeric: true }) * direction;
          }
          if (tableSortField === 'score') {
            const scoreLeft = left.totalScore ?? -Infinity;
            const scoreRight = right.totalScore ?? -Infinity;
            return (scoreLeft - scoreRight) * direction;
          }
          if (tableSortField === 'grade') {
            const leftLabel = ratingForScore(left.totalScore);
            const rightLabel = ratingForScore(right.totalScore);
            return leftLabel.localeCompare(rightLabel, 'zh-CN') * direction;
          }
          if (tableSortField === 'time') {
            const timeLeft = left.createdAt ? new Date(left.createdAt).getTime() : 0;
            const timeRight = right.createdAt ? new Date(right.createdAt).getTime() : 0;
            return (timeLeft - timeRight) * direction;
          }
          if (tableSortField === 'reviewer') {
            const leftName =
              left.reviewedBy?.fullName || left.createdBy?.fullName || left.recordedByName || '';
            const rightName =
              right.reviewedBy?.fullName || right.createdBy?.fullName || right.recordedByName || '';
            return leftName.localeCompare(rightName, 'zh-CN') * direction;
          }
        }

        if (
          appliedFilters.sort === 'time_desc' ||
          appliedFilters.sort === 'time_asc'
        ) {
          const timeLeft = left.createdAt ? new Date(left.createdAt).getTime() : 0;
          const timeRight = right.createdAt ? new Date(right.createdAt).getTime() : 0;
          return appliedFilters.sort === 'time_asc'
            ? timeLeft - timeRight
            : timeRight - timeLeft;
        }

        const scoreLeft = left.totalScore ?? -Infinity;
        const scoreRight = right.totalScore ?? -Infinity;
        return appliedFilters.sort === 'score_asc'
          ? scoreLeft - scoreRight
          : scoreRight - scoreLeft;
      });
  }, [
    appliedFilters,
    decoratedInspections,
    ratingForScore,
    resolveDormColleges,
    resolveDormGrades,
    tableSortField,
    tableSortOrder,
  ]);

  return {
    allAppeals,
    allInspections,
    appeals,
    collegeOptions,
    decoratedInspections,
    filteredInspections,
    gradeOptions,
    levelOptions,
    resolveDormColleges,
    resolveDormGrades,
  };
}

export default function ResultViewPage() {
  const {
    data,
    actions,
    hasPermission,
    settings,
    myProfile,
    activeRole,
    permissionsReady,
    setSelection,
  } = useAppContext();
  const pageData = data as ResultPageData;
  const pageActions = actions as ResultPageActions;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isMobile = useMobile();

  const {
    selectedIds: selectedResultIds,
    setSelectedIds: setSelectedResultIds,
    clearSelection,
  } = useBulkSelection<EntityId>();

  const {
    draftFilters,
    appliedFilters,
    pagination,
    isDirty,
    setDraftFilters,
    setPagination,
    applyFilters: handleSearch,
    resetAll: handleResetFilters,
  } = useResultTableState({
    defaultPageSize: 10,
    syncUrl: true,
    onApply: clearSelection,
    onReset: clearSelection,
  });

  const [actionSheetOpen, setActionSheetOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tableSortField, setTableSortField] = useState<string>('');
  const [tableSortOrder, setTableSortOrder] = useState<'asc' | 'desc'>('desc');

  const {
    columns: resultColumns,
    visibleColumns: visibleResultColumns,
    save: saveResultColumns,
    resetToDefault: resetResultColumns,
    saving: savingResultColumns,
  } = useTableColumns<ResultColumnConfig>({
    tableKey: RESULT_TABLE_KEY,
    defaultColumns: RESULT_DEFAULT_COLUMNS,
    fetchConfig: pageActions.fetchTableConfig
      ? async (tableKey) =>
          (await pageActions.fetchTableConfig?.(tableKey)) as
            | { config?: ResultColumnConfig[] }
            | null
            | undefined
      : undefined,
    saveConfig: pageActions.saveTableConfig
      ? async (tableKey, columns) =>
          pageActions.saveTableConfig?.(tableKey, columns)
      : undefined,
  });

  const handleSortChange = useCallback(
    (field: string, order: 'asc' | 'desc' | null) => {
      if (!field || !order) {
        setTableSortField('');
        setTableSortOrder('desc');
        return;
      }
      setTableSortField(field);
      setTableSortOrder(order);
    },
    [],
  );

  useEffect(() => {
    setTableSortField('');
  }, [appliedFilters.sort]);

  const canView = hasPermission('RESULT_VIEW');
  const canAdjust = hasPermission('RESULT_RECORD');
  const canExport = hasPermission('RESULT_EXPORT');
  const canViewAppeals = hasPermission('APPEAL_VIEW');

  useEffect(() => {
    const appealId = searchParams.get('appealId');
    const focus = searchParams.get('focus');
    if (!appealId && focus !== 'appeals') {
      return;
    }

    const nextParams = new URLSearchParams();
    if (appealId) {
      nextParams.set('appealId', appealId);
    } else {
      nextParams.set('status', 'pending');
    }
    navigate(`/appeals?${nextParams.toString()}`, { replace: true });
  }, [navigate, searchParams]);

  const ratingForScore = useMemo<RatingForScore>(
    () => (score) =>
      gradeLabelFromRules(
        score,
        settings?.gradingRules as Parameters<typeof gradeLabelFromRules>[1],
      ),
    [settings?.gradingRules],
  );

  const fetchResultData = useCallback(async () => {
    await pageActions.loadTasks?.();
    await pageActions.loadDorms?.();

    if (canView) {
      await pageActions.loadInspections?.();
    }
    if (canViewAppeals) {
      await pageActions.loadAppeals?.();
    }

    if (activeRole?.code === 'STUDENT') {
      await pageActions.loadMyInspections?.();
      await pageActions.loadMyAppeals?.();
    }

    return { items: [], total: 0 };
  }, [activeRole?.code, canView, canViewAppeals, pageActions]);

  useTableFetch({
    fetchFn: fetchResultData,
    buildParams: () => ({}),
    enabled: permissionsReady,
    deps: [activeRole?.code, canView, canViewAppeals],
  });

  useEffect(() => {
    if (!isMobile) {
      return;
    }

    setSelection({
      count: selectedResultIds.length,
      onClear: clearSelection,
      onAction: () => setActionSheetOpen(true),
      actionLabel: '操作',
    });
  }, [clearSelection, isMobile, selectedResultIds.length, setSelection]);

  const {
    allAppeals,
    allInspections,
    appeals,
    collegeOptions,
    decoratedInspections,
    filteredInspections,
    gradeOptions,
    levelOptions,
    resolveDormColleges,
    resolveDormGrades,
  } = useResultInspectionData({
    activeRoleCode: activeRole?.code,
    appliedFilters,
    pageData,
    ratingForScore,
    settings,
    tableSortField,
    tableSortOrder,
  });

  const appealByInspectionId = useMemo(() => {
    const map = new Map<string, ResultAppealRecord>();
    appeals.forEach((appeal) => {
      if (appeal.inspectionId === undefined || appeal.inspectionId === null) {
        return;
      }
      if (appeal.status === 'withdrawn') {
        return;
      }
      const key = String(appeal.inspectionId);
      const existing = map.get(key);
      if (!existing || appeal.status === 'pending') {
        map.set(key, appeal);
      }
    });
    return map;
  }, [appeals]);

  const appealActions = useAppealActions({
    onSyncLegacyCollections: async () => {
      await pageActions.loadMyAppeals?.(true);
      await pageActions.loadMyInspections?.(true);
    },
  });

  const handleOpenAppealCreate = useCallback(
    (inspection: ResultInspectionRecord) => {
      if (inspection.id !== undefined && inspection.id !== null) {
        appealActions.openCreateModal(inspection.id);
      }
    },
    [appealActions],
  );

  const handleViewAppeal = useCallback(
    (appealId: EntityId) => {
      navigate(`/appeals?appealId=${encodeURIComponent(String(appealId))}`);
    },
    [navigate],
  );

  const {
    exporting,
    detail,
    handleOpenDetail,
    handleCloseDetail,
    handleModifyNavigation,
    handleExport,
    handleRefresh,
    handleDeleteResults,
  } = useResultActions({
    actions: pageActions,
    canAdjust,
    canViewAppeals,
    activeRoleCode: activeRole?.code,
    permissionsReady,
    appliedFilters: appliedFilters as ResultFiltersState,
    filteredInspections,
    clearSelection,
    navigate,
    myProfile,
  });

  const totalCount = filteredInspections.length;

  const activeSortField =
    tableSortField ||
    (appliedFilters.sort === 'score_asc' || appliedFilters.sort === 'score_desc'
      ? 'score'
      : 'time');
  const activeSortOrder: 'asc' | 'desc' = tableSortField
    ? tableSortOrder
    : appliedFilters.sort === 'score_asc' || appliedFilters.sort === 'time_asc'
      ? 'asc'
      : 'desc';

  const baseColumns = useMemo(
    () =>
      createBaseColumns({
        visibleColumns: visibleResultColumns,
        sortField: activeSortField,
        sortOrder: activeSortOrder,
        resolveDormColleges,
        resolveDormGrades,
        ratingForScore,
      }),
    [
      activeSortField,
      activeSortOrder,
      ratingForScore,
      resolveDormColleges,
      resolveDormGrades,
      visibleResultColumns,
    ],
  );
  const allTableColumns = useMemo(
    () => [
      ...baseColumns,
      createActionColumn({
        canAdjust,
        canViewAppeals,
        activeRoleCode: activeRole?.code,
        appealByInspectionId,
        onOpenDetail: handleOpenDetail,
        onDelete: handleDeleteResults,
        onOpenAppealCreate: handleOpenAppealCreate,
        onViewAppeal: handleViewAppeal,
      }),
    ],
    [
      activeRole?.code,
      appealByInspectionId,
      baseColumns,
      canAdjust,
      canViewAppeals,
      handleDeleteResults,
      handleOpenAppealCreate,
      handleOpenDetail,
      handleViewAppeal,
    ],
  );
  const resizableColumnInput = useMemo<ResizableResultColumn[]>(
    () =>
      allTableColumns.map((column) => ({
        ...column,
        key:
          column.key !== undefined && column.key !== null
            ? String(column.key)
            : undefined,
        dataIndex:
          'dataIndex' in column &&
          (typeof column.dataIndex === 'string' ||
            typeof column.dataIndex === 'number' ||
            Array.isArray(column.dataIndex))
            ? column.dataIndex
            : undefined,
        width: typeof column.width === 'number' ? column.width : undefined,
        fixed:
          column.fixed === true ||
          column.fixed === 'left' ||
          column.fixed === 'right'
            ? column.fixed
            : undefined,
        onHeaderCell: undefined,
      })),
    [allTableColumns],
  );
  const { columns: resizableTableColumns } = useResizableColumns(
    resizableColumnInput,
    {
      minWidth: 70,
      maxWidth: 480,
    },
  );

  if (!permissionsReady) {
    return <ResultViewLoadingState />;
  }

  if (!canView) {
    return <ResultViewAccessDenied navigateHome={() => navigate('/')} />;
  }

  return (
    <>
      <ResultViewContent
        allAppeals={allAppeals}
        allInspections={allInspections}
        canAdjust={canAdjust}
        collegeOptions={collegeOptions}
        draftFilters={draftFilters}
        exporting={exporting}
        filteredInspections={filteredInspections}
        gradeOptions={gradeOptions}
        handleDeleteResults={handleDeleteResults}
        handleExport={canExport ? handleExport : undefined}
        handleRefresh={handleRefresh}
        handleResetFilters={handleResetFilters}
        handleSearch={handleSearch}
        isDirty={isDirty}
        isMobile={isMobile}
        levelOptions={levelOptions}
        onOpenSettings={() => setSettingsOpen(true)}
        onSortChange={handleSortChange}
        pageTasks={pageData.tasks}
        pagination={pagination}
        ratingForScore={ratingForScore}
        selectedResultIds={selectedResultIds}
        setDraftFilters={setDraftFilters}
        setPagination={setPagination}
        setSelectedResultIds={setSelectedResultIds}
        tableColumns={resizableTableColumns as ColumnsType<ResultInspectionRecord>}
        totalCount={totalCount}
      />

      <TableFieldSettings
        open={settingsOpen}
        columns={resultColumns}
        onClose={() => setSettingsOpen(false)}
        onSave={async (columns) => {
          await saveResultColumns(
            columns.map((column) => ({
              ...column,
              fieldKey: column.fieldKey,
              label: column.label || column.fieldKey,
            })) as ResultColumnConfig[],
          );
          setSettingsOpen(false);
        }}
        onReset={resetResultColumns}
        saving={savingResultColumns}
        title="查寝结果字段设置"
      />

      <ResultViewOverlays
        actionSheetOpen={actionSheetOpen}
        activeRoleCode={activeRole?.code}
        appealByInspectionId={appealByInspectionId}
        canAdjust={canAdjust}
        canViewAppeals={canViewAppeals}
        detail={detail}
        filteredInspections={filteredInspections}
        handleCloseDetail={handleCloseDetail}
        handleDeleteResults={handleDeleteResults}
        handleModifyNavigation={handleModifyNavigation}
        handleOpenDetail={handleOpenDetail}
        isMobile={isMobile}
        onOpenAppealCreate={handleOpenAppealCreate}
        onViewAppeal={handleViewAppeal}
        ratingForScore={ratingForScore}
        selectedResultIds={selectedResultIds}
        setActionSheetOpen={setActionSheetOpen}
        settings={settings}
      />

      {activeRole?.code === 'STUDENT' ? (
        <AppealCreateModal
          open={appealActions.createOpen}
          isMobile={isMobile}
          submitting={appealActions.createSubmitting}
          inspections={decoratedInspections as AppealCandidateInspection[]}
          existingAppeals={appeals as AppealRecord[]}
          settings={settings}
          form={appealActions.createForm}
          setForm={appealActions.setCreateForm}
          onClose={appealActions.closeCreateModal}
          onSubmit={appealActions.submitCreateAppeal}
        />
      ) : null}
    </>
  );
}
