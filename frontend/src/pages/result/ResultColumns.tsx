/**
 * 查寝结果表格列定义
 */

import type { ColumnsType } from 'antd/es/table';
import { Button, Image, Space, Tag, Tooltip } from "antd";
import {
  DeleteOutlined,
  EyeOutlined,
  MessageOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { resolvePhotoUrl } from "../../utils/url";
import { GRADE_COLORS } from "./resultSchema";

import type { EntityId } from '../../types/service';
import type {
  RatingForScore,
  ResultAppealRecord,
  ResultInspectionRecord,
} from './types';

interface CreateBaseColumnsOptions {
  resolveDormColleges: (record: ResultInspectionRecord) => string[];
  resolveDormGrades: (record: ResultInspectionRecord) => string[];
  ratingForScore: RatingForScore;
}

interface CreateActionColumnOptions {
  canAdjust: boolean;
  canViewAppeals?: boolean;
  activeRoleCode?: string;
  appealByInspectionId?: Map<string, ResultAppealRecord>;
  onOpenDetail: (inspection: ResultInspectionRecord) => Promise<void>;
  onDelete: (ids: EntityId[]) => Promise<void>;
  onOpenAppealCreate?: (inspection: ResultInspectionRecord) => void;
  onViewAppeal?: (appealId: EntityId) => void;
}

export function createBaseColumns({
  resolveDormColleges,
  resolveDormGrades,
  ratingForScore,
}: CreateBaseColumnsOptions): ColumnsType<ResultInspectionRecord> {
  return [
    {
      title: "检查任务",
      dataIndex: ["task", "title"],
      key: "taskTitle",
      render: (text: unknown) => (
        <span className="font-bold text-gray-800 dark:text-gray-100">
          {String(text || "无任务")}
        </span>
      ),
    },
    {
      title: "楼栋房号",
      key: "dorm",
      render: (_, record) => (
        <div className="flex flex-col">
          <span className="font-medium text-gray-700 dark:text-gray-200">
            {record.dorm?.building}-{record.dorm?.roomNo}
          </span>
          <span className="text-[11px] text-gray-400 font-normal">
            {record.dorm?.campus} · {record.dorm?.gender}
          </span>
        </div>
      ),
    },
    {
      title: "所属学院",
      key: "college",
      render: (_, record) => {
        const colleges = resolveDormColleges(record);
        if (colleges.length === 0) {
          return <span className="text-xs text-gray-400">-</span>;
        }
        return (
          <Space size={4} wrap>
            {colleges.slice(0, 2).map((college, index) => (
              <Tag key={`${record.id}-college-${index}`} className="ant-tag-blue !m-0">
                {college}
              </Tag>
            ))}
            {colleges.length > 2 && (
              <Tag className="apple-tag-gray !m-0">
                +{colleges.length - 2}
              </Tag>
            )}
          </Space>
        );
      },
    },
    {
      title: "年级",
      key: "gradeGroup",
      render: (_, record) => {
        const grades = resolveDormGrades(record);
        if (grades.length === 0) {
          return <span className="text-xs text-gray-400">-</span>;
        }
        return (
          <div className="flex flex-wrap gap-1">
            {grades.map((grade, index) => (
              <span
                key={`${record.id}-grade-${index}`}
                className="text-[13px] text-gray-600 dark:text-gray-400 font-medium"
              >
                {grade}
                {index < grades.length - 1 ? "," : ""}
              </span>
            ))}
          </div>
        );
      },
    },
    {
      title: "照片",
      key: "photos",
      align: "center",
      render: (_, record) => {
        const rawPhotos = Array.isArray(record.photoUrls)
          ? record.photoUrls
          : Array.isArray(record.photos)
            ? record.photos
            : [];
        const photos = rawPhotos.filter(Boolean);
        if (photos.length === 0) {
          return <span className="text-xs text-gray-400">-</span>;
        }
        const display = photos.slice(0, 2);
        const remaining = photos.length - display.length;
        return (
          <div className="flex items-center justify-center gap-2">
            {display.map((url, index) => (
              <Image
                key={`${record.id}-photo-${index}`}
                width={28}
                height={28}
                preview={false}
                src={resolvePhotoUrl(url)}
                className="rounded-md object-cover border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/5"
              />
            ))}
            {remaining > 0 && (
              <Tooltip title={`还有 ${remaining} 张`}>
                <span className="px-1.5 py-0.5 text-[11px] rounded-md border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-gray-500 dark:text-gray-400">
                  +{remaining}
                </span>
              </Tooltip>
            )}
          </div>
        );
      },
    },
    {
      title: "得分",
      dataIndex: "totalScore",
      key: "score",
      align: "center",
      render: (score: ResultInspectionRecord['totalScore']) => (
        <span className="text-lg font-bold text-blue-600">{score ?? "-"}</span>
      ),
    },
    {
      title: "等级",
      key: "grade",
      align: "center",
      render: (_, record) => {
        const label = ratingForScore(record.totalScore);
        return (
          <Tag
            color={GRADE_COLORS[label]}
            className="rounded-full px-3 border-none font-medium opacity-90"
          >
            {label}
          </Tag>
        );
      },
    },
    {
      title: "检查时间",
      dataIndex: "createdAt",
      key: "time",
      render: (value: ResultInspectionRecord['createdAt']) => (
        <span className="text-gray-500 font-mono text-xs">
          {value ? dayjs(value).format("YYYY-MM-DD HH:mm") : "-"}
        </span>
      ),
    },
    {
      title: "检查人",
      key: "reviewer",
      render: (_, record) => (
        <span className="font-medium">
          {record.reviewedBy?.fullName ||
            record.createdBy?.fullName ||
            record.recordedByName ||
            "-"}
        </span>
      ),
    },
  ];
}

export function createActionColumn({
  canAdjust,
  canViewAppeals,
  activeRoleCode,
  appealByInspectionId,
  onOpenDetail,
  onDelete,
  onOpenAppealCreate,
  onViewAppeal,
}: CreateActionColumnOptions): ColumnsType<ResultInspectionRecord>[number] {
  const isStudent = activeRoleCode === "STUDENT";
  const hasExtraAppealCol = isStudent || Boolean(canViewAppeals);
  const colWidth = canAdjust
    ? hasExtraAppealCol
      ? 112
      : 76
    : hasExtraAppealCol
      ? 80
      : 44;

  return {
    title: "操作",
    key: "actions",
    fixed: "right",
    width: colWidth,
    className: "table-action-column",
    render: (_, record) => {
      const matchedAppeal =
        record.id !== undefined && record.id !== null
          ? appealByInspectionId?.get(String(record.id))
          : undefined;
      const canSeeAppeal =
        matchedAppeal?.id !== undefined &&
        matchedAppeal?.id !== null &&
        (isStudent || Boolean(canViewAppeals));
      const canCreateAppeal =
        isStudent &&
        !canSeeAppeal &&
        record.totalScore !== null &&
        record.totalScore !== undefined;

      return (
        <Space size={8} className="table-action-buttons dorm-table-action-group">
          <Tooltip title="查看详情">
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => onOpenDetail(record)}
              className="dorm-table-action-btn is-view"
              aria-label="查看详情"
            />
          </Tooltip>
          {canSeeAppeal && matchedAppeal?.id !== undefined ? (
            <Tooltip
              title={
                matchedAppeal.status === "pending"
                  ? "查看待处理申诉"
                  : "查看申诉详情"
              }
            >
              <Button
                type="text"
                size="small"
                icon={<MessageOutlined />}
                onClick={() => onViewAppeal?.(matchedAppeal.id!)}
                className="dorm-table-action-btn is-edit"
                aria-label="查看申诉"
              />
            </Tooltip>
          ) : canCreateAppeal ? (
            <Tooltip title="提交申诉">
              <Button
                type="text"
                size="small"
                icon={<WarningOutlined />}
                onClick={() => onOpenAppealCreate?.(record)}
                className="dorm-table-action-btn is-edit"
                aria-label="提交申诉"
              />
            </Tooltip>
          ) : null}
          {canAdjust && (
            <Tooltip title="删除记录">
              <Button
                type="text"
                size="small"
                danger
                icon={<DeleteOutlined />}
                onClick={() => {
                  if (record.id !== undefined && record.id !== null) {
                    void onDelete([record.id]);
                  }
                }}
                className="dorm-table-action-btn is-danger"
                aria-label="删除记录"
              />
            </Tooltip>
          )}
        </Space>
      );
    },
  };
}
