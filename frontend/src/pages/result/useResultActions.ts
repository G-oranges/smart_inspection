import { useEffect, useState } from 'react';
import { Modal, message } from 'antd';

import {
  INITIAL_APPEAL_FORM,
  INITIAL_HANDLE_FORM,
} from './resultSchema';
import { confirmDangerCountdown } from '../../utils/confirm';

import type { EntityId, ServiceQueryParams } from '../../types/service';
import type {
  AppealFormState,
  AppealHandleFormState,
  ContactFormState,
  ResultDetailState,
  ResultInspectionRecord,
  UseResultActionsProps,
  UseResultActionsResult,
} from './types';

const INITIAL_DETAIL_STATE: ResultDetailState = {
  open: false,
  inspection: null,
  members: [],
  loading: false,
};

function readErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

export function useResultActions({
  actions,
  canAdjust,
  activeRoleCode,
  permissionsReady,
  appliedFilters,
  filteredInspections,
  clearSelection,
  navigate,
  myProfile,
}: UseResultActionsProps): UseResultActionsResult {
  const [appealForm, setAppealForm] = useState<AppealFormState>(
    INITIAL_APPEAL_FORM as AppealFormState,
  );
  const [handleForm, setHandleForm] = useState<AppealHandleFormState>(
    INITIAL_HANDLE_FORM as AppealHandleFormState,
  );
  const [contactForm, setContactForm] = useState<ContactFormState>({ phone: '' });
  const [detail, setDetail] = useState<ResultDetailState>(INITIAL_DETAIL_STATE);
  const [exporting, setExporting] = useState(false);
  const [contactStatus, setContactStatus] = useState('');

  useEffect(() => {
    const phone = typeof myProfile?.phone === 'string' ? myProfile.phone : '';
    if (phone) {
      setContactForm({ phone });
    }
  }, [myProfile]);

  async function handleOpenDetail(
    inspection: ResultInspectionRecord,
  ): Promise<void> {
    setDetail({
      open: true,
      inspection,
      members: [],
      loading: true,
    });

    if (!inspection.dormId || !actions.fetchDormMembers) {
      setDetail({
        open: true,
        inspection,
        members: [],
        loading: false,
      });
      return;
    }

    try {
      const response = await actions.fetchDormMembers(inspection.dormId);
      setDetail({
        open: true,
        inspection,
        members: response.members || [],
        loading: false,
      });
    } catch {
      setDetail({
        open: true,
        inspection,
        members: [],
        loading: false,
      });
    }
  }

  function handleCloseDetail(): void {
    setDetail(INITIAL_DETAIL_STATE);
  }

  function handleModifyNavigation(inspection: ResultInspectionRecord): void {
    const dorm = inspection.dorm;
    if (!dorm) {
      return;
    }

    const query: string[] = [];
    if (inspection.taskId !== undefined && inspection.taskId !== null) {
      query.push(`taskId=${encodeURIComponent(String(inspection.taskId))}`);
    }
    if (dorm.campus) {
      query.push(`campus=${encodeURIComponent(String(dorm.campus))}`);
    }

    const buildingParam = encodeURIComponent(String(dorm.building || ''));
    const floorParam = encodeURIComponent(
      dorm.floor !== undefined && dorm.floor !== null ? String(dorm.floor) : '',
    );
    const roomParam = encodeURIComponent(String(dorm.roomNo || ''));

    navigate(
      `/tasks/entry/buildings/${buildingParam}/floors/${floorParam}/rooms/${roomParam}${
        query.length ? `?${query.join('&')}` : ''
      }`,
    );
  }

  async function handleContactSubmit(): Promise<void> {
    if (!contactForm.phone) {
      setContactStatus('请填写联系电话');
      return;
    }

    if (!actions.updateMyContact) {
      setContactStatus('联系方式更新不可用');
      return;
    }

    setContactStatus('保存中…');
    try {
      await actions.updateMyContact(contactForm);
      setContactStatus('联系方式已更新');
    } catch (error) {
      setContactStatus(readErrorMessage(error, '更新失败'));
    }
  }

  async function handleAppealSubmit(): Promise<void> {
    if (!appealForm.inspectionId || !appealForm.content || !actions.createAppeal) {
      return;
    }

    try {
      const confirmed = await new Promise<boolean>((resolve) => {
        Modal.confirm({
          title: '确认提交申诉',
          content: '申诉提交后将进入审核流程，确认继续？',
          okText: '确认提交',
          cancelText: '取消',
          maskClosable: false,
          keyboard: false,
          onOk: () => resolve(true),
          onCancel: () => resolve(false),
        });
      });
      if (!confirmed) {
        return;
      }

      await actions.createAppeal(appealForm);
      setAppealForm(INITIAL_APPEAL_FORM as AppealFormState);
      message.success('已提交申诉');
    } catch (error) {
      Modal.error({
        title: '提交失败',
        content: readErrorMessage(error, '提交申诉失败，请稍后再试'),
        className: 'apple-modal',
      });
    }
  }

  async function handleAppealHandle(): Promise<void> {
    if (!handleForm.appealId || !actions.handleAppeal) {
      return;
    }

    try {
      const confirmed = await new Promise<boolean>((resolve) => {
        Modal.confirm({
          title: '确认处理申诉',
          content: '该处理结果将立即生效并通知学生，确认继续？',
          okText: '确认处理',
          cancelText: '取消',
          maskClosable: false,
          keyboard: false,
          onOk: () => resolve(true),
          onCancel: () => resolve(false),
        });
      });
      if (!confirmed) {
        return;
      }

      await actions.handleAppeal(handleForm);
      setHandleForm(INITIAL_HANDLE_FORM as AppealHandleFormState);
      message.success('已处理该申诉');
    } catch (error) {
      Modal.error({
        title: '处理失败',
        content: readErrorMessage(error, '处理失败，请稍后重试。'),
        className: 'apple-modal',
      });
    }
  }

  async function handleExport(): Promise<void> {
    if (!filteredInspections.length || !actions.exportResults) {
      return;
    }

    setExporting(true);
    try {
      const params: ServiceQueryParams = {};
      if (appliedFilters.taskId?.length > 0) {
        params.taskId = appliedFilters.taskId;
      }
      if (appliedFilters.grade?.length > 0) {
        params.grade = appliedFilters.grade;
      }
      if (appliedFilters.gender?.length > 0) {
        params.gender = appliedFilters.gender;
      }
      if (appliedFilters.dateRange && appliedFilters.dateRange.length === 2) {
        params.dateFrom = appliedFilters.dateRange[0].format('YYYY-MM-DD');
        params.dateTo = appliedFilters.dateRange[1].format('YYYY-MM-DD');
      }

      const blob = await actions.exportResults(params);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = '查寝结果导出.xlsx';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      Modal.error({
        title: '导出失败',
        content: readErrorMessage(error, '数据导出出现异常。'),
        className: 'apple-modal',
      });
    } finally {
      setExporting(false);
    }
  }

  async function handleRefresh(): Promise<void> {
    if (!permissionsReady) {
      return;
    }

    if (activeRoleCode === 'STUDENT') {
      await actions.loadMyInspections?.();
      await actions.loadMyAppeals?.();
    } else {
      await actions.loadInspections?.();
      await actions.loadAppeals?.();
    }
    await actions.loadTasks?.();
    await actions.loadDorms?.();
  }

  async function handleDeleteResults(ids: EntityId[]): Promise<void> {
    if (!canAdjust || ids.length === 0) {
      return;
    }

    const isBatch = ids.length > 1;
    const finalConfirmed = await confirmDangerCountdown({
      title: isBatch
        ? `确定删除这 ${ids.length} 条记录吗？`
        : '确定删除这条查寝记录吗？',
      content: isBatch
        ? `即将删除这 ${ids.length} 条查寝记录，删除后无法恢复。`
        : '删除后无法恢复。',
      okText: '删除记录',
    });
    if (!finalConfirmed) {
      return;
    }

    try {
      if (isBatch) {
        await actions.deleteInspections?.(ids);
      } else if (ids[0] !== undefined) {
        await actions.deleteInspection?.(ids[0]);
      }
      clearSelection();
      if (detail.open && detail.inspection?.id !== undefined && ids.includes(detail.inspection.id)) {
        handleCloseDetail();
      }
      message.success('已删除');
    } catch (error) {
      Modal.error({
        title: '删除失败',
        content: readErrorMessage(error, '操作失败，请稍后重试。'),
        className: 'apple-modal',
      });
    }
  }

  return {
    appealForm,
    setAppealForm,
    handleForm,
    setHandleForm,
    contactForm,
    setContactForm,
    contactStatus,
    exporting,
    detail,
    handleOpenDetail,
    handleCloseDetail,
    handleModifyNavigation,
    handleContactSubmit,
    handleAppealSubmit,
    handleAppealHandle,
    handleExport,
    handleRefresh,
    handleDeleteResults,
  };
}
