import { useCallback } from 'react';
import { message } from 'antd';

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
        message.error('当前无法删除宿舍，请联系管理员');
        return;
      }

      const finalConfirmed = await confirmDangerCountdown({
        title: '确定删除该宿舍吗？',
        content: '删除后无法恢复，该宿舍的入住记录也会被清除。',
        okText: '删除宿舍',
      });
      if (!finalConfirmed) {
        return;
      }

      try {
        await actions.deleteDorms([id]);
        message.success('已删除宿舍');
        setReloadFlag((prev) => prev + 1);
      } catch (error) {
        message.error(readErrorMessage(error, '删除失败'));
      }
    },
    [actions, setReloadFlag],
  );

  const handleBulkDelete = useCallback(async (): Promise<void> => {
    if (!actions.deleteDorms) {
      message.error('当前无法删除宿舍，请联系管理员');
      return;
    }

    const selectionCount = selectAcrossPages ? totalCount : selectedIds.length;
    if (!selectionCount) {
      return;
    }

    const finalConfirmed = await confirmDangerCountdown({
      title: `确定删除选中的 ${selectionCount} 间宿舍吗？`,
      content: `删除后无法恢复，选中的 ${selectionCount} 间宿舍及其入住记录都会被清除。`,
      okText: '删除宿舍',
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
      message.success(`已删除 ${selectionCount} 间宿舍`);
      setReloadFlag((prev) => prev + 1);
    } catch (error) {
      message.error(readErrorMessage(error, '删除失败，请稍后重试'));
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
      message.error('当前无法下载模板，请联系管理员');
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
      message.error(readErrorMessage(error, '模板下载失败'));
    }
  }, [actions]);

  return {
    handleExport,
    handleDeleteSingle,
    handleBulkDelete,
    handleDownloadTemplate,
  };
}
