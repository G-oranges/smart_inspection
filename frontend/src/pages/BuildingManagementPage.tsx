import type { Dispatch, Key, SetStateAction } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button, FloatButton, Form, Input } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  DeleteOutlined,
  ExportOutlined,
  FilterOutlined,
  ImportOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  SettingOutlined,
} from '@ant-design/icons';

import { useAppContext } from '../context/AppContext';
import { getAllBuildings, getBuildings } from '../services/buildingService';
import { useTitle } from '../hooks/useTitle';
import { useMobile } from '../hooks/useMobile';
import { useTableColumns } from '../hooks/useTableColumns';
import { useResizableColumns } from '../hooks/useResizableColumns';
import { useTableState } from '../hooks/useTableState';
import { useTableFetch } from '../hooks/useTableFetch';
import TableFieldSettings from '../components/TableFieldSettings';
import PageLayout from '../components/PageLayout';
import ResponsiveDataView from '../components/ResponsiveDataView';
import CollapsibleStatsBoard from '../components/stats/CollapsibleStatsBoard';
import FilterDropdownPanel from '../components/common/FilterDropdownPanel';
import MobileAdvancedFilter from '../components/common/MobileAdvancedFilter';
import LazyImportWizardModal from '../components/common/LazyImportWizardModal';
import { prefetchImportWizardModal } from '../components/common/importWizardPrefetch';
import { BUILDING_IMPORT_CONFIG } from '../constants/importConfigs';
import { PAGINATION_SIZE_CHANGER_PROPS } from '../utils/pagination';
import {
  BUILDING_FILTER_KEYS,
  BUILDING_TABLE_KEY,
  BuildingActionSheet,
  BuildingDetailModal,
  BuildingFormModal,
  BuildingMobileCard,
  BuildingStats,
  createActionColumn,
  createBaseColumns,
  createDesktopFilterConfig,
  createMobileFilterConfig,
  calculateBuildingStats,
  extractUniqueCampuses,
  getFilterCount,
  mapBuildingStatsToSegments,
  useBuildingActions,
} from './building';
import type { BuildingColumnConfig } from './building/BuildingColumns';

import type { PaginationState, UseTableStateResult } from '../types/table';
import type { EntityId } from '../types/service';
import type {
  BuildingFiltersState,
  BuildingQueryParams,
  BuildingRecord,
  BuildingStatsState,
} from './building/types';

interface BuildingTableStateResult
  extends Omit<UseTableStateResult, 'draftFilters' | 'appliedFilters' | 'setDraftFilters'> {
  draftFilters: BuildingFiltersState;
  appliedFilters: BuildingFiltersState;
  setDraftFilters: Dispatch<SetStateAction<BuildingFiltersState>>;
}

function toBuildingTableStateResult(
  state: UseTableStateResult,
): BuildingTableStateResult {
  return {
    ...state,
    draftFilters: state.draftFilters as BuildingFiltersState,
    appliedFilters: state.appliedFilters as BuildingFiltersState,
    setDraftFilters:
      state.setDraftFilters as Dispatch<SetStateAction<BuildingFiltersState>>,
  };
}

interface ConfigurableBuildingColumn extends Omit<BuildingColumnConfig, 'key'> {
  key?: string | number;
  [key: string]: unknown;
}

interface ResizableBuildingColumn {
  key?: string | number;
  dataIndex?: string | number | readonly (string | number)[];
  width?: number;
  fixed?: boolean | 'left' | 'right';
  [key: string]: unknown;
}

interface BuildingFiltersBarProps {
  isMobile: boolean;
  draftSearchTerm: string;
  setDraftSearchTerm: Dispatch<SetStateAction<string>>;
  handleSearch: () => void;
  handleResetFilters: () => void;
  isDirty: boolean;
  loading: boolean;
  draftFilters: BuildingFiltersState;
  desktopFilterConfig: ReturnType<typeof createDesktopFilterConfig>;
  mobileFilterConfig: ReturnType<typeof createMobileFilterConfig>;
  filterDrawerOpen: boolean;
  setFilterDrawerOpen: Dispatch<SetStateAction<boolean>>;
  handleAdd: () => void;
  handleExport: () => Promise<void>;
  setSettingsOpen: Dispatch<SetStateAction<boolean>>;
  setImportWizardOpen: Dispatch<SetStateAction<boolean>>;
  selectedIds: EntityId[];
  batchLoading: boolean;
  handleBulkDelete: () => Promise<void>;
}

interface BuildingTablePaneProps {
  isMobile: boolean;
  loading: boolean;
  data: BuildingRecord[];
  resizableColumns: ColumnsType<BuildingRecord>;
  selectedIds: EntityId[];
  setSelectedIds: Dispatch<SetStateAction<EntityId[]>>;
  pagination: PaginationState;
  handleTableChange: UseTableStateResult['handleTableChange'];
}

interface BuildingFloatingActionsProps {
  isMobile: boolean;
  selectedIds: EntityId[];
  fabOpen: boolean;
  setFabOpen: Dispatch<SetStateAction<boolean>>;
  handleAdd: () => void;
  handleExport: () => Promise<void>;
  setImportWizardOpen: Dispatch<SetStateAction<boolean>>;
}

function BuildingFiltersBar({
  isMobile,
  draftSearchTerm,
  setDraftSearchTerm,
  handleSearch,
  handleResetFilters,
  isDirty,
  loading,
  draftFilters,
  desktopFilterConfig,
  mobileFilterConfig,
  filterDrawerOpen,
  setFilterDrawerOpen,
  handleAdd,
  handleExport,
  setSettingsOpen,
  setImportWizardOpen,
  selectedIds,
  batchLoading,
  handleBulkDelete,
}: BuildingFiltersBarProps) {
  return (
    <>
      <div className="flex flex-col gap-3">
        {isMobile ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Input
                placeholder="搜索楼栋名称、校区..."
                prefix={<SearchOutlined className="text-gray-400" />}
                className="apple-search-input !rounded-xl !bg-gray-100/60 dark:!bg-white/5 border-none h-10 flex-1"
                value={draftSearchTerm}
                onChange={(event) => setDraftSearchTerm(event.target.value)}
                onPressEnter={handleSearch}
                allowClear
              />
              <Button
                type="primary"
                icon={<SearchOutlined />}
                onClick={handleSearch}
                disabled={!isDirty}
                loading={loading}
                className="apple-btn-primary h-10 rounded-xl px-4 active:scale-95 transition-all border-none"
              >
                搜索
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => setFilterDrawerOpen(true)}
                className="h-10 min-w-[44px] rounded-xl border-none bg-gray-100/60 dark:bg-white/5 active:scale-95 transition-all flex items-center justify-center gap-1.5 px-3"
                icon={<FilterOutlined className="text-gray-500 dark:text-gray-400" />}
              >
                {getFilterCount(draftFilters) > 0 ? (
                  <span className="px-1.5 py-0.5 text-[11px] bg-ios-blue text-white rounded-full min-w-[18px] text-center font-medium">
                    {getFilterCount(draftFilters)}
                  </span>
                ) : (
                  <span className="text-gray-600 dark:text-gray-300 text-[13px]">筛选</span>
                )}
              </Button>
              <Button
                onClick={handleResetFilters}
                className="h-10 rounded-xl border-none bg-red-50 dark:bg-red-500/10 text-red-500 active:scale-95 transition-all px-4"
                icon={<ReloadOutlined />}
              >
                重置
              </Button>
            </div>
          </div>
        ) : (
          <div className="dorm-toolbar-shell">
            <div className="dorm-toolbar-row dorm-toolbar-row-main">
              <Input
                placeholder="搜索楼栋名称、校区..."
                prefix={<SearchOutlined className="text-gray-400" />}
                className="apple-search-input dorm-toolbar-search !bg-gray-100/50 dark:!bg-white/5 border-none flex-1 min-w-[220px]"
                value={draftSearchTerm}
                onChange={(event) => setDraftSearchTerm(event.target.value)}
                onPressEnter={handleSearch}
                allowClear
              />
              <Button
                type="primary"
                icon={<SearchOutlined />}
                onClick={handleSearch}
                disabled={!isDirty}
                loading={loading}
                className="apple-btn-primary dorm-toolbar-button dorm-toolbar-button-primary active:scale-95 transition-all border-none"
              >
                搜索
              </Button>
              <Button
                onClick={handleResetFilters}
                className="dorm-toolbar-button dorm-toolbar-button-subtle active:scale-95 transition-all"
                icon={<ReloadOutlined />}
              >
                重置
              </Button>
            </div>

            <div className="dorm-toolbar-row dorm-toolbar-row-actions">
              <Button
                type="primary"
                className="apple-btn-primary dorm-toolbar-button dorm-toolbar-button-primary active:scale-95 transition-all"
                icon={<PlusOutlined />}
                onClick={handleAdd}
              >
                新增楼栋
              </Button>
              <Button
                className="dorm-toolbar-button dorm-toolbar-button-subtle active:scale-95 transition-all"
                icon={<ImportOutlined />}
                onClick={() => setImportWizardOpen(true)}
                onMouseEnter={prefetchImportWizardModal}
                onFocus={prefetchImportWizardModal}
                onTouchStart={prefetchImportWizardModal}
              >
                导入
              </Button>
              <Button
                className="dorm-toolbar-button dorm-toolbar-button-subtle active:scale-95 transition-all"
                icon={<ExportOutlined />}
                onClick={() => {
                  void handleExport();
                }}
              >
                导出
              </Button>
              <Button
                className="dorm-toolbar-button dorm-toolbar-button-subtle active:scale-95 transition-all"
                icon={<SettingOutlined className="text-gray-600 dark:text-gray-300" />}
                onClick={() => setSettingsOpen(true)}
              >
                字段设置
              </Button>
              {selectedIds.length > 0 ? (
                <Button
                  danger
                  className="dorm-toolbar-button dorm-toolbar-button-danger active:scale-95 transition-all ml-2"
                  icon={<DeleteOutlined />}
                  loading={batchLoading}
                  onClick={() => {
                    void handleBulkDelete();
                  }}
                >
                  删除 ({selectedIds.length})
                </Button>
              ) : null}
            </div>
          </div>
        )}

        {!isMobile ? (
          <div className="dorm-toolbar-row dorm-toolbar-row-filters">
            <FilterDropdownPanel
              filters={desktopFilterConfig}
              onReset={handleResetFilters}
            />
          </div>
        ) : null}
      </div>

      <MobileAdvancedFilter
        open={filterDrawerOpen}
        onClose={() => setFilterDrawerOpen(false)}
        title="筛选楼栋"
        filters={mobileFilterConfig}
        onReset={handleResetFilters}
        onConfirm={() => setFilterDrawerOpen(false)}
      />
    </>
  );
}

function BuildingTablePane({
  isMobile,
  loading,
  data,
  resizableColumns,
  selectedIds,
  setSelectedIds,
  pagination,
  handleTableChange,
}: BuildingTablePaneProps) {
  const renderBuildingCard = useCallback(
    (
      record: BuildingRecord,
      index: number,
      options: { selected: boolean; onSelect?: (selected: boolean) => void },
    ) =>
      BuildingMobileCard(record, index, {
        selected: options.selected,
        onSelect: options.onSelect || (() => {}),
      }),
    [],
  );

  return (
    <ResponsiveDataView<BuildingRecord>
      isMobile={isMobile}
      loading={loading}
      dataSource={data}
      renderCard={renderBuildingCard}
      columns={resizableColumns}
      rowKey="id"
      selectedKeys={selectedIds}
      onSelectChange={(keys: Key[]) => setSelectedIds(keys as EntityId[])}
      pagination={{
        ...pagination,
        showSizeChanger: PAGINATION_SIZE_CHANGER_PROPS,
        showQuickJumper: true,
        showTotal: (total: number) => `共 ${total} 条`,
      }}
      onChange={(nextPagination, _filters, sorter) => {
        const activeSorter = Array.isArray(sorter) ? sorter[0] : sorter;
        handleTableChange(
          {
            current: nextPagination.current,
            pageSize: nextPagination.pageSize,
          },
          undefined,
          {
            field:
              activeSorter?.field !== undefined && activeSorter?.field !== null
                ? String(activeSorter.field)
                : undefined,
            order: activeSorter?.order,
          },
        );
      }}
      scroll={{ x: 1000 }}
      className="dorm-table"
      resizable={true}
    />
  );
}

function BuildingFloatingActions({
  isMobile,
  selectedIds,
  fabOpen,
  setFabOpen,
  handleAdd,
  handleExport,
  setImportWizardOpen,
}: BuildingFloatingActionsProps) {
  if (!isMobile) {
    return null;
  }

  return createPortal(
    <>
      <FloatButton.BackTop
        style={{
          bottom: selectedIds.length > 0 ? 170 : 100,
          right: 20,
        }}
      />
      {selectedIds.length === 0 ? (
        <FloatButton.Group
          trigger="click"
          type="primary"
          style={{ right: 20, bottom: 100 }}
          icon={<PlusOutlined />}
          closeIcon={<PlusOutlined rotate={45} />}
          open={fabOpen}
          onOpenChange={setFabOpen}
        >
          <FloatButton icon={<PlusOutlined />} tooltip="新增楼栋" onClick={handleAdd} />
          <FloatButton
            icon={<ImportOutlined />}
            tooltip="导入"
            onClick={() => setImportWizardOpen(true)}
            onMouseEnter={prefetchImportWizardModal}
            onFocus={prefetchImportWizardModal}
            onTouchStart={prefetchImportWizardModal}
          />
          <FloatButton
            icon={<ExportOutlined />}
            tooltip="导出"
            onClick={() => {
              void handleExport();
            }}
          />
        </FloatButton.Group>
      ) : null}
    </>,
    document.body,
  );
}

export default function BuildingManagementPage() {
  const { setSelection } = useAppContext();
  useTitle('楼栋管理');
  const isMobile = useMobile();
  const [form] = Form.useForm();

  const {
    draftFilters,
    appliedFilters,
    pagination,
    draftSearchTerm,
    appliedSearchTerm,
    sortField,
    sortOrder,
    isDirty,
    appliedFiltersKey,
    setDraftFilters,
    setDraftSearchTerm,
    setPagination,
    applyFilters,
    resetAll,
    handleTableChange,
  } = toBuildingTableStateResult(
    useTableState({
      filterKeys: BUILDING_FILTER_KEYS,
      syncUrl: true,
      defaultSortField: 'id',
      defaultSortOrder: 'asc',
    }),
  );

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | string | null>(null);
  const [selectedIds, setSelectedIds] = useState<EntityId[]>([]);
  const [batchLoading, setBatchLoading] = useState(false);
  const [reloadFlag, setReloadFlag] = useState(0);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailBuilding, setDetailBuilding] = useState<BuildingRecord | null>(null);
  const [actionSheetOpen, setActionSheetOpen] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [importWizardOpen, setImportWizardOpen] = useState(false);
  const [allBuildings, setAllBuildings] = useState<BuildingRecord[]>([]);

  const uniqueCampuses = useMemo(() => extractUniqueCampuses(allBuildings), [allBuildings]);
  const stats = useMemo<BuildingStatsState>(() => calculateBuildingStats(allBuildings), [allBuildings]);
  const initialColumns = useMemo<ConfigurableBuildingColumn[]>(
    () => createBaseColumns() as ConfigurableBuildingColumn[],
    [],
  );

  const {
    columns: buildingColumns,
    save: saveBuildingColumns,
    resetToDefault: resetBuildingColumns,
    saving: columnSaving,
  } = useTableColumns<ConfigurableBuildingColumn>({
    tableKey: BUILDING_TABLE_KEY,
    defaultColumns: initialColumns,
  });

  useEffect(() => {
    getAllBuildings()
      .then((result) => setAllBuildings(result))
      .catch((error) => {
        console.error('获取楼栋筛选选项失败:', error);
      });
  }, []);

  const {
    data: tableData,
    loading,
  } = useTableFetch<BuildingRecord>({
    fetchFn: getBuildings as (params: Record<string, unknown>, options?: { signal?: AbortSignal }) => Promise<{ items: BuildingRecord[]; total: number }>,
    buildParams: () => {
      const params: BuildingQueryParams = {
        page: pagination.current,
        pageSize: pagination.pageSize,
        search: appliedSearchTerm,
        sortField,
        sortOrder,
      };

      BUILDING_FILTER_KEYS.forEach((key) => {
        const value = appliedFilters[key as keyof BuildingFiltersState];
        if (Array.isArray(value) && value.length > 0) {
          params[key as keyof BuildingQueryParams] = value;
        }
      });

      return params;
    },
    deps: [
      pagination.current,
      pagination.pageSize,
      appliedSearchTerm,
      appliedFiltersKey,
      sortField,
      sortOrder,
      reloadFlag,
    ],
  });

  const data = useMemo(() => tableData.items || [], [tableData.items]);

  useEffect(() => {
    if (tableData.total !== undefined && tableData.total !== pagination.total) {
      setPagination((prev) => ({ ...prev, total: tableData.total }));
    }
  }, [pagination.total, setPagination, tableData.total]);

  const fetchBuildings = useCallback((): void => {
    setReloadFlag((prev) => prev + 1);
  }, []);

  useEffect(() => {
    if (!isMobile) {
      return;
    }

    setSelection({
      count: selectedIds.length,
      onClear: () => setSelectedIds([]),
      onAction: () => setActionSheetOpen(true),
      actionLabel: '操作',
    });
  }, [isMobile, selectedIds.length, setSelection]);

  const {
    handleAdd,
    handleEdit,
    handleView,
    handleDelete,
    handleBulkDelete,
    handleExport,
    handleModalOk,
  } = useBuildingActions({
    form,
    appliedFilters,
    appliedSearchText: appliedSearchTerm,
    editingId,
    selectedIds,
    setEditingId,
    setSelectedIds,
    setIsModalVisible,
    setDetailBuilding,
    setDetailModalOpen,
    setBatchLoading,
    setReloadFlag,
    fetchBuildings,
  });

  const handleSearch = applyFilters;
  const handleResetFilters = resetAll;

  const allColumns = useMemo(() => {
    const baseColumns =
      buildingColumns.length > 0 ? buildingColumns : initialColumns;

    return [
      ...baseColumns,
      createActionColumn({
        onView: handleView,
        onEdit: handleEdit,
        onDelete: handleDelete,
      }),
    ];
  }, [buildingColumns, handleDelete, handleEdit, handleView, initialColumns]);
  const resizableColumnInput = useMemo<ResizableBuildingColumn[]>(
    () =>
      allColumns.map((column) => ({
        ...column,
        key: column.key !== undefined && column.key !== null ? String(column.key) : undefined,
      })) as ResizableBuildingColumn[],
    [allColumns],
  );

  const { columns: resizableColumns } = useResizableColumns(
    resizableColumnInput,
    {
      minWidth: 60,
      maxWidth: 400,
    },
  );

  const desktopFilterConfig = useMemo(
    () =>
      createDesktopFilterConfig({
        campusOptions: uniqueCampuses,
        draftFilters,
        setDraftFilters,
      }),
    [draftFilters, setDraftFilters, uniqueCampuses],
  );
  const mobileFilterConfig = useMemo(
    () =>
      createMobileFilterConfig({
        campusOptions: uniqueCampuses,
        draftFilters,
        setDraftFilters,
      }),
    [draftFilters, setDraftFilters, uniqueCampuses],
  );
  const statsSegments = useMemo(() => mapBuildingStatsToSegments(stats), [stats]);

  return (
    <>
      <div className="management-theme-page">
        <PageLayout
        statsLayout="custom"
        stats={
          <CollapsibleStatsBoard
            expandedContent={<BuildingStats stats={stats} />}
            segments={statsSegments}
          />
        }
        filters={
          <BuildingFiltersBar
            isMobile={isMobile}
            draftSearchTerm={draftSearchTerm}
            setDraftSearchTerm={setDraftSearchTerm}
            handleSearch={handleSearch}
            handleResetFilters={handleResetFilters}
            isDirty={isDirty}
            loading={loading}
            draftFilters={draftFilters}
            desktopFilterConfig={desktopFilterConfig}
            mobileFilterConfig={mobileFilterConfig}
            filterDrawerOpen={filterDrawerOpen}
            setFilterDrawerOpen={setFilterDrawerOpen}
            handleAdd={handleAdd}
            handleExport={handleExport}
            setSettingsOpen={setSettingsOpen}
            setImportWizardOpen={setImportWizardOpen}
            selectedIds={selectedIds}
            batchLoading={batchLoading}
            handleBulkDelete={handleBulkDelete}
          />
        }
      >
        <div className="table-wrapper dorm-table-wrapper">
          <BuildingTablePane
            isMobile={isMobile}
            loading={loading}
            data={data}
            resizableColumns={resizableColumns}
            selectedIds={selectedIds}
            setSelectedIds={setSelectedIds}
            pagination={pagination}
            handleTableChange={handleTableChange}
          />
        </div>
        </PageLayout>
      </div>

      <BuildingFormModal
        open={isModalVisible}
        onClose={() => setIsModalVisible(false)}
        onOk={() => {
          void handleModalOk();
        }}
        form={form}
        isMobile={isMobile}
        isEditing={Boolean(editingId)}
      />

      <BuildingDetailModal
        open={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        building={detailBuilding}
        onEdit={handleEdit}
      />

      <TableFieldSettings
        open={settingsOpen}
        columns={buildingColumns.length > 0 ? buildingColumns : initialColumns}
        onClose={() => setSettingsOpen(false)}
        onSave={async (columns) => {
          await saveBuildingColumns(
            columns.map((column) => ({
              ...column,
              key: column.key !== undefined ? String(column.key) : undefined,
            })) as ConfigurableBuildingColumn[],
          );
          setSettingsOpen(false);
        }}
        onReset={resetBuildingColumns}
        saving={columnSaving}
        title="楼栋列表字段设置"
      />

      <BuildingActionSheet
        open={actionSheetOpen}
        onClose={() => setActionSheetOpen(false)}
        selectedIds={selectedIds}
        data={data}
        onView={handleView}
        onEdit={handleEdit}
        onBulkDelete={() => {
          void handleBulkDelete();
        }}
      />

      <BuildingFloatingActions
        isMobile={isMobile}
        selectedIds={selectedIds}
        fabOpen={fabOpen}
        setFabOpen={setFabOpen}
        handleAdd={handleAdd}
        handleExport={handleExport}
        setImportWizardOpen={setImportWizardOpen}
      />

      <LazyImportWizardModal
        open={importWizardOpen}
        onClose={() => {
          setImportWizardOpen(false);
          setReloadFlag((prev) => prev + 1);
        }}
        config={BUILDING_IMPORT_CONFIG}
      />
    </>
  );
}
