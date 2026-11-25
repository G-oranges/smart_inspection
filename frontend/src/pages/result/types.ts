import type { Dispatch, SetStateAction } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import type { Dayjs } from 'dayjs';

import type { AppActions, AppDataStore, UserLike } from '../../types/app';
import type {
  DormMembersResponse,
  EntityId,
  ServiceQueryParams,
  ServiceRecord,
} from '../../types/service';

export interface ResultTaskRecord extends ServiceRecord {
  id?: EntityId;
  title?: string;
  date?: string;
}

export interface ResultUserRecord extends UserLike {
  id?: EntityId;
  fullName?: string;
}

export interface ResultDormRecord extends ServiceRecord {
  id?: EntityId;
  building?: string;
  roomNo?: string;
  campus?: string;
  gender?: string;
  floor?: string | number;
  grade?: string;
  beds?: ResultDormBedRecord[];
  dormBeds?: ResultDormBedRecord[];
}

export interface ResultDormBedRecord extends ServiceRecord {
  id?: EntityId;
  dormId?: EntityId;
  bedNo?: string | number;
  college?: string;
  grade?: string;
  dorm?: { id?: EntityId } | null;
  student?: {
    college?: string;
    grade?: string;
  } | null;
}

export interface ResultInspectionDetailRecord extends ServiceRecord {
  id?: EntityId;
  code?: string;
  count?: number;
  locations?: string[];
}

export interface ResultInspectionRecord extends ServiceRecord {
  id?: EntityId;
  taskId?: EntityId;
  dormId?: EntityId;
  totalScore?: number | null;
  createdAt?: string;
  comments?: string;
  photoUrls?: string[];
  photos?: string[];
  task?: ResultTaskRecord | null;
  dorm?: ResultDormRecord | null;
  reviewedBy?: ResultUserRecord | null;
  createdBy?: ResultUserRecord | null;
  recordedByName?: string;
  detail?: ResultInspectionDetailRecord[];
  dormColleges?: string[];
  dormGrades?: string[];
}

export interface ResultAppealRecord extends ServiceRecord {
  id?: EntityId;
  inspectionId?: EntityId;
  studentName?: string;
  status?: string;
  createdAt?: string;
}

export interface ResultFiltersState extends Record<string, unknown> {
  keyword: string;
  taskId: EntityId[];
  grade: string[];
  college: string[];
  level: string[];
  gender: string[];
  dateRange: Dayjs[];
  sort: string;
}

export interface ContactFormState {
  phone: string;
}

export interface ResultDetailState {
  open: boolean;
  inspection: ResultInspectionRecord | null;
  members: ServiceRecord[];
  loading: boolean;
}

export interface ResultPageData extends AppDataStore {
  tasks?: ResultTaskRecord[];
  dorms?: ResultDormRecord[];
  inspections?: ResultInspectionRecord[];
  myInspections?: ResultInspectionRecord[];
  appeals?: ResultAppealRecord[];
  myAppeals?: ResultAppealRecord[];
  dormBeds?: ResultDormBedRecord[];
}

export interface ResultPageActions extends AppActions {
  loadTasks?: (force?: boolean) => Promise<unknown> | void;
  loadDorms?: (force?: boolean) => Promise<unknown> | void;
  loadInspections?: (force?: boolean) => Promise<unknown> | void;
  loadAppeals?: (force?: boolean) => Promise<unknown> | void;
  loadMyInspections?: (force?: boolean) => Promise<unknown> | void;
  loadMyAppeals?: (force?: boolean) => Promise<unknown> | void;
  fetchDormMembers?: (dormId: EntityId) => Promise<DormMembersResponse>;
  updateMyContact?: (payload: ContactFormState) => Promise<unknown>;
  exportResults?: (params: ServiceQueryParams) => Promise<Blob>;
  deleteInspection?: (inspectionId: EntityId) => Promise<unknown>;
  deleteInspections?: (ids: EntityId[]) => Promise<unknown>;
}

export interface UseResultActionsProps {
  actions: ResultPageActions;
  canAdjust: boolean;
  canViewAppeals?: boolean;
  activeRoleCode?: string;
  permissionsReady: boolean;
  appliedFilters: ResultFiltersState;
  filteredInspections: ResultInspectionRecord[];
  clearSelection: () => void;
  navigate: NavigateFunction;
  myProfile: Record<string, unknown> | null;
}

export interface UseResultActionsResult {
  contactForm: ContactFormState;
  setContactForm: Dispatch<SetStateAction<ContactFormState>>;
  contactStatus: string;
  exporting: boolean;
  detail: ResultDetailState;
  handleOpenDetail: (inspection: ResultInspectionRecord) => Promise<void>;
  handleCloseDetail: () => void;
  handleModifyNavigation: (inspection: ResultInspectionRecord) => void;
  handleContactSubmit: () => Promise<void>;
  handleExport: () => Promise<void>;
  handleRefresh: () => Promise<void>;
  handleDeleteResults: (ids: EntityId[]) => Promise<void>;
}

export type RatingForScore = (score: number | null | undefined) => string;
