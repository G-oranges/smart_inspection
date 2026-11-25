import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FloatButton } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';

import PageLayout from '../components/PageLayout';
import TableFieldSettings from '../components/TableFieldSettings';
import PermissionDeniedState from '../components/common/PermissionDeniedState';
import { appealManagementPermissionPreset } from '../components/common/permissionDeniedPresets';
import CollapsibleStatsBoard from '../components/stats/CollapsibleStatsBoard';
import { useAppContext } from '../context/AppContext';
import {
  useAppealDetailQuery,
  useAppealsListQuery,
  useAppealStatsQuery,
} from '../hooks/useAppealsQuery';
import { useBuildings } from '../hooks/useInfraQuery';
import { useMobile } from '../hooks/useMobile';
import { useResizableColumns } from '../hooks/useResizableColumns';
import { useTableColumns } from '../hooks/useTableColumns';
import {
  APPEAL_DEFAULT_COLUMNS,
  APPEAL_TABLE_KEY,
  AppealActionSheet,
  AppealBatchModal,
  AppealCreateModal,
  AppealDetailModal,
  AppealHandleModal,
  AppealMobileAdvancedFilter,
  AppealMobileSearchBar,
  AppealStats,
  AppealStudentView,
  AppealTable,
  AppealToolbar,
  INITIAL_APPEAL_FILTERS,
  INITIAL_APPEAL_STATS,
  buildAppealQueryParams,
  createAppealActionColumn,
  createAppealColumns,
  getActiveAppealFilterCount,
  isValidAppealStatus,
  mapAppealStatsToSegments,
  useAppealActions,
} from './appeal';
import type { AppealCandidateInspection } from './appeal/modals/AppealCreateModal';
import type {
  AppealBuildingOption,
  AppealColumnConfig,
  AppealFiltersState,
  AppealTaskOption,
} from './appeal/types';
import type { AppSettings } from '../types/app';
import type { AppealRecord, AppealStatus, ServiceRecord } from '../types/service';
import type { AntTablePaginationLike, AntTableSorterLike } from '../types/table';

interface AppealLegacyActions {
  loadTasks?: (force?: boolean) => Promise<unknown> | void;
  loadAppeals?: (force?: boolean) => Promise<unknown> | void;
  loadMyAppeals?: (force?: boolean) => Promise<unknown> | void;
  loadInspections?: (force?: boolean) => Promise<unknown> | void;
  loadMyInspections?: (force?: boolean) => Promise<unknown> | void;
  fetchTableConfig?: (
    tableKey: string,
  ) => Promise<{ config?: AppealColumnConfig[] } | null | undefined>;
  saveTableConfig?: (
    tableKey: string,
    columns: AppealColumnConfig[],
  ) => Promise<unknown>;
}

function parseInitialFilters(searchParams: URLSearchParams): AppealFiltersState {
  const rawStatus = searchParams.get('status');
  return {
    status: isValidAppealStatus(rawStatus) ? rawStatus : '',
    taskId: searchParams.get('taskId') || '',
    buildingId: searchParams.get('buildingId') || '',
    dateRange: null,
  };
}

function areAppealFiltersEqual(
  left: AppealFiltersState,
  right: AppealFiltersState,
): boolean {
  const leftStart = left.dateRange?.[0]?.format('YYYY-MM-DD') || '';
  const leftEnd = left.dateRange?.[1]?.format('YYYY-MM-DD') || '';
  const rightStart = right.dateRange?.[0]?.format('YYYY-MM-DD') || '';
  const rightEnd = right.dateRange?.[1]?.format('YYYY-MM-DD') || '';

  return (
    left.status === right.status &&
    left.taskId === right.taskId &&
    left.buildingId === right.buildingId &&
    leftStart === rightStart &&
    leftEnd === rightEnd
  );
}

function useAppealFilterPaginationState(
  searchParams: URLSearchParams,
  setSearchParams: ReturnType<typeof useSearchParams>[1],
  clearSelection: () => void,
) {
  const [draftKeyword, setDraftKeyword] = useState(
    () => searchParams.get('keyword') || searchParams.get('search') || '',
  );
  const [appliedKeyword, setAppliedKeyword] = useState(
    () => searchParams.get('keyword') || searchParams.get('search') || '',
  );
  const [draftFilters, setDraftFilters] = useState<AppealFiltersState>(() =>
    parseInitialFilters(searchParams),
  );
  const [appliedFilters, setAppliedFilters] = useState<AppealFiltersState>(() =>
    parseInitialFilters(searchParams),
  );
  const [page, setPage] = useState<number>(() => {
    const raw = Number(searchParams.get('page'));
    return Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : 1;
  });
  const [pageSize, setPageSize] = useState<number>(10);
  const [sortField, setSortField] = useState<string>(
    () => searchParams.get('sortField') || 'createdAt',
  );
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(() =>
    searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc',
  );
  const [detailAppealId, setDetailAppealId] = useState<string | null>(
    () => searchParams.get('appealId') || null,
  );
  const [detailAppealSnapshot, setDetailAppealSnapshot] =
    useState<AppealRecord | null>(null);

  const urlAppealId = searchParams.get('appealId');
  useEffect(() => {
    if (urlAppealId) {
      setDetailAppealId(urlAppealId);
    }
  }, [urlAppealId]);

  const syncUrlParams = useCallback(
    (next: {
      filters: AppealFiltersState;
      keyword: string;
      nextPage: number;
      nextSortField: string;
      nextSortOrder: 'asc' | 'desc';
      appealId?: string | null;
    }) => {
      const params = new URLSearchParams();
      if (next.filters.status) params.set('status', next.filters.status);
      if (next.filters.taskId) params.set('taskId', next.filters.taskId);
      if (next.filters.buildingId) params.set('buildingId', next.filters.buildingId);
      if (next.keyword.trim()) params.set('keyword', next.keyword.trim());
      if (next.nextPage > 1) params.set('page', String(next.nextPage));
      if (next.nextSortField !== 'createdAt') {
        params.set('sortField', next.nextSortField);
      }
      if (next.nextSortOrder !== 'desc') {
        params.set('sortOrder', next.nextSortOrder);
      }
      if (next.appealId) {
        params.set('appealId', next.appealId);
      }
      setSearchParams(params, { replace: true });
    },
    [setSearchParams],
  );

  const handleOpenDetail = useCallback(
    (record: AppealRecord) => {
      setDetailAppealSnapshot(record);
      setDetailAppealId(record.id);
      syncUrlParams({
        filters: appliedFilters,
        keyword: appliedKeyword,
        nextPage: page,
        nextSortField: sortField,
        nextSortOrder: sortOrder,
        appealId: record.id,
      });
    },
    [appliedFilters, appliedKeyword, page, sortField, sortOrder, syncUrlParams],
  );

  const handleCloseDetail = useCallback(() => {
    setDetailAppealId(null);
    setDetailAppealSnapshot(null);
    syncUrlParams({
      filters: appliedFilters,
      keyword: appliedKeyword,
      nextPage: page,
      nextSortField: sortField,
      nextSortOrder: sortOrder,
      appealId: null,
    });
  }, [appliedFilters, appliedKeyword, page, sortField, sortOrder, syncUrlParams]);

  const isDirty = useMemo(
    () =>
      draftKeyword.trim() !== appliedKeyword.trim() ||
      !areAppealFiltersEqual(draftFilters, appliedFilters),
    [appliedFilters, appliedKeyword, draftFilters, draftKeyword],
  );

  const handleSearch = useCallback(() => {
    setAppliedKeyword(draftKeyword);
    setAppliedFilters(draftFilters);
    setPage(1);
    clearSelection();
    syncUrlParams({
      filters: draftFilters,
      keyword: draftKeyword,
      nextPage: 1,
      nextSortField: sortField,
      nextSortOrder: sortOrder,
      appealId: detailAppealId,
    });
  }, [
    clearSelection,
    detailAppealId,
    draftFilters,
    draftKeyword,
    sortField,
    sortOrder,
    syncUrlParams,
  ]);

  const handleQuickStatusChange = useCallback(
    (status: AppealStatus | '') => {
      const nextFilters: AppealFiltersState = { ...draftFilters, status };
      setDraftFilters(nextFilters);
      setAppliedFilters(nextFilters);
      setPage(1);
      clearSelection();
      syncUrlParams({
        filters: nextFilters,
        keyword: appliedKeyword,
        nextPage: 1,
        nextSortField: sortField,
        nextSortOrder: sortOrder,
        appealId: null,
      });
    },
    [appliedKeyword, clearSelection, draftFilters, sortField, sortOrder, syncUrlParams],
  );

  const handleResetFilters = useCallback(() => {
    setDraftKeyword('');
    setAppliedKeyword('');
    setDraftFilters(INITIAL_APPEAL_FILTERS);
    setAppliedFilters(INITIAL_APPEAL_FILTERS);
    setPage(1);
    setSortField('createdAt');
    setSortOrder('desc');
    clearSelection();
    syncUrlParams({
      filters: INITIAL_APPEAL_FILTERS,
      keyword: '',
      nextPage: 1,
      nextSortField: 'createdAt',
      nextSortOrder: 'desc',
      appealId: null,
    });
  }, [clearSelection, syncUrlParams]);

  const handlePageChange = useCallback(
    (nextPage: number, nextSize?: number) => {
      setPage(nextPage);
      if (nextSize && nextSize !== pageSize) {
        setPageSize(nextSize);
      }
      syncUrlParams({
        filters: appliedFilters,
        keyword: appliedKeyword,
        nextPage,
        nextSortField: sortField,
        nextSortOrder: sortOrder,
        appealId: detailAppealId,
      });
    },
    [
      appliedFilters,
      appliedKeyword,
      detailAppealId,
      pageSize,
      sortField,
      sortOrder,
      syncUrlParams,
    ],
  );

  const handleTableChange = useCallback(
    (
      nextPagination: AntTablePaginationLike,
      _filters: unknown,
      sorter: AntTableSorterLike | AntTableSorterLike[],
    ) => {
      const nextPage = nextPagination.current ?? page;
      const nextSize = nextPagination.pageSize ?? pageSize;
      const activeSorter = Array.isArray(sorter) ? sorter[0] : sorter;
      const nextField =
        activeSorter?.field && activeSorter?.order
          ? String(activeSorter.field)
          : 'createdAt';
      const nextOrder: 'asc' | 'desc' =
        activeSorter?.order === 'ascend' ? 'asc' : 'desc';

      setPage(nextPage);
      setPageSize(nextSize);
      setSortField(nextField);
      setSortOrder(nextOrder);
      syncUrlParams({
        filters: appliedFilters,
        keyword: appliedKeyword,
        nextPage,
        nextSortField: nextField,
        nextSortOrder: nextOrder,
        appealId: detailAppealId,
      });
    },
    [appliedFilters, appliedKeyword, detailAppealId, page, pageSize, syncUrlParams],
  );

  return {
    draftKeyword,
    setDraftKeyword,
    appliedKeyword,
    draftFilters,
    setDraftFilters,
    appliedFilters,
    page,
    pageSize,
    sortField,
    sortOrder,
    isDirty,
    detailAppealId,
    detailAppealSnapshot,
    handleOpenDetail,
    handleCloseDetail,
    handleSearch,
    handleQuickStatusChange,
    handleResetFilters,
    handlePageChange,
    handleTableChange,
  };
}

interface AppealPageOverlaysProps {
  isMobile: boolean;
  isStudent: boolean;
  canHandle: boolean;
  selectedIds: string[];
  settingsOpen: boolean;
  setSettingsOpen: Dispatch<SetStateAction<boolean>>;
  columnConfigs: AppealColumnConfig[];
  columnSaving: boolean;
  saveAppealColumns: (nextColumns: AppealColumnConfig[]) => Promise<void>;
  resetAppealColumns: () => Promise<void>;
  mobileFilterOpen: boolean;
  setMobileFilterOpen: Dispatch<SetStateAction<boolean>>;
  handleResetFilters: () => void;
  handleSearch: () => void;
  draftFilters: AppealFiltersState;
  setDraftFilters: Dispatch<SetStateAction<AppealFiltersState>>;
  tasks: AppealTaskOption[];
  buildings: AppealBuildingOption[];
  actionSheetOpen: boolean;
  setActionSheetOpen: Dispatch<SetStateAction<boolean>>;
  items: AppealRecord[];
  handleOpenDetail: (record: AppealRecord) => void;
  detailAppealId: string | null;
  detailLoading: boolean;
  resolvedDetailAppeal: AppealRecord | null;
  handleCloseDetail: () => void;
  appealActions: ReturnType<typeof useAppealActions>;
  settings: AppSettings | null;
  studentInspections: AppealCandidateInspection[];
  studentExistingAppeals: AppealRecord[];
}

function AppealPageOverlays({
  isMobile,
  isStudent,
  canHandle,
  selectedIds,
  settingsOpen,
  setSettingsOpen,
  columnConfigs,
  columnSaving,
  saveAppealColumns,
  resetAppealColumns,
  mobileFilterOpen,
  setMobileFilterOpen,
  handleResetFilters,
  handleSearch,
  draftFilters,
  setDraftFilters,
  tasks,
  buildings,
  actionSheetOpen,
  setActionSheetOpen,
  items,
  handleOpenDetail,
  detailAppealId,
  detailLoading,
  resolvedDetailAppeal,
  handleCloseDetail,
  appealActions,
  settings,
  studentInspections,
  studentExistingAppeals,
}: AppealPageOverlaysProps) {
  return (
    <>
      {isMobile
        ? createPortal(
            <FloatButton.BackTop
              style={{
                right: 20,
                bottom: selectedIds.length > 0 ? 160 : 96,
              }}
            />,
            document.body,
          )
        : null}

      <TableFieldSettings
        open={settingsOpen}
        columns={columnConfigs}
        onClose={() => setSettingsOpen(false)}
        onSave={async (nextCols: unknown) => {
          await saveAppealColumns(nextCols as AppealColumnConfig[]);
          setSettingsOpen(false);
        }}
        onReset={() => {
          void resetAppealColumns();
        }}
        saving={columnSaving}
        title="申诉列表字段设置"
      />

      <AppealMobileAdvancedFilter
        open={mobileFilterOpen}
        onClose={() => setMobileFilterOpen(false)}
        onReset={handleResetFilters}
        onConfirm={handleSearch}
        draftFilters={draftFilters}
        setDraftFilters={setDraftFilters}
        tasks={tasks}
        buildings={buildings}
      />

      <AppealActionSheet
        open={actionSheetOpen}
        onClose={() => setActionSheetOpen(false)}
        selectedIds={selectedIds}
        items={items}
        canHandle={canHandle}
        isStudent={isStudent}
        onOpenDetail={handleOpenDetail}
        onOpenHandle={appealActions.openHandleModal}
        onBatchApprove={() => appealActions.openBatchModal('approved')}
        onBatchReject={() => appealActions.openBatchModal('rejected')}
        onWithdraw={(record) => {
          void appealActions.handleWithdrawAppeal(record);
        }}
      />

      <AppealDetailModal
        open={Boolean(detailAppealId)}
        loading={detailLoading}
        appeal={resolvedDetailAppeal}
        isMobile={isMobile}
        canHandle={canHandle}
        isStudent={isStudent}
        settings={settings}
        onClose={handleCloseDetail}
        onOpenHandle={appealActions.openHandleModal}
        onWithdraw={(record) => {
          void appealActions.handleWithdrawAppeal(record);
        }}
      />

      <AppealHandleModal
        open={Boolean(appealActions.handlingAppeal)}
        appeal={appealActions.handlingAppeal}
        isMobile={isMobile}
        submitting={appealActions.handleSubmitting}
        resetSignal={appealActions.deductionResetSignal}
        settings={settings}
        form={appealActions.handleForm}
        setForm={appealActions.setHandleForm}
        onClose={appealActions.closeHandleModal}
        onSubmit={appealActions.submitHandleAppeal}
      />

      <AppealBatchModal
        state={appealActions.batchModal}
        setState={appealActions.setBatchModal}
        selectedCount={selectedIds.length}
        submitting={appealActions.batchSubmitting}
        onClose={appealActions.closeBatchModal}
        onConfirm={() => appealActions.submitBatchHandle(selectedIds)}
      />

      <AppealCreateModal
        open={appealActions.createOpen}
        isMobile={isMobile}
        submitting={appealActions.createSubmitting}
        inspections={studentInspections}
        existingAppeals={studentExistingAppeals}
        settings={settings}
        form={appealActions.createForm}
        setForm={appealActions.setCreateForm}
        onClose={appealActions.closeCreateModal}
        onSubmit={appealActions.submitCreateAppeal}
      />
    </>
  );
}

interface AppealManagerSectionProps {
  isMobile: boolean;
  canHandle: boolean;
  stats: typeof INITIAL_APPEAL_STATS;
  tableState: ReturnType<typeof useAppealFilterPaginationState>;
  isFetching: boolean;
  isLoading: boolean;
  errorMessage: string | null;
  items: AppealRecord[];
  total: number;
  lastUpdatedText: string;
  columns: ColumnsType<AppealRecord>;
  tasks: AppealTaskOption[];
  buildings: AppealBuildingOption[];
  selectedIds: string[];
  setSelectedIds: Dispatch<SetStateAction<string[]>>;
  batchSubmitting: boolean;
  onRefresh: () => void;
  onRetry: () => void;
  onOpenMobileFilter: () => void;
  onOpenSettings: () => void;
  onBatchApprove: () => void;
  onBatchReject: () => void;
  onClearSelection: () => void;
}

function AppealManagerSection({
  isMobile,
  canHandle,
  stats,
  tableState,
  isFetching,
  isLoading,
  errorMessage,
  items,
  total,
  lastUpdatedText,
  columns,
  tasks,
  buildings,
  selectedIds,
  setSelectedIds,
  batchSubmitting,
  onRefresh,
  onRetry,
  onOpenMobileFilter,
  onOpenSettings,
  onBatchApprove,
  onBatchReject,
  onClearSelection,
}: AppealManagerSectionProps) {
  return (
    <PageLayout
      statsLayout="custom"
      stats={
        <CollapsibleStatsBoard
          expandedContent={<AppealStats stats={stats} />}
          segments={mapAppealStatsToSegments(stats)}
        />
      }
      filters={
        isMobile ? (
          <AppealMobileSearchBar
            draftKeyword={tableState.draftKeyword}
            setDraftKeyword={tableState.setDraftKeyword}
            currentStatus={tableState.appliedFilters.status}
            onStatusChange={tableState.handleQuickStatusChange}
            isDirty={tableState.isDirty}
            loading={isFetching}
            activeFilterCount={getActiveAppealFilterCount(
              tableState.draftFilters,
            )}
            onSearch={tableState.handleSearch}
            onOpenFilter={onOpenMobileFilter}
            onReset={tableState.handleResetFilters}
          />
        ) : (
          <AppealToolbar
            draftKeyword={tableState.draftKeyword}
            setDraftKeyword={tableState.setDraftKeyword}
            draftFilters={tableState.draftFilters}
            setDraftFilters={tableState.setDraftFilters}
            isDirty={tableState.isDirty}
            loading={isFetching}
            canHandle={canHandle}
            tasks={tasks}
            buildings={buildings}
            selectedCount={selectedIds.length}
            batchLoading={batchSubmitting}
            onSearch={tableState.handleSearch}
            onReset={tableState.handleResetFilters}
            onRefresh={onRefresh}
            onOpenSettings={onOpenSettings}
            onBatchApprove={onBatchApprove}
            onBatchReject={onBatchReject}
            onClearSelection={onClearSelection}
          />
        )
      }
    >
      <AppealTable
        items={items}
        total={total}
        loading={isLoading}
        errorMessage={errorMessage}
        isMobile={isMobile}
        canHandle={canHandle}
        hasActiveFilter={
          Boolean(tableState.appliedKeyword.trim()) ||
          getActiveAppealFilterCount(tableState.appliedFilters) > 0
        }
        lastUpdatedText={lastUpdatedText}
        columns={columns}
        selectedIds={selectedIds}
        setSelectedIds={setSelectedIds}
        page={tableState.page}
        pageSize={tableState.pageSize}
        onPageChange={tableState.handlePageChange}
        onTableChange={tableState.handleTableChange}
        onRetry={onRetry}
        onOpenDetail={tableState.handleOpenDetail}
      />
    </PageLayout>
  );
}

function useAppealManagementModel() {
  const {
    data,
    actions,
    user,
    activeRole,
    settings,
    hasPermission,
    permissionsReady,
    setSelection,
  } = useAppContext();
  const legacyActions = actions as AppealLegacyActions;
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isMobile = useMobile();

  const isStudent = activeRole?.code === 'STUDENT';
  const canView = isStudent || hasPermission('APPEAL_VIEW');
  const canHandle = !isStudent && hasPermission('APPEAL_HANDLE');
  const roleKey = activeRole?.id || activeRole?.code || user?.role || 'default';

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [actionSheetOpen, setActionSheetOpen] = useState(false);

  const clearSelection = useCallback(() => {
    setSelectedIds([]);
  }, []);

  const tableState = useAppealFilterPaginationState(
    searchParams,
    setSearchParams,
    clearSelection,
  );

  useEffect(() => {
    if (!permissionsReady || !canView) {
      return;
    }
    void legacyActions.loadTasks?.();
    if (isStudent) {
      void legacyActions.loadMyInspections?.();
      void legacyActions.loadMyAppeals?.();
    }
  }, [canView, isStudent, legacyActions, permissionsReady]);

  const queryParams = useMemo(
    () =>
      buildAppealQueryParams({
        filters: tableState.appliedFilters,
        keyword: tableState.appliedKeyword,
        page: tableState.page,
        pageSize: tableState.pageSize,
        sortField: tableState.sortField,
        sortOrder: tableState.sortOrder,
      }),
    [
      tableState.appliedFilters,
      tableState.appliedKeyword,
      tableState.page,
      tableState.pageSize,
      tableState.sortField,
      tableState.sortOrder,
    ],
  );

  const listQuery = useAppealsListQuery(queryParams, {
    isStudent,
    enabled: permissionsReady && canView,
    roleKey,
  });

  const statsQuery = useAppealStatsQuery(queryParams, {
    enabled: permissionsReady && canView && !isStudent,
    roleKey,
  });

  const detailQuery = useAppealDetailQuery(tableState.detailAppealId, {
    enabled:
      permissionsReady &&
      canView &&
      !isStudent &&
      Boolean(tableState.detailAppealId),
  });

  const { data: buildingsResponse } = useBuildings();

  const buildings = useMemo<AppealBuildingOption[]>(() => {
    const rawList = Array.isArray(buildingsResponse?.buildings)
      ? buildingsResponse.buildings
      : Array.isArray(buildingsResponse)
        ? buildingsResponse
        : [];
    return rawList
      .map((item) => {
        const rec = item as { id?: number | string; name?: string };
        return rec.id !== undefined && rec.name
          ? { id: rec.id, name: rec.name }
          : null;
      })
      .filter((item): item is AppealBuildingOption => item !== null);
  }, [buildingsResponse]);

  const tasks = useMemo<AppealTaskOption[]>(() => {
    if (!Array.isArray(data.tasks)) return [];
    return (data.tasks as Array<{ id?: string | number; title?: string }>)
      .filter((item) => item.id !== undefined && Boolean(item.title))
      .map((item) => ({ id: String(item.id), title: String(item.title) }));
  }, [data.tasks]);

  const syncLegacyCollections = useCallback(async () => {
    if (isStudent) {
      await Promise.all([
        legacyActions.loadMyAppeals?.(true),
        legacyActions.loadMyInspections?.(true),
      ]);
      return;
    }
    await Promise.all([
      hasPermission('APPEAL_VIEW') ? legacyActions.loadAppeals?.(true) : undefined,
      hasPermission('RESULT_VIEW')
        ? legacyActions.loadInspections?.(true)
        : undefined,
    ]);
  }, [hasPermission, isStudent, legacyActions]);

  const appealActions = useAppealActions({
    onSyncLegacyCollections: syncLegacyCollections,
    onClearSelection: clearSelection,
  });

  const urlCreateInspectionId = searchParams.get('createForInspection');
  useEffect(() => {
    if (isStudent && urlCreateInspectionId) {
      appealActions.openCreateModal(urlCreateInspectionId);
      const next = new URLSearchParams(searchParams);
      next.delete('createForInspection');
      setSearchParams(next, { replace: true });
    }
  }, [
    appealActions,
    isStudent,
    searchParams,
    setSearchParams,
    urlCreateInspectionId,
  ]);

  useEffect(() => {
    if (!isMobile || isStudent) {
      return;
    }
    setSelection({
      count: selectedIds.length,
      onClear: clearSelection,
      onAction: () => setActionSheetOpen(true),
      actionLabel: '操作',
    });
  }, [clearSelection, isMobile, isStudent, selectedIds.length, setSelection]);

  const {
    columns: columnConfigs,
    visibleColumns: orderedVisibleColumnConfigs,
    saving: columnSaving,
    save: saveAppealColumns,
    resetToDefault: resetAppealColumns,
  } = useTableColumns<AppealColumnConfig>({
    tableKey: APPEAL_TABLE_KEY,
    defaultColumns: APPEAL_DEFAULT_COLUMNS,
    fetchConfig: legacyActions.fetchTableConfig,
    saveConfig: legacyActions.saveTableConfig,
  });

  const baseColumns = useMemo(() => createAppealColumns(), []);
  const visibleColumns = useMemo<ColumnsType<AppealRecord>>(() => {
    const baseByKey = new Map(
      baseColumns.map((col) => [String(col.key || ''), col]),
    );
    const ordered = orderedVisibleColumnConfigs
      .map((cfg) => baseByKey.get(cfg.fieldKey))
      .filter((col): col is ColumnsType<AppealRecord>[number] => Boolean(col));

    return [
      ...ordered,
      createAppealActionColumn({
        canHandle,
        onOpenDetail: tableState.handleOpenDetail,
        onOpenHandle: appealActions.openHandleModal,
      }),
    ];
  }, [
    appealActions.openHandleModal,
    baseColumns,
    canHandle,
    orderedVisibleColumnConfigs,
    tableState.handleOpenDetail,
  ]);

  const { columns: resizableColumns } = useResizableColumns(
    visibleColumns as unknown as ServiceRecord[],
  );

  const items = useMemo(
    () => listQuery.data?.appeals ?? [],
    [listQuery.data?.appeals],
  );
  const total = listQuery.data?.total || 0;
  const stats = statsQuery.data || INITIAL_APPEAL_STATS;
  const lastUpdatedText = listQuery.dataUpdatedAt
    ? dayjs(listQuery.dataUpdatedAt).format('HH:mm:ss')
    : '--:--:--';

  const resolvedDetailAppeal = useMemo(() => {
    const targetId = tableState.detailAppealId;
    if (!targetId) return null;
    if (detailQuery.data && detailQuery.data.id === targetId) {
      return detailQuery.data;
    }
    const inList = items.find((item) => item.id === targetId);
    if (inList) return inList;
    if (tableState.detailAppealSnapshot?.id === targetId) {
      return tableState.detailAppealSnapshot;
    }
    return null;
  }, [
    detailQuery.data,
    items,
    tableState.detailAppealId,
    tableState.detailAppealSnapshot,
  ]);

  const studentInspections = useMemo<AppealCandidateInspection[]>(
    () =>
      Array.isArray(data.myInspections)
        ? (data.myInspections as AppealCandidateInspection[])
        : [],
    [data.myInspections],
  );

  const studentExistingAppeals = useMemo<AppealRecord[]>(() => {
    const raw = Array.isArray(data.myAppeals)
      ? (data.myAppeals as AppealRecord[])
      : [];
    const map = new Map<string, AppealRecord>();
    raw.forEach((item) => {
      if (item?.id) map.set(item.id, item);
    });
    items.forEach((item) => {
      if (item?.id) map.set(item.id, item);
    });
    return Array.from(map.values());
  }, [data.myAppeals, items]);

  return {
    navigate,
    isMobile,
    isStudent,
    canView,
    canHandle,
    permissionsReady,
    settings,
    selectedIds,
    setSelectedIds,
    clearSelection,
    settingsOpen,
    setSettingsOpen,
    mobileFilterOpen,
    setMobileFilterOpen,
    actionSheetOpen,
    setActionSheetOpen,
    tableState,
    listQuery,
    statsQuery,
    detailQuery,
    buildings,
    tasks,
    appealActions,
    columnConfigs,
    columnSaving,
    saveAppealColumns,
    resetAppealColumns,
    resizableColumns,
    items,
    total,
    stats,
    lastUpdatedText,
    resolvedDetailAppeal,
    studentInspections,
    studentExistingAppeals,
  };
}

export default function AppealManagementPage() {
  const {
    navigate,
    isMobile,
    isStudent,
    canView,
    canHandle,
    permissionsReady,
    settings,
    selectedIds,
    setSelectedIds,
    clearSelection,
    settingsOpen,
    setSettingsOpen,
    mobileFilterOpen,
    setMobileFilterOpen,
    actionSheetOpen,
    setActionSheetOpen,
    tableState,
    listQuery,
    statsQuery,
    detailQuery,
    buildings,
    tasks,
    appealActions,
    columnConfigs,
    columnSaving,
    saveAppealColumns,
    resetAppealColumns,
    resizableColumns,
    items,
    total,
    stats,
    lastUpdatedText,
    resolvedDetailAppeal,
    studentInspections,
    studentExistingAppeals,
  } = useAppealManagementModel();

  if (!permissionsReady) {
    return (
      <div className="flex items-center justify-center min-h-[360px]">
        <div
          className="animate-spin rounded-full h-10 w-10 border-b-2"
          style={{ borderColor: 'var(--co-primary)' }}
        />
      </div>
    );
  }

  if (!canView) {
    return (
      <PermissionDeniedState
        {...appealManagementPermissionPreset}
        actionText="返回首页"
        onAction={() => navigate('/dashboard')}
      />
    );
  }

  const errorMessage =
    listQuery.error instanceof Error ? listQuery.error.message : null;

  return (
    <div className="management-theme-page">
      {isStudent ? (
        <PageLayout>
          <AppealStudentView
            items={items}
            total={total}
            loading={listQuery.isLoading || listQuery.isFetching}
            errorMessage={errorMessage}
            statusFilter={tableState.appliedFilters.status}
            page={tableState.page}
            pageSize={tableState.pageSize}
            isMobile={isMobile}
            onStatusChange={tableState.handleQuickStatusChange}
            onPageChange={tableState.handlePageChange}
            onRetry={() => {
              void listQuery.refetch();
            }}
            onOpenCreate={() => appealActions.openCreateModal()}
            onOpenDetail={tableState.handleOpenDetail}
            onWithdraw={(record) => {
              void appealActions.handleWithdrawAppeal(record);
            }}
          />
        </PageLayout>
      ) : (
        <AppealManagerSection
          isMobile={isMobile}
          canHandle={canHandle}
          stats={stats}
          tableState={tableState}
          isFetching={listQuery.isFetching}
          isLoading={listQuery.isLoading}
          errorMessage={errorMessage}
          items={items}
          total={total}
          lastUpdatedText={lastUpdatedText}
          columns={resizableColumns as unknown as ColumnsType<AppealRecord>}
          tasks={tasks}
          buildings={buildings}
          selectedIds={selectedIds}
          setSelectedIds={setSelectedIds}
          batchSubmitting={appealActions.batchSubmitting}
          onRefresh={() => {
            void listQuery.refetch();
            void statsQuery.refetch();
          }}
          onRetry={() => {
            void listQuery.refetch();
          }}
          onOpenMobileFilter={() => setMobileFilterOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
          onBatchApprove={() => appealActions.openBatchModal('approved')}
          onBatchReject={() => appealActions.openBatchModal('rejected')}
          onClearSelection={clearSelection}
        />
      )}

      <AppealPageOverlays
        isMobile={isMobile}
        isStudent={isStudent}
        canHandle={canHandle}
        selectedIds={selectedIds}
        settingsOpen={settingsOpen}
        setSettingsOpen={setSettingsOpen}
        columnConfigs={columnConfigs}
        columnSaving={columnSaving}
        saveAppealColumns={saveAppealColumns}
        resetAppealColumns={resetAppealColumns}
        mobileFilterOpen={mobileFilterOpen}
        setMobileFilterOpen={setMobileFilterOpen}
        handleResetFilters={tableState.handleResetFilters}
        handleSearch={tableState.handleSearch}
        draftFilters={tableState.draftFilters}
        setDraftFilters={tableState.setDraftFilters}
        tasks={tasks}
        buildings={buildings}
        actionSheetOpen={actionSheetOpen}
        setActionSheetOpen={setActionSheetOpen}
        items={items}
        handleOpenDetail={tableState.handleOpenDetail}
        detailAppealId={tableState.detailAppealId}
        detailLoading={
          !isStudent && detailQuery.isLoading && !resolvedDetailAppeal
        }
        resolvedDetailAppeal={resolvedDetailAppeal}
        handleCloseDetail={tableState.handleCloseDetail}
        appealActions={appealActions}
        settings={settings}
        studentInspections={studentInspections}
        studentExistingAppeals={studentExistingAppeals}
      />
    </div>
  );
}
