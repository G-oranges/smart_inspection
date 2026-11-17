import { useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { useAppContext } from '../context/AppContext';
import {
  DEFAULT_LOCATION_OPTIONS,
  DeductionDrawer,
  LeaveConfirmModal,
  LocationPickerModal,
  MembersModal,
  ResultEntryLayout,
  ScoreEditModal,
  UploadActionSheetModal,
  useResultEntryActions,
} from './result-entry';

import type { AppActions } from '../types/app';
import type {
  ResultEntryAssignedDormsResponse,
  ResultEntryActions,
  ResultEntryDataStore,
  ResultEntryDormLookupResponse,
  ResultEntryDormMembersResponse,
  ResultEntryInspectionListResponse,
  ResultEntryTask,
  ResultEntryUploadPhotoResponse,
} from './result-entry/types';

function pickResultEntryAction<T extends (...args: never[]) => unknown>(
  source: AppActions,
  key: string,
): T | undefined {
  const value = source[key];
  return typeof value === 'function' ? (value as T) : undefined;
}

function createResultEntryActions(source: AppActions): ResultEntryActions {
  return {
    loadInspectionRecord:
      pickResultEntryAction<NonNullable<ResultEntryActions['loadInspectionRecord']>>(
        source,
        'loadInspectionRecord',
      ) || (async () => ({ inspections: [] } as ResultEntryInspectionListResponse)),
    loadTasks: pickResultEntryAction<NonNullable<ResultEntryActions['loadTasks']>>(
      source,
      'loadTasks',
    ),
    fetchAssignedDorms:
      pickResultEntryAction<NonNullable<ResultEntryActions['fetchAssignedDorms']>>(
        source,
        'fetchAssignedDorms',
      ) || (async () => ({ dorms: [], total: 0 } as ResultEntryAssignedDormsResponse)),
    fetchDormByLocation:
      pickResultEntryAction<NonNullable<ResultEntryActions['fetchDormByLocation']>>(
        source,
        'fetchDormByLocation',
      ) || (async () => ({ dorm: null } as ResultEntryDormLookupResponse)),
    fetchDormMembers:
      pickResultEntryAction<NonNullable<ResultEntryActions['fetchDormMembers']>>(
        source,
        'fetchDormMembers',
      ) || (async () => ({ members: [] } as ResultEntryDormMembersResponse)),
    uploadPhoto:
      pickResultEntryAction<NonNullable<ResultEntryActions['uploadPhoto']>>(
        source,
        'uploadPhoto',
      ) || (async () => ({ url: '' } as ResultEntryUploadPhotoResponse)),
    submitScore:
      pickResultEntryAction<NonNullable<ResultEntryActions['submitScore']>>(
        source,
        'submitScore',
      ) || (async () => undefined),
  };
}

export default function ResultEntryPage() {
  const navigate = useNavigate();
  const {
    building: buildingParam,
    floor: floorParam,
    room: roomParam,
  } = useParams();
  const [searchParams] = useSearchParams();
  const campusParam = searchParams.get('campus') || '';
  const taskIdParam = searchParams.get('taskId') || '';

  const building = buildingParam ? decodeURIComponent(buildingParam) : '';
  const floor = floorParam ? decodeURIComponent(floorParam) : '';
  const room = roomParam ? decodeURIComponent(roomParam) : '';

  const { data, actions, hasPermission, settings, user, activeRole } =
    useAppContext();

  const resultEntryData: ResultEntryDataStore = {
    tasks: Array.isArray(data.tasks) ? (data.tasks as ResultEntryTask[]) : [],
  };
  const resultEntryActions = useMemo(() => createResultEntryActions(actions), [actions]);

  const locationOptions =
    Array.isArray(settings?.locationOptions) && settings.locationOptions.length > 0
      ? settings.locationOptions.filter(
          (value): value is string =>
            typeof value === 'string' && value.trim().length > 0,
        )
      : DEFAULT_LOCATION_OPTIONS;

  const entry = useResultEntryActions({
    building,
    floor,
    room,
    campusParam,
    taskIdParam,
    navigate,
    data: resultEntryData,
    actions: resultEntryActions,
    hasPermission,
    settings,
    user,
    activeRole,
  });

  return (
    <>
      <ResultEntryLayout
        mainRef={entry.mainRef}
        isScrolled={entry.isScrolled}
        onBackToRoomList={entry.handleBackToRoomList}
        prevDorm={entry.prevDorm}
        nextDorm={entry.nextDorm}
        onNavigateToRoom={entry.handleNavigateToRoom}
        room={room}
        building={building}
        scoreColor={entry.scoreColor}
        numericScore={entry.numericScore}
        canRecord={entry.canRecord}
        canSubmit={entry.canSubmit}
        handleSubmit={entry.handleSubmit}
        handleScoreClick={entry.handleScoreClick}
        selectedTask={entry.selectedTask}
        inspectionRecord={entry.inspectionRecord}
        currentRating={entry.currentRating}
        members={entry.members}
        loadingMembers={entry.loadingMembers}
        appliedDeductions={entry.appliedDeductions}
        enabledDeductions={entry.enabledDeductions}
        onOpenEditDrawer={entry.handleOpenEditDrawer}
        onRemoveDeductionRow={entry.handleRemoveDeductionRow}
        onOpenAddDrawer={entry.handleOpenAddDrawer}
        onOpenUploadModal={() => entry.setShowUploadModal(true)}
        form={entry.form}
        setForm={entry.setForm}
        removePhoto={entry.removePhoto}
      />

      <ScoreEditModal
        open={entry.editingScore}
        baseScore={entry.baseScore}
        onChange={entry.handleBaseScoreChange}
        onClose={() => entry.setEditingScore(false)}
      />

      <UploadActionSheetModal
        open={entry.showUploadModal}
        onClose={() => entry.setShowUploadModal(false)}
        onPickCamera={() => {
          entry.setShowUploadModal(false);
          entry.cameraInputRef.current?.click();
        }}
        onPickGallery={() => {
          entry.setShowUploadModal(false);
          entry.galleryInputRef.current?.click();
        }}
      />

      <DeductionDrawer
        open={entry.showAddDeductionDrawer}
        onClose={() => entry.setShowAddDeductionDrawer(false)}
        newDeductionForm={entry.newDeductionForm}
        setNewDeductionForm={entry.setNewDeductionForm}
        enabledDeductions={entry.enabledDeductions}
        appliedDeductions={entry.appliedDeductions}
        settings={settings}
        onToggleLocation={entry.handleToggleNewLocation}
        onConfirm={entry.handleConfirmAddDeduction}
      />

      <LeaveConfirmModal
        open={entry.showLeaveConfirm}
        onCancel={() => entry.setShowLeaveConfirm(false)}
        onConfirm={entry.confirmLeave}
      />

      <MembersModal
        open={entry.showMemberModal}
        members={entry.members}
        loading={entry.loadingMembers}
        onClose={() => entry.setShowMemberModal(false)}
      />

      <LocationPickerModal
        open={Boolean(entry.currentEditingRowId)}
        locations={locationOptions}
        currentEditingRowId={entry.currentEditingRowId}
        appliedDeductions={entry.appliedDeductions}
        onToggleLocation={entry.handleToggleLocation}
        onClose={() => entry.setCurrentEditingRowId(null)}
      />

      <input
        ref={entry.cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(event) => {
          void entry.handlePhotoUpload(event);
        }}
      />
      <input
        ref={entry.galleryInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(event) => {
          void entry.handlePhotoUpload(event);
        }}
      />
    </>
  );
}
