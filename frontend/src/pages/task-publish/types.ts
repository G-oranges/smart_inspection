import type { Dispatch, ReactNode, SetStateAction } from 'react';
import type { Dayjs } from 'dayjs';

import type { EntityId, ExecutorListResponse, ServiceQueryParams, ServiceRecord, ServiceTableResponse } from '../../types/service';
import type { IOSActionSheetAction } from '../../components/common/IOSActionSheet';

export type TaskPublishModalMode = 'create' | 'edit';
export type TaskPublishViewMode = 'card' | 'list' | 'mini';
export type TaskStatusKey = '' | 'upcoming' | 'inProgress' | 'ended';
export type TaskTimeRange = '' | 'week' | 'month' | 'custom';

export interface TaskPublishFormState {
  title: string;
  startAt: Dayjs | null;
  deadline: Dayjs | null;
  notes: string;
}

export interface DormFiltersState {
  campus: string[];
  building: string[];
  floor: string[];
  grade: string[];
  college: string[];
}

export interface TaskFiltersState {
  status: TaskStatusKey;
  timeRange: TaskTimeRange;
  customRange: Dayjs[];
  executorId: EntityId | '';
}

export interface TaskExecutor extends ServiceRecord {
  id?: EntityId;
  username?: string;
  fullName?: string;
  role?: string;
  _needsUpdate?: boolean;
}

export interface TaskDorm extends ServiceRecord {
  id?: EntityId;
  campus?: string;
  building?: string;
  floor?: string | number | null;
  roomNo?: string | number;
  grade?: string;
  dormGrades?: string[];
  dormColleges?: string[];
  _readonly?: boolean;
  _readonlyReason?: string;
}

export interface TaskPublishTask extends ServiceRecord {
  id?: EntityId;
  title?: string;
  date?: string;
  deadline?: string;
  notes?: string;
  description?: string;
  createdByName?: string;
  dormIds?: EntityId[];
  executorIds?: EntityId[];
  executors?: TaskExecutor[];
  inspectionCount?: number | string;
  inspectedCount?: number | string;
}

export interface TaskPublishStatsState {
  total: number;
  upcoming: number;
  inProgress: number;
  inspected: number;
  totalDorms: number;
  coverageRate: number;
  momGrowth: number | null;
}

export interface TaskPublishExecutorData {
  items: TaskExecutor[];
  total: number;
}

export interface TaskFilterOption {
  value: string | number;
  label: string;
}

export interface TaskFilterConfigItem {
  key: string;
  label: string;
  options: TaskFilterOption[];
  value: Array<string | number>;
  onChange: (values: Array<string | number>) => void;
  multiple: boolean;
  searchable: boolean;
  customRender?: ReactNode;
}

export interface TaskPublishUserLookup {
  [key: string]: TaskExecutor;
}

export interface TaskPublishDataStore {
  tasks: TaskPublishTask[];
  dorms: TaskDorm[];
  users: TaskExecutor[];
}

export interface TaskSubmitPayload extends ServiceRecord {
  title: string;
  date: string;
  deadline: string;
  notes: string;
  dormIds: EntityId[];
  executors: EntityId[];
}

export interface TaskPublishActions {
  loadTasks?: (force?: boolean) => Promise<void> | void;
  loadDorms?: (force?: boolean) => Promise<void> | void;
  loadUsers?: (params?: ServiceQueryParams) => Promise<ServiceTableResponse> | void;
  fetchExecutors: (params?: ServiceQueryParams) => Promise<ExecutorListResponse>;
  createTask: (payload: TaskSubmitPayload) => Promise<unknown>;
  updateTask: (taskId: EntityId, payload: TaskSubmitPayload) => Promise<unknown>;
  deleteTask: (taskId: EntityId) => Promise<unknown>;
}

export interface UseTaskPublishActionsProps {
  actions: TaskPublishActions;
  canCreateTasks: boolean;
  canEditTasks: boolean;
  canDeleteTasks: boolean;
  form: TaskPublishFormState;
  setForm: Dispatch<SetStateAction<TaskPublishFormState>>;
  selectedTaskIds: EntityId[];
  selectedDormIds: EntityId[];
  setSelectedDormIds: Dispatch<SetStateAction<EntityId[]>>;
  selectedExecutors: TaskExecutor[];
  setSelectedExecutors: Dispatch<SetStateAction<TaskExecutor[]>>;
  setEditingTaskId: Dispatch<SetStateAction<EntityId | ''>>;
  setPickerSelection: Dispatch<SetStateAction<Set<EntityId>>>;
  setDraftDormFilters: Dispatch<SetStateAction<DormFiltersState>>;
  setAppliedDormFilters: Dispatch<SetStateAction<DormFiltersState>>;
  setDraftDormSearch: Dispatch<SetStateAction<string>>;
  setAppliedDormSearch: Dispatch<SetStateAction<string>>;
  setCurrentStep: Dispatch<SetStateAction<number>>;
  setExecutorFilter: Dispatch<SetStateAction<{ role: string; keyword: string }>>;
  setExecutorPage: Dispatch<SetStateAction<number>>;
  setModalMode: Dispatch<SetStateAction<TaskPublishModalMode>>;
  setModalVisible: Dispatch<SetStateAction<boolean>>;
  userLookup: TaskPublishUserLookup;
  editingTaskId: EntityId | '';
  currentStep: number;
  draftTaskFilters: TaskFiltersState;
  appliedTaskFilters: TaskFiltersState;
  draftTaskSearch: string;
  appliedTaskSearch: string;
  setDraftTaskFilters: Dispatch<SetStateAction<TaskFiltersState>>;
  setAppliedTaskFilters: Dispatch<SetStateAction<TaskFiltersState>>;
  setDraftTaskSearch: Dispatch<SetStateAction<string>>;
  setAppliedTaskSearch: Dispatch<SetStateAction<string>>;
  setSelectedTaskIds: Dispatch<SetStateAction<EntityId[]>>;
}

export interface UseTaskPublishActionsResult {
  isTaskDirty: boolean;
  resetTaskForm: () => void;
  handleOpenCreateModal: () => void;
  handleOpenEditModal: (task: TaskPublishTask) => void;
  handleCloseModal: () => void;
  handleDeleteTask: (task: TaskPublishTask) => Promise<void>;
  handleBulkDeleteTasks: (taskIds?: EntityId[]) => Promise<void>;
  handleSubmit: () => Promise<void>;
  handleNextStep: () => void;
  handleTaskSearch: () => void;
  handleTaskReset: () => void;
}

export interface TaskPublishStatsProps {
  taskStats: TaskPublishStatsState;
}

export interface TaskPublishToolbarProps {
  canCreateTasks: boolean;
  isMobile: boolean;
  draftTaskSearch: string;
  setDraftTaskSearch: Dispatch<SetStateAction<string>>;
  onSearch: () => void;
  onReset: () => void;
  isDirty: boolean;
  taskFilterCount: number;
  onOpenFilter: () => void;
  onCreateTask: () => void;
  taskFilterConfig: TaskFilterConfigItem[];
}

export interface TaskPublishTableProps {
  canEditTasks: boolean;
  canDeleteTasks: boolean;
  filteredTasks: TaskPublishTask[];
  userLookup: TaskPublishUserLookup;
  handleOpenEditModal: (task: TaskPublishTask) => void;
  handleDeleteTask: (task: TaskPublishTask) => Promise<void>;
}

export interface TaskPublishMobileCardProps {
  task: TaskPublishTask;
  selected: boolean;
  onSelect?: (selected: boolean) => void;
}

export interface TaskPublishActionSheetProps {
  canEditTasks: boolean;
  canDeleteTasks: boolean;
  open: boolean;
  onClose: () => void;
  selectedTaskIds: EntityId[];
  sortedTasks: TaskPublishTask[];
  handleOpenEditModal: (task: TaskPublishTask) => void;
  handleDeleteTask: (task: TaskPublishTask) => Promise<void>;
  handleBulkDeleteTasks: (taskIds?: EntityId[]) => Promise<void>;
}

export interface TaskPublishActionSheetItem extends IOSActionSheetAction {
  key: string;
}

export interface TaskPreviewModalProps {
  open: boolean;
  mode: TaskPublishModalMode;
  isMobile: boolean;
  currentStep: number;
  steps: Array<{ title?: ReactNode; description?: ReactNode }>;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSubmit: () => void;
  children?: ReactNode;
}

export interface TaskDetailStepProps {
  isMobile: boolean;
  form: TaskPublishFormState;
  setForm: Dispatch<SetStateAction<TaskPublishFormState>>;
}

export interface ExecutorSelectionStepProps {
  executorFilter: { role: string; keyword: string };
  setExecutorFilter: Dispatch<SetStateAction<{ role: string; keyword: string }>>;
  executorPage: number;
  setExecutorPage: Dispatch<SetStateAction<number>>;
  executorData: TaskPublishExecutorData;
  executorLoading: boolean;
  pickerSelection: Set<EntityId>;
  setPickerSelection: Dispatch<SetStateAction<Set<EntityId>>>;
  setSelectedExecutors: Dispatch<SetStateAction<TaskExecutor[]>>;
  executorCache: Record<string, TaskExecutor>;
  userLookup: TaskPublishUserLookup;
}
