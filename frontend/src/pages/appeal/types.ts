import type { Dayjs } from 'dayjs';

import type {
  AppealDeductionItemRow,
  AppealQueryParams,
  AppealRecord,
  AppealStatsResponse,
  AppealStatus,
  EntityId,
} from '../../types/service';

export interface AppealBuildingOption {
  id: number | string;
  name: string;
}

export interface AppealTaskOption {
  id: string;
  title: string;
}

export interface AppealFiltersState {
  status: AppealStatus | '';
  taskId: string;
  buildingId: string;
  dateRange: [Dayjs, Dayjs] | null;
}

export interface AppealColumnConfig {
  fieldKey: string;
  label: string;
  visible: boolean;
  sortable?: boolean;
  order?: number;
  locked?: boolean;
  [key: string]: unknown;
}

export interface UploadedAppealPhotoItem {
  photoId: string;
  previewUrl: string;
  name: string;
}

export interface AppealCreateFormState {
  inspectionId: EntityId | '';
  content: string;
  disputedCodes: string[];
  photos: UploadedAppealPhotoItem[];
}

export interface AppealHandleFormState {
  appealId: string;
  status: 'approved' | 'rejected';
  reply: string;
}

export interface AppealBatchModalState {
  open: boolean;
  status: 'approved' | 'rejected';
  reply: string;
}

export interface AppealStatsProps {
  stats: AppealStatsResponse;
}

export interface AppealDeductionEditorExpose {
  rows: AppealDeductionItemRow[];
  inspectionVersion: string;
}

export type AppealQueryBuilderInput = {
  filters: AppealFiltersState;
  keyword: string;
  page: number;
  pageSize: number;
  sortField: string;
  sortOrder: 'asc' | 'desc';
};

export type AppealListParams = AppealQueryParams;
