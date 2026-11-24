import { useCallback } from 'react';
import { message } from 'antd';

import {
  batchDeleteBuildings,
  createBuilding,
  deleteBuilding,
  exportBuildings,
  updateBuilding,
} from '../../services/buildingService';
import { confirmDangerCountdown } from '../../utils/confirm';

import type {
  BuildingFormPayload,
  BuildingRecord,
  UseBuildingActionsProps,
  UseBuildingActionsResult,
} from './types';

function readErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

export function useBuildingActions({
  form,
  appliedFilters,
  appliedSearchText,
  editingId,
  selectedIds,
  setEditingId,
  setSelectedIds,
  setIsModalVisible,
  setDetailBuilding,
  setDetailModalOpen,
  setBatchLoading,
  setReloadFlag,
  fetchBuildings,
}: UseBuildingActionsProps): UseBuildingActionsResult {
  const handleAdd = useCallback((): void => {
    setEditingId(null);
    form.resetFields();
    setIsModalVisible(true);
  }, [form, setEditingId, setIsModalVisible]);

  const handleEdit = useCallback(
    (record: BuildingRecord) => {
      setEditingId(record.id ?? null);
      form.setFieldsValue({
        ...record,
        type: record.type || '混合',
      });
      setIsModalVisible(true);
    },
    [form, setEditingId, setIsModalVisible],
  );

  const handleView = useCallback(
    (record: BuildingRecord) => {
      setDetailBuilding(record);
      setDetailModalOpen(true);
    },
    [setDetailBuilding, setDetailModalOpen],
  );

  const handleDelete = useCallback(
    async (record: BuildingRecord): Promise<void> => {
      const name = record?.name;
      if (!name || typeof name !== 'string' || !name.trim()) {
        message.error('缺少楼栋信息，请刷新页面后重试');
        return;
      }

      const finalConfirmed = await confirmDangerCountdown({
        title: `确定删除楼栋「${name}」吗？`,
        content: '删除后无法恢复，有关联宿舍的楼栋无法删除。',
        okText: '删除楼栋',
      });
      if (!finalConfirmed) {
        return;
      }

      try {
        if (record.id === undefined || record.id === null) {
          throw new Error('缺少楼栋信息，请刷新页面后重试');
        }
        await deleteBuilding(record.id);
        message.success('已删除楼栋');
        setReloadFlag((prev) => prev + 1);
      } catch (error) {
        message.error(readErrorMessage(error, '删除失败'));
      }
    },
    [setReloadFlag],
  );

  const handleBulkDelete = useCallback(async (): Promise<void> => {
    if (!selectedIds.length) {
      return;
    }

    const finalConfirmed = await confirmDangerCountdown({
      title: `确定删除选中的 ${selectedIds.length} 栋楼吗？`,
      content: '删除后无法恢复，有关联宿舍的楼栋无法删除。',
      okText: '删除楼栋',
    });
    if (!finalConfirmed) {
      return;
    }

    setBatchLoading(true);
    try {
      await batchDeleteBuildings(selectedIds);
      message.success(`已删除 ${selectedIds.length} 栋楼`);
      setSelectedIds([]);
      setReloadFlag((prev) => prev + 1);
    } catch (error) {
      message.error(readErrorMessage(error, '批量删除失败'));
    } finally {
      setBatchLoading(false);
    }
  }, [selectedIds, setBatchLoading, setReloadFlag, setSelectedIds]);

  const handleExport = useCallback(async (): Promise<void> => {
    try {
      const blob = await exportBuildings({
        search: appliedSearchText,
        ...appliedFilters,
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = '楼栋信息.xlsx';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      message.error('导出失败，可重新点击导出');
    }
  }, [appliedFilters, appliedSearchText]);

  const handleModalOk = useCallback(async (): Promise<void> => {
    try {
      const values = (await form.validateFields()) as BuildingFormPayload;

      if (editingId !== null && editingId !== undefined) {
        await updateBuilding(editingId, values);
        message.success('已保存修改');
      } else {
        await createBuilding(values);
        message.success('已新增楼栋');
      }

      setIsModalVisible(false);
      fetchBuildings();
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'errorFields' in error &&
        Array.isArray((error as { errorFields?: unknown[] }).errorFields)
      ) {
        return;
      }
      message.error(readErrorMessage(error, '操作失败'));
    }
  }, [editingId, fetchBuildings, form, setIsModalVisible]);

  return {
    handleAdd,
    handleEdit,
    handleView,
    handleDelete,
    handleBulkDelete,
    handleExport,
    handleModalOk,
  };
}
