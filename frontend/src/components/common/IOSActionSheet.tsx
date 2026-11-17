import React from 'react';
import { Drawer } from 'antd';

export interface IOSActionSheetAction {
  key?: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
  type?: 'default' | 'primary' | 'danger' | 'disabled';
  onClick?: () => void;
  loading?: boolean;
  hidden?: boolean;
}

export interface IOSActionSheetProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: IOSActionSheetAction[];
  showCancel?: boolean;
  cancelText?: React.ReactNode;
}

/**
 * iOS 风格 Action Sheet 组件
 * 用于移动端底部弹出的操作菜单，提供类 iOS 原生体验
 * 
 * @param {boolean} open - 是否显示
 * @param {function} onClose - 关闭回调
 * @param {string} title - 标题文字
 * @param {string} subtitle - 副标题/描述文字 (可选)
 * @param {Array} actions - 操作按钮数组
 *   @param {string} actions[].key - 唯一标识
 *   @param {string} actions[].label - 按钮文字
 *   @param {ReactNode} actions[].icon - 按钮图标 (可选)
 *   @param {string} actions[].type - 按钮类型: 'default' | 'primary' | 'danger' | 'disabled'
 *   @param {function} actions[].onClick - 点击回调
 *   @param {boolean} actions[].loading - 是否加载中 (可选)
 *   @param {boolean} actions[].hidden - 是否隐藏 (可选)
 * @param {boolean} showCancel - 是否显示取消按钮 (默认 true)
 * @param {string} cancelText - 取消按钮文字 (默认 "取消")
 */
const IOSActionSheet = ({
  open,
  onClose,
  title,
  subtitle,
  actions = [],
  showCancel = true,
  cancelText = '取消',
}: IOSActionSheetProps) => {
  // 生命周期钩子：处理 body 类名以实现下沉效果
  React.useEffect(() => {
    if (open) {
      document.body.classList.add('ios-sheet-active');
    } else {
      document.body.classList.remove('ios-sheet-active');
    }
    return () => {
      document.body.classList.remove('ios-sheet-active');
    };
  }, [open]);

  // 过滤掉隐藏的按钮
  const visibleActions = actions.filter((action) => !action.hidden);

  return (
    <Drawer
      placement="bottom"
      open={open}
      onClose={onClose}
      closable={false}
      style={{ height: 'auto' }}
      className="ios-action-sheet-drawer"
      rootClassName="ios-action-sheet-root"
      styles={{
        wrapper: { 
          height: 'auto !important',
          minHeight: 'auto',
          maxHeight: '85vh',
          backgroundColor: 'transparent',
        },
        body: { 
          padding: 0,
          backgroundColor: 'transparent',
        },
        mask: { 
          backgroundColor: 'transparent',
          backdropFilter: 'blur(15px) saturate(180%)',
          WebkitBackdropFilter: 'blur(15px) saturate(180%)',
        },
      }}
    >
      <div className="px-3 pb-3">
        {/* 主操作区域 */}
        <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl rounded-[14px] overflow-hidden mb-2">
          {/* 标题区域 */}
          {(title || subtitle) && (
            <div className="text-center py-4 px-6 border-b border-black/5 dark:border-white/10">
              {title && (
                <div className="text-[13px] font-semibold text-black/60 dark:text-white/60 uppercase tracking-wide">
                  {title}
                </div>
              )}
              {subtitle && (
                <div className="text-[12px] text-black/40 dark:text-white/40 mt-1">
                  {subtitle}
                </div>
              )}
            </div>
          )}

          {/* 操作按钮列表 */}
          <div className="divide-y divide-black/5 dark:divide-white/10">
            {visibleActions.map((action, index) => (
              <button
                key={action.key || index}
                className={`
                  w-full h-[56px] flex items-center justify-center gap-2
                  text-[17px] font-normal
                  transition-all duration-150
                  active:bg-black/5 dark:active:bg-white/10
                  disabled:opacity-50 disabled:cursor-not-allowed
                  ${action.type === 'danger' ? 'text-ios-red' : ''}
                  ${action.type === 'primary' ? 'text-ios-blue font-semibold' : ''}
                  ${action.type === 'disabled' ? 'text-gray-400 dark:text-gray-600' : 'text-black dark:text-white'}
                `}
                onClick={() => {
                  if (action.type !== 'disabled' && action.onClick) {
                    action.onClick();
                  }
                }}
                disabled={action.type === 'disabled' || action.loading}
              >
                {action.loading ? (
                  <span className="animate-spin">⏳</span>
                ) : action.icon}
                <span>{action.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 取消按钮 (独立区域) */}
        {showCancel && (
          <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl rounded-[14px] overflow-hidden">
            <button
              className="
                w-full h-[56px] flex items-center justify-center
                text-[17px] font-semibold text-ios-blue
                transition-all duration-150
                active:bg-black/5 dark:active:bg-white/10
              "
              onClick={onClose}
            >
              {cancelText}
            </button>
          </div>
        )}
        {/* Safe area bottom padding */}
        <div style={{ height: 'env(safe-area-inset-bottom, 8px)' }} />
      </div>
    </Drawer>
  );
};

export default IOSActionSheet;
