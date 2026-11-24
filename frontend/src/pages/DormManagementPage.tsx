import type { Dispatch, Key, SetStateAction } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Alert,
  Button,
  Col,
  FloatButton,
  Form,
  Input,
  Pagination,
  Segmented,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  AppstoreOutlined,
  BankOutlined,
  BarsOutlined,
  DeleteOutlined,
  ExportOutlined,
  FilterOutlined,
  ImportOutlined,
  ManOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  SettingOutlined,
  TableOutlined,
  TeamOutlined,
} from '@ant-design/icons';

import { useBuildings } from '../hooks/useInfraQuery';
import { useAppContext } from '../context/AppContext';
import { useTableColumns } from '../hooks/useTableColumns';
import { useResizableColumns } from '../hooks/useResizableColumns';
import { useMobile } from '../hooks/useMobile';
import { useTableFetch } from '../hooks/useTableFetch';
import { useTableState } from '../hooks/useTableState';
import { useBulkSelection } from '../hooks/useBulkSelection';
import GlassTable from '../components/GlassTable';
import AppleStatCard from '../components/common/AppleStatCard';
import DormGridSelector from '../components/DormGridSelector';
import ResponsiveDataView from '../components/ResponsiveDataView';
import TableFieldSettings from '../components/TableFieldSettings';
import PageLayout from '../components/PageLayout';
import PermissionDeniedState from '../components/common/PermissionDeniedState';
import { dormManagementPermissionPreset } from '../components/common/permissionDeniedPresets';
import CollapsibleStatsBoard, {
  type StatSegment,
} from '../components/stats/CollapsibleStatsBoard';
import FilterDropdownPanel from '../components/common/FilterDropdownPanel';
import MobileAdvancedFilter from '../components/common/MobileAdvancedFilter';
import RoomOccupancyCard from '../components/RoomOccupancyCard';
import BedDetailModal from '../components/BedDetailModal';
import LazyImportWizardModal from '../components/common/LazyImportWizardModal';
import { prefetchImportWizardModal } from '../components/common/importWizardPrefetch';
import { DORM_IMPORT_CONFIG } from '../constants/importConfigs';
import { PAGINATION_SIZE_CHANGER_PROPS } from '../utils/pagination';
import {
  DORM_DEFAULT_COLUMNS,
  DORM_TABLE_KEY,
  calculateDormStats,
  createActionColumn,
  createBaseColumns,
  createDesktopFilterConfig,
  createMobileFilterConfig,
  buildDormTableParams,
  DormActionSheet,
  DormDetailModal,
  DormEditModal,
  DormFormModal,
  DormMobileCard,
  getFilterCount,
  mapRoomToBeds,
  normalizeDormGender,
  useDormActions,
} from './dorm';

import type { EntityId, ServiceQueryParams, ServiceRecord } from '../types/service';
import type { PaginationState, UseTableStateResult } from '../types/table';
import type {
  BuildingRecord,
  DormColumnConfig,
  DormFiltersState,
  DormFormPayload,
  DormPageActions,
  DormPageData,
  DormRecord,
  DormStatsState,
  DormViewMode,
} from './dorm/types';

interface BuildingQueryData {
  items?: BuildingRecord[];
  buildings?: BuildingRecord[];
}

type ResizableDormColumn = ColumnsType<DormRecord>[number] & {
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

interface DormTableStateResult
  extends Omit<UseTableStateResult, 'draftFilters' | 'appliedFilters' | 'setDraftFilters'> {
  draftFilters: DormFiltersState;
  appliedFilters: DormFiltersState;
  setDraftFilters: Dispatch<SetStateAction<DormFiltersState>>;
}

function toDormTableStateResult(
  state: UseTableStateResult,
): DormTableStateResult {
  return {
    ...state,
    draftFilters: state.draftFilters as DormFiltersState,
    appliedFilters: state.appliedFilters as DormFiltersState,
    setDraftFilters:
      state.setDraftFilters as Dispatch<SetStateAction<DormFiltersState>>,
  };
}

interface DormStatsCardsProps {
  dormStats: DormStatsState;
}

interface DormFiltersBarProps {
  isMobile: boolean;
  draftSearchTerm: string;
  setDraftSearchTerm: Dispatch<SetStateAction<string>>;
  handleSearch: () => void;
  handleResetFilters: () => void;
  isDirty: boolean;
  loading: boolean;
  filterCount: number;
  desktopFilterConfig: ReturnType<typeof createDesktopFilterConfig>;
  setAdvancedFilterOpen: Dispatch<SetStateAction<boolean>>;
  viewMode: DormViewMode;
  setViewMode: Dispatch<SetStateAction<DormViewMode>>;
  canEdit: boolean;
  canImport: boolean;
  canExport: boolean;
  setModalOpen: Dispatch<SetStateAction<boolean>>;
  setSettingsOpen: Dispatch<SetStateAction<boolean>>;
  setImportWizardOpen: Dispatch<SetStateAction<boolean>>;
  handleExport: () => Promise<void>;
  handleBulkDelete: () => Promise<void>;
  batchLoading: boolean;
  selectedCount: number;
  selectAcrossPages: boolean;
  tableDataTotal: number;
  currentPage: number;
  currentPageItemCount: number;
  selectAllResults: () => void;
  clearSelection: () => void;
}

interface DormContentPaneProps {
  emptyText: string;
  fetchError: string | null;
  isMobile: boolean;
  tableData: { items: DormRecord[]; total: number };
  selectedIds: EntityId[];
  selectAcrossPages: boolean;
  canEdit: boolean;
  loading: boolean;
  pagination: PaginationState;
  setPagination: Dispatch<SetStateAction<PaginationState>>;
  handleTableChange: UseTableStateResult['handleTableChange'];
  viewMode: DormViewMode;
  resizableColumns: ColumnsType<DormRecord>;
  setReloadFlag: Dispatch<SetStateAction<number>>;
  setSelectedIds: Dispatch<SetStateAction<EntityId[]>>;
  setSelectAcrossPages: Dispatch<SetStateAction<boolean>>;
  handleViewDetail: (record: DormRecord) => void;
  handleOpenEditModal: (record: DormRecord) => void;
  handleDeleteSingle: (id: EntityId) => Promise<void>;
  handleBedClick: (bed: ServiceRecord, room: DormRecord) => void;
}

interface DormFloatingActionsProps {
  isMobile: boolean;
  selectedIds: EntityId[];
  canEdit: boolean;
  canImport: boolean;
  canExport: boolean;
  setModalOpen: Dispatch<SetStateAction<boolean>>;
  setImportWizardOpen: Dispatch<SetStateAction<boolean>>;
  handleExport: () => Promise<void>;
}

interface DormManagementContentProps {
  batchLoading: boolean;
  canEdit: boolean;
  canExport: boolean;
  canImport: boolean;
  clearSelection: () => void;
  desktopFilterConfig: ReturnType<typeof createDesktopFilterConfig>;
  dormStats: DormStatsState;
  draftSearchTerm: string;
  emptyText: string;
  fetchError: string | null;
  filterCount: number;
  handleBedClick: (bed: ServiceRecord, room: DormRecord) => void;
  handleBulkDelete: () => Promise<void>;
  handleDeleteSingle: (id: EntityId) => Promise<void>;
  handleExport: () => Promise<void>;
  handleViewDetail: (record: DormRecord) => void;
  handleOpenEditModal: (record: DormRecord) => void;
  handleResetFilters: () => void;
  handleSearch: () => void;
  handleTableChange: UseTableStateResult['handleTableChange'];
  isDirty: boolean;
  isMobile: boolean;
  loading: boolean;
  normalizedTableData: { items: DormRecord[]; total: number };
  pagination: PaginationState;
  resizableColumns: ColumnsType<DormRecord>;
  selectAcrossPages: boolean;
  selectAllResults: () => void;
  selectedCount: number;
  selectedIds: EntityId[];
  setAdvancedFilterOpen: Dispatch<SetStateAction<boolean>>;
  setDraftSearchTerm: Dispatch<SetStateAction<string>>;
  setImportWizardOpen: Dispatch<SetStateAction<boolean>>;
  setModalOpen: Dispatch<SetStateAction<boolean>>;
  setPagination: Dispatch<SetStateAction<PaginationState>>;
  setReloadFlag: Dispatch<SetStateAction<number>>;
  setSelectedIds: Dispatch<SetStateAction<EntityId[]>>;
  setSelectAcrossPages: Dispatch<SetStateAction<boolean>>;
  setSettingsOpen: Dispatch<SetStateAction<boolean>>;
  setViewMode: Dispatch<SetStateAction<DormViewMode>>;
  viewMode: DormViewMode;
}

interface DormManagementOverlaysProps {
  actionSheetOpen: boolean;
  advancedFilterOpen: boolean;
  batchLoading: boolean;
  bedModalOpen: boolean;
  buildingOptions: Array<{ value?: string; label?: string; campus?: string }>;
  canEdit: boolean;
  canExport: boolean;
  canImport: boolean;
  detailDorm: DormRecord | null;
  detailModalOpen: boolean;
  dormColumns: DormColumnConfig[];
  editForm: ReturnType<typeof Form.useForm<DormFormPayload>>[0];
  editModalOpen: boolean;
  editingDorm: DormRecord | null;
  form: ReturnType<typeof Form.useForm<DormFormPayload>>[0];
  handleBulkDelete: () => Promise<void>;
  handleEditSubmit: (payload: DormFormPayload) => Promise<void>;
  handleExport: () => Promise<void>;
  handleFormSubmit: (payload: DormFormPayload) => Promise<void>;
  handleOpenEditModal: (record: DormRecord) => void;
  handleViewDetail: (record: DormRecord) => void;
  importWizardOpen: boolean;
  isMobile: boolean;
  handleResetFilters: () => void;
  handleSearch: () => void;
  mobileFilterConfig: ReturnType<typeof createMobileFilterConfig>;
  modalOpen: boolean;
  normalizedTableData: { items: DormRecord[]; total: number };
  onCloseDetail: () => void;
  onCloseEditModal: () => void;
  resetDormColumns: () => Promise<void>;
  saveDormColumns: (columns: DormColumnConfig[]) => Promise<void>;
  savingDormColumns: boolean;
  selectedBed: ServiceRecord | null;
  selectedIds: EntityId[];
  selectedRoom: DormRecord | null;
  selectAcrossPages: boolean;
  selectAllResults: () => void;
  setActionSheetOpen: Dispatch<SetStateAction<boolean>>;
  setAdvancedFilterOpen: Dispatch<SetStateAction<boolean>>;
  setBedModalOpen: Dispatch<SetStateAction<boolean>>;
  setImportWizardOpen: Dispatch<SetStateAction<boolean>>;
  setModalOpen: Dispatch<SetStateAction<boolean>>;
  setReloadFlag: Dispatch<SetStateAction<number>>;
  setSettingsOpen: Dispatch<SetStateAction<boolean>>;
  settingsOpen: boolean;
}

function toArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function hasEntityId(value: EntityId | undefined | null): value is EntityId {
  return value !== undefined && value !== null;
}

function sortStrings(values: Array<string | undefined | null>): string[] {
  return [...new Set(values.filter(Boolean).map((value) => String(value)))].sort((left, right) =>
    left.localeCompare(right, 'zh-CN'),
  );
}

function sortFloors(values: Array<string | number | undefined | null>): Array<string | number> {
  return [...new Set(values.filter((value) => value !== null && value !== undefined))].sort(
    (left, right) => Number(left) - Number(right),
  );
}

function DormStatsCards({ dormStats }: DormStatsCardsProps) {
  return (
    <>
      <Col xs={12} sm={12} md={6} className="dorm-stat-col">
        <AppleStatCard icon={<BankOutlined />} value={dormStats.total} label="宿舍总数" unit="间" dotColor="blue" />
      </Col>
      <Col xs={12} sm={12} md={6} className="dorm-stat-col">
        <AppleStatCard icon={<AppstoreOutlined />} value={dormStats.capacitySum} label="总床位数" unit="床" dotColor="green" />
      </Col>
      <Col xs={12} sm={12} md={6} className="dorm-stat-col">
        <AppleStatCard icon={<TeamOutlined />} value={dormStats.occupiedSum} subValue={dormStats.capacitySum} label="已入住 / 容量" unit="人" dotColor="orange" />
      </Col>
      <Col xs={12} sm={12} md={6} className="dorm-stat-col">
        <AppleStatCard icon={<ManOutlined />} value={`${dormStats.maleDorms}/${dormStats.femaleDorms}`} label="男/女分布" unit="间" dotColor="purple" />
      </Col>
    </>
  );
}

function mapDormStatsToSegments(dormStats: DormStatsState): StatSegment[] {
  return [
    {
      id: 'total-dorms',
      icon: <BankOutlined />,
      value: dormStats.total,
      label: '宿舍',
      unit: '间',
      tone: 'blue',
    },
    {
      id: 'capacity',
      icon: <AppstoreOutlined />,
      value: dormStats.capacitySum,
      label: '床位',
      unit: '床',
      tone: 'green',
    },
    {
      id: 'occupancy',
      icon: <TeamOutlined />,
      value: dormStats.occupiedSum,
      secondary: dormStats.capacitySum,
      label: '入住/容量',
      unit: '人',
      tone: 'orange',
    },
    {
      id: 'gender-split',
      icon: <ManOutlined />,
      value: dormStats.maleDorms,
      secondary: dormStats.femaleDorms,
      label: '男/女',
      unit: '间',
      tone: 'purple',
    },
  ];
}

function DormFiltersBar({
  isMobile,
  draftSearchTerm,
  setDraftSearchTerm,
  handleSearch,
  handleResetFilters,
  isDirty,
  loading,
  filterCount,
  desktopFilterConfig,
  setAdvancedFilterOpen,
  viewMode,
  setViewMode,
  canEdit,
  canImport,
  canExport,
  setModalOpen,
  setSettingsOpen,
  setImportWizardOpen,
  handleExport,
  handleBulkDelete,
  batchLoading,
  selectedCount,
  selectAcrossPages,
  tableDataTotal,
  currentPage,
  currentPageItemCount,
  selectAllResults,
  clearSelection,
}: DormFiltersBarProps) {
  return (
    <div className="flex flex-col gap-3">
      {isMobile ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Input
              placeholder="搜索房号、楼栋、学生或教职工"
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
              {filterCount > 0 ? (
                <span className="px-1.5 py-0.5 text-[11px] bg-ios-blue text-white rounded-full min-w-[18px] text-center font-medium">
                  {filterCount}
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
              placeholder="搜索房号、楼栋、学生或教职工"
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
            {canEdit ? (
              <Button
                type="primary"
                className="apple-btn-primary dorm-toolbar-button dorm-toolbar-button-primary active:scale-95 transition-all"
                icon={<PlusOutlined />}
                onClick={() => setModalOpen(true)}
              >
                新增宿舍
              </Button>
            ) : null}
            {canImport ? (
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
            ) : null}
            {canExport ? (
              <Button
                className="dorm-toolbar-button dorm-toolbar-button-subtle active:scale-95 transition-all"
                icon={<ExportOutlined />}
                onClick={() => {
                  void handleExport();
                }}
              >
                导出
              </Button>
            ) : null}
            <Button
              className="dorm-toolbar-button dorm-toolbar-button-subtle active:scale-95 transition-all"
              icon={<SettingOutlined className="text-gray-600 dark:text-gray-300" />}
              onClick={() => setSettingsOpen(true)}
            >
              字段设置
            </Button>
            {canEdit && selectedCount > 0 ? (
              <Button
                danger
                className="dorm-toolbar-button dorm-toolbar-button-danger active:scale-95 transition-all"
                icon={<DeleteOutlined />}
                loading={batchLoading}
                onClick={() => {
                  void handleBulkDelete();
                }}
              >
                删除 ({selectedCount})
              </Button>
            ) : null}
          </div>
        </div>
      )}

      {!isMobile ? (
        <div className="dorm-toolbar-row dorm-toolbar-row-filters">
          <div className="flex-1">
            <FilterDropdownPanel
              filters={desktopFilterConfig.map((filter) => ({
                ...filter,
                onChange: filter.onChange || (() => {}),
              }))}
            />
          </div>
          <div className="dorm-view-switcher">
            <Segmented
              value={viewMode}
              onChange={(value) => setViewMode(value as DormViewMode)}
              className="apple-segmented"
              options={[
                { value: 'list', icon: <BarsOutlined />, label: '列表' },
                { value: 'card', icon: <AppstoreOutlined />, label: '卡片' },
                { value: 'mini', icon: <TableOutlined />, label: '缩略' },
              ]}
            />
          </div>
        </div>
      ) : null}

      {selectedCount > 0 && !isMobile ? (
        <div className="mt-2 flex items-center justify-between p-3 bg-blue-500/10 rounded-2xl border border-blue-500/20">
          <div className="flex items-center gap-3">
            <span className="text-blue-600 font-medium text-sm">
              已选 {selectedCount} 间{selectAcrossPages ? '（全部筛选结果）' : ''}
            </span>
            {(currentPage > 1 || tableDataTotal > currentPageItemCount) && !selectAcrossPages ? (
              <Button
                type="link"
                size="small"
                className="text-blue-600 font-semibold p-0 h-auto"
                onClick={selectAllResults}
              >
                全选筛选结果 ({tableDataTotal})
              </Button>
            ) : null}
          </div>
          <Button type="link" size="small" className="text-gray-500 p-0 h-auto" onClick={clearSelection}>
            取消选择
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function DormContentPane({
  emptyText,
  fetchError,
  isMobile,
  tableData,
  selectedIds,
  selectAcrossPages,
  canEdit,
  loading,
  pagination,
  setPagination,
  handleTableChange,
  viewMode,
  resizableColumns,
  setReloadFlag,
  setSelectedIds,
  setSelectAcrossPages,
  handleViewDetail,
  handleOpenEditModal,
  handleDeleteSingle,
  handleBedClick,
}: DormContentPaneProps) {
  if (fetchError) {
    return (
      <div className="error-state">
        <Alert
          message={fetchError}
          type="error"
          showIcon
          action={
            <Button size="small" onClick={() => setReloadFlag((prev) => prev + 1)}>
              重试
            </Button>
          }
        />
      </div>
    );
  }

  if (isMobile) {
    return (
      <ResponsiveDataView<DormRecord>
        isMobile={true}
        dataSource={tableData.items}
        renderCard={(
          dorm: DormRecord,
          _index: number,
          options: { selected: boolean; onSelect?: (selected: boolean) => void },
        ) => (
          <DormMobileCard
            dorm={dorm}
            selected={options.selected}
            onSelect={options.onSelect}
          />
        )}
        rowKey="id"
        selectedKeys={selectAcrossPages ? tableData.items.map((item) => item.id).filter(hasEntityId) : selectedIds}
        onSelectChange={
          canEdit
            ? (keys: Key[]) => {
                setSelectAcrossPages(false);
                setSelectedIds(keys as EntityId[]);
              }
            : undefined
        }
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
        emptyText={emptyText}
      />
    );
  }

  if (viewMode === 'card') {
    return (
      <div className="dorm-content-view dorm-content-view-card flex flex-col h-full !p-0 overflow-hidden">
        <div className="flex-1 overflow-auto p-4 md:p-6">
          <div className="dorm-card-grid">
            {tableData.items.map((room) => (
              <RoomOccupancyCard
                key={String(room.id)}
                room={room}
                beds={mapRoomToBeds(room).map((bed) => ({
                  ...bed,
                  studentName: bed.studentName ?? undefined,
                  studentNo: 'studentNo' in bed ? bed.studentNo ?? undefined : undefined,
                  gender: bed.gender ?? undefined,
                }))}
                onBedClick={(bed, currentRoom) => handleBedClick(bed as ServiceRecord, currentRoom as DormRecord)}
                canEdit={canEdit}
                onView={(currentRoom) => handleViewDetail(currentRoom as DormRecord)}
                onEdit={(currentRoom) => handleOpenEditModal(currentRoom as DormRecord)}
                onDelete={(id) => {
                  if (hasEntityId(id)) {
                    void handleDeleteSingle(id);
                  }
                }}
                selected={selectedIds.includes(room.id as EntityId)}
                onSelect={(id, selected: boolean) => {
                  if (!hasEntityId(id)) {
                    return;
                  }
                  if (!canEdit) {
                    return;
                  }

                  setSelectAcrossPages(false);
                  const nextKeys = selected
                    ? [...selectedIds, id]
                    : selectedIds.filter((key) => key !== id);
                  setSelectedIds(nextKeys);
                }}
              />
            ))}
          </div>
          {tableData.items.length === 0 ? (
            <div className="text-center py-12 text-gray-400">{emptyText}</div>
          ) : null}
        </div>
        <div className="dorm-pagination-shell">
          <Pagination
            {...pagination}
            size="small"
            onChange={(page, size) => handleTableChange({ current: page, pageSize: size }, null, {})}
            showSizeChanger={PAGINATION_SIZE_CHANGER_PROPS}
            showQuickJumper
            showTotal={(total) => `共 ${total} 条`}
            locale={{ jump_to: '跳至', page: '页', items_per_page: '条/页' }}
          />
        </div>
      </div>
    );
  }

  if (viewMode === 'mini') {
    return (
      <div className="dorm-content-view dorm-content-view-mini flex flex-col h-full !p-0 overflow-hidden">
        <div className="flex-1 overflow-auto p-4 md:p-6">
          <DormGridSelector
            dataSource={tableData.items}
            selectedRowKeys={selectedIds}
            viewMode={viewMode}
            onChange={(newKeys: EntityId[]) => {
              setSelectedIds(newKeys);
              setSelectAcrossPages(false);
            }}
            onCardAction={(action: string, item) => {
              if (action === 'edit') {
                handleOpenEditModal(item as DormRecord);
                return;
              }
              if (action === 'delete' && item.id !== undefined) {
                void handleDeleteSingle(item.id);
              }
            }}
          />
        </div>
        <div className="dorm-pagination-shell">
          <Pagination
            {...pagination}
            size="small"
            onChange={(page, size) => handleTableChange({ current: page, pageSize: size }, null, {})}
            showSizeChanger={PAGINATION_SIZE_CHANGER_PROPS}
            showQuickJumper
            showTotal={(total) => `共 ${total} 条`}
            locale={{ jump_to: '跳至', page: '页', items_per_page: '条/页' }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="dorm-content-view dorm-content-view-list flex-1 overflow-hidden">
      <GlassTable
        className="dorm-table h-full"
        rowSelection={
          canEdit
            ? {
                selectedRowKeys: selectAcrossPages ? tableData.items.map((item) => item.id).filter(hasEntityId) : selectedIds,
                onChange: (keys: Key[]) => {
                  setSelectAcrossPages(false);
                  setSelectedIds(keys as EntityId[]);
                },
                preserveSelectedRowKeys: true,
              }
            : undefined
        }
        columns={resizableColumns}
        dataSource={tableData.items}
        rowKey="id"
        loading={loading}
        pagination={{
          ...pagination,
          showSizeChanger: PAGINATION_SIZE_CHANGER_PROPS,
        }}
        scroll={{ x: 1200, y: 'calc(100% - 90px)' }}
        useSkeleton={true}
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
        locale={{ emptyText }}
        resizable={true}
      />
    </div>
  );
}

function DormFloatingActions({
  isMobile,
  selectedIds,
  canEdit,
  canImport,
  canExport,
  setModalOpen,
  setImportWizardOpen,
  handleExport,
}: DormFloatingActionsProps) {
  if (!isMobile) {
    return null;
  }

  return createPortal(
    <>
      <FloatButton.BackTop style={{ bottom: selectedIds.length > 0 ? 170 : 100, right: 20 }} />
      {selectedIds.length === 0 ? (
        <FloatButton.Group trigger="click" type="primary" style={{ right: 20, bottom: 100 }} icon={<PlusOutlined />} closeIcon={<PlusOutlined rotate={45} />}>
          {canEdit ? <FloatButton icon={<PlusOutlined />} tooltip="新增宿舍" onClick={() => setModalOpen(true)} /> : null}
          {canImport ? (
            <FloatButton
              icon={<ImportOutlined />}
              tooltip="导入"
              onClick={() => setImportWizardOpen(true)}
              onMouseEnter={prefetchImportWizardModal}
              onFocus={prefetchImportWizardModal}
              onTouchStart={prefetchImportWizardModal}
            />
          ) : null}
          {canExport ? <FloatButton icon={<ExportOutlined />} tooltip="导出" onClick={() => { void handleExport(); }} /> : null}
        </FloatButton.Group>
      ) : null}
    </>,
    document.body,
  );
}

function useDormManagementUi({
  clearSelection,
  isMobile,
  selectedIdsLength,
  setSelection,
}: {
  clearSelection: () => void;
  isMobile: boolean;
  selectedIdsLength: number;
  setSelection: (selection: {
    count: number;
    onClear: () => void;
    onAction: () => void;
    actionLabel: string;
  }) => void;
}) {
  const [reloadFlag, setReloadFlag] = useState(0);
  const [viewMode, setViewMode] = useState<DormViewMode>(isMobile ? 'card' : 'list');
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingDorm, setEditingDorm] = useState<DormRecord | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailDorm, setDetailDorm] = useState<DormRecord | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [actionSheetOpen, setActionSheetOpen] = useState(false);
  const [advancedFilterOpen, setAdvancedFilterOpen] = useState(false);
  const [importWizardOpen, setImportWizardOpen] = useState(false);
  const [bedModalOpen, setBedModalOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<DormRecord | null>(null);
  const [selectedBed, setSelectedBed] = useState<ServiceRecord | null>(null);

  useEffect(() => {
    if (!isMobile) {
      return;
    }

    setViewMode('card');
    setSelection({
      count: selectedIdsLength,
      onClear: clearSelection,
      onAction: () => setActionSheetOpen(true),
      actionLabel: '操作',
    });
  }, [clearSelection, isMobile, selectedIdsLength, setSelection]);

  return {
    actionSheetOpen,
    advancedFilterOpen,
    bedModalOpen,
    detailDorm,
    detailModalOpen,
    editModalOpen,
    editingDorm,
    importWizardOpen,
    modalOpen,
    reloadFlag,
    selectedBed,
    selectedRoom,
    settingsOpen,
    setActionSheetOpen,
    setAdvancedFilterOpen,
    setBedModalOpen,
    setDetailDorm,
    setDetailModalOpen,
    setEditModalOpen,
    setEditingDorm,
    setImportWizardOpen,
    setModalOpen,
    setReloadFlag,
    setSelectedBed,
    setSelectedRoom,
    setSettingsOpen,
    setViewMode,
    viewMode,
  };
}

function useDormDerivedData(
  pageData: DormPageData,
  draftFilters: DormFiltersState,
  tableData: { items?: DormRecord[]; total?: number },
) {
  const normalizedTableData = useMemo(
    () => ({ items: tableData.items || [], total: tableData.total || 0 }),
    [tableData.items, tableData.total],
  );
  const dormStats = useMemo(
    () => calculateDormStats(toArray<DormRecord>(pageData.dorms)),
    [pageData.dorms],
  );
  const uniqueBuildings = useMemo(
    () => sortStrings(toArray<DormRecord>(pageData.dorms).map((dorm) => dorm.building)),
    [pageData.dorms],
  );
  const uniqueFloors = useMemo(
    () => sortFloors(toArray<DormRecord>(pageData.dorms).map((dorm) => dorm.floor)),
    [pageData.dorms],
  );
  const uniqueGrades = useMemo(() => {
    const studentGrades = sortStrings(
      toArray<ServiceRecord>(pageData.students).map((student) => student.grade as string),
    );
    if (studentGrades.length > 0) {
      return studentGrades;
    }
    return sortStrings(toArray<DormRecord>(pageData.dorms).map((dorm) => dorm.grade));
  }, [pageData.dorms, pageData.students]);

  const { data: buildingsData } = useBuildings();
  const buildingOptions = useMemo(
    () =>
      toArray<BuildingRecord>(
        (buildingsData as BuildingQueryData | undefined)?.items ||
          (buildingsData as BuildingQueryData | undefined)?.buildings ||
          buildingsData?.buildings,
      ).map((building) => ({
        value: building.name || building.building,
        label: building.name || building.building,
        campus: building.campus,
      })),
    [buildingsData],
  );

  return {
    buildingOptions,
    dormStats,
    normalizedTableData,
    uniqueBuildings,
    uniqueFloors,
    uniqueGrades,
  };
}

function getDormPermissions(hasPermission: (permission: string) => boolean) {
  return {
    canView: hasPermission('DORM_VIEW'),
    canEdit: hasPermission('DORM_EDIT'),
    canExport: hasPermission('DORM_EXPORT'),
    canImport: hasPermission('DORM_IMPORT'),
  };
}

function useDormTableSettings(pageActions: DormPageActions) {
  return useTableColumns<DormColumnConfig>({
    tableKey: DORM_TABLE_KEY,
    defaultColumns: DORM_DEFAULT_COLUMNS,
    fetchConfig: pageActions.fetchTableConfig
      ? async (tableKey) =>
          (await pageActions.fetchTableConfig?.(tableKey)) as
            | { config?: DormColumnConfig[] }
            | null
            | undefined
      : undefined,
    saveConfig: pageActions.saveTableConfig
      ? async (tableKey, columns) =>
          pageActions.saveTableConfig?.(tableKey, columns)
      : undefined,
  });
}

function useDormColumnLayout({
  canEdit,
  handleDeleteSingle,
  handleOpenEditModal,
  handleViewDetail,
  sortField,
  sortOrder,
  visibleDormColumns,
}: {
  canEdit: boolean;
  handleDeleteSingle: (id: EntityId) => Promise<void>;
  handleOpenEditModal: (record: DormRecord) => void;
  handleViewDetail: (record: DormRecord) => void;
  sortField: string;
  sortOrder: 'asc' | 'desc';
  visibleDormColumns: DormColumnConfig[];
}) {
  const baseColumns = useMemo(
    () => createBaseColumns(visibleDormColumns, sortField, sortOrder),
    [sortField, sortOrder, visibleDormColumns],
  );
  const allColumns = useMemo(
    () => [
      ...baseColumns,
      createActionColumn({
        canEdit,
        onView: handleViewDetail,
        onEdit: handleOpenEditModal,
        onDelete: handleDeleteSingle,
      }),
    ],
    [baseColumns, canEdit, handleDeleteSingle, handleOpenEditModal, handleViewDetail],
  );
  const resizableColumnInput = useMemo<ResizableDormColumn[]>(
    () =>
      allColumns.map((column) => ({
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
    [allColumns],
  );

  const { columns: resizableColumns } = useResizableColumns(
    resizableColumnInput,
    {
      minWidth: 60,
      maxWidth: 400,
    },
  );

  return resizableColumns;
}

function useDormFilterConfigs({
  draftFilters,
  setDraftFilters,
  uniqueBuildings,
  uniqueFloors,
  uniqueGrades,
}: {
  draftFilters: DormFiltersState;
  setDraftFilters: Dispatch<SetStateAction<DormFiltersState>>;
  uniqueBuildings: string[];
  uniqueFloors: Array<string | number>;
  uniqueGrades: string[];
}) {
  const desktopFilterConfig = useMemo(
    () =>
      createDesktopFilterConfig({
        draftFilters,
        setDraftFilters,
        uniqueBuildings,
        uniqueFloors,
        uniqueGrades,
      }).map((filter) => ({
        ...filter,
        onChange: filter.onChange || (() => {}),
      })),
    [draftFilters, setDraftFilters, uniqueBuildings, uniqueFloors, uniqueGrades],
  );
  const mobileFilterConfig = useMemo(
    () =>
      createMobileFilterConfig({
        draftFilters,
        setDraftFilters,
        uniqueBuildings,
        uniqueFloors,
        uniqueGrades,
      }).map((filter) => ({
        ...filter,
        onChange: filter.onChange || (() => {}),
      })),
    [draftFilters, setDraftFilters, uniqueBuildings, uniqueFloors, uniqueGrades],
  );

  return {
    desktopFilterConfig,
    filterCount: getFilterCount(draftFilters),
    mobileFilterConfig,
  };
}

function useDormManagementHandlers({
  canEdit,
  editForm,
  editingDorm,
  form,
  pageActions,
  setBedModalOpen,
  setDetailDorm,
  setDetailModalOpen,
  setEditModalOpen,
  setEditingDorm,
  setModalOpen,
  setReloadFlag,
  setSelectedBed,
  setSelectedRoom,
}: {
  canEdit: boolean;
  editForm: ReturnType<typeof Form.useForm<DormFormPayload>>[0];
  editingDorm: DormRecord | null;
  form: ReturnType<typeof Form.useForm<DormFormPayload>>[0];
  pageActions: DormPageActions;
  setBedModalOpen: Dispatch<SetStateAction<boolean>>;
  setDetailDorm: Dispatch<SetStateAction<DormRecord | null>>;
  setDetailModalOpen: Dispatch<SetStateAction<boolean>>;
  setEditModalOpen: Dispatch<SetStateAction<boolean>>;
  setEditingDorm: Dispatch<SetStateAction<DormRecord | null>>;
  setModalOpen: Dispatch<SetStateAction<boolean>>;
  setReloadFlag: Dispatch<SetStateAction<number>>;
  setSelectedBed: Dispatch<SetStateAction<ServiceRecord | null>>;
  setSelectedRoom: Dispatch<SetStateAction<DormRecord | null>>;
}) {
  const handleOpenEditModal = useCallback(
    (record: DormRecord): void => {
      setEditingDorm(record);
      editForm.setFieldsValue({
        campus: record.campus,
        building: record.building,
        floor: record.floor,
        roomNo: record.roomNo,
        capacity: record.capacity,
        gender: record.gender,
        grade: record.grade,
      });
      setEditModalOpen(true);
    },
    [editForm, setEditModalOpen, setEditingDorm],
  );

  const handleViewDetail = useCallback((record: DormRecord): void => {
    setDetailDorm(record);
    setDetailModalOpen(true);
  }, [setDetailDorm, setDetailModalOpen]);

  const handleFormSubmit = useCallback(
    async (payload: DormFormPayload): Promise<void> => {
      if (!canEdit || !pageActions.createDorm) {
        message.error('当前账号无编辑权限');
        return;
      }

      try {
        await pageActions.createDorm(payload);
        form.resetFields();
        setModalOpen(false);
        message.success('已新增宿舍');
        setReloadFlag((prev) => prev + 1);
      } catch (error) {
        message.error(error instanceof Error ? error.message : '提交失败');
      }
    },
    [canEdit, form, pageActions, setModalOpen, setReloadFlag],
  );

  const handleEditSubmit = useCallback(
    async (payload: DormFormPayload): Promise<void> => {
      if (!canEdit || !editingDorm?.id || !pageActions.updateDorm) {
        return;
      }

      try {
        await pageActions.updateDorm(editingDorm.id, payload);
        editForm.resetFields();
        setEditModalOpen(false);
        setEditingDorm(null);
        message.success('已保存修改');
        setReloadFlag((prev) => prev + 1);
      } catch (error) {
        message.error(error instanceof Error ? error.message : '更新失败');
      }
    },
    [canEdit, editForm, editingDorm, pageActions, setEditModalOpen, setEditingDorm, setReloadFlag],
  );

  const handleBedClick = useCallback((bed: ServiceRecord, room: DormRecord): void => {
    setSelectedRoom(room);
    setSelectedBed(bed);
    setBedModalOpen(true);
  }, [setBedModalOpen, setSelectedBed, setSelectedRoom]);

  return {
    handleBedClick,
    handleEditSubmit,
    handleFormSubmit,
    handleOpenEditModal,
    handleViewDetail,
  };
}

function DormManagementContent({
  batchLoading,
  canEdit,
  canExport,
  canImport,
  clearSelection,
  desktopFilterConfig,
  dormStats,
  draftSearchTerm,
  emptyText,
  fetchError,
  filterCount,
  handleBedClick,
  handleBulkDelete,
  handleDeleteSingle,
  handleExport,
  handleViewDetail,
  handleOpenEditModal,
  handleResetFilters,
  handleSearch,
  handleTableChange,
  isDirty,
  isMobile,
  loading,
  normalizedTableData,
  pagination,
  resizableColumns,
  selectAcrossPages,
  selectAllResults,
  selectedCount,
  selectedIds,
  setAdvancedFilterOpen,
  setDraftSearchTerm,
  setImportWizardOpen,
  setModalOpen,
  setPagination,
  setReloadFlag,
  setSelectedIds,
  setSelectAcrossPages,
  setSettingsOpen,
  setViewMode,
  viewMode,
}: DormManagementContentProps) {
  const statsSegments = useMemo(() => mapDormStatsToSegments(dormStats), [dormStats]);

  return (
    <div className="dorm-management-page management-theme-page">
      <PageLayout
        statsLayout="custom"
        stats={
          <CollapsibleStatsBoard
            expandedContent={<DormStatsCards dormStats={dormStats} />}
            segments={statsSegments}
          />
        }
        filters={
          <DormFiltersBar
            isMobile={isMobile}
            draftSearchTerm={draftSearchTerm}
            setDraftSearchTerm={setDraftSearchTerm}
            handleSearch={handleSearch}
            handleResetFilters={handleResetFilters}
            isDirty={isDirty}
            loading={loading}
            filterCount={filterCount}
            desktopFilterConfig={desktopFilterConfig}
            setAdvancedFilterOpen={setAdvancedFilterOpen}
            viewMode={viewMode}
            setViewMode={setViewMode}
            canEdit={canEdit}
            canImport={canImport}
            canExport={canExport}
            setModalOpen={setModalOpen}
            setSettingsOpen={setSettingsOpen}
            setImportWizardOpen={setImportWizardOpen}
            handleExport={handleExport}
            handleBulkDelete={handleBulkDelete}
            batchLoading={batchLoading}
            selectedCount={selectedCount}
            selectAcrossPages={selectAcrossPages}
            tableDataTotal={normalizedTableData.total}
            currentPage={pagination.current}
            currentPageItemCount={normalizedTableData.items.length}
            selectAllResults={selectAllResults}
            clearSelection={clearSelection}
          />
        }
      >
        <div className="table-wrapper dorm-table-wrapper">
          <DormContentPane
            emptyText={emptyText}
            fetchError={fetchError}
            isMobile={isMobile}
            tableData={normalizedTableData}
            selectedIds={selectedIds}
            selectAcrossPages={selectAcrossPages}
            canEdit={canEdit}
            loading={loading}
            pagination={pagination}
            setPagination={setPagination}
            handleTableChange={handleTableChange}
            viewMode={viewMode}
            resizableColumns={resizableColumns}
            setReloadFlag={setReloadFlag}
            setSelectedIds={setSelectedIds}
            setSelectAcrossPages={setSelectAcrossPages}
            handleViewDetail={handleViewDetail}
            handleOpenEditModal={handleOpenEditModal}
            handleDeleteSingle={handleDeleteSingle}
            handleBedClick={handleBedClick}
          />
        </div>
      </PageLayout>
    </div>
  );
}

function DormManagementOverlays({
  actionSheetOpen,
  advancedFilterOpen,
  batchLoading,
  bedModalOpen,
  buildingOptions,
  canEdit,
  canExport,
  canImport,
  detailDorm,
  detailModalOpen,
  dormColumns,
  editForm,
  editModalOpen,
  editingDorm,
  form,
  handleBulkDelete,
  handleEditSubmit,
  handleExport,
  handleFormSubmit,
  handleOpenEditModal,
  handleResetFilters,
  handleSearch,
  handleViewDetail,
  importWizardOpen,
  isMobile,
  mobileFilterConfig,
  modalOpen,
  normalizedTableData,
  onCloseDetail,
  onCloseEditModal,
  resetDormColumns,
  saveDormColumns,
  savingDormColumns,
  selectedBed,
  selectedIds,
  selectedRoom,
  selectAcrossPages,
  selectAllResults,
  setActionSheetOpen,
  setAdvancedFilterOpen,
  setBedModalOpen,
  setImportWizardOpen,
  setModalOpen,
  setReloadFlag,
  setSettingsOpen,
  settingsOpen,
}: DormManagementOverlaysProps) {
  return (
    <>
      <DormFloatingActions
        isMobile={isMobile}
        selectedIds={selectedIds}
        canEdit={canEdit}
        canImport={canImport}
        canExport={canExport}
        setModalOpen={setModalOpen}
        setImportWizardOpen={setImportWizardOpen}
        handleExport={handleExport}
      />

      <MobileAdvancedFilter
        open={advancedFilterOpen}
        onClose={() => setAdvancedFilterOpen(false)}
        title="筛选宿舍"
        onReset={handleResetFilters}
        onConfirm={handleSearch}
        filters={mobileFilterConfig}
      />

      <DormFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        form={form}
        onSubmit={handleFormSubmit}
        buildingOptions={buildingOptions}
        isMobile={isMobile}
      />

      <DormEditModal
        open={editModalOpen}
        onClose={onCloseEditModal}
        form={editForm}
        onSubmit={handleEditSubmit}
        buildingOptions={buildingOptions}
        isMobile={isMobile}
      />

      <TableFieldSettings
        open={settingsOpen}
        columns={dormColumns}
        onClose={() => setSettingsOpen(false)}
        onSave={async (columns) => {
          await saveDormColumns(
            columns.map((column) => ({
              ...column,
              fieldKey: column.fieldKey,
              label: column.label || column.fieldKey,
            })) as DormColumnConfig[],
          );
          setSettingsOpen(false);
        }}
        onReset={resetDormColumns}
        saving={savingDormColumns}
        title="宿舍列表字段设置"
      />

      <DormDetailModal
        open={detailModalOpen}
        onClose={onCloseDetail}
        dorm={detailDorm}
        canEdit={canEdit}
        onEdit={handleOpenEditModal}
      />

      <DormActionSheet
        open={actionSheetOpen}
        onClose={() => setActionSheetOpen(false)}
        selectedIds={selectedIds}
        selectAcrossPages={selectAcrossPages}
        tableItems={normalizedTableData.items}
        totalCount={normalizedTableData.total}
        canEdit={canEdit}
        batchLoading={batchLoading}
        onView={handleViewDetail}
        onEdit={handleOpenEditModal}
        onDelete={() => {
          void handleBulkDelete();
        }}
        onSelectAll={selectAllResults}
      />

      <BedDetailModal
        open={bedModalOpen}
        onClose={() => setBedModalOpen(false)}
        room={selectedRoom}
        bed={selectedBed}
      />

      <LazyImportWizardModal
        open={importWizardOpen}
        onClose={() => setImportWizardOpen(false)}
        config={DORM_IMPORT_CONFIG}
        onSuccess={() => {
          setReloadFlag((prev) => prev + 1);
        }}
      />
    </>
  );
}

// Page-level orchestrator keeps synchronized table, filters, and modal flows together.
export default function DormManagementPage() {
  const { data, actions, hasPermission, setSelection } = useAppContext();
  const pageData = data as DormPageData;
  const pageActions = actions as DormPageActions;
  const isMobile = useMobile();
  const [form] = Form.useForm<DormFormPayload>();
  const [editForm] = Form.useForm<DormFormPayload>();
  const { canView, canEdit, canExport, canImport } = getDormPermissions(hasPermission);

  const {
    selectedIds,
    selectAcrossPages,
    batchLoading,
    setSelectedIds,
    setSelectAcrossPages,
    setBatchLoading,
    selectAllResults,
    clearSelection,
  } = useBulkSelection<EntityId>();
  const uiState = useDormManagementUi({
    clearSelection,
    isMobile,
    selectedIdsLength: selectedIds.length,
    setSelection,
  });

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
    handleTableChange,
  } = toDormTableStateResult(
    useTableState({
      filterKeys: [
        'building',
        'floor',
        'grade',
        'gender',
        'college',
        'major',
        'className',
        'occupancyStatus',
      ],
      defaultSortField: 'roomNo',
      defaultSortOrder: 'asc',
      defaultPageSize: 10,
      syncUrl: true,
      normalizers: {
        gender: (value: unknown) =>
          normalizeDormGender(typeof value === 'string' ? value : String(value ?? '')),
      },
      onApply: clearSelection,
      onReset: clearSelection,
    }),
  );

  const {
    columns: dormColumns,
    visibleColumns: visibleDormColumns,
    save: saveDormColumns,
    resetToDefault: resetDormColumns,
    saving: savingDormColumns,
  } = useDormTableSettings(pageActions);

  const {
    data: tableData,
    loading,
    error: fetchError,
  } = useTableFetch<DormRecord>({
    fetchFn: async (params, options) => {
      if (!pageActions.fetchDormTable) {
        return { items: [], total: 0 };
      }
      return pageActions.fetchDormTable(params as ServiceQueryParams, options);
    },
    buildParams: () =>
      buildDormTableParams(
        appliedFilters,
        appliedSearchTerm,
        pagination,
        sortField,
        sortOrder,
        true,
      ),
    enabled: canView,
    onSuccess: (result) => {
      setPagination((prev) => ({ ...prev, total: result.total || 0 }));
    },
    onError: (error) => {
      console.error('获取宿舍列表失败:', error);
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
  const derivedData = useDormDerivedData(pageData, draftFilters, tableData);

  const {
    handleExport,
    handleDeleteSingle,
    handleBulkDelete,
  } = useDormActions({
    actions: pageActions,
    appliedFilters,
    appliedSearchTerm,
    pagination,
    sortField,
    sortOrder,
    selectedIds,
    selectAcrossPages,
    clearSelection,
    setBatchLoading,
    setReloadFlag: uiState.setReloadFlag,
    totalCount: derivedData.normalizedTableData.total,
    canExport,
  });

  useEffect(() => {
    if (!canView) {
      return;
    }

    void pageActions.loadDorms?.();
    void pageActions.loadDormBeds?.();
    void pageActions.loadStudents?.();
  }, [canView, pageActions]);
  const {
    handleBedClick,
    handleEditSubmit,
    handleFormSubmit,
    handleOpenEditModal,
    handleViewDetail,
  } = useDormManagementHandlers({
    canEdit,
    editForm,
    editingDorm: uiState.editingDorm,
    form,
    pageActions,
    setBedModalOpen: uiState.setBedModalOpen,
    setDetailDorm: uiState.setDetailDorm,
    setDetailModalOpen: uiState.setDetailModalOpen,
    setEditModalOpen: uiState.setEditModalOpen,
    setEditingDorm: uiState.setEditingDorm,
    setModalOpen: uiState.setModalOpen,
    setReloadFlag: uiState.setReloadFlag,
    setSelectedBed: uiState.setSelectedBed,
    setSelectedRoom: uiState.setSelectedRoom,
  });
  const resizableColumns = useDormColumnLayout({
    canEdit,
    handleDeleteSingle,
    handleOpenEditModal,
    handleViewDetail,
    sortField,
    sortOrder,
    visibleDormColumns,
  });
  const {
    desktopFilterConfig,
    filterCount,
    mobileFilterConfig,
  } = useDormFilterConfigs({
    draftFilters,
    setDraftFilters,
    uniqueBuildings: derivedData.uniqueBuildings,
    uniqueFloors: derivedData.uniqueFloors,
    uniqueGrades: derivedData.uniqueGrades,
  });
  const selectedCount = selectAcrossPages
    ? derivedData.normalizedTableData.total
    : selectedIds.length;
  const hasActiveFilter =
    Boolean(appliedSearchTerm.trim()) ||
    Object.values(appliedFilters).some(
      (value) => Array.isArray(value) && value.length > 0,
    );
  const emptyText = hasActiveFilter ? '没有符合条件的宿舍' : '还没有宿舍';

  if (!canView) {
    return (
      <div className="management-theme-page">
        <PermissionDeniedState {...dormManagementPermissionPreset} />
      </div>
    );
  }

  return (
    <>
      <DormManagementContent
        batchLoading={batchLoading}
        canEdit={canEdit}
        canExport={canExport}
        canImport={canImport}
        clearSelection={clearSelection}
        desktopFilterConfig={desktopFilterConfig}
        dormStats={derivedData.dormStats}
        draftSearchTerm={draftSearchTerm}
        emptyText={emptyText}
        fetchError={fetchError}
        filterCount={filterCount}
        handleBedClick={handleBedClick}
        handleBulkDelete={handleBulkDelete}
        handleDeleteSingle={handleDeleteSingle}
        handleExport={handleExport}
        handleViewDetail={handleViewDetail}
        handleOpenEditModal={handleOpenEditModal}
        handleResetFilters={handleResetFilters}
        handleSearch={handleSearch}
        handleTableChange={handleTableChange}
        isDirty={isDirty}
        isMobile={isMobile}
        loading={loading}
        normalizedTableData={derivedData.normalizedTableData}
        pagination={pagination}
        resizableColumns={resizableColumns}
        selectAcrossPages={selectAcrossPages}
        selectAllResults={selectAllResults}
        selectedCount={selectedCount}
        selectedIds={selectedIds}
        setAdvancedFilterOpen={uiState.setAdvancedFilterOpen}
        setDraftSearchTerm={setDraftSearchTerm}
        setImportWizardOpen={uiState.setImportWizardOpen}
        setModalOpen={uiState.setModalOpen}
        setPagination={setPagination}
        setReloadFlag={uiState.setReloadFlag}
        setSelectedIds={setSelectedIds}
        setSelectAcrossPages={setSelectAcrossPages}
        setSettingsOpen={uiState.setSettingsOpen}
        setViewMode={uiState.setViewMode}
        viewMode={uiState.viewMode}
      />

      <DormManagementOverlays
        actionSheetOpen={uiState.actionSheetOpen}
        advancedFilterOpen={uiState.advancedFilterOpen}
        batchLoading={batchLoading}
        bedModalOpen={uiState.bedModalOpen}
        buildingOptions={derivedData.buildingOptions}
        canEdit={canEdit}
        canExport={canExport}
        canImport={canImport}
        detailDorm={uiState.detailDorm}
        detailModalOpen={uiState.detailModalOpen}
        dormColumns={dormColumns}
        editForm={editForm}
        editModalOpen={uiState.editModalOpen}
        editingDorm={uiState.editingDorm}
        form={form}
        handleBulkDelete={handleBulkDelete}
        handleEditSubmit={handleEditSubmit}
        handleExport={handleExport}
        handleFormSubmit={handleFormSubmit}
        handleOpenEditModal={handleOpenEditModal}
        handleResetFilters={handleResetFilters}
        handleSearch={handleSearch}
        handleViewDetail={handleViewDetail}
        importWizardOpen={uiState.importWizardOpen}
        isMobile={isMobile}
        mobileFilterConfig={mobileFilterConfig}
        modalOpen={uiState.modalOpen}
        normalizedTableData={derivedData.normalizedTableData}
        onCloseDetail={() => {
          uiState.setDetailModalOpen(false);
          uiState.setDetailDorm(null);
        }}
        onCloseEditModal={() => {
          uiState.setEditModalOpen(false);
          uiState.setEditingDorm(null);
        }}
        resetDormColumns={resetDormColumns}
        saveDormColumns={saveDormColumns}
        savingDormColumns={savingDormColumns}
        selectedBed={uiState.selectedBed}
        selectedIds={selectedIds}
        selectedRoom={uiState.selectedRoom}
        selectAcrossPages={selectAcrossPages}
        selectAllResults={selectAllResults}
        setActionSheetOpen={uiState.setActionSheetOpen}
        setAdvancedFilterOpen={uiState.setAdvancedFilterOpen}
        setBedModalOpen={uiState.setBedModalOpen}
        setImportWizardOpen={uiState.setImportWizardOpen}
        setModalOpen={uiState.setModalOpen}
        setReloadFlag={uiState.setReloadFlag}
        setSettingsOpen={uiState.setSettingsOpen}
        settingsOpen={uiState.settingsOpen}
      />
    </>
  );
}
