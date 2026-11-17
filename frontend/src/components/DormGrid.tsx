// src/components/DormGrid.jsx
// 纯 UI 床位网格组件 - 无数据获取，仅负责渲染
import React from "react";
import { theme } from "antd";
import type { CSSProperties, ReactNode } from "react";

export interface DormGridBedRecord {
  key: string | number;
  dormId?: string | number;
  bedNo?: number | string;
  status?: "VACANT" | "OCCUPIED" | "LOCKED" | "ERROR" | string;
  studentId?: string | number;
  studentName?: string;
  gender?: string;
  [key: string]: unknown;
}

interface DormGridProps<TBed extends DormGridBedRecord = DormGridBedRecord> {
  beds?: TBed[];
  columns?: number;
  activeBedKey?: string | number | null;
  selectedBedKeys?: Array<string | number>;
  onBedClick?: (bed: TBed) => void;
  renderCell?: (bed: TBed) => ReactNode;
}

/**
 * Bed 数据结构：
 * {
 *   key: string;          // e.g. `${roomId}-${bedNo}`
 *   dormId?: string;
 *   bedNo: number|string;
 *   status: "VACANT" | "OCCUPIED" | "LOCKED" | "ERROR";
 *   studentId?: string;
 *   studentName?: string;
 *   gender?: string;
 * }
 *
 * Props:
 *   beds: Bed[];
 *   columns?: number;              // 默认 2 (2x2 布局)
 *   activeBedKey?: string | null;  // 当前激活的床位 key
 *   selectedBedKeys?: string[];    // 多选时选中的床位 keys
 *   onBedClick?: (bed) => void;
 *   renderCell?: (bed) => React.ReactNode; // 自定义渲染
 */
export default function DormGrid<TBed extends DormGridBedRecord = DormGridBedRecord>({
  beds = [],
  columns = 2,
  activeBedKey = null,
  selectedBedKeys = [],
  onBedClick,
  renderCell,
}: DormGridProps<TBed>) {
  const { token } = theme.useToken();

  // 根据列数生成 Tailwind grid class
  const gridColsClass = {
    1: "grid-cols-1",
    2: "grid-cols-2",
    3: "grid-cols-3",
    4: "grid-cols-4",
  }[columns] || "grid-cols-2";

  const isSelected = (bed: TBed) => selectedBedKeys?.includes?.(bed.key);
  const isActive = (bed: TBed) => activeBedKey && bed.key === activeBedKey;

  // 根据床位状态获取样式
  const getStyle = (bed: TBed): CSSProperties => {
    const selectedRing = isSelected(bed) || isActive(bed);

    if (bed.status === "OCCUPIED") {
      return {
        background: token.colorFillSecondary,
        border: `1px solid ${token.colorBorderSecondary}`,
        boxShadow: selectedRing ? `0 0 0 2px ${token.colorPrimary}` : "none",
        color: token.colorText,
      };
    }

    if (bed.status === "LOCKED" || bed.status === "ERROR") {
      return {
        background: token.colorBgContainer,
        border: `1px dashed ${token.colorWarningBorder || token.colorBorderSecondary}`,
        boxShadow: selectedRing ? `0 0 0 2px ${token.colorPrimary}` : "none",
        color: token.colorTextSecondary,
      };
    }

    // VACANT - 空床
    return {
      background: token.colorBgContainer,
      border: `1px solid ${token.colorSuccessBorder || token.colorBorderSecondary}`,
      boxShadow: selectedRing ? `0 0 0 2px ${token.colorPrimary}` : "none",
      color: token.colorSuccessText || token.colorText,
    };
  };

  // 默认床位单元格渲染
  const defaultRenderCell = (bed: TBed) => {
    const bedNo = String(bed.bedNo ?? "");
    if (bed.status === "OCCUPIED") {
      return (
        <div className="w-full flex items-center justify-center gap-2 truncate">
          <span className="font-semibold tabular-nums">{bedNo}</span>
          <span className="opacity-90 truncate text-sm">{bed.studentName || "未知"}</span>
        </div>
      );
    }
    return <div className="w-full text-center font-semibold tabular-nums">{bedNo}</div>;
  };

  if (!beds || beds.length === 0) {
    return (
      <div 
        className="text-center py-4 text-sm"
        style={{ color: token.colorTextSecondary }}
      >
        暂无床位信息
      </div>
    );
  }

  return (
    <div className={`grid ${gridColsClass} gap-2`}>
      {beds.map((bed) => {
        const clickable = typeof onBedClick === "function";
        return (
          <button
            key={bed.key}
            type="button"
            className={[
              "h-11 rounded-lg px-3",
              "flex items-center justify-center",
              "transition-all duration-200 select-none",
              clickable ? "cursor-pointer active:scale-95" : "cursor-default",
            ].join(" ")}
            style={getStyle(bed)}
            onClick={() => clickable && onBedClick(bed)}
            title={
              bed.status === "OCCUPIED"
                ? `${bed.bedNo}号床: ${bed.studentName || "未知"}`
                : `${bed.bedNo}号床 (空)`
            }
          >
            {renderCell ? renderCell(bed) : defaultRenderCell(bed)}
          </button>
        );
      })}
    </div>
  );
}
