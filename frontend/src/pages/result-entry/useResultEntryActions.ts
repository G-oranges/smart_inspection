import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import { App, Modal } from 'antd';

import { gradeLabelFromRules } from '../../utils/settings';
import {
  DEFAULT_DEDUCTIONS,
  INITIAL_FORM,
  STORAGE_KEY_PREFIX,
} from './resultEntrySchema';
import {
  computeWindow,
  createFormSnapshot,
  getScoreColor,
  resolveLocationOrder,
  sortDormsByRoomNo,
} from './utils';

import type { EntityId } from '../../types/service';
import type {
  ResultEntryDeductionItem,
  ResultEntryDeductionRow,
  ResultEntryDorm,
  ResultEntryFormState,
  ResultEntryHookProps,
  ResultEntryHookResult,
  ResultEntryInspectionRecord,
  ResultEntryMember,
  ResultEntryNewDeductionForm,
  ResultEntryTask,
} from './types';

function createDefaultForm(defaultScore: number): ResultEntryFormState {
  return {
    ...INITIAL_FORM,
    totalScore: String(defaultScore),
  };
}

function readErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (item): item is string => typeof item === 'string' && item.trim().length > 0,
  );
}

function normalizeDeductionRows(value: unknown): ResultEntryDeductionRow[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item, index) => {
      const record = item as Partial<ResultEntryDeductionRow>;
      return {
        id: record.id ?? `${record.code ?? 'deduction'}-${index}`,
        code: typeof record.code === 'string' ? record.code : '',
        count: Number(record.count) || 1,
        locations: toStringArray(record.locations),
      };
    })
    .filter((item) => item.code);
}

export function useResultEntryActions({
  building,
  floor,
  room,
  campusParam,
  taskIdParam,
  navigate,
  data,
  actions,
  hasPermission,
  settings,
  user,
  activeRole,
}: ResultEntryHookProps): ResultEntryHookResult {
  const defaultScore = settings?.inspectionDefaultScore ?? 100;
  const { message: antdMessage } = App.useApp();

  // 使用 ref 稳定 actions 引用，防止 actions 对象变化导致 useEffect 死循环
  const actionsRef = useRef(actions);
  actionsRef.current = actions;

  const [selectedTaskId, setSelectedTaskId] = useState(taskIdParam || '');
  const [form, setForm] = useState<ResultEntryFormState>(() =>
    createDefaultForm(defaultScore),
  );
  const [baseScore, setBaseScore] = useState(() => String(defaultScore));
  const [editingScore, setEditingScore] = useState(false);
  const [members, setMembers] = useState<ResultEntryMember[]>([]);
  const [inspectionRecord, setInspectionRecord] =
    useState<ResultEntryInspectionRecord | null>(null);
  const [, setInspectionLoading] = useState(false);
  const [, setInspectionError] = useState('');
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [, setDormLoading] = useState(true);
  const [, setDormError] = useState('');
  const [selectedDorm, setSelectedDorm] = useState<ResultEntryDorm | null>(null);
  const [assignedDorms, setAssignedDorms] = useState<ResultEntryDorm[]>([]);
  const [assignmentLoading, setAssignmentLoading] = useState(false);
  const [assignmentError, setAssignmentError] = useState('');
  const [assignmentChecked, setAssignmentChecked] = useState(false);
  const [currentAssignment, setCurrentAssignment] =
    useState<ResultEntryDorm | null>(null);
  const [appliedDeductions, setAppliedDeductions] = useState<
    ResultEntryDeductionRow[]
  >([]);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [currentEditingRowId, setCurrentEditingRowId] = useState<EntityId | null>(
    null,
  );
  const [initialStateSnapshot, setInitialStateSnapshot] = useState<string | null>(
    null,
  );
  const [showAddDeductionDrawer, setShowAddDeductionDrawer] = useState(false);
  const [newDeductionForm, setNewDeductionForm] =
    useState<ResultEntryNewDeductionForm>({
      id: null,
      code: '',
      count: 1,
      locations: [],
    });
  const [isScrolled, setIsScrolled] = useState(false);
  const mainRef = useRef<HTMLDivElement>(null);
  const [clickCount, setClickCount] = useState(0);
  const clickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [pendingNavigatePath, setPendingNavigatePath] = useState<string | null>(
    null,
  );

  useEffect(() => {
    const mainElement =
      (document.querySelector('main.overflow-y-auto') as HTMLElement | null) ??
      mainRef.current;

    if (!mainElement) {
      return undefined;
    }

    const handleScroll = () => {
      setIsScrolled(mainElement.scrollTop > 60);
    };

    mainElement.addEventListener('scroll', handleScroll, { passive: true });
    return () => mainElement.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    return () => {
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
      }
    };
  }, []);

  const canRecord = hasPermission('RESULT_RECORD');

  const handleScoreClick = (): void => {
    if (clickCount === 0) {
      setClickCount(1);
      antdMessage.info('再点击一次修改基础分');
      clickTimeoutRef.current = setTimeout(() => {
        setClickCount(0);
      }, 2000);
      return;
    }

    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
    }
    setClickCount(0);
    if (canSubmit) {
      setEditingScore(true);
    }
  };

  useEffect(() => {
    let cancelled = false;

    if (!selectedTaskId || !selectedDorm?.id) {
      setInspectionRecord(null);
      setInspectionError('');
      setInspectionLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setInspectionLoading(true);
    setInspectionError('');
    actionsRef.current
      .loadInspectionRecord(selectedTaskId, selectedDorm.id)
      .then((result) => {
        if (cancelled) {
          return;
        }

        const record = result?.inspections?.[0] ?? null;
        const recordPhotos = toStringArray(record?.photoUrls);
        const hasRecordedScore =
          record?.totalScore !== null &&
          record?.totalScore !== undefined &&
          !Number.isNaN(Number(record.totalScore));
        const numericRecordScore = hasRecordedScore
          ? Number(record?.totalScore)
          : defaultScore;

        setInspectionRecord(record);
        setForm((prev) => ({
          ...prev,
          dormId: selectedDorm.id ?? '',
          totalScore: String(numericRecordScore),
          comments: record?.comments || '',
          photoUrls: recordPhotos,
        }));

        if (hasRecordedScore) {
          const loadedDeductions = normalizeDeductionRows(record?.detail);
          setAppliedDeductions(loadedDeductions);

          const validDeductionsList: ResultEntryDeductionItem[] =
            Array.isArray(settings?.deductionItems) && settings.deductionItems.length
              ? settings.deductionItems
              : DEFAULT_DEDUCTIONS;

          const deductionSum = loadedDeductions.reduce((sum, row) => {
            const item = validDeductionsList.find((entry) => entry.code === row.code);
            return sum + (Number(item?.points) || 0) * (row.count || 1);
          }, 0);

          const finalBaseScore = String(numericRecordScore + deductionSum);
          setBaseScore(finalBaseScore);
          setInitialStateSnapshot(
            JSON.stringify({
              deductions: loadedDeductions,
              photos: recordPhotos,
              comments: record?.comments || '',
              baseScore: finalBaseScore,
            }),
          );
          return;
        }

        const finalBaseScore = String(defaultScore);
        setBaseScore(finalBaseScore);
        setAppliedDeductions([]);
        setInitialStateSnapshot(
          JSON.stringify({
            deductions: [],
            photos: [],
            comments: '',
            baseScore: finalBaseScore,
          }),
        );
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setInspectionRecord(null);
        setForm((prev) => ({
          ...prev,
          dormId: selectedDorm.id ?? '',
          totalScore: String(defaultScore),
          comments: '',
          photoUrls: [],
        }));
        setBaseScore(String(defaultScore));
        setInspectionError(readErrorMessage(error, '加载查寝记录失败'));
      })
      .finally(() => {
        if (!cancelled) {
          setInspectionLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [defaultScore, selectedDorm?.id, selectedTaskId, settings?.deductionItems]);

  useEffect(() => {
    let cancelled = false;

    if (hasPermission('RESULT_RECORD')) {
      const taskPromise = actionsRef.current.loadTasks?.();
      taskPromise?.catch((error) => {
        if (!cancelled) {
          console.error('加载任务失败', error);
        }
      });
    }

    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasPermission]);

  useEffect(() => {
    if (taskIdParam) {
      setSelectedTaskId(taskIdParam);
      return;
    }

    if (!user?.id || selectedTaskId) {
      return;
    }

    try {
      const stored = sessionStorage.getItem(`${STORAGE_KEY_PREFIX}${user.id}`);
      if (stored) {
        setSelectedTaskId(stored);
      }
    } catch (error) {
      console.error('读取查寝任务选择失败', error);
    }
  }, [selectedTaskId, taskIdParam, user?.id]);

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    try {
      const key = `${STORAGE_KEY_PREFIX}${user.id}`;
      if (selectedTaskId) {
        sessionStorage.setItem(key, selectedTaskId);
      } else {
        sessionStorage.removeItem(key);
      }
    } catch (error) {
      console.error('保存查寝任务选择失败', error);
    }
  }, [selectedTaskId, user?.id]);

  useEffect(() => {
    let cancelled = false;

    if (!selectedTaskId || !building || !floor) {
      setAssignedDorms([]);
      setCurrentAssignment(null);
      setAssignmentLoading(false);
      setAssignmentError('');
      return () => {
        cancelled = true;
      };
    }

    setAssignmentLoading(true);
    setAssignmentError('');
    setAssignmentChecked(false);
    actionsRef.current
      .fetchAssignedDorms(selectedTaskId, {
        building,
        floor,
        campus: campusParam,
      })
      .then((response) => {
        if (cancelled) {
          return;
        }

        setAssignedDorms(Array.isArray(response?.dorms) ? response.dorms : []);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setAssignedDorms([]);
        setAssignmentError(readErrorMessage(error, '加载可录入宿舍失败'));
      })
      .finally(() => {
        if (!cancelled) {
          setAssignmentLoading(false);
          setAssignmentChecked(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [building, campusParam, floor, selectedTaskId]);

  useEffect(() => {
    let cancelled = false;

    if (!selectedTaskId) {
      return () => {
        cancelled = true;
      };
    }

    actionsRef.current.fetchAssignedDorms(selectedTaskId).catch(() => {
      if (cancelled) {
        return;
      }
    });

    return () => {
      cancelled = true;
    };
  }, [selectedTaskId]);

  const hasLocationInfo = Boolean(building && floor && room);

  useEffect(() => {
    let cancelled = false;

    if (!hasLocationInfo) {
      setSelectedDorm(null);
      setDormError('楼栋/楼层/房间信息缺失');
      setDormLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setDormLoading(true);
    setDormError('');
    actionsRef.current
      .fetchDormByLocation({
        building,
        floor,
        roomNo: room,
        campus: campusParam,
      })
      .then((response) => {
        if (cancelled) {
          return;
        }

        const dorm = response?.dorm;
        if (!dorm) {
          setSelectedDorm(null);
          setDormError('未找到对应宿舍');
          return;
        }

        setSelectedDorm(dorm);
        setForm((prev) => ({
          ...prev,
          dormId: dorm.id ?? '',
        }));
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setSelectedDorm(null);
        setDormError(readErrorMessage(error, '加载宿舍信息失败'));
      })
      .finally(() => {
        if (!cancelled) {
          setDormLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [building, campusParam, floor, hasLocationInfo, room]);

  useEffect(() => {
    if (!selectedDorm?.id) {
      setMembers([]);
      return;
    }

    setLoadingMembers(true);
    actionsRef.current
      .fetchDormMembers(selectedDorm.id)
      .then((response) =>
        setMembers(Array.isArray(response?.members) ? response.members : []),
      )
      .catch(() => setMembers([]))
      .finally(() => setLoadingMembers(false));
  }, [selectedDorm?.id]);

  useEffect(() => {
    const match = assignedDorms.find(
      (item) =>
        item.building === building &&
        String(item.floor ?? '') === String(floor) &&
        String(item.roomNo ?? '') === String(room),
    );
    setCurrentAssignment(match ?? null);
  }, [assignedDorms, building, floor, room]);

  useEffect(() => {
    if (
      assignmentChecked &&
      !assignmentLoading &&
      !currentAssignment &&
      selectedTaskId &&
      hasLocationInfo
    ) {
      setDormError(assignmentError || '本次任务未为您分配该宿舍或您无权录入');
    }
  }, [
    assignmentChecked,
    assignmentError,
    assignmentLoading,
    currentAssignment,
    hasLocationInfo,
    selectedTaskId,
  ]);

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      totalScore: prev.totalScore || String(defaultScore),
    }));
    setBaseScore(String(defaultScore));
  }, [defaultScore]);

  useEffect(() => {
    setAppliedDeductions([]);
    setBaseScore(String(defaultScore));
  }, [defaultScore, selectedDorm?.id]);

  const selectedTask = useMemo<ResultEntryTask | null>(() => {
    return (
      data.tasks.find(
        (task) => String(task.id ?? '') === String(selectedTaskId || ''),
      ) ?? null
    );
  }, [data.tasks, selectedTaskId]);

  const enabledDeductions = useMemo<ResultEntryDeductionItem[]>(() => {
    const list =
      Array.isArray(settings?.deductionItems) && settings.deductionItems.length
        ? settings.deductionItems
        : DEFAULT_DEDUCTIONS;

    return list
      .filter((item) => item && item.enabled !== false)
      .map((item) => ({
        ...item,
        points: Number(item.points) || 0,
        maxPoints:
          item.maxPoints !== null &&
          item.maxPoints !== undefined &&
          item.maxPoints !== ''
            ? Number(item.maxPoints)
            : Infinity,
      }));
  }, [settings?.deductionItems]);

  const deductionTotal = useMemo(() => {
    return appliedDeductions.reduce((sum, row) => {
      const item = enabledDeductions.find((entry) => entry.code === row.code);
      return sum + (item ? (Number(item.points) || 0) * (row.count || 1) : 0);
    }, 0);
  }, [appliedDeductions, enabledDeductions]);

  useEffect(() => {
    const parsedBase = parseInt(baseScore, 10);
    const safeBase = Number.isNaN(parsedBase) ? defaultScore : parsedBase;
    const clampedBase = Math.min(100, Math.max(0, safeBase));
    const total = Math.max(0, clampedBase - deductionTotal);
    setForm((prev) => ({
      ...prev,
      totalScore: String(total),
    }));
  }, [baseScore, deductionTotal, defaultScore]);

  const numericScore = useMemo(() => {
    const parsed = parseInt(form.totalScore, 10);
    if (Number.isNaN(parsed)) {
      return 0;
    }

    return Math.max(0, Math.min(100, parsed));
  }, [form.totalScore]);

  const currentRating = useMemo(() => {
    const label = gradeLabelFromRules(
      numericScore,
      settings?.gradingRules as Parameters<typeof gradeLabelFromRules>[1],
    );
    return typeof label === 'string' ? label : '未评分';
  }, [numericScore, settings?.gradingRules]);

  const scoreColor = useMemo(
    () => getScoreColor(numericScore, settings?.gradingRules),
    [numericScore, settings?.gradingRules],
  );

  const windowInfo = selectedTask ? computeWindow(selectedTask) : null;
  const role = activeRole?.code ?? user?.role ?? null;
  const allowAnyTime = role === 'ADMIN' || role === 'COUNSELOR';
  const withinWindow = windowInfo?.inWindow ?? true;
  const canSubmit =
    Boolean(selectedTask && selectedDorm?.id !== null && selectedDorm?.id !== undefined) &&
    (allowAnyTime || withinWindow);

  const hasUnsavedChanges = useMemo(() => {
    if (!initialStateSnapshot) {
      return false;
    }

    const currentSnapshot = createFormSnapshot({
      appliedDeductions,
      form,
      baseScore,
    });
    return currentSnapshot !== initialStateSnapshot;
  }, [appliedDeductions, baseScore, form, initialStateSnapshot]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges) {
        return undefined;
      }

      event.preventDefault();
      event.returnValue = '';
      return '您有未保存的更改，确定要离开吗？';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const safeNavigate = (path: string): void => {
    if (hasUnsavedChanges) {
      setPendingNavigatePath(path);
      setShowLeaveConfirm(true);
      return;
    }

    navigate(path);
  };

  const confirmLeave = (): void => {
    setShowLeaveConfirm(false);
    if (pendingNavigatePath) {
      navigate(pendingNavigatePath);
      setPendingNavigatePath(null);
    }
  };

  const hasAssignment = Boolean(currentAssignment);

  const handleBaseScoreChange = (value: string): void => {
    const clean = value.replace(/[^0-9]/g, '');
    setBaseScore(clean);
  };

  const handleOpenAddDrawer = (): void => {
    setNewDeductionForm({ id: null, code: '', count: 1, locations: [] });
    setShowAddDeductionDrawer(true);
  };

  const handleOpenEditDrawer = (row: ResultEntryDeductionRow): void => {
    setNewDeductionForm({
      id: row.id,
      code: row.code,
      count: row.count || 1,
      locations: [...row.locations],
    });
    setShowAddDeductionDrawer(true);
  };

  const handleConfirmAddDeduction = (): void => {
    if (!newDeductionForm.code) {
      return;
    }

    if (newDeductionForm.id !== null) {
      setAppliedDeductions((prev) =>
        prev.map((item) =>
          item.id === newDeductionForm.id
            ? {
                ...item,
                code: newDeductionForm.code,
                count: newDeductionForm.count,
                locations: [...newDeductionForm.locations],
              }
            : item,
        ),
      );
    } else {
      setAppliedDeductions((prev) => [
        ...prev,
        {
          id: Date.now(),
          code: newDeductionForm.code,
          count: newDeductionForm.count,
          locations: [...newDeductionForm.locations],
        },
      ]);
    }

    setShowAddDeductionDrawer(false);
    setNewDeductionForm({ id: null, code: '', count: 1, locations: [] });
  };

  const handleToggleNewLocation = (location: string): void => {
    const locationOrder = resolveLocationOrder(settings);

    setNewDeductionForm((prev) => {
      let nextLocations: string[];
      if (prev.locations.includes(location)) {
        nextLocations = prev.locations.filter((item) => item !== location);
      } else {
        nextLocations = [...prev.locations, location];
      }

      nextLocations.sort((left, right) => {
        const leftIndex = locationOrder.indexOf(left);
        const rightIndex = locationOrder.indexOf(right);
        return (leftIndex === -1 ? 999 : leftIndex) - (rightIndex === -1 ? 999 : rightIndex);
      });

      return {
        ...prev,
        locations: nextLocations,
      };
    });
  };

  const handleRemoveDeductionRow = (id: EntityId): void => {
    setAppliedDeductions((prev) => prev.filter((item) => item.id !== id));
  };

  const handleToggleLocation = (rowId: EntityId | null, location: string): void => {
    if (rowId === null) {
      return;
    }

    setAppliedDeductions((prev) =>
      prev.map((item) => {
        if (item.id !== rowId) {
          return item;
        }

        const nextLocations = item.locations.includes(location)
          ? item.locations.filter((entry) => entry !== location)
          : [...item.locations, location];

        return {
          ...item,
          locations: nextLocations,
        };
      }),
    );
  };

  const handlePhotoUpload = async (
    event: ChangeEvent<HTMLInputElement>,
  ): Promise<void> => {
    const input = event.target;
    const files = Array.from(input.files ?? []);
    if (files.length === 0) {
      return;
    }

    try {
      antdMessage.info('正在上传图片...');
      const uploads: string[] = [];
      for (const file of files) {
        const response = await actionsRef.current.uploadPhoto(file);
        if (typeof response?.url === 'string' && response.url.trim()) {
          uploads.push(response.url);
        }
      }

      setForm((prev) => ({
        ...prev,
        photoUrls: [...prev.photoUrls, ...uploads],
      }));
      antdMessage.success('图片上传成功');
    } catch (error) {
      antdMessage.error(readErrorMessage(error, '图片上传失败'));
    } finally {
      input.value = '';
    }
  };

  const removePhoto = (index: number): void => {
    setForm((prev) => ({
      ...prev,
      photoUrls: prev.photoUrls.filter((_, currentIndex) => currentIndex !== index),
    }));
  };

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();

    if (!selectedTaskId || !form.dormId) {
      antdMessage.warning('请选择任务与宿舍后再提交');
      return;
    }

    if (!hasAssignment) {
      antdMessage.warning('本次任务未授权您录入该宿舍');
      return;
    }

    if (!canSubmit) {
      antdMessage.warning('当前时段无法录入，学生干部仅在查寝任务期间可操作');
      return;
    }

    const submitEvent = event.nativeEvent as SubmitEvent;
    const submitter = submitEvent.submitter as HTMLButtonElement | null;
    const submitType = submitter?.dataset?.type || 'return';

    try {
      const confirmed = await new Promise<boolean>((resolve) => {
        const dormLabel = selectedDorm
          ? `${selectedDorm.building || ''}-${selectedDorm.roomNo || ''}`
          : '当前宿舍';
        Modal.confirm({
          title: '确认提交评分',
          content: `即将提交 ${dormLabel} 的评分（${numericScore} 分），确认继续？`,
          okText: '确认提交',
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

      await actions.submitScore({
        ...form,
        inspectionId: inspectionRecord?.id,
        taskId: selectedTaskId,
        totalScore: numericScore,
        detail: appliedDeductions.filter((item) => Boolean(item.code)),
      });

      setInitialStateSnapshot(null);
      setAppliedDeductions([]);
      setForm(createDefaultForm(defaultScore));
      setBaseScore(String(defaultScore));
      setMembers([]);

      if (submitType === 'next' && nextDorm) {
        antdMessage.success('保存成功，切换至下一间');
        handleNavigateToRoom(nextDorm);
      } else {
        antdMessage.success('保存成功，返回列表');
        navigate(getRoomSelectUrl(), {
          state: { refreshTrigger: Date.now() },
        });
      }
    } catch (error) {
      antdMessage.error(readErrorMessage(error, '提交失败'));
    }
  };

  const sortedFloorDorms = useMemo(() => sortDormsByRoomNo(assignedDorms), [assignedDorms]);

  const currentIndex = sortedFloorDorms.findIndex(
    (item) => String(item.roomNo ?? '') === String(room),
  );
  const prevDorm = currentIndex > 0 ? sortedFloorDorms[currentIndex - 1] : null;
  const nextDorm =
    currentIndex >= 0 && currentIndex < sortedFloorDorms.length - 1
      ? sortedFloorDorms[currentIndex + 1]
      : null;

  const handleNavigateToRoom = (targetRoom: ResultEntryDorm | null): void => {
    if (!targetRoom) {
      return;
    }

    const url = `/tasks/entry/buildings/${encodeURIComponent(
      building,
    )}/floors/${encodeURIComponent(floor)}/rooms/${encodeURIComponent(
      String(targetRoom.roomNo ?? ''),
    )}?taskId=${selectedTaskId}&campus=${encodeURIComponent(campusParam)}`;
    safeNavigate(url);
  };

  const getRoomSelectUrl = (): string => {
    const query: string[] = [];
    if (selectedTaskId) {
      query.push(`taskId=${encodeURIComponent(selectedTaskId)}`);
    }
    if (campusParam) {
      query.push(`campus=${encodeURIComponent(campusParam)}`);
    }
    return `/tasks/entry/buildings/${encodeURIComponent(
      building,
    )}/floors/${encodeURIComponent(floor)}/rooms${
      query.length ? `?${query.join('&')}` : ''
    }`;
  };

  const handleBackToRoomList = (): void => {
    safeNavigate(getRoomSelectUrl());
  };

  return {
    mainRef,
    cameraInputRef,
    galleryInputRef,
    form,
    setForm,
    baseScore,
    editingScore,
    members,
    inspectionRecord,
    loadingMembers,
    appliedDeductions,
    showMemberModal,
    currentEditingRowId,
    showAddDeductionDrawer,
    newDeductionForm,
    isScrolled,
    showUploadModal,
    showLeaveConfirm,
    canRecord,
    selectedTask,
    enabledDeductions,
    numericScore,
    currentRating,
    scoreColor,
    canSubmit,
    prevDorm,
    nextDorm,
    handleScoreClick,
    setEditingScore,
    setShowAddDeductionDrawer,
    setShowUploadModal,
    setShowMemberModal,
    setCurrentEditingRowId,
    setNewDeductionForm,
    setShowLeaveConfirm,
    confirmLeave,
    handleBaseScoreChange,
    handleOpenAddDrawer,
    handleOpenEditDrawer,
    handleConfirmAddDeduction,
    handleToggleNewLocation,
    handleRemoveDeductionRow,
    handleToggleLocation,
    handlePhotoUpload,
    removePhoto,
    handleSubmit,
    handleNavigateToRoom,
    handleBackToRoomList,
  };
}
