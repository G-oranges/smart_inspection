import { DownOutlined } from '@ant-design/icons';
import { Row } from 'antd';
import type { CSSProperties, ReactNode } from 'react';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';

import useMobile from '../../hooks/useMobile';
import useContextualStatsState from '../../hooks/useContextualStatsState';

export type StatSegmentTone =
  | 'blue'
  | 'green'
  | 'orange'
  | 'purple'
  | 'red'
  | 'gray';

export interface StatSegment {
  id: string;
  icon: ReactNode;
  value: string | number;
  label: string;
  secondary?: string | number;
  unit?: string;
  tone?: StatSegmentTone;
}

export interface CollapsibleStatsBoardProps {
  expandedContent: ReactNode;
  segments: StatSegment[];
  collapseThreshold?: number;
  desktopTopOffset?: number;
  mobileTopOffset?: number;
}

const COLLAPSED_HEIGHT = 46;
const MOBILE_HANDLE_HEIGHT = 32;

export default function CollapsibleStatsBoard({
  expandedContent,
  segments,
  collapseThreshold = 80,
  desktopTopOffset = 72,
  mobileTopOffset = 8,
}: CollapsibleStatsBoardProps) {
  const isMobile = useMobile();
  const expandedRef = useRef<HTMLDivElement>(null);
  const [expandedHeight, setExpandedHeight] = useState(0);

  const { state, isCollapsed, isArmed, isExpanding } = useContextualStatsState({
    collapseThreshold,
    isMobile,
  });

  useLayoutEffect(() => {
    const node = expandedRef.current;
    if (!node) {
      return undefined;
    }

    const updateHeight = () => {
      const nextHeight = Math.ceil(node.getBoundingClientRect().height);
      if (nextHeight > 0) {
        setExpandedHeight((previousHeight) =>
          previousHeight === nextHeight ? previousHeight : nextHeight,
        );
      }
    };

    updateHeight();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateHeight);
      return () => window.removeEventListener('resize', updateHeight);
    }

    const observer = new ResizeObserver(() => {
      updateHeight();
    });

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const surfaceHeight = useMemo(() => {
    if (isCollapsed) {
      return isMobile ? MOBILE_HANDLE_HEIGHT : COLLAPSED_HEIGHT;
    }

    return expandedHeight || undefined;
  }, [expandedHeight, isCollapsed, isMobile]);

  const topOffset = isMobile ? mobileTopOffset : desktopTopOffset;
  const boardStyle = {
    '--collapsible-stats-top': `${topOffset}px`,
  } as CSSProperties;

  return (
    <div className="collapsible-stats-board" style={boardStyle}>
      <div
        className={`collapsible-stats-board__sticky ${
          state === 'EXPANDED' ? 'is-static' : 'is-sticky'
        }`}
      >
        <div
          className={`collapsible-stats-board__surface state-${state.toLowerCase()}`}
          style={{
            height: surfaceHeight ? `${surfaceHeight}px` : undefined,
            minHeight: `${isMobile ? MOBILE_HANDLE_HEIGHT : COLLAPSED_HEIGHT}px`,
          }}
          data-state={state}
        >
          <div
            ref={expandedRef}
            className="collapsible-stats-board__expanded"
            aria-hidden={isCollapsed}
          >
            <Row gutter={[16, 16]} className="items-stretch">
              {expandedContent}
            </Row>
          </div>

          <div
            className={`collapsible-stats-board__micro ${
              isArmed ? 'is-armed' : ''
            } ${isExpanding ? 'is-expanding' : ''}`}
            aria-hidden={!isCollapsed && !isExpanding}
          >
            {isMobile ? (
              <div className="collapsible-stats-board__mobile-handle">
                <div className="collapsible-stats-board__mobile-handle-main">
                  <span className="collapsible-stats-board__mobile-grip" aria-hidden="true" />
                  <span className="collapsible-stats-board__mobile-copy">
                    查看统计概览
                  </span>
                </div>
                <span className="collapsible-stats-board__hint" aria-hidden="true">
                  <DownOutlined />
                </span>
              </div>
            ) : (
              <>
                <div className="collapsible-stats-board__segments">
                  {segments.map((segment, index) => (
                    <div
                      key={segment.id}
                      className="collapsible-stats-board__segment"
                      data-tone={segment.tone || 'gray'}
                    >
                      <span className="collapsible-stats-board__segment-icon">
                        {segment.icon}
                      </span>
                      <span
                        className="collapsible-stats-board__segment-metric"
                        style={{ fontVariantNumeric: 'tabular-nums lining-nums' }}
                      >
                        <span className="collapsible-stats-board__segment-value">
                          {segment.value}
                        </span>
                        {segment.secondary !== undefined ? (
                          <>
                            <span className="collapsible-stats-board__segment-divider">
                              /
                            </span>
                            <span className="collapsible-stats-board__segment-secondary">
                              {segment.secondary}
                            </span>
                          </>
                        ) : null}
                        {segment.unit ? (
                          <span className="collapsible-stats-board__segment-unit">
                            {segment.unit}
                          </span>
                        ) : null}
                      </span>
                      <span className="collapsible-stats-board__segment-label">
                        {segment.label}
                      </span>
                      {index < segments.length - 1 ? (
                        <span
                          className="collapsible-stats-board__segment-separator"
                          aria-hidden="true"
                        />
                      ) : null}
                    </div>
                  ))}
                </div>
                <span className="collapsible-stats-board__hint" aria-hidden="true">
                  <DownOutlined />
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
