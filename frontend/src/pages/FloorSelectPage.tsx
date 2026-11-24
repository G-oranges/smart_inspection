import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Button, Empty, FloatButton, Space, Steps, Tag } from 'antd';
import {
  ArrowLeftOutlined,
  LayoutOutlined,
  RightOutlined,
} from '@ant-design/icons';

import PageLayout from '../components/PageLayout';
import PermissionDeniedState from '../components/common/PermissionDeniedState';
import { resultRecordPermissionPreset } from '../components/common/permissionDeniedPresets';
import { useAppContext } from '../context/AppContext';

import type { LocationSelectionActions } from './location-selection/types';

export default function FloorSelectPage() {
  const appContext = useAppContext();
  const rawActions = appContext.actions;
  const actions = useMemo<LocationSelectionActions>(() => ({
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
  }), [
    rawActions,
  ]);
  // 使用 ref 稳定 actions 引用，防止 actions 对象变化导致 useEffect 死循环
  const actionsRef = useRef(actions);
  actionsRef.current = actions;

  const { hasPermission, permissionsReady } = appContext;
  const navigate = useNavigate();
  const { building } = useParams<{ building: string }>();
  const [searchParams] = useSearchParams();
  const campus = searchParams.get('campus') || '';
  const taskId = searchParams.get('taskId') || '';
  const decodedBuilding = building ? decodeURIComponent(building) : '';
  const [floors, setFloors] = useState<Array<string | number>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadFloors = useCallback(async () => {
    const currentActions = actionsRef.current;
    if (!currentActions.fetchAssignedDorms || !taskId || !decodedBuilding) {
      return;
    }

    setLoading(true);
    setError('');
    try {
      const result = await currentActions.fetchAssignedDorms(taskId, {
        building: decodedBuilding,
        campus,
      });
      const values = Array.from(
        new Set(
          (result?.dorms || [])
            .map((item) => item.floor)
            .filter((value): value is string | number => value !== null && value !== undefined),
        ),
      ).sort((left, right) => Number(left) - Number(right));
      setFloors(values);
    } catch (caughtError) {
      const nextError =
        caughtError instanceof Error ? caughtError.message : '加载楼层失败';
      setError(nextError);
    } finally {
      setLoading(false);
    }
  }, [campus, decodedBuilding, taskId]);

  useEffect(() => {
    void loadFloors();
  }, [loadFloors]);

  const handleBack = useCallback(() => {
    const query = [];
    if (taskId) {
      query.push(`taskId=${encodeURIComponent(taskId)}`);
    }
    navigate(`/tasks/entry/buildings${query.length ? `?${query.join('&')}` : ''}`);
  }, [navigate, taskId]);

  const goToRooms = useCallback(
    (floorValue: string | number) => {
      if (!decodedBuilding || !taskId) {
        return;
      }

      const query = [`taskId=${encodeURIComponent(taskId)}`];
      if (campus) {
        query.push(`campus=${encodeURIComponent(campus)}`);
      }

      navigate(
        `/tasks/entry/buildings/${encodeURIComponent(decodedBuilding)}/floors/${encodeURIComponent(floorValue)}/rooms?${query.join('&')}`,
      );
    },
    [campus, decodedBuilding, navigate, taskId],
  );

  if (!permissionsReady) {
    return null;
  }

  if (!hasPermission('RESULT_RECORD')) {
    return <PermissionDeniedState {...resultRecordPermissionPreset} />;
  }

  return (
    <PageLayout>
      <div className="max-w-4xl mx-auto space-y-8 animate-apple-in">
        <div className="flex items-center justify-between mb-4">
          <Space size="small" className="text-xs font-bold uppercase tracking-wider text-gray-400">
            <Link to="/tasks/entry/buildings" className="hover:text-blue-500 transition-colors">
              楼栋
            </Link>
            <RightOutlined className="text-[11px]" />
            <span className="text-blue-600">{decodedBuilding}</span>
            {campus ? (
              <Tag className="rounded-full border-none bg-gray-100 text-gray-500 ml-2">
                {campus} 校区
              </Tag>
            ) : null}
          </Space>
          <Button
            onClick={handleBack}
            icon={<ArrowLeftOutlined />}
            type="text"
            className="apple-btn-text h-10 px-4 rounded-xl font-bold text-blue-500"
          >
            更换楼栋
          </Button>
        </div>

        <div className="hidden md:block">
          <Steps
            current={1}
            items={[{ title: '选楼栋' }, { title: '选楼层' }, { title: '选房间' }]}
            className="apple-steps"
          />
        </div>

        <div className="space-y-6">
          <div className="flex items-center gap-2 px-1">
            <div className="w-1 h-4 bg-orange-500 rounded-full" />
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest">
              楼层
            </h3>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-6">
              {[1, 2, 3, 4, 5, 6].map((item) => (
                <div key={item} className="aspect-square glass-panel rounded-3xl animate-pulse" />
              ))}
            </div>
          ) : error ? (
            <div className="glass-panel p-12 text-center text-red-500">
              <p className="font-bold">{error}</p>
              <Button onClick={() => void loadFloors()} className="mt-4 rounded-xl">
                重试加载
              </Button>
            </div>
          ) : floors.length === 0 ? (
            <div className="glass-panel p-20 text-center flex flex-col items-center gap-4 opacity-60">
              <div className="w-20 h-20 rounded-full bg-gray-50 flex items-center justify-center border border-dashed border-gray-300">
                <LayoutOutlined className="text-3xl text-gray-300" />
              </div>
              <Empty description="该楼栋下暂无分配给你的检查楼层" />
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-6">
              {floors.map((floorValue) => (
                <div
                  key={String(floorValue)}
                  onClick={() => goToRooms(floorValue)}
                  className="aspect-square glass-panel m-0 flex flex-col items-center justify-center cursor-pointer active:scale-90 transition-all bg-white dark:bg-zinc-900 border border-white dark:border-white/5 hover:border-blue-500/30 hover:shadow-2xl group relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-12 h-12 bg-blue-50/50 rounded-bl-full translate-x-4 -translate-y-4 group-hover:translate-x-0 group-hover:translate-y-0 transition-transform" />
                  <span className="text-3xl font-bold text-gray-800 dark:text-white group-hover:text-blue-600 transition-colors">
                    {floorValue} 层
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <FloatButton.BackTop />
    </PageLayout>
  );
}
