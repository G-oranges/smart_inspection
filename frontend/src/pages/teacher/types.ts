import type { Dispatch, SetStateAction } from 'react';
import type { FormInstance } from 'antd';

import type { AppActions } from '../../types/app';
import type {
  DeleteByIdsPayload,
  EntityId,
  ServiceQueryParams,
  ServiceRecord,
  ServiceTableResponse,
} from '../../types/service';
import type { PaginationState, SearchFilters, SortOrder } from '../../types/table';

export interface TeacherRecord extends ServiceRecord {
  id?: EntityId;
  employeeNo?: string;
  fullName?: string;
  gender?: string;
  department?: string;
  mobile?: string;
  classes?: string;
  username?: string;
}

export interface TeacherFormValues {
  employeeNo: string;
  fullName: string;
  gender: string;
  department: string;
  mobile: string;
  classes: string;
}

export interface TeacherColumnConfig extends ServiceRecord {
  fieldKey: string;
  label: string;
  visible: boolean;
  sortable: boolean;
  order: number;
}

export interface TeacherFilters extends SearchFilters {
  department: string[];
}

export interface TeacherTableParams extends ServiceQueryParams {
  page?: number;
  pageSize?: number;
  search?: string;
  department?: string[];
  sortField?: string;
  sortOrder?: SortOrder;
}

export interface TeacherImportPreviewIssue extends ServiceRecord {
  row?: number;
  field?: string;
  reason?: string;
}

export interface TeacherImportPreviewResult extends ServiceRecord {
  total?: number;
  newCount?: number;
  conflictCount?: number;
  invalidCount?: number;
  invalidItems?: TeacherImportPreviewIssue[];
}

export interface TeacherMessageApi {
  success: (content: string) => unknown;
  error: (content: string) => unknown;
  warning: (content: string) => unknown;
}

export interface TeacherPageActions extends AppActions {
  fetchTeacherTable?: (
    params?: ServiceQueryParams,
    options?: { signal?: AbortSignal },
  ) => Promise<ServiceTableResponse>;
  createTeacher?: (payload: TeacherFormValues) => Promise<unknown>;
  updateTeacher?: (
    id: EntityId,
    payload: TeacherFormValues,
  ) => Promise<unknown>;
  deleteTeachers?: (payload?: DeleteByIdsPayload) => Promise<unknown>;
  exportTeachers?: (params?: ServiceQueryParams) => Promise<Blob | undefined>;
  fetchTableConfig?: (tableKey: string) => Promise<{ config?: unknown }>;
  saveTableConfig?: (tableKey: string, config: unknown) => Promise<unknown>;
}

export interface UseTeacherActionsProps {
  actions: TeacherPageActions;
  messageApi: TeacherMessageApi;
  appliedFilters: TeacherFilters;
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
  setBatchLoading: Dispatch<SetStateAction<boolean>>;
  setReloadFlag: Dispatch<SetStateAction<number>>;
  canManage: boolean;
  canExport: boolean;
  tableTotal: number;
}

export interface UseTeacherActionsResult {
  editingId: EntityId | null;
  modalOpen: boolean;
  handleExport: () => Promise<void>;
  handleBulkDelete: () => Promise<void>;
  handleSingleDelete: (record: TeacherRecord) => Promise<void>;
  openModal: (
    teacher: TeacherRecord | null,
    form: FormInstance<TeacherFormValues>,
  ) => void;
  closeModal: (form: FormInstance<TeacherFormValues>) => void;
  handleFormSubmit: (values: TeacherFormValues) => Promise<boolean>;
}
