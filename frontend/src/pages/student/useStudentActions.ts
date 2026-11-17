import { useCallback, useState } from 'react';
import type { ReactNode } from 'react';
import { Modal } from 'antd';

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

function confirmModal(options: {
  title: string;
  content: ReactNode;
  okText: string;
  okType?: 'danger' | 'primary' | 'default';
}): Promise<boolean> {
  return new Promise((resolve) => {
    Modal.confirm({
      title: options.title,
      content: options.content,
      okText: options.okText,
      okType: options.okType,
      cancelText: '取消',
      maskClosable: false,
      keyboard: false,
      onOk: () => resolve(true),
      onCancel: () => resolve(false),
    });
  });
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
      setToastMsg('当前账号无导出权限');
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
      setToastMsg(readErrorMessage(error, '导出失败，请稍后重试'));
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
      setToastMsg('模板下载不可用');
      return;
    }

    try {
      const blob = await actions.downloadTemplate('students');
      if (!blob) {
        setToastMsg('模板下载失败');
        return;
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = '学生导入模板.xlsx';
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setToastMsg(readErrorMessage(error, '模板下载失败'));
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

    const firstConfirmed = await confirmModal({
      title: '确认批量删除学生',
      content: `即将删除选中的 ${selectionCount} 名学生，此操作不可撤销。`,
      okText: '确认删除',
      okType: 'danger',
    });
    if (!firstConfirmed) {
      return;
    }

    const finalConfirmed = await confirmDangerCountdown({
      title: '是否确认 — 批量删除学生',
      content: `将永久删除选中的 ${selectionCount} 名学生及其相关数据，确认继续？`,
      okText: '确认删除',
    });
    if (!finalConfirmed) {
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
      setToastMsg(readErrorMessage(error, '批量删除失败'));
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
      const finalConfirmed = await confirmDangerCountdown({
        title: '是否确认 — 删除学生',
        content: `即将永久删除学生「${record.fullName || record.studentNo || '未命名'}」，确认继续？`,
        okText: '确认删除',
      });
      if (!finalConfirmed) {
        return;
      }

      setBatchLoading(true);
      try {
        await actions.deleteStudents({ ids: [record.id] });
        setToastMsg('删除成功');
        clearSelection();
        setReloadFlag((prev) => prev + 1);
      } catch (error) {
        setToastMsg(readErrorMessage(error, '删除失败'));
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
      setToastMsg('当前账号无编辑权限');
      return;
    }

    const payload = normalizeStudentPayload(form);
    try {
      const isEdit = Boolean(editingId);
      const confirmed = await confirmModal({
        title: isEdit ? '确认更新学生信息' : '确认新增学生',
        content: isEdit
          ? `即将更新学生「${form.fullName || form.studentNo || '未命名'}」的信息，确认继续？`
          : `即将新增学生「${form.fullName || form.studentNo || '未命名'}」，确认继续？`,
        okText: isEdit ? '确认更新' : '确认新增',
      });
      if (!confirmed) {
        return;
      }

      if (editingId && actions.updateStudent) {
        await actions.updateStudent(editingId, payload);
        setToastMsg('更新学生信息成功');
      } else if (!editingId && actions.createStudent) {
        await actions.createStudent(payload);
        setToastMsg('新增学生成功');
      } else {
        setToastMsg('当前操作不可用');
        return;
      }

      closeModal();
      setReloadFlag((prev) => prev + 1);
    } catch (error) {
      setToastMsg(readErrorMessage(error, '提交失败'));
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
