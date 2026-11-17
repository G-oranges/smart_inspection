import { useCallback } from 'react';
import { DeleteOutlined } from '@ant-design/icons';
import { Modal, message } from 'antd';

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
        message.error('楼栋信息缺失，无法删除，请刷新后重试');
        return;
      }

      const finalConfirmed = await confirmDangerCountdown({
        title: '是否确认 - 删除楼栋',
        content: `即将永久删除楼栋「${name}」，该操作不可撤销。`,
        okText: '确认删除',
      });
      if (!finalConfirmed) {
        return;
      }

      try {
        if (record.id === undefined || record.id === null) {
          throw new Error('楼栋 ID 缺失');
        }
        await deleteBuilding(record.id);
        message.success('删除成功');
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

    const firstConfirmed = await new Promise<boolean>((resolve) => {
      Modal.confirm({
        title: '确认批量删除楼栋',
        icon: <DeleteOutlined style={{ color: '#ff4d4f' }} />,
        content: (
          <div>
            <p>您确定要删除选中的 {selectedIds.length} 个楼栋吗？</p>
            <p style={{ color: '#ff4d4f', fontSize: '12px' }}>
              警告：此操作不可撤销。如果楼栋内有关联的宿舍，删除将失败。
            </p>
          </div>
        ),
        okText: '确认删除',
        okType: 'danger',
        cancelText: '取消',
        maskClosable: false,
        keyboard: false,
        onOk: () => resolve(true),
        onCancel: () => resolve(false),
      });
    });
    if (!firstConfirmed) {
      return;
    }

    const finalConfirmed = await confirmDangerCountdown({
      title: '是否确认 - 批量删除楼栋',
      content: `即将永久删除选中的 ${selectedIds.length} 个楼栋，确认继续？`,
      okText: '确认删除',
    });
    if (!finalConfirmed) {
      return;
    }

    setBatchLoading(true);
    try {
      await batchDeleteBuildings(selectedIds);
      message.success(`成功删除 ${selectedIds.length} 个楼栋`);
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
      message.error('导出失败，请重试');
    }
  }, [appliedFilters, appliedSearchText]);

  const handleModalOk = useCallback(async (): Promise<void> => {
    try {
      const values = (await form.validateFields()) as BuildingFormPayload;
      const isEdit = Boolean(editingId);
      const confirmTitle = isEdit ? '确认更新楼栋信息' : '确认新增楼栋';
      const confirmContent = isEdit
        ? `即将更新楼栋「${values.name || '未命名'}」的基础信息，确认继续？`
        : `即将新增楼栋「${values.name || '未命名'}」，确认继续？`;
      const confirmed = await new Promise<boolean>((resolve) => {
        Modal.confirm({
          title: confirmTitle,
          content: confirmContent,
          okText: isEdit ? '确认更新' : '确认新增',
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

      if (editingId !== null && editingId !== undefined) {
        await updateBuilding(editingId, values);
        message.success('更新成功');
      } else {
        await createBuilding(values);
        message.success('创建成功');
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
