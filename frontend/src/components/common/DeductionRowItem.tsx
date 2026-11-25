import type { ReactNode } from 'react';
import { Button } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';

export type DeductionRowStatusTone = 'default' | 'modified' | 'added' | 'removed';

export interface DeductionRowItemProps {
  name: string;
  locations?: string[];
  emptyLocationText?: string;
  points?: number | null;
  count?: number;
  disputed?: boolean;
  statusTone?: DeductionRowStatusTone;
  showDivider?: boolean;
  disabled?: boolean;
  leading?: ReactNode;
  trailing?: ReactNode;
  onClick?: () => void;
  onRemove?: () => void;
}

export default function DeductionRowItem({
  name,
  locations = [],
  emptyLocationText = '公共区域',
  points = 0,
  count = 1,
  disputed = false,
  statusTone = 'default',
  showDivider = false,
  disabled = false,
  leading,
  trailing,
  onClick,
  onRemove,
}: DeductionRowItemProps) {
  const numericPoints = Number(points) || 0;
  const numericCount = count || 1;
  const totalPoints = numericPoints * numericCount;
  const isRemoved = statusTone === 'removed';

  return (
    <div
      className={`re-deduction-row appeal-deduction-row appeal-deduction-row--${statusTone}${
        onClick && !disabled ? ' cursor-pointer' : ''
      }`}
      style={{
        borderBottom: showDivider ? '1px solid var(--co-glass-border)' : undefined,
      }}
      onClick={() => {
        if (!disabled && onClick) {
          onClick();
        }
      }}
    >
      {leading ? <div className="flex-shrink-0 mr-2.5 flex items-center">{leading}</div> : null}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          {disputed ? (
            <span
              className="appeal-disputed-dot"
              title="学生标记异议"
              aria-label="学生标记异议"
            />
          ) : null}
          <span
            className={`text-sm truncate ${isRemoved ? 'line-through opacity-55' : ''}`}
            style={{ color: 'var(--co-text)' }}
          >
            {name || '未选择'}
          </span>
          {numericPoints > 0 ? (
            <span className="text-xs" style={{ color: 'var(--co-text-muted)' }}>
              (-{numericPoints}分/次)
            </span>
          ) : null}
          {disputed ? (
            <span className="appeal-inline-pill appeal-inline-pill--warning">
              异议项
            </span>
          ) : null}
          {statusTone === 'added' ? (
            <span className="appeal-inline-pill appeal-inline-pill--warning">
              新增
            </span>
          ) : null}
          {statusTone === 'modified' ? (
            <span className="appeal-inline-pill appeal-inline-pill--primary">
              已调整
            </span>
          ) : null}
          {statusTone === 'removed' ? (
            <span className="appeal-inline-pill appeal-inline-pill--muted">
              已撤销
            </span>
          ) : null}
        </div>

        <div
          className="text-[11px] mt-0.5 flex items-center gap-1 flex-wrap"
          style={{ color: 'var(--co-text-muted)' }}
        >
          {locations.length > 0 ? (
            locations.map((loc) => <span key={loc}>{loc}</span>)
          ) : (
            <span className="italic">{emptyLocationText}</span>
          )}
        </div>
      </div>

      <div
        className="flex items-center gap-2.5 flex-shrink-0 ml-3"
        onClick={(event) => event.stopPropagation()}
      >
        {trailing !== undefined ? (
          trailing
        ) : (
          <>
            <span className={`re-deduct-total ${isRemoved ? 'line-through opacity-45' : ''}`}>
              -{totalPoints}
            </span>
            {onRemove ? (
              <Button
                type="text"
                size="small"
                icon={
                  <DeleteOutlined
                    style={{ color: 'var(--co-text-muted)', transition: 'color 0.15s' }}
                  />
                }
                onClick={onRemove}
                disabled={disabled}
                className="hover:!text-red-500"
                aria-label="移除扣分项"
              />
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
