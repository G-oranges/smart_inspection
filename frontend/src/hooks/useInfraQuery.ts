import { useQuery, useQueryClient } from '@tanstack/react-query';
import { dormService } from '../services/dormService';
import { tokenManager } from '../utils/api';
import type { QueryKey } from '@tanstack/react-query';
import type { ServiceRecord } from '../types/service';

interface BuildingsResponse extends ServiceRecord {
  buildings?: ServiceRecord[];
}

interface FloorsResponse extends ServiceRecord {
  floors?: ServiceRecord[];
}

interface RoomsResponse extends ServiceRecord {
  rooms?: ServiceRecord[];
}

/**
 * 基础架构相关的 Query Keys
 */
export const infraKeys = {
  all: ['infrastructure'] as const,
  buildings: (): QueryKey => [...infraKeys.all, 'buildings'],
  floors: (building?: string): QueryKey => [...infraKeys.all, 'floors', building ?? ''],
  rooms: (building?: string, floor?: number | string): QueryKey => [...infraKeys.all, 'rooms', building ?? '', floor ?? ''],
};

/**
 * 获取楼栋列表的 Hook
 * @returns {Object} Query 结果
 */
export function useBuildings() {
  const hasToken = tokenManager.hasTokens();
  
  return useQuery<BuildingsResponse>({
    queryKey: infraKeys.buildings(),
    queryFn: async () => {
      if (!hasToken) return { buildings: [] };
      return dormService.getBuildings() as Promise<BuildingsResponse>;
    },
    enabled: hasToken,
    staleTime: 5 * 60 * 1000, // 5分钟内不重复请求，与后端 Redis 缓存同步
    placeholderData: (previousData) => previousData, // 切换时保留旧数据，避免闪烁
  });
}

/**
 * 获取指定楼栋的所有楼层
 * @param {string} building - 楼栋名称
 * @returns {Object} Query 结果
 */
export function useFloors(building?: string) {
  const hasToken = tokenManager.hasTokens();
  
  return useQuery<FloorsResponse>({
    queryKey: infraKeys.floors(building),
    queryFn: async () => {
      if (!hasToken || !building) return { floors: [] };
      return dormService.getFloors({ building }) as Promise<FloorsResponse>;
    },
    enabled: hasToken && !!building,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * 获取指定楼栋和楼层的房间
 * @param {string} building - 楼栋名称
 * @param {number} floor - 楼层
 * @returns {Object} Query 结果
 */
export function useRooms(building?: string, floor?: number | string) {
  const hasToken = tokenManager.hasTokens();
  
  return useQuery<RoomsResponse>({
    queryKey: infraKeys.rooms(building, floor),
    queryFn: async () => {
      if (!hasToken || !building) return { rooms: [] };
      return dormService.getRooms({ building, floor }) as Promise<RoomsResponse>;
    },
    enabled: hasToken && !!building,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * 用于手动失效基础架构缓存
 */
export function useInvalidateInfra() {
  const queryClient = useQueryClient();
  
  return {
    invalidateAll: () => queryClient.invalidateQueries({ queryKey: infraKeys.all }),
    invalidateBuildings: () => queryClient.invalidateQueries({ queryKey: infraKeys.buildings() }),
  };
}
