import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FloatButton } from 'antd';
import dayjs from 'dayjs';

import PageLayout from '../components/PageLayout';
import PermissionDeniedState from '../components/common/PermissionDeniedState';
import ResponsiveDataView from '../components/ResponsiveDataView';
import { taskPublishPermissionPreset } from '../components/common/permissionDeniedPresets';
import CollapsibleStatsBoard from '../components/stats/CollapsibleStatsBoard';
import { useAppContext } from '../context/AppContext';
import { useMobile } from '../hooks/useMobile';
import MobileAdvancedFilter from '../components/common/MobileAdvancedFilter';
import {
  EXECUTOR_PAGE_SIZE,
  createEmptyDormFilters,
  INITIAL_FILTERS,
  INITIAL_FORM,
  INITIAL_TASK_FILTERS,
  TaskPreviewModal,
  TaskPublishActionSheet,
  TaskPublishForm,
  TaskPublishMobileCard,
  TaskPublishStats,
  TaskPublishTable,
  TaskPublishToolbar,
  createTaskFilterConfig,
  filterTasks,
  getTaskFilterCount,
  getTaskStats,
  mapTaskPublishStatsToSegments,
  useTaskPublishActions,
} from './task-publish';

import type { AppActions, AppSelectionState } from '../types/app';
import type {
  EntityId,
  ExecutorListResponse,
} from '../types/service';
import type {
  TaskExecutor,
  TaskFilterOption,
  TaskPublishActions,
  TaskPublishDataStore,
  TaskPublishExecutorData,
  TaskPublishModalMode,
  TaskDorm,
  TaskPublishTask,
  TaskPublishUserLookup,
  TaskPublishViewMode,
} from './task-publish/types';

const EMPTY_SELECTION: AppSelectionState = {
  count: 0,
  onClear: null,
  onAction: null,
  actionLabel: '操作',
};

function pickTaskAction<T extends (...args: never[]) => unknown>(
  source: AppActions,
  key: string,
): T | undefined {
  const value = source[key];
  return typeof value === 'function' ? (value as T) : undefined;
}

function createTaskPublishActions(source: AppActions): TaskPublishActions {
  return {
    loadTasks: pickTaskAction<NonNullable<TaskPublishActions['loadTasks']>>(source, 'loadTasks'),
    loadDorms: pickTaskAction<NonNullable<TaskPublishActions['loadDorms']>>(source, 'loadDorms'),
    loadUsers: pickTaskAction<NonNullable<TaskPublishActions['loadUsers']>>(source, 'loadUsers'),
    fetchExecutors:
      pickTaskAction<NonNullable<TaskPublishActions['fetchExecutors']>>(source, 'fetchExecutors') ||
      (async () => ({ users: [], total: 0 } as ExecutorListResponse)),
    createTask:
      pickTaskAction<NonNullable<TaskPublishActions['createTask']>>(source, 'createTask') ||
      (async () => undefined),
    updateTask:
      pickTaskAction<NonNullable<TaskPublishActions['updateTask']>>(source, 'updateTask') ||
      (async () => undefined),
    deleteTask:
      pickTaskAction<NonNullable<TaskPublishActions['deleteTask']>>(source, 'deleteTask') ||
      (async () => undefined),
  };
}

function createTaskPublishDataStore(data: ReturnType<typeof useAppContext>['data']): TaskPublishDataStore {
  return {
    tasks: Array.isArray(data.tasks) ? (data.tasks as TaskPublishTask[]) : [],
    dorms: Array.isArray(data.dorms) ? (data.dorms as TaskDorm[]) : [],
    users: Array.isArray(data.users) ? (data.users as TaskExecutor[]) : [],
  };
}

function createMobileTaskFilterConfig(taskFilterConfig: ReturnType<typeof createTaskFilterConfig>) {
  return taskFilterConfig.map((filter) => ({
    ...filter,
    options: filter.options?.map((option) => ({
      label: option.label,
      value: String(option.value),
    })),
    value: filter.value.map((value) => String(value)),
    onChange: (values: string[]) => {
      filter.onChange(values);
    },
  }));
}

function useTaskPublishLifecycle(params: {
  isMobile: boolean;
  selectedTaskIds: EntityId[];
  setActionSheetOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setSelection: ReturnType<typeof useAppContext>['setSelection'];
  setSelectedTaskIds: React.Dispatch<React.SetStateAction<EntityId[]>>;
  taskActions: TaskPublishActions;
}) {
  const {
    isMobile,
    selectedTaskIds,
    setActionSheetOpen,
    setSelection,
    setSelectedTaskIds,
    taskActions,
  } = params;

  useEffect(() => {
    void taskActions.loadTasks?.();
    void taskActions.loadDorms?.();
    void taskActions.loadUsers?.();
  }, [taskActions]);

  useEffect(() => {
    const timer = setInterval(() => {
      void taskActions.loadTasks?.(true);
    }, 15000);
    return () => clearInterval(timer);
  }, [taskActions]);

  useEffect(() => {
    if (!isMobile) {
      setSelection(EMPTY_SELECTION);
      return undefined;
    }

    setSelection({
      count: selectedTaskIds.length,
      onClear: () => setSelectedTaskIds([]),
      onAction: () => setActionSheetOpen(true),
      actionLabel: '操作',
    });

    return () => {
      setSelection(EMPTY_SELECTION);
    };
  }, [isMobile, selectedTaskIds.length, setActionSheetOpen, setSelectedTaskIds, setSelection]);
}

interface TaskListSectionProps {
  canCreateTasks: boolean;
  canEditTasks: boolean;
  canDeleteTasks: boolean;
  filteredTasks: TaskPublishTask[];
  handleDeleteTask: (task: TaskPublishTask) => Promise<void>;
  handleOpenEditModal: (task: TaskPublishTask) => void;
  isMobile: boolean;
  selectedTaskIds: EntityId[];
  setSelectedTaskIds: React.Dispatch<React.SetStateAction<EntityId[]>>;
  taskFilterConfig: ReturnType<typeof createTaskFilterConfig>;
  taskFilterCount: number;
  taskStats: ReturnType<typeof getTaskStats>;
  userLookup: TaskPublishUserLookup;
  draftTaskSearch: string;
  setDraftTaskSearch: React.Dispatch<React.SetStateAction<string>>;
  handleTaskSearch: () => void;
  handleTaskReset: () => void;
  isTaskDirty: boolean;
  handleOpenCreateModal: () => void;
  setTaskFilterOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

function TaskListSection({
  canCreateTasks,
  canEditTasks,
  canDeleteTasks,
  filteredTasks,
  handleDeleteTask,
  handleOpenCreateModal,
  handleOpenEditModal,
  handleTaskReset,
  handleTaskSearch,
  isMobile,
  isTaskDirty,
  selectedTaskIds,
  setDraftTaskSearch,
  setSelectedTaskIds,
  setTaskFilterOpen,
  taskFilterConfig,
  taskFilterCount,
  taskStats,
  userLookup,
  draftTaskSearch,
}: TaskListSectionProps) {
  return (
    <PageLayout
      statsLayout="custom"
      stats={
        <CollapsibleStatsBoard
          expandedContent={<TaskPublishStats taskStats={taskStats} />}
          segments={mapTaskPublishStatsToSegments(taskStats)}
        />
      }
      filters={
        <TaskPublishToolbar
          canCreateTasks={canCreateTasks}
          isMobile={isMobile}
          draftTaskSearch={draftTaskSearch}
          setDraftTaskSearch={setDraftTaskSearch}
          onSearch={handleTaskSearch}
          onReset={handleTaskReset}
          isDirty={isTaskDirty}
          taskFilterCount={taskFilterCount}
          onOpenFilter={() => setTaskFilterOpen(true)}
          onCreateTask={handleOpenCreateModal}
          taskFilterConfig={taskFilterConfig}
        />
      }
    >
      <div className="table-head dorm-table-head mb-4">
        <div className="flex items-center gap-2">
          <div className="dorm-table-head-accent" />
          <h3 className="dorm-table-head-title">任务列表</h3>
        </div>
      </div>

      <div className={`table-wrapper${isMobile ? '' : ' dorm-table-wrapper'}`}>
        {isMobile ? (
          <ResponsiveDataView<TaskPublishTask>
            isMobile
            dataSource={filteredTasks}
            rowKey="id"
            emptyText="还没有查寝任务"
            selectedKeys={selectedTaskIds}
            onSelectChange={canEditTasks || canDeleteTasks ? (keys) => setSelectedTaskIds(keys as EntityId[]) : undefined}
            renderCard={(
              task: TaskPublishTask,
              _index: number,
              { selected, onSelect }: { selected: boolean; onSelect?: (checked: boolean) => void },
            ) => (
              <TaskPublishMobileCard task={task} selected={selected} onSelect={onSelect} />
            )}
          />
        ) : (
          <TaskPublishTable
            canEditTasks={canEditTasks}
            canDeleteTasks={canDeleteTasks}
            filteredTasks={filteredTasks}
            userLookup={userLookup}
            handleOpenEditModal={handleOpenEditModal}
            handleDeleteTask={handleDeleteTask}
          />
        )}
      </div>
    </PageLayout>
  );
}

interface TaskPublishOverlaysProps {
  actionSheetOpen: boolean;
  canEditTasks: boolean;
  canDeleteTasks: boolean;
  currentStep: number;
  executorCache: TaskPublishUserLookup;
  executorData: TaskPublishExecutorData;
  executorFilter: { role: string; keyword: string };
  executorLoading: boolean;
  executorPage: number;
  form: typeof INITIAL_FORM;
  handleBulkDeleteTasks: () => Promise<void>;
  handleCloseModal: () => void;
  handleDeleteTask: (task: TaskPublishTask) => Promise<void>;
  handleNextStep: () => void;
  handleOpenEditModal: (task: TaskPublishTask) => void;
  handleSubmit: () => Promise<void>;
  isMobile: boolean;
  mobileFilterOpen: boolean;
  modalMode: TaskPublishModalMode;
  modalVisible: boolean;
  pickerSelection: Set<EntityId>;
  selectedDormIds: EntityId[];
  selectedExecutors: TaskExecutor[];
  selectedTaskIds: EntityId[];
  setActionSheetOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setAppliedDormFilters: React.Dispatch<React.SetStateAction<typeof INITIAL_FILTERS>>;
  setAppliedDormSearch: React.Dispatch<React.SetStateAction<string>>;
  setCurrentStep: React.Dispatch<React.SetStateAction<number>>;
  setDraftDormFilters: React.Dispatch<React.SetStateAction<typeof INITIAL_FILTERS>>;
  setDraftDormSearch: React.Dispatch<React.SetStateAction<string>>;
  setExecutorFilter: React.Dispatch<React.SetStateAction<{ role: string; keyword: string }>>;
  setExecutorPage: React.Dispatch<React.SetStateAction<number>>;
  setForm: React.Dispatch<React.SetStateAction<typeof INITIAL_FORM>>;
  setMobileFilterOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setPickerSelection: React.Dispatch<React.SetStateAction<Set<EntityId>>>;
  setSelectedDormIds: React.Dispatch<React.SetStateAction<EntityId[]>>;
  setSelectedExecutors: React.Dispatch<React.SetStateAction<TaskExecutor[]>>;
  sortedTasks: TaskPublishTask[];
  steps: Array<{ title: string; description?: string }>;
  taskPublishData: TaskPublishDataStore;
  userLookup: TaskPublishUserLookup;
  viewMode: TaskPublishViewMode;
  visibleCount: number;
  draftDormFilters: typeof INITIAL_FILTERS;
  appliedDormFilters: typeof INITIAL_FILTERS;
  draftDormSearch: string;
  appliedDormSearch: string;
  setVisibleCount: React.Dispatch<React.SetStateAction<number>>;
  setViewMode: React.Dispatch<React.SetStateAction<TaskPublishViewMode>>;
}

function TaskPublishOverlays(props: TaskPublishOverlaysProps) {
  return (
    <>
      <TaskPreviewModal
        open={props.modalVisible}
        mode={props.modalMode}
        isMobile={props.isMobile}
        currentStep={props.currentStep}
        steps={props.steps}
        onClose={props.handleCloseModal}
        onPrev={() => props.setCurrentStep((step) => step - 1)}
        onNext={props.handleNextStep}
        onSubmit={() => {
          void props.handleSubmit();
        }}
      >
        <TaskPublishForm
          currentStep={props.currentStep}
          isMobile={props.isMobile}
          form={props.form}
          setForm={props.setForm}
          dorms={props.taskPublishData.dorms}
          draftDormFilters={props.draftDormFilters}
          setDraftDormFilters={props.setDraftDormFilters}
          appliedDormFilters={props.appliedDormFilters}
          setAppliedDormFilters={props.setAppliedDormFilters}
          draftDormSearch={props.draftDormSearch}
          setDraftDormSearch={props.setDraftDormSearch}
          appliedDormSearch={props.appliedDormSearch}
          setAppliedDormSearch={props.setAppliedDormSearch}
          selectedDormIds={props.selectedDormIds}
          setSelectedDormIds={props.setSelectedDormIds}
          visibleCount={props.visibleCount}
          setVisibleCount={props.setVisibleCount}
          viewMode={props.viewMode}
          setViewMode={props.setViewMode}
          mobileFilterOpen={props.mobileFilterOpen}
          setMobileFilterOpen={props.setMobileFilterOpen}
          executorFilter={props.executorFilter}
          setExecutorFilter={props.setExecutorFilter}
          executorPage={props.executorPage}
          setExecutorPage={props.setExecutorPage}
          executorData={props.executorData}
          executorLoading={props.executorLoading}
          pickerSelection={props.pickerSelection}
          setPickerSelection={props.setPickerSelection}
          setSelectedExecutors={props.setSelectedExecutors}
          executorCache={props.executorCache}
          userLookup={props.userLookup}
        />
      </TaskPreviewModal>

      <TaskPublishActionSheet
        canEditTasks={props.canEditTasks}
        canDeleteTasks={props.canDeleteTasks}
        open={props.actionSheetOpen}
        onClose={() => props.setActionSheetOpen(false)}
        selectedTaskIds={props.selectedTaskIds}
        sortedTasks={props.sortedTasks}
        handleOpenEditModal={props.handleOpenEditModal}
        handleDeleteTask={props.handleDeleteTask}
        handleBulkDeleteTasks={props.handleBulkDeleteTasks}
      />

      {props.isMobile && <FloatButton.BackTop className="bottom-24" />}
    </>
  );
}

export default function TaskPublishPage() {
  const { data, actions, hasPermission, permissionsReady, setSelection } = useAppContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const isMobile = useMobile();

  const taskPublishData = createTaskPublishDataStore(data);
  const taskActions = useMemo(() => createTaskPublishActions(actions), [actions]);

  const [form, setForm] = useState(INITIAL_FORM);
  const [selectedDormIds, setSelectedDormIds] = useState<EntityId[]>([]);
  const [draftDormFilters, setDraftDormFilters] = useState(createEmptyDormFilters);
  const [appliedDormFilters, setAppliedDormFilters] = useState(createEmptyDormFilters);
  const [draftDormSearch, setDraftDormSearch] = useState('');
  const [appliedDormSearch, setAppliedDormSearch] = useState('');
  const [draftTaskSearch, setDraftTaskSearch] = useState('');
  const [appliedTaskSearch, setAppliedTaskSearch] = useState('');
  const [draftTaskFilters, setDraftTaskFilters] = useState(INITIAL_TASK_FILTERS);
  const [appliedTaskFilters, setAppliedTaskFilters] = useState(INITIAL_TASK_FILTERS);
  const [executorFilter, setExecutorFilter] = useState({ role: '', keyword: '' });
  const [executorPage, setExecutorPage] = useState(1);
  const [executorData, setExecutorData] = useState<TaskPublishExecutorData>({ items: [], total: 0 });
  const [executorLoading, setExecutorLoading] = useState(false);
  const [pickerSelection, setPickerSelection] = useState<Set<EntityId>>(new Set());
  const [selectedExecutors, setSelectedExecutors] = useState<TaskExecutor[]>([]);
  const [executorCache, setExecutorCache] = useState<TaskPublishUserLookup>({});
  const [editingTaskId, setEditingTaskId] = useState<EntityId | ''>('');
  const [viewMode, setViewMode] = useState<TaskPublishViewMode>(isMobile ? 'card' : 'list');
  const [selectedTaskIds, setSelectedTaskIds] = useState<EntityId[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMode, setModalMode] = useState<TaskPublishModalMode>('create');
  const [currentStep, setCurrentStep] = useState(0);
  const [visibleCount, setVisibleCount] = useState(50);
  const [actionSheetOpen, setActionSheetOpen] = useState(false);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [taskFilterOpen, setTaskFilterOpen] = useState(false);

  // 发布、编辑、删除任务分别对应 TASK_PUBLISH / TASK_EDIT / TASK_DELETE，拥有任一项即可进入本页
  const canCreateTasks = hasPermission('TASK_PUBLISH');
  const canEditTasks = hasPermission('TASK_EDIT');
  const canDeleteTasks = hasPermission('TASK_DELETE');
  const canManageTasks = canCreateTasks || canEditTasks || canDeleteTasks;

  useTaskPublishLifecycle({
    isMobile,
    selectedTaskIds,
    setActionSheetOpen,
    setSelection,
    setSelectedTaskIds,
    taskActions,
  });

  const loadExecutors = useCallback(async (): Promise<void> => {
    setExecutorLoading(true);
    try {
      const response = await taskActions.fetchExecutors({
        page: executorPage,
        pageSize: EXECUTOR_PAGE_SIZE,
        role: executorFilter.role,
        keyword: executorFilter.keyword,
      });
      const items = Array.isArray(response?.users) ? (response.users as TaskExecutor[]) : [];
      setExecutorData({ items, total: response?.total || 0 });
      setExecutorCache((prev) => {
        const next = { ...prev };
        items.forEach((item) => {
          if (item?.id !== undefined && item?.id !== null) {
            next[String(item.id)] = item;
          }
        });
        return next;
      });
    } finally {
      setExecutorLoading(false);
    }
  }, [taskActions, executorFilter.keyword, executorFilter.role, executorPage]);

  useEffect(() => {
    if (modalVisible && currentStep === 2) {
      void loadExecutors();
    }
  }, [currentStep, loadExecutors, modalVisible]);

  const userLookup = useMemo<TaskPublishUserLookup>(() => {
    const next: TaskPublishUserLookup = {};
    taskPublishData.users.forEach((user) => {
      if (user?.id !== undefined && user?.id !== null) {
        next[String(user.id)] = user;
      }
    });
    Object.values(executorCache).forEach((cached) => {
      if (cached?.id !== undefined && cached?.id !== null) {
        next[String(cached.id)] = cached;
      }
    });
    return next;
  }, [executorCache, taskPublishData.users]);

  const sortedTasks = useMemo(
    () => [...taskPublishData.tasks].sort((left, right) => dayjs(right.date).valueOf() - dayjs(left.date).valueOf()),
    [taskPublishData.tasks],
  );
  const taskStats = useMemo(() => getTaskStats(taskPublishData.tasks), [taskPublishData.tasks]);
  const executorOptions = useMemo<TaskFilterOption[]>(
    () =>
      taskPublishData.users
        .filter((user) => user.role && user.role !== 'STUDENT')
        .map((user) => ({
          label: user.fullName || user.username || '未命名',
          value: user.id || '',
        }))
        .filter((option) => option.value !== ''),
    [taskPublishData.users],
  );
  const taskFilterConfig = useMemo(
    () => createTaskFilterConfig({ draftTaskFilters, setDraftTaskFilters, executorOptions }),
    [draftTaskFilters, executorOptions],
  );
  const filteredTasks = useMemo(
    () =>
      filterTasks({
        tasks: sortedTasks,
        searchTerm: appliedTaskSearch,
        filters: appliedTaskFilters,
        userLookup,
      }),
    [sortedTasks, appliedTaskSearch, appliedTaskFilters, userLookup],
  );
  const taskFilterCount = useMemo(() => getTaskFilterCount(draftTaskFilters), [draftTaskFilters]);
  const mobileTaskFilterConfig = useMemo(
    () => createMobileTaskFilterConfig(taskFilterConfig),
    [taskFilterConfig],
  );

  const {
    isTaskDirty,
    handleOpenCreateModal,
    handleOpenEditModal,
    handleCloseModal,
    handleDeleteTask,
    handleBulkDeleteTasks,
    handleSubmit,
    handleNextStep,
    handleTaskSearch,
    handleTaskReset,
  } = useTaskPublishActions({
    actions: taskActions,
    canCreateTasks,
    canEditTasks,
    canDeleteTasks,
    form,
    setForm,
    selectedTaskIds,
    selectedDormIds,
    setSelectedDormIds,
    selectedExecutors,
    setSelectedExecutors,
    setEditingTaskId,
    setPickerSelection,
    setDraftDormFilters,
    setAppliedDormFilters,
    setDraftDormSearch,
    setAppliedDormSearch,
    setCurrentStep,
    setExecutorFilter,
    setExecutorPage,
    setModalMode,
    setModalVisible,
    userLookup,
    editingTaskId,
    currentStep,
    draftTaskFilters,
    appliedTaskFilters,
    draftTaskSearch,
    appliedTaskSearch,
    setDraftTaskFilters,
    setAppliedTaskFilters,
    setDraftTaskSearch,
    setAppliedTaskSearch,
    setSelectedTaskIds,
  });

  useEffect(() => {
    if (!permissionsReady || !canCreateTasks) {
      return;
    }
    if (searchParams.get('action') !== 'create') {
      return;
    }
    handleOpenCreateModal();
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('action');
    setSearchParams(nextParams, { replace: true });
  }, [canCreateTasks, handleOpenCreateModal, permissionsReady, searchParams, setSearchParams]);

  const steps = [
    { title: '任务信息' },
    { title: '宿舍范围', description: isMobile ? `${selectedDormIds.length} 间` : `${selectedDormIds.length} 间宿舍` },
    { title: '检查人', description: isMobile ? `${selectedExecutors.length} 人` : `${selectedExecutors.length} 位检查人` },
  ];

  if (!permissionsReady) {
    return (
      <div className="flex items-center justify-center min-h-screen text-gray-400">
        加载中…
      </div>
    );
  }

  if (!canManageTasks) {
    return (
      <div className="task-publish-page management-theme-page">
        <PermissionDeniedState {...taskPublishPermissionPreset} />
      </div>
    );
  }

  return (
    <div className="task-publish-page management-theme-page">
      <TaskListSection
        canCreateTasks={canCreateTasks}
        canEditTasks={canEditTasks}
        canDeleteTasks={canDeleteTasks}
        draftTaskSearch={draftTaskSearch}
        filteredTasks={filteredTasks}
        handleDeleteTask={handleDeleteTask}
        handleOpenCreateModal={handleOpenCreateModal}
        handleOpenEditModal={handleOpenEditModal}
        handleTaskReset={handleTaskReset}
        handleTaskSearch={handleTaskSearch}
        isMobile={isMobile}
        isTaskDirty={isTaskDirty}
        selectedTaskIds={selectedTaskIds}
        setDraftTaskSearch={setDraftTaskSearch}
        setSelectedTaskIds={setSelectedTaskIds}
        setTaskFilterOpen={setTaskFilterOpen}
        taskFilterConfig={taskFilterConfig}
        taskFilterCount={taskFilterCount}
        taskStats={taskStats}
        userLookup={userLookup}
      />

      <MobileAdvancedFilter
        open={taskFilterOpen}
        onClose={() => setTaskFilterOpen(false)}
        title="筛选任务"
        filters={mobileTaskFilterConfig}
        onReset={handleTaskReset}
        onConfirm={() => setTaskFilterOpen(false)}
      />

      <TaskPublishOverlays
        actionSheetOpen={actionSheetOpen}
        canEditTasks={canEditTasks}
        canDeleteTasks={canDeleteTasks}
        appliedDormFilters={appliedDormFilters}
        appliedDormSearch={appliedDormSearch}
        currentStep={currentStep}
        draftDormFilters={draftDormFilters}
        draftDormSearch={draftDormSearch}
        executorCache={executorCache}
        executorData={executorData}
        executorFilter={executorFilter}
        executorLoading={executorLoading}
        executorPage={executorPage}
        form={form}
        handleBulkDeleteTasks={handleBulkDeleteTasks}
        handleCloseModal={handleCloseModal}
        handleDeleteTask={handleDeleteTask}
        handleNextStep={handleNextStep}
        handleOpenEditModal={handleOpenEditModal}
        handleSubmit={handleSubmit}
        isMobile={isMobile}
        mobileFilterOpen={mobileFilterOpen}
        modalMode={modalMode}
        modalVisible={modalVisible}
        pickerSelection={pickerSelection}
        selectedDormIds={selectedDormIds}
        selectedExecutors={selectedExecutors}
        selectedTaskIds={selectedTaskIds}
        setActionSheetOpen={setActionSheetOpen}
        setAppliedDormFilters={setAppliedDormFilters}
        setAppliedDormSearch={setAppliedDormSearch}
        setCurrentStep={setCurrentStep}
        setDraftDormFilters={setDraftDormFilters}
        setDraftDormSearch={setDraftDormSearch}
        setExecutorFilter={setExecutorFilter}
        setExecutorPage={setExecutorPage}
        setForm={setForm}
        setMobileFilterOpen={setMobileFilterOpen}
        setPickerSelection={setPickerSelection}
        setSelectedDormIds={setSelectedDormIds}
        setSelectedExecutors={setSelectedExecutors}
        setViewMode={setViewMode}
        setVisibleCount={setVisibleCount}
        sortedTasks={sortedTasks}
        steps={steps}
        taskPublishData={taskPublishData}
        userLookup={userLookup}
        viewMode={viewMode}
        visibleCount={visibleCount}
      />
    </div>
  );
}
