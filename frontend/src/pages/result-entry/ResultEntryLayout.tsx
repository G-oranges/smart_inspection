import { Button, Image, Input, Progress, Skeleton, Tag, Tooltip } from 'antd';
import {
  CameraOutlined,
  CloseOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
} from '@ant-design/icons';

import PermissionDeniedState from '../../components/common/PermissionDeniedState';
import { resultRecordPermissionPreset } from '../../components/common/permissionDeniedPresets';
import { resolvePhotoUrl } from '../../utils/url';
import ResultEntryToolbar from './ResultEntryToolbar';

import type { ResultEntryLayoutProps } from './types';

type LayoutForm = ResultEntryLayoutProps['form'];
type DeductionRow = ResultEntryLayoutProps['appliedDeductions'][number];

/* ────────────────────────────────────────
   权限拦截
   ──────────────────────────────────────── */
function PermissionBlockedState({
  onBackToRoomList,
}: Pick<ResultEntryLayoutProps, 'onBackToRoomList'>) {
  return (
    <PermissionDeniedState
      mode="section"
      message={resultRecordPermissionPreset.message}
      actionText="返回房间列表"
      onAction={onBackToRoomList}
      variant="dark"
      className="re-dark-card co-animate-in"
    />
  );
}

/* ────────────────────────────────────────
   分数概览区（左列上方）
   参照 Stitch: 深色卡片 + SVG 甜甜圈 + 微光
   ──────────────────────────────────────── */
function ScoreSection({
  canSubmit,
  currentRating,
  handleScoreClick,
  inspectionRecord,
  numericScore,
  scoreColor,
  selectedTask,
}: Pick<
  ResultEntryLayoutProps,
  'canSubmit' | 'currentRating' | 'handleScoreClick' | 'inspectionRecord' | 'numericScore' | 'scoreColor' | 'selectedTask'
>) {
  return (
    <div className="re-dark-card re-score-dashboard p-8">
      {/* 模糊光晕 */}
      <div
        className="absolute inset-0 opacity-15 pointer-events-none"
        style={{
          background: `radial-gradient(circle at 50% 40%, ${scoreColor}40 0%, transparent 60%)`,
          filter: 'blur(40px)',
        }}
      />

      {/* AntD Progress 仪表盘 */}
      <div className="relative">
        <Progress
          type="dashboard"
          size={200}
          percent={numericScore}
          strokeColor={{ '0%': scoreColor, '100%': `${scoreColor}CC` }}
          strokeWidth={6}
          gapDegree={80}
          format={() => (
            <div className="flex flex-col items-center justify-center">
              <div className="inline-flex items-center gap-1">
                <span className="re-score-value" style={{ color: 'var(--co-text)' }}>
                  {numericScore}
                </span>
                {canSubmit && (
                  <Tooltip title="修改基础分">
                    <Button
                      type="text"
                      size="small"
                      icon={<EditOutlined />}
                      onClick={handleScoreClick}
                      aria-label="修改基础分"
                      style={{ color: 'var(--co-text-muted)' }}
                    />
                  </Tooltip>
                )}
              </div>
              <div
                className="re-rating-capsule mt-2"
                style={{ background: `${scoreColor}15`, color: scoreColor }}
              >
                {currentRating}
              </div>
            </div>
          )}
        />
      </div>

      {/* 任务标签 */}
      <div className="w-full flex justify-center gap-3 mt-5 relative">
        <span className="re-task-pill">
          {selectedTask?.title || '未命名任务'}
        </span>
        {inspectionRecord && (
          <Tag
            color="success"
            bordered={false}
            className="rounded-full px-3 py-1 text-[11px] font-bold uppercase"
          >
            已录入
          </Tag>
        )}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────
   宿舍成员列表（左列下方）
   参照 Stitch: 紧凑行 + 深色子容器
   ──────────────────────────────────────── */
function MembersSection({
  loadingMembers,
  members,
}: Pick<ResultEntryLayoutProps, 'loadingMembers' | 'members'>) {
  return (
    <div className="re-dark-card">
      {/* 标题栏 */}
      <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--co-glass-border)' }}>
        <span className="re-section-title" style={{ margin: 0 }}>宿舍成员</span>
        <span className="re-count-badge">{members.length} 人</span>
      </div>

      {/* 成员列表 */}
      {loadingMembers ? (
        <div className="p-6">
          <Skeleton active paragraph={{ rows: 1 }} />
        </div>
      ) : (
        <div className="p-3 space-y-1.5">
          {members.length === 0 ? (
            <div className="py-6 text-center italic text-sm" style={{ color: 'var(--co-text-muted)' }}>
              暂无成员信息
            </div>
          ) : (
            members.map((item, index) => (
              <div
                key={String(item.id ?? `${item.studentNo ?? 'member'}-${index}`)}
                className="re-member-row"
              >
                <div className="flex flex-col">
                  <span className="text-sm font-bold" style={{ color: 'var(--co-text)' }}>
                    {item.fullName}
                  </span>
                  <span className="text-[11px] mt-0.5" style={{ color: 'var(--co-text-muted)' }}>
                    {item.studentNo}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs" style={{ color: 'var(--co-text-muted)' }}>
                    床位{' '}
                    <span className="font-bold" style={{ color: 'var(--co-text)' }}>
                      {item.bedNo}
                    </span>
                  </span>
                  <span
                    className={`re-role-tag ${item.isLeader ? 're-role-tag--leader' : 're-role-tag--member'}`}
                  >
                    {item.isLeader ? '寝室长' : '成员'}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/* ────────────────────────────────────────
   扣分区域工具函数
   ──────────────────────────────────────── */
function resolveDeductionTotal(
  row: DeductionRow,
  enabledDeductions: ResultEntryLayoutProps['enabledDeductions'],
) {
  const deductionInfo = enabledDeductions.find((item) => item.code === row.code);
  return {
    deductionInfo,
    totalPoints: deductionInfo ? deductionInfo.points * (row.count || 1) : 0,
  };
}

/* ────────────────────────────────────────
   扣分项目列表（右列上方）
   参照 Stitch: 标题 + 描述 + 列表分割线
   ──────────────────────────────────────── */
function DeductionsSection({
  appliedDeductions,
  canSubmit,
  enabledDeductions,
  onOpenAddDrawer,
  onOpenEditDrawer,
  onRemoveDeductionRow,
}: Pick<
  ResultEntryLayoutProps,
  'appliedDeductions' | 'canSubmit' | 'enabledDeductions' | 'onOpenAddDrawer' | 'onOpenEditDrawer' | 'onRemoveDeductionRow'
>) {
  return (
    <div className="re-dark-card">
      {/* 标题 */}
      <div className="p-5 pb-3">
        <h4 className="re-section-title">扣分项目</h4>
      </div>

      {/* 列表 */}
      <div style={{ borderTop: '1px solid var(--co-glass-border)' }}>
        {appliedDeductions.length === 0 ? (
          <div className="py-10 flex flex-col items-center" style={{ color: 'var(--co-text-muted)' }}>
            <span className="text-sm italic">无扣分</span>
          </div>
        ) : (
          <div>
            {appliedDeductions.map((row, index) => {
              const { deductionInfo, totalPoints } = resolveDeductionTotal(
                row,
                enabledDeductions,
              );

              return (
                <div
                  key={String(row.id)}
                  className="re-deduction-row"
                  style={{
                    borderBottom:
                      index < appliedDeductions.length - 1
                        ? '1px solid var(--co-glass-border)'
                        : undefined,
                  }}
                  onClick={() => canSubmit && onOpenEditDrawer(row)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate" style={{ color: 'var(--co-text)' }}>
                      {deductionInfo?.name || '未选择'}
                    </div>
                    <div className="text-[11px] mt-0.5 flex items-center gap-1 flex-wrap" style={{ color: 'var(--co-text-muted)' }}>
                      {row.locations.length > 0 ? (
                        row.locations.map((loc) => <span key={loc}>{loc}</span>)
                      ) : (
                        <span className="italic">公共区域</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="re-deduct-total">-{totalPoints}</span>
                    <Button
                      type="text"
                      size="small"
                      icon={
                        <DeleteOutlined style={{ color: 'var(--co-text-muted)', transition: 'color 0.15s' }} />
                      }
                      onClick={(event) => {
                        event.stopPropagation();
                        onRemoveDeductionRow(row.id);
                      }}
                      disabled={!canSubmit}
                      className="hover:!text-red-500"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 添加违规项按钮 */}
        <div className="re-add-btn-area">
          <Button
            block
            type="text"
            icon={<PlusOutlined style={{ color: 'var(--co-primary)' }} />}
            onClick={onOpenAddDrawer}
            disabled={!canSubmit || appliedDeductions.length >= enabledDeductions.length}
            className="h-11 font-bold transition-colors"
            style={{ color: 'var(--co-primary)' }}
          >
            添加违规项
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────
   照片与备注（右列下方）
   参照 Stitch: 上传方格 + 文本域
   ──────────────────────────────────────── */
function PhotosSection({
  canSubmit,
  form,
  onOpenUploadModal,
  removePhoto,
  setForm,
}: Pick<
  ResultEntryLayoutProps,
  'canSubmit' | 'form' | 'onOpenUploadModal' | 'removePhoto' | 'setForm'
>) {
  return (
    <div className="re-dark-card p-5 space-y-5">
      <h4 className="re-section-title" style={{ margin: 0 }}>照片与备注</h4>

      {/* 照片网格 */}
      <div className="flex flex-wrap gap-3">
        <Image.PreviewGroup>
          {form.photoUrls.map((url, index) => (
            <div
              key={`${url}-${index}`}
              className="relative group w-20 h-20 rounded-xl overflow-hidden"
              style={{ background: 'var(--co-input-bg)' }}
            >
              <Image
                width="100%"
                height="100%"
                src={resolvePhotoUrl(url)}
                className="object-cover"
              />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                <PlusOutlined className="text-white text-xl" />
              </div>
              <Button
                type="text"
                size="small"
                icon={<CloseOutlined className="text-[11px]" />}
                className="absolute top-1.5 right-1.5 w-6 h-6 flex items-center justify-center bg-black/60 text-white rounded-full active:scale-90 opacity-0 group-hover:opacity-100 transition-all"
                onClick={() => removePhoto(index)}
              />
            </div>
          ))}
        </Image.PreviewGroup>

        {/* 上传按钮 */}
        <div
          onClick={() => canSubmit && onOpenUploadModal()}
          className={`re-upload-tile ${!canSubmit ? 'opacity-30 cursor-not-allowed' : ''}`}
        >
          <CameraOutlined className="text-2xl" />
          <span className="text-[11px] font-bold uppercase tracking-widest">添加照片</span>
        </div>
      </div>

      {/* 备注 */}
      <Input.TextArea
        value={form.comments}
        onChange={(event) =>
          setForm((prev: LayoutForm) => ({
            ...prev,
            comments: event.target.value,
          }))
        }
        rows={4}
        placeholder="输入备注..."
        className="!rounded-xl"
        style={{
          background: 'var(--co-input-bg)',
          border: '1px solid var(--co-glass-border)',
          color: 'var(--co-text)',
          resize: 'none',
          minHeight: '140px',
        }}
        disabled={!canSubmit}
      />
    </div>
  );
}

/* ────────────────────────────────────────
   移动端底部提交栏
   ──────────────────────────────────────── */
function MobileSubmitBar({
  canRecord,
  canSubmit,
  nextDorm,
}: Pick<ResultEntryLayoutProps, 'canRecord' | 'canSubmit' | 'nextDorm'>) {
  if (!canRecord || !canSubmit) {
    return null;
  }

  return (
    <div className="lg:hidden fixed bottom-0 left-0 md:left-[260px] right-0 p-4 pb-8 md:pb-4 backdrop-blur-3xl bg-white/70 dark:bg-black/70 border-t z-40 transition-all duration-300" style={{ borderColor: 'var(--co-glass-border)' }}>
      <div className="flex gap-4 max-w-md mx-auto">
        {nextDorm && (
          <Button
            form="result-form"
            type="default"
            htmlType="submit"
            data-type="next"
            className="flex-1 h-12 rounded-2xl font-bold"
          >
            保存并下一间
          </Button>
        )}
        <Button
          form="result-form"
          type="primary"
          htmlType="submit"
          data-type="return"
          className="flex-[1.5] h-12 rounded-2xl font-bold shadow-lg"
          style={{ boxShadow: 'var(--co-btn-primary-shadow)' }}
        >
          保存并返回
        </Button>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────
   主表单：桌面端 40/60 分割布局
   ──────────────────────────────────────── */
function ResultEntryForm(props: ResultEntryLayoutProps) {
  const {
    building,
    canSubmit,
    currentRating,
    enabledDeductions,
    form,
    handleScoreClick,
    handleSubmit,
    inspectionRecord,
    isScrolled,
    loadingMembers,
    mainRef,
    members,
    nextDorm,
    onBackToRoomList,
    onNavigateToRoom,
    onOpenAddDrawer,
    onOpenEditDrawer,
    onOpenUploadModal,
    onRemoveDeductionRow,
    prevDorm,
    removePhoto,
    room,
    scoreColor,
    selectedTask,
    setForm,
    appliedDeductions,
    numericScore,
  } = props;

  return (
    <div ref={mainRef} className="ios-page-container min-h-screen pb-32 md:pb-32">
      <ResultEntryToolbar
        isScrolled={isScrolled}
        onBack={onBackToRoomList}
        prevDorm={prevDorm}
        nextDorm={nextDorm}
        onNavigateToRoom={onNavigateToRoom}
        room={room}
        building={building}
        scoreColor={scoreColor}
        numericScore={numericScore}
      />

      <div className="max-w-6xl mx-auto px-4 py-6">
        <form
          id="result-form"
          onSubmit={(event) => {
            void handleSubmit(event);
          }}
          className="re-content-grid"
        >
          {/* 左列：分数仪表盘 + 宿舍成员 */}
          <div className="re-left-col space-y-5 co-animate-in">
            <ScoreSection
              canSubmit={canSubmit}
              currentRating={currentRating}
              handleScoreClick={handleScoreClick}
              inspectionRecord={inspectionRecord}
              numericScore={numericScore}
              scoreColor={scoreColor}
              selectedTask={selectedTask}
            />
            <MembersSection loadingMembers={loadingMembers} members={members} />
          </div>

          {/* 右列：扣分项目 + 照片 + 提交 */}
          <div className="space-y-5 co-animate-in" style={{ animationDelay: '0.08s' }}>
            <DeductionsSection
              appliedDeductions={appliedDeductions}
              canSubmit={canSubmit}
              enabledDeductions={enabledDeductions}
              onOpenAddDrawer={onOpenAddDrawer}
              onOpenEditDrawer={onOpenEditDrawer}
              onRemoveDeductionRow={onRemoveDeductionRow}
            />
            <PhotosSection
              canSubmit={canSubmit}
              form={form}
              onOpenUploadModal={onOpenUploadModal}
              removePhoto={removePhoto}
              setForm={setForm}
            />

            {/* 桌面端提交按钮 */}
            <div className="hidden lg:block pt-2">
              <button
                type="submit"
                form="result-form"
                disabled={!canSubmit}
                className="re-submit-btn"
              >
                保存结果
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────
   导出入口
   ──────────────────────────────────────── */
export default function ResultEntryLayout(props: ResultEntryLayoutProps) {
  if (!props.canRecord) {
    return (
      <div ref={props.mainRef} className="ios-page-container min-h-screen pb-32 md:pb-32">
        <ResultEntryToolbar
          isScrolled={props.isScrolled}
          onBack={props.onBackToRoomList}
          prevDorm={props.prevDorm}
          nextDorm={props.nextDorm}
          onNavigateToRoom={props.onNavigateToRoom}
          room={props.room}
          building={props.building}
          scoreColor={props.scoreColor}
          numericScore={props.numericScore}
        />
        <div className="max-w-6xl mx-auto px-4 py-6">
          <PermissionBlockedState onBackToRoomList={props.onBackToRoomList} />
        </div>
      </div>
    );
  }

  return (
    <>
      <ResultEntryForm {...props} />
      <MobileSubmitBar
        canRecord={props.canRecord}
        canSubmit={props.canSubmit}
        nextDorm={props.nextDorm}
      />
    </>
  );
}
