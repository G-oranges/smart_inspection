// src/hooks/useBulkSelection.js
// 批量选择与跨页选择 Hook - 从管理页面抽取的通用选择逻辑
// PR#5: 降低页面复杂度，为后续页面扩面铺路
import { useCallback, useRef, useState } from 'react';

type WidenId<TId extends string | number> = TId extends string ? string : number;

interface UseBulkSelectionOptions<TId extends string | number> {
  defaultSelectedIds?: TId[];
  onCleared?: () => void;
}

interface UseBulkSelectionResult<TId extends string | number> {
  selectedIds: TId[];
  selectAcrossPages: boolean;
  batchLoading: boolean;
  setSelectedIds: React.Dispatch<React.SetStateAction<TId[]>>;
  setSelectAcrossPages: React.Dispatch<React.SetStateAction<boolean>>;
  setBatchLoading: React.Dispatch<React.SetStateAction<boolean>>;
  toggleRow: (id: TId) => void;
  selectPage: (pageIds: TId[]) => void;
  selectAllResults: () => void;
  clearSelection: () => void;
  getSelectionCount: (totalCount?: number) => number;
  isRowSelected: (id: TId) => boolean;
}

/**
 * 批量选择与跨页选择 Hook
 * 
 * 设计原则：
 * 1. 选择状态独立管理，与分页/排序解耦
 * 2. clearSelection 同时清空 selectedIds 和 selectAcrossPages
 * 3. 支持全选本页、全选全部结果、清空选择
 * 4. batchLoading 用于批量操作时的 loading 状态
 * 
 * 使用方式：
 * 1. 在 useTableState 的 onApply/onReset 回调中调用 clearSelection()
 * 2. 批量删除/导出时根据 selectAcrossPages 决定 payload
 * 
 * @param {Object} options
 * @param {string[]} [options.defaultSelectedIds=[]] - 默认选中的 ID 列表
 * @param {() => void} [options.onCleared] - 选择被清空时的回调
 * @returns {Object}
 */
export const useBulkSelection = <TId extends string | number = string>(
  options: UseBulkSelectionOptions<TId> = {},
): UseBulkSelectionResult<WidenId<TId>> => {
  const {
    defaultSelectedIds = [],
    onCleared,
  } = options;

  // ========== 状态 ==========
  const [selectedIds, setSelectedIds] = useState<WidenId<TId>[]>(
    defaultSelectedIds as WidenId<TId>[],
  );
  const [selectAcrossPages, setSelectAcrossPages] = useState(false);
  const [batchLoading, setBatchLoading] = useState(false);

  // 回调 ref（避免依赖变化）
  const onClearedRef = useRef(onCleared);
  onClearedRef.current = onCleared;

  // ========== 操作方法 ==========

  /**
   * 切换单行选中状态
   * @param {string} id - 行 ID
   */
  const toggleRow = useCallback((id: WidenId<TId>) => {
    setSelectedIds((prev) => {
      const isSelected = prev.includes(id);
      if (isSelected) {
        return prev.filter((x) => x !== id);
      } else {
        return [...prev, id];
      }
    });
    // 单行操作时取消跨页选择
    setSelectAcrossPages(false);
  }, []);

  /**
   * 选中本页所有行（追加到已选中）
   * @param {string[]} pageIds - 当前页的 ID 列表
   */
  const selectPage = useCallback((pageIds: WidenId<TId>[]) => {
    setSelectAcrossPages(false);
    setSelectedIds((prev) => Array.from(new Set([...prev, ...pageIds])));
  }, []);

  /**
   * 全选所有结果（跨页）
   * 注意：此时 selectedIds 清空，selectAcrossPages=true
   * 批量操作时应根据 filter 参数操作全部结果
   */
  const selectAllResults = useCallback(() => {
    setSelectAcrossPages(true);
    setSelectedIds([]);
  }, []);

  /**
   * 清空选择
   * 同时清空 selectedIds 和 selectAcrossPages
   * 触发 onCleared 回调（如有）
   */
  const clearSelection = useCallback(() => {
    setSelectAcrossPages(false);
    setSelectedIds([]);
    onClearedRef.current?.();
  }, []);

  /**
   * 判断是否有选中内容
   * @param {number} totalCount - 总条数（用于跨页选择时）
   * @returns {number} 实际选中的数量
   */
  const getSelectionCount = useCallback((totalCount = 0) => {
    return selectAcrossPages ? totalCount : selectedIds.length;
  }, [selectAcrossPages, selectedIds.length]);

  /**
   * 判断某行是否选中
   * @param {string} id - 行 ID
   * @returns {boolean}
   */
  const isRowSelected = useCallback((id: WidenId<TId>) => {
    // 跨页选择时，所有行都视为选中（但实际由后端处理）
    // 这里返回 false 让复选框不显示选中，而是显示"全部选中"提示
    return !selectAcrossPages && selectedIds.includes(id);
  }, [selectAcrossPages, selectedIds]);

  // ========== 返回值 ==========

  return {
    // 状态
    selectedIds,
    selectAcrossPages,
    batchLoading,

    // 状态更新器（用于特殊场景，如批量删除成功后清空）
    setSelectedIds,
    setSelectAcrossPages,
    setBatchLoading,

    // 操作方法
    toggleRow,
    selectPage,
    selectAllResults,
    clearSelection,

    // 辅助方法
    getSelectionCount,
    isRowSelected,
  };
};
