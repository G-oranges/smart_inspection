import React from "react";
import { Modal, Descriptions, Tag, theme, Empty } from "antd";
import { MODAL_WIDTH } from "./common/modalSizes";

/**
 * Bed 数据结构参考：
 * {
 *   key: string;
 *   dormId: string;
 *   bedNo: string | number;
 *   status: "OCCUPIED" | "VACANT";
 *   studentId: string;
 *   studentName: string;
 *   studentNo: string;
 *   gender: string;
 * }
 */

interface RoomSummary {
  building?: string;
  roomNo?: string | number;
}

interface BedDetail {
  key?: string;
  dormId?: string;
  bedNo?: string | number;
  status?: 'OCCUPIED' | 'VACANT' | string;
  studentId?: string;
  studentName?: string;
  studentNo?: string;
  gender?: string;
}

interface BedDetailModalProps {
  open: boolean;
  onClose: () => void;
  room?: RoomSummary | null;
  bed?: BedDetail | null;
}

export default function BedDetailModal({
  open,
  onClose,
  room,
  bed,
}: BedDetailModalProps) {
  const { token } = theme.useToken();

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      title={`${bed?.bedNo ?? ""} 号床`}
      centered
      width={MODAL_WIDTH.sm}
      className="co-modal"
      destroyOnClose
    >
      {bed ? (
        <div className="py-2">
          <Descriptions 
            column={1} 
            bordered 
            size="small"
            labelStyle={{ width: '100px', fontWeight: 600, color: token.colorTextSecondary }}
          >
            <Descriptions.Item label="房号">
              {room?.building} {room?.roomNo}
            </Descriptions.Item>
            <Descriptions.Item label="床号">
              <Tag color="blue" className="rounded-full px-3">{bed.bedNo} 号床</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="当前状态">
              <Tag color={bed.status === "OCCUPIED" ? "orange" : "success"} className="rounded-full px-3">
                {bed.status === "OCCUPIED" ? "已占用" : "空闲"}
              </Tag>
            </Descriptions.Item>
            {bed.status === "OCCUPIED" && (
              <>
                <Descriptions.Item label="姓名">
                  <span className="font-bold text-gray-800 dark:text-gray-100">{bed.studentName || "未知"}</span>
                </Descriptions.Item>
                <Descriptions.Item label="学号">
                  <span className="tabular-nums">{bed.studentNo || "-"}</span>
                </Descriptions.Item>
                <Descriptions.Item label="性别">
                  {bed.gender || "-"}
                </Descriptions.Item>
              </>
            )}
          </Descriptions>
        </div>
      ) : (
        <Empty description="未选择床位" />
      )}
    </Modal>
  );
}
