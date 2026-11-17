import type { Dispatch, SetStateAction } from 'react';

import TaskDetailStep from './subforms/TaskDetailStep';
import DormSelectionStep from './subforms/DormSelectionStep';
import ExecutorSelectionStep from './subforms/ExecutorSelectionStep';

import type {
  DormFiltersState,
  TaskDorm,
  TaskExecutor,
  TaskPublishExecutorData,
  TaskPublishFormState,
  TaskPublishUserLookup,
  TaskPublishViewMode,
} from './types';
import type { EntityId } from '../../types/service';

interface TaskPublishFormProps {
  currentStep: number;
  isMobile: boolean;
  form: TaskPublishFormState;
  setForm: Dispatch<SetStateAction<TaskPublishFormState>>;
  dorms: TaskDorm[];
  draftDormFilters: DormFiltersState;
  setDraftDormFilters: Dispatch<SetStateAction<DormFiltersState>>;
  appliedDormFilters: DormFiltersState;
  setAppliedDormFilters: Dispatch<SetStateAction<DormFiltersState>>;
  draftDormSearch: string;
  setDraftDormSearch: Dispatch<SetStateAction<string>>;
  appliedDormSearch: string;
  setAppliedDormSearch: Dispatch<SetStateAction<string>>;
  selectedDormIds: EntityId[];
  setSelectedDormIds: Dispatch<SetStateAction<EntityId[]>>;
  visibleCount: number;
  setVisibleCount: Dispatch<SetStateAction<number>>;
  viewMode: TaskPublishViewMode;
  setViewMode: Dispatch<SetStateAction<TaskPublishViewMode>>;
  mobileFilterOpen: boolean;
  setMobileFilterOpen: Dispatch<SetStateAction<boolean>>;
  executorFilter: { role: string; keyword: string };
  setExecutorFilter: Dispatch<SetStateAction<{ role: string; keyword: string }>>;
  executorPage: number;
  setExecutorPage: Dispatch<SetStateAction<number>>;
  executorData: TaskPublishExecutorData;
  executorLoading: boolean;
  pickerSelection: Set<EntityId>;
  setPickerSelection: Dispatch<SetStateAction<Set<EntityId>>>;
  setSelectedExecutors: Dispatch<SetStateAction<TaskExecutor[]>>;
  executorCache: TaskPublishUserLookup;
  userLookup: TaskPublishUserLookup;
}

export function TaskPublishForm({
  currentStep,
  isMobile,
  form,
  setForm,
  dorms,
  draftDormFilters,
  setDraftDormFilters,
  appliedDormFilters,
  setAppliedDormFilters,
  draftDormSearch,
  setDraftDormSearch,
  appliedDormSearch,
  setAppliedDormSearch,
  selectedDormIds,
  setSelectedDormIds,
  visibleCount,
  setVisibleCount,
  viewMode,
  setViewMode,
  mobileFilterOpen,
  setMobileFilterOpen,
  executorFilter,
  setExecutorFilter,
  executorPage,
  setExecutorPage,
  executorData,
  executorLoading,
  pickerSelection,
  setPickerSelection,
  setSelectedExecutors,
  executorCache,
  userLookup,
}: TaskPublishFormProps) {
  if (currentStep === 0) {
    return <TaskDetailStep isMobile={isMobile} form={form} setForm={setForm} />;
  }

  if (currentStep === 1) {
    return (
      <DormSelectionStep
        isMobile={isMobile}
        dorms={dorms}
        draftDormFilters={draftDormFilters}
        setDraftDormFilters={setDraftDormFilters}
        appliedDormFilters={appliedDormFilters}
        setAppliedDormFilters={setAppliedDormFilters}
        draftDormSearch={draftDormSearch}
        setDraftDormSearch={setDraftDormSearch}
        appliedDormSearch={appliedDormSearch}
        setAppliedDormSearch={setAppliedDormSearch}
        selectedDormIds={selectedDormIds}
        setSelectedDormIds={setSelectedDormIds}
        visibleCount={visibleCount}
        setVisibleCount={setVisibleCount}
        viewMode={viewMode}
        setViewMode={setViewMode}
        mobileFilterOpen={mobileFilterOpen}
        setMobileFilterOpen={setMobileFilterOpen}
      />
    );
  }

  if (currentStep === 2) {
    return (
      <ExecutorSelectionStep
        executorFilter={executorFilter}
        setExecutorFilter={setExecutorFilter}
        executorPage={executorPage}
        setExecutorPage={setExecutorPage}
        executorData={executorData}
        executorLoading={executorLoading}
        pickerSelection={pickerSelection}
        setPickerSelection={setPickerSelection}
        setSelectedExecutors={setSelectedExecutors}
        executorCache={executorCache}
        userLookup={userLookup}
      />
    );
  }

  return null;
}
