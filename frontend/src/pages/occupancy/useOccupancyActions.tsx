import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, message } from 'antd';
import { UserDeleteOutlined } from '@ant-design/icons';

import { dormService } from '../../services/dormService';
import { confirmDangerCountdown } from '../../utils/confirm';

import type { EntityId, ServiceQueryParams } from '../../types/service';
import type {
  BatchAssignment,
  BatchModalFiltersState,
  BedSelectInfo,
  DormRecord,
  OccupancyStudentRecord,
  UseOccupancyActionsProps,
  UseOccupancyActionsResult,
} from './types';

const DEFAULT_MODAL_FILTERS: BatchModalFiltersState = {
  building: null,
  floor: null,
  roomNo: '',
};

function readErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

function toDormRecords(items: unknown): DormRecord[] {
  return Array.isArray(items) ? (items as DormRecord[]) : [];
}

function getSelectedStudentsData(
  studentData: UseOccupancyActionsProps['studentData'],
  selectedIds: EntityId[],
): OccupancyStudentRecord[] {
  return (studentData?.items || []).filter((student) =>
    selectedIds.map(String).includes(String(student.id)),
  );
}

function getStudentsToBeAssigned(
  studentData: UseOccupancyActionsProps['studentData'],
  selectedIds: EntityId[],
): OccupancyStudentRecord[] {
  return (studentData?.items || []).filter(
    (student) => !student.dormId && selectedIds.map(String).includes(String(student.id)),
  );
}

function validateBatchSelection(
  type: 'checkin' | 'checkout',
  selectedIds: EntityId[],
  studentData: UseOccupancyActionsProps['studentData'],
) {
  if (selectedIds.length === 0) {
    return { valid: false, message: '请先选择学生' };
  }

  const itemsToShow = getSelectedStudentsData(studentData, selectedIds);
  if (itemsToShow.length === 0) {
    return { valid: true };
  }

  if (type === 'checkin') {
    const hasUnassignedStudent = itemsToShow.some((student) => !student.dormId);
    if (!hasUnassignedStudent) {
      return { valid: false, message: '所选学生均已入住，无需再次办理' };
    }
  }

  if (type === 'checkout') {
    const hasAssignedStudent = itemsToShow.some((student) => student.dormId);
    if (!hasAssignedStudent) {
      return { valid: false, message: '所选学生均未入住，无法办理退宿' };
    }
  }

  return { valid: true };
}

function buildDormFetchParams(filters: BatchModalFiltersState): ServiceQueryParams {
  const params: ServiceQueryParams = {
    pageSize: 500,
    page: 1,
    search: filters.roomNo,
  };

  if (filters.building) {
    params.building = [filters.building];
  }
  if (filters.floor !== null) {
    params.floor = [filters.floor];
  }

  return params;
}

function confirmWithModal(config: Parameters<typeof Modal.confirm>[0]): Promise<boolean> {
  return new Promise((resolve) => {
    Modal.confirm({
      ...config,
      maskClosable: false,
      keyboard: false,
      onOk: () => resolve(true),
      onCancel: () => resolve(false),
    });
  });
}

function confirmBatchCheckout(count: number): Promise<boolean> {
  return confirmWithModal({
    title: '确认批量退宿',
    icon: <UserDeleteOutlined style={{ color: 'var(--co-error)' }} />,
    content: `您确定要为选中的 ${count} 名学生办理退宿手续吗？`,
    okText: '确认退宿',
    cancelText: '取消',
    okType: 'danger',
  });
}

function confirmBatchCheckIn(totalSelected: number, assignedCount: number): Promise<boolean> {
  const confirmContent =
    assignedCount < totalSelected
      ? `您选中了 ${totalSelected} 名学生，但仅为 ${assignedCount} 人分配了床位。是否继续提交已分配项？`
      : `即将为 ${totalSelected} 名学生办理入住手续。`;

  return confirmWithModal({
    title: '确认批量入住',
    content: confirmContent,
    okText: '确认办理',
    cancelText: '取消',
    okType: 'danger',
  });
}

function confirmSingleCheckout(): Promise<boolean> {
  return confirmWithModal({
    title: '确认退宿',
    content: '即将为该学生办理退宿手续，床位将被释放。确认继续？',
    okText: '确认退宿',
    cancelText: '取消',
    okType: 'danger',
  });
}

function showBatchCheckInResult(result: {
  successCount?: number;
  failedCount?: number;
  errors?: string[];
}) {
  if ((result.failedCount || 0) > 0) {
    Modal.info({
      title: '批量入住完成（部分失败）',
      content: (
        <div>
          <p>
            成功入住 {result.successCount || 0} 人，失败 {result.failedCount || 0} 人
          </p>
          {result.errors?.length ? (
            <div
              style={{
                maxHeight: 200,
                overflowY: 'auto',
                background: 'var(--info-bg)',
                padding: 8,
              }}
            >
              {result.errors.map((item, index) => (
                <div key={`${index}-${item}`} style={{ fontSize: 12 }}>
                  {item}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ),
    });
    return;
  }

  message.success(`成功为 ${result.successCount || 0} 名学生办理入住`);
}

function buildAssignmentsList(batchAssignments: Record<string, BatchAssignment>) {
  return Object.entries(batchAssignments).map(([studentId, assignment]) => ({
    studentId: Number(studentId),
    dormId: assignment.dormId,
    bedNo: assignment.bedNo,
  }));
}

function useBatchDormTargets(
  actions: UseOccupancyActionsProps['actions'],
  batchCheckInModalOpen: boolean,
  modalFilters: BatchModalFiltersState,
  setTargetDorms: React.Dispatch<React.SetStateAction<DormRecord[]>>,
  setModalFloors: React.Dispatch<React.SetStateAction<Array<string | number>>>,
  setLoadingDorms: React.Dispatch<React.SetStateAction<boolean>>,
) {
  useEffect(() => {
    const fetchDormTable = actions.fetchDormTable;

    if (!batchCheckInModalOpen || !fetchDormTable) {
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setLoadingDorms(true);
      try {
        const result = await fetchDormTable(buildDormFetchParams(modalFilters));
        if (!cancelled) {
          setTargetDorms(toDormRecords(result?.items));
        }

        if (!modalFilters.building || !actions.getFloors) {
          if (!cancelled) {
            setModalFloors([]);
          }
          return;
        }

        const floorResult = await actions.getFloors({ building: modalFilters.building });
        if (!cancelled) {
          setModalFloors(floorResult?.floors || []);
        }
      } catch (error) {
        if (!cancelled) {
          console.error('同步弹窗数据失败:', error);
          setTargetDorms([]);
          setModalFloors([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingDorms(false);
        }
      }
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    actions,
    batchCheckInModalOpen,
    modalFilters,
    setLoadingDorms,
    setModalFloors,
    setTargetDorms,
  ]);
}

export function useOccupancyActions({
  studentData,
  selectedIds,
  clearSelection,
  setReloadFlag,
  loadStats,
  actions,
}: UseOccupancyActionsProps): UseOccupancyActionsResult {
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchCheckInModalOpen, setBatchCheckInModalOpen] = useState(false);
  const [targetDorms, setTargetDorms] = useState<DormRecord[]>([]);
  const [loadingDorms, setLoadingDorms] = useState(false);
  const [currentAssigneeIndex, setCurrentAssigneeIndex] = useState(0);
  const [batchAssignments, setBatchAssignments] = useState<Record<string, BatchAssignment>>({});
  const [modalFilters, setModalFilters] = useState<BatchModalFiltersState>(
    DEFAULT_MODAL_FILTERS,
  );
  const [modalFloors, setModalFloors] = useState<Array<string | number>>([]);

  const selectedStudentsData = useMemo<OccupancyStudentRecord[]>(
    () => getSelectedStudentsData(studentData, selectedIds),
    [selectedIds, studentData],
  );
  const studentsToBeAssigned = useMemo<OccupancyStudentRecord[]>(
    () => getStudentsToBeAssigned(studentData, selectedIds),
    [selectedIds, studentData],
  );

  const validateBatchOperation = useCallback(
    (type: 'checkin' | 'checkout') =>
      validateBatchSelection(type, selectedIds, studentData),
    [selectedIds, studentData],
  );

  useBatchDormTargets(
    actions,
    batchCheckInModalOpen,
    modalFilters,
    setTargetDorms,
    setModalFloors,
    setLoadingDorms,
  );

  const handleBedSelect = useCallback(
    (bedInfo: BedSelectInfo): void => {
      const student = studentsToBeAssigned[currentAssigneeIndex];
      if (!student?.id) {
        return;
      }

      const isOccupiedInSession = Object.entries(batchAssignments).some(
        ([studentId, assignment]) =>
          String(studentId) !== String(student.id) &&
          assignment.dormId === bedInfo.dormId &&
          assignment.bedNo === bedInfo.bedNo,
      );
      if (isOccupiedInSession) {
        message.warning('该床位已在本次操作中被分配');
        return;
      }

      setBatchAssignments((prev) => ({
        ...prev,
        [String(student.id)]: {
          dormId: bedInfo.dormId,
          bedNo: bedInfo.bedNo,
          roomNo: bedInfo.roomNo,
          building: bedInfo.building,
          floor: bedInfo.floor,
        },
      }));

      if (currentAssigneeIndex < studentsToBeAssigned.length - 1) {
        setCurrentAssigneeIndex((prev) => prev + 1);
      }
    },
    [batchAssignments, currentAssigneeIndex, studentsToBeAssigned],
  );

  const handleBatchCheckout = useCallback(async (): Promise<void> => {
    const validation = validateBatchOperation('checkout');
    if (!validation.valid) {
      message.warning(validation.message);
      return;
    }

    const studentsToCheckout = selectedStudentsData.filter((student) => student.dormId);
    const firstConfirmed = await confirmBatchCheckout(studentsToCheckout.length);
    if (!firstConfirmed) {
      return;
    }

    const finalConfirmed = await confirmDangerCountdown({
      title: '是否确认 — 批量退宿',
      content: `即将为 ${studentsToCheckout.length} 名学生办理退宿，床位将被释放。确认继续？`,
      okText: '最终退宿',
    });
    if (!finalConfirmed) {
      return;
    }

    setBatchLoading(true);
    try {
      const studentIds = studentsToCheckout
        .map((student) => student.id)
        .filter((id): id is EntityId => id !== undefined && id !== null);
      const result = await dormService.batchCheckoutStudents(studentIds);
      const payload = result as { message?: string; affectedCount?: number };
      message.success(
        payload.message ||
          `成功为 ${payload.affectedCount || studentIds.length} 名学生办理退宿`,
      );
      clearSelection();
      setReloadFlag((prev) => prev + 1);
    } catch (error) {
      Modal.error({
        title: '批量退宿失败',
        content: readErrorMessage(error, '操作失败，请稍后重试'),
      });
    } finally {
      setBatchLoading(false);
    }
  }, [clearSelection, selectedStudentsData, setReloadFlag, validateBatchOperation]);

  const openBatchCheckInModal = useCallback((): void => {
    const validation = validateBatchOperation('checkin');
    if (!validation.valid) {
      message.warning(validation.message);
      return;
    }

    setBatchCheckInModalOpen(true);
    setCurrentAssigneeIndex(0);
    setBatchAssignments({});
    setModalFilters(DEFAULT_MODAL_FILTERS);
    setTargetDorms([]);
    setModalFloors([]);
  }, [validateBatchOperation]);

  const handleBatchCheckIn = useCallback(async (): Promise<void> => {
    const assignmentsList = buildAssignmentsList(batchAssignments);
    const totalSelected = studentsToBeAssigned.length;
    const assignedCount = assignmentsList.length;
    if (assignedCount === 0) {
      message.warning('请先为学生分配床位');
      return;
    }

    const confirmed = await confirmBatchCheckIn(totalSelected, assignedCount);
    if (!confirmed) {
      return;
    }

    setBatchLoading(true);
    try {
      const result = await dormService.batchCheckIn(assignmentsList);
      showBatchCheckInResult(
        result as {
          successCount?: number;
          failedCount?: number;
          errors?: string[];
        },
      );
      setBatchCheckInModalOpen(false);
      clearSelection();
      setReloadFlag((prev) => prev + 1);
    } catch (error) {
      Modal.error({
        title: '批量入住失败',
        content: readErrorMessage(error, '操作失败，请稍后重试'),
      });
    } finally {
      setBatchLoading(false);
    }
  }, [batchAssignments, clearSelection, setReloadFlag, studentsToBeAssigned.length]);

  const handleCheckout = useCallback(
    async (studentId: EntityId): Promise<void> => {
      if (!actions.checkoutStudent) {
        return;
      }

      const confirmed = await confirmSingleCheckout();
      if (!confirmed) {
        return;
      }

      try {
        await actions.checkoutStudent(studentId);
        message.success('退宿手续办理成功');
        setReloadFlag((prev) => prev + 1);
        await loadStats();
      } catch (error) {
        message.error(readErrorMessage(error, '退宿失败'));
      }
    },
    [actions, loadStats, setReloadFlag],
  );

  return {
    batchLoading,
    setBatchLoading,
    batchCheckInModalOpen,
    setBatchCheckInModalOpen,
    targetDorms,
    loadingDorms,
    currentAssigneeIndex,
    setCurrentAssigneeIndex,
    batchAssignments,
    modalFilters,
    setModalFilters,
    modalFloors,
    selectedStudentsData,
    studentsToBeAssigned,
    validateBatchOperation,
    handleBedSelect,
    handleBatchCheckout,
    openBatchCheckInModal,
    handleBatchCheckIn,
    handleCheckout,
  };
}
