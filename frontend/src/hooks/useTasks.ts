import { useCallback, useState } from 'react';

import { taskService } from '../services/taskService';
import { tokenManager } from '../utils/api';

import type { RoleLike, UserLike } from '../types/app';
import type {
  AppealHandlePayload,
  AppealsListResponse,
  AssignedDormsResponse,
  EntityId,
  InspectionsListResponse,
  ScoreAdjustmentPayload,
  ScoreSubmissionPayload,
  ServiceQueryParams,
  ServiceRecord,
  TasksListResponse,
} from '../types/service';

type TaskCollectionKey =
  | 'tasks'
  | 'inspections'
  | 'myInspections'
  | 'appeals'
  | 'myAppeals';

interface TaskCollections {
  tasks: ServiceRecord[];
  inspections: ServiceRecord[];
  myInspections: ServiceRecord[];
  appeals: ServiceRecord[];
  myAppeals: ServiceRecord[];
}

type LoadedState = Record<TaskCollectionKey, boolean>;

const INITIAL_COLLECTIONS: TaskCollections = {
  tasks: [],
  inspections: [],
  myInspections: [],
  appeals: [],
  myAppeals: [],
};

const INITIAL_LOADED_STATE: LoadedState = {
  tasks: false,
  inspections: false,
  myInspections: false,
  appeals: false,
  myAppeals: false,
};

async function loadCollection<T>({
  loaded,
  force,
  fetcher,
  onSuccess,
  logLabel,
}: {
  loaded: boolean;
  force: boolean;
  fetcher: () => Promise<T>;
  onSuccess: (result: T) => void;
  logLabel: string;
}): Promise<void> {
  if (loaded && !force) {
    return;
  }

  try {
    const data = await fetcher();
    onSuccess(data);
  } catch (error) {
    console.error(`Failed to fetch ${logLabel}`, error);
  }
}

function useTaskMutations({
  fetchTasks,
  refreshInspections,
  refreshAppeals,
  refreshScoreData,
}: {
  fetchTasks: (force?: boolean) => Promise<void>;
  refreshInspections: () => Promise<void>;
  refreshAppeals: () => Promise<void>;
  refreshScoreData: () => Promise<void>;
}) {
  const createTask = useCallback(async (payload: ServiceRecord): Promise<void> => {
    await taskService.createTask(payload);
    await fetchTasks(true);
  }, [fetchTasks]);

  const updateTask = useCallback(
    async (taskId: EntityId, payload: ServiceRecord): Promise<void> => {
      await taskService.updateTask(taskId, payload);
      await fetchTasks(true);
    },
    [fetchTasks],
  );

  const deleteTask = useCallback(async (taskId: EntityId): Promise<void> => {
    await taskService.deleteTask(taskId);
    await fetchTasks(true);
  }, [fetchTasks]);

  const deleteInspection = useCallback(
    async (inspectionId: EntityId): Promise<void> => {
      await taskService.deleteInspection(inspectionId);
      await refreshInspections();
    },
    [refreshInspections],
  );

  const deleteInspections = useCallback(
    async (ids: EntityId[]): Promise<void> => {
      await taskService.deleteInspections(ids);
      await refreshInspections();
    },
    [refreshInspections],
  );

  const submitScore = useCallback(
    async (payload: ScoreSubmissionPayload): Promise<void> => {
      await taskService.submitScore(payload);
      await refreshScoreData();
    },
    [refreshScoreData],
  );

  const adjustScore = useCallback(
    async (payload: ScoreAdjustmentPayload): Promise<void> => {
      await taskService.adjustScore(payload);
      await refreshScoreData();
    },
    [refreshScoreData],
  );

  const handleAppeal = useCallback(
    async (payload: AppealHandlePayload): Promise<void> => {
      await taskService.handleAppeal(payload);
      await refreshAppeals();
    },
    [refreshAppeals],
  );

  const createAppeal = useCallback(
    async (payload: ServiceRecord): Promise<void> => {
      await taskService.createAppeal(payload);
      await refreshAppeals();
    },
    [refreshAppeals],
  );

  const loadInspectionRecord = useCallback(
    (taskId?: EntityId, dormId?: EntityId): Promise<InspectionsListResponse> =>
      taskService.loadInspectionRecord(taskId, dormId),
    [],
  );

  const fetchAssignedDorms = useCallback(
    (
      taskId?: EntityId,
      params: ServiceQueryParams = {},
    ): Promise<AssignedDormsResponse> => taskService.fetchAssignedDorms(taskId, params),
    [],
  );

  const exportResults = useCallback(
    (params: ServiceQueryParams = {}): Promise<Blob> =>
      taskService.exportResults(params),
    [],
  );

  return {
    createTask,
    updateTask,
    deleteTask,
    deleteInspection,
    deleteInspections,
    submitScore,
    adjustScore,
    handleAppeal,
    createAppeal,
    loadInspectionRecord,
    fetchAssignedDorms,
    exportResults,
  };
}

export function useTasks(user?: UserLike | null, activeRole?: RoleLike | null) {
  const [collections, setCollections] = useState<TaskCollections>(INITIAL_COLLECTIONS);
  const [loaded, setLoaded] = useState<LoadedState>(INITIAL_LOADED_STATE);

  const currentRole = activeRole?.code || user?.role;

  const setCollection = useCallback((key: TaskCollectionKey, items: ServiceRecord[]) => {
    setCollections((prev) => ({ ...prev, [key]: items }));
  }, []);

  const setLoadedFlag = useCallback((key: TaskCollectionKey, value: boolean) => {
    setLoaded((prev) => ({ ...prev, [key]: value }));
  }, []);

  const resetStudentScopedCollection = useCallback(
    (key: 'myInspections' | 'myAppeals', force: boolean): void => {
      if (!loaded[key] || force) {
        setCollection(key, []);
        setLoadedFlag(key, true);
      }
    },
    [loaded, setCollection, setLoadedFlag],
  );

  const fetchTasks = useCallback(async (force = false): Promise<void> => {
    if (!tokenManager.hasTokens()) {
      return;
    }

    await loadCollection<TasksListResponse>({
      loaded: loaded.tasks,
      force,
      fetcher: () => taskService.getTasks(),
      onSuccess: (data) => {
        setCollection('tasks', data.tasks || []);
        setLoadedFlag('tasks', true);
      },
      logLabel: 'tasks',
    });
  }, [loaded.tasks, setCollection, setLoadedFlag]);

  const fetchInspections = useCallback(async (force = false): Promise<void> => {
    if (!tokenManager.hasTokens()) {
      return;
    }

    await loadCollection<InspectionsListResponse>({
      loaded: loaded.inspections,
      force,
      fetcher: () => taskService.getInspections(),
      onSuccess: (data) => {
        setCollection('inspections', data.inspections || []);
        setLoadedFlag('inspections', true);
      },
      logLabel: 'inspections',
    });
  }, [loaded.inspections, setCollection, setLoadedFlag]);

  const fetchMyInspections = useCallback(async (force = false): Promise<void> => {
    if (!tokenManager.hasTokens()) {
      return;
    }

    if (currentRole !== 'STUDENT') {
      resetStudentScopedCollection('myInspections', force);
      return;
    }

    await loadCollection<InspectionsListResponse>({
      loaded: loaded.myInspections,
      force,
      fetcher: () => taskService.getMyInspections(),
      onSuccess: (data) => {
        setCollection('myInspections', data.inspections || []);
        setLoadedFlag('myInspections', true);
      },
      logLabel: 'my inspections',
    });
  }, [currentRole, loaded.myInspections, resetStudentScopedCollection, setCollection, setLoadedFlag]);

  const fetchAppeals = useCallback(async (force = false): Promise<void> => {
    if (!tokenManager.hasTokens()) {
      return;
    }

    await loadCollection<AppealsListResponse>({
      loaded: loaded.appeals,
      force,
      fetcher: () => taskService.getAppeals(),
      onSuccess: (data) => {
        setCollection('appeals', data.appeals || []);
        setLoadedFlag('appeals', true);
      },
      logLabel: 'appeals',
    });
  }, [loaded.appeals, setCollection, setLoadedFlag]);

  const fetchMyAppeals = useCallback(async (force = false): Promise<void> => {
    if (!tokenManager.hasTokens()) {
      return;
    }

    if (currentRole !== 'STUDENT') {
      resetStudentScopedCollection('myAppeals', force);
      return;
    }

    await loadCollection<AppealsListResponse>({
      loaded: loaded.myAppeals,
      force,
      fetcher: () => taskService.getMyAppeals(),
      onSuccess: (data) => {
        setCollection('myAppeals', data.appeals || []);
        setLoadedFlag('myAppeals', true);
      },
      logLabel: 'my appeals',
    });
  }, [currentRole, loaded.myAppeals, resetStudentScopedCollection, setCollection, setLoadedFlag]);

  const refreshInspections = useCallback(
    async (): Promise<void> => {
      await Promise.all([fetchInspections(true), fetchMyInspections(true)]);
    },
    [fetchInspections, fetchMyInspections],
  );

  const refreshAppeals = useCallback(
    async (): Promise<void> => {
      await Promise.all([fetchAppeals(true), fetchMyAppeals(true)]);
    },
    [fetchAppeals, fetchMyAppeals],
  );

  const refreshScoreData = useCallback(
    async (): Promise<void> => {
      await Promise.all([fetchInspections(true), fetchMyInspections(true), fetchTasks(true)]);
    },
    [fetchInspections, fetchMyInspections, fetchTasks],
  );

  const taskMutations = useTaskMutations({
    fetchTasks,
    refreshInspections,
    refreshAppeals,
    refreshScoreData,
  });

  return {
    tasks: collections.tasks,
    inspections: collections.inspections,
    myInspections: collections.myInspections,
    appeals: collections.appeals,
    myAppeals: collections.myAppeals,
    fetchTasks,
    fetchInspections,
    fetchMyInspections,
    fetchAppeals,
    fetchMyAppeals,
    ...taskMutations,
  };
}
