import type { Dispatch, Key, SetStateAction } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Alert,
  App,
  Button,
  Col,
  FloatButton,
  Form,
  Input,
} from 'antd';
import {
  DeleteOutlined,
  ExportOutlined,
  FilterOutlined,
  ImportOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  SettingOutlined,
  TeamOutlined,
} from '@ant-design/icons';

import { useAppContext } from '../context/AppContext';
import TableFieldSettings from '../components/TableFieldSettings';
import PageLayout from '../components/PageLayout';
import ResponsiveDataView from '../components/ResponsiveDataView';
import AppleStatCard from '../components/common/AppleStatCard';
import PermissionDeniedState from '../components/common/PermissionDeniedState';
import { teacherManagementPermissionPreset } from '../components/common/permissionDeniedPresets';
import CollapsibleStatsBoard, {
  type StatSegment,
} from '../components/stats/CollapsibleStatsBoard';
import FilterDropdownPanel from '../components/common/FilterDropdownPanel';
import MobileAdvancedFilter from '../components/common/MobileAdvancedFilter';
import LazyImportWizardModal from '../components/common/LazyImportWizardModal';
import { prefetchImportWizardModal } from '../components/common/importWizardPrefetch';
import { TEACHER_IMPORT_CONFIG } from '../constants/importConfigs';
import { useTableColumns } from '../hooks/useTableColumns';
import { useResizableColumns } from '../hooks/useResizableColumns';
import { useMobile } from '../hooks/useMobile';
import { useTableFetch } from '../hooks/useTableFetch';
import { useTableState } from '../hooks/useTableState';
import { useBulkSelection } from '../hooks/useBulkSelection';
import {
  TEACHER_DEFAULT_COLUMNS,
  TEACHER_FILTER_KEYS,
  TEACHER_TABLE_KEY,
  TeacherActionSheet,
  TeacherFormModal,
  TeacherMobileCard,
  buildTeacherTableParams,
  getUniqueDepartments,
  initialTeacherForm,
  useTeacherActions,
  useTeacherColumns,
} from './teacher';

import type {
  EntityId,
  ServiceQueryParams,
  ServiceRecord,
} from '../types/service';
import type { PaginationState, TableResponse, UseTableStateResult } from '../types/table';
import type {
  TeacherColumnConfig,
  TeacherFilters,
  TeacherFormValues,
  TeacherPageActions,
  TeacherRecord,
} from './teacher/types';

interface TeacherTableStateResult
  extends Omit<UseTableStateResult, 'draftFilters' | 'appliedFilters' | 'setDraftFilters'> {
  draftFilters: TeacherFilters;
  appliedFilters: TeacherFilters;
  setDraftFilters: Dispatch<SetStateAction<TeacherFilters>>;
}

function toTeacherTableStateResult(
  state: UseTableStateResult,
): TeacherTableStateResult {
  return {
    ...state,
    draftFilters: state.draftFilters as TeacherFilters,
    appliedFilters: state.appliedFilters as TeacherFilters,
    setDraftFilters:
      state.setDraftFilters as Dispatch<SetStateAction<TeacherFilters>>,
  };
}

interface TeacherFilterOption {
  key: string;
  label: string;
  options: Array<{ label: string; value: string }>;
  value: string[];
  onChange: (values: string[]) => void;
}

interface TeacherStatsProps {
  total: number;
}

interface TeacherFiltersPanelProps {
  isMobile: boolean;
  draftSearchTerm: string;
  setDraftSearchTerm: Dispatch<SetStateAction<string>>;
  handleSearch: () => void;
  handleResetFilters: () => void;
  isDirty: boolean;
  loading: boolean;
  canManage: boolean;
  canImport: boolean;
  canExport: boolean;
  filterOptions: TeacherFilterOption[];
  selectedCount: number;
  selectAcrossPages: boolean;
  pagination: PaginationState;
  total: number;
  currentPageCount: number;
  batchLoading: boolean;
  openCreateModal: () => void;
  openImportWizard: () => void;
  openSettings: () => void;
  onExport: () => void;
  onBulkDelete: () => void;
  onSelectAllResults: () => void;
  onClearSelection: () => void;
  setAdvancedFilterOpen: Dispatch<SetStateAction<boolean>>;
}

interface TeacherTableSectionProps {
  fetchError: string | null;
  onRetryLoad: () => void;
  isMobile: boolean;
  hasActiveFilter: boolean;
  tableData: TableResponse<TeacherRecord>;
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

interface TeacherFloatingActionsProps {
  isMobile: boolean;
  selectedCount: number;
  canManage: boolean;
  canImport: boolean;
  canExport: boolean;
  openCreateModal: () => void;
  openImportWizard: () => void;
  onExport: () => void;
}

type ResizableTeacherColumn = ServiceRecord & {
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

function hasEntityId(value: EntityId | undefined | null): value is EntityId {
  return value !== undefined && value !== null;
}

function TeacherStats({ total }: TeacherStatsProps) {
  return (
    <Col xs={12} sm={12} md={6}>
      <AppleStatCard
        icon={<TeamOutlined />}
        value={total}
        label="教职工总数"
        dotColor="blue"
      />
    </Col>
  );
}

function mapTeacherStatsToSegments(total: number): StatSegment[] {
  return [
    {
      id: 'teacher-total',
      icon: <TeamOutlined />,
      value: total,
      label: '教职工',
      tone: 'blue',
    },
  ];
}

function TeacherFiltersPanel({
  isMobile,
  draftSearchTerm,
  setDraftSearchTerm,
  handleSearch,
  handleResetFilters,
  isDirty,
  loading,
  canManage,
  canImport,
  canExport,
  filterOptions,
  selectedCount,
  selectAcrossPages,
  pagination,
  total,
  currentPageCount,
  batchLoading,
  openCreateModal,
  openImportWizard,
  openSettings,
  onExport,
  onBulkDelete,
  onSelectAllResults,
  onClearSelection,
  setAdvancedFilterOpen,
}: TeacherFiltersPanelProps) {
  return (
    <div className="flex flex-col gap-3">
      {isMobile ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Input
              placeholder="搜索教职工..."
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
              onClick={() => setAdvancedFilterOpen(true)}
              className="h-10 min-w-[44px] rounded-xl border-none bg-gray-100/60 dark:bg-white/5 active:scale-95 transition-all flex items-center justify-center gap-1.5 px-3"
              icon={<FilterOutlined className="text-gray-500 dark:text-gray-400" />}
            >
              {filterOptions[0]?.value.length ? (
                <span className="px-1.5 py-0.5 text-[11px] bg-ios-blue text-white rounded-full min-w-[18px] text-center font-medium">
                  {filterOptions[0].value.length}
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
              placeholder="搜索姓名、工号、院系、部门、班级..."
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
            {canManage ? (
              <Button
                type="primary"
                className="apple-btn-primary dorm-toolbar-button dorm-toolbar-button-primary active:scale-95 transition-all"
                icon={<PlusOutlined />}
                onClick={openCreateModal}
              >
                新增教职工
              </Button>
            ) : null}
            {canImport ? (
              <Button
                className="dorm-toolbar-button dorm-toolbar-button-subtle active:scale-95 transition-all"
                icon={<ImportOutlined />}
                onClick={openImportWizard}
                onMouseEnter={prefetchImportWizardModal}
                onFocus={prefetchImportWizardModal}
                onTouchStart={prefetchImportWizardModal}
              >
                导入
              </Button>
            ) : null}
            {canExport ? (
              <Button
                className="dorm-toolbar-button dorm-toolbar-button-subtle active:scale-95 transition-all"
                icon={<ExportOutlined />}
                onClick={onExport}
              >
                导出
              </Button>
            ) : null}
            <Button
              className="dorm-toolbar-button dorm-toolbar-button-subtle active:scale-95 transition-all"
              icon={<SettingOutlined className="text-gray-600 dark:text-gray-300" />}
              onClick={openSettings}
            >
              字段设置
            </Button>
            {canManage && selectedCount > 0 ? (
              <Button
                danger
                className="dorm-toolbar-button dorm-toolbar-button-danger active:scale-95 transition-all ml-2"
                icon={<DeleteOutlined />}
                loading={batchLoading}
                onClick={onBulkDelete}
              >
                删除 ({selectedCount})
              </Button>
            ) : null}
          </div>
        </div>
      )}

      {!isMobile ? (
        <div className="dorm-toolbar-row dorm-toolbar-row-filters">
          <FilterDropdownPanel filters={filterOptions} onReset={handleResetFilters} />
        </div>
      ) : null}

      {selectedCount > 0 && !isMobile ? (
        <div className="mt-2 flex items-center justify-between p-3 bg-blue-500/10 rounded-2xl border border-blue-500/20">
          <div className="flex items-center gap-3">
            <span className="text-blue-600 font-medium text-sm">
              已选择 {selectedCount} 名教职工
              {selectAcrossPages ? '（全部筛选结果）' : ''}
            </span>
            {pagination.current > 1 || total > currentPageCount ? (
              !selectAcrossPages ? (
                <Button
                  type="link"
                  size="small"
                  className="text-blue-600 font-semibold p-0 h-auto"
                  onClick={onSelectAllResults}
                >
                  全选筛选结果 ({total})
                </Button>
              ) : null
            ) : null}
          </div>
          <Button
            type="link"
            size="small"
            className="text-gray-500 p-0 h-auto"
            onClick={onClearSelection}
          >
            取消选择
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function TeacherTableSection({
  fetchError,
  onRetryLoad,
  isMobile,
  hasActiveFilter,
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
}: TeacherTableSectionProps) {
  const currentPageIds = useMemo(
    () => tableData.items.map((item) => item.id).filter(hasEntityId),
    [tableData.items],
  );

  return (
    <div className="table-wrapper dorm-table-wrapper">
      {fetchError ? (
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
      ) : (
        <ResponsiveDataView<TeacherRecord>
          className="dorm-table"
          isMobile={isMobile}
          dataSource={tableData.items}
          loading={loading}
          rowKey="id"
          columns={resizableColumns}
          rowSelection={{
            selectedRowKeys: selectAcrossPages ? currentPageIds : selectedIds,
            onChange: (keys: Key[]) => {
              setSelectAcrossPages(false);
              setSelectedIds(keys as EntityId[]);
            },
            preserveSelectedRowKeys: true,
          }}
          scroll={{ x: 1000 }}
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
          size="middle"
          resizable={true}
          emptyText={
            <div className="py-20 text-center">
              <TeamOutlined className="text-5xl text-gray-200 mb-3" />
              <p className="text-gray-400 text-sm font-medium tracking-wide">
                {hasActiveFilter ? '没有匹配的教职工' : '还没有教职工'}
              </p>
            </div>
          }
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: tableData.total,
            className: 'apple-pagination px-4 pb-4',
          }}
          onPaginationChange={(page: number, pageSize?: number) => {
            setPagination((prev) => ({
              ...prev,
              current: page,
              pageSize: pageSize || prev.pageSize,
            }));
          }}
          renderCard={(
            teacher: TeacherRecord,
            index: number,
            options: { selected: boolean; onSelect?: (selected: boolean) => void },
          ) => (
            <TeacherMobileCard
              teacher={teacher}
              index={index}
              selected={options.selected}
              onSelect={options.onSelect}
            />
          )}
          selectedKeys={selectAcrossPages ? currentPageIds : selectedIds}
          onSelectChange={(keys: Key[]) => {
            setSelectAcrossPages(false);
            setSelectedIds(keys as EntityId[]);
          }}
        />
      )}
    </div>
  );
}

function TeacherFloatingActions({
  isMobile,
  selectedCount,
  canManage,
  canImport,
  canExport,
  openCreateModal,
  openImportWizard,
  onExport,
}: TeacherFloatingActionsProps) {
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
          {canManage ? (
            <FloatButton icon={<PlusOutlined />} tooltip="新增教职工" onClick={openCreateModal} />
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
            <FloatButton icon={<ExportOutlined />} onClick={onExport} tooltip="导出" />
          ) : null}
        </FloatButton.Group>
      ) : null}
    </>,
    document.body,
  );
}

interface TeacherManagementContentProps {
  canExport: boolean;
  canImport: boolean;
  canManage: boolean;
  handleBulkDelete: () => void;
  handleExport: () => void;
  handleResetFilters: () => void;
  handleRetryLoad: () => void;
  handleSearch: () => void;
  handleTableChange: UseTableStateResult['handleTableChange'];
  hasActiveFilter: boolean;
  isDirty: boolean;
  isMobile: boolean;
  loading: boolean;
  openCreateModal: () => void;
  pagination: PaginationState;
  resizableColumns: ServiceRecord[];
  selectAcrossPages: boolean;
  selectedCount: number;
  selectedIds: EntityId[];
  setAdvancedFilterOpen: Dispatch<SetStateAction<boolean>>;
  setDraftSearchTerm: Dispatch<SetStateAction<string>>;
  setPagination: Dispatch<SetStateAction<PaginationState>>;
  setSelectedIds: Dispatch<SetStateAction<EntityId[]>>;
  setSelectAcrossPages: Dispatch<SetStateAction<boolean>>;
  setImportWizardOpen: Dispatch<SetStateAction<boolean>>;
  setSettingsOpen: Dispatch<SetStateAction<boolean>>;
  tableData: TableResponse<TeacherRecord>;
  draftSearchTerm: string;
  filterOptions: TeacherFilterOption[];
  batchLoading: boolean;
  fetchError: string | null;
  clearSelection: () => void;
  selectAllResults: () => void;
}

function TeacherManagementContent({
  batchLoading,
  canExport,
  canImport,
  canManage,
  clearSelection,
  draftSearchTerm,
  fetchError,
  filterOptions,
  handleBulkDelete,
  handleExport,
  handleResetFilters,
  handleRetryLoad,
  handleSearch,
  handleTableChange,
  hasActiveFilter,
  isDirty,
  isMobile,
  loading,
  openCreateModal,
  pagination,
  resizableColumns,
  selectAcrossPages,
  selectAllResults,
  selectedCount,
  selectedIds,
  setAdvancedFilterOpen,
  setDraftSearchTerm,
  setPagination,
  setSelectedIds,
  setSelectAcrossPages,
  setImportWizardOpen,
  setSettingsOpen,
  tableData,
}: TeacherManagementContentProps) {
  return (
    <div className="management-theme-page">
      <PageLayout
        statsLayout="custom"
        stats={
          <CollapsibleStatsBoard
            expandedContent={<TeacherStats total={tableData.total || 0} />}
            segments={mapTeacherStatsToSegments(tableData.total || 0)}
          />
        }
        filters={
          <TeacherFiltersPanel
            isMobile={isMobile}
            draftSearchTerm={draftSearchTerm}
            setDraftSearchTerm={setDraftSearchTerm}
            handleSearch={handleSearch}
            handleResetFilters={handleResetFilters}
            isDirty={isDirty}
            loading={loading}
            canManage={canManage}
            canImport={canImport}
            canExport={canExport}
            filterOptions={filterOptions}
            selectedCount={selectedCount}
            selectAcrossPages={selectAcrossPages}
            pagination={pagination}
            total={tableData.total}
            currentPageCount={tableData.items.length}
            batchLoading={batchLoading}
            openCreateModal={openCreateModal}
            openImportWizard={() => setImportWizardOpen(true)}
            openSettings={() => setSettingsOpen(true)}
            onExport={handleExport}
            onBulkDelete={handleBulkDelete}
            onSelectAllResults={selectAllResults}
            onClearSelection={clearSelection}
            setAdvancedFilterOpen={setAdvancedFilterOpen}
          />
        }
      >
        <TeacherTableSection
          fetchError={fetchError}
          onRetryLoad={handleRetryLoad}
          isMobile={isMobile}
          hasActiveFilter={hasActiveFilter}
          tableData={tableData}
          loading={loading}
          resizableColumns={resizableColumns}
          selectAcrossPages={selectAcrossPages}
          selectedIds={selectedIds}
          setSelectAcrossPages={setSelectAcrossPages}
          setSelectedIds={setSelectedIds}
          handleTableChange={handleTableChange}
          pagination={pagination}
          setPagination={setPagination}
        />
      </PageLayout>
    </div>
  );
}

interface TeacherManagementOverlaysProps {
  actionSheetOpen: boolean;
  advancedFilterOpen: boolean;
  batchLoading: boolean;
  canEdit: boolean;
  canExport: boolean;
  canImport: boolean;
  canManage: boolean;
  columnSaving: boolean;
  filterOptions: TeacherFilterOption[];
  form: ReturnType<typeof Form.useForm<TeacherFormValues>>[0];
  handleBulkDelete: () => void;
  handleExport: () => void;
  handleResetFilters: () => void;
  importWizardOpen: boolean;
  isMobile: boolean;
  openCreateModal: () => void;
  resetTeacherColumns: () => Promise<void>;
  saveTeacherColumns: (columns: TeacherColumnConfig[]) => Promise<void>;
  selectedCount: number;
  selectedIds: EntityId[];
  setActionSheetOpen: Dispatch<SetStateAction<boolean>>;
  setAdvancedFilterOpen: Dispatch<SetStateAction<boolean>>;
  setImportWizardOpen: Dispatch<SetStateAction<boolean>>;
  setReloadFlag: Dispatch<SetStateAction<number>>;
  setSettingsOpen: Dispatch<SetStateAction<boolean>>;
  settingsOpen: boolean;
  teacherActions: ReturnType<typeof useTeacherActions>;
  teacherColumns: TeacherColumnConfig[];
  tableData: TableResponse<TeacherRecord>;
}

function TeacherManagementOverlays({
  actionSheetOpen,
  advancedFilterOpen,
  batchLoading,
  canEdit,
  canExport,
  canImport,
  canManage,
  columnSaving,
  filterOptions,
  form,
  handleBulkDelete,
  handleExport,
  handleResetFilters,
  importWizardOpen,
  isMobile,
  openCreateModal,
  resetTeacherColumns,
  saveTeacherColumns,
  selectedCount,
  selectedIds,
  setActionSheetOpen,
  setAdvancedFilterOpen,
  setImportWizardOpen,
  setReloadFlag,
  setSettingsOpen,
  settingsOpen,
  teacherActions,
  teacherColumns,
  tableData,
}: TeacherManagementOverlaysProps) {
  return (
    <>
      <TeacherFloatingActions
        isMobile={isMobile}
        selectedCount={selectedCount}
        canManage={canManage}
        canImport={canImport}
        canExport={canExport}
        openCreateModal={openCreateModal}
        openImportWizard={() => setImportWizardOpen(true)}
        onExport={handleExport}
      />

      <MobileAdvancedFilter
        open={advancedFilterOpen}
        onClose={() => setAdvancedFilterOpen(false)}
        title="筛选教职工"
        onReset={handleResetFilters}
        filters={filterOptions}
      />

      <TableFieldSettings
        open={settingsOpen}
        columns={teacherColumns}
        onClose={() => setSettingsOpen(false)}
        onSave={async (columns: unknown) => {
          await saveTeacherColumns(columns as TeacherColumnConfig[]);
          setSettingsOpen(false);
        }}
        onReset={resetTeacherColumns}
        saving={columnSaving}
        title="教职工列表字段设置"
      />

      <TeacherFormModal
        open={teacherActions.modalOpen}
        isMobile={isMobile}
        editingId={teacherActions.editingId}
        form={form}
        onClose={() => teacherActions.closeModal(form)}
        onSubmit={async (values: TeacherFormValues) => {
          const success = await teacherActions.handleFormSubmit(values);
          if (success) {
            form.resetFields();
            form.setFieldsValue(initialTeacherForm);
          }
        }}
      />

      <TeacherActionSheet
        open={actionSheetOpen}
        onClose={() => setActionSheetOpen(false)}
        selectedIds={selectedIds}
        items={tableData.items}
        canEdit={canEdit}
        batchLoading={batchLoading}
        onEdit={(teacher: TeacherRecord) => teacherActions.openModal(teacher, form)}
        onBulkDelete={handleBulkDelete}
      />

      <LazyImportWizardModal
        open={importWizardOpen}
        onClose={() => {
          setImportWizardOpen(false);
          setReloadFlag((prev) => prev + 1);
        }}
        config={TEACHER_IMPORT_CONFIG}
      />
    </>
  );
}

function useTeacherManagementUi() {
  const [reloadFlag, setReloadFlag] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [actionSheetOpen, setActionSheetOpen] = useState(false);
  const [advancedFilterOpen, setAdvancedFilterOpen] = useState(false);
  const [importWizardOpen, setImportWizardOpen] = useState(false);

  return {
    actionSheetOpen,
    advancedFilterOpen,
    importWizardOpen,
    reloadFlag,
    setActionSheetOpen,
    setAdvancedFilterOpen,
    setImportWizardOpen,
    setReloadFlag,
    setSettingsOpen,
    settingsOpen,
  };
}

function useTeacherTableSettings(teacherPageActions: TeacherPageActions) {
  return useTableColumns<TeacherColumnConfig>({
    tableKey: TEACHER_TABLE_KEY,
    defaultColumns: TEACHER_DEFAULT_COLUMNS,
    fetchConfig: teacherPageActions.fetchTableConfig
      ? async (tableKey) =>
          (await teacherPageActions.fetchTableConfig?.(tableKey)) as
            | { config?: TeacherColumnConfig[] }
            | null
            | undefined
      : undefined,
    saveConfig: teacherPageActions.saveTableConfig
      ? async (tableKey, columns) =>
          teacherPageActions.saveTableConfig?.(tableKey, columns)
      : undefined,
  });
}

function getTeacherPermissions(hasPermission: (permission: string) => boolean) {
  const canManage = hasPermission('TEACHER_MANAGE');
  return {
    canManage,
    canImport: hasPermission('TEACHER_IMPORT') || canManage,
    canExport: hasPermission('TEACHER_EXPORT') || canManage,
    canEdit: canManage,
  };
}

export default function TeacherManagementPage() {
  const { actions, hasPermission, setSelection } = useAppContext();
  const teacherPageActions = actions as TeacherPageActions;
  const { message: messageApi } = App.useApp();
  const isMobile = useMobile();
  const [form] = Form.useForm<TeacherFormValues>();
  const uiState = useTeacherManagementUi();

  const {
    selectedIds,
    selectAcrossPages,
    batchLoading,
    setSelectedIds,
    setSelectAcrossPages,
    setBatchLoading,
    selectAllResults,
    clearSelection,
    getSelectionCount,
  } = useBulkSelection<EntityId>();

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
  } = toTeacherTableStateResult(
    useTableState({
      filterKeys: TEACHER_FILTER_KEYS,
      defaultSortField: 'employeeNo',
      defaultSortOrder: 'asc',
      defaultPageSize: 10,
      syncUrl: true,
      normalizers: {},
      onApply: clearSelection,
      onReset: clearSelection,
    }),
  );

  const { canManage, canImport, canExport, canEdit } =
    getTeacherPermissions(hasPermission);

  const fetchTeacherTable = teacherPageActions.fetchTeacherTable;
  const {
    data: tableData,
    loading,
    error: fetchError,
  } = useTableFetch<TeacherRecord>({
    fetchFn: async (
      params: Record<string, unknown>,
      options?: { signal?: AbortSignal },
    ): Promise<TableResponse<TeacherRecord>> => {
      if (!fetchTeacherTable) {
        return { items: [], total: 0 };
      }

      return fetchTeacherTable(params as ServiceQueryParams, options);
    },
    buildParams: () =>
      buildTeacherTableParams(
        appliedFilters,
        appliedSearchTerm,
        pagination,
        sortField,
        sortOrder,
        true,
      ) as ServiceQueryParams,
    enabled: canManage && Boolean(fetchTeacherTable),
    onSuccess: (result) => {
      setPagination((prev) => ({ ...prev, total: result.total || 0 }));
    },
    onError: (error) => {
      console.error('获取教职工列表失败:', error);
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

  const teacherActions = useTeacherActions({
    actions: teacherPageActions,
    messageApi,
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
    setBatchLoading,
    setReloadFlag: uiState.setReloadFlag,
    canManage,
    canExport,
    tableTotal: tableData.total,
  });

  const {
    columns: teacherColumns,
    visibleColumns: visibleTeacherColumns,
    saving: columnSaving,
    save: saveTeacherColumns,
    resetToDefault: resetTeacherColumns,
  } = useTeacherTableSettings(teacherPageActions);

  const columnsFromHook = useTeacherColumns({
    visibleColumns: visibleTeacherColumns,
    sortField,
    sortOrder,
    canEdit,
    onEdit: (record) => teacherActions.openModal(record, form),
    onDelete: (record) => {
      void teacherActions.handleSingleDelete(record);
    },
    batchLoading,
  });
  const resizableColumnInput = useMemo<ResizableTeacherColumn[]>(
    () =>
      columnsFromHook.map((column) => ({
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
    [columnsFromHook],
  );
  const { columns: resizableColumns } = useResizableColumns(
    resizableColumnInput,
    {
      minWidth: 60,
      maxWidth: 400,
    },
  );

  const selectedCount = selectAcrossPages ? tableData.total : selectedIds.length;
  const currentPage = pagination.current;
  const currentPageSize = pagination.pageSize;

  useEffect(() => {
    if (!isMobile) {
      return;
    }

    setSelection({
      count: selectedCount,
      onClear: clearSelection,
      onAction: () => uiState.setActionSheetOpen(true),
      actionLabel: '操作',
    });
  }, [clearSelection, isMobile, selectedCount, setSelection, uiState]);

  useEffect(() => {
    if (!loading && tableData.total > 0 && currentPage > 1) {
      const maxPage = Math.ceil(tableData.total / currentPageSize);
      if (currentPage > maxPage) {
        setPagination((prev) => ({ ...prev, current: maxPage }));
      }
    }
  }, [currentPage, currentPageSize, loading, setPagination, tableData.total]);

  const uniqueDepartments = useMemo(
    () => getUniqueDepartments(tableData.items),
    [tableData.items],
  );

  const handleResetFilters = useCallback((): void => {
    resetTableState();
    clearSelection();
  }, [clearSelection, resetTableState]);

  const handleRetryLoad = useCallback((): void => {
    uiState.setReloadFlag((prev) => prev + 1);
  }, [uiState]);

  const openCreateModal = useCallback((): void => {
    teacherActions.openModal(null, form);
  }, [form, teacherActions]);

  const handleExport = useCallback((): void => {
    void teacherActions.handleExport();
  }, [teacherActions]);

  const handleBulkDelete = useCallback((): void => {
    void teacherActions.handleBulkDelete();
  }, [teacherActions]);

  const filterOptions = useMemo<TeacherFilterOption[]>(
    () => [
      {
        key: 'department',
        label: '院系/部门',
        options: uniqueDepartments.map((department) => ({
          label: department,
          value: department,
        })),
        value: draftFilters.department || [],
        onChange: (values) => {
          setDraftFilters((prev) => ({
            ...prev,
            department: values,
          }));
        },
      },
    ],
    [draftFilters.department, setDraftFilters, uniqueDepartments],
  );

  if (!canManage) {
    return (
      <div className="management-theme-page">
        <PermissionDeniedState {...teacherManagementPermissionPreset} />
      </div>
    );
  }

  return (
    <>
      <TeacherManagementContent
        batchLoading={batchLoading}
        canExport={canExport}
        canImport={canImport}
        canManage={canManage}
        clearSelection={clearSelection}
        draftSearchTerm={draftSearchTerm}
        fetchError={fetchError}
        filterOptions={filterOptions}
        handleBulkDelete={handleBulkDelete}
        handleExport={handleExport}
        handleResetFilters={handleResetFilters}
        handleRetryLoad={handleRetryLoad}
        handleSearch={handleSearch}
        handleTableChange={handleTableChange}
        hasActiveFilter={
          Boolean(appliedSearchTerm.trim()) ||
          Boolean(appliedFilters.department?.length)
        }
        isDirty={isDirty}
        isMobile={isMobile}
        loading={loading}
        openCreateModal={openCreateModal}
        pagination={pagination}
        resizableColumns={resizableColumns}
        selectAcrossPages={selectAcrossPages}
        selectAllResults={selectAllResults}
        selectedCount={selectedCount}
        selectedIds={selectedIds}
        setAdvancedFilterOpen={uiState.setAdvancedFilterOpen}
        setDraftSearchTerm={setDraftSearchTerm}
        setImportWizardOpen={uiState.setImportWizardOpen}
        setPagination={setPagination}
        setSelectedIds={setSelectedIds}
        setSelectAcrossPages={setSelectAcrossPages}
        setSettingsOpen={uiState.setSettingsOpen}
        tableData={tableData}
      />

      <TeacherManagementOverlays
        actionSheetOpen={uiState.actionSheetOpen}
        advancedFilterOpen={uiState.advancedFilterOpen}
        batchLoading={batchLoading}
        canEdit={canEdit}
        canExport={canExport}
        canImport={canImport}
        canManage={canManage}
        columnSaving={columnSaving}
        filterOptions={filterOptions}
        form={form}
        handleBulkDelete={handleBulkDelete}
        handleExport={handleExport}
        handleResetFilters={handleResetFilters}
        importWizardOpen={uiState.importWizardOpen}
        isMobile={isMobile}
        openCreateModal={openCreateModal}
        resetTeacherColumns={resetTeacherColumns}
        saveTeacherColumns={saveTeacherColumns}
        selectedCount={selectedCount}
        selectedIds={selectedIds}
        setActionSheetOpen={uiState.setActionSheetOpen}
        setAdvancedFilterOpen={uiState.setAdvancedFilterOpen}
        setImportWizardOpen={uiState.setImportWizardOpen}
        setReloadFlag={uiState.setReloadFlag}
        setSettingsOpen={uiState.setSettingsOpen}
        settingsOpen={uiState.settingsOpen}
        teacherActions={teacherActions}
        teacherColumns={teacherColumns}
        tableData={tableData}
      />
    </>
  );
}
