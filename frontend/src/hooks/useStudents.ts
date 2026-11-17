import { useState, useCallback, useRef } from "react";
import { studentService } from "../services/studentService";
import { tokenManager } from "../utils/api";
import type { RequestOptions } from "../types/api";
import type { RoleLike, UserLike } from "../types/app";
import type {
  DeleteByIdsPayload,
  EntityId,
  ServiceQueryParams,
  ServiceRecord,
  StudentProfileResponse,
  StudentsListResponse,
} from "../types/service";

type StudentRecord = NonNullable<StudentsListResponse["students"]>[number];
type StudentProfileRecord = StudentProfileResponse["student"];

export function useStudents(user?: UserLike | null, activeRole?: RoleLike | null) {
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [myProfile, setMyProfile] = useState<StudentProfileRecord>(null);
  // 使用 ref 追踪加载状态，避免 loaded 翻转导致 callback 重建
  const studentsLoadedRef = useRef(false);

  const fetchStudents = useCallback(
    async (force = false) => {
      if (!tokenManager.hasTokens()) return;
      const currentRole = activeRole?.code || user?.role;
      if (!currentRole || !["ADMIN", "COUNSELOR", "LEADER"].includes(currentRole)) {
        if (!studentsLoadedRef.current || force) {
          setStudents([]);
          studentsLoadedRef.current = true;
        }
        return;
      }
      if (studentsLoadedRef.current && !force) return;
      try {
        const data = await studentService.getStudents();
        setStudents(data.students || []);
        studentsLoadedRef.current = true;
      } catch (err) {
        console.error("Failed to fetch students", err);
      }
    },
    [activeRole?.code, user?.role]
  );

  const fetchMyProfile = useCallback(async () => {
    const currentRole = activeRole?.code || user?.role;
    if (currentRole !== "STUDENT") {
      setMyProfile(null);
      return;
    }
    try {
      const data = await studentService.getMyProfile();
      setMyProfile(data.student || null);
    } catch (_) {
      setMyProfile(null);
    }
  }, [activeRole?.code, user?.role]);

  const createStudent = async (payload: ServiceRecord) => {
    await studentService.createStudent(payload);
    await fetchStudents(true);
  };

  const updateStudent = async (id: EntityId, payload: ServiceRecord) => {
    await studentService.updateStudent(id, payload);
    await fetchStudents(true);
  };

  const deleteStudents = async (ids?: EntityId[] | DeleteByIdsPayload) => {
    await studentService.deleteStudents(ids);
    await fetchStudents(true);
  };

  const previewImportStudents = async (file: File) => {
    return await studentService.previewImportStudents(file);
  };

  const importStudents = async (file: File, resolution?: string) => {
    const result = await studentService.importStudents(file, resolution);
    await fetchStudents(true);
    return result;
  };

  const updateMyContact = async (payload: ServiceRecord) => {
    await studentService.updateMyContact(payload);
    await fetchMyProfile();
  };

  return {
    students,
    myProfile,
    fetchStudents,
    fetchMyProfile,
    createStudent,
    updateStudent,
    deleteStudents,
    importStudents,
    previewImportStudents,
    updateMyContact,
    fetchStudentTable: (params?: ServiceQueryParams, options?: RequestOptions) =>
      studentService.getStudentTable(params, options),
    exportStudents: (params?: ServiceQueryParams) => studentService.exportStudents(params),
  };
}
