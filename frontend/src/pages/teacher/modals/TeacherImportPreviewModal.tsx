/**
 * 教职工导入预检弹窗组件
 * @module pages/teacher/modals/TeacherImportPreviewModal
 */

import { Modal, Button, Select, Row, Col } from "antd";

import type { UploadResolution } from '../../../types/service';
import type {
  TeacherImportPreviewIssue,
  TeacherImportPreviewResult,
} from '../types';

const { Option } = Select;

interface TeacherImportPreviewModalProps {
  open: boolean;
  previewData?: (TeacherImportPreviewResult & {
    total?: number;
    newCount?: number;
    conflictCount?: number;
    invalidCount?: number;
    invalidItems?: TeacherImportPreviewIssue[];
  }) | null;
  resolution: UploadResolution;
  setResolution: (value: UploadResolution) => void;
  isImporting: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

/**
 * 教职工导入预检弹窗
 * @param {Object} props - 组件属性
 * @param {boolean} props.open - 是否打开
 * @param {Object} props.previewData - 预检数据
 * @param {string} props.resolution - 冲突处理策略
 * @param {Function} props.setResolution - 设置冲突处理策略
 * @param {boolean} props.isImporting - 是否正在导入
 * @param {Function} props.onConfirm - 确认导入回调
 * @param {Function} props.onCancel - 取消回调
 */
export default function TeacherImportPreviewModal({
  open,
  previewData,
  resolution,
  setResolution,
  isImporting,
  onConfirm,
  onCancel,
}: TeacherImportPreviewModalProps) {
  if (!previewData) return null;

  return (
    <Modal
      title={<span className="text-lg font-bold">教职工数据预检</span>}
      open={open}
      onCancel={onCancel}
      footer={[
        <Button key="cancel" className="apple-btn-secondary" onClick={onCancel}>
          取消
        </Button>,
        <Button
          key="submit"
          type="primary"
          className="apple-btn-primary px-8"
          loading={isImporting}
          onClick={onConfirm}
        >
          确认执行
        </Button>,
      ]}
      width={580}
      centered
      className="glass-modal apple-modal"
    >
      <div className="space-y-6 py-2">
        {/* 导入概览 */}
        <div className="bg-blue-50/50 dark:bg-blue-500/10 p-5 rounded-3xl border border-blue-100 dark:border-blue-500/20">
          <div className="text-blue-600 dark:text-blue-400 text-xs font-bold uppercase tracking-wider mb-4">
            导入概览
          </div>
          <Row gutter={16}>
            <Col span={8}>
              <div className="text-center">
                <div className="text-2xl font-black text-blue-600">
                  {previewData.total}
                </div>
                <div className="text-[10px] text-blue-400 font-bold">
                  总计行数
                </div>
              </div>
            </Col>
            <Col span={8}>
              <div className="text-center border-l border-blue-100 dark:border-blue-500/10">
                <div className="text-2xl font-black text-green-500">
                  {previewData.newCount}
                </div>
                <div className="text-[10px] text-green-400 font-bold">
                  拟新增项
                </div>
              </div>
            </Col>
            <Col span={8}>
              <div className="text-center border-l border-blue-100 dark:border-blue-500/10">
                <div className="text-2xl font-black text-orange-500">
                  {previewData.conflictCount}
                </div>
                <div className="text-[10px] text-orange-400 font-bold">
                  工号冲突
                </div>
              </div>
            </Col>
          </Row>
        </div>

        {/* 冲突策略选择 */}
        {(previewData.conflictCount || 0) > 0 && (
          <div className="space-y-3">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-widest pl-1">
              冲突策略
            </div>
            <Select
              value={resolution}
              onChange={setResolution}
              className="apple-select-ios w-full"
              classNames={{ popup: { root: "apple-dropdown" } }}
            >
              <Option value="overwrite">覆盖现有教职工数据 (推荐)</Option>
              <Option value="skip">跳过已存在的工号</Option>
            </Select>
          </div>
        )}

        {/* 异常警告 */}
        {(previewData.invalidCount || 0) > 0 && (
          <div className="space-y-3">
            <div className="text-xs font-bold text-red-400 uppercase tracking-widest pl-1">
              异常警告 ({previewData.invalidCount})
            </div>
            <div className="bg-red-50/50 dark:bg-red-500/5 rounded-2xl p-4 max-h-[160px] overflow-y-auto border border-red-100 dark:border-red-500/10">
              {(previewData.invalidItems || []).map((item: TeacherImportPreviewIssue, idx: number) => (
                <div key={idx} className="flex gap-2 text-xs mb-3 last:mb-0">
                  <span className="text-red-500 font-bold min-w-[40px]">
                    行 {item.row}
                  </span>
                  <div className="text-gray-600 dark:text-gray-400">
                    {item.field && (
                      <span className="font-bold mr-1">[{item.field}]</span>
                    )}
                    {item.reason}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
