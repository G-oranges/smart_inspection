import { useCallback, useEffect, useMemo, useState } from 'react';
import { Col, Popover, Row, Spin } from 'antd';
import { CheckCircleFilled } from '@ant-design/icons';

import DormGrid from './DormGrid';

import type { EntityId, ServiceRecord } from '../types/service';

interface DormGridSelectorRecord extends ServiceRecord {
  id?: EntityId;
  building?: string;
  roomNo?: string | number;
  campus?: string;
  floor?: string | number | null;
  capacity?: number;
  occupiedCount?: number;
  monitorName?: string;
  grade?: string;
  _readonly?: boolean;
  _readonlyReason?: string;
}

interface RawBedStudentRecord extends ServiceRecord {
  id?: EntityId;
  fullName?: string;
  name?: string;
  gender?: string;
}

interface RawBedRecord extends ServiceRecord {
  bedNo?: string | number;
  studentId?: EntityId;
  studentName?: string | null;
  student?: RawBedStudentRecord;
  gender?: string;
}

interface DormGridBedRecord {
  key: string;
  dormId?: EntityId;
  bedNo?: string | number;
  status: 'VACANT' | 'OCCUPIED' | 'LOCKED' | 'ERROR';
  studentId?: EntityId;
  studentName?: string;
  gender?: string;
  [key: string]: unknown;
}

interface ActiveBedState {
  dormId?: EntityId | null;
  bedNo?: string | number | null;
}

interface GridSettings {
  gutter: number;
  xs: number;
  sm?: number;
  md?: number;
  lg?: number;
  xl?: number;
  xxl?: number;
}

interface DormGridSelectorProps {
  dataSource?: DormGridSelectorRecord[];
  selectedRowKeys?: EntityId[];
  onChange?: (keys: EntityId[]) => void;
  onCardAction?: (action: string, item: DormGridSelectorRecord) => void;
  viewMode?: 'card' | 'mini';
  grid?: GridSettings;
  bedDisplayMode?: 'none' | 'popover' | 'inline';
  onBedSelect?: (bed: DormGridBedRecord) => void;
  onFetchBeds?: (
    roomId: EntityId,
  ) => Promise<{ dormBeds?: RawBedRecord[] } | RawBedRecord[]>;
  bedsByRoomId?: Record<string, RawBedRecord[]>;
  disableFullRooms?: boolean;
  allowSwap?: boolean;
  activeBed?: ActiveBedState | null;
}

const DEFAULT_GRID: GridSettings = {
  gutter: 16,
  xs: 1,
  sm: 2,
  md: 3,
  lg: 4,
  xl: 6,
};

const MINI_GRID: GridSettings = {
  gutter: 8,
  xs: 2,
  sm: 3,
  md: 6,
  lg: 8,
  xl: 10,
  xxl: 12,
};

function normalizeRoomKey(roomId: EntityId | null | undefined): string {
  return roomId === null || roomId === undefined ? '' : String(roomId);
}

function normalizeFetchedBeds(
  result: { dormBeds?: RawBedRecord[] } | RawBedRecord[] | null | undefined,
): RawBedRecord[] {
  if (Array.isArray(result)) {
    return result;
  }

  if (Array.isArray(result?.dormBeds)) {
    return result.dormBeds;
  }

  return [];
}

function getSpan(columns?: number): number {
  return columns ? Math.floor(24 / columns) : 24;
}

export default function DormGridSelector({
  dataSource = [],
  selectedRowKeys = [],
  onChange,
  onCardAction,
  viewMode = 'card',
  grid = DEFAULT_GRID,
  bedDisplayMode = 'none',
  onBedSelect,
  onFetchBeds,
  bedsByRoomId,
  disableFullRooms = false,
  allowSwap = false,
  activeBed = null,
}: DormGridSelectorProps) {
  const [bedCache, setBedCache] = useState<Record<string, RawBedRecord[]>>({});
  const [loadingRooms, setLoadingRooms] = useState<Set<string>>(new Set());
  const [popoverOpen, setPopoverOpen] = useState<string | null>(null);

  const currentGrid = viewMode === 'mini' ? MINI_GRID : grid;

  const loadBeds = useCallback(
    async (roomId: EntityId): Promise<void> => {
      if (!onFetchBeds) {
        return;
      }

      const roomKey = normalizeRoomKey(roomId);
      if (!roomKey || bedCache[roomKey] || loadingRooms.has(roomKey)) {
        return;
      }

      setLoadingRooms((prev) => {
        const next = new Set(prev);
        next.add(roomKey);
        return next;
      });

      try {
        const result = await onFetchBeds(roomId);
        setBedCache((prev) => ({
          ...prev,
          [roomKey]: normalizeFetchedBeds(result),
        }));
      } catch (error) {
        console.error(`Failed to load beds for room ${roomKey}`, error);
      } finally {
        setLoadingRooms((prev) => {
          const next = new Set(prev);
          next.delete(roomKey);
          return next;
        });
      }
    },
    [bedCache, loadingRooms, onFetchBeds],
  );

  useEffect(() => {
    if (bedDisplayMode !== 'inline' || !onFetchBeds) {
      return;
    }

    dataSource.forEach((room) => {
      const roomId = room.id;
      const roomKey = normalizeRoomKey(roomId);
      if (!roomId || !roomKey) {
        return;
      }
      if (bedsByRoomId?.[roomKey] || bedCache[roomKey] || loadingRooms.has(roomKey)) {
        return;
      }

      void loadBeds(roomId);
    });
  }, [bedCache, bedDisplayMode, bedsByRoomId, dataSource, loadBeds, loadingRooms, onFetchBeds]);

  const getBedsForRoom = useCallback(
    (roomId: EntityId | null | undefined): RawBedRecord[] | null => {
      const roomKey = normalizeRoomKey(roomId);
      if (!roomKey) {
        return null;
      }

      if (bedsByRoomId?.[roomKey]) {
        return bedsByRoomId[roomKey];
      }

      return bedCache[roomKey] || null;
    },
    [bedCache, bedsByRoomId],
  );

  const handleToggle = useCallback(
    (id?: EntityId): void => {
      if (id === undefined || id === null) {
        return;
      }

      const room = dataSource.find((item) => item.id === id);
      if (room?._readonly) {
        return;
      }
      if (room && disableFullRooms) {
        const isFull = (Number(room.capacity) || 0) > 0 && (Number(room.occupiedCount) || 0) >= Number(room.capacity);
        if (isFull) {
          return;
        }
      }

      if (!onChange) {
        return;
      }

      const nextSelection = selectedRowKeys.includes(id)
        ? selectedRowKeys.filter((key) => key !== id)
        : [...selectedRowKeys, id];
      onChange(nextSelection);
    },
    [dataSource, disableFullRooms, onChange, selectedRowKeys],
  );

  const occupancyDots = useCallback((occupied: number, capacity: number, compact = false) => {
    const safeCapacity = capacity || 0;
    if (safeCapacity <= 0) {
      return <span className="value-muted">-</span>;
    }

    return (
      <div
        className={`dorm-occupancy-dots ${compact ? 'dorm-occupancy-dots-compact' : 'dorm-occupancy-dots-card'}`}
        aria-label={`已入住 ${occupied} / ${safeCapacity}`}
        title={`已入住 ${occupied} / ${safeCapacity}`}
      >
        {Array.from({ length: safeCapacity }, (_, index) => {
          const isOccupied = index < occupied;
          return (
            <span
              key={`${safeCapacity}-${occupied}-${index}`}
              className={`dorm-occupancy-dot ${isOccupied ? 'is-occupied' : 'is-empty'}`}
            />
          );
        })}
      </div>
    );
  }, []);

  const normalizeBeds = useCallback(
    (roomId: EntityId | null | undefined): DormGridBedRecord[] | null => {
      const rawBeds = getBedsForRoom(roomId);
      if (!rawBeds) {
        return null;
      }

      const roomKey = normalizeRoomKey(roomId);
      return rawBeds.map((bed) => {
        const studentName = bed.studentName || bed.student?.fullName || bed.student?.name || null;
        const occupied = Boolean(bed.studentId || bed.student?.id);
        return {
          key: `${roomKey}-${bed.bedNo}`,
          dormId: roomId ?? undefined,
          bedNo: bed.bedNo,
          status: occupied ? 'OCCUPIED' : 'VACANT',
          studentId: bed.studentId || bed.student?.id,
          studentName: studentName ?? undefined,
          gender: bed.gender || bed.student?.gender,
        };
      });
    },
    [getBedsForRoom],
  );

  const handleBedClick = useCallback(
    (roomId: EntityId | null | undefined, bed: DormGridBedRecord): void => {
      const isOccupied = bed.status === 'OCCUPIED';
      const isSwappable = allowSwap && isOccupied;
      if (!onBedSelect || (!isSwappable && isOccupied)) {
        return;
      }

      onBedSelect({
        ...bed,
        dormId: roomId ?? undefined,
        studentName: bed.studentName || undefined,
      });
    },
    [allowSwap, onBedSelect],
  );

  const renderInlineBeds = useCallback(
    (roomId: EntityId | null | undefined) => {
      const roomKey = normalizeRoomKey(roomId);
      const beds = normalizeBeds(roomId);
      const isLoading = loadingRooms.has(roomKey);

      if (isLoading && !beds) {
        return <Spin size="small" style={{ marginTop: 8, display: 'block', textAlign: 'center' }} />;
      }

      if (!beds && !isLoading) {
        return null;
      }

        const activeKey = activeBed && activeBed.dormId === roomId ? `${roomKey}-${activeBed.bedNo}` : null;

      return (
        <div className="mt-2" onClick={(event) => event.stopPropagation()}>
          <DormGrid<DormGridBedRecord>
            beds={beds || []}
            columns={2}
            activeBedKey={activeKey}
            onBedClick={(bed: DormGridBedRecord) => handleBedClick(roomId, bed)}
          />
        </div>
      );
    },
    [activeBed, handleBedClick, loadingRooms, normalizeBeds],
  );

  const handlePopoverOpenChange = useCallback(
    async (roomId: EntityId | null | undefined, open: boolean): Promise<void> => {
      const roomKey = normalizeRoomKey(roomId);
      if (!roomKey) {
        return;
      }

      if (!open) {
        setPopoverOpen(null);
        return;
      }

      setPopoverOpen(roomKey);
      if (bedsByRoomId?.[roomKey] || bedCache[roomKey] || roomId === undefined || roomId === null) {
        return;
      }

      await loadBeds(roomId);
    },
    [bedCache, bedsByRoomId, loadBeds],
  );

  const renderPopoverContent = useCallback(
    (roomId: EntityId | null | undefined) => <div style={{ width: 200 }}>{renderInlineBeds(roomId)}</div>,
    [renderInlineBeds],
  );

  const renderCardItem = useCallback(
    (item: DormGridSelectorRecord) => {
      const isSelected = item.id !== undefined ? selectedRowKeys.includes(item.id) : false;
      const isReadonly = item._readonly === true;
      const occupied = Number(item.occupiedCount) || 0;
      const capacity = Number(item.capacity) || 0;
      const isFull = capacity > 0 && occupied >= capacity;
      const isEmpty = occupied === 0;
      const roomKey = normalizeRoomKey(item.id);
      let statusClass = '';

      if (isFull) {
        statusClass = 'status-full';
      } else if (isEmpty) {
        statusClass = 'status-empty';
      } else {
        statusClass = 'status-partial';
      }

      if (viewMode === 'mini') {
        if (disableFullRooms && isFull) {
          statusClass += ' disabled';
        }
        if (isReadonly) {
          statusClass += ' disabled';
        }
        if (bedDisplayMode === 'inline') {
          statusClass += ' inline-mode';
        }
      }

      const cardContent = (
        <div
          className={`dorm-grid-card glass-panel ${viewMode} ${isSelected ? 'selected' : ''} ${statusClass}`}
          onClick={onChange ? () => handleToggle(item.id) : undefined}
          style={{ width: '100%', cursor: !onChange && bedDisplayMode === 'inline' ? 'default' : undefined }}
        >
          {isSelected ? (
            <div className="selection-badge">
              <CheckCircleFilled />
            </div>
          ) : null}

          {viewMode === 'mini' ? (
            <>
              <div className="mini-content">
                <div className="mini-room">{item.roomNo}</div>
                <div className="mini-building">{item.building}</div>
                {isReadonly ? (
                  <div className="text-[10px] font-medium text-amber-600">
                    {item._readonlyReason || '当前不可操作'}
                  </div>
                ) : null}
                <div className="mini-occupancy">
                  {occupancyDots(occupied, capacity, true)}
                </div>
              </div>
              {bedDisplayMode === 'inline' ? renderInlineBeds(item.id) : null}
            </>
          ) : (
            <>
              <div className="card-header">
                <div className="dorm-info">
                  <div className="dorm-title">
                    {item.building} {item.roomNo}
                  </div>
                  <div className="dorm-sub">
                    {item.campus} {item.floor ? `${item.floor}层` : ''}
                  </div>
                  {isReadonly ? (
                    <div className="mt-1 text-xs font-medium text-amber-600">
                      {item._readonlyReason || '当前不可操作'}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="card-body">
                <div className="card-occupancy">
                  {occupancyDots(occupied, capacity)}
                </div>
                <div className="info-row">
                  <span className="label">寝室长</span>
                  <span className="value text-truncate">
                    {item.monitorName || <span className="muted">未设置</span>}
                  </span>
                </div>
                {item.grade ? (
                  <div className="info-row">
                    <span className="label">年级</span>
                    <span className="value">{item.grade}</span>
                  </div>
                ) : null}
              </div>

              {onCardAction ? (
                <div className="card-actions" onClick={(event) => event.stopPropagation()}>
                  <button className="action-btn" onClick={() => onCardAction('edit', item)}>
                    编辑
                  </button>
                </div>
              ) : null}
            </>
          )}
        </div>
      );

      if (viewMode === 'mini' && bedDisplayMode === 'popover' && !(disableFullRooms && isFull)) {
        return (
          <Popover
            key={roomKey || item.roomNo || 'room'}
            content={renderPopoverContent(item.id)}
            title={`${item.roomNo} 床位选择`}
            trigger="click"
            open={popoverOpen === roomKey}
            onOpenChange={(open) => {
              void handlePopoverOpenChange(item.id, open);
            }}
          >
            {cardContent}
          </Popover>
        );
      }

      return <div key={roomKey || item.roomNo || 'room'} style={{ height: '100%' }}>{cardContent}</div>;
    },
    [
      bedDisplayMode,
      disableFullRooms,
      handlePopoverOpenChange,
      handleToggle,
      onCardAction,
      onChange,
      occupancyDots,
      popoverOpen,
      renderInlineBeds,
      renderPopoverContent,
      selectedRowKeys,
      viewMode,
    ],
  );

  const renderedCards = useMemo(
    () => dataSource.map((item) => renderCardItem(item)),
    [dataSource, renderCardItem],
  );

  if (viewMode === 'mini') {
    return (
      <div className="dorm-grid-selector mini">
        <div className="dorm-mini-grid-container">{renderedCards}</div>
      </div>
    );
  }

  return (
    <div className={`dorm-grid-selector ${viewMode}`}>
      <Row gutter={[currentGrid.gutter, currentGrid.gutter]}>
        {dataSource.map((item) => {
          const roomKey = normalizeRoomKey(item.id);
          return (
            <Col
              key={roomKey || item.roomNo || 'room'}
              xs={getSpan(currentGrid.xs)}
              sm={getSpan(currentGrid.sm)}
              md={getSpan(currentGrid.md)}
              lg={getSpan(currentGrid.lg)}
              xl={getSpan(currentGrid.xl)}
              xxl={getSpan(currentGrid.xxl)}
            >
              {renderCardItem(item)}
            </Col>
          );
        })}
      </Row>
    </div>
  );
}
