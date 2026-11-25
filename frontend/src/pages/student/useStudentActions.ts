import { useCallback, useState } from 'react';

import {
  buildStudentTableParams,
  initialStudentForm,
  normalizeStudentGender,
} from './studentFilterSchema';
import { confirmDangerCountdown } from '../../utils/confirm';

import type { EntityId, ServiceRecord } from '../../types/service';
import type {
  StudentFormState,
  StudentRecord,
  UseStudentActionsProps,
  UseStudentActionsResult,
} from './types';

function readErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

function normalizeStudentPayload(form: StudentFormState): ServiceRecord {
  return {
    studentNo: form.studentNo?.trim() || '',
    fullName: form.fullName?.trim() || '',
    grade: form.grade?.trim() || '',
    gender: normalizeStudentGender(form.gender || ''),
    educationLevel: form.educationLevel?.trim() || '',
    college: form.college?.trim() || '',
    major: form.major?.trim() || '',
    className: form.className?.trim() || '',
    status: form.status?.trim() || '',
    mobile: form.mobile?.trim() || '',
    qq: form.qq?.trim() || '',
    idType: form.idType?.trim() || '',
    idNumber: form.idNumber?.trim() || '',
    politicalStatus: form.politicalStatus?.trim() || '',
    birthDate: form.birthDate ? new Date(form.birthDate).toISOString() : null,
    ethnicity: form.ethnicity?.trim() || '',
    nativePlace: form.nativePlace?.trim() || '',
    sourcePlace: form.sourcePlace?.trim() || '',
    homeAddress: form.homeAddress?.trim() || '',
    isMonitor: Boolean(form.isMonitor),
  };
}

export function useStudentActions({
  actions,
  appliedFilters,
  appliedSearchTerm,
  pagination,
  sortField,
  sortOrder,
  selectedIds,
  selectAcrossPages,
  setSelectedIds,
  setSelectAcrossPages,
  clearSelection,
  getSelectionCount,
  setReloadFlag,
  setToastMsg,
  canEdit,
  canExport,
  tableTotal,
}: UseStudentActionsProps): UseStudentActionsResult {
  const [batchLoading, setBatchLoading] = useState(false);
  const [form, setForm] = useState<StudentFormState>(initialStudentForm);
  const [editingId, setEditingId] = useState<EntityId | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailStudent, setDetailStudent] = useState<StudentRecord | null>(null);

  const handleExport = useCallback(async (): Promise<void> => {
    if (!canExport || !actions.exportStudents) {
      setToastMsg('当前无权执行此操作，请联系管理员');
      return;
    }

    try {
      const params = buildStudentTableParams(
        appliedFilters,
        appliedSearchTerm,
        pagination,
        sortField,
        sortOrder,
        false,
      );
      const blob = await actions.exportStudents(params);
      if (!blob) {
        setToastMsg('暂无可导出的学生数据');
        return;
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = '学生信息.xlsx';
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setToastMsg(readErrorMessage(error, '导出失败，请检查网络后重试'));
    }
  }, [
    actions,
    appliedFilters,
    appliedSearchTerm,
    canExport,
    pagination,
    setToastMsg,
    sortField,
    sortOrder,
  ]);

  const handleDownloadTemplate = useCallback(async (): Promise<void> => {
    if (!actions.downloadTemplate) {
      setToastMsg('模板下载不可用，请联系管理员');
      return;
    }

    try {
      const blob = await actions.downloadTemplate('students');
      if (!blob) {
        setToastMsg('模板下载失败，请检查网络后重试');
        return;
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = '学生导入模板.xlsx';
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setToastMsg(readErrorMessage(error, '模板下载失败，请检查网络后重试'));
    }
  }, [actions, setToastMsg]);

  const handleBulkDelete = useCallback(async (): Promise<void> => {
    if (!canEdit || !actions.deleteStudents) {
      return;
    }

    const selectionCount = getSelectionCount(tableTotal);
    if (!selectionCount) {
      return;
    }

    const confirmed = await confirmDangerCountdown({
      title: `确定删除选中的 ${selectionCount} 名学生吗？`,
      content: '删除后不可恢复，这些学生的住宿关联记录将一并清除，对应的登录账号将被停用。',
      okText: '删除学生',
    });
    if (!confirmed) {
      return;
    }

    setBatchLoading(true);
    try {
      const filterParams = buildStudentTableParams(
        appliedFilters,
        appliedSearchTerm,
        pagination,
        sortField,
        sortOrder,
        false,
      );
      const payload = selectAcrossPages
        ? { filter: filterParams }
        : { ids: selectedIds };
      await actions.deleteStudents(payload);
      setToastMsg('批量删除成功');
      clearSelection();
      setReloadFlag((prev) => prev + 1);
    } catch (error) {
      setToastMsg(readErrorMessage(error, '批量删除失败，请检查网络后重试'));
    } finally {
      setBatchLoading(false);
    }
  }, [
    actions,
    appliedFilters,
    appliedSearchTerm,
    canEdit,
    clearSelection,
    getSelectionCount,
    pagination,
    selectAcrossPages,
    selectedIds,
    setReloadFlag,
    setToastMsg,
    sortField,
    sortOrder,
    tableTotal,
  ]);

  const handleSingleDelete = useCallback(
    async (record: StudentRecord): Promise<void> => {
      if (!record.id || !actions.deleteStudents) {
        return;
      }

      setSelectedIds([record.id]);
      setSelectAcrossPages(false);
      const studentName = record.fullName || record.studentNo || '未命名';
      const confirmed = await confirmDangerCountdown({
        title: `确定删除学生「${studentName}」吗？`,
        content: '删除后不可恢复，该学生的住宿关联记录将一并清除，对应的登录账号将被停用。',
        okText: '删除学生',
      });
      if (!confirmed) {
        return;
      }

      setBatchLoading(true);
      try {
        await actions.deleteStudents({ ids: [record.id] });
        setToastMsg('删除成功');
        clearSelection();
        setReloadFlag((prev) => prev + 1);
      } catch (error) {
        setToastMsg(readErrorMessage(error, '删除失败，请检查网络后重试'));
      } finally {
        setBatchLoading(false);
      }
    },
    [
      actions,
      clearSelection,
      setReloadFlag,
      setSelectedIds,
      setSelectAcrossPages,
      setToastMsg,
    ],
  );

  const openModal = useCallback((student: StudentRecord | null = null): void => {
    if (student) {
      setEditingId(student.id ?? null);
      setForm({
        studentNo: student.studentNo || '',
        fullName: student.fullName || '',
        grade: student.grade || '',
        gender: student.gender || '男',
        educationLevel: student.educationLevel || '',
        college: student.college || '',
        major: student.major || '',
        className: student.className || '',
        status: student.status || '',
        mobile: student.mobile || '',
        qq: student.qq || '',
        idType: student.idType || '',
        idNumber: student.idNumber || '',
        politicalStatus: student.politicalStatus || '',
        birthDate: student.birthDate
          ? new Date(student.birthDate).toISOString().split('T')[0]
          : '',
        ethnicity: student.ethnicity || '',
        nativePlace: student.nativePlace || '',
        sourcePlace: student.sourcePlace || '',
        homeAddress: student.homeAddress || '',
        isMonitor: Boolean(student.isMonitor),
      });
    } else {
      setEditingId(null);
      setForm(initialStudentForm);
    }
    setModalOpen(true);
  }, []);

  const closeModal = useCallback((): void => {
    setModalOpen(false);
    setForm(initialStudentForm);
    setEditingId(null);
  }, []);

  const handleFormSubmit = useCallback(async (): Promise<void> => {
    if (!canEdit) {
      setToastMsg('当前无权执行此操作，请联系管理员');
      return;
    }

    const payload = normalizeStudentPayload(form);
    try {
      if (editingId && actions.updateStudent) {
        await actions.updateStudent(editingId, payload);
        setToastMsg('更新学生信息成功');
      } else if (!editingId && actions.createStudent) {
        await actions.createStudent(payload);
        setToastMsg('新增学生成功');
      } else {
        setToastMsg('当前操作不可用，请联系管理员');
        return;
      }

      closeModal();
      setReloadFlag((prev) => prev + 1);
    } catch (error) {
      setToastMsg(readErrorMessage(error, '保存失败，请检查网络后重试'));
    }
  }, [actions, canEdit, closeModal, editingId, form, setReloadFlag, setToastMsg]);

  const openDetailModal = useCallback((student: StudentRecord): void => {
    setDetailStudent(student);
    setDetailModalOpen(true);
  }, []);

  const closeDetailModal = useCallback((): void => {
    setDetailModalOpen(false);
    setDetailStudent(null);
  }, []);

  return {
    batchLoading,
    form,
    setForm,
    editingId,
    modalOpen,
    detailModalOpen,
    detailStudent,
    handleExport,
    handleDownloadTemplate,
    handleBulkDelete,
    handleSingleDelete,
    openModal,
    closeModal,
    handleFormSubmit,
    openDetailModal,
    closeDetailModal,
  };
}
