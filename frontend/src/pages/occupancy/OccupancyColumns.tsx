/**
 * 入住管理表格列定义
 * OccupancyManagementPage 模块化
 */

import { Space, Tag, Button, Tooltip } from "antd";
import {
  BankOutlined,
  UserAddOutlined,
  ArrowsAltOutlined,
  LogoutOutlined,
} from "@ant-design/icons";

import type { EntityId } from "../../types/service";
import type { OccupancyColumn, OccupancyStudentRecord } from "./types";

/**
 * 创建基础列定义
 */
export function createBaseColumns(): OccupancyColumn[] {
  return [
    {
      title: '学生信息',
      key: 'student',
      width: 200,
      render: (_value, record: OccupancyStudentRecord) => (
        <Space direction="vertical" size={0}>
          <div style={{ fontWeight: 600 }}>{record.fullName}</div>
          <div style={{ fontSize: '12px', color: 'var(--co-text-muted)' }}>{record.studentNo}</div>
          <Tag className={`rounded-full border-none px-2 text-[11px] leading-4 h-4 m-0 ${record.gender === '男' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-pink-50 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400'}`}>
            {record.gender}
          </Tag>
        </Space>
      )
    },
    {
      title: '学院班级',
      key: 'class',
      width: 200,
      render: (_value, record: OccupancyStudentRecord) => (
        <div style={{ fontSize: '13px' }}>
          <div>{record.college || '-'}</div>
          <div style={{ color: 'var(--co-text-muted)' }}>{record.className || '-'}</div>
        </div>
      )
    },
    {
      title: '当前住宿状态',
      key: 'status',
      width: 150,
      render: (_value, record: OccupancyStudentRecord) => (
        record.dormId ? (
          <Tag className="rounded-full border-none px-3 bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400">已入住</Tag>
        ) : (
          <Tag className="rounded-full border-none px-3 bg-gray-50 text-gray-600 dark:bg-gray-800 dark:text-gray-400">未入住</Tag>
        )
      )
    },
    {
      title: '住宿位置',
      key: 'location',
      width: 250,
      render: (_value, record: OccupancyStudentRecord) => (
        record.dormId ? (
          <Space>
            <BankOutlined />
            <span>{record.building} - {record.roomNo} <Tag color="blue">{record.bedNo}号床</Tag></span>
          </Space>
        ) : (
          <span style={{ color: 'var(--co-text-muted)' }}>无</span>
        )
      )
    }
  ];
}

export function createActionColumn({
  canEdit,
  openAdjustModal,
  handleCheckout,
}: {
  canEdit: boolean;
  openAdjustModal: (
    student: OccupancyStudentRecord,
    mode?: 'assign' | 'move' | 'swap',
  ) => void;
  handleCheckout: (studentId: EntityId) => Promise<void>;
}): OccupancyColumn {
  return {
    title: '操作',
    key: 'action',
    width: 76,
    fixed: 'right',
    className: 'table-action-column',
    render: (_value, record: OccupancyStudentRecord) => (
      <Space size={8} className="table-action-buttons dorm-table-action-group">
        {!record.dormId ? (
          <Tooltip title="办理入住">
            <Button 
              type="text" 
              size="small" 
              icon={<UserAddOutlined />} 
              onClick={() => openAdjustModal(record, "assign")}
              disabled={!canEdit}
              className="dorm-table-action-btn is-assign"
              aria-label="办理入住"
            />
          </Tooltip>
        ) : (
          <>
            <Tooltip title="调宿">
              <Button 
                type="text" 
                size="small" 
                icon={<ArrowsAltOutlined />} 
                onClick={() => openAdjustModal(record, "move")}
                disabled={!canEdit}
                className="dorm-table-action-btn is-move"
                aria-label="调宿"
              />
            </Tooltip>
            <Tooltip title="退宿">
              <Button
                type="text"
                size="small"
                danger
                icon={<LogoutOutlined />}
                disabled={!canEdit || record.id === undefined || record.id === null}
                className="dorm-table-action-btn is-danger"
                aria-label="退宿"
                onClick={() => {
                  if (record.id !== undefined && record.id !== null) {
                    void handleCheckout(record.id);
                  }
                }}
              />
            </Tooltip>
          </>
        )}
      </Space>
    )
  };
}
