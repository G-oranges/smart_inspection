import { useState, useCallback, useMemo } from 'react';
import type { SyntheticEvent } from 'react';
import type { ResizeCallbackData } from 'react-resizable';

interface ResizableColumn {
  key?: string | number;
  dataIndex?: string | number | readonly (string | number)[];
  width?: number;
  fixed?: boolean | 'left' | 'right';
  onHeaderCell?: () => {
    width: number;
    onResize: (
      event: SyntheticEvent<Element>,
      data: ResizeCallbackData,
    ) => void;
  };
  [key: string]: unknown;
}

interface UseResizableColumnsOptions {
  minWidth?: number;
  maxWidth?: number;
}

type ColumnWidths = Record<string, number>;

function getColumnKey(column: ResizableColumn, index: number): string {
  if (column.key != null) {
    return String(column.key);
  }

  if (Array.isArray(column.dataIndex)) {
    return column.dataIndex.map(String).join('.');
  }

  if (column.dataIndex != null) {
    return String(column.dataIndex);
  }

  return `col_${index}`;
}

/**
 * 可调整列宽的 Hook
 * 
 * 该 Hook 管理表格列宽状态，为每列添加 onHeaderCell 属性以支持拖拽调整
 * 
 * @param {Array} initialColumns - 初始列配置数组
 * @param {Object} options - 配置选项
 * @param {number} options.minWidth - 最小列宽，默认 60
 * @param {number} options.maxWidth - 最大列宽，默认 500
 * @returns {Object} { columns, handleResize, resetWidths }
 * 
 * @example
 * const { columns } = useResizableColumns(myColumns, { minWidth: 80 });
 * <Table columns={columns} components={{ header: { cell: ResizableTitle } }} />
 */
export function useResizableColumns<TColumn extends ResizableColumn>(
  initialColumns: TColumn[],
  options: UseResizableColumnsOptions = {},
) {
  const { minWidth = 60, maxWidth = 500 } = options;
  
  // 存储每列的宽度状态
  const [columnWidths, setColumnWidths] = useState<ColumnWidths>(() => {
    const widths: ColumnWidths = {};
    initialColumns.forEach((col, index) => {
      const key = getColumnKey(col, index);
      if (col.width && typeof col.width === 'number') {
        widths[key] = col.width;
      }
    });
    return widths;
  });

  // 创建 resize handler 工厂函数
  const createResizeHandler = useCallback(
    (key: string) =>
      (e: SyntheticEvent<Element>, { size }: ResizeCallbackData) => {
        e.stopPropagation();
        const newWidth = Math.max(minWidth, Math.min(maxWidth, size.width));
        setColumnWidths((prev) => ({
          ...prev,
          [key]: newWidth,
        }));
      },
    [minWidth, maxWidth],
  );

  // 合并列配置和宽度状态，生成带有 onHeaderCell 的列配置
  const columns = useMemo(() => {
    return initialColumns.map((col, index) => {
      const key = getColumnKey(col, index);
      const currentWidth = columnWidths[key] || col.width;
      
      // 固定列（如操作列）不需要 resize 功能
      if (col.fixed) {
        return { 
          ...col, 
          width: currentWidth,
        };
      }

      // 没有设置宽度的列也不启用 resize
      if (!currentWidth || typeof currentWidth !== 'number') {
        return col;
      }

      return {
        ...col,
        width: currentWidth,
        onHeaderCell: () => ({
          width: currentWidth,
          onResize: createResizeHandler(key),
        }),
      } as TColumn;
    });
  }, [initialColumns, columnWidths, createResizeHandler]);

  // 重置列宽到初始值
  const resetWidths = useCallback(() => {
    const widths: ColumnWidths = {};
    initialColumns.forEach((col, index) => {
      const key = getColumnKey(col, index);
      if (col.width && typeof col.width === 'number') {
        widths[key] = col.width;
      }
    });
    setColumnWidths(widths);
  }, [initialColumns]);

  return { 
    columns, 
    resetWidths,
    // 导出当前宽度状态，以便需要时保存
    columnWidths,
  };
}

export default useResizableColumns;
