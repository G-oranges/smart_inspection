/**
 * 批量入住弹窗组件
 * 支持移动端 Drawer 和桌面端 Modal 两种模式
 */

import { Alert, Modal, Button, Select, Input, Tag, Progress, Row, Col, Spin, Drawer } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import DormGridSelector from "../../components/DormGridSelector";

import type { EntityId, ServiceRecord } from "../../types/service";
import type {
  BatchCheckInModalProps,
  BedSelectInfo,
  OccupancyStudentRecord,
} from "./types";

interface SelectorBedRecord extends ServiceRecord {
  bedNo?: string | number;
  studentId?: EntityId;
  studentName?: string | null;
  student?: {
    id?: EntityId;
    fullName?: string;
    name?: string;
    gender?: string;
  };
  gender?: string;
}

function toStudentAssignmentKey(studentId: EntityId | undefined): string {
  return studentId === undefined || studentId === null ? '' : String(studentId);
}

function toBedSelectInfo(bed: {
  dormId?: EntityId;
  bedNo?: string | number;
  roomNo?: string;
  building?: string;
  floor?: string | number;
}): BedSelectInfo | null {
  if (bed.dormId === undefined || bed.dormId === null || bed.bedNo === undefined) {
    return null;
  }

  return {
    dormId: bed.dormId,
    bedNo: bed.bedNo,
    roomNo: bed.roomNo,
    building: bed.building,
    floor: bed.floor,
  };
}

/**
 * 批量入住弹窗
 */
export default function BatchCheckInModal({
  isMobile,
  open,
  onClose,
  onSubmit,
  loading,
  // 学生数据
  studentsToBeAssigned,
  currentAssigneeIndex,
  setCurrentAssigneeIndex,
  batchAssignments,
  // 宿舍数据
  targetDorms,
  loadingDorms,
  modalFilters,
  setModalFilters,
  modalFloors,
  uniqueBuildings,
  // handlers
  handleBedSelect,
  actions,
}: BatchCheckInModalProps) {
  const assignmentCount = Object.keys(batchAssignments).length;
  const totalCount = studentsToBeAssigned.length;
  const progressPercent = totalCount > 0 ? Math.round((assignmentCount / totalCount) * 100) : 0;
  const hasWritableDormTargets = targetDorms.length > 0;

  // 学生列表渲染
  const renderStudentList = (isCompact = false) => (
    <div className={isCompact ? "grid grid-cols-2 gap-2" : "space-y-2.5"}>
      {studentsToBeAssigned.map((student: OccupancyStudentRecord, index) => {
        const assignment = batchAssignments[toStudentAssignmentKey(student.id)];
        const isActive = currentAssigneeIndex === index;
        
        return (
          <div 
            key={student.id}
            className={`${isCompact ? 'p-3' : 'p-4'} rounded-2xl border transition-all cursor-pointer ${
              isActive ? 'bg-ios-blue/5 border-ios-blue shadow-sm' : 
              (assignment ? 'bg-green-50/50 border-green-100 opacity-70' : 'bg-gray-50/80 border-transparent hover:border-black/5')
            }`}
            onClick={() => setCurrentAssigneeIndex(index)}
          >
            {isCompact ? (
              <>
                <div className="font-bold truncate text-xs">{student.fullName}</div>
                <div className="text-[10px] opacity-60 truncate">
                  {assignment ? `${assignment.roomNo}-${assignment.bedNo}号` : '点击开始分配'}
                </div>
              </>
            ) : (
              <div className="flex justify-between items-center">
                <div>
                  <div className={`font-bold text-sm ${isActive ? 'text-ios-blue' : ''}`}>{student.fullName}</div>
                  <div className="text-[11px] opacity-40 font-sf tracking-wider">{student.studentNo}</div>
                </div>
                <div className="text-right">
                  {assignment ? (
                    <div className="flex flex-col items-end gap-1">
                      <Tag color="success" className="m-0 text-[9px] rounded-full px-2 border-none bg-green-100 text-green-700 font-bold">
                        {assignment.building} / {assignment.floor}F
                      </Tag>
                      <div className="text-[11px] font-bold text-green-600">
                        {assignment.roomNo}-{assignment.bedNo}号床
                      </div>
                    </div>
                  ) : (
                    <Tag className="m-0 rounded-full border-none bg-gray-200 text-gray-500 text-[10px]">待分配</Tag>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  // 床位选择器渲染
  const renderDormSelector = () => (
    loadingDorms ? (
      <div className={isMobile ? "py-12 text-center" : "py-24 text-center"}>
        <Spin size={isMobile ? "small" : "large"} />
        <div className={`mt-${isMobile ? '2' : '4'} text-${isMobile ? '[10px]' : 'xs'} opacity-40 tracking-widest font-sf uppercase`}>
          {isMobile ? 'Syncing Inventory...' : 'Syncing Real-time Inventory...'}
        </div>
      </div>
    ) : (
      hasWritableDormTargets ? (
        <DormGridSelector
          viewMode="mini"
          bedDisplayMode="inline"
          dataSource={targetDorms}
          onFetchBeds={async (dormId) =>
            ((await actions.getDormBeds?.(dormId)) as
              | { dormBeds?: SelectorBedRecord[] }
              | SelectorBedRecord[]) ?? []
          }
          onBedSelect={(bed) => {
            const nextBed = toBedSelectInfo(bed);
            if (nextBed) {
              handleBedSelect(nextBed);
            }
          }}
          activeBed={
            studentsToBeAssigned[currentAssigneeIndex]?.id !== undefined
              ? batchAssignments[
                  toStudentAssignmentKey(studentsToBeAssigned[currentAssigneeIndex]?.id)
                ]
              : undefined
          }
        />
      ) : (
        <Alert
          type="warning"
          showIcon
          message="当前没有可写宿舍"
          description="当前筛选条件或角色数据范围下暂无可分配床位，请调整筛选条件或联系管理员处理。"
        />
      )
    )
  );

  // 筛选器渲染
  const renderFilters = (isCompact = false) => (
    <div className={`flex ${isCompact ? 'items-center gap-2' : 'gap-3'}`}>
      <Select
        placeholder={isCompact ? "选择楼栋" : "楼栋过滤"}
        className={`apple-select-ios ${isCompact ? 'flex-1' : 'w-[160px]'}`}
        classNames={{ popup: { root: "apple-dropdown" } }}
        allowClear
        options={uniqueBuildings.map((building) => ({ label: building, value: building }))}
        value={modalFilters.building}
        onChange={(value) =>
          setModalFilters((prev) => ({ ...prev, building: value ?? null, floor: null }))
        }
      />
      <Select
        placeholder="楼层"
        className={`apple-select-ios ${isCompact ? 'w-24' : 'w-[110px]'}`}
        classNames={{ popup: { root: "apple-dropdown" } }}
        allowClear
        options={modalFloors.map((floor) => ({ label: `${floor}F`, value: floor }))}
        value={modalFilters.floor}
        onChange={(value) =>
          setModalFilters((prev) => ({ ...prev, floor: value ?? null }))
        }
      />
      {!isCompact && (
        <Input
          placeholder="快捷搜索房号..."
          className="apple-input-ios flex-1"
          prefix={<SearchOutlined className="text-gray-400" />}
          value={modalFilters.roomNo}
          onChange={(event) =>
            setModalFilters((prev) => ({ ...prev, roomNo: event.target.value }))
          }
          allowClear
        />
      )}
    </div>
  );

  // 移动端 Drawer
  if (isMobile) {
    return (
      <Drawer
        title={<span className="text-lg font-bold">批量入住分配</span>}
        placement="bottom"
        onClose={onClose}
        open={open}
        style={{ height: '92vh' }}
        className="apple-drawer ios-inset-grouped-drawer"
        extra={
          <Button
            type="primary"
            className="apple-btn-primary rounded-xl px-6"
            onClick={onSubmit}
            loading={loading}
            disabled={!hasWritableDormTargets}
          >
            提交
          </Button>
        }
      >
        <div className="space-y-6">
          <div className="bg-ios-blue/5 p-4 rounded-3xl border border-ios-blue/10">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold text-ios-blue uppercase tracking-wider">分配进度</span>
              <span className="text-ios-blue font-sf font-bold">{assignmentCount}/{totalCount}</span>
            </div>
            <Progress 
              percent={progressPercent} 
              size="small" 
              status="active" 
              strokeColor="#007AFF"
              className="mb-0"
            />
          </div>

          <div className="space-y-4">
            {renderFilters(true)}

            <div className="flex flex-col gap-4">
              <div className="bg-gray-50/50 dark:bg-white/5 rounded-2xl p-2 max-h-48 overflow-y-auto border border-black/5">
                {renderStudentList(true)}
              </div>

              <div className="bg-white dark:bg-gray-900 rounded-3xl p-3 border border-black/5 shadow-sm">
                {renderDormSelector()}
              </div>
            </div>
          </div>
        </div>
      </Drawer>
    );
  }

  // 桌面端 Modal
  return (
    <Modal
      title={<span className="text-xl font-bold text-gray-800">精细化批量入住分配</span>}
      open={open}
      onOk={onSubmit}
      onCancel={onClose}
      confirmLoading={loading}
      width={1000}
      destroyOnClose
      centered
      className="glass-modal apple-modal"
      footer={
        <div className="flex justify-end gap-3 mt-4">
          <Button className="apple-btn-secondary px-6" onClick={onClose}>取消</Button>
          <Button
            type="primary"
            className="apple-btn-primary px-10"
            onClick={onSubmit}
            disabled={!hasWritableDormTargets}
          >
            确认并提交
          </Button>
        </div>
      }
    >
      <Row gutter={24}>
        {/* 左侧：学生池 */}
        <Col span={8} className="border-r border-black/5">
          <div className="mb-6 px-1">
            <div className="flex justify-between mb-2">
              <span className="font-bold text-sm">待分配学生 ({totalCount})</span>
              <span className="text-xs text-blue-500 font-bold">已选: {assignmentCount}</span>
            </div>
            <Progress 
              percent={progressPercent} 
              size="small" 
              status="active" 
              strokeColor="#007AFF"
            />
          </div>
          
          <div className="max-h-[500px] overflow-y-auto pr-3 custom-scrollbar">
            {renderStudentList(false)}
          </div>
        </Col>

        {/* 右侧：床位选择器 */}
        <Col span={16}>
          <div className="mb-6">
            {renderFilters(false)}
          </div>

          <div className="max-h-[500px] overflow-y-auto p-1 custom-scrollbar">
            {renderDormSelector()}
          </div>
        </Col>
      </Row>
    </Modal>
  );
}
