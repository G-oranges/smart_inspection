/**
 * 桌面端弹窗统一宽度档位，配合 className="co-modal" 使用。
 * 规范见 doc/modal_style_guide.md
 */
export const MODAL_WIDTH = {
  /** 确认、提示、单字段输入 */
  sm: 480,
  /** 常规表单、详情 */
  md: 640,
  /** 表格预检、多步骤表单、字段设置 */
  lg: 880,
  /** 分配、异动等左右分栏工作区 */
  xl: 1080,
} as const;
