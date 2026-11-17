import type {
  ChangeEvent,
  Dispatch,
  FormEvent,
  RefObject,
  SetStateAction,
} from 'react';
import type { NavigateFunction } from 'react-router-dom';

import type { QueryParams } from '../../types/api';
import type {
  AppSettings,
  DeductionItem,
  RoleLike,
  UserLike,
} from '../../types/app';
import type { EntityId, ServiceRecord } from '../../types/service';

export interface ResultEntryTask extends ServiceRecord {
  id?: EntityId;
  title?: string;
  date?: string;
  deadline?: string;
}

export interface ResultEntryDorm extends ServiceRecord {
  id?: EntityId;
  building?: string;
  floor?: string | number;
  roomNo?: string | number;
  campus?: string;
}

export interface ResultEntryMember extends ServiceRecord {
  id?: EntityId;
  fullName?: string;
  studentNo?: string;
  bedNo?: string | number;
  isLeader?: boolean;
}

export interface ResultEntryDeductionItem extends DeductionItem {
  maxPoints?: number | string | null;
}

export interface ResultEntryDeductionRow extends ServiceRecord {
  id: EntityId;
  code: string;
  count: number;
  locations: string[];
}

export interface ResultEntryInspectionRecord extends ServiceRecord {
  id?: EntityId;
  totalScore?: number | string | null;
  comments?: string;
  photoUrls?: string[];
  detail?: ResultEntryDeductionRow[];
}

export interface ResultEntryFormState {
  dormId: EntityId | '';
  totalScore: string;
  comments: string;
  photoUrls: string[];
}

export interface ResultEntryNewDeductionForm {
  id: EntityId | null;
  code: string;
  count: number;
  locations: string[];
}

export interface ResultEntryWindowInfo {
  start: number | null;
  end: number | null;
  inWindow: boolean;
  beforeStart: boolean;
  afterEnd: boolean;
}

export interface ResultEntryDataStore {
  tasks: ResultEntryTask[];
}

export interface ResultEntryInspectionListResponse {
  inspections?: ResultEntryInspectionRecord[];
}

export interface ResultEntryAssignedDormsResponse {
  dorms?: ResultEntryDorm[];
  total?: number;
}

export interface ResultEntryDormLookupResponse {
  dorm?: ResultEntryDorm | null;
}

export interface ResultEntryDormMembersResponse {
  members?: ResultEntryMember[];
}

export interface ResultEntryUploadPhotoResponse {
  url?: string;
}

export interface ResultEntrySubmitPayload extends ServiceRecord {
  taskId?: EntityId;
  inspectionId?: EntityId;
  dormId?: EntityId | '';
  totalScore?: number | string | null;
  comments?: string;
  photoUrls?: string[];
  detail?: ResultEntryDeductionRow[];
}

export interface ResultEntryActions {
  loadInspectionRecord: (
    taskId?: EntityId,
    dormId?: EntityId,
  ) => Promise<ResultEntryInspectionListResponse>;
  loadTasks?: () => Promise<unknown>;
  fetchAssignedDorms: (
    taskId?: EntityId,
    params?: QueryParams,
  ) => Promise<ResultEntryAssignedDormsResponse>;
  fetchDormByLocation: (
    params?: QueryParams,
  ) => Promise<ResultEntryDormLookupResponse>;
  fetchDormMembers: (
    dormId: EntityId,
  ) => Promise<ResultEntryDormMembersResponse>;
  uploadPhoto: (file: File) => Promise<ResultEntryUploadPhotoResponse>;
  submitScore: (payload: ResultEntrySubmitPayload) => Promise<unknown>;
}

export interface ResultEntryHookProps {
  building: string;
  floor: string;
  room: string;
  campusParam: string;
  taskIdParam: string;
  navigate: NavigateFunction;
  data: ResultEntryDataStore;
  actions: ResultEntryActions;
  hasPermission: (code: string) => boolean;
  settings: AppSettings | null;
  user: UserLike | null;
  activeRole: RoleLike | null;
}

export interface ResultEntryToolbarProps {
  isScrolled: boolean;
  onBack: () => void;
  prevDorm: ResultEntryDorm | null;
  nextDorm: ResultEntryDorm | null;
  onNavigateToRoom: (targetRoom: ResultEntryDorm | null) => void;
  room: string;
  building: string;
  scoreColor: string;
  numericScore: number;
}

export interface ResultEntryLayoutProps {
  mainRef: RefObject<HTMLDivElement>;
  isScrolled: boolean;
  onBackToRoomList: () => void;
  prevDorm: ResultEntryDorm | null;
  nextDorm: ResultEntryDorm | null;
  onNavigateToRoom: (targetRoom: ResultEntryDorm | null) => void;
  room: string;
  building: string;
  scoreColor: string;
  numericScore: number;
  canRecord: boolean;
  canSubmit: boolean;
  handleSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  handleScoreClick: () => void;
  selectedTask: ResultEntryTask | null;
  inspectionRecord: ResultEntryInspectionRecord | null;
  currentRating: string;
  members: ResultEntryMember[];
  loadingMembers: boolean;
  appliedDeductions: ResultEntryDeductionRow[];
  enabledDeductions: ResultEntryDeductionItem[];
  onOpenEditDrawer: (row: ResultEntryDeductionRow) => void;
  onRemoveDeductionRow: (id: EntityId) => void;
  onOpenAddDrawer: () => void;
  onOpenUploadModal: () => void;
  form: ResultEntryFormState;
  setForm: Dispatch<SetStateAction<ResultEntryFormState>>;
  removePhoto: (index: number) => void;
}

export interface ResultEntryHookResult {
  mainRef: RefObject<HTMLDivElement>;
  cameraInputRef: RefObject<HTMLInputElement>;
  galleryInputRef: RefObject<HTMLInputElement>;
  form: ResultEntryFormState;
  setForm: Dispatch<SetStateAction<ResultEntryFormState>>;
  baseScore: string;
  editingScore: boolean;
  members: ResultEntryMember[];
  inspectionRecord: ResultEntryInspectionRecord | null;
  loadingMembers: boolean;
  appliedDeductions: ResultEntryDeductionRow[];
  showMemberModal: boolean;
  currentEditingRowId: EntityId | null;
  showAddDeductionDrawer: boolean;
  newDeductionForm: ResultEntryNewDeductionForm;
  isScrolled: boolean;
  showUploadModal: boolean;
  showLeaveConfirm: boolean;
  canRecord: boolean;
  selectedTask: ResultEntryTask | null;
  enabledDeductions: ResultEntryDeductionItem[];
  numericScore: number;
  currentRating: string;
  scoreColor: string;
  canSubmit: boolean;
  prevDorm: ResultEntryDorm | null;
  nextDorm: ResultEntryDorm | null;
  handleScoreClick: () => void;
  setEditingScore: Dispatch<SetStateAction<boolean>>;
  setShowAddDeductionDrawer: Dispatch<SetStateAction<boolean>>;
  setShowUploadModal: Dispatch<SetStateAction<boolean>>;
  setShowMemberModal: Dispatch<SetStateAction<boolean>>;
  setCurrentEditingRowId: Dispatch<SetStateAction<EntityId | null>>;
  setNewDeductionForm: Dispatch<SetStateAction<ResultEntryNewDeductionForm>>;
  setShowLeaveConfirm: Dispatch<SetStateAction<boolean>>;
  confirmLeave: () => void;
  handleBaseScoreChange: (value: string) => void;
  handleOpenAddDrawer: () => void;
  handleOpenEditDrawer: (row: ResultEntryDeductionRow) => void;
  handleConfirmAddDeduction: () => void;
  handleToggleNewLocation: (location: string) => void;
  handleRemoveDeductionRow: (id: EntityId) => void;
  handleToggleLocation: (rowId: EntityId | null, location: string) => void;
  handlePhotoUpload: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
  removePhoto: (index: number) => void;
  handleSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  handleNavigateToRoom: (targetRoom: ResultEntryDorm | null) => void;
  handleBackToRoomList: () => void;
}

export interface DeductionDrawerProps {
  open: boolean;
  onClose: () => void;
  newDeductionForm: ResultEntryNewDeductionForm;
  setNewDeductionForm: Dispatch<SetStateAction<ResultEntryNewDeductionForm>>;
  enabledDeductions: ResultEntryDeductionItem[];
  appliedDeductions: ResultEntryDeductionRow[];
  settings: AppSettings | null;
  onToggleLocation: (location: string) => void;
  onConfirm: () => void;
}

export interface LeaveConfirmModalProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export interface LocationPickerModalProps {
  open: boolean;
  locations: string[];
  currentEditingRowId: EntityId | null;
  appliedDeductions: ResultEntryDeductionRow[];
  onToggleLocation: (rowId: EntityId | null, location: string) => void;
  onClose: () => void;
}

export interface MembersModalProps {
  open: boolean;
  members: ResultEntryMember[];
  loading: boolean;
  onClose: () => void;
}

export interface ScoreEditModalProps {
  open: boolean;
  baseScore: string;
  onChange: (value: string) => void;
  onClose: () => void;
}

export interface UploadActionSheetModalProps {
  open: boolean;
  onClose: () => void;
  onPickCamera: () => void;
  onPickGallery: () => void;
}
