import type { Dispatch, ReactNode, SetStateAction } from 'react';
import type { Key } from 'react';
import type { TableProps } from 'antd';

import type { IOSActionSheetAction } from '../../components/common/IOSActionSheet';

import type { AppActions } from '../../types/app';
import type {
  DeleteByIdsPayload,
  EntityId,
  ServiceQueryParams,
  ServiceRecord,
  ServiceTableResponse,
} from '../../types/service';
import type { PaginationState, SearchFilters, SortOrder } from '../../types/table';

export interface StudentRecord extends ServiceRecord {
  id?: EntityId;
  studentNo?: string;
  fullName?: string;
  grade?: string;
  gender?: string;
  educationLevel?: string;
  college?: string;
  major?: string;
  className?: string;
  status?: string;
  mobile?: string;
  qq?: string;
  idType?: string;
  idNumber?: string;
  politicalStatus?: string;
  birthDate?: string;
  ethnicity?: string;
  nativePlace?: string;
  sourcePlace?: string;
  homeAddress?: string;
  building?: string;
  roomNo?: string;
  bedNo?: string;
  isMonitor?: boolean;
}

export interface StudentFormState {
  studentNo: string;
  fullName: string;
  grade: string;
  gender: string;
  educationLevel: string;
  college: string;
  major: string;
  className: string;
  status: string;
  mobile: string;
  qq: string;
  idType: string;
  idNumber: string;
  politicalStatus: string;
  birthDate: string;
  ethnicity: string;
  nativePlace: string;
  sourcePlace: string;
  homeAddress: string;
  isMonitor: boolean;
}

export interface StudentDerivedStats {
  total: number;
  maleCount: number;
  femaleCount: number;
  dormsCount: number;
}

export interface StudentColumnConfig extends ServiceRecord {
  fieldKey: string;
  label: string;
  visible: boolean;
  sortable: boolean;
  order: number;
  render?: (student: StudentRecord) => ReactNode;
}

export interface StudentFilters extends SearchFilters {
  grade: string[];
  gender: string[];
  building: string[];
  floor: string[];
  roomNo: string[];
  college: string[];
  major: string[];
  className: string[];
}

export interface StudentTableParams extends ServiceQueryParams {
  page?: number;
  pageSize?: number;
  search?: string;
  grade?: string[];
  gender?: string[];
  building?: string[];
  floor?: string[];
  roomNo?: string[];
  college?: string[];
  major?: string[];
  className?: string[];
  sortField?: string;
  sortOrder?: SortOrder;
}

export interface StudentPageActions extends AppActions {
  loadDormBeds?: (force?: boolean) => Promise<unknown> | void;
  fetchStudentTable?: (
    params?: ServiceQueryParams,
    options?: { signal?: AbortSignal },
  ) => Promise<ServiceTableResponse>;
  createStudent?: (payload: ServiceRecord) => Promise<unknown>;
  updateStudent?: (
    id: EntityId,
    payload: ServiceRecord,
  ) => Promise<unknown>;
  deleteStudents?: (payload?: DeleteByIdsPayload) => Promise<unknown>;
  exportStudents?: (params?: ServiceQueryParams) => Promise<Blob | undefined>;
  downloadTemplate?: (resource: string) => Promise<Blob | undefined>;
  fetchTableConfig?: (tableKey: string) => Promise<{ config?: unknown }>;
  saveTableConfig?: (tableKey: string, config: unknown) => Promise<unknown>;
}

export interface StudentFilterOptionsData {
  colleges?: string[];
  grades?: string[];
  majors?: Array<{ college: string; name: string }>;
  classNames?: Array<{ major: string; name: string }>;
}

export interface BuildingOption extends ServiceRecord {
  name?: string;
}

export interface FloorsQueryResult {
  floors?: Array<string | number>;
}

export interface RoomsQueryResult {
  rooms?: string[];
}

export interface UseStudentActionsProps {
  actions: StudentPageActions;
  appliedFilters: StudentFilters;
  appliedSearchTerm: string;
  pagination: PaginationState;
  sortField: string;
  sortOrder: SortOrder;
  selectedIds: EntityId[];
  selectAcrossPages: boolean;
  setSelectedIds: Dispatch<SetStateAction<EntityId[]>>;
  setSelectAcrossPages: Dispatch<SetStateAction<boolean>>;
  clearSelection: () => void;
  getSelectionCount: (totalCount?: number) => number;
  setReloadFlag: Dispatch<SetStateAction<number>>;
  setToastMsg: Dispatch<SetStateAction<string>>;
  canEdit: boolean;
  canExport: boolean;
  tableTotal: number;
}

export interface UseStudentActionsResult {
  batchLoading: boolean;
  form: StudentFormState;
  setForm: Dispatch<SetStateAction<StudentFormState>>;
  editingId: EntityId | null;
  modalOpen: boolean;
  detailModalOpen: boolean;
  detailStudent: StudentRecord | null;
  handleExport: () => Promise<void>;
  handleDownloadTemplate: () => Promise<void>;
  handleBulkDelete: () => Promise<void>;
  handleSingleDelete: (record: StudentRecord) => Promise<void>;
  openModal: (student?: StudentRecord | null) => void;
  closeModal: () => void;
  handleFormSubmit: () => Promise<void>;
  openDetailModal: (student: StudentRecord) => void;
  closeDetailModal: () => void;
}

export type StudentColumn = NonNullable<
  TableProps<StudentRecord>['columns']
>[number];

export interface StudentStatsProps {
  stats: StudentDerivedStats;
  filteredTotal: number;
}

export interface StudentMobileCardProps {
  student: StudentRecord;
  selected: boolean;
  onSelect?: (selected: boolean) => void;
}

export interface StudentActionSheetProps {
  open: boolean;
  onClose: () => void;
  selectedIds: EntityId[];
  tableItems: StudentRecord[];
  canEdit: boolean;
  batchLoading: boolean;
  onViewDetail: (student: StudentRecord) => void;
  onEdit: (student?: StudentRecord | null) => void;
  onBulkDelete: () => void;
}

export interface StudentActionSheetConfig extends IOSActionSheetAction {
  key: string;
}

export interface StudentToolbarProps {
  draftSearchTerm: string;
  setDraftSearchTerm: Dispatch<SetStateAction<string>>;
  isDirty: boolean;
  loading: boolean;
  onSearch: () => void;
  onReset: () => void;
  canEdit: boolean;
  canImport: boolean;
  canExport: boolean;
  onOpenModal: () => void;
  onOpenImport: () => void;
  onExport: () => void;
  onOpenSettings: () => void;
  batchLoading: boolean;
  onBulkDelete: () => void;
  draftFilters: StudentFilters;
  setDraftFilters: Dispatch<SetStateAction<StudentFilters>>;
  uniqueGrades: string[];
  buildings: BuildingOption[];
  selectedCount: number;
  selectAcrossPages: boolean;
  tableTotal: number;
  tableItemsLength: number;
  paginationCurrent: number;
  onSelectAllResults: () => void;
  onClearSelection: () => void;
}

export interface MobileSearchBarProps {
  draftSearchTerm: string;
  setDraftSearchTerm: Dispatch<SetStateAction<string>>;
  isDirty: boolean;
  loading: boolean;
  onSearch: () => void;
  activeFilterCount: number;
  onOpenFilter: () => void;
  onReset: () => void;
}

export interface StudentMobileAdvancedFilterProps {
  open: boolean;
  onClose: () => void;
  onReset: () => void;
  draftFilters: StudentFilters;
  setDraftFilters: Dispatch<SetStateAction<StudentFilters>>;
  uniqueGrades: string[];
  buildings: BuildingOption[];
  dynamicFloors: Array<string | number>;
  dynamicRooms: string[];
}

export interface StudentFormModalProps {
  open: boolean;
  isMobile: boolean;
  isEditing: boolean;
  form: StudentFormState;
  setForm: Dispatch<SetStateAction<StudentFormState>>;
  onClose: () => void;
  onSubmit: () => void;
}

export interface StudentDetailModalProps {
  open: boolean;
  student: StudentRecord | null;
  canEdit: boolean;
  onClose: () => void;
  onEdit: (student?: StudentRecord | null) => void;
}

export interface StudentImportInvalidItem {
  row: number;
  field?: string;
  reason: string;
  content?: string;
}

export interface StudentImportPreviewData {
  total: number;
  newCount: number;
  conflictCount: number;
  invalidCount: number;
  invalidItems?: StudentImportInvalidItem[];
}

export interface StudentImportPreviewModalProps {
  open: boolean;
  previewData: StudentImportPreviewData | null;
  resolution: string;
  setResolution: (value: string) => void;
  isImporting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export interface StudentFilterOptionsResult {
  uniqueGrades: string[];
  uniqueColleges: string[];
  uniqueMajors: string[];
  uniqueClassNames: string[];
}

export interface StudentResponsiveSelectionContext {
  selected: boolean;
  onSelect?: (selected: boolean) => void;
}

export type StudentSelectedKeys = Key[];
