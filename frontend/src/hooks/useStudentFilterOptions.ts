import { useQuery } from '@tanstack/react-query';
import { studentService } from '../services/studentService';
import { tokenManager } from '../utils/api';
import type { QueryKey } from '@tanstack/react-query';
import type { ServiceRecord } from '../types/service';

interface StudentFilterOptionItem extends ServiceRecord {
  name?: string;
  college?: string;
  major?: string;
}

interface StudentFilterOptionsResponse extends ServiceRecord {
  colleges?: string[];
  majors?: StudentFilterOptionItem[];
  classNames?: StudentFilterOptionItem[];
  grades?: string[];
}

/**
 * 学生筛选选项相关的 Query Keys
 */
export const studentFilterKeys = {
  all: ['student', 'filterOptions'] as const,
  options: (): QueryKey => [...studentFilterKeys.all],
};

/**
 * 获取学生筛选选项的 Hook（学院、专业、班级、年级去重列表）
 * 用于级联筛选器，避免加载全量学生数据
 * @returns {Object} Query 结果，包含 colleges, majors, classNames, grades
 */
export function useStudentFilterOptions() {
  const hasTokens = tokenManager.hasTokens();
  
  return useQuery<StudentFilterOptionsResponse>({
    queryKey: studentFilterKeys.options(),
    queryFn: async () => {
      if (!tokenManager.hasTokens()) {
        return { colleges: [], majors: [], classNames: [], grades: [] };
      }
      return studentService.getFilterOptions() as Promise<StudentFilterOptionsResponse>;
    },
    enabled: hasTokens,
    staleTime: 5 * 60 * 1000, // 缓存 5 分钟
    placeholderData: (previousData) => previousData, // 切换时保留旧数据，避免闪烁
  });
}
