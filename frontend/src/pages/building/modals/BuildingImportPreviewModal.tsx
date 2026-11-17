/**
 * BuildingImportPreviewModal.jsx - 导入预览确认模态框
 * 
 * 显示导入预检结果并确认导入
 */
import { Modal, Button, Card, Select, Alert, Row, Col } from "antd";
import type { UploadResolution } from '../../../types/service';

import { IMPORT_RESOLUTION_OPTIONS } from "../buildingSchema";
import type { BuildingImportPreviewResult } from '../types';

const { Option } = Select;

interface BuildingImportPreviewIssue {
  row?: number;
  field?: string;
  reason?: string;
  content?: string;
}

interface BuildingImportPreviewData extends BuildingImportPreviewResult {
  total?: number;
  newCount?: number;
  conflictCount?: number;
  invalidCount?: number;
  invalidItems?: BuildingImportPreviewIssue[];
}

interface BuildingImportPreviewModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  previewData?: BuildingImportPreviewData | null;
  resolution: UploadResolution;
  setResolution: (value: UploadResolution) => void;
  isImporting: boolean;
}

/**
 * 导入预览模态框
 * @param {Object} props
 * @param {boolean} props.open - 是否打开
 * @param {Function} props.onClose - 关闭回调
 * @param {Function} props.onConfirm - 确认导入回调
 * @param {Object} props.previewData - 预览数据
 * @param {string} props.resolution - 冲突处理策略
 * @param {Function} props.setResolution - 设置冲突处理策略
 * @param {boolean} props.isImporting - 是否正在导入
 */
export function BuildingImportPreviewModal({
  open,
  onClose,
  onConfirm,
  previewData,
  resolution,
  setResolution,
  isImporting,
}: BuildingImportPreviewModalProps) {
  const conflictCount = previewData?.conflictCount || 0;
  const invalidCount = previewData?.invalidCount || 0;
  const invalidItems = previewData?.invalidItems || [];

  return (
    <Modal
      title="楼栋导入预检"
      open={open}
      onCancel={onClose}
      footer={[
        <Button key="cancel" onClick={onClose}>
          取消导入
        </Button>,
        <Button key="submit" type="primary" loading={isImporting} onClick={onConfirm}>
          确认导入
        </Button>,
      ]}
      width={600}
      className="glass-modal"
    >
      {previewData && (
        <div className="import-summary-content">
          <Alert
            type="info"
            showIcon
            message="数据概览"
            description={
              <Row gutter={[16, 16]} style={{ marginTop: 8 }}>
                <Col span={8}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "20px", fontWeight: "bold" }}>
                      {previewData.total}
                    </div>
                    <div style={{ color: "var(--color-text-secondary)", fontSize: "12px" }}>
                      总共记录
                    </div>
                  </div>
                </Col>
                <Col span={8}>
                  <div style={{ textAlign: "center" }}>
                    <div
                      style={{
                        fontSize: "20px",
                        fontWeight: "bold",
                        color: "var(--color-success)",
                      }}
                    >
                      {previewData.newCount}
                    </div>
                    <div style={{ color: "var(--color-text-secondary)", fontSize: "12px" }}>
                      新楼栋
                    </div>
                  </div>
                </Col>
                <Col span={8}>
                  <div style={{ textAlign: "center" }}>
                    <div
                      style={{
                        fontSize: "20px",
                        fontWeight: "bold",
                        color: "var(--color-warning)",
                      }}
                    >
                      {previewData.conflictCount}
                    </div>
                    <div style={{ color: "var(--color-text-secondary)", fontSize: "12px" }}>
                      冲突项
                    </div>
                  </div>
                </Col>
              </Row>
            }
            style={{ marginBottom: 20 }}
          />

          {conflictCount > 0 && (
            <Card size="small" title="冲突处理策略" style={{ marginBottom: 20 }}>
              <Select value={resolution} onChange={setResolution} style={{ width: "100%" }}>
                {IMPORT_RESOLUTION_OPTIONS.map((opt) => (
                  <Option key={opt.value} value={opt.value}>
                    {opt.label}
                  </Option>
                ))}
              </Select>
              <div style={{ marginTop: 8, fontSize: "12px", color: "var(--color-text-secondary)" }}>
                检测到 {conflictCount} 条记录的楼栋名称已在系统中存在。
              </div>
            </Card>
          )}

          {invalidCount > 0 && (
            <Alert
              type="error"
              showIcon
              message={`${invalidCount} 条数据存在问题（无法导入）`}
              description={
                <div
                  style={{
                    maxHeight: "180px",
                    overflowY: "auto",
                    marginTop: 8,
                    background: "var(--error-bg)",
                    padding: "8px 12px",
                    borderRadius: 4,
                  }}
                >
                  {invalidItems.map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        fontSize: "12px",
                        marginBottom: 6,
                        paddingBottom: 6,
                        borderBottom: "1px solid #ffccc7",
                      }}
                    >
                      <span style={{ fontWeight: "bold", color: "#cf1322" }}>
                        第 {item.row} 行
                      </span>
                      {item.field && (
                        <span style={{ marginLeft: 8, color: "#666" }}>[{item.field}]</span>
                      )}
                      <span style={{ marginLeft: 8 }}>{item.reason}</span>
                      {item.content && (
                        <span style={{ marginLeft: 8, color: "#999" }}>（{item.content}）</span>
                      )}
                    </div>
                  ))}
                </div>
              }
            />
          )}
        </div>
      )}
    </Modal>
  );
}

export default BuildingImportPreviewModal;
