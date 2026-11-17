import React from "react";
import { Button, Tooltip } from "antd";
import { CheckCircleFilled, DeleteOutlined, EditOutlined, EyeOutlined } from "@ant-design/icons";
import type { MouseEvent } from "react";
import DormGrid from "./DormGrid";

interface DormBedLike {
  key: string | number;
  bedNo?: string | number;
  status?: string;
  studentName?: string;
  [key: string]: unknown;
}

interface RoomLike {
  id?: string | number;
  building?: string;
  roomNo?: string | number;
  campus?: string;
  floor?: string | number | null;
  capacity?: number | null;
  occupiedCount?: number | null;
  monitorName?: string | null;
  gender?: string | null;
  grade?: string | number | null;
  [key: string]: unknown;
}

interface RoomOccupancyCardProps {
  room: RoomLike;
  beds?: DormBedLike[];
  onBedClick?: (bed: DormBedLike, room: RoomLike) => void;
  selected?: boolean;
  onSelect?: (roomId: RoomLike["id"], selected: boolean) => void;
  canEdit?: boolean;
  onView?: (room: RoomLike) => void;
  onEdit?: (room: RoomLike) => void;
  onDelete?: (roomId: RoomLike["id"]) => void;
}

/**
 * RoomOccupancyCard - 宿舍管理卡片视图中的单个宿舍卡片
 * 
 * Props:
 *   room: 宿舍对象 { id, building, roomNo, campus, floor, capacity, occupiedCount, monitorName, gender, grade }
 *   beds: 映射后的床位数组 (用于 DormGrid)
 *   onBedClick: (bed, room) => void;
 *   selected: boolean;
 *   onSelect: (roomId, selected) => void;
 */
export default function RoomOccupancyCard({ 
  room, 
  beds = [], 
  onBedClick,
  selected = false,
  onSelect,
  canEdit = false,
  onView,
  onEdit,
  onDelete,
}: RoomOccupancyCardProps) {
  const occupied = room.occupiedCount || 0;
  const capacity = room.capacity || 0;
  const isFull = capacity > 0 && occupied >= capacity;
  const isEmpty = occupied === 0;

  let statusClass = "";
  if (isFull) statusClass = "status-full";
  else if (isEmpty) statusClass = "status-empty";
  else statusClass = "status-partial";
  const normalizedBeds = beds.filter(
    (bed): bed is DormBedLike => bed.key !== undefined && bed.key !== null,
  );
  const occupancyDots = capacity > 0 ? (
    <div
      className="dorm-occupancy-dots dorm-occupancy-dots-card"
      aria-label={`已入住 ${occupied} / ${capacity}`}
      title={`已入住 ${occupied} / ${capacity}`}
    >
      {Array.from({ length: capacity }, (_, index) => {
        const dotOccupied = index < occupied;
        return (
          <span
            key={`${room.id ?? room.roomNo ?? "room"}-${index}`}
            className={`dorm-occupancy-dot ${dotOccupied ? "is-occupied" : "is-empty"}`}
          />
        );
      })}
    </div>
  ) : (
    <span className="value-muted">-</span>
  );

  const handleCardClick = (e: MouseEvent<HTMLDivElement>) => {
    // 如果点击的是床位按钮（button 元素），则不触发布局选择
    const target = e.target as HTMLElement;
    if (target.closest('button')) return;
    
    if (onSelect) {
      onSelect(room.id, !selected);
    }
  };

  return (
    <div
      className={`dorm-grid-card glass-panel card ${selected ? "selected" : ""} ${statusClass} cursor-pointer`}
      onClick={handleCardClick}
    >
      {/* 选中标识 */}
      {selected && (
        <div className="selection-badge">
          <CheckCircleFilled />
        </div>
      )}

      {/* Header: 楼栋 房间号 */}
      <div className="card-header">
        <div className="card-header-main">
          <div className="dorm-title">
            {room.building} {room.roomNo}
          </div>
          <div className="card-occupancy">
            {occupancyDots}
          </div>
        </div>
        <div className="card-header-extra">
          {room.gender ? (
            <span className={`room-meta-chip ${room.gender === "男" ? "is-male" : room.gender === "女" ? "is-female" : "is-neutral"}`}>
              {room.gender}
            </span>
          ) : null}
        </div>
      </div>

      {/* Footer: 床位网格 */}
      <div className="card-body">
        <DormGrid<DormBedLike>
          beds={normalizedBeds}
          columns={2}
          onBedClick={(bed: DormBedLike) => onBedClick && onBedClick(bed, room)}
        />
      </div>

      <div className="card-actions card-actions-split" onClick={(e) => e.stopPropagation()}>
        <Tooltip title="查看详情">
          <Button
            type="text"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => onView?.(room)}
            className="dorm-table-action-btn is-view"
            aria-label="查看详情"
          />
        </Tooltip>
        <Tooltip title="编辑宿舍">
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            disabled={!canEdit}
            onClick={() => onEdit?.(room)}
            className="dorm-table-action-btn is-edit"
            aria-label="编辑宿舍"
          />
        </Tooltip>
        <Tooltip title="删除宿舍">
          <Button
            type="text"
            size="small"
            danger
            icon={<DeleteOutlined />}
            disabled={!canEdit}
            onClick={() => onDelete?.(room.id)}
            className="dorm-table-action-btn is-danger"
            aria-label="删除宿舍"
          />
        </Tooltip>
      </div>
    </div>
  );
}
