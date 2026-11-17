import { useCallback } from 'react';
import { Modal, message } from 'antd';

import { createBuildTableParams } from '../../utils/tableParamsBuilder';
import { confirmDangerCountdown } from '../../utils/confirm';
import { DORM_FILTER_KEYS, normalizeDormGender } from './dormFilterSchema';

import type { EntityId, ServiceQueryParams, ServiceRecord } from '../../types/service';
import type {
  DormFiltersState,
  UseDormActionsProps,
  UseDormActionsResult,
} from './types';

export const buildDormTableParams: (
  appliedFilters: DormFiltersState,
  appliedSearchTerm: string,
  pagination: { current: number; pageSize: number },
  sortField: string,
  sortOrder: 'asc' | 'desc',
  withPaging?: boolean,
) => ServiceQueryParams = createBuildTableParams({
  filterKeys: DORM_FILTER_KEYS,
  normalizers: {
    gender: (value: unknown) =>
      normalizeDormGender(typeof value === 'string' ? value : String(value ?? '')),
  },
});

function readErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

export function useDormActions({
  actions,
  appliedFilters,
  appliedSearchTerm,
  pagination,
  sortField,
  sortOrder,
  selectedIds,
  selectAcrossPages,
  clearSelection,
  setBatchLoading,
  setReloadFlag,
  totalCount,
  canExport,
}: UseDormActionsProps): UseDormActionsResult {
  const handleExport = useCallback(async (): Promise<void> => {
    if (!canExport || !actions.exportDorms) {
      return;
    }

    try {
      const params = buildDormTableParams(
        appliedFilters,
        appliedSearchTerm,
        pagination,
        sortField,
        sortOrder,
        false,
      );
      const blob = await actions.exportDorms(params);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = '宿舍信息.xlsx';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      message.error(readErrorMessage(error, '导出失败'));
    }
  }, [
    actions,
    appliedFilters,
    appliedSearchTerm,
    canExport,
    pagination,
    sortField,
    sortOrder,
  ]);

  const handleDeleteSingle = useCallback(
    async (id: EntityId): Promise<void> => {
      if (!actions.deleteDorms) {
        message.error('删除能力不可用');
        return;
      }

      const finalConfirmed = await confirmDangerCountdown({
        title: '是否确认 - 删除宿舍',
        content: '删除后无法恢复，且该宿舍的入住记录将被清除。',
        okText: '确认删除',
      });
      if (!finalConfirmed) {
        return;
      }

      try {
        await actions.deleteDorms([id]);
        message.success('删除成功');
        setReloadFlag((prev) => prev + 1);
      } catch (error) {
        message.error(readErrorMessage(error, '删除失败'));
      }
    },
    [actions, setReloadFlag],
  );

  const handleBulkDelete = useCallback(async (): Promise<void> => {
    if (!actions.deleteDorms) {
      message.error('批量删除能力不可用');
      return;
    }

    const selectionCount = selectAcrossPages ? totalCount : selectedIds.length;
    if (!selectionCount) {
      return;
    }

    const firstConfirmed = await new Promise<boolean>((resolve) => {
      Modal.confirm({
        title: '确认批量删除宿舍',
        content: '删除后无法恢复，且该宿舍的入住记录将被清除。',
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
      title: '是否确认 - 批量删除宿舍',
      content: `即将永久删除 ${selectionCount} 个宿舍及其入住记录，确认继续？`,
      okText: '确认删除',
    });
    if (!finalConfirmed) {
      return;
    }

    setBatchLoading(true);
    try {
      const filterParams = buildDormTableParams(
        appliedFilters,
        appliedSearchTerm,
        pagination,
        sortField,
        sortOrder,
        false,
      );
      const payload: EntityId[] | { filter: ServiceRecord } = selectAcrossPages
        ? { filter: filterParams as ServiceRecord }
        : selectedIds;
      await actions.deleteDorms(payload);
      clearSelection();
      Modal.success({ title: '删除成功' });
      setReloadFlag((prev) => prev + 1);
    } catch (error) {
      Modal.error({
        title: '删除失败',
        content: readErrorMessage(error, '操作失败，请稍后重试。'),
      });
    } finally {
      setBatchLoading(false);
    }
  }, [
    actions,
    appliedFilters,
    appliedSearchTerm,
    clearSelection,
    pagination,
    selectAcrossPages,
    selectedIds,
    setBatchLoading,
    setReloadFlag,
    sortField,
    sortOrder,
    totalCount,
  ]);

  const handleDownloadTemplate = useCallback(async (): Promise<void> => {
    if (!actions.downloadTemplate) {
      Modal.error({ title: '下载模板失败', content: '模板下载能力不可用' });
      return;
    }

    try {
      const blob = await actions.downloadTemplate('dorms');
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = '宿舍导入模板.xlsx';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      Modal.error({
        title: '下载模板失败',
        content: readErrorMessage(error, '模板下载失败'),
      });
    }
  }, [actions]);

  return {
    handleExport,
    handleDeleteSingle,
    handleBulkDelete,
    handleDownloadTemplate,
  };
}
