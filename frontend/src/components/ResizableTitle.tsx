import React from 'react';
import { Resizable } from 'react-resizable';
import type { ReactNode, HTMLAttributes } from 'react';
import type { ResizeCallbackData } from 'react-resizable';

interface ResizableTitleProps extends HTMLAttributes<HTMLTableCellElement> {
  width?: number;
  onResize?: (event: React.SyntheticEvent<Element>, data: ResizeCallbackData) => void;
  children?: ReactNode;
}

/**
 * 可调整列宽的表头单元格组件
 * 用于 Ant Design Table 的 components.header.cell
 * 
 * 使用方式：
 * <Table components={{ header: { cell: ResizableTitle } }} />
 */
const ResizableTitle = (props: ResizableTitleProps) => {
  const { onResize, width, ...restProps } = props;

  // 如果没有 width（比如操作列），则不可调整
  if (!width) {
    return <th {...restProps} />;
  }

  return (
    <Resizable
      width={width}
      height={0}
      handle={
        <span
          className="table-resize-handle"
          onClick={(e) => e.stopPropagation()}
        />
      }
      onResize={onResize}
      draggableOpts={{ enableUserSelectHack: false }}
    >
      <th {...restProps} />
    </Resizable>
  );
};

export default ResizableTitle;
