import { Button } from 'antd';
import { LeftOutlined, RightOutlined } from '@ant-design/icons';

import type { ResultEntryToolbarProps } from './types';

export default function ResultEntryToolbar({
  isScrolled,
  onBack,
  prevDorm,
  nextDorm,
  onNavigateToRoom,
  room,
  building,
  scoreColor,
  numericScore,
}: ResultEntryToolbarProps) {
  return (
    <header
      className={`sticky top-0 z-50 backdrop-blur-xl transition-all duration-300 flex items-center justify-between px-3`}
      style={{
        height: isScrolled ? '48px' : '54px',
        background: 'var(--co-header-bg)',
        borderBottom: '1px solid var(--co-glass-border)',
      }}
    >
      <div className="flex-shrink-0 w-16">
        <Button
          type="text"
          onClick={onBack}
          icon={<LeftOutlined />}
          className="text-ios-blue font-medium active:scale-95 transition-all p-1"
        >
          返回
        </Button>
      </div>

      <div className="flex-1 flex items-center justify-center gap-1">
        <Button
          type="text"
          size="small"
          icon={<LeftOutlined className="text-xs" />}
          disabled={!prevDorm}
          onClick={() => onNavigateToRoom(prevDorm)}
          className="w-7 h-7 flex items-center justify-center"
        />
        <div className="flex flex-col items-center min-w-[60px]">
          <span
            className="text-lg font-bold leading-none tracking-tight"
            style={{ paddingTop: '13.5px' }}
          >
            {room || '未选'}
          </span>
          <span className="text-[11px] text-ios-gray-label tracking-tight">
            {building || '未知楼栋'}
          </span>
        </div>
        <Button
          type="text"
          size="small"
          icon={<RightOutlined className="text-xs" />}
          disabled={!nextDorm}
          onClick={() => onNavigateToRoom(nextDorm)}
          className="w-7 h-7 flex items-center justify-center"
        />
      </div>

      <div className="flex-shrink-0 w-16 flex justify-end">
        <div
          className={`flex items-center gap-1 transition-all duration-300 ${
            isScrolled ? 'scale-100 opacity-100' : 'scale-75 opacity-0'
          }`}
        >
          <span
            className="text-lg font-bold tracking-tight"
            style={{ color: scoreColor }}
          >
            {numericScore}
          </span>
        </div>
      </div>
    </header>
  );
}
