import type { Dispatch, Key, SetStateAction } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Alert, Button, FloatButton } from 'antd';
import {
  DownloadOutlined,
  ExportOutlined,
  ImportOutlined,
  PlusOutlined,
} from '@ant-design/icons';

import TableFieldSettings from '../components/TableFieldSettings';
import PageLayout from '../components/PageLayout';
import ResponsiveDataView from '../components/ResponsiveDataView';
import CollapsibleStatsBoard from '../components/stats/CollapsibleStatsBoard';
import PermissionDeniedState from '../components/common/PermissionDeniedState';
import { studentManagementPermissionPreset } from '../components/common/permissionDeniedPresets';
import LazyImportWizardModal from '../components/common/LazyImportWizardModal';
import { prefetchImportWizardModal } from '../components/common/importWizardPrefetch';
import { useBuildings, useFloors, useRooms } from '../hooks/useInfraQuery';
import { useStudentFilterOptions } from '../hooks/useStudentFilterOptions';
import { useTableColumns } from '../hooks/useTableColumns';
import { useResizableColumns } from '../hooks/useResizableColumns';
import { useMobile } from '../hooks/useMobile';
import { useTableFetch } from '../hooks/useTableFetch';
import { useTableState } from '../hooks/useTableState';
import { useBulkSelection } from '../hooks/useBulkSelection';
import { useAppContext } from '../context/AppContext';
import { STUDENT_IMPORT_CONFIG } from '../constants/importConfigs';
import {
  STUDENT_DEFAULT_COLUMNS,
  STUDENT_FILTER_KEYS,
  STUDENT_TABLE_KEY,
  StudentActionSheet,
  StudentDetailModal,
  StudentFormModal,
  StudentMobileAdvancedFilter,
  StudentMobileCard,
  StudentStats,
  StudentToolbar,
  MobileSearchBar,
  buildStudentTableParams,
  createActionColumn,
  createBaseColumns,
  createFilterOptions,
  getActiveFilterCount,
  mapStudentStatsToSegments,
  normalizeStudentGender,
  useStudentActions,
} from './student';

import type { AppDataStore, AppSelectionState } from '../types/app';
import type { EntityId, ServiceQueryParams, ServiceRecord } from '../types/service';
import type { PaginationState, TableResponse, UseTableStateResult } from '../types/table';
import type {
  BuildingOption,
  StudentColumnConfig,
  StudentColumn,
  StudentDerivedStats,
  StudentFilterOptionsData,
  StudentFilters,
  StudentPageActions,
  StudentRecord,
  StudentTableParams,
  StudentResponsiveSelectionContext,
} from './student/types';

interface StudentTableStateResult
  extends Omit<UseTableStateResult, 'draftFilters' | 'appliedFilters' | 'setDraftFilters'> {
  draftFilters: StudentFilters;
  appliedFilters: StudentFilters;
  setDraftFilters: Dispatch<SetStateAction<StudentFilters>>;
}

function toStudentTableStateResult(
  state: UseTableStateResult,
): StudentTableStateResult {
  return {
    ...state,
    draftFilters: state.draftFilters as StudentFilters,
    appliedFilters: state.appliedFilters as StudentFilters,
    setDraftFilters:
      state.setDraftFilters as Dispatch<SetStateAction<StudentFilters>>,
  };
}

interface StudentTableSectionProps {
  fetchError: string | null;
  onRetryLoad: () => void;
  isMobile: boolean;
  canEdit: boolean;
  tableData: TableResponse<StudentRecord>;
  loading: boolean;
  resizableColumns: ServiceRecord[];
  selectAcrossPages: boolean;
  selectedIds: EntityId[];
  setSelectAcrossPages: Dispatch<SetStateAction<boolean>>;
  setSelectedIds: Dispatch<SetStateAction<EntityId[]>>;
  handleTableChange: UseTableStateResult['handleTableChange'];
  pagination: PaginationState;
  setPagination: Dispatch<SetStateAction<PaginationState>>;
}

interface StudentFloatingActionsProps {
  isMobile: boolean;
  selectedCount: number;
  canEdit: boolean;
  canImport: boolean;
  canExport: boolean;
  openCreateModal: () => void;
  openImportWizard: () => void;
  handleExport: () => void;
  handleDownloadTemplate: () => void;
}

const normalizeStudentGenderValue = (value: unknown): string =>
  normalizeStudentGender(String(value ?? ''));

const DEFAULT_FILTER_OPTIONS: StudentFilterOptionsData = {
  colleges: [],
  majors: [],
  classNames: [],
  grades: [],
};

function hasEntityId(value: EntityId | undefined | null): value is EntityId {
  return value !== undefined && value !== null;
}

function toStudentRecords(items: unknown): StudentRecord[] {
  return Array.isArray(items) ? (items as StudentRecord[]) : [];
}

function toBuildings(items: unknown): BuildingOption[] {
  return Array.isArray(items) ? (items as BuildingOption[]) : [];
}

function toStudentFilterOptionsData(
  value: StudentFilterOptionsData | ServiceRecord | null | undefined,
): StudentFilterOptionsData {
  const source = value as {
    colleges?: unknown;
    grades?: unknown;
    majors?: unknown;
    classNames?: unknown;
  } | null | undefined;

  return {
    colleges: Array.isArray(source?.colleges)
      ? source.colleges.filter((item): item is string => typeof item === 'string')
      : [],
    grades: Array.isArray(source?.grades)
      ? source.grades.filter((item): item is string => typeof item === 'string')
      : [],
    majors: Array.isArray(source?.majors)
      ? source.majors
          .filter(
            (item): item is { college: string; name: string } =>
              Boolean(
                item &&
                  typeof item === 'object' &&
                  typeof (item as { college?: unknown }).college === 'string' &&
                  typeof (item as { name?: unknown }).name === 'string',
              ),
          )
      : [],
    classNames: Array.isArray(source?.classNames)
      ? source.classNames
          .filter(
            (item): item is { major: string; name: string } =>
              Boolean(
                item &&
                  typeof item === 'object' &&
                  typeof (item as { major?: unknown }).major === 'string' &&
                  typeof (item as { name?: unknown }).name === 'string',
              ),
          )
      : [],
  };
}

function toFloorValues(items: unknown): Array<string | number> {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .map((item) => {
      if (typeof item === 'string' || typeof item === 'number') {
        return item;
      }
      if (item && typeof item === 'object' && 'value' in item) {
        const value = (item as { value?: unknown }).value;
        if (typeof value === 'string' || typeof value === 'number') {
          return value;
        }
      }
      return null;
    })
    .filter((item): item is string | number => item !== null);
}

function toRoomValues(items: unknown): string[] {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .map((item) => {
      if (typeof item === 'string' || typeof item === 'number') {
        return String(item);
      }
      if (item && typeof item === 'object') {
        const roomNo = (item as { roomNo?: unknown }).roomNo;
        if (typeof roomNo === 'string' || typeof roomNo === 'number') {
          return String(roomNo);
        }
      }
      return null;
    })
    .filter((item): item is string => Boolean(item));
}

interface ResizableStudentColumn {
  key?: string | number;
  dataIndex?: string | number | readonly (string | number)[];
  width?: number;
  fixed?: boolean | 'left' | 'right';
  [key: string]: unknown;
}

function buildDerivedStats(data: AppDataStore): StudentDerivedStats {
  const students = toStudentRecords(data.students);
  const dormsCount = Array.isArray(data.dorms) ? data.dorms.length : 0;
  const maleCount = students.filter(
    (item) => normalizeStudentGenderValue(String(item.gender || '')) === '男',
  ).length;
  const femaleCount = students.filter(
    (item) => normalizeStudentGenderValue(String(item.gender || '')) === '女',
  ).length;

  return {
    total: students.length,
    maleCount,
    femaleCount,
    dormsCount,
  };
}

function StudentTableSection({
  fetchError,
  onRetryLoad,
  isMobile,
  canEdit,
  tableData,
  loading,
  resizableColumns,
  selectAcrossPages,
  selectedIds,
  setSelectAcrossPages,
  setSelectedIds,
  handleTableChange,
  pagination,
  setPagination,
}: StudentTableSectionProps) {
  const currentPageIds = useMemo(
    () => tableData.items.map((item) => item.id).filter(hasEntityId),
    [tableData.items],
  );

  const renderStudentCard = useCallback(
    (
      student: StudentRecord,
      index: number,
      options: StudentResponsiveSelectionContext,
    ) => (
      <StudentMobileCard
        student={student}
        selected={options.selected}
        onSelect={options.onSelect}
      />
    ),
    [],
  );

  if (fetchError) {
    return (
      <div className="error-state">
        <Alert
          message={fetchError}
          type="error"
          showIcon
          action={
            <Button size="small" onClick={onRetryLoad}>
              重试
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <ResponsiveDataView<StudentRecord>
      isMobile={isMobile}
      dataSource={tableData.items}
      loading={loading}
      rowKey="id"
      columns={resizableColumns}
      rowSelection={
        canEdit
          ? {
              selectedRowKeys: selectAcrossPages ? currentPageIds : selectedIds,
              onChange: (keys: Key[]) => {
                setSelectAcrossPages(false);
                setSelectedIds(keys as EntityId[]);
              },
              preserveSelectedRowKeys: true,
            }
          : undefined
      }
      scroll={{ x: 1300 }}
      onChange={(nextPagination, filters, sorter) => {
        handleTableChange(nextPagination, filters, sorter as never);
      }}
      size="middle"
      className="dorm-table"
      emptyText="暂无学生数据"
      resizable={true}
      pagination={{
        current: pagination.current,
        pageSize: pagination.pageSize,
        total: tableData.total,
      }}
      onPaginationChange={(page: number, pageSize?: number) => {
        setPagination((prev) => ({
          ...prev,
          current: page,
          pageSize: pageSize || prev.pageSize,
        }));
      }}
      renderCard={renderStudentCard}
      selectedKeys={selectAcrossPages ? currentPageIds : selectedIds}
      onSelectChange={
        canEdit
          ? (keys: Key[]) => {
              setSelectAcrossPages(false);
              setSelectedIds(keys as EntityId[]);
            }
          : undefined
      }
    />
  );
}

function StudentFloatingActions({
  isMobile,
  selectedCount,
  canEdit,
  canImport,
  canExport,
  openCreateModal,
  openImportWizard,
  handleExport,
  handleDownloadTemplate,
}: StudentFloatingActionsProps) {
  if (!isMobile) {
    return null;
  }

  return createPortal(
    <>
      <FloatButton.BackTop
        style={{
          bottom: selectedCount > 0 ? 170 : 100,
          right: 20,
        }}
      />

      {selectedCount === 0 ? (
        <FloatButton.Group
          trigger="click"
          type="primary"
          style={{ right: 20, bottom: 100 }}
          icon={<PlusOutlined />}
          closeIcon={<PlusOutlined rotate={45} />}
        >
          {canEdit ? (
            <FloatButton icon={<PlusOutlined />} tooltip="新增学生" onClick={openCreateModal} />
          ) : null}
          {canImport ? (
            <FloatButton
              icon={<ImportOutlined />}
              tooltip="导入"
              onClick={openImportWizard}
              onMouseEnter={prefetchImportWizardModal}
              onFocus={prefetchImportWizardModal}
              onTouchStart={prefetchImportWizardModal}
            />
          ) : null}
          {canExport ? (
            <FloatButton icon={<ExportOutlined />} tooltip="导出" onClick={handleExport} />
          ) : null}
          {canImport ? (
            <FloatButton
              icon={<DownloadOutlined />}
              tooltip="模板"
              onClick={handleDownloadTemplate}
            />
          ) : null}
        </FloatButton.Group>
      ) : null}
    </>,
    document.body,
  );
}

interface StudentPageFiltersProps {
  buildings: BuildingOption[];
  canEdit: boolean;
  canExport: boolean;
  canImport: boolean;
  clearSelection: () => void;
  draftFilters: StudentFilters;
  draftSearchTerm: string;
  handleBulkDelete: () => void;
  handleExport: () => void;
  handleResetFilters: () => void;
  handleSearch: () => void;
  isDirty: boolean;
  isMobile: boolean;
  loading: boolean;
  onOpenImport: () => void;
  onOpenSettings: () => void;
  onOpenMobileFilter: () => void;
  paginationCurrent: number;
  selectAcrossPages: boolean;
  selectedCount: number;
  setDraftFilters: Dispatch<SetStateAction<StudentFilters>>;
  setDraftSearchTerm: Dispatch<SetStateAction<string>>;
  studentActions: ReturnType<typeof useStudentActions>;
  tableData: TableResponse<StudentRecord>;
  uniqueGrades: string[];
  toastMsg: string;
  selectAllResults: () => void;
}

function StudentPageFilters({
  buildings,
  canEdit,
  canExport,
  canImport,
  clearSelection,
  draftFilters,
  draftSearchTerm,
  handleBulkDelete,
  handleExport,
  handleResetFilters,
  handleSearch,
  isDirty,
  isMobile,
  loading,
  onOpenImport,
  onOpenMobileFilter,
  onOpenSettings,
  paginationCurrent,
  selectAcrossPages,
  selectedCount,
  setDraftFilters,
  setDraftSearchTerm,
  studentActions,
  tableData,
  toastMsg,
  uniqueGrades,
  selectAllResults,
}: StudentPageFiltersProps) {
  const activeFilterCount = getActiveFilterCount(draftFilters);

  return (
    <>
      <div className="flex flex-col gap-3">
        {isMobile ? (
          <MobileSearchBar
            draftSearchTerm={draftSearchTerm}
            setDraftSearchTerm={setDraftSearchTerm}
            isDirty={isDirty}
            loading={loading}
            onSearch={handleSearch}
            activeFilterCount={activeFilterCount}
            onOpenFilter={onOpenMobileFilter}
            onReset={handleResetFilters}
          />
        ) : (
          <StudentToolbar
            draftSearchTerm={draftSearchTerm}
            setDraftSearchTerm={setDraftSearchTerm}
            isDirty={isDirty}
            loading={loading}
            onSearch={handleSearch}
            onReset={handleResetFilters}
            canEdit={canEdit}
            canImport={canImport}
            canExport={canExport}
            onOpenModal={() => studentActions.openModal()}
            onOpenImport={onOpenImport}
            onExport={handleExport}
            onOpenSettings={onOpenSettings}
            batchLoading={studentActions.batchLoading}
            onBulkDelete={handleBulkDelete}
            draftFilters={draftFilters}
            setDraftFilters={setDraftFilters}
            uniqueGrades={uniqueGrades}
            buildings={buildings}
            selectedCount={selectedCount}
            selectAcrossPages={selectAcrossPages}
            tableTotal={tableData.total}
            tableItemsLength={tableData.items.length}
            paginationCurrent={paginationCurrent}
            onSelectAllResults={selectAllResults}
            onClearSelection={clearSelection}
          />
        )}
      </div>
      {toastMsg ? <div style={{ marginTop: 12, color: 'var(--co-text-secondary)' }}>{toastMsg}</div> : null}
    </>
  );
}

interface StudentPageOverlaysProps {
  advancedFilterOpen: boolean;
  buildings: BuildingOption[];
  canEdit: boolean;
  columnSaving: boolean;
  draftFilters: StudentFilters;
  dynamicFloors: Array<string | number>;
  dynamicRooms: string[];
  handleBulkDelete: () => void;
  handleDownloadTemplate: () => void;
  handleExport: () => void;
  handleResetFilters: () => void;
  importWizardOpen: boolean;
  isMobile: boolean;
  saveStudentColumns: (columns: StudentColumnConfig[]) => Promise<void>;
  selectedIds: EntityId[];
  setAdvancedFilterOpen: Dispatch<SetStateAction<boolean>>;
  setDraftFilters: Dispatch<SetStateAction<StudentFilters>>;
  setImportWizardOpen: Dispatch<SetStateAction<boolean>>;
  setReloadFlag: Dispatch<SetStateAction<number>>;
  setSettingsOpen: Dispatch<SetStateAction<boolean>>;
  settingsOpen: boolean;
  studentActions: ReturnType<typeof useStudentActions>;
  studentColumns: StudentColumnConfig[];
  tableData: TableResponse<StudentRecord>;
  uniqueGrades: string[];
  resetStudentColumns: () => void;
  actionSheetOpen: boolean;
  canExport: boolean;
  canImport: boolean;
  setActionSheetOpen: Dispatch<SetStateAction<boolean>>;
}

function StudentPageOverlays({
  actionSheetOpen,
  advancedFilterOpen,
  buildings,
  canEdit,
  canExport,
  canImport,
  columnSaving,
  draftFilters,
  dynamicFloors,
  dynamicRooms,
  handleBulkDelete,
  handleDownloadTemplate,
  handleExport,
  handleResetFilters,
  importWizardOpen,
  isMobile,
  resetStudentColumns,
  saveStudentColumns,
  selectedIds,
  setActionSheetOpen,
  setAdvancedFilterOpen,
  setDraftFilters,
  setImportWizardOpen,
  setReloadFlag,
  setSettingsOpen,
  settingsOpen,
  studentActions,
  studentColumns,
  tableData,
  uniqueGrades,
}: StudentPageOverlaysProps) {
  return (
    <>
      <StudentFloatingActions
        isMobile={isMobile}
        selectedCount={selectedIds.length}
        canEdit={canEdit}
        canImport={canImport}
        canExport={canExport}
        openCreateModal={() => studentActions.openModal()}
        openImportWizard={() => setImportWizardOpen(true)}
        handleExport={handleExport}
        handleDownloadTemplate={handleDownloadTemplate}
      />

      <TableFieldSettings
        open={settingsOpen}
        columns={studentColumns}
        onClose={() => setSettingsOpen(false)}
        onSave={async (columns: unknown) => {
          await saveStudentColumns(columns as StudentColumnConfig[]);
          setSettingsOpen(false);
        }}
        onReset={resetStudentColumns}
        saving={columnSaving}
        title="学生列表字段设置"
      />

      <StudentFormModal
        open={studentActions.modalOpen}
        isMobile={isMobile}
        isEditing={Boolean(studentActions.editingId)}
        form={studentActions.form}
        setForm={studentActions.setForm}
        onClose={studentActions.closeModal}
        onSubmit={() => {
          void studentActions.handleFormSubmit();
        }}
      />

      <StudentDetailModal
        open={studentActions.detailModalOpen}
        student={studentActions.detailStudent}
        canEdit={canEdit}
        onClose={studentActions.closeDetailModal}
        onEdit={studentActions.openModal}
      />

      <StudentActionSheet
        open={actionSheetOpen}
        onClose={() => setActionSheetOpen(false)}
        selectedIds={selectedIds}
        tableItems={tableData.items || []}
        canEdit={canEdit}
        batchLoading={studentActions.batchLoading}
        onViewDetail={studentActions.openDetailModal}
        onEdit={studentActions.openModal}
        onBulkDelete={handleBulkDelete}
      />

      <StudentMobileAdvancedFilter
        open={advancedFilterOpen}
        onClose={() => setAdvancedFilterOpen(false)}
        onReset={handleResetFilters}
        draftFilters={draftFilters}
        setDraftFilters={setDraftFilters}
        uniqueGrades={uniqueGrades}
        buildings={buildings}
        dynamicFloors={dynamicFloors}
        dynamicRooms={dynamicRooms}
      />

      <LazyImportWizardModal
        open={importWizardOpen}
        onClose={() => {
          setImportWizardOpen(false);
          setReloadFlag((prev) => prev + 1);
        }}
        config={STUDENT_IMPORT_CONFIG}
      />
    </>
  );
}

function useStudentManagementUi() {
  const [reloadFlag, setReloadFlag] = useState(0);
  const [toastMsg, setToastMsg] = useState('');
  const [lastRefreshedAt, setLastRefreshedAt] = useState(() =>
    new Date().toLocaleTimeString(),
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [advancedFilterOpen, setAdvancedFilterOpen] = useState(false);
  const [actionSheetOpen, setActionSheetOpen] = useState(false);
  const [importWizardOpen, setImportWizardOpen] = useState(false);

  useEffect(() => {
    setLastRefreshedAt(new Date().toLocaleTimeString());
  }, [reloadFlag]);

  return {
    actionSheetOpen,
    advancedFilterOpen,
    importWizardOpen,
    lastRefreshedAt,
    reloadFlag,
    setActionSheetOpen,
    setAdvancedFilterOpen,
    setImportWizardOpen,
    setReloadFlag,
    setSettingsOpen,
    setToastMsg,
    settingsOpen,
    toastMsg,
  };
}

function useStudentManagementModel() {
  const { data, actions, hasPermission, setSelection } = useAppContext();
  const studentPageActions = actions as StudentPageActions;
  const isMobile = useMobile();

  const bulkSelection = useBulkSelection<EntityId>({
    defaultSelectedIds: [],
  });
  const {
    selectedIds,
    selectAcrossPages,
    setSelectedIds,
    selectAllResults,
    clearSelection,
    getSelectionCount,
    setSelectAcrossPages,
  } = bulkSelection;
  const uiState = useStudentManagementUi();

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
    resetAll: resetTableState,
    handleTableChange,
  } = toStudentTableStateResult(
    useTableState({
      filterKeys: STUDENT_FILTER_KEYS,
      defaultSortField: 'studentNo',
      defaultSortOrder: 'asc',
      defaultPageSize: 10,
      syncUrl: true,
      normalizers: { gender: normalizeStudentGenderValue },
      onApply: clearSelection,
      onReset: clearSelection,
    }),
  );

  const canView = hasPermission('STUDENT_VIEW');
  const canEdit = hasPermission('STUDENT_EDIT');
  const canExport = hasPermission('STUDENT_EXPORT');
  const canImport = hasPermission('STUDENT_IMPORT');

  useEffect(() => {
    if (canView) {
      void studentPageActions.loadDormBeds?.();
    }
  }, [canView, studentPageActions]);

  const fetchStudentTable = studentPageActions.fetchStudentTable;
  const {
    data: tableData,
    loading,
    error: fetchError,
  } = useTableFetch<StudentRecord>({
    fetchFn: async (
      params: Record<string, unknown>,
      options?: { signal?: AbortSignal },
    ): Promise<TableResponse<StudentRecord>> => {
      if (!fetchStudentTable) {
        return { items: [], total: 0 };
      }

      return fetchStudentTable(params as ServiceQueryParams, options);
    },
    buildParams: () =>
      buildStudentTableParams(
        appliedFilters,
        appliedSearchTerm,
        pagination,
        sortField,
        sortOrder,
        true,
      ) as ServiceQueryParams,
    enabled: canView && Boolean(fetchStudentTable),
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
      uiState.reloadFlag,
    ],
    keepPreviousData: true,
  });

  const studentActions = useStudentActions({
    actions: studentPageActions,
    appliedFilters,
    appliedSearchTerm,
    pagination,
    sortField,
    sortOrder,
    selectedIds,
    selectAcrossPages,
    setSelectedIds,
    setSelectAcrossPages,
    clearSelection,
    getSelectionCount,
    setReloadFlag: uiState.setReloadFlag,
    setToastMsg: uiState.setToastMsg,
    canEdit,
    canExport,
    tableTotal: tableData.total,
  });

  const {
    columns: studentColumns,
    visibleColumns: visibleStudentColumns,
    saving: columnSaving,
    save: saveStudentColumns,
    resetToDefault: resetStudentColumns,
  } = useTableColumns<StudentColumnConfig>({
    tableKey: STUDENT_TABLE_KEY,
    defaultColumns: STUDENT_DEFAULT_COLUMNS,
    fetchConfig: studentPageActions.fetchTableConfig
      ? async (tableKey) => {
          const result = await studentPageActions.fetchTableConfig?.(tableKey);
          return {
            config: Array.isArray(result?.config)
              ? (result.config as StudentColumnConfig[])
              : undefined,
          };
        }
      : undefined,
    saveConfig: studentPageActions.saveTableConfig
      ? async (tableKey, columns) => {
          await studentPageActions.saveTableConfig!(tableKey, columns);
        }
      : undefined,
  });

  const { data: buildingsData } = useBuildings();
  const buildings = useMemo(
    () => toBuildings(buildingsData?.buildings),
    [buildingsData?.buildings],
  );

  const activeBuildingFilter =
    draftFilters.building?.length === 1 ? draftFilters.building[0] : null;
  const activeFloorFilter =
    activeBuildingFilter && draftFilters.floor?.length === 1
      ? draftFilters.floor[0]
      : null;

  const { data: floorsData } = useFloors(activeBuildingFilter ?? undefined);
  const dynamicFloors = useMemo(
    () => toFloorValues(floorsData?.floors),
    [floorsData?.floors],
  );

  const { data: roomsData } = useRooms(
    activeBuildingFilter ?? undefined,
    activeFloorFilter ?? undefined,
  );
  const dynamicRooms = useMemo(
    () => toRoomValues(roomsData?.rooms),
    [roomsData?.rooms],
  );

  const { data: filterOptionsData } = useStudentFilterOptions();
  const filterOptions = useMemo(
    () => toStudentFilterOptionsData(filterOptionsData) || DEFAULT_FILTER_OPTIONS,
    [filterOptionsData],
  );
  const { uniqueGrades } = useMemo(
    () => createFilterOptions(filterOptions, draftFilters),
    [draftFilters, filterOptions],
  );

  const derivedStats = useMemo(
    () => buildDerivedStats(data),
    [data],
  );

  const baseColumns = useMemo(
    () =>
      createBaseColumns({
        visibleColumns: visibleStudentColumns,
        sortField,
        sortOrder,
      }),
    [sortField, sortOrder, visibleStudentColumns],
  );

  const allColumns = useMemo(
    () => [
      ...baseColumns,
      createActionColumn({
        canEdit,
        batchLoading: studentActions.batchLoading,
        onView: studentActions.openDetailModal,
        onEdit: studentActions.openModal,
        onDelete: studentActions.handleSingleDelete,
      }),
    ],
    [
      baseColumns,
      canEdit,
      studentActions.batchLoading,
      studentActions.handleSingleDelete,
      studentActions.openDetailModal,
      studentActions.openModal,
    ],
  );

  const { columns: resizableColumns } = useResizableColumns(
    allColumns as ResizableStudentColumn[],
    {
    minWidth: 60,
    maxWidth: 400,
    },
  );

  const selectedCount = selectAcrossPages ? tableData.total : selectedIds.length;
  const paginationCurrent = pagination.current, paginationPageSize = pagination.pageSize;
  useEffect(() => {
    if (!isMobile) {
      return;
    }

    setSelection({
      count: selectedCount,
      onClear: clearSelection,
      onAction: () => uiState.setActionSheetOpen(true),
      actionLabel: '操作',
    } as AppSelectionState);
  }, [clearSelection, isMobile, selectedCount, setSelection, uiState]);

  useEffect(() => {
    if (!loading && tableData.total > 0 && paginationCurrent > 1) {
      const maxPage = Math.ceil(tableData.total / paginationPageSize);
      if (paginationCurrent > maxPage) {
        setPagination((prev) => ({ ...prev, current: maxPage }));
      }
    }
  }, [loading, paginationCurrent, paginationPageSize, setPagination, tableData.total]);

  const handleResetFilters = useCallback((): void => {
    resetTableState();
    clearSelection();
  }, [clearSelection, resetTableState]);

  const handleRetryLoad = useCallback((): void => {
    uiState.setReloadFlag((prev) => prev + 1);
  }, [uiState]);

  const handleExport = useCallback((): void => { void studentActions.handleExport(); }, [studentActions]);
  const handleDownloadTemplate = useCallback((): void => { void studentActions.handleDownloadTemplate(); }, [studentActions]);
  const handleBulkDelete = useCallback((): void => { void studentActions.handleBulkDelete(); }, [studentActions]);

  return {
    actionSheetOpen: uiState.actionSheetOpen,
    advancedFilterOpen: uiState.advancedFilterOpen,
    batchLoading: studentActions.batchLoading,
    buildings,
    canEdit,
    canExport,
    canImport,
    canView,
    clearSelection,
    columnSaving,
    derivedStats,
    draftFilters,
    draftSearchTerm,
    dynamicFloors,
    dynamicRooms,
    fetchError,
    handleBulkDelete,
    handleDownloadTemplate,
    handleExport,
    handleResetFilters,
    handleRetryLoad,
    handleSearch,
    handleTableChange,
    importWizardOpen: uiState.importWizardOpen,
    isDirty,
    isMobile,
    lastRefreshedAt: uiState.lastRefreshedAt,
    loading,
    pagination,
    resizableColumns,
    saveStudentColumns,
    selectedCount,
    selectedIds,
    selectAcrossPages,
    selectAllResults,
    setActionSheetOpen: uiState.setActionSheetOpen,
    setAdvancedFilterOpen: uiState.setAdvancedFilterOpen,
    setDraftFilters,
    setDraftSearchTerm,
    setImportWizardOpen: uiState.setImportWizardOpen,
    setPagination,
    setReloadFlag: uiState.setReloadFlag,
    setSelectedIds,
    setSelectAcrossPages,
    setSettingsOpen: uiState.setSettingsOpen,
    settingsOpen: uiState.settingsOpen,
    studentActions,
    studentColumns,
    tableData,
    toastMsg: uiState.toastMsg,
    uniqueGrades,
    resetStudentColumns,
  };
}

export default function StudentManagementPage() {
  const model = useStudentManagementModel();

  if (!model.canView) {
    return (
      <div className="management-theme-page">
        <PermissionDeniedState {...studentManagementPermissionPreset} />
      </div>
    );
  }

  return (
    <>
      <div className="management-theme-page">
        <PageLayout
        statsLayout="custom"
        stats={
          <CollapsibleStatsBoard
            expandedContent={
              <StudentStats
                stats={model.derivedStats}
                filteredTotal={model.tableData.total}
              />
            }
            segments={mapStudentStatsToSegments(
              model.derivedStats,
              model.tableData.total,
            )}
          />
        }
        filters={
          <StudentPageFilters
            buildings={model.buildings}
            canEdit={model.canEdit}
            canExport={model.canExport}
            canImport={model.canImport}
            clearSelection={model.clearSelection}
            draftFilters={model.draftFilters}
            draftSearchTerm={model.draftSearchTerm}
            handleBulkDelete={model.handleBulkDelete}
            handleExport={model.handleExport}
            handleResetFilters={model.handleResetFilters}
            handleSearch={model.handleSearch}
            isDirty={model.isDirty}
            isMobile={model.isMobile}
            loading={model.loading}
            onOpenImport={() => model.setImportWizardOpen(true)}
            onOpenMobileFilter={() => model.setAdvancedFilterOpen(true)}
            onOpenSettings={() => model.setSettingsOpen(true)}
            paginationCurrent={model.pagination.current}
            selectAcrossPages={model.selectAcrossPages}
            selectedCount={model.selectedCount}
            setDraftFilters={model.setDraftFilters}
            setDraftSearchTerm={model.setDraftSearchTerm}
            studentActions={model.studentActions}
            tableData={model.tableData}
            toastMsg={model.toastMsg}
            uniqueGrades={model.uniqueGrades}
            selectAllResults={model.selectAllResults}
          />
        }
      >
        <div className="table-head dorm-table-head mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="dorm-table-head-accent" />
            <h3 className="dorm-table-head-title">实时列表</h3>
            <span className="dorm-table-head-time">最后更新: {model.lastRefreshedAt}</span>
          </div>
        </div>

        <div className="table-wrapper dorm-table-wrapper">
          <StudentTableSection
            fetchError={model.fetchError}
            onRetryLoad={model.handleRetryLoad}
            isMobile={model.isMobile}
            canEdit={model.canEdit}
            tableData={model.tableData}
            loading={model.loading}
            resizableColumns={model.resizableColumns}
            selectAcrossPages={model.selectAcrossPages}
            selectedIds={model.selectedIds}
            setSelectAcrossPages={model.setSelectAcrossPages}
            setSelectedIds={model.setSelectedIds}
            handleTableChange={model.handleTableChange}
            pagination={model.pagination}
            setPagination={model.setPagination}
          />
        </div>
        </PageLayout>
      </div>

      <StudentPageOverlays
        actionSheetOpen={model.actionSheetOpen}
        advancedFilterOpen={model.advancedFilterOpen}
        buildings={model.buildings}
        canEdit={model.canEdit}
        canExport={model.canExport}
        canImport={model.canImport}
        columnSaving={model.columnSaving}
        draftFilters={model.draftFilters}
        dynamicFloors={model.dynamicFloors}
        dynamicRooms={model.dynamicRooms}
        handleBulkDelete={model.handleBulkDelete}
        handleDownloadTemplate={model.handleDownloadTemplate}
        handleExport={model.handleExport}
        handleResetFilters={model.handleResetFilters}
        importWizardOpen={model.importWizardOpen}
        isMobile={model.isMobile}
        resetStudentColumns={model.resetStudentColumns}
        saveStudentColumns={model.saveStudentColumns}
        selectedIds={model.selectedIds}
        setActionSheetOpen={model.setActionSheetOpen}
        setAdvancedFilterOpen={model.setAdvancedFilterOpen}
        setDraftFilters={model.setDraftFilters}
        setImportWizardOpen={model.setImportWizardOpen}
        setReloadFlag={model.setReloadFlag}
        setSettingsOpen={model.setSettingsOpen}
        settingsOpen={model.settingsOpen}
        studentActions={model.studentActions}
        studentColumns={model.studentColumns}
        tableData={model.tableData}
        uniqueGrades={model.uniqueGrades}
      />
    </>
  );
}
