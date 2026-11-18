import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Col,
  Form,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Typography,
  message,
} from 'antd';
import PanelSelect from './common/PanelSelect';
import {
  CheckCircleFilled,
  CompassOutlined,
  EnvironmentOutlined,
  SwapOutlined,
  UserOutlined,
} from '@ant-design/icons';

import { useAppContext } from '../context/AppContext';
import DormGridSelector from './DormGridSelector';

import type { AppActions } from '../types/app';
import type { EntityId, ServiceRecord } from '../types/service';

const { Text } = Typography;

type ResidencyAdjustMode = 'assign' | 'move' | 'swap';

interface BuildingRecord extends ServiceRecord {
  building?: string;
}

interface RoomRecord extends ServiceRecord {
  id?: EntityId;
  roomNo?: string;
  building?: string;
  campus?: string;
  floor?: string | number;
}

interface BedRecord extends ServiceRecord {
  dormId?: EntityId;
  bedNo?: string | number;
  studentId?: EntityId;
  studentName?: string | null;
  gender?: string;
  student?: {
    id?: EntityId;
    fullName?: string;
    name?: string;
    gender?: string;
  };
}

interface SelectedBedRecord {
  dormId?: EntityId;
  bedNo?: string | number;
  studentId?: EntityId;
  studentName?: string | null;
}

interface StudentRecord extends ServiceRecord {
  id?: EntityId;
  fullName?: string;
  studentNo?: string;
  dormId?: EntityId;
  building?: string;
  roomNo?: string | number;
  bedNo?: string | number;
}

interface ResidencyAdjustFormValues {
  building: string | null;
  floor: string | number | null;
  room: EntityId | null;
  bed: string | number | null;
}

interface ResidencyAdjustActions {
  getBuildings: (
    params?: Record<string, unknown>,
  ) => Promise<{ buildings?: BuildingRecord[]; items?: BuildingRecord[] }>;
  getFloors: (params?: Record<string, unknown>) => Promise<{ floors?: Array<string | number> }>;
  getRooms: (params?: Record<string, unknown>) => Promise<{ items?: RoomRecord[] }>;
  getDormBeds: (dormId: EntityId) => Promise<{ dormBeds?: BedRecord[] }>;
  assignOccupancy: (payload: Record<string, unknown>) => Promise<unknown>;
  moveBed: (payload: Record<string, unknown>) => Promise<unknown>;
  swapBedOccupancy: (payload: Record<string, unknown>) => Promise<unknown>;
}

interface ResidencyAdjustModalProps {
  open: boolean;
  student: StudentRecord | null;
  mode: ResidencyAdjustMode;
  onClose: () => void;
  onRefresh?: () => void;
}

function pickResidencyAction<T extends (...args: never[]) => unknown>(
  source: AppActions,
  key: string,
): T | undefined {
  const value = source[key];
  return typeof value === 'function' ? (value as T) : undefined;
}

function createResidencyAdjustActions(source: AppActions): ResidencyAdjustActions {
  return {
    getBuildings:
      pickResidencyAction<NonNullable<ResidencyAdjustActions['getBuildings']>>(
        source,
        'getBuildings',
      ) || (async () => ({ items: [] })),
    getFloors:
      pickResidencyAction<NonNullable<ResidencyAdjustActions['getFloors']>>(
        source,
        'getFloors',
      ) || (async () => ({ floors: [] })),
    getRooms:
      pickResidencyAction<NonNullable<ResidencyAdjustActions['getRooms']>>(
        source,
        'getRooms',
      ) || (async () => ({ items: [] })),
    getDormBeds:
      pickResidencyAction<NonNullable<ResidencyAdjustActions['getDormBeds']>>(
        source,
        'getDormBeds',
      ) || (async () => ({ dormBeds: [] })),
    assignOccupancy:
      pickResidencyAction<NonNullable<ResidencyAdjustActions['assignOccupancy']>>(
        source,
        'assignOccupancy',
      ) || (async () => undefined),
    moveBed:
      pickResidencyAction<NonNullable<ResidencyAdjustActions['moveBed']>>(
        source,
        'moveBed',
      ) || (async () => undefined),
    swapBedOccupancy:
      pickResidencyAction<
        NonNullable<ResidencyAdjustActions['swapBedOccupancy']>
      >(source, 'swapBedOccupancy') || (async () => undefined),
  };
}

export default function ResidencyAdjustModal({
  open,
  student,
  mode,
  onClose,
  onRefresh,
}: ResidencyAdjustModalProps) {
  const { actions } = useAppContext();
  const occupancyActions = useMemo(() => createResidencyAdjustActions(actions), [actions]);
  const [form] = Form.useForm<ResidencyAdjustFormValues>();
  const [loading, setLoading] = useState(false);
  const [buildings, setBuildings] = useState<BuildingRecord[]>([]);
  const [floors, setFloors] = useState<Array<string | number>>([]);
  const [rooms, setRooms] = useState<RoomRecord[]>([]);
  const [selectedBed, setSelectedBed] = useState<SelectedBedRecord | null>(null);
  const [isSwapping, setIsSwapping] = useState(false);
  const [roomSearch, setRoomSearch] = useState('');
  const [selectedRoomId, setSelectedRoomId] = useState<EntityId | null>(null);

  const resetState = useCallback(() => {
    form.resetFields();
    setFloors([]);
    setRooms([]);
    setSelectedBed(null);
    setIsSwapping(false);
    setRoomSearch('');
    setSelectedRoomId(null);
  }, [form]);

  const loadBuildings = useCallback(async () => {
    try {
      const result = await occupancyActions.getBuildings({ pageSize: 100 });
      setBuildings(result.buildings || result.items || []);
    } catch (error) {
      console.error('加载楼栋失败:', error);
      message.error('加载楼栋失败');
    }
  }, [occupancyActions]);

  useEffect(() => {
    if (open) {
      void loadBuildings();
    }
  }, [loadBuildings, open]);

  const loadBedsForRoom = useCallback(
    async (roomId: EntityId): Promise<BedRecord[]> => {
      const result = await occupancyActions.getDormBeds(roomId);
      return result.dormBeds || [];
    },
    [occupancyActions],
  );

  const handleBuildingChange = useCallback(
    async (value: string) => {
      form.setFieldsValue({ floor: null, room: null, bed: null });
      setRooms([]);
      setSelectedBed(null);
      setIsSwapping(false);
      setSelectedRoomId(null);

      try {
        const result = await occupancyActions.getFloors({ building: value });
        setFloors(result.floors || []);
      } catch (error) {
        console.error('加载楼层失败:', error);
        message.error('加载楼层失败');
      }
    },
    [form, occupancyActions],
  );

  const handleFloorChange = useCallback(
    async (value: string | number) => {
      form.setFieldsValue({ room: null, bed: null });
      setSelectedBed(null);
      setIsSwapping(false);
      setSelectedRoomId(null);
      setRoomSearch('');

      try {
        const result = await occupancyActions.getRooms({
          building: form.getFieldValue('building'),
          floor: value,
          pageSize: 100,
        });
        setRooms(result.items || []);
      } catch (error) {
        console.error('加载房间失败:', error);
        message.error('加载房间失败');
      }
    },
    [form, occupancyActions],
  );

  const handleRoomSelect = useCallback(
    async (newSelectedIds: EntityId[]) => {
      const roomId = newSelectedIds[0];
      if (!roomId) {
        setSelectedRoomId(null);
        form.setFieldsValue({ room: null, bed: null });
        return;
      }

      if (roomId === selectedRoomId) {
        return;
      }

      setSelectedRoomId(roomId);
      form.setFieldsValue({ room: roomId, bed: null });
      setSelectedBed(null);
      setIsSwapping(false);

      try {
        await loadBedsForRoom(roomId);
      } catch (error) {
        console.error('加载床位失败:', error);
        message.error('加载床位失败');
      }
    },
    [form, loadBedsForRoom, selectedRoomId],
  );

  const handleDualSelect = useCallback(
    (bed: SelectedBedRecord) => {
      if (bed.dormId && bed.dormId !== selectedRoomId) {
        setSelectedRoomId(bed.dormId);
        void loadBedsForRoom(bed.dormId);
      }

      form.setFieldsValue({ room: bed.dormId || null, bed: bed.bedNo || null });
      setSelectedBed(bed);

      if (bed.studentId) {
        if (bed.studentId === student?.id) {
          message.warning('目标床位正是该学生当前位置');
          setIsSwapping(false);
        } else {
          setIsSwapping(true);
        }
      } else {
        setIsSwapping(false);
      }
    },
    [form, loadBedsForRoom, selectedRoomId, student?.id],
  );

  const handleSubmit = useCallback(async () => {
    if (loading || !student?.id) {
      return;
    }

    try {
      const values = await form.validateFields();
      const targetRoom = rooms.find((room) => room.id === values.room);
      const roomLabel = targetRoom?.roomNo || values.room;

      if (!student.fullName || !student.studentNo || !values.bed || !roomLabel) {
        message.error('关键信息缺失，无法继续办理，请刷新后重试');
        return;
      }

      const confirmConfig =
        mode === 'assign'
          ? {
              title: '确认入住分配',
              content: `即将为「${student.fullName}」(${student.studentNo}) 分配至 ${roomLabel} 房 ${values.bed} 号床。确认办理？`,
              okText: '确认分配',
              cancelText: '取消',
            }
          : isSwapping
            ? {
                title: '确认床位互换',
                content: `「${student.fullName}」将与目标床位的在住学生互换位置，双方住宿信息将同时变更。确认互换？`,
                okText: '确认互换',
                cancelText: '取消',
                okType: 'danger' as const,
              }
            : {
                title: '确认调宿',
                content: `「${student.fullName}」将从当前位置迁移至 ${roomLabel} 房 ${values.bed} 号床，原床位将释放。确认调宿？`,
                okText: '确认调宿',
                cancelText: '取消',
              };

      const confirmed = await new Promise<boolean>((resolve) => {
        Modal.confirm({
          ...confirmConfig,
          maskClosable: false,
          keyboard: false,
          onOk: () => resolve(true),
          onCancel: () => resolve(false),
        });
      });

      if (!confirmed) {
        return;
      }

      setLoading(true);

      const payload = {
        studentId: student.id,
        targetDormId: values.room,
        targetBedNo: values.bed,
      };

      if (mode === 'assign') {
        await occupancyActions.assignOccupancy({
          dormId: values.room,
          bedNo: values.bed,
          studentId: student.id,
        });
        message.success('入住手续已完成');
      } else if (isSwapping && selectedBed?.studentId) {
        await occupancyActions.swapBedOccupancy({
          studentId1: student.id,
          studentId2: selectedBed.studentId,
        });
        message.success('床位互换成功');
      } else {
        await occupancyActions.moveBed(payload);
        message.success('迁宿手续已完成');
      }

      onRefresh?.();
      onClose();
    } catch (error) {
      if (error && typeof error === 'object' && 'errorFields' in error) {
        return;
      }

      const nextMessage = error instanceof Error ? error.message : '操作失败';
      message.error(nextMessage);
    } finally {
      setLoading(false);
    }
  }, [form, isSwapping, loading, mode, occupancyActions, onClose, onRefresh, rooms, selectedBed?.studentId, student]);

  const filteredRooms = useMemo(() => {
    if (!roomSearch.trim()) {
      return rooms;
    }

    return rooms.filter((room) => (room.roomNo || '').includes(roomSearch.trim()));
  }, [roomSearch, rooms]);
  const selectedBuilding = form.getFieldValue('building');
  const selectedFloor = form.getFieldValue('floor');
  const noWritableBuildings = buildings.length === 0;
  const roomEmptyMessage = noWritableBuildings
    ? '当前数据范围下暂无可操作宿舍'
    : !selectedBuilding
      ? '请先选择楼栋'
      : !selectedFloor
        ? '当前楼栋下暂无可选楼层'
        : '当前筛选条件下暂无可用房间';

  return (
    <Modal
      title={
        <Space>
          <CompassOutlined />
          <span>{mode === 'assign' ? '办理入住分配' : '办理宿位异动'}</span>
        </Space>
      }
      open={open}
      onCancel={onClose}
      onOk={() => {
        void handleSubmit();
      }}
      confirmLoading={loading}
      okButtonProps={{ disabled: loading || noWritableBuildings }}
      width={1000}
      okText="确认办理"
      cancelText="取消"
      destroyOnHidden
      afterClose={resetState}
      style={{ top: 20 }}
    >
      <div style={{ marginBottom: 20 }}>
        <Alert
          message={
            <Space direction="vertical" size={2}>
              <Text strong>
                {student?.fullName} ({student?.studentNo})
              </Text>
              {student?.dormId ? (
                <Text type="secondary">
                  当前位置：{student.building} - {student.roomNo} - {student.bedNo}号床
                </Text>
              ) : (
                <Text type="secondary">当前状态：未入住</Text>
              )}
            </Space>
          }
          type="info"
          showIcon
          icon={<UserOutlined />}
        />
      </div>
      {noWritableBuildings ? (
        <div style={{ marginBottom: 20 }}>
          <Alert
            type="warning"
            showIcon
            message="当前没有可写宿舍"
            description="当前角色数据范围下暂无可办理的宿舍和床位，请联系管理员调整角色数据范围。"
          />
        </div>
      ) : null}

      <Form form={form} layout="vertical">
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="building" label="目标楼栋" rules={[{ required: true, message: '请选择楼栋' }]}>
              <PanelSelect
                placeholder={noWritableBuildings ? '当前无可选楼栋' : '选择楼栋'}
                onChange={handleBuildingChange}
                disabled={noWritableBuildings}
              >
                {buildings.map((building) => (
                  <Select.Option key={building.building} value={building.building}>
                    {building.building}
                  </Select.Option>
                ))}
              </PanelSelect>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="floor" label="所在楼层" rules={[{ required: true, message: '请选择楼层' }]}>
              <PanelSelect
                placeholder={!selectedBuilding ? '请先选择楼栋' : floors.length ? '选择楼层' : '当前无可选楼层'}
                onChange={handleFloorChange}
                disabled={!floors.length}
              >
                {floors.map((floor) => (
                  <Select.Option key={String(floor)} value={floor}>
                    {floor}层
                  </Select.Option>
                ))}
              </PanelSelect>
            </Form.Item>
          </Col>
        </Row>

        <Form.Item label="目标房间" name="room" rules={[{ required: true, message: '请选择房间' }]}>
          <div
            className="room-selector-wrapper dark-mode-input-wrapper"
            style={{ border: '1px solid #d9d9d9', borderRadius: 8, padding: 12 }}
          >
            {rooms.length === 0 ? (
              <div className="room-selector-placeholder" style={{ color: '#999', textAlign: 'center', padding: '16px 0' }}>
                {roomEmptyMessage}
              </div>
            ) : (
              <>
                <div style={{ marginBottom: 12 }}>
                  <Input.Search
                    placeholder="输入房号快速筛选 (如 205)"
                    value={roomSearch}
                    onChange={(event) => setRoomSearch(event.target.value)}
                    allowClear
                    size="small"
                    style={{ maxWidth: 200 }}
                  />
                </div>
                <div style={{ maxHeight: 400, overflowY: 'auto' }}>
          <DormGridSelector
            dataSource={filteredRooms}
            selectedRowKeys={selectedRoomId ? [selectedRoomId] : []}
            viewMode="mini"
                    bedDisplayMode="inline"
                    disableFullRooms={mode === 'assign'}
                    allowSwap={mode !== 'assign'}
                    onFetchBeds={loadBedsForRoom}
                    onBedSelect={handleDualSelect}
                    onChange={handleRoomSelect}
                    grid={{ gutter: 12, xs: 2, sm: 3, md: 4, lg: 5 }}
                    activeBed={selectedBed ? { dormId: selectedRoomId, bedNo: selectedBed.bedNo } : null}
                  />
                </div>
              </>
            )}
          </div>
        </Form.Item>

        <Form.Item name="bed" hidden rules={[{ required: true, message: '请在上方卡片中点击选择床位' }]}>
          <Input />
        </Form.Item>

        <Form.Item label="目标床位" required>
          <Input
            readOnly
            placeholder="请在上方房间列表中点击绿色/红色床位标签进行选择"
            value={selectedBed ? `${selectedBed.bedNo}号床  —  ${selectedBed.studentName || '空闲'}` : ''}
            className={`dark-mode-readonly-input ${selectedBed ? 'has-selection ant-input-affix-wrapper-focused' : ''}`}
            style={{ cursor: 'default', fontWeight: selectedBed ? 500 : 400 }}
            suffix={selectedBed ? <CheckCircleFilled style={{ color: '#52c41a' }} /> : null}
          />
          {selectedBed?.studentId && isSwapping ? (
            <div style={{ fontSize: '12px', color: '#faad14', marginTop: 4 }}>
              <SwapOutlined /> 将与该学生互换床位
            </div>
          ) : null}
        </Form.Item>

        {isSwapping ? (
          <div style={{ marginTop: 12 }}>
            <Alert
              type="warning"
              showIcon
              icon={<SwapOutlined />}
              message="自动检测到互换模式"
              description={`系统检测到目标床位已有学生。点击确认后，${student?.fullName} 将与该床位的学生进行互换。`}
            />
          </div>
        ) : null}

        {!isSwapping && selectedBed && mode !== 'assign' ? (
          <div style={{ marginTop: 12 }}>
            <Alert
              type="success"
              showIcon
              icon={<EnvironmentOutlined />}
              message="自动检测到迁宿模式"
              description="目标床位为空。点击确认后，该生将完成调宿，原床位将释放。"
            />
          </div>
        ) : null}
      </Form>
    </Modal>
  );
}
