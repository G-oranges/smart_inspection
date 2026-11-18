import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Empty, FloatButton, Input, Select, Skeleton, Steps } from 'antd';
import {
  BankOutlined,
  CheckCircleOutlined,
  EnvironmentOutlined,
  RightOutlined,
  SearchOutlined,
  WarningOutlined,
} from '@ant-design/icons';

import PageLayout from '../components/PageLayout';
import PermissionDeniedState from '../components/common/PermissionDeniedState';
import { resultRecordPermissionPreset } from '../components/common/permissionDeniedPresets';
import { useAppContext } from '../context/AppContext';

import type { RoleLike, UserLike } from '../types/app';
import type { EntityId } from '../types/service';
import type {
  AssignedDormRecord,
  LocationSelectionActions,
  SelectionTaskRecord,
} from './location-selection/types';

function normalizeId(value: EntityId | null | undefined): string {
  return value === null || value === undefined ? '' : String(value);
}

function isManagerRole(role: RoleLike | null): boolean {
  return role?.code === 'ADMIN' || role?.code === 'COUNSELOR';
}

export default function BuildingSelectPage() {
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

  const tasks = useMemo(
    () => (appContext.data.tasks || []) as SelectionTaskRecord[],
    [appContext.data.tasks],
  );
  const user = appContext.user as UserLike | null;
  const activeRole = appContext.activeRole;
  const { hasPermission, permissionsReady } = appContext;
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [assignedDorms, setAssignedDorms] = useState<AssignedDormRecord[]>([]);
  const [loadingAssigned, setLoadingAssigned] = useState(false);
  const [assignedError, setAssignedError] = useState('');

  useEffect(() => {
    if (permissionsReady && hasPermission('RESULT_RECORD')) {
      void actionsRef.current.loadTasks?.();
    }
  // 仅在权限就绪时触发一次，不依赖 actions
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasPermission, permissionsReady]);

  const ongoingTasksForUser = useMemo<SelectionTaskRecord[]>(() => {
    const now = new Date();
    const currentUserId = normalizeId(user?.id);
    const baseTasks = isManagerRole(activeRole)
      ? tasks
      : tasks.filter((task) =>
          Array.isArray(task.executorIds)
            ? task.executorIds.some((executorId) => normalizeId(executorId) === currentUserId)
            : false,
        );

    return baseTasks.filter((task) => {
      if (task.status !== 'ONGOING') {
        return false;
      }

      if (task.deadline) {
        const deadlineDate = new Date(task.deadline);
        if (!Number.isNaN(deadlineDate.getTime()) && now > deadlineDate) {
          return false;
        }
      }

      return true;
    });
  }, [activeRole, tasks, user?.id]);

  const loadAssignedDorms = useCallback(async () => {
    const currentActions = actionsRef.current;
    if (!selectedTaskId || !currentActions.fetchAssignedDorms) {
      return;
    }

    setLoadingAssigned(true);
    setAssignedError('');
    try {
      const result = await currentActions.fetchAssignedDorms(selectedTaskId);
      setAssignedDorms(result?.dorms || []);
    } catch (error) {
      const nextError =
        error instanceof Error ? error.message : '加载任务宿舍失败';
      setAssignedError(nextError);
    } finally {
      setLoadingAssigned(false);
    }
  }, [selectedTaskId]);

  useEffect(() => {
    void loadAssignedDorms();
  }, [loadAssignedDorms]);

  const filteredBuildings = useMemo<Array<{ campus?: string; building: string }>>(() => {
    if (!selectedTaskId) {
      return [];
    }

    const keyword = search.trim().toLowerCase();
    const buildingMap = new Map<string, { campus?: string; building: string }>();

    assignedDorms.forEach((dorm) => {
      const buildingName = dorm.building?.trim();
      if (!buildingName) {
        return;
      }

      if (keyword) {
        const campusName = dorm.campus || '';
        const matches =
          buildingName.toLowerCase().includes(keyword) ||
          campusName.toLowerCase().includes(keyword);

        if (!matches) {
          return;
        }
      }

      const key = `${dorm.campus || ''}-${buildingName}`;
      if (!buildingMap.has(key)) {
        buildingMap.set(key, { campus: dorm.campus, building: buildingName });
      }
    });

    return Array.from(buildingMap.values()).sort((left, right) =>
      left.building.localeCompare(right.building),
    );
  }, [assignedDorms, search, selectedTaskId]);

  const goToFloors = useCallback(
    (item: { campus?: string; building?: string }) => {
      if (!item.building || !selectedTaskId) {
        return;
      }

      const query = [`taskId=${encodeURIComponent(selectedTaskId)}`];
      if (item.campus) {
        query.push(`campus=${encodeURIComponent(item.campus)}`);
      }

      navigate(
        `/tasks/entry/buildings/${encodeURIComponent(item.building)}/floors?${query.join('&')}`,
      );
    },
    [navigate, selectedTaskId],
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
        <div className="hidden md:block">
          <Steps
            current={0}
            items={[{ title: '选楼栋' }, { title: '选楼层' }, { title: '选房间' }]}
            className="apple-steps"
          />
        </div>

        <div className="glass-panel p-6 shadow-sm border border-black/5 rounded-glass-lg">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <div className="font-bold text-gray-700 text-sm mb-1 ml-1 flex items-center gap-1">
                <CheckCircleOutlined className="text-blue-500" /> 当前查寝任务
              </div>
              <Select
                value={selectedTaskId || undefined}
                onChange={(value) => {
                  setSelectedTaskId(value || '');
                  setAssignedDorms([]);
                }}
                placeholder={ongoingTasksForUser.length ? '请选择查寝任务' : '无进行中任务'}
                disabled={!ongoingTasksForUser.length}
                className="w-full apple-select h-12"
                allowClear
                size="large"
                options={ongoingTasksForUser.map((task) => ({
                  label: task.title || `任务 ${normalizeId(task.id) || '-'}`,
                  value: normalizeId(task.id),
                }))}
              />
            </div>

            <div className="space-y-2">
              <div className="font-bold text-gray-700 text-sm mb-1 ml-1 flex items-center gap-1">
                <SearchOutlined className="text-blue-500" /> 快速过滤楼栋
              </div>
              <Input
                value={search}
                placeholder="输入楼栋名或校区关键词..."
                onChange={(event) => setSearch(event.target.value)}
                disabled={!selectedTaskId}
                prefix={<SearchOutlined className="text-gray-400" />}
                allowClear
                className="apple-search-input h-12 !rounded-xl !bg-gray-100/50 dark:!bg-white/5 border-none"
              />
            </div>
          </div>
        </div>

        <div className="space-y-4" key={selectedTaskId || 'unselected-task'}>
          <div className="flex items-center gap-2 px-2">
            <div className="w-1 h-4 bg-blue-500 rounded-full" />
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest">
              指派范围内的楼栋
            </h3>
          </div>

          {loadingAssigned ? (
            <div className="glass-panel p-12">
              <Skeleton active paragraph={{ rows: 4 }} />
            </div>
          ) : assignedError ? (
            <div className="glass-panel p-8 text-center text-red-500">
              <WarningOutlined className="mb-2 text-2xl" />
              <p>{assignedError}</p>
            </div>
          ) : !selectedTaskId ? (
            <div className="glass-panel p-16 text-center flex flex-col items-center gap-4 opacity-60">
              <div className="w-20 h-20 rounded-full bg-gray-50 flex items-center justify-center border border-dashed border-gray-300">
                <BankOutlined className="text-3xl text-gray-300" />
              </div>
              <div className="space-y-1">
                <p className="text-gray-500 font-bold">待机中</p>
                <p className="text-xs text-gray-400">请上方选择任务以拉取楼栋列表</p>
              </div>
            </div>
          ) : filteredBuildings.length === 0 ? (
            <div className="glass-panel p-20 text-center">
              <Empty description="未发现任何有效的指派楼栋" />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filteredBuildings.map((item) => (
                <div
                  key={`${item.campus || 'default'}-${item.building}`}
                  onClick={() => goToFloors(item)}
                  className="ios-inset-grouped p-6 flex items-center justify-between cursor-pointer active:scale-[0.97] transition-all bg-white dark:bg-zinc-900 border border-black/5 hover:border-blue-500/30 hover:shadow-lg group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-500 flex items-center justify-center group-hover:bg-blue-500 group-hover:text-white transition-all shadow-sm">
                      <BankOutlined className="text-2xl" />
                    </div>
                    <div>
                      <div className="font-bold text-xl text-gray-800 dark:text-white group-hover:text-blue-600 transition-colors">
                        {item.building}
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-gray-400 mt-1 uppercase tracking-tighter">
                        <EnvironmentOutlined />
                        {item.campus || 'Main'}
                      </div>
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <RightOutlined className="text-blue-500 text-xs" />
                  </div>
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
