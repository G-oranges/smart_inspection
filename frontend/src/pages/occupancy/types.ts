import type { Dispatch, ReactNode, SetStateAction } from 'react';
import type { Dayjs } from 'dayjs';
import type { Key } from 'react';
import type { TableProps } from 'antd';
import type { IOSActionSheetAction } from '../../components/common/IOSActionSheet';

import type { AppActions } from '../../types/app';
import type {
  EntityId,
  ServiceQueryParams,
  ServiceRecord,
  ServiceTableResponse,
} from '../../types/service';
import type { PaginationState, SearchFilters } from '../../types/table';

export interface OccupancyStudentRecord extends ServiceRecord {
  id?: EntityId;
  studentNo?: string;
  fullName?: string;
  gender?: string;
  college?: string;
  className?: string;
  grade?: string;
  dormId?: EntityId | null;
  building?: string;
  roomNo?: string;
  bedNo?: string | number;
}

export interface DormRecord extends ServiceRecord {
  id?: EntityId;
  building?: string;
  floor?: string | number;
  roomNo?: string;
  roomNumber?: string;
}

export interface BedSelectInfo extends ServiceRecord {
  dormId: EntityId;
  bedNo: string | number;
  roomNo?: string;
  building?: string;
  floor?: string | number;
}

export interface BatchAssignment {
  dormId: EntityId;
  bedNo: string | number;
  roomNo?: string;
  building?: string;
  floor?: string | number;
}

export interface OccupancyStatsState {
  totalDorms: number;
  totalBeds: number;
  occupiedBeds: number;
  availableBeds: number;
  occupancyRate: number;
  monthlyMoves?: number;
}

export interface HistoryStatsState {
  total: number;
  todayCount: number;
  latestTime: string | null;
}

export interface HistoryFiltersState {
  action?: string;
  keyword: string;
  dateRange: [Dayjs, Dayjs] | null;
}

export interface BatchModalFiltersState {
  building: string | null;
  floor: string | number | null;
  roomNo: string;
}

export interface OccupancyOverviewFilters extends SearchFilters {
  building: string[];
  floor: string[];
  grade: string[];
  college: string[];
  className: string[];
  status: string[];
}

export interface OccupancyPageActions extends AppActions {
  loadStudents?: (force?: boolean) => Promise<unknown> | void;
  loadDorms?: (force?: boolean) => Promise<unknown> | void;
  loadDormBeds?: (force?: boolean) => Promise<unknown> | void;
  fetchStudentTable?: (
    params?: ServiceQueryParams,
    options?: { signal?: AbortSignal },
  ) => Promise<ServiceTableResponse>;
  fetchDormTable?: (params?: ServiceQueryParams) => Promise<ServiceTableResponse>;
  getFloors?: (
    params?: ServiceQueryParams,
  ) => Promise<{ floors?: Array<string | number> }>;
  getDormBeds?: (dormId?: EntityId) => Promise<unknown>;
  getOccupancyStats?: () => Promise<OccupancyStatsState>;
  checkoutStudent?: (studentId: EntityId) => Promise<unknown>;
}

export interface UseOccupancyActionsProps {
  studentData: {
    items: OccupancyStudentRecord[];
    total: number;
  };
  selectedIds: EntityId[];
  clearSelection: () => void;
  setReloadFlag: Dispatch<SetStateAction<number>>;
  loadStats: () => Promise<void>;
  actions: OccupancyPageActions;
}

export interface UseOccupancyActionsResult {
  batchLoading: boolean;
  setBatchLoading: Dispatch<SetStateAction<boolean>>;
  batchCheckInModalOpen: boolean;
  setBatchCheckInModalOpen: Dispatch<SetStateAction<boolean>>;
  targetDorms: DormRecord[];
  loadingDorms: boolean;
  currentAssigneeIndex: number;
  setCurrentAssigneeIndex: Dispatch<SetStateAction<number>>;
  batchAssignments: Record<string, BatchAssignment>;
  modalFilters: BatchModalFiltersState;
  setModalFilters: Dispatch<SetStateAction<BatchModalFiltersState>>;
  modalFloors: Array<string | number>;
  selectedStudentsData: OccupancyStudentRecord[];
  studentsToBeAssigned: OccupancyStudentRecord[];
  validateBatchOperation: (
    type: 'checkin' | 'checkout',
  ) => { valid: boolean; message?: string };
  handleBedSelect: (bedInfo: BedSelectInfo) => void;
  handleBatchCheckout: () => Promise<void>;
  openBatchCheckInModal: () => void;
  handleBatchCheckIn: () => Promise<void>;
  handleCheckout: (studentId: EntityId) => Promise<void>;
}

export type OccupancyColumn = NonNullable<
  TableProps<OccupancyStudentRecord>['columns']
>[number];

export interface OccupancyFilterOption {
  label: string;
  value: string;
}

export interface OccupancyFilterConfig {
  key: string;
  label: string;
  options?: OccupancyFilterOption[];
  value?: string[];
  onChange: (values: string[]) => void;
  multiple?: boolean;
  searchable?: boolean;
  customRender?: ReactNode;
}

export interface BatchCheckInModalProps {
  isMobile: boolean;
  open: boolean;
  onClose: () => void;
  onSubmit: () => void;
  loading: boolean;
  studentsToBeAssigned: OccupancyStudentRecord[];
  currentAssigneeIndex: number;
  setCurrentAssigneeIndex: Dispatch<SetStateAction<number>>;
  batchAssignments: Record<string, BatchAssignment>;
  targetDorms: DormRecord[];
  loadingDorms: boolean;
  modalFilters: BatchModalFiltersState;
  setModalFilters: Dispatch<SetStateAction<BatchModalFiltersState>>;
  modalFloors: Array<string | number>;
  uniqueBuildings: string[];
  handleBedSelect: (bedInfo: BedSelectInfo) => void;
  actions: {
    getDormBeds?: OccupancyPageActions['getDormBeds'];
  };
}

export interface OccupancyMobileCardProps {
  record: OccupancyStudentRecord;
  selected: boolean;
  onSelect?: (selected: boolean) => void;
  isBatchMode: boolean;
}

export interface OccupancyOverviewStatsProps {
  stats: OccupancyStatsState;
}

export interface OccupancyHistoryStatsProps {
  historyStats: HistoryStatsState;
  studentDataTotal: number;
}

export interface OverviewFiltersSectionProps {
  isMobile: boolean;
  draftSearchTerm: string;
  setDraftSearchTerm: Dispatch<SetStateAction<string>>;
  draftFilters: OccupancyOverviewFilters;
  setDraftFilters: Dispatch<SetStateAction<OccupancyOverviewFilters>>;
  uniqueColleges: string[];
  uniqueBuildings: string[];
  uniqueGrades: string[];
  uniqueFloors: Array<string | number>;
  loading: boolean;
  isDirty: boolean;
  handleSearch: () => void;
  handleResetFilters: () => void;
  setFilterDrawerOpen: Dispatch<SetStateAction<boolean>>;
  canEdit: boolean;
  openBatchCheckInModal: () => void;
  handleBatchCheckout: () => void;
  batchLoading: boolean;
  validateBatchOperation: (
    type: 'checkin' | 'checkout',
  ) => { valid: boolean; message?: string };
  onOpenImport: () => void;
  onExport: () => void;
  onOpenSettings: () => void;
}

export interface HistoryFiltersSectionProps {
  isMobile: boolean;
  historyDraftFilters: HistoryFiltersState;
  setHistoryDraftFilters: Dispatch<SetStateAction<HistoryFiltersState>>;
  isHistoryDirty: boolean;
  loading: boolean;
  handleHistorySearch: () => void;
  handleResetHistoryFilters: () => void;
  setFilterDrawerOpen: Dispatch<SetStateAction<boolean>>;
}

export interface OccupancyActionSheetProps {
  open: boolean;
  onClose: () => void;
  isBatchMode: boolean;
  selectedIds: EntityId[];
  selectedStudentId: EntityId | null;
  studentData: {
    items: OccupancyStudentRecord[];
  };
  selectedStudentsData: OccupancyStudentRecord[];
  canEdit: boolean;
  openAdjustModal: (
    student: OccupancyStudentRecord,
    mode?: 'assign' | 'move' | 'swap',
  ) => void;
  openBatchCheckInModal: () => void;
  handleBatchCheckout: () => void;
  handleCheckout: (studentId: EntityId) => void;
}

export interface OccupancyActionSheetConfig extends IOSActionSheetAction {
  key: string;
}

export interface OccupancyResponsiveSelectionContext {
  selected: boolean;
  onSelect?: (selected: boolean) => void;
}

export interface OccupancyResponsivePagination {
  current: number;
  pageSize: number;
  total?: number;
}

export type OccupancySelectedKeys = Key[];
