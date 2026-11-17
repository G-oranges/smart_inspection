import type { Dispatch, SetStateAction } from 'react';
import type { FormInstance } from 'antd';

import type { EntityId, ServiceQueryParams, ServiceRecord } from '../../types/service';
import type { SearchFilters } from '../../types/table';

export interface BuildingRecord extends ServiceRecord {
  id?: EntityId;
  name?: string;
  campus?: string;
  type?: string;
  floors?: number;
  hasElevator?: boolean;
  dormCount?: number;
  contactInfo?: string;
}

export interface BuildingFiltersState extends SearchFilters {
  campus: string[];
  type: string[];
}

export interface BuildingStatsState {
  total: number;
  totalDorms: number;
  maleBuildings: number;
  femaleBuildings: number;
  mixedBuildings: number;
  withElevator: number;
}

export interface BuildingFormPayload extends ServiceRecord {
  name?: string;
  campus?: string;
  type?: string;
  floors?: number;
  hasElevator?: boolean;
  contactInfo?: string;
}

export interface BuildingTableResponse {
  items: BuildingRecord[];
  total: number;
}

export interface BuildingImportPreviewResult extends ServiceRecord {
  totalCount?: number;
  validCount?: number;
  invalidCount?: number;
  duplicateCount?: number;
  warnings?: unknown[];
  issues?: unknown[];
}

export interface UseBuildingActionsProps {
  form: FormInstance;
  appliedFilters: BuildingFiltersState;
  appliedSearchText: string;
  editingId: EntityId | null;
  selectedIds: EntityId[];
  setEditingId: Dispatch<SetStateAction<EntityId | null>>;
  setSelectedIds: Dispatch<SetStateAction<EntityId[]>>;
  setIsModalVisible: Dispatch<SetStateAction<boolean>>;
  setDetailBuilding: Dispatch<SetStateAction<BuildingRecord | null>>;
  setDetailModalOpen: Dispatch<SetStateAction<boolean>>;
  setBatchLoading: Dispatch<SetStateAction<boolean>>;
  setReloadFlag: Dispatch<SetStateAction<number>>;
  fetchBuildings: () => void;
}

export interface UseBuildingActionsResult {
  handleAdd: () => void;
  handleEdit: (record: BuildingRecord) => void;
  handleView: (record: BuildingRecord) => void;
  handleDelete: (record: BuildingRecord) => Promise<void>;
  handleBulkDelete: () => Promise<void>;
  handleExport: () => Promise<void>;
  handleModalOk: () => Promise<void>;
}

export interface BuildingColumnsHookResult {
  columns: ServiceRecord[];
  save: (nextColumns: ServiceRecord[]) => Promise<void>;
  resetToDefault: () => Promise<void>;
  saving: boolean;
}

export interface BuildingQueryParams extends ServiceQueryParams {
  page?: number;
  pageSize?: number;
  search?: string;
  sortField?: string;
  sortOrder?: 'asc' | 'desc';
  campus?: string[];
  type?: string[];
}
