import { Button, Descriptions, Image, Modal, Table } from "antd";
import type { ColumnsType } from 'antd/es/table';

import { resolvePhotoUrl } from "../../../utils/url";

import type { AppSettings } from '../../../types/app';
import type { ServiceRecord } from '../../../types/service';
import type {
  RatingForScore,
  ResultDetailState,
  ResultInspectionDetailRecord,
  ResultInspectionRecord,
} from '../types';
import { MODAL_WIDTH } from "../../../components/common/modalSizes";

interface ResultDetailModalProps {
  detail: ResultDetailState;
  canAdjust: boolean;
  isMobile: boolean;
  settings: AppSettings | null;
  ratingForScore: RatingForScore;
  onClose: () => void;
  onModify: (inspection: ResultInspectionRecord) => void;
}

export default function ResultDetailModal({
  detail,
  canAdjust,
  isMobile,
  settings,
  ratingForScore,
  onClose,
  onModify,
}: ResultDetailModalProps) {
  const inspection = detail.inspection;
  const photoUrls = Array.isArray(inspection?.photoUrls) ? inspection.photoUrls : [];
  const detailColumns: ColumnsType<ResultInspectionDetailRecord> = [
    {
      title: "违规代码/名称",
      dataIndex: "code",
      render: (code: ResultInspectionDetailRecord['code']) => {
        const item = (settings?.deductionItems || []).find(
          (deduction) => deduction.code === code
        );
        return item?.name || code || "-";
      },
    },
    {
      title: "次数",
      dataIndex: "count",
      width: isMobile ? undefined : 80,
      align: "center",
      render: (value: ResultInspectionDetailRecord['count']) => value || 1,
    },
    {
      title: "点位",
      dataIndex: "locations",
      render: (locations: ResultInspectionDetailRecord['locations']) =>
        Array.isArray(locations) && locations.length > 0 ? locations.join("、") : "-",
    },
    {
      title: "单项扣分数",
      width: isMobile ? undefined : 120,
      align: "center",
      render: (_, record) => {
        const item = (settings?.deductionItems || []).find(
          (deduction) => deduction.code === record.code
        );
        const points = item?.points || 0;
        const count = record.count || 1;
        return `-${points * count}`;
      },
    },
  ];

  const memberColumns: ColumnsType<ServiceRecord> = [
    { title: "姓名", dataIndex: "fullName" },
    { title: "学号", dataIndex: "studentNo" },
    {
      title: "学院",
      render: (_, record) =>
        (record.college as string | undefined) ||
        ((record.student as { college?: string } | undefined)?.college) ||
        "-",
    },
    {
      title: "床位编号",
      dataIndex: "bedNo",
      align: "center",
      render: (value: unknown) => value || "-",
    },
  ];
  return (
    <Modal
      open={detail.open}
      title="查寝结果详情"
      onCancel={onClose}
      footer={
        canAdjust && detail.inspection ? (
          <Button
            key="modify"
            type="primary"
            className={`apple-btn-primary px-8 ${
              isMobile ? "w-full" : ""
            }`}
            onClick={() => {
              onClose();
              if (detail.inspection) {
                onModify(detail.inspection);
              }
            }}
          >
            编辑修改
          </Button>
        ) : null
      }
      width={isMobile ? "100%" : MODAL_WIDTH.md}
      centered
      className={`result-detail-modal management-theme-page${isMobile ? "" : " co-modal"}`}
      style={isMobile ? { top: 0, paddingBottom: 0 } : undefined}
    >
      {detail.loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" />
          <span className="text-gray-400">正在调取云端数据...</span>
        </div>
      ) : (
        <div className="space-y-4">
          {isMobile ? (
            <div className="grid grid-cols-2 gap-3">
              {[
                {
                  label: "任务",
                  value: detail.inspection?.task?.title || "-",
                },
                {
                  label: "宿舍",
                  value: detail.inspection?.dorm
                    ? `${detail.inspection.dorm.building}-${detail.inspection.dorm.roomNo}`
                    : "-",
                },
                {
                  label: "得分",
                  value: detail.inspection?.totalScore ?? "-",
                },
                {
                  label: "等级",
                  value: ratingForScore(detail.inspection?.totalScore) || "-",
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 p-3"
                >
                  <div className="text-xs text-gray-400 dark:text-gray-500">
                    {item.label}
                  </div>
                  <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 mt-1">
                    {item.value}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Descriptions
              bordered
              size="small"
              column={2}
              className="result-detail-descriptions"
            >
              <Descriptions.Item label="任务">
                {detail.inspection?.task?.title || "-"}
              </Descriptions.Item>
              <Descriptions.Item label="宿舍">
                {detail.inspection?.dorm
                  ? `${detail.inspection.dorm.building}-${detail.inspection.dorm.roomNo}`
                  : "-"}
              </Descriptions.Item>
              <Descriptions.Item label="得分">
                {detail.inspection?.totalScore ?? "-"}
              </Descriptions.Item>
              <Descriptions.Item label="等级">
                {ratingForScore(detail.inspection?.totalScore) || "-"}
              </Descriptions.Item>
            </Descriptions>
          )}

          {Array.isArray(detail.inspection?.detail) &&
            detail.inspection.detail.length > 0 && (
              <div>
                <div className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">
                  扣分项
                </div>
                <Table
                  size="small"
                  bordered
                  dataSource={detail.inspection.detail}
                  rowKey="id"
                  pagination={false}
                  className="dorm-table"
                  scroll={isMobile ? { x: "max-content" } : undefined}
                  tableLayout={isMobile ? "auto" : undefined}
                  columns={detailColumns}
                />
              </div>
            )}

          {detail.members.length > 0 && (
            <div>
              <div className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">
                宿舍成员
              </div>
              <Table
                size="small"
                bordered
                dataSource={detail.members}
                rowKey="id"
                pagination={false}
                className="dorm-table"
                scroll={isMobile ? { x: "max-content" } : undefined}
                tableLayout={isMobile ? "auto" : undefined}
                columns={memberColumns}
              />
            </div>
          )}

          <div>
            <div className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">
              图片与备注
            </div>
            {photoUrls.length > 0 && (
              <Image.PreviewGroup>
                <div
                  className={
                    isMobile
                      ? "grid grid-cols-2 gap-3"
                      : "grid grid-cols-2 md:grid-cols-4 gap-3"
                  }
                >
                  {photoUrls.map((url, idx) => (
                    <Image
                      key={idx}
                      width={isMobile ? 140 : 120}
                      height={isMobile ? 140 : 120}
                      src={resolvePhotoUrl(url)}
                      className="rounded-lg object-cover border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/5"
                    />
                  ))}
                </div>
              </Image.PreviewGroup>
            )}
            <div className="mt-3 border border-gray-200 dark:border-white/10 rounded-lg p-3 text-sm text-gray-600 dark:text-gray-300 bg-white dark:bg-white/5">
              <div className="text-xs text-gray-400 dark:text-gray-500 mb-1">
                备注
              </div>
              <div>{detail.inspection?.comments || "-"}</div>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
