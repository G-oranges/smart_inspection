import type { Dispatch, SetStateAction } from 'react';

import type { AppActions, AppDataStore } from '../../types/app';
import type {
  EntityId,
  ServiceQueryParams,
  ServiceRecord,
  ServiceTableResponse,
  TableConfigResponse,
} from '../../types/service';
import type { PaginationState, SearchFilters } from '../../types/table';

export interface DormStudentRecord extends ServiceRecord {
  id?: EntityId;
  fullName?: string;
  name?: string;
  studentNo?: string;
  college?: string;
  grade?: string;
  gender?: string;
  isMonitor?: boolean;
}

export interface DormBedRecord extends ServiceRecord {
  bedNo?: string | number;
  studentId?: EntityId | null;
  studentName?: string | null;
  studentNo?: string | null;
  gender?: string | null;
  isMonitor?: boolean;
  college?: string;
  grade?: string;
  student?: DormStudentRecord | null;
}

export interface DormRecord extends ServiceRecord {
  id?: EntityId;
  campus?: string;
  building?: string;
  floor?: string | number;
  roomNo?: string;
  capacity?: number;
  gender?: string;
  grade?: string;
  occupiedCount?: number;
  beds?: DormBedRecord[];
  dormBeds?: DormBedRecord[];
  monitorName?: string;
}

export interface BuildingRecord extends ServiceRecord {
  name?: string;
  building?: string;
  campus?: string;
}

export interface DormColumnConfig extends ServiceRecord {
  fieldKey: string;
  label: string;
  visible?: boolean;
  sortable?: boolean;
  order?: number;
}

export interface DormFiltersState extends SearchFilters {
  building: string[];
  floor: string[];
  grade: string[];
  gender: string[];
  college: string[];
  major: string[];
  className: string[];
  occupancyStatus: string[];
}

export interface DormStatsState {
  total: number;
  capacitySum: number;
  occupiedSum: number;
  maleDorms: number;
  femaleDorms: number;
}

export type DormViewMode = 'list' | 'card' | 'mini';

export interface DormFormPayload extends ServiceRecord {
  campus?: string;
  building?: string;
  floor?: string | number;
  roomNo?: string;
  capacity?: number | string;
  gender?: string;
  grade?: string;
}

export interface DormPageData extends AppDataStore {
  dorms?: DormRecord[];
  students?: DormStudentRecord[];
}

export interface DormPageActions extends AppActions {
  loadDorms?: (force?: boolean) => Promise<unknown> | void;
  loadDormBeds?: (force?: boolean) => Promise<unknown> | void;
  loadStudents?: (force?: boolean) => Promise<unknown> | void;
  fetchDormTable?: (
    params?: ServiceQueryParams,
    options?: { signal?: AbortSignal },
  ) => Promise<ServiceTableResponse>;
  createDorm?: (payload: DormFormPayload) => Promise<unknown>;
  updateDorm?: (id: EntityId, payload: DormFormPayload) => Promise<unknown>;
  deleteDorms?: (
    payload?: EntityId[] | { ids?: EntityId[]; filter?: ServiceRecord },
  ) => Promise<unknown>;
  importDorms?: (file: File, resolution?: string) => Promise<unknown>;
  exportDorms?: (params?: ServiceQueryParams) => Promise<Blob>;
  downloadTemplate?: (type: string) => Promise<Blob>;
  fetchTableConfig?: (tableKey: string) => Promise<TableConfigResponse | unknown>;
  saveTableConfig?: (tableKey: string, config: unknown) => Promise<unknown>;
}

export interface UseDormActionsProps {
  actions: DormPageActions;
  appliedFilters: DormFiltersState;
  appliedSearchTerm: string;
  pagination: PaginationState;
  sortField: string;
  sortOrder: 'asc' | 'desc';
  selectedIds: EntityId[];
  selectAcrossPages: boolean;
  clearSelection: () => void;
  setBatchLoading: Dispatch<SetStateAction<boolean>>;
  setReloadFlag: Dispatch<SetStateAction<number>>;
  totalCount: number;
  canExport: boolean;
}

export interface UseDormActionsResult {
  handleExport: () => Promise<void>;
  handleDeleteSingle: (id: EntityId) => Promise<void>;
  handleBulkDelete: () => Promise<void>;
  handleDownloadTemplate: () => Promise<void>;
}

export interface BulkSelectionResult {
  selectedIds: EntityId[];
  selectAcrossPages: boolean;
  batchLoading: boolean;
  setSelectedIds: Dispatch<SetStateAction<EntityId[]>>;
  setSelectAcrossPages: Dispatch<SetStateAction<boolean>>;
  setBatchLoading: Dispatch<SetStateAction<boolean>>;
  selectPage: (ids: EntityId[]) => void;
  selectAllResults: () => void;
  clearSelection: () => void;
}

export interface TableColumnsHookResult {
  columns: DormColumnConfig[];
  visibleColumns: DormColumnConfig[];
  save: (nextColumns: DormColumnConfig[]) => Promise<void>;
  resetToDefault: () => Promise<void>;
  saving: boolean;
}
