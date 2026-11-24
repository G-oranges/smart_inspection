/**
 * 查寝结果移动端卡片
 */

import { Tag } from "antd";
import dayjs from "dayjs";
import { GRADE_COLORS } from "./resultSchema";

import type { RatingForScore, ResultInspectionRecord } from './types';

interface ResultMobileCardProps {
  record: ResultInspectionRecord;
  selected?: boolean;
  onSelect?: (selected: boolean) => void;
  ratingForScore: RatingForScore;
}

export default function ResultMobileCard({
  record,
  selected = false,
  onSelect,
  ratingForScore,
}: ResultMobileCardProps) {
  const label = ratingForScore(record.totalScore);

  return (
    <div
      className={`ios-inset-grouped p-4 mb-3 active:scale-[0.98] transition-all bg-white dark:bg-zinc-900 border border-black/5 shadow-sm rounded-2xl ${
        selected ? "ring-2 ring-ios-blue ring-offset-2" : "hover:shadow-md"
      }`}
      onClick={() => onSelect && onSelect(!selected)}
    >
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1 min-w-0">
          <div className="font-bold text-base truncate">
            {record.task?.title || "未命名任务"}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">
            {record.dorm?.building}-{record.dorm?.roomNo} · {record.dorm?.campus}
          </div>
        </div>
        <Tag
          color={GRADE_COLORS[label]}
          className="rounded-full px-3 border-none m-0 font-medium"
        >
          {label}
        </Tag>
      </div>
      <div className="grid grid-cols-2 gap-y-2 text-sm border-t border-black/5 pt-3 mt-1">
        <div className="text-gray-400">得分</div>
        <div className="text-right font-bold text-blue-600">
          {record.totalScore ?? "-"} 分
        </div>
        <div className="text-gray-400">检查人</div>
        <div className="text-right truncate font-medium text-gray-700">
          {record.reviewedBy?.fullName ||
            record.createdBy?.fullName ||
            record.recordedByName ||
            "-"}
        </div>
        <div className="text-gray-400">检查时间</div>
        <div className="text-right text-xs opacity-60">
          {record.createdAt ? dayjs(record.createdAt).format("MM-DD HH:mm") : "-"}
        </div>
      </div>
    </div>
  );
}
