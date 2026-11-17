import { useCallback, useState } from 'react';
import type { ReactNode } from 'react';
import { Modal } from 'antd';
import type { FormInstance } from 'antd';

import { buildTeacherTableParams, initialTeacherForm } from './teacherSchema';
import { confirmDangerCountdown } from '../../utils/confirm';

import type { EntityId } from '../../types/service';
import type {
  TeacherFormValues,
  TeacherRecord,
  UseTeacherActionsProps,
  UseTeacherActionsResult,
} from './types';

function readErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

function normalizeTeacherPayload(values: TeacherFormValues): TeacherFormValues {
  return {
    employeeNo: values.employeeNo?.trim() || '',
    fullName: values.fullName?.trim() || '',
    gender: values.gender || '男',
    department: values.department?.trim() || '',
    mobile: values.mobile?.trim() || '',
    classes: values.classes?.trim() || '',
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

export function useTeacherActions({
  actions,
  messageApi,
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
  setBatchLoading,
  setReloadFlag,
  canManage,
  canExport,
  tableTotal,
}: UseTeacherActionsProps): UseTeacherActionsResult {
  const [editingId, setEditingId] = useState<EntityId | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const handleExport = useCallback(async (): Promise<void> => {
    if (!canExport || !actions.exportTeachers) {
      messageApi.warning('当前账号无导出权限');
      return;
    }

    try {
      const params = buildTeacherTableParams(
        appliedFilters,
        appliedSearchTerm,
        pagination,
        sortField,
        sortOrder,
        false,
      );
      const blob = await actions.exportTeachers(params);
      if (!blob) {
        messageApi.warning('暂无可导出的教职工数据');
        return;
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = '教职工信息.xlsx';
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      messageApi.error(readErrorMessage(error, '导出失败，请稍后重试'));
    }
  }, [
    actions,
    appliedFilters,
    appliedSearchTerm,
    canExport,
    messageApi,
    pagination,
    sortField,
    sortOrder,
  ]);

  const handleBulkDelete = useCallback(async (): Promise<void> => {
    if (!canManage || !actions.deleteTeachers) {
      return;
    }

    const selectionCount = getSelectionCount(tableTotal);
    if (!selectionCount) {
      return;
    }

    const firstConfirmed = await confirmModal({
      title: '确认批量删除教职工',
      content: `即将删除选中的 ${selectionCount} 名教职工，此操作不可撤销。`,
      okText: '确认删除',
      okType: 'danger',
    });
    if (!firstConfirmed) {
      return;
    }

    const finalConfirmed = await confirmDangerCountdown({
      title: '是否确认 — 批量删除教职工',
      content: `将永久删除选中的 ${selectionCount} 名教职工及其相关数据，确认继续？`,
      okText: '确认删除',
    });
    if (!finalConfirmed) {
      return;
    }

    setBatchLoading(true);
    try {
      const filterParams = buildTeacherTableParams(
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
      await actions.deleteTeachers(payload);
      messageApi.success('批量删除成功');
      clearSelection();
      setReloadFlag((prev) => prev + 1);
    } catch (error) {
      messageApi.error(readErrorMessage(error, '批量删除失败'));
    } finally {
      setBatchLoading(false);
    }
  }, [
    actions,
    appliedFilters,
    appliedSearchTerm,
    canManage,
    clearSelection,
    getSelectionCount,
    messageApi,
    pagination,
    selectAcrossPages,
    selectedIds,
    setBatchLoading,
    setReloadFlag,
    sortField,
    sortOrder,
    tableTotal,
  ]);

  const handleSingleDelete = useCallback(
    async (record: TeacherRecord): Promise<void> => {
      if (!record.id || !actions.deleteTeachers) {
        return;
      }

      setSelectedIds([record.id]);
      setSelectAcrossPages(false);

      const finalConfirmed = await confirmDangerCountdown({
        title: '是否确认 — 删除教职工',
        content: `即将永久删除教职工「${record.fullName || record.employeeNo || '未命名'}」，确认继续？`,
        okText: '确认删除',
      });
      if (!finalConfirmed) {
        return;
      }

      setBatchLoading(true);
      try {
        await actions.deleteTeachers({ ids: [record.id] });
        messageApi.success('删除成功');
        clearSelection();
        setReloadFlag((prev) => prev + 1);
      } catch (error) {
        messageApi.error(readErrorMessage(error, '删除失败'));
      } finally {
        setBatchLoading(false);
      }
    },
    [
      actions,
      clearSelection,
      messageApi,
      setBatchLoading,
      setReloadFlag,
      setSelectedIds,
      setSelectAcrossPages,
    ],
  );

  const openModal = useCallback(
    (
      teacher: TeacherRecord | null,
      form: FormInstance<TeacherFormValues>,
    ): void => {
      if (teacher) {
        setEditingId(teacher.id ?? null);
        form.setFieldsValue({
          ...initialTeacherForm,
          ...teacher,
        });
      } else {
        setEditingId(null);
        form.resetFields();
        form.setFieldsValue(initialTeacherForm);
      }

      setModalOpen(true);
    },
    [],
  );

  const closeModal = useCallback(
    (form: FormInstance<TeacherFormValues>): void => {
      setModalOpen(false);
      form.resetFields();
      form.setFieldsValue(initialTeacherForm);
      setEditingId(null);
    },
    [],
  );

  const handleFormSubmit = useCallback(
    async (values: TeacherFormValues): Promise<boolean> => {
      const payload = normalizeTeacherPayload(values);
      const isEdit = Boolean(editingId);
      const confirmed = await confirmModal({
        title: isEdit ? '确认更新教职工信息' : '确认新增教职工',
        content: isEdit
          ? `即将更新教职工「${payload.fullName || payload.employeeNo || '未命名'}」的信息，确认继续？`
          : `即将新增教职工「${payload.fullName || payload.employeeNo || '未命名'}」，确认继续？`,
        okText: isEdit ? '确认更新' : '确认新增',
      });
      if (!confirmed) {
        return false;
      }

      try {
        if (editingId && actions.updateTeacher) {
          await actions.updateTeacher(editingId, payload);
          messageApi.success('更新教职工信息成功');
        } else if (!editingId && actions.createTeacher) {
          await actions.createTeacher(payload);
          messageApi.success('新增教职工成功');
        } else {
          messageApi.warning('当前操作不可用');
          return false;
        }

        setModalOpen(false);
        setEditingId(null);
        setReloadFlag((prev) => prev + 1);
        return true;
      } catch (error) {
        messageApi.error(readErrorMessage(error, '提交失败'));
        return false;
      }
    },
    [actions, editingId, messageApi, setReloadFlag],
  );

  return {
    editingId,
    modalOpen,
    handleExport,
    handleBulkDelete,
    handleSingleDelete,
    openModal,
    closeModal,
    handleFormSubmit,
  };
}
