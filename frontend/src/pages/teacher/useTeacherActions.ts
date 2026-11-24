import { useCallback, useState } from 'react';
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
      messageApi.warning('当前无权执行此操作，请联系管理员');
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
      messageApi.error(readErrorMessage(error, '导出失败，请检查网络后重试'));
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

    const confirmed = await confirmDangerCountdown({
      title: `确定删除选中的 ${selectionCount} 名教职工吗？`,
      content: '删除后不可恢复，这些教职工的相关数据将被永久移除。',
      okText: '删除教职工',
    });
    if (!confirmed) {
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
      messageApi.error(readErrorMessage(error, '批量删除失败，请检查网络后重试'));
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

      const teacherName = record.fullName || record.employeeNo || '未命名';
      const confirmed = await confirmDangerCountdown({
        title: `确定删除教职工「${teacherName}」吗？`,
        content: '删除后不可恢复，该教职工的数据将被永久移除。',
        okText: '删除教职工',
      });
      if (!confirmed) {
        return;
      }

      setBatchLoading(true);
      try {
        await actions.deleteTeachers({ ids: [record.id] });
        messageApi.success('删除成功');
        clearSelection();
        setReloadFlag((prev) => prev + 1);
      } catch (error) {
        messageApi.error(readErrorMessage(error, '删除失败，请检查网络后重试'));
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

      try {
        if (editingId && actions.updateTeacher) {
          await actions.updateTeacher(editingId, payload);
          messageApi.success('更新教职工信息成功');
        } else if (!editingId && actions.createTeacher) {
          await actions.createTeacher(payload);
          messageApi.success('新增教职工成功');
        } else {
          messageApi.warning('当前操作不可用，请联系管理员');
          return false;
        }

        setModalOpen(false);
        setEditingId(null);
        setReloadFlag((prev) => prev + 1);
        return true;
      } catch (error) {
        messageApi.error(readErrorMessage(error, '保存失败，请检查网络后重试'));
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
