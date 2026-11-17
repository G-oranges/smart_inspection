import { useMemo, useRef } from 'react';
import { ExclamationCircleOutlined } from '@ant-design/icons';
import { Modal, message as antMessage } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';

import {
  createEmptyDormFilters,
  INITIAL_FORM,
  INITIAL_TASK_FILTERS,
} from './taskPublishSchema';
import { areTaskFiltersEqual } from './utils';
import { confirmDangerCountdown } from '../../utils/confirm';

import type { EntityId } from '../../types/service';
import type {
  TaskPublishTask,
  TaskSubmitPayload,
  UseTaskPublishActionsProps,
  UseTaskPublishActionsResult,
} from './types';

interface TaskPublishDraftSnapshot {
  title: string;
  startAt: string;
  deadline: string;
  notes: string;
  dormIds: string[];
  executorIds: string[];
}

function readErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

function normalizeEntityIds(value: unknown): EntityId[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (item): item is EntityId => typeof item === 'string' || typeof item === 'number',
  );
}

function normalizeEntityIdList(value: unknown): string[] {
  return normalizeEntityIds(value).map(String).sort();
}

function normalizeSnapshotDate(value: Dayjs | string | null | undefined): string {
  if (!value) {
    return '';
  }

  const parsed = typeof value === 'string' ? dayjs(value) : value;
  return parsed.isValid() ? String(parsed.valueOf()) : '';
}

function createEmptyDraftSnapshot(): TaskPublishDraftSnapshot {
  return {
    title: '',
    startAt: '',
    deadline: '',
    notes: '',
    dormIds: [],
    executorIds: [],
  };
}

function createDraftSnapshot(params: {
  title?: string;
  startAt?: Dayjs | string | null;
  deadline?: Dayjs | string | null;
  notes?: string;
  dormIds?: unknown;
  executorIds?: unknown;
}): TaskPublishDraftSnapshot {
  return {
    title: params.title || '',
    startAt: normalizeSnapshotDate(params.startAt),
    deadline: normalizeSnapshotDate(params.deadline),
    notes: params.notes || '',
    dormIds: normalizeEntityIdList(params.dormIds),
    executorIds: normalizeEntityIdList(params.executorIds),
  };
}

function areDraftSnapshotsEqual(
  left: TaskPublishDraftSnapshot,
  right: TaskPublishDraftSnapshot,
): boolean {
  return (
    left.title === right.title &&
    left.startAt === right.startAt &&
    left.deadline === right.deadline &&
    left.notes === right.notes &&
    left.dormIds.length === right.dormIds.length &&
    left.executorIds.length === right.executorIds.length &&
    left.dormIds.every((value, index) => value === right.dormIds[index]) &&
    left.executorIds.every((value, index) => value === right.executorIds[index])
  );
}

export function useTaskPublishActions({
  actions,
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
}: UseTaskPublishActionsProps): UseTaskPublishActionsResult {
  const isTaskDirty = useMemo(() => {
    if (draftTaskSearch.trim() !== appliedTaskSearch.trim()) {
      return true;
    }
    return !areTaskFiltersEqual(draftTaskFilters, appliedTaskFilters);
  }, [
    draftTaskFilters,
    appliedTaskFilters,
    draftTaskSearch,
    appliedTaskSearch,
  ]);
  const initialDraftSnapshotRef = useRef<TaskPublishDraftSnapshot>(createEmptyDraftSnapshot());

  const clearDraftSnapshot = (): void => {
    initialDraftSnapshotRef.current = createEmptyDraftSnapshot();
  };

  const getCurrentDraftSnapshot = (): TaskPublishDraftSnapshot =>
    createDraftSnapshot({
      title: form.title,
      startAt: form.startAt,
      deadline: form.deadline,
      notes: form.notes,
      dormIds: selectedDormIds,
      executorIds: selectedExecutors.map((item) => item.id),
    });

  const hasUnsavedDraft = (): boolean =>
    !areDraftSnapshotsEqual(getCurrentDraftSnapshot(), initialDraftSnapshotRef.current);

  const closeModalImmediately = (): void => {
    setModalVisible(false);
    resetTaskForm();
  };

  const resetTaskForm = (): void => {
    clearDraftSnapshot();
    setForm(INITIAL_FORM);
    setSelectedDormIds([]);
    setSelectedExecutors([]);
    setEditingTaskId('');
    setPickerSelection(new Set<EntityId>());
    setDraftDormFilters(createEmptyDormFilters());
    setAppliedDormFilters(createEmptyDormFilters());
    setDraftDormSearch('');
    setAppliedDormSearch('');
    setCurrentStep(0);
    setExecutorFilter({ role: '', keyword: '' });
    setExecutorPage(1);
  };

  const handleOpenCreateModal = (): void => {
    if (!canCreateTasks) {
      antMessage.warning('当前角色无发布任务权限');
      return;
    }

    resetTaskForm();
    setModalMode('create');
    setModalVisible(true);
  };

  const handleOpenEditModal = (task: TaskPublishTask): void => {
    if (!canEditTasks) {
      antMessage.warning('当前角色无编辑任务权限');
      return;
    }

    const taskId = task.id ?? '';
    const executorIds = normalizeEntityIds(task.executorIds);
    const dormIds = normalizeEntityIds(task.dormIds);
    initialDraftSnapshotRef.current = createDraftSnapshot({
      title: task.title || '',
      startAt: task.date || null,
      deadline: task.deadline || null,
      notes: task.notes || '',
      dormIds,
      executorIds,
    });

    setEditingTaskId(taskId);
    setForm({
      title: task.title || '',
      startAt: task.date ? dayjs(task.date) : null,
      deadline: task.deadline ? dayjs(task.deadline) : null,
      notes: task.notes || '',
    });
    setSelectedDormIds(dormIds);
    setSelectedExecutors(
      executorIds.map((id) => {
        const cacheKey = String(id);
        return userLookup[cacheKey] || { id, fullName: '加载中...', _needsUpdate: true };
      }),
    );
    setPickerSelection(new Set(executorIds));
    setModalMode('edit');
    setModalVisible(true);
  };

  const handleCloseModal = (): void => {
    if (!hasUnsavedDraft()) {
      closeModalImmediately();
      return;
    }

    Modal.confirm({
      title: '确认退出',
      content: '当前有未保存的修改，退出后将丢失这些更改。',
      okText: '确认退出',
      cancelText: '继续编辑',
      maskClosable: false,
      keyboard: false,
      className: 'apple-modal',
      onOk: closeModalImmediately,
    });
  };

  const handleDeleteTask = async (record: TaskPublishTask): Promise<void> => {
    if (!canDeleteTasks) {
      antMessage.warning('当前角色无删除任务权限');
      return;
    }

    const finalConfirmed = await confirmDangerCountdown({
      title: '是否确认 - 删除任务',
      content: '删除任务将同步删除该任务下所有评分记录，且无法恢复。',
      okText: '确认删除',
    });
    if (!finalConfirmed) {
      return;
    }

    try {
      if (record.id === undefined || record.id === null) {
        throw new Error('任务 ID 缺失');
      }
      await actions.deleteTask(record.id);
      antMessage.success('任务已成功删除');
    } catch (error) {
      antMessage.error(readErrorMessage(error, '删除失败'));
    }
  };

  const handleBulkDeleteTasks = async (
    taskIds = selectedTaskIds,
  ): Promise<void> => {
    if (!canDeleteTasks) {
      antMessage.warning('当前角色无删除任务权限');
      return;
    }

    const ids = Array.isArray(taskIds) ? taskIds : [];
    if (!ids.length) {
      return;
    }

    const firstConfirmed = await new Promise<boolean>((resolve) => {
      Modal.confirm({
        title: '确认批量删除任务',
        icon: <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />,
        content: `即将删除 ${ids.length} 个任务及其评分记录，删除后无法恢复。`,
        okText: '确认删除',
        okType: 'danger',
        cancelText: '取消',
        maskClosable: false,
        keyboard: false,
        onOk: () => resolve(true),
        onCancel: () => resolve(false),
        className: 'apple-modal',
      });
    });
    if (!firstConfirmed) {
      return;
    }

    const finalConfirmed = await confirmDangerCountdown({
      title: '是否确认 - 批量删除任务',
      content: `将永久删除选中的 ${ids.length} 个任务，确认继续？`,
      okText: '确认删除',
    });
    if (!finalConfirmed) {
      return;
    }

    try {
      await Promise.all(ids.map((id) => actions.deleteTask(id)));
      setSelectedTaskIds([]);
      antMessage.success('批量删除成功');
    } catch (error) {
      antMessage.error(readErrorMessage(error, '删除失败'));
    }
  };

  const handleSubmit = async (): Promise<void> => {
    const isEdit = Boolean(editingTaskId);
    if (isEdit ? !canEditTasks : !canCreateTasks) {
      antMessage.warning(isEdit ? '当前角色无编辑任务权限' : '当前角色无发布任务权限');
      return;
    }
    if (!form.title.trim()) {
      antMessage.warning('请输入任务标题');
      return;
    }
    if (!form.startAt || !form.deadline) {
      antMessage.warning('请设置时间段');
      return;
    }

    const confirmed = await new Promise<boolean>((resolve) => {
      Modal.confirm({
        title: isEdit ? '确认更新任务' : '确认发布任务',
        content: isEdit
          ? `即将更新任务「${form.title || '未命名任务'}」，确认继续？`
          : `即将发布任务「${form.title || '未命名任务'}」，确认继续？`,
        okText: isEdit ? '确认更新' : '确认发布',
        cancelText: '取消',
        maskClosable: false,
        keyboard: false,
        onOk: () => resolve(true),
        onCancel: () => resolve(false),
      });
    });
    if (!confirmed) {
      return;
    }

    const payload: TaskSubmitPayload = {
      title: form.title,
      date: form.startAt.toISOString(),
      deadline: form.deadline.toISOString(),
      notes: form.notes,
      dormIds: selectedDormIds,
      executors: selectedExecutors
        .map((item) => item.id)
        .filter((item): item is EntityId => item !== undefined && item !== null),
    };

    try {
      if (editingTaskId) {
        await actions.updateTask(editingTaskId, payload);
        antMessage.success('任务更新成功');
      } else {
        await actions.createTask(payload);
        antMessage.success('任务已发布');
      }
      closeModalImmediately();
    } catch (error) {
      antMessage.error(readErrorMessage(error, '操作失败'));
    }
  };

  const handleNextStep = (): void => {
    if (currentStep === 0) {
      if (!form.title.trim()) {
        antMessage.warning('请输入任务标题');
        return;
      }
      if (!form.startAt || !form.deadline) {
        antMessage.warning('请设置时间段');
        return;
      }
    }

    setCurrentStep((step) => step + 1);
  };

  const handleTaskSearch = (): void => {
    if (!isTaskDirty) {
      return;
    }
    setAppliedTaskFilters(draftTaskFilters);
    setAppliedTaskSearch(draftTaskSearch);
    setSelectedTaskIds([]);
  };

  const handleTaskReset = (): void => {
    setDraftTaskFilters(INITIAL_TASK_FILTERS);
    setAppliedTaskFilters(INITIAL_TASK_FILTERS);
    setDraftTaskSearch('');
    setAppliedTaskSearch('');
    setSelectedTaskIds([]);
  };

  return {
    isTaskDirty,
    resetTaskForm,
    handleOpenCreateModal,
    handleOpenEditModal,
    handleCloseModal,
    handleDeleteTask,
    handleBulkDeleteTasks,
    handleSubmit,
    handleNextStep,
    handleTaskSearch,
    handleTaskReset,
  };
}
