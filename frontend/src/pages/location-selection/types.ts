import type { QueryParams } from '../../types/api';
import type { EntityId, ServiceRecord } from '../../types/service';

export interface SelectionTaskRecord extends ServiceRecord {
  id?: EntityId;
  title?: string;
  status?: string;
  deadline?: string;
  executorIds?: EntityId[];
}

export interface AssignedDormRecord extends ServiceRecord {
  id?: EntityId;
  campus?: string;
  building?: string;
  floor?: string | number;
  roomNo?: string;
}

export interface InspectionDormRecord extends ServiceRecord {
  campus?: string;
  building?: string;
  floor?: string | number;
}

export interface SelectionInspectionRecord extends ServiceRecord {
  dormId?: EntityId;
  taskId?: EntityId;
  totalScore?: number | string | null;
  dorm?: InspectionDormRecord | null;
}

export interface LocationSelectionActions {
  loadTasks?: () => Promise<void>;
  fetchAssignedDorms?: (
    taskId?: EntityId,
    params?: QueryParams,
  ) => Promise<{ dorms?: AssignedDormRecord[]; total?: number }>;
  loadInspections?: (force?: boolean) => Promise<void>;
}
