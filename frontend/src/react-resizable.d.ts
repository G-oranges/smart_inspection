declare module 'react-resizable' {
  import type { ComponentType, ReactElement, ReactNode, SyntheticEvent } from 'react';

  export interface ResizeCallbackData {
    node: HTMLElement;
    size: {
      width: number;
      height: number;
    };
    handle: ReactElement | null;
  }

  export interface ResizableProps {
    children: ReactNode;
    width: number;
    height: number;
    axis?: 'both' | 'x' | 'y' | 'none';
    handle?: ReactNode;
    draggableOpts?: Record<string, unknown>;
    minConstraints?: [number, number];
    maxConstraints?: [number, number];
    onResize?: (event: SyntheticEvent<Element>, data: ResizeCallbackData) => void;
    onResizeStart?: (event: SyntheticEvent<Element>, data: ResizeCallbackData) => void;
    onResizeStop?: (event: SyntheticEvent<Element>, data: ResizeCallbackData) => void;
  }

  export const Resizable: ComponentType<ResizableProps>;
}
