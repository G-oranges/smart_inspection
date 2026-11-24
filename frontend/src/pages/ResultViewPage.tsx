import type { Dispatch, Key, SetStateAction } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Col, FloatButton, Form, Input, Row, Select, Table } from 'antd';
import PanelSelect from '../components/common/PanelSelect';
import type { ColumnsType } from 'antd/es/table';
import {
  CheckCircleOutlined,
  DashboardOutlined,
  FileSearchOutlined,
  SafetyCertificateOutlined,
  SendOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';

import { useAppContext } from '../context/AppContext';
import PageLayout from '../components/PageLayout';
import PermissionDeniedState from '../components/common/PermissionDeniedState';
import { resultViewPermissionPreset } from '../components/common/permissionDeniedPresets';
import ResponsiveDataView from '../components/ResponsiveDataView';
import AppleStatCard from '../components/common/AppleStatCard';
import CollapsibleStatsBoard, {
  type StatSegment,
} from '../components/stats/CollapsibleStatsBoard';
import { useMobile } from '../hooks/useMobile';
import { useResultTableState } from '../hooks/useResultTableState';
import { useBulkSelection } from '../hooks/useBulkSelection';
import { useTableFetch } from '../hooks/useTableFetch';
import { gradeLabelFromRules } from '../utils/settings';
import {
  createActionColumn,
  createBaseColumns,
  ResultActionSheet,
  ResultDetailModal,
  ResultFilters,
  ResultMobileCard,
  useResultActions,
} from './result';

import type { EntityId, ServiceRecord } from '../types/service';
import type { PaginationState } from '../types/table';
import type {
  RatingForScore,
  ResultAppealRecord,
  ResultDormBedRecord,
  ResultFiltersState,
  ResultInspectionRecord,
  ResultPageActions,
  ResultPageData,
  ResultTaskRecord,
} from './result/types';

const { Option } = Select;

interface ResultStatsProps {
  inspections: ResultInspectionRecord[];
  appeals: ResultAppealRecord[];
  totalCount: number;
}

interface ResultAuxiliaryPanelsProps {
  activeRoleCode?: string;
  inspections: ResultInspectionRecord[];
  appeals: ResultAppealRecord[];
  appealForm: { inspectionId: EntityId | ''; content: string };
  setAppealForm: Dispatch<
    SetStateAction<{ inspectionId: EntityId | ''; content: string }>
  >;
  handleAppealSubmit: () => Promise<void>;
  handleForm: { appealId: EntityId | ''; status: string; reply: string };
  setHandleForm: Dispatch<
    SetStateAction<{ appealId: EntityId | ''; status: string; reply: string }>
  >;
  handleAppealHandle: () => Promise<void>;
}

interface ResultListSectionProps {
  isMobile: boolean;
  filteredInspections: ResultInspectionRecord[];
  selectedResultIds: EntityId[];
  setSelectedResultIds: Dispatch<SetStateAction<EntityId[]>>;
  pagination: PaginationState;
  setPagination: Dispatch<SetStateAction<PaginationState>>;
  totalCount: number;
  ratingForScore: RatingForScore;
  canAdjust: boolean;
  tableColumns: ColumnsType<ResultInspectionRecord>;
  lastRefreshedAt: string;
}

interface ResultViewContentProps {
  activeRoleCode?: string;
  allAppeals: ResultAppealRecord[];
  allInspections: ResultInspectionRecord[];
  appeals: ResultAppealRecord[];
  appealForm: { inspectionId: EntityId | ''; content: string };
  canAdjust: boolean;
  draftFilters: ResultFiltersState;
  exporting: boolean;
  filteredInspections: ResultInspectionRecord[];
  gradeOptions: string[];
  collegeOptions: string[];
  handleAppealHandle: () => Promise<void>;
  handleAppealSubmit: () => Promise<void>;
  handleDeleteResults: (ids: EntityId[]) => Promise<void>;
  handleExport?: () => Promise<void>;
  handleForm: { appealId: EntityId | ''; status: string; reply: string };
  handleRefresh: () => Promise<void>;
  handleResetFilters: () => void;
  handleSearch: () => void;
  inspections: ResultInspectionRecord[];
  isDirty: boolean;
  isMobile: boolean;
  lastRefreshedAt: string;
  levelOptions: string[];
  pageTasks?: ResultTaskRecord[];
  pagination: PaginationState;
  ratingForScore: RatingForScore;
  selectedResultIds: EntityId[];
  setAppealForm: Dispatch<
    SetStateAction<{ inspectionId: EntityId | ''; content: string }>
  >;
  setDraftFilters: Dispatch<SetStateAction<ResultFiltersState>>;
  setHandleForm: Dispatch<
    SetStateAction<{ appealId: EntityId | ''; status: string; reply: string }>
  >;
  setPagination: Dispatch<SetStateAction<PaginationState>>;
  setSelectedResultIds: Dispatch<SetStateAction<EntityId[]>>;
  showAuxPanels: boolean;
  tableColumns: ColumnsType<ResultInspectionRecord>;
  totalCount: number;
}

interface ResultViewOverlaysProps {
  actionSheetOpen: boolean;
  activeRoleCode?: string;
  canAdjust: boolean;
  detail: ReturnType<typeof useResultActions>['detail'];
  filteredInspections: ResultInspectionRecord[];
  handleCloseDetail: () => void;
  handleDeleteResults: (ids: EntityId[]) => Promise<void>;
  handleModifyNavigation: (inspection: ResultInspectionRecord) => void;
  handleOpenDetail: (inspection: ResultInspectionRecord) => Promise<void>;
  handleSelectAppealInspection: (inspectionId: EntityId) => void;
  isMobile: boolean;
  ratingForScore: RatingForScore;
  selectedResultIds: EntityId[];
  setActionSheetOpen: Dispatch<SetStateAction<boolean>>;
  settings: ReturnType<typeof useAppContext>['settings'];
}

function toArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function formatRefreshTime(): string {
  return new Date().toLocaleTimeString();
}

function ResultStats({ inspections, appeals, totalCount }: ResultStatsProps) {
  const today = dayjs().startOf('day');
  const todayCount = inspections.filter((inspection) => {
    if (!inspection.createdAt) {
      return false;
    }
    return dayjs(inspection.createdAt).isAfter(today);
  }).length;
  const pendingAppeals = appeals.filter((appeal) => appeal.status === 'pending').length;
  const avgScore =
    inspections.length > 0
      ? (
          inspections.reduce((total, inspection) => total + (inspection.totalScore || 0), 0) /
          inspections.length
        ).toFixed(1)
      : 0;

  return (
    <>
      <Col xs={12} sm={12} md={6}>
        <AppleStatCard
          icon={<FileSearchOutlined />}
          value={totalCount}
          label="累计查寝记录"
          dotColor="blue"
        />
      </Col>
      <Col xs={12} sm={12} md={6}>
        <AppleStatCard
          icon={<DashboardOutlined />}
          value={todayCount}
          label="今日新增"
          unit="份"
          dotColor="green"
        />
      </Col>
      <Col xs={12} sm={12} md={6}>
        <AppleStatCard
          icon={<SafetyCertificateOutlined />}
          value={avgScore}
          label="平均得分"
          unit="分"
          dotColor="orange"
        />
      </Col>
      <Col xs={12} sm={12} md={6}>
        <AppleStatCard
          icon={<WarningOutlined />}
          value={pendingAppeals}
          label="待处理申诉"
          unit="条"
          dotColor="purple"
        />
      </Col>
    </>
  );
}

function mapResultStatsToSegments(
  inspections: ResultInspectionRecord[],
  appeals: ResultAppealRecord[],
  totalCount: number,
): StatSegment[] {
  const today = dayjs().startOf('day');
  const todayCount = inspections.filter((inspection) => {
    if (!inspection.createdAt) {
      return false;
    }
    return dayjs(inspection.createdAt).isAfter(today);
  }).length;
  const pendingAppeals = appeals.filter((appeal) => appeal.status === 'pending').length;
  const avgScore =
    inspections.length > 0
      ? (
          inspections.reduce((total, inspection) => total + (inspection.totalScore || 0), 0) /
          inspections.length
        ).toFixed(1)
      : 0;

  return [
    {
      id: 'result-total',
      icon: <FileSearchOutlined />,
      value: totalCount,
      label: '记录',
      tone: 'blue',
    },
    {
      id: 'result-today',
      icon: <DashboardOutlined />,
      value: todayCount,
      label: '今日',
      unit: '份',
      tone: 'green',
    },
    {
      id: 'result-average',
      icon: <SafetyCertificateOutlined />,
      value: avgScore,
      label: '平均分',
      unit: '分',
      tone: 'orange',
    },
    {
      id: 'result-appeals',
      icon: <WarningOutlined />,
      value: pendingAppeals,
      label: '待申诉',
      unit: '条',
      tone: 'purple',
    },
  ];
}

function ResultAuxiliaryPanels({
  activeRoleCode,
  inspections,
  appeals,
  appealForm,
  setAppealForm,
  handleAppealSubmit,
  handleForm,
  setHandleForm,
  handleAppealHandle,
}: ResultAuxiliaryPanelsProps) {
  const showAppealPanel = activeRoleCode === 'STUDENT' && inspections.length > 0;
  const showReviewPanel = appeals.length > 0;

  if (!showAppealPanel && !showReviewPanel) {
    return null;
  }

  return (
    <div className="space-y-6">
      {showAppealPanel ? (
        <div
          id="appeal-section"
          className="glass-panel p-6 rounded-3xl shadow-sm border border-black/5"
        >
          <div className="flex items-center gap-2 mb-6">
            <div className="w-1.5 h-6 bg-purple-500 rounded-full" />
            <h3 className="text-lg font-bold">提交异常申诉</h3>
          </div>
          <Form
            layout="vertical"
            onFinish={() => {
              void handleAppealSubmit();
            }}
          >
            <Row gutter={24}>
              <Col xs={24} md={8}>
                <Form.Item label="选择查寝记录" required className="apple-form-item">
                  <PanelSelect
                    value={appealForm.inspectionId}
                    onChange={(inspectionId: EntityId) =>
                      setAppealForm((prev) => ({ ...prev, inspectionId }))
                    }
                    placeholder="请选择需要申诉的记录"
                    className="apple-select"
                  >
                    {inspections.map((item) => (
                      <Option key={String(item.id)} value={item.id}>
                        {item.task?.title || item.id} ({item.totalScore}分)
                      </Option>
                    ))}
                  </PanelSelect>
                </Form.Item>
              </Col>
              <Col xs={24} md={16}>
                <Form.Item label="申诉原因描述" required className="apple-form-item">
                  <div className="flex gap-2">
                    <Input
                      className="apple-input !rounded-xl flex-1"
                      value={appealForm.content}
                      onChange={(event) =>
                        setAppealForm((prev) => ({
                          ...prev,
                          content: event.target.value,
                        }))
                      }
                      placeholder="请客观描述您的申诉理由及证明..."
                    />
                    <Button
                      type="primary"
                      htmlType="submit"
                      icon={<SendOutlined />}
                      className="apple-btn-primary"
                    >
                      发送
                    </Button>
                  </div>
                </Form.Item>
              </Col>
            </Row>
          </Form>
        </div>
      ) : null}

      {showReviewPanel ? (
        <div
          id="appeal-review-section"
          className="glass-panel p-6 rounded-3xl shadow-sm border border-black/5"
        >
          <div className="flex items-center gap-2 mb-6">
            <div className="w-1.5 h-6 bg-red-500 rounded-full" />
            <h3 className="text-lg font-bold">待处理申诉队列</h3>
          </div>
          <Form
            layout="vertical"
            onFinish={() => {
              void handleAppealHandle();
            }}
          >
            <Row gutter={24}>
              <Col xs={24} md={6}>
                <Form.Item label="申诉事项" required className="apple-form-item">
                  <PanelSelect
                    value={handleForm.appealId}
                    onChange={(appealId: EntityId) =>
                      setHandleForm((prev) => ({ ...prev, appealId }))
                    }
                    placeholder="待处理申诉"
                    className="apple-select"
                  >
                    {appeals
                      .filter((appeal) => appeal.status === 'pending')
                      .map((appeal) => (
                        <Option key={String(appeal.id)} value={appeal.id}>
                          {appeal.studentName || '佚名'} - {dayjs(appeal.createdAt).format('MM-DD')}
                        </Option>
                      ))}
                  </PanelSelect>
                </Form.Item>
              </Col>
              <Col xs={12} md={4}>
                <Form.Item label="审核决策" className="apple-form-item">
                  <PanelSelect
                    value={handleForm.status}
                    onChange={(status: string) =>
                      setHandleForm((prev) => ({ ...prev, status }))
                    }
                    className="apple-select"
                  >
                    <Option value="approved">予以通过 (修正分值)</Option>
                    <Option value="rejected">驳回申请 (维持原判)</Option>
                  </PanelSelect>
                </Form.Item>
              </Col>
              <Col xs={24} md={14}>
                <Form.Item label="回复学生" className="apple-form-item">
                  <div className="flex gap-2">
                    <Input
                      className="apple-input !rounded-xl flex-1"
                      value={handleForm.reply}
                      onChange={(event) =>
                        setHandleForm((prev) => ({
                          ...prev,
                          reply: event.target.value,
                        }))
                      }
                      placeholder="请在此输入针对该申诉的回复结论..."
                    />
                    <Button
                      type="primary"
                      htmlType="submit"
                      icon={<CheckCircleOutlined />}
                      className="apple-btn-primary"
                    >
                      执行
                    </Button>
                  </div>
                </Form.Item>
              </Col>
            </Row>
          </Form>
        </div>
      ) : null}
    </div>
  );
}

function ResultListSection({
  isMobile,
  filteredInspections,
  selectedResultIds,
  setSelectedResultIds,
  pagination,
  setPagination,
  totalCount,
  ratingForScore,
  canAdjust,
  tableColumns,
  lastRefreshedAt,
}: ResultListSectionProps) {
  return (
    <div className="space-y-4">
      <div className="table-head dorm-table-head mb-4">
        <div className="flex items-center gap-2">
          <div className="dorm-table-head-accent" />
          <h3 className="dorm-table-head-title">查寝结果列表</h3>
          <span className="dorm-table-head-time">最后更新: {lastRefreshedAt}</span>
        </div>
      </div>

      <div className={`table-wrapper${isMobile ? '' : ' dorm-table-wrapper'}`}>
        {isMobile ? (
          <ResponsiveDataView<ResultInspectionRecord>
            isMobile={true}
            dataSource={filteredInspections}
            loading={false}
            rowKey="id"
            emptyText="暂无查寝记录"
            selectedKeys={selectedResultIds}
            onSelectChange={(keys: Key[]) => setSelectedResultIds(keys as EntityId[])}
            pagination={{
              current: pagination.current,
              pageSize: pagination.pageSize,
              total: totalCount,
            }}
            onPaginationChange={(page: number, size?: number) =>
              setPagination((prev) => ({
                ...prev,
                current: page,
                pageSize: size || prev.pageSize,
              }))
            }
            renderCard={(
              record: ResultInspectionRecord,
              _index: number,
              options: { selected: boolean; onSelect?: (selected: boolean) => void },
            ) => (
              <ResultMobileCard
                record={record}
                selected={options.selected}
                onSelect={options.onSelect}
                ratingForScore={ratingForScore}
              />
            )}
          />
        ) : (
          <Table<ResultInspectionRecord>
            dataSource={filteredInspections}
            rowKey="id"
            rowSelection={
              canAdjust
                ? {
                    selectedRowKeys: selectedResultIds,
                    onChange: (keys) => setSelectedResultIds(keys as EntityId[]),
                    preserveSelectedRowKeys: true,
                  }
                : undefined
            }
            pagination={{
              ...pagination,
              total: totalCount,
              onChange: (page, size) =>
                setPagination((prev) => ({
                  ...prev,
                  current: page,
                  pageSize: size || prev.pageSize,
                })),
            }}
            className="dorm-table"
            scroll={{ x: 'max-content' }}
            columns={tableColumns}
          />
        )}
      </div>
    </div>
  );
}

function ResultViewLoadingState() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
    </div>
  );
}

function ResultViewAccessDenied({ navigateHome }: { navigateHome: () => void }) {
  return (
    <PermissionDeniedState
      {...resultViewPermissionPreset}
      actionText="返回首页"
      onAction={navigateHome}
    />
  );
}

function ResultViewContent({
  activeRoleCode,
  allAppeals,
  allInspections,
  appeals,
  appealForm,
  canAdjust,
  collegeOptions,
  draftFilters,
  exporting,
  filteredInspections,
  gradeOptions,
  handleAppealHandle,
  handleAppealSubmit,
  handleDeleteResults,
  handleExport,
  handleForm,
  handleRefresh,
  handleResetFilters,
  handleSearch,
  inspections,
  isDirty,
  isMobile,
  lastRefreshedAt,
  levelOptions,
  pageTasks,
  pagination,
  ratingForScore,
  selectedResultIds,
  setAppealForm,
  setDraftFilters,
  setHandleForm,
  setPagination,
  setSelectedResultIds,
  showAuxPanels,
  tableColumns,
  totalCount,
}: ResultViewContentProps) {
  const listSection = (
    <ResultListSection
      isMobile={isMobile}
      filteredInspections={filteredInspections}
      selectedResultIds={selectedResultIds}
      setSelectedResultIds={setSelectedResultIds}
      pagination={pagination}
      setPagination={setPagination}
      totalCount={totalCount}
      ratingForScore={ratingForScore}
      canAdjust={canAdjust}
      tableColumns={tableColumns}
      lastRefreshedAt={lastRefreshedAt}
    />
  );

  const auxiliaryPanels = (
    <ResultAuxiliaryPanels
      activeRoleCode={activeRoleCode}
      inspections={inspections}
      appeals={canAdjust ? appeals : []}
      appealForm={appealForm}
      setAppealForm={setAppealForm}
      handleAppealSubmit={handleAppealSubmit}
      handleForm={handleForm}
      setHandleForm={setHandleForm}
      handleAppealHandle={handleAppealHandle}
    />
  );

  return (
    <div className="result-view-page management-theme-page">
      <PageLayout
        statsLayout="custom"
        stats={
          <CollapsibleStatsBoard
            expandedContent={
              <ResultStats
                inspections={allInspections}
                appeals={allAppeals}
                totalCount={totalCount}
              />
            }
            segments={mapResultStatsToSegments(
              allInspections,
              allAppeals,
              totalCount,
            )}
          />
        }
        filters={
          <ResultFilters
            isMobile={isMobile}
            tasks={pageTasks}
            gradeOptions={gradeOptions}
            collegeOptions={collegeOptions}
            levelOptions={levelOptions}
            draftFilters={draftFilters}
            setDraftFilters={setDraftFilters}
            isDirty={isDirty}
            handleSearch={handleSearch}
            handleResetFilters={handleResetFilters}
            handleRefresh={() => {
              void handleRefresh();
            }}
            handleExport={
              handleExport
                ? () => {
                    void handleExport();
                  }
                : undefined
            }
            exporting={exporting}
            totalCount={totalCount}
            canAdjust={canAdjust}
            selectedResultIds={selectedResultIds}
            handleDeleteResults={(ids: EntityId[]) => {
              void handleDeleteResults(ids);
            }}
          />
        }
      >
        {showAuxPanels && !isMobile ? (
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-6 items-start">
            {listSection}
            {auxiliaryPanels}
          </div>
        ) : (
          <div className="space-y-8">
            {listSection}
            {auxiliaryPanels}
          </div>
        )}
      </PageLayout>
    </div>
  );
}

function ResultViewOverlays({
  actionSheetOpen,
  activeRoleCode,
  canAdjust,
  detail,
  filteredInspections,
  handleCloseDetail,
  handleDeleteResults,
  handleModifyNavigation,
  handleOpenDetail,
  handleSelectAppealInspection,
  isMobile,
  ratingForScore,
  selectedResultIds,
  setActionSheetOpen,
  settings,
}: ResultViewOverlaysProps) {
  return (
    <>
      <ResultDetailModal
        detail={detail}
        canAdjust={canAdjust}
        isMobile={isMobile}
        settings={settings}
        ratingForScore={ratingForScore}
        onClose={handleCloseDetail}
        onModify={handleModifyNavigation}
      />

      {isMobile ? (
        <>
          <FloatButton.BackTop
            style={{
              right: 24,
              bottom: selectedResultIds.length > 0 ? 100 : 80,
            }}
          />
          <ResultActionSheet
            open={actionSheetOpen}
            onClose={() => setActionSheetOpen(false)}
            selectedIds={selectedResultIds}
            filteredInspections={filteredInspections}
            canAdjust={canAdjust}
            activeRoleCode={activeRoleCode}
            onOpenDetail={(inspection: ResultInspectionRecord) => {
              void handleOpenDetail(inspection);
            }}
            onDeleteResults={(ids: EntityId[]) => {
              void handleDeleteResults(ids);
            }}
            onSelectAppealInspection={handleSelectAppealInspection}
          />
        </>
      ) : null}
    </>
  );
}

interface ResultInspectionDataParams {
  activeRoleCode?: string;
  appliedFilters: ResultFiltersState;
  pageData: ResultPageData;
  ratingForScore: RatingForScore;
  settings: ReturnType<typeof useAppContext>['settings'];
}

function useResultInspectionData({
  activeRoleCode,
  appliedFilters,
  pageData,
  ratingForScore,
  settings,
}: ResultInspectionDataParams) {
  const allInspections = toArray<ResultInspectionRecord>(pageData.inspections);
  const inspections = useMemo(
    () =>
      activeRoleCode === 'STUDENT'
        ? toArray<ResultInspectionRecord>(pageData.myInspections)
        : allInspections,
    [activeRoleCode, allInspections, pageData.myInspections],
  );
  const allAppeals = toArray<ResultAppealRecord>(pageData.appeals);
  const appeals = useMemo(
    () =>
      activeRoleCode === 'STUDENT'
        ? toArray<ResultAppealRecord>(pageData.myAppeals)
        : allAppeals,
    [activeRoleCode, allAppeals, pageData.myAppeals],
  );

  const dormBedMap = useMemo(() => {
    const map = new Map<EntityId, ResultDormBedRecord[]>();
    toArray<ResultDormBedRecord>(pageData.dormBeds).forEach((bed) => {
      const dormId = bed.dormId || bed.dorm?.id;
      if (dormId === undefined || dormId === null) {
        return;
      }
      const cachedBeds = map.get(dormId) || [];
      cachedBeds.push(bed);
      map.set(dormId, cachedBeds);
    });
    return map;
  }, [pageData.dormBeds]);

  const decoratedInspections = useMemo<ResultInspectionRecord[]>(() => {
    const tasks = toArray<ServiceRecord>(pageData.tasks);
    const dorms = toArray<ServiceRecord>(pageData.dorms);

    return inspections.map((record) => {
      const task = tasks.find((item) => item.id === record.taskId) || record.task || null;
      const dorm = dorms.find((item) => item.id === record.dormId) || record.dorm || null;
      return {
        ...record,
        task: task as ResultInspectionRecord['task'],
        dorm: dorm as ResultInspectionRecord['dorm'],
      };
    });
  }, [inspections, pageData.dorms, pageData.tasks]);

  const resolveDormBeds = useCallback(
    (record: ResultInspectionRecord): ResultDormBedRecord[] => {
      const dorm = record.dorm;
      if (!dorm) {
        return [];
      }

      const beds = dorm.beds || dorm.dormBeds;
      if (Array.isArray(beds) && beds.length > 0) {
        return beds;
      }

      const dormId = dorm.id || record.dormId;
      if (dormId === undefined || dormId === null) {
        return [];
      }
      return dormBedMap.get(dormId) || [];
    },
    [dormBedMap],
  );

  const resolveDormColleges = useCallback(
    (record: ResultInspectionRecord): string[] => {
      if (Array.isArray(record.dormColleges) && record.dormColleges.length > 0) {
        return record.dormColleges;
      }

      const colleges = resolveDormBeds(record)
        .map((bed) => bed.college || bed.student?.college)
        .filter((value): value is string => Boolean(value));
      return [...new Set(colleges)];
    },
    [resolveDormBeds],
  );

  const resolveDormGrades = useCallback(
    (record: ResultInspectionRecord): string[] => {
      if (Array.isArray(record.dormGrades) && record.dormGrades.length > 0) {
        return record.dormGrades;
      }

      const studentGrades = resolveDormBeds(record)
        .map((bed) => bed.grade || bed.student?.grade)
        .filter((value): value is string => Boolean(value));
      if (studentGrades.length > 0) {
        return [...new Set(studentGrades)];
      }
      if (record.dorm?.grade) {
        return [record.dorm.grade];
      }
      return [];
    },
    [resolveDormBeds],
  );

  const gradeOptions = useMemo(
    () =>
      Array.from(
        new Set(
          decoratedInspections.flatMap((record) => resolveDormGrades(record)),
        ),
      ).sort((left, right) => left.localeCompare(right, 'zh-CN')),
    [decoratedInspections, resolveDormGrades],
  );

  const collegeOptions = useMemo(
    () =>
      Array.from(
        new Set(
          decoratedInspections.flatMap((record) => resolveDormColleges(record)),
        ),
      ).sort((left, right) => left.localeCompare(right, 'zh-CN')),
    [decoratedInspections, resolveDormColleges],
  );

  const levelOptions = useMemo(
    () => settings?.gradingRules?.map((rule) => rule.label).filter(Boolean) || [],
    [settings?.gradingRules],
  );

  const filteredInspections = useMemo(() => {
    return decoratedInspections
      .filter((record) => {
        if (appliedFilters.keyword?.trim()) {
          const keyword = appliedFilters.keyword.trim().toLowerCase();
          const building = record.dorm?.building?.trim();
          const roomNo = record.dorm?.roomNo?.trim();
          const combinedDormLabels =
            building && roomNo
              ? [`${building}-${roomNo}`, `${building}${roomNo}`]
              : [];
          const keywordTargets = [
            record.task?.title,
            building,
            roomNo,
            ...combinedDormLabels,
            record.recordedByName,
            record.reviewedBy?.fullName,
            record.createdBy?.fullName,
            record.comments,
            ...resolveDormColleges(record),
            ...resolveDormGrades(record),
          ]
            .filter((value): value is string => Boolean(value))
            .join(" ")
            .toLowerCase();

          if (!keywordTargets.includes(keyword)) {
            return false;
          }
        }
        if (
          appliedFilters.taskId?.length > 0 &&
          !appliedFilters.taskId.includes(record.taskId as EntityId)
        ) {
          return false;
        }
        if (appliedFilters.grade?.length > 0) {
          const dormGrades = resolveDormGrades(record);
          if (!dormGrades.some((grade) => appliedFilters.grade.includes(grade))) {
            return false;
          }
        }
        if (appliedFilters.college?.length > 0) {
          const dormColleges = resolveDormColleges(record);
          if (!dormColleges.some((college) => appliedFilters.college.includes(college))) {
            return false;
          }
        }
        if (
          appliedFilters.level?.length > 0 &&
          !appliedFilters.level.includes(ratingForScore(record.totalScore))
        ) {
          return false;
        }
        if (
          appliedFilters.gender?.length > 0 &&
          !appliedFilters.gender.includes(String(record.dorm?.gender || ''))
        ) {
          return false;
        }
        if (appliedFilters.dateRange && appliedFilters.dateRange.length === 2) {
          const [start, end] = appliedFilters.dateRange;
          if (record.task?.date) {
            const taskDate = dayjs(record.task.date);
            if (taskDate.isBefore(start, 'day') || taskDate.isAfter(end, 'day')) {
              return false;
            }
          } else if (record.createdAt) {
            const createDate = dayjs(record.createdAt);
            if (createDate.isBefore(start, 'day') || createDate.isAfter(end, 'day')) {
              return false;
            }
          }
        }
        return true;
      })
      .sort((left, right) => {
        if (
          appliedFilters.sort === 'time_desc' ||
          appliedFilters.sort === 'time_asc'
        ) {
          const timeLeft = left.createdAt ? new Date(left.createdAt).getTime() : 0;
          const timeRight = right.createdAt ? new Date(right.createdAt).getTime() : 0;
          return appliedFilters.sort === 'time_asc'
            ? timeLeft - timeRight
            : timeRight - timeLeft;
        }

        const scoreLeft = left.totalScore ?? -Infinity;
        const scoreRight = right.totalScore ?? -Infinity;
        return appliedFilters.sort === 'score_asc'
          ? scoreLeft - scoreRight
          : scoreRight - scoreLeft;
      });
  }, [
    appliedFilters,
    decoratedInspections,
    ratingForScore,
    resolveDormColleges,
    resolveDormGrades,
  ]);

  return {
    allAppeals,
    allInspections,
    appeals,
    collegeOptions,
    filteredInspections,
    gradeOptions,
    inspections,
    levelOptions,
    resolveDormColleges,
    resolveDormGrades,
  };
}

// Page-level orchestrator coordinates result filters, detail state, and side panels.
export default function ResultViewPage() {
  const {
    data,
    actions,
    hasPermission,
    settings,
    myProfile,
    activeRole,
    permissionsReady,
    setSelection,
  } = useAppContext();
  const pageData = data as ResultPageData;
  const pageActions = actions as ResultPageActions;
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isMobile = useMobile();

  const {
    selectedIds: selectedResultIds,
    setSelectedIds: setSelectedResultIds,
    clearSelection,
  } = useBulkSelection<EntityId>();

  const {
    draftFilters,
    appliedFilters,
    pagination,
    isDirty,
    setDraftFilters,
    setPagination,
    applyFilters: handleSearch,
    resetAll: handleResetFilters,
  } = useResultTableState({
    defaultPageSize: 10,
    syncUrl: true,
    onApply: clearSelection,
    onReset: clearSelection,
  });

  const [lastRefreshedAt, setLastRefreshedAt] = useState(formatRefreshTime);
  const [actionSheetOpen, setActionSheetOpen] = useState(false);

  const canView = hasPermission('RESULT_VIEW');
  const canAdjust = hasPermission('RESULT_RECORD');
  // 导出与查看分开授权：只有拥有 RESULT_EXPORT 的角色才显示导出按钮
  const canExport = hasPermission('RESULT_EXPORT');
  const canEditContact = Boolean(settings?.studentContactEditable);

  const ratingForScore = useMemo<RatingForScore>(
    () => (score) =>
      gradeLabelFromRules(
        score,
        settings?.gradingRules as Parameters<typeof gradeLabelFromRules>[1],
      ),
    [settings?.gradingRules],
  );

  const fetchResultData = useCallback(async () => {
    await pageActions.loadTasks?.();
    await pageActions.loadDorms?.();

    if (canView) {
      await pageActions.loadInspections?.();
      await pageActions.loadAppeals?.();
    }

    if (activeRole?.code === 'STUDENT') {
      await pageActions.loadMyInspections?.();
      await pageActions.loadMyAppeals?.();
    }

    return { items: [], total: 0 };
  }, [activeRole?.code, canView, pageActions]);

  useTableFetch({
    fetchFn: fetchResultData,
    buildParams: () => ({}),
    enabled: permissionsReady,
    deps: [activeRole?.code, canView],
  });

  useEffect(() => {
    if (!isMobile) {
      return;
    }

    setSelection({
      count: selectedResultIds.length,
      onClear: clearSelection,
      onAction: () => setActionSheetOpen(true),
      actionLabel: '操作',
    });
  }, [clearSelection, isMobile, selectedResultIds.length, setSelection]);

  const {
    allAppeals,
    allInspections,
    appeals,
    collegeOptions,
    filteredInspections,
    gradeOptions,
    inspections,
    levelOptions,
    resolveDormColleges,
    resolveDormGrades,
  } = useResultInspectionData({
    activeRoleCode: activeRole?.code,
    appliedFilters,
    pageData,
    ratingForScore,
    settings,
  });

  useEffect(() => {
    if (!permissionsReady) {
      return;
    }

    setLastRefreshedAt(formatRefreshTime());
  }, [inspections, permissionsReady]);

  const {
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
  } = useResultActions({
    actions: pageActions,
    canAdjust,
    activeRoleCode: activeRole?.code,
    permissionsReady,
    appliedFilters: appliedFilters as ResultFiltersState,
    filteredInspections,
    clearSelection,
    navigate,
    setLastRefreshedAt,
    myProfile,
  });

  const handleSelectAppealInspection = useCallback(
    (inspectionId: EntityId) => {
      setAppealForm((prev) => ({ ...prev, inspectionId }));
    },
    [setAppealForm],
  );

  useEffect(() => {
    const appealId = searchParams.get('appealId');
    const focus = searchParams.get('focus');
    if (!appealId && focus !== 'appeals') {
      return;
    }

    if (appealId && appeals.some((item) => String(item.id) === appealId)) {
      setHandleForm((prev) => ({ ...prev, appealId }));
    }

    const target =
      document.getElementById('appeal-review-section') ||
      document.getElementById('appeal-section');
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete('appealId');
      nextParams.delete('focus');
      setSearchParams(nextParams, { replace: true });
    }
  }, [appeals, searchParams, setHandleForm, setSearchParams]);

  const totalCount = filteredInspections.length;
  const showAuxPanels =
    (activeRole?.code === 'STUDENT' && inspections.length > 0) ||
    (canAdjust && appeals.length > 0);

  const baseColumns = useMemo(
    () =>
      createBaseColumns({
        resolveDormColleges,
        resolveDormGrades,
        ratingForScore,
      }),
    [ratingForScore, resolveDormColleges, resolveDormGrades],
  );
  const tableColumns = useMemo(
    () => [
      ...baseColumns,
      createActionColumn({
        canAdjust,
        onOpenDetail: handleOpenDetail,
        onDelete: handleDeleteResults,
      }),
    ],
    [baseColumns, canAdjust, handleDeleteResults, handleOpenDetail],
  );

  if (!permissionsReady) {
    return <ResultViewLoadingState />;
  }

  if (!canView) {
    return <ResultViewAccessDenied navigateHome={() => navigate('/')} />;
  }

  return (
    <>
      <ResultViewContent
        activeRoleCode={activeRole?.code}
        allAppeals={allAppeals}
        allInspections={allInspections}
        appeals={appeals}
        appealForm={appealForm}
        canAdjust={canAdjust}
        collegeOptions={collegeOptions}
        draftFilters={draftFilters}
        exporting={exporting}
        filteredInspections={filteredInspections}
        gradeOptions={gradeOptions}
        handleAppealHandle={handleAppealHandle}
        handleAppealSubmit={handleAppealSubmit}
        handleDeleteResults={handleDeleteResults}
        handleExport={canExport ? handleExport : undefined}
        handleForm={handleForm}
        handleRefresh={handleRefresh}
        handleResetFilters={handleResetFilters}
        handleSearch={handleSearch}
        inspections={inspections}
        isDirty={isDirty}
        isMobile={isMobile}
        lastRefreshedAt={lastRefreshedAt}
        levelOptions={levelOptions}
        pageTasks={pageData.tasks}
        pagination={pagination}
        ratingForScore={ratingForScore}
        selectedResultIds={selectedResultIds}
        setAppealForm={setAppealForm}
        setDraftFilters={setDraftFilters}
        setHandleForm={setHandleForm}
        setPagination={setPagination}
        setSelectedResultIds={setSelectedResultIds}
        showAuxPanels={showAuxPanels}
        tableColumns={tableColumns}
        totalCount={totalCount}
      />

      <ResultViewOverlays
        actionSheetOpen={actionSheetOpen}
        activeRoleCode={activeRole?.code}
        canAdjust={canAdjust}
        detail={detail}
        filteredInspections={filteredInspections}
        handleCloseDetail={handleCloseDetail}
        handleDeleteResults={handleDeleteResults}
        handleModifyNavigation={handleModifyNavigation}
        handleOpenDetail={handleOpenDetail}
        handleSelectAppealInspection={handleSelectAppealInspection}
        isMobile={isMobile}
        ratingForScore={ratingForScore}
        selectedResultIds={selectedResultIds}
        setActionSheetOpen={setActionSheetOpen}
        settings={settings}
      />
    </>
  );
}
