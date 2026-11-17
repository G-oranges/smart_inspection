import { useCallback } from 'react';

import { teacherService } from '../services/teacherService';
import { tokenManager } from '../utils/api';

import type {
  DeleteByIdsPayload,
  EntityId,
  ServiceQueryParams,
  ServiceRecord,
  ServiceTableResponse,
  UploadResolution,
} from '../types/service';

export function useTeachers() {
  const fetchTeacherTable = useCallback(
    async (params: ServiceQueryParams = {}): Promise<ServiceTableResponse> => {
      if (!tokenManager.hasTokens()) {
        return { items: [], total: 0 };
      }

      return teacherService.fetchTable(params);
    },
    [],
  );

  const createTeacher = useCallback(async (payload: ServiceRecord): Promise<void> => {
    if (!tokenManager.hasTokens()) {
      return;
    }

    await teacherService.create(payload);
  }, []);

  const updateTeacher = useCallback(
    async (id: EntityId, payload: ServiceRecord): Promise<void> => {
      if (!tokenManager.hasTokens()) {
        return;
      }

      await teacherService.update(id, payload);
    },
    [],
  );

  const deleteTeachers = useCallback(
    async (payload: DeleteByIdsPayload = {}): Promise<void> => {
      if (!tokenManager.hasTokens()) {
        return;
      }

      await teacherService.delete(payload);
    },
    [],
  );

  const exportTeachers = useCallback(
    async (params: ServiceQueryParams = {}): Promise<Blob | undefined> => {
      if (!tokenManager.hasTokens()) {
        return undefined;
      }

      return teacherService.export(params);
    },
    [],
  );

  const previewImportTeachers = useCallback(
    async (file: File): Promise<unknown> => {
      if (!tokenManager.hasTokens()) {
        return undefined;
      }

      return teacherService.preview(file);
    },
    [],
  );

  const importTeachers = useCallback(
    async (
      file: File,
      resolution: UploadResolution = 'overwrite',
    ): Promise<unknown> => {
      if (!tokenManager.hasTokens()) {
        return undefined;
      }

      return teacherService.import(file, resolution);
    },
    [],
  );

  return {
    fetchTeacherTable,
    createTeacher,
    updateTeacher,
    deleteTeachers,
    exportTeachers,
    importTeachers,
    previewImportTeachers,
  };
}
