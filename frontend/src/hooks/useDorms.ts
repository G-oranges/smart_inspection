import { useState, useCallback, useRef } from "react";
import { dormService } from "../services/dormService";
import { tokenManager } from "../utils/api";
import type { DeleteByIdsPayload, DormBedsResponse, DormListResponse, EntityId, ServiceQueryParams } from "../types/service";
import type { RequestOptions } from "../types/api";
import type { RoleLike, UserLike } from "../types/app";

type DormRecord = NonNullable<DormListResponse["dormitories"]>[number];
type DormBedRecord = NonNullable<DormBedsResponse["dormBeds"]>[number];

export function useDorms(user?: UserLike | null, activeRole?: RoleLike | null) {
  const [dorms, setDorms] = useState<DormRecord[]>([]);
  const [dormBeds, setDormBeds] = useState<DormBedRecord[]>([]);
  // 使用 ref 追踪加载状态，避免 loaded 翻转导致 callback 重建
  const dormsLoadedRef = useRef(false);
  const dormBedsLoadedRef = useRef(false);

  const fetchDorms = useCallback(
    async (force = false) => {
      if (!tokenManager.hasTokens()) return;
      const currentRole = activeRole?.code || user?.role;
      if (currentRole === "STUDENT") {
        if (!dormsLoadedRef.current || force) {
          setDorms([]);
          dormsLoadedRef.current = true;
        }
        return;
      }
      if (dormsLoadedRef.current && !force) return;
      try {
        const data = await dormService.getDorms();
        setDorms(data.dormitories || []);
        dormsLoadedRef.current = true;
      } catch (err) {
        console.error("Failed to fetch dorms", err);
      }
    },
    [activeRole?.code, user?.role]
  );

  const fetchDormBeds = useCallback(
    async (force = false) => {
      if (!tokenManager.hasTokens()) return;
      const currentRole = activeRole?.code || user?.role;
      if (!currentRole || !["ADMIN", "COUNSELOR", "LEADER"].includes(currentRole)) {
        if (!dormBedsLoadedRef.current || force) {
          setDormBeds([]);
          dormBedsLoadedRef.current = true;
        }
        return;
      }
      if (dormBedsLoadedRef.current && !force) return;
      try {
        const data = await dormService.getDormBeds();
        setDormBeds(data.dormBeds || []);
        dormBedsLoadedRef.current = true;
      } catch (err) {
        console.error("Failed to fetch dorm beds", err);
      }
    },
    [activeRole?.code, user?.role]
  );

  const createDorm = async (payload: unknown) => {
    await dormService.createDorm(payload);
    await Promise.all([fetchDorms(true), fetchDormBeds(true)]);
  };

  const deleteDorms = async (ids?: EntityId[] | DeleteByIdsPayload) => {
    await dormService.deleteDorms(ids);
    await Promise.all([fetchDorms(true), fetchDormBeds(true)]);
  };

  const importDorms = async (file: File, resolution?: string) => {
    const result = await dormService.importDorms(file, resolution);
    await Promise.all([fetchDorms(true), fetchDormBeds(true)]);
    return result;
  };

  const previewImportDorms = async (file: File) => {
    return dormService.previewImportDorms(file);
  };

  return {
    dorms,
    dormBeds,
    fetchDorms,
    fetchDormBeds,
    createDorm,
    deleteDorms,
    importDorms,
    previewImportDorms,
    // Expose service methods that don't affect global state directly
    fetchDormTable: (params?: ServiceQueryParams, options?: RequestOptions) => dormService.getDormTable(params, options),
    exportDorms: (params?: ServiceQueryParams) => dormService.exportDorms(params),
    downloadTemplate: (type: string) => import("../services/templateService").then(m => m.downloadTemplate(type)),
  };
}
