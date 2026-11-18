/**
 * 账号与权限管理模块 - 寝室长批量设置区块
 * @module pages/account-permission/MonitorSetupSection
 */

import type { Dispatch, SetStateAction } from 'react';
import { Button, Card, Input, Modal, Popconfirm, Space, Tag, Typography } from 'antd';
import type { TableColumnsType } from 'antd';
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons';

import FilterDropdownPanel from '../../components/common/FilterDropdownPanel';
import { useScopeOptions } from './useScopeOptions';
import GlassTable from '../../components/GlassTable';
import { useMobile } from '../../hooks/useMobile';
import type { EntityId, ServiceRecord } from '../../types/service';
import type {
  AccountUser,
  MonitorConflictModalState,
  MonitorFilters,
  TableListState,
} from './types';
import { MODAL_WIDTH } from "../../components/common/modalSizes";

const { Text } = Typography;

interface DormRecord extends ServiceRecord {
  building?: string;
}

interface MonitorSetupSectionProps {
  dormsData?: DormRecord[];
  studentsData?: AccountUser[];
  searchTerm: string;
  setSearchTerm: Dispatch<SetStateAction<string>>;
  monitorFilters: MonitorFilters;
  setMonitorFilters: Dispatch<SetStateAction<MonitorFilters>>;
  studentPage: number;
  setStudentPage: Dispatch<SetStateAction<number>>;
  studentData: TableListState<AccountUser>;
  studentLoading: boolean;
  selectedStudentIds: EntityId[];
  setSelectedStudentIds: Dispatch<SetStateAction<EntityId[]>>;
  onRefresh: () => void;
  onBatchSetMonitorCheck: () => void | Promise<void>;
  conflictModal: MonitorConflictModalState;
  setConflictModal: Dispatch<SetStateAction<MonitorConflictModalState>>;
  onContinueNonConflicts: () => void | Promise<void>;
  onBatchSetMonitorExecute: (replaceExisting: boolean) => void | Promise<void>;
}

function uniqueStringOptions(values: Array<string | undefined>): Array<{ label: string; value: string }> {
  return [...new Set(values.filter((value): value is string => Boolean(value)))]
    .sort()
    .map((value) => ({ label: value, value }));
}

const STUDENT_TABLE_COLUMNS: TableColumnsType<AccountUser> = [
  { title: '姓名', dataIndex: 'fullName', key: 'fullName', width: 120 },
  {
    title: '楼栋',
    dataIndex: 'building',
    key: 'building',
    width: 120,
    render: (value: AccountUser['building']) => value || '-',
  },
  {
    title: '宿舍',
    dataIndex: 'roomNo',
    key: 'roomNo',
    width: 120,
    render: (value: AccountUser['roomNo']) => value || '-',
  },
  {
    title: '专业',
    dataIndex: 'major',
    key: 'major',
    width: 180,
    render: (value: AccountUser['major']) => value || '-',
  },
  {
    title: '班级',
    dataIndex: 'className',
    key: 'className',
    width: 160,
    render: (value: AccountUser['className']) => value || '-',
  },
  {
    title: '寝室长',
    dataIndex: 'isMonitor',
    key: 'isMonitor',
    width: 100,
    render: (value: AccountUser['isMonitor']) => (value ? <Tag color="green">是</Tag> : <Tag>否</Tag>),
  },
];

/**
 * 寝室长批量设置区块组件
 */
export default function MonitorSetupSection({
  dormsData,
  studentsData,
  searchTerm,
  setSearchTerm,
  monitorFilters,
  setMonitorFilters,
  studentPage,
  setStudentPage,
  studentData,
  studentLoading,
  selectedStudentIds,
  setSelectedStudentIds,
  onRefresh,
  onBatchSetMonitorCheck,
  conflictModal,
  setConflictModal,
  onContinueNonConflicts,
  onBatchSetMonitorExecute,
}: MonitorSetupSectionProps) {
  const isMobile = useMobile();
  // 专业/班级选项取全量学籍数据，不依赖当前页学生
  const { options: scopeOptions } = useScopeOptions();
  const academicOptions = scopeOptions?.academic || [];
  const handleReset = () => {
    setSearchTerm('');
    setMonitorFilters({
      building: [],
      floor: [],
      major: [],
      className: [],
    });
    setStudentPage(1);
  };

  const studentTable = (
    <>
      <div className="flex flex-col gap-3 mb-4">
      <div className="dorm-toolbar-shell">
        <div className="dorm-toolbar-row dorm-toolbar-row-main">
          <Input
            placeholder="搜索学生姓名"
            prefix={<SearchOutlined className="text-gray-400" />}
            className="apple-search-input dorm-toolbar-search !bg-gray-100/50 dark:!bg-white/5 border-none flex-1 min-w-[220px]"
            value={searchTerm}
            onChange={(event) => {
              setSearchTerm(event.target.value);
              setStudentPage(1);
            }}
            onPressEnter={() => {
              void onRefresh();
            }}
            allowClear
          />
          <Button
            type="primary"
            icon={<SearchOutlined />}
            onClick={() => {
              void onRefresh();
            }}
            className="apple-btn-primary dorm-toolbar-button dorm-toolbar-button-primary active:scale-95 transition-all border-none"
          >
            搜索
          </Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={handleReset}
            className="dorm-toolbar-button dorm-toolbar-button-subtle active:scale-95 transition-all"
          >
            重置
          </Button>
        </div>
        <div className="dorm-toolbar-row dorm-toolbar-row-actions">
          <Button
            icon={<ReloadOutlined />}
            onClick={onRefresh}
            className="dorm-toolbar-button dorm-toolbar-button-subtle active:scale-95 transition-all"
          >
            刷新
          </Button>
          <Button
            type="primary"
            disabled={selectedStudentIds.length === 0}
            onClick={onBatchSetMonitorCheck}
            className="apple-btn-primary dorm-toolbar-button dorm-toolbar-button-primary active:scale-95 transition-all"
          >
            批量设为寝室长 ({selectedStudentIds.length})
          </Button>
        </div>
      </div>
        <div className="dorm-toolbar-row dorm-toolbar-row-filters">
          <div className="flex-1">
          <FilterDropdownPanel
            onReset={handleReset}
            filters={[
              {
                key: 'building',
                label: '楼栋',
                options: uniqueStringOptions((dormsData || []).map((dorm) => dorm.building)),
                value: monitorFilters.building || [],
                onChange: (value: string[]) => {
                  setMonitorFilters((prev) => ({
                    ...prev,
                    building: value || [],
                    floor: [],
                  }));
                  setStudentPage(1);
                },
                multiple: true,
                searchable: true,
              },
              {
                key: 'major',
                label: '专业',
                options: uniqueStringOptions(academicOptions.map((item) => item.major)),
                value: monitorFilters.major || [],
                onChange: (value: string[]) => {
                  setMonitorFilters((prev) => ({
                    ...prev,
                    major: value || [],
                    className: [],
                  }));
                  setStudentPage(1);
                },
                multiple: true,
                searchable: true,
              },
              {
                key: 'className',
                label: '班级',
                options: uniqueStringOptions(
                  academicOptions
                    .filter((item) => !monitorFilters.major?.length || monitorFilters.major.includes(item.major))
                    .map((item) => item.className),
                ),
                value: monitorFilters.className || [],
                onChange: (value: string[]) => {
                  setMonitorFilters((prev) => ({ ...prev, className: value || [] }));
                  setStudentPage(1);
                },
                multiple: true,
                searchable: true,
              },
            ]}
          />
          </div>
        </div>
      </div>

      <div className="table-wrapper dorm-table-wrapper">
        <GlassTable
          className="dorm-table"
          dataSource={studentData.items}
          loading={studentLoading}
          rowKey="id"
          size="middle"
          rowSelection={{
            selectedRowKeys: selectedStudentIds,
            onChange: (keys) => setSelectedStudentIds(keys as EntityId[]),
          }}
          columns={STUDENT_TABLE_COLUMNS}
          pagination={{
            current: studentPage,
            pageSize: 10,
            total: studentData.total,
            onChange: (nextPage) => setStudentPage(nextPage),
            showSizeChanger: false,
          }}
          scroll={{ x: 920 }}
          useSkeleton={false}
        />
      </div>
    </>
  );

  if (!isMobile) {
    return (
      <>
        <div className="mb-6">
          <div className="table-head dorm-table-head mb-4">
            <div className="flex items-center gap-2">
              <div className="dorm-table-head-accent" />
              <h3 className="dorm-table-head-title">学生列表</h3>
            </div>
          </div>
          {studentTable}
        </div>
      </>
    );
  }

  return (
    <Card className="table-card glass-card" variant="borderless">
      <div className="table-head">
        <div>
          <h3 className="section-title">寝室长批量设置</h3>
        </div>
      </div>
      {studentTable}
      <Modal
        open={conflictModal.visible}
        title="寝室长冲突确认"
        onCancel={() =>
          setConflictModal({
            visible: false,
            conflicts: [],
            nonConflicts: [],
          })
        }
        footer={
          <Space>
            <Popconfirm
              title="继续设置无冲突的宿舍？"
              description={`以下 ${conflictModal.nonConflicts.length} 名学生的宿舍暂无寝室长，是否继续设置？`}
              onConfirm={onContinueNonConflicts}
              onCancel={() =>
                setConflictModal({
                  visible: false,
                  conflicts: [],
                  nonConflicts: [],
                })
              }
              okText="继续设置"
              cancelText="取消全部"
            >
              <Button>取消</Button>
            </Popconfirm>
            <Button type="primary" onClick={() => onBatchSetMonitorExecute(true)}>
              确认更换
            </Button>
          </Space>
        }
        centered
        width={MODAL_WIDTH.md}
        className="co-modal"
      >
        <p style={{ marginBottom: 16 }}>以下宿舍已有寝室长，是否撤销并更换？</p>
        <div style={{ maxHeight: 300, overflow: 'auto' }}>
          {conflictModal.conflicts.map((conflict, index) => (
            <div
              key={index}
              style={{
                padding: '8px 12px',
                background: 'rgba(255, 193, 7, 0.1)',
                borderRadius: 6,
                marginBottom: 8,
                border: '1px solid rgba(255, 193, 7, 0.3)',
              }}
            >
              <Text>
                宿舍 <Text strong>{conflict.dormName}</Text>：撤销{' '}
                <Text type="danger">{conflict.existingMonitorName}</Text> 的寝室长，设置{' '}
                <Text type="success">{conflict.studentName}</Text> 为寝室长
              </Text>
            </div>
          ))}
        </div>
        {conflictModal.nonConflicts.length > 0 ? (
          <div
            style={{
              marginTop: 16,
              padding: '8px 12px',
              background: 'rgba(82, 196, 26, 0.1)',
              borderRadius: 6,
            }}
          >
            <Text type="secondary">另有 {conflictModal.nonConflicts.length} 名学生的宿舍无冲突，将一并设置</Text>
          </div>
        ) : null}
      </Modal>
    </Card>
  );
}
