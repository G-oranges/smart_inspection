import type { Dispatch, Key, SetStateAction } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Alert, Button, FloatButton, Tabs, message } from 'antd';
import {
  CheckSquareOutlined,
  ExportOutlined,
  ImportOutlined,
  UserOutlined,
} from '@ant-design/icons';

import { useAppContext } from '../context/AppContext';
import PageLayout from '../components/PageLayout';
import CollapsibleStatsBoard from '../components/stats/CollapsibleStatsBoard';
import { useMobile } from '../hooks/useMobile';
import ResponsiveDataView from '../components/ResponsiveDataView';
import MobileAdvancedFilter from '../components/common/MobileAdvancedFilter';
import ResidencyAdjustModal from '../components/ResidencyAdjustModal';
import OccupancyHistory from '../components/OccupancyHistory';
import { useResizableColumns } from '../hooks/useResizableColumns';
import LazyImportWizardModal from '../components/common/LazyImportWizardModal';
import { prefetchImportWizardModal } from '../components/common/importWizardPrefetch';
import { CHECKIN_IMPORT_CONFIG } from '../constants/importConfigs';
import { createBuildTableParams } from '../utils/tableParamsBuilder';
import { PAGINATION_SIZE_CHANGER_PROPS } from '../utils/pagination';
import { useTableFetch } from '../hooks/useTableFetch';
import { useTableState } from '../hooks/useTableState';
import { useBulkSelection } from '../hooks/useBulkSelection';
import {
  OCCUPANCY_FILTER_KEYS,
  createDefaultHistoryFilters,
} from '../constants/occupancyConstants';
import { areHistoryFiltersEqual } from '../utils/occupancyHistoryUtils';
import {
  createActionColumn,
  createBaseColumns,
  BatchCheckInModal,
  createHistoryFilterSchema,
  createOverviewFilterSchema,
  HistoryFiltersSection,
  HistoryStats,
  mapHistoryStatsToSegments,
  mapOverviewStatsToSegments,
  OccupancyActionSheet,
  OccupancyMobileCard,
  OverviewFiltersSection,
  OverviewStats,
  useOccupancyActions,
} from './occupancy';

import type { AppDataStore, AppSelectionState } from '../types/app';
import type { EntityId, ServiceQueryParams, ServiceRecord } from '../types/service';
import type { PaginationState, TableResponse, UseTableStateResult } from '../types/table';
import type {
  BatchModalFiltersState,
  HistoryFiltersState,
  HistoryStatsState,
  OccupancyOverviewFilters,
  OccupancyPageActions,
  OccupancyStatsState,
  OccupancyColumn,
  OccupancyFilterConfig,
  OccupancyResponsiveSelectionContext,
  OccupancyStudentRecord,
} from './occupancy/types';

interface OccupancyTableStateResult
  extends Omit<UseTableStateResult, 'draftFilters' | 'appliedFilters' | 'setDraftFilters'> {
  draftFilters: OccupancyOverviewFilters;
  appliedFilters: OccupancyOverviewFilters;
  setDraftFilters: Dispatch<SetStateAction<OccupancyOverviewFilters>>;
}

function toOccupancyTableStateResult(
  state: UseTableStateResult,
): OccupancyTableStateResult {
  return {
    ...state,
    draftFilters: state.draftFilters as OccupancyOverviewFilters,
    appliedFilters: state.appliedFilters as OccupancyOverviewFilters,
    setDraftFilters:
      state.setDraftFilters as Dispatch<SetStateAction<OccupancyOverviewFilters>>,
  };
}

interface ResizableOccupancyColumn {
  key?: string | number;
  dataIndex?: string | number | readonly (string | number)[];
  width?: number;
  fixed?: boolean | 'left' | 'right';
  [key: string]: unknown;
}

interface OverviewTabPaneProps {
  fetchError: string | null;
  loading: boolean;
  isMobile: boolean;
  studentData: TableResponse<OccupancyStudentRecord>;
  resizableColumns: ServiceRecord[];
  pagination: PaginationState;
  setPagination: Dispatch<SetStateAction<PaginationState>>;
  isBatchMode: boolean;
  selectedIds: EntityId[];
  setSelectedIds: Dispatch<SetStateAction<EntityId[]>>;
  setSelectedStudentId: Dispatch<SetStateAction<EntityId | null>>;
  studentActions: ReturnType<typeof useOccupancyActions>;
  currentStudent: OccupancyStudentRecord | null;
  adjustMode: 'assign' | 'move' | 'swap';
  adjustModalOpen: boolean;
  setAdjustModalOpen: Dispatch<SetStateAction<boolean>>;
  refetchStudents: () => void;
  loadStats: () => Promise<void>;
  importWizardOpen: boolean;
  setImportWizardOpen: Dispatch<SetStateAction<boolean>>;
  uniqueBuildings: string[];
  getDormBeds?: OccupancyPageActions['getDormBeds'];
}

interface OccupancyFloatingActionsProps {
  isMobile: boolean;
  activeTab: string;
  selectedStudentId: EntityId | null;
  isBatchMode: boolean;
  selectedIds: EntityId[];
  handleToggleBatchMode: () => void;
  openImportWizard: () => void;
}

interface OccupancyManagementContentProps {
  activeTab: string;
  adjustModalOpen: boolean;
  adjustMode: 'assign' | 'move' | 'swap';
  canEdit: boolean;
  currentStudent: OccupancyStudentRecord | null;
  draftFilters: OccupancyOverviewFilters;
  draftSearchTerm: string;
  fetchError: string | null;
  filterDrawerOpen: boolean;
  handleHistorySearch: () => void;
  handleResetFilters: () => void;
  handleResetHistoryFilters: () => void;
  handleSearch: () => void;
  historyAppliedFilters: HistoryFiltersState;
  historyDraftFilters: HistoryFiltersState;
  historyStats: HistoryStatsState;
  importWizardOpen: boolean;
  isBatchMode: boolean;
  isDirty: boolean;
  isHistoryDirty: boolean;
  isMobile: boolean;
  loading: boolean;
  loadStats: () => Promise<void>;
  occupancyActions: ReturnType<typeof useOccupancyActions>;
  occupancyActionsRef: OccupancyPageActions;
  pagination: PaginationState;
  refetchStudents: () => void;
  resizableColumns: ServiceRecord[];
  selectedIds: EntityId[];
  setActiveTab: Dispatch<SetStateAction<string>>;
  setAdjustModalOpen: Dispatch<SetStateAction<boolean>>;
  setDraftFilters: Dispatch<SetStateAction<OccupancyOverviewFilters>>;
  setDraftSearchTerm: Dispatch<SetStateAction<string>>;
  setFilterDrawerOpen: Dispatch<SetStateAction<boolean>>;
  setHistoryAppliedFilters: Dispatch<SetStateAction<HistoryFiltersState>>;
  setHistoryDraftFilters: Dispatch<SetStateAction<HistoryFiltersState>>;
  setHistoryStats: Dispatch<SetStateAction<HistoryStatsState>>;
  setImportWizardOpen: Dispatch<SetStateAction<boolean>>;
  setPagination: Dispatch<SetStateAction<PaginationState>>;
  setSelectedIds: Dispatch<SetStateAction<EntityId[]>>;
  setSelectedStudentId: Dispatch<SetStateAction<EntityId | null>>;
  stats: OccupancyStatsState;
  studentData: TableResponse<OccupancyStudentRecord>;
  uniqueBuildings: string[];
  uniqueColleges: string[];
  uniqueFloors: Array<string | number>;
  uniqueGrades: string[];
}

interface OccupancyManagementOverlaysProps {
  actionSheetOpen: boolean;
  activeTab: string;
  canEdit: boolean;
  handleToggleBatchMode: () => void;
  isBatchMode: boolean;
  isMobile: boolean;
  occupancyActions: ReturnType<typeof useOccupancyActions>;
  openAdjustModal: (student: OccupancyStudentRecord, mode?: 'assign' | 'move' | 'swap') => void;
  selectedIds: EntityId[];
  selectedStudentId: EntityId | null;
  setActionSheetOpen: Dispatch<SetStateAction<boolean>>;
  setImportWizardOpen: Dispatch<SetStateAction<boolean>>;
  studentData: TableResponse<OccupancyStudentRecord>;
}

const buildOccupancyTableParams = createBuildTableParams({
  filterKeys: OCCUPANCY_FILTER_KEYS,
  normalizers: {},
}) as (
  appliedFilters: Record<string, unknown[]>,
  appliedSearchTerm: string,
  pagination: { current: number; pageSize: number },
  sortField: string,
  sortOrder: 'asc' | 'desc',
  withPaging?: boolean,
) => ServiceQueryParams;

const DEFAULT_OCCUPANCY_STATS: OccupancyStatsState = {
  totalDorms: 0,
  totalBeds: 0,
  occupiedBeds: 0,
  availableBeds: 0,
  occupancyRate: 0,
  monthlyMoves: 0,
};

function sortStrings(values: unknown[]): string[] {
  return [...new Set(values.filter(Boolean).map((value) => String(value)))]
    .sort((left, right) => left.localeCompare(right, 'zh-CN'));
}

function sortFloors(values: unknown[]): Array<string | number> {
  return [...new Set(
    values.filter(
      (value): value is string | number => value !== null && value !== undefined,
    ),
  )]
    .sort((left, right) => Number(left) - Number(right));
}

function OverviewTabPane({
  fetchError,
  loading,
  isMobile,
  studentData,
  resizableColumns,
  pagination,
  setPagination,
  isBatchMode,
  selectedIds,
  setSelectedIds,
  setSelectedStudentId,
  studentActions,
  currentStudent,
  adjustMode,
  adjustModalOpen,
  setAdjustModalOpen,
  refetchStudents,
  loadStats,
  importWizardOpen,
  setImportWizardOpen,
  uniqueBuildings,
  getDormBeds,
}: OverviewTabPaneProps) {
  const renderOccupancyCard = useCallback(
    (
      record: OccupancyStudentRecord,
      _index: number,
      options: OccupancyResponsiveSelectionContext,
    ) => (
      <OccupancyMobileCard
        record={record}
        selected={options.selected}
        onSelect={options.onSelect}
        isBatchMode={isBatchMode}
      />
    ),
    [isBatchMode],
  );

  return (
    <>
      {fetchError ? (
        <div className="error-state">
          <Alert
            message={fetchError}
            type="error"
            showIcon
            action={<Button size="small" onClick={refetchStudents}>重试</Button>}
          />
        </div>
      ) : (
        <div className="table-wrapper dorm-table-wrapper">
          <ResponsiveDataView<OccupancyStudentRecord>
            className="dorm-table"
            isMobile={isMobile}
            loading={loading}
            dataSource={studentData.items}
            rowKey="id"
            renderCard={renderOccupancyCard}
            columns={resizableColumns}
            resizable={true}
            pagination={{
              ...pagination,
              total: studentData.total,
              showSizeChanger: PAGINATION_SIZE_CHANGER_PROPS,
              showTotal: (total: number) => `共 ${total} 人`,
            }}
            onPaginationChange={(current: number, pageSize?: number) => {
              setPagination((prev) => ({
                ...prev,
                current,
                pageSize: pageSize || prev.pageSize,
              }));
            }}
            scroll={{ x: 1000 }}
            selectionType={!isMobile ? 'checkbox' : isBatchMode ? 'checkbox' : 'radio'}
            selectedKeys={selectedIds}
            onSelectChange={(keys: Key[]) => {
              const nextKeys = keys as EntityId[];
              setSelectedIds(nextKeys);
              if (isMobile && !isBatchMode) {
                setSelectedStudentId(nextKeys.length ? nextKeys[nextKeys.length - 1] : null);
                return;
              }
              setSelectedStudentId(nextKeys.length === 1 ? nextKeys[0] : null);
            }}
          />
        </div>
      )}

      <ResidencyAdjustModal
        open={adjustModalOpen}
        student={
          currentStudent
            ? {
                ...currentStudent,
                dormId: currentStudent.dormId ?? undefined,
              }
            : null
        }
        mode={adjustMode}
        onClose={() => setAdjustModalOpen(false)}
        onRefresh={() => {
          refetchStudents();
          void loadStats();
        }}
      />

      <LazyImportWizardModal
        open={importWizardOpen}
        onClose={() => setImportWizardOpen(false)}
        config={CHECKIN_IMPORT_CONFIG}
        onSuccess={() => {
          refetchStudents();
          void loadStats();
        }}
      />

      <BatchCheckInModal
        isMobile={isMobile}
        open={studentActions.batchCheckInModalOpen}
        onClose={() => studentActions.setBatchCheckInModalOpen(false)}
        onSubmit={() => {
          void studentActions.handleBatchCheckIn();
        }}
        loading={studentActions.batchLoading}
        studentsToBeAssigned={studentActions.studentsToBeAssigned}
        currentAssigneeIndex={studentActions.currentAssigneeIndex}
        setCurrentAssigneeIndex={studentActions.setCurrentAssigneeIndex}
        batchAssignments={studentActions.batchAssignments}
        targetDorms={studentActions.targetDorms}
        loadingDorms={studentActions.loadingDorms}
        modalFilters={studentActions.modalFilters}
        setModalFilters={studentActions.setModalFilters}
        modalFloors={studentActions.modalFloors}
        uniqueBuildings={uniqueBuildings}
        handleBedSelect={studentActions.handleBedSelect}
        actions={{ getDormBeds }}
      />
    </>
  );
}

function OccupancyFloatingActions({
  isMobile,
  activeTab,
  selectedStudentId,
  isBatchMode,
  selectedIds,
  handleToggleBatchMode,
  openImportWizard,
}: OccupancyFloatingActionsProps) {
  if (!isMobile || activeTab !== 'overview') {
    return null;
  }

  return createPortal(
    <>
      <FloatButton.BackTop
        style={{
          bottom: selectedStudentId || (isBatchMode && selectedIds.length > 0) ? 170 : 100,
          right: 20,
        }}
      />
      {selectedIds.length === 0 ? (
        <FloatButton.Group
          trigger="click"
          type="primary"
          style={{ right: 20, bottom: 100 }}
          icon={<CheckSquareOutlined />}
          closeIcon={<CheckSquareOutlined />}
        >
          <FloatButton
            icon={isBatchMode ? <UserOutlined /> : <CheckSquareOutlined />}
            onClick={handleToggleBatchMode}
            tooltip={isBatchMode ? '切换为单选模式' : '切换为多选模式'}
          />
          <FloatButton
            icon={<ImportOutlined />}
            tooltip="导入"
            onClick={openImportWizard}
            onMouseEnter={prefetchImportWizardModal}
            onFocus={prefetchImportWizardModal}
            onTouchStart={prefetchImportWizardModal}
          />
          <FloatButton
            icon={<ExportOutlined />}
            tooltip="导出"
            onClick={() => message.info('导出功能开发中')}
          />
        </FloatButton.Group>
      ) : null}
    </>,
    document.body,
  );
}

function OccupancyManagementContent({
  activeTab,
  adjustModalOpen,
  adjustMode,
  canEdit,
  currentStudent,
  draftFilters,
  draftSearchTerm,
  fetchError,
  filterDrawerOpen,
  handleHistorySearch,
  handleResetFilters,
  handleResetHistoryFilters,
  handleSearch,
  historyAppliedFilters,
  historyDraftFilters,
  historyStats,
  importWizardOpen,
  isBatchMode,
  isDirty,
  isHistoryDirty,
  isMobile,
  loading,
  loadStats,
  occupancyActions,
  occupancyActionsRef,
  pagination,
  refetchStudents,
  resizableColumns,
  selectedIds,
  setActiveTab,
  setAdjustModalOpen,
  setDraftFilters,
  setDraftSearchTerm,
  setFilterDrawerOpen,
  setHistoryAppliedFilters,
  setHistoryDraftFilters,
  setHistoryStats,
  setImportWizardOpen,
  setPagination,
  setSelectedIds,
  setSelectedStudentId,
  stats,
  studentData,
  uniqueBuildings,
  uniqueColleges,
  uniqueFloors,
  uniqueGrades,
}: OccupancyManagementContentProps) {
  const mobileFilterSchema = (
    activeTab === 'overview'
      ? createOverviewFilterSchema({
          draftFilters,
          setDraftFilters,
          uniqueColleges,
          uniqueBuildings,
          uniqueGrades,
          uniqueFloors,
        })
      : createHistoryFilterSchema({
          historyDraftFilters,
          setHistoryDraftFilters,
        })
  ) as OccupancyFilterConfig[];
  const activeTableTitle = activeTab === 'overview' ? '实时列表' : '异动记录';
  const activeStatsContent =
    activeTab === 'overview' ? (
      <OverviewStats stats={stats} />
    ) : (
      <HistoryStats
        historyStats={historyStats}
        studentDataTotal={studentData.total || 0}
      />
    );
  const activeStatsSegments =
    activeTab === 'overview'
      ? mapOverviewStatsToSegments(stats)
      : mapHistoryStatsToSegments(historyStats, studentData.total || 0);

  return (
    <div className="management-theme-page">
      <PageLayout
        statsLayout="custom"
        stats={
          <CollapsibleStatsBoard
            key={activeTab}
            expandedContent={activeStatsContent}
            segments={activeStatsSegments}
          />
        }
        filters={
          activeTab === 'overview' ? (
            <OverviewFiltersSection
              isMobile={isMobile}
              draftSearchTerm={draftSearchTerm}
              setDraftSearchTerm={setDraftSearchTerm}
              draftFilters={draftFilters}
              setDraftFilters={setDraftFilters}
              uniqueColleges={uniqueColleges}
              uniqueBuildings={uniqueBuildings}
              uniqueGrades={uniqueGrades}
              uniqueFloors={uniqueFloors}
              loading={loading}
              isDirty={isDirty}
              handleSearch={handleSearch}
              handleResetFilters={handleResetFilters}
              setFilterDrawerOpen={setFilterDrawerOpen}
              canEdit={canEdit}
              batchLoading={occupancyActions.batchLoading}
              validateBatchOperation={occupancyActions.validateBatchOperation}
              openBatchCheckInModal={occupancyActions.openBatchCheckInModal}
              handleBatchCheckout={() => {
                void occupancyActions.handleBatchCheckout();
              }}
              onOpenImport={() => setImportWizardOpen(true)}
              onExport={() => message.info('导出功能开发中')}
              onOpenSettings={() => message.info('字段设置功能开发中')}
            />
          ) : (
            <HistoryFiltersSection
              isMobile={isMobile}
              historyDraftFilters={historyDraftFilters}
              setHistoryDraftFilters={setHistoryDraftFilters}
              isHistoryDirty={isHistoryDirty}
              loading={loading}
              handleHistorySearch={handleHistorySearch}
              handleResetHistoryFilters={handleResetHistoryFilters}
              setFilterDrawerOpen={setFilterDrawerOpen}
            />
          )
        }
      >
        <div className="table-head dorm-table-head mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="dorm-table-head-accent" />
            <h3 className="dorm-table-head-title">{activeTableTitle}</h3>
          </div>
        </div>

        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'overview',
              label: '入住概览',
              children: (
                <OverviewTabPane
                  fetchError={fetchError}
                  loading={loading}
                  isMobile={isMobile}
                  studentData={studentData}
                  resizableColumns={resizableColumns}
                  pagination={pagination}
                  setPagination={setPagination}
                  isBatchMode={isBatchMode}
                  selectedIds={selectedIds}
                  setSelectedIds={setSelectedIds}
                  setSelectedStudentId={setSelectedStudentId}
                  studentActions={occupancyActions}
                  currentStudent={currentStudent}
                  adjustMode={adjustMode}
                  adjustModalOpen={adjustModalOpen}
                  setAdjustModalOpen={setAdjustModalOpen}
                  refetchStudents={refetchStudents}
                  loadStats={loadStats}
                  importWizardOpen={importWizardOpen}
                  setImportWizardOpen={setImportWizardOpen}
                  uniqueBuildings={uniqueBuildings}
                  getDormBeds={occupancyActionsRef.getDormBeds}
                />
              ),
            },
            {
              key: 'history',
              label: '异动记录',
              children: (
                <OccupancyHistory
                  externalFilters={historyAppliedFilters}
                  onFiltersChange={setHistoryAppliedFilters}
                  onStatsChange={setHistoryStats}
                  hideFilterBar={true}
                />
              ),
            },
          ]}
        />

        <MobileAdvancedFilter
          open={filterDrawerOpen}
          onClose={() => setFilterDrawerOpen(false)}
          title={activeTab === 'overview' ? '筛选学生入住状态' : '筛选异动记录'}
          onReset={activeTab === 'overview' ? handleResetFilters : handleResetHistoryFilters}
          filters={mobileFilterSchema}
        />
      </PageLayout>
    </div>
  );
}

function OccupancyManagementOverlays({
  actionSheetOpen,
  activeTab,
  canEdit,
  handleToggleBatchMode,
  isBatchMode,
  isMobile,
  occupancyActions,
  openAdjustModal,
  selectedIds,
  selectedStudentId,
  setActionSheetOpen,
  setImportWizardOpen,
  studentData,
}: OccupancyManagementOverlaysProps) {
  return (
    <>
      <OccupancyFloatingActions
        isMobile={isMobile}
        activeTab={activeTab}
        selectedStudentId={selectedStudentId}
        isBatchMode={isBatchMode}
        selectedIds={selectedIds}
        handleToggleBatchMode={handleToggleBatchMode}
        openImportWizard={() => setImportWizardOpen(true)}
      />

      <OccupancyActionSheet
        open={actionSheetOpen}
        onClose={() => setActionSheetOpen(false)}
        isBatchMode={isBatchMode}
        selectedIds={selectedIds}
        selectedStudentId={selectedStudentId}
        studentData={studentData}
        selectedStudentsData={occupancyActions.selectedStudentsData}
        canEdit={canEdit}
        openAdjustModal={openAdjustModal}
        openBatchCheckInModal={occupancyActions.openBatchCheckInModal}
        handleBatchCheckout={() => {
          void occupancyActions.handleBatchCheckout();
        }}
        handleCheckout={(studentId: EntityId) => {
          void occupancyActions.handleCheckout(studentId);
        }}
      />
    </>
  );
}

function canEditOccupancy(hasPermission: (permission: string) => boolean): boolean {
  try {
    return hasPermission('DORM_EDIT') || hasPermission('DORM_CHECKIN_MANAGE');
  } catch {
    return false;
  }
}

// Page-level orchestrator keeps overview/history tabs and action flows aligned.
export default function OccupancyManagementPage() {
  const { actions, hasPermission, data: globalData, setSelection } = useAppContext();
  const occupancyActionsRef = actions as OccupancyPageActions;
  const appData = globalData as AppDataStore;
  const isMobile = useMobile();
  const [selectedStudentId, setSelectedStudentId] = useState<EntityId | null>(null);

  const bulkSelection = useBulkSelection();
  const { clearSelection } = bulkSelection;
  const selectedIds = bulkSelection.selectedIds as EntityId[];
  const setSelectedIds = bulkSelection.setSelectedIds as Dispatch<
    SetStateAction<EntityId[]>
  >;

  const clearOverviewSelection = useCallback((): void => {
    clearSelection();
    setSelectedStudentId(null);
  }, [clearSelection]);

  const {
    draftFilters,
    appliedFilters,
    draftSearchTerm,
    appliedSearchTerm,
    pagination,
    sortField,
    sortOrder,
    isDirty,
    appliedFiltersKey,
    setDraftFilters,
    setDraftSearchTerm,
    setPagination,
    applyFilters: handleSearch,
    resetAll: handleResetFilters,
  } = toOccupancyTableStateResult(
    useTableState({
      filterKeys: OCCUPANCY_FILTER_KEYS,
      defaultSortField: 'id',
      defaultSortOrder: 'asc',
      defaultPageSize: 10,
      syncUrl: true,
      normalizers: {},
      onApply: clearOverviewSelection,
      onReset: clearOverviewSelection,
    }),
  );

  const [reloadFlag, setReloadFlag] = useState(0);
  const [stats, setStats] = useState<OccupancyStatsState>(DEFAULT_OCCUPANCY_STATS);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [historyDraftFilters, setHistoryDraftFilters] = useState<HistoryFiltersState>(
    createDefaultHistoryFilters() as HistoryFiltersState,
  );
  const [historyAppliedFilters, setHistoryAppliedFilters] = useState<HistoryFiltersState>(
    createDefaultHistoryFilters() as HistoryFiltersState,
  );
  const [historyStats, setHistoryStats] = useState<HistoryStatsState>({
    total: 0,
    todayCount: 0,
    latestTime: null,
  });
  const [currentStudent, setCurrentStudent] = useState<OccupancyStudentRecord | null>(null);
  const [adjustMode, setAdjustMode] = useState<'assign' | 'move' | 'swap'>('assign');
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [actionSheetOpen, setActionSheetOpen] = useState(false);
  const [importWizardOpen, setImportWizardOpen] = useState(false);

  const canEdit = useMemo(() => canEditOccupancy(hasPermission), [hasPermission]);

  const loadStats = useCallback(async (): Promise<void> => {
    if (!occupancyActionsRef.getOccupancyStats) {
      return;
    }

    try {
      const result = await occupancyActionsRef.getOccupancyStats();
      setStats(result);
    } catch (error) {
      console.error('加载入住统计失败', error);
    }
  }, [occupancyActionsRef]);

  const {
    data: studentData,
    loading,
    error: fetchError,
    refetch,
  } = useTableFetch<OccupancyStudentRecord>({
    fetchFn: async (
      params: Record<string, unknown>,
      options?: { signal?: AbortSignal },
    ): Promise<TableResponse<OccupancyStudentRecord>> => {
      if (!occupancyActionsRef.fetchStudentTable) {
        return { items: [], total: 0 };
      }

      return occupancyActionsRef.fetchStudentTable(
        params as ServiceQueryParams,
        options,
      );
    },
    buildParams: () =>
      buildOccupancyTableParams(
        appliedFilters,
        appliedSearchTerm,
        pagination,
        sortField,
        sortOrder,
        true,
      ),
    enabled: Boolean(occupancyActionsRef.fetchStudentTable),
    onSuccess: (result) => {
      setPagination((prev) => ({ ...prev, total: result.total || 0 }));
    },
    onError: (error) => {
      console.error('获取学生列表失败:', error);
    },
    deps: [
      pagination.current,
      pagination.pageSize,
      sortField,
      sortOrder,
      appliedFiltersKey,
      appliedSearchTerm,
      reloadFlag,
    ],
    keepPreviousData: true,
  });

  const occupancyActions = useOccupancyActions({
    studentData,
    selectedIds,
    clearSelection: clearOverviewSelection,
    setReloadFlag,
    loadStats,
    actions: occupancyActionsRef,
  });

  useEffect(() => {
    void occupancyActionsRef.loadStudents?.();
    void occupancyActionsRef.loadDorms?.();
    void occupancyActionsRef.loadDormBeds?.();
  }, [occupancyActionsRef]);

  useEffect(() => {
    void loadStats();
  }, [loadStats, reloadFlag]);

  useEffect(() => {
    if (!isMobile || activeTab !== 'overview') {
      return;
    }

    const count = isBatchMode ? selectedIds.length : selectedStudentId ? 1 : 0;
    setSelection({
      count,
      onClear: clearOverviewSelection,
      onAction: () => setActionSheetOpen(true),
      actionLabel: '操作',
    } as AppSelectionState);
  }, [
    activeTab,
    clearOverviewSelection,
    isBatchMode,
    isMobile,
    selectedIds.length,
    selectedStudentId,
    setSelection,
  ]);

  const isHistoryDirty = useMemo(
    () => !areHistoryFiltersEqual(historyDraftFilters, historyAppliedFilters),
    [historyAppliedFilters, historyDraftFilters],
  );

  const uniqueBuildings = useMemo(
    () => sortStrings((appData.dorms || []).map((item) => (item as ServiceRecord).building)),
    [appData.dorms],
  );

  const uniqueFloors = useMemo(() => {
    let source = (appData.dorms || []) as ServiceRecord[];
    if (draftFilters.building.length) {
      source = source.filter((dorm) =>
        draftFilters.building.includes(String(dorm.building || '')),
      );
    }
    return sortFloors(source.map((item) => item.floor));
  }, [appData.dorms, draftFilters.building]);

  const uniqueColleges = useMemo(
    () => sortStrings((appData.students || []).map((item) => (item as ServiceRecord).college)),
    [appData.students],
  );

  const uniqueGrades = useMemo(
    () => sortStrings((appData.students || []).map((item) => (item as ServiceRecord).grade)),
    [appData.students],
  );

  const baseColumns = useMemo<OccupancyColumn[]>(() => createBaseColumns(), []);
  const allColumns = useMemo(
    () => [
      ...baseColumns,
      createActionColumn({
        canEdit,
        openAdjustModal: (student, mode = 'assign') => {
          setCurrentStudent(student);
          setAdjustMode(mode);
          setAdjustModalOpen(true);
        },
        handleCheckout: occupancyActions.handleCheckout,
      }),
    ],
    [baseColumns, canEdit, occupancyActions.handleCheckout],
  );
  const { columns: resizableColumns } = useResizableColumns(
    allColumns as ResizableOccupancyColumn[],
    {
      minWidth: 60,
      maxWidth: 450,
    },
  );

  const handleHistorySearch = useCallback((): void => {
    if (!isHistoryDirty) {
      return;
    }

    setHistoryAppliedFilters(historyDraftFilters);
  }, [historyDraftFilters, isHistoryDirty]);

  const handleResetHistoryFilters = useCallback((): void => {
    const nextFilters = createDefaultHistoryFilters() as HistoryFiltersState;
    setHistoryDraftFilters(nextFilters);
    setHistoryAppliedFilters(nextFilters);
  }, []);

  const openAdjustModal = useCallback(
    (student: OccupancyStudentRecord, mode: 'assign' | 'move' | 'swap' = 'assign') => {
      setCurrentStudent(student);
      setAdjustMode(mode);
      setAdjustModalOpen(true);
    },
    [],
  );

  const handleToggleBatchMode = useCallback((): void => {
    setIsBatchMode((prev) => !prev);
    clearOverviewSelection();
  }, [clearOverviewSelection]);

  return (
    <>
      <OccupancyManagementContent
        activeTab={activeTab}
        adjustModalOpen={adjustModalOpen}
        adjustMode={adjustMode}
        canEdit={canEdit}
        currentStudent={currentStudent}
        draftFilters={draftFilters}
        draftSearchTerm={draftSearchTerm}
        fetchError={fetchError}
        filterDrawerOpen={filterDrawerOpen}
        handleHistorySearch={handleHistorySearch}
        handleResetFilters={handleResetFilters}
        handleResetHistoryFilters={handleResetHistoryFilters}
        handleSearch={handleSearch}
        historyAppliedFilters={historyAppliedFilters}
        historyDraftFilters={historyDraftFilters}
        historyStats={historyStats}
        importWizardOpen={importWizardOpen}
        isBatchMode={isBatchMode}
        isDirty={isDirty}
        isHistoryDirty={isHistoryDirty}
        isMobile={isMobile}
        loading={loading}
        loadStats={loadStats}
        occupancyActions={occupancyActions}
        occupancyActionsRef={occupancyActionsRef}
        pagination={pagination}
        refetchStudents={refetch}
        resizableColumns={resizableColumns}
        selectedIds={selectedIds}
        setActiveTab={setActiveTab}
        setAdjustModalOpen={setAdjustModalOpen}
        setDraftFilters={setDraftFilters}
        setDraftSearchTerm={setDraftSearchTerm}
        setFilterDrawerOpen={setFilterDrawerOpen}
        setHistoryAppliedFilters={setHistoryAppliedFilters}
        setHistoryDraftFilters={setHistoryDraftFilters}
        setHistoryStats={setHistoryStats}
        setImportWizardOpen={setImportWizardOpen}
        setPagination={setPagination}
        setSelectedIds={setSelectedIds}
        setSelectedStudentId={setSelectedStudentId}
        stats={stats}
        studentData={studentData}
        uniqueBuildings={uniqueBuildings}
        uniqueColleges={uniqueColleges}
        uniqueFloors={uniqueFloors}
        uniqueGrades={uniqueGrades}
      />

      <OccupancyManagementOverlays
        actionSheetOpen={actionSheetOpen}
        activeTab={activeTab}
        canEdit={canEdit}
        handleToggleBatchMode={handleToggleBatchMode}
        isBatchMode={isBatchMode}
        isMobile={isMobile}
        occupancyActions={occupancyActions}
        openAdjustModal={openAdjustModal}
        selectedIds={selectedIds}
        selectedStudentId={selectedStudentId}
        setActionSheetOpen={setActionSheetOpen}
        setImportWizardOpen={setImportWizardOpen}
        studentData={studentData}
      />
    </>
  );
}
