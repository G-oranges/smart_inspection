import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Button,
  Empty,
  FloatButton,
  Input,
  Segmented,
  Space,
  Steps,
  Tag,
} from 'antd';
import type { SegmentedValue } from 'antd/es/segmented';
import {
  ArrowLeftOutlined,
  CarryOutOutlined,
  CheckCircleFilled,
  FieldTimeOutlined,
  RightOutlined,
  SearchOutlined,
} from '@ant-design/icons';

import PageLayout from '../components/PageLayout';
import PermissionDeniedState from '../components/common/PermissionDeniedState';
import { resultRecordPermissionPreset } from '../components/common/permissionDeniedPresets';
import { useAppContext } from '../context/AppContext';

import type { EntityId } from '../types/service';
import type {
  AssignedDormRecord,
  LocationSelectionActions,
  SelectionInspectionRecord,
} from './location-selection/types';

type RoomStatus = 'pending' | 'recorded';
const TAB_OPTIONS = [
  { label: '待检查', value: 'pending', icon: <FieldTimeOutlined /> },
  { label: '已完成', value: 'recorded', icon: <CheckCircleFilled /> },
];

function normalizeId(value: EntityId | null | undefined): string {
  return value === null || value === undefined ? '' : String(value);
}

function createLocationSelectionActions(
  rawActions: ReturnType<typeof useAppContext>['actions'],
): LocationSelectionActions {
  return {
    loadTasks: async () => {
      if (typeof rawActions.loadTasks === 'function') {
        await rawActions.loadTasks();
      }
    },
    fetchAssignedDorms: async (taskId, params) => {
      if (typeof rawActions.fetchAssignedDorms === 'function') {
        return await rawActions.fetchAssignedDorms(taskId, params);
      }
      return {};
    },
    loadInspections: async (force) => {
      if (typeof rawActions.loadInspections === 'function') {
        await rawActions.loadInspections(force);
      }
    },
  };
}

interface RoomSelectHeaderProps {
  campus: string;
  decodedBuilding: string;
  decodedFloor: string;
  handleBack: () => void;
  taskId: string;
}

function RoomSelectHeader({
  campus,
  decodedBuilding,
  decodedFloor,
  handleBack,
  taskId,
}: RoomSelectHeaderProps) {
  return (
    <>
      <div className="flex items-center justify-between mb-2">
        <Space
          size="small"
          className="text-xs font-bold uppercase tracking-wider text-gray-400 no-scrollbar overflow-x-auto whitespace-nowrap"
        >
          <Link to="/tasks/entry/buildings" className="hover:text-blue-500">
            楼栋
          </Link>
          <RightOutlined className="text-[10px]" />
          <Link
            to={`/tasks/entry/buildings/${encodeURIComponent(decodedBuilding)}/floors?taskId=${encodeURIComponent(taskId)}&campus=${encodeURIComponent(campus)}`}
            className="hover:text-blue-500"
          >
            {decodedBuilding}
          </Link>
          <RightOutlined className="text-[10px]" />
          <span className="text-blue-600">{decodedFloor} 楼</span>
        </Space>
        <Button
          onClick={handleBack}
          icon={<ArrowLeftOutlined />}
          type="text"
          className="apple-btn-text h-10 px-4 rounded-xl font-bold text-blue-500"
        >
          更换楼层
        </Button>
      </div>

      <div className="hidden md:block">
        <Steps
          current={2}
          items={[{ title: '选楼栋' }, { title: '选楼层' }, { title: '选房间' }]}
          className="apple-steps"
        />
      </div>
    </>
  );
}

interface RoomSelectBodyProps {
  displayedRooms: AssignedDormRecord[];
  error: string;
  handleRoomClick: (room: AssignedDormRecord) => void;
  inspectionsError: string;
  inspectionsLoading: boolean;
  loading: boolean;
  recordedRoomIds: Set<EntityId>;
  status: RoomStatus;
}

function RoomSelectBody({
  displayedRooms,
  error,
  handleRoomClick,
  inspectionsError,
  inspectionsLoading,
  loading,
  recordedRoomIds,
  status,
}: RoomSelectBodyProps) {
  return (
    <div className="space-y-6" key={status}>
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-2">
          <div
            className={`w-1 h-4 rounded-full ${status === 'pending' ? 'bg-orange-500' : 'bg-green-500'}`}
          />
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest">
            {status === 'pending' ? '待执行巡查' : '历史核查闭环'}
          </h3>
        </div>
        <Tag className="rounded-full border-none bg-blue-50 text-blue-600 px-3 font-bold">
          {displayedRooms.length} 间
        </Tag>
      </div>

      {loading || inspectionsLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-6">
          {[1, 2, 3, 4, 5].map((item) => (
            <div key={item} className="h-28 glass-panel rounded-3xl animate-pulse" />
          ))}
        </div>
      ) : error || inspectionsError ? (
        <div className="glass-panel p-12 text-center text-red-500">
          <p className="font-bold">{error || inspectionsError}</p>
        </div>
      ) : displayedRooms.length === 0 ? (
        <div className="glass-panel p-20 text-center flex flex-col items-center gap-4 opacity-60">
          <div className="w-20 h-20 rounded-full bg-gray-50 flex items-center justify-center border border-dashed border-gray-300">
            <CarryOutOutlined className="text-3xl text-gray-300" />
          </div>
          <Empty description={`当前路径下暂无${status === 'pending' ? '待处理' : '已完成'}的房间数据`} />
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-6">
          {displayedRooms.map((room) => {
            const isRecorded = room.id !== undefined ? recordedRoomIds.has(room.id) : false;

            return (
              <div
                key={normalizeId(room.id) || room.roomNo || 'room'}
                onClick={() => handleRoomClick(room)}
                className={`glass-panel m-0 p-6 flex flex-col items-center justify-center cursor-pointer active:scale-90 transition-all shadow-sm border border-white dark:border-white/5 group relative overflow-hidden ${isRecorded ? 'bg-green-50/50 dark:bg-green-900/10' : 'bg-white dark:bg-zinc-900'} hover:shadow-2xl hover:border-blue-500/20`}
              >
                {isRecorded ? (
                  <div className="absolute top-0 right-0 p-2 text-green-500 animate-apple-in">
                    <CheckCircleFilled />
                  </div>
                ) : null}
                <span
                  className={`text-2xl font-black transition-colors ${isRecorded ? 'text-green-600' : 'text-gray-800 dark:text-white group-hover:text-blue-600'}`}
                >
                  {room.roomNo || '--'}
                </span>
                <div className="flex flex-col items-center mt-3 gap-1">
                  <div
                    className={`h-1 w-6 rounded-full transition-all ${isRecorded ? 'bg-green-500 w-12' : 'bg-gray-100 group-hover:bg-blue-500'}`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function RoomSelectPage() {
  const appContext = useAppContext();
  const rawActions = appContext.actions;
  const actions = useMemo<LocationSelectionActions>(
    () => createLocationSelectionActions(rawActions),
    [rawActions],
  );
  // 使用 ref 稳定 actions 引用，防止 actions 对象变化导致 useEffect 死循环
  const actionsRef = useRef(actions);
  actionsRef.current = actions;

  const inspections = useMemo(
    () => (appContext.data.inspections || []) as SelectionInspectionRecord[],
    [appContext.data.inspections],
  );
  const { hasPermission, permissionsReady } = appContext;
  const navigate = useNavigate();
  const location = useLocation();
  const { building, floor } = useParams<{ building: string; floor: string }>();
  const [searchParams] = useSearchParams();
  const campus = searchParams.get('campus') || '';
  const taskId = searchParams.get('taskId') || '';
  const decodedBuilding = building ? decodeURIComponent(building) : '';
  const decodedFloor = floor ? decodeURIComponent(floor) : '';
  const [status, setStatus] = useState<RoomStatus>('pending');
  const [search, setSearch] = useState('');
  const [assignedRooms, setAssignedRooms] = useState<AssignedDormRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [inspectionsError, setInspectionsError] = useState('');
  const [inspectionsLoading, setInspectionsLoading] = useState(false);

  const refreshSignal =
    typeof location.state === 'object' && location.state && 'refreshTrigger' in location.state
      ? Number(
          (location.state as { refreshTrigger?: number | string }).refreshTrigger || 0,
        )
      : 0;

  const loadRooms = useCallback(async () => {
    const currentActions = actionsRef.current;
    if (!currentActions.fetchAssignedDorms || !taskId || !decodedBuilding || !decodedFloor) {
      return;
    }

    setLoading(true);
    setError('');
    try {
      const result = await currentActions.fetchAssignedDorms(taskId, {
        building: decodedBuilding,
        floor: decodedFloor,
        campus,
        search,
      });
      setAssignedRooms(result?.dorms || []);
    } catch (caughtError) {
      const nextError =
        caughtError instanceof Error ? caughtError.message : '加载宿舍失败';
      setError(nextError);
    } finally {
      setLoading(false);
    }
  }, [campus, decodedBuilding, decodedFloor, search, taskId]);

  useEffect(() => {
    void loadRooms();
  }, [loadRooms, refreshSignal]);

  useEffect(() => {
    let cancelled = false;
    const currentLoadInspections = actionsRef.current.loadInspections;

    if (!currentLoadInspections || !taskId) {
      return;
    }

    const reloadInspections = async () => {
      setInspectionsLoading(true);
      setInspectionsError('');
      try {
        await currentLoadInspections(true);
      } catch (caughtError) {
        if (cancelled) {
          return;
        }

        const nextError =
          caughtError instanceof Error ? caughtError.message : '加载查寝结果失败';
        setInspectionsError(nextError);
      } finally {
        if (!cancelled) {
          setInspectionsLoading(false);
        }
      }
    };

    void reloadInspections();

    return () => {
      cancelled = true;
    };
  }, [refreshSignal, taskId]);

  const handleBack = useCallback(() => {
    const query = [];
    if (taskId) {
      query.push(`taskId=${encodeURIComponent(taskId)}`);
    }
    if (campus) {
      query.push(`campus=${encodeURIComponent(campus)}`);
    }
    navigate(
      `/tasks/entry/buildings/${encodeURIComponent(building || '')}/floors?${query.join('&')}`,
    );
  }, [building, campus, navigate, taskId]);

  const handleRoomClick = useCallback(
    (room: AssignedDormRecord) => {
      if (!room.roomNo) {
        return;
      }

      const query = [];
      if (taskId) {
        query.push(`taskId=${encodeURIComponent(taskId)}`);
      }
      if (campus) {
        query.push(`campus=${encodeURIComponent(campus)}`);
      }

      navigate(
        `/tasks/entry/buildings/${encodeURIComponent(decodedBuilding)}/floors/${encodeURIComponent(decodedFloor)}/rooms/${encodeURIComponent(room.roomNo)}${query.length ? `?${query.join('&')}` : ''}`,
      );
    },
    [campus, decodedBuilding, decodedFloor, navigate, taskId],
  );

  const recordedRoomIds = useMemo<Set<EntityId>>(() => {
    const ids = new Set<EntityId>();

    inspections.forEach((inspection) => {
      if (!inspection.dormId) {
        return;
      }

      if (!normalizeId(inspection.taskId) || normalizeId(inspection.taskId) !== taskId) {
        return;
      }

      if (inspection.totalScore === null || inspection.totalScore === undefined) {
        return;
      }

      if (campus && inspection.dorm?.campus && inspection.dorm.campus !== campus) {
        return;
      }

      if (
        inspection.dorm?.building === decodedBuilding &&
        String(inspection.dorm?.floor) === decodedFloor
      ) {
        ids.add(inspection.dormId);
      }
    });

    return ids;
  }, [campus, decodedBuilding, decodedFloor, inspections, taskId]);

  const displayedRooms = useMemo<AssignedDormRecord[]>(() => {
    const filteredRooms = assignedRooms.filter((room) => {
      const roomId = room.id;
      const isRecorded = roomId !== undefined ? recordedRoomIds.has(roomId) : false;
      return status === 'pending' ? !isRecorded : isRecorded;
    });

    if (!search.trim()) {
      return filteredRooms;
    }

    const keyword = search.trim().toLowerCase();
    return filteredRooms.filter((room) =>
      (room.roomNo || '').toLowerCase().includes(keyword),
    );
  }, [assignedRooms, recordedRoomIds, search, status]);

  if (!permissionsReady) {
    return null;
  }

  if (!hasPermission('RESULT_RECORD')) {
    return <PermissionDeniedState {...resultRecordPermissionPreset} />;
  }

  return (
    <PageLayout>
      <div className="max-w-4xl mx-auto space-y-8 animate-apple-in">
        <RoomSelectHeader
          campus={campus}
          decodedBuilding={decodedBuilding}
          decodedFloor={decodedFloor}
          handleBack={handleBack}
          taskId={taskId}
        />

        <div className="glass-panel p-2 shadow-sm border border-black/5 rounded-[32px] bg-white/40 dark:bg-zinc-800/20 backdrop-blur-xl">
          <Segmented
            options={TAB_OPTIONS}
            value={status}
            onChange={(value: SegmentedValue) => setStatus(value as RoomStatus)}
            block
            className="apple-segmented mb-2 p-1 bg-gray-50 dark:bg-zinc-900 border-none shadow-none"
            size="large"
          />
          <div className="px-2 pb-2">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="输入房号快速检索..."
              prefix={<SearchOutlined className="text-gray-400" />}
              allowClear
              size="large"
              className="apple-input h-12 !rounded-2xl"
            />
          </div>
        </div>

        <RoomSelectBody
          displayedRooms={displayedRooms}
          error={error}
          handleRoomClick={handleRoomClick}
          inspectionsError={inspectionsError}
          inspectionsLoading={inspectionsLoading}
          loading={loading}
          recordedRoomIds={recordedRoomIds}
          status={status}
        />
      </div>
      <FloatButton.BackTop />
    </PageLayout>
  );
}
