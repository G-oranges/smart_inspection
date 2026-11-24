/**
 * DormImportPreviewModal.jsx - 宿舍导入预览弹窗
 */
import { Modal, Button, Alert, Row, Col, Card, Select } from "antd";

import type { UploadResolution } from '../../../types/service';
import { MODAL_WIDTH } from "../../../components/common/modalSizes";

interface DormImportPreviewIssue {
  row?: number;
  field?: string;
  reason?: string;
  content?: string;
}

interface DormImportPreviewData {
  total?: number;
  newCount?: number;
  conflictCount?: number;
  invalidCount?: number;
  invalidItems?: DormImportPreviewIssue[];
}

interface DormImportPreviewModalProps {
  open: boolean;
  onClose: () => void;
  previewData?: DormImportPreviewData | null;
  resolution?: UploadResolution;
  onResolutionChange?: (value: UploadResolution) => void;
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
}

const { Option } = Select;

/**
 * 宿舍导入预览弹窗
 * @param {Object} props
 * @param {boolean} props.open - 是否打开
 * @param {Function} props.onClose - 关闭回调
 * @param {Object} props.previewData - 预览数据
 * @param {string} props.resolution - 冲突处理策略
 * @param {Function} props.onResolutionChange - 策略改变回调
 * @param {boolean} props.loading - 确认按钮 loading
 * @param {Function} props.onConfirm - 确认导入回调
 */
export default function DormImportPreviewModal({
  open,
  onClose,
  previewData,
  resolution = "overwrite",
  onResolutionChange,
  loading = false,
  onConfirm,
}: DormImportPreviewModalProps) {
  return (
    <Modal
      title="导入宿舍预览"
      open={open}
      onCancel={onClose}
      footer={[
        <Button 
          key="cancel" 
          className="apple-btn-secondary"
          onClick={onClose}
        >
          取消
        </Button>,
        <Button 
          key="submit" 
          type="primary" 
          className="apple-btn-primary"
          loading={loading}
          onClick={onConfirm}
        >
          确认导入
        </Button>
      ]}
      width={MODAL_WIDTH.lg}
      className="co-modal"
      centered
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
                    <div style={{ fontSize: "20px", fontWeight: 600 }}>
                      {previewData.total}
                    </div>
                    <div style={{ color: "var(--co-text-secondary)", fontSize: "12px" }}>
                      总记录
                    </div>
                  </div>
                </Col>
                <Col span={8}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "20px", fontWeight: 600, color: "var(--co-success)" }}>
                      {previewData.newCount}
                    </div>
                    <div style={{ color: "var(--co-text-secondary)", fontSize: "12px" }}>
                      新增
                    </div>
                  </div>
                </Col>
                <Col span={8}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "20px", fontWeight: 600, color: "var(--co-warning)" }}>
                      {previewData.conflictCount}
                    </div>
                    <div style={{ color: "var(--co-text-secondary)", fontSize: "12px" }}>
                      已存在
                    </div>
                  </div>
                </Col>
              </Row>
            }
            style={{ marginBottom: 20 }}
          />

          {(previewData.conflictCount || 0) > 0 && (
            <Card size="small" title="重复处理" style={{ marginBottom: 20 }}>
              <Select
                value={resolution}
                onChange={onResolutionChange}
                style={{ width: "100%" }}
              >
                <Option value="overwrite">覆盖现有数据（推荐）</Option>
                <Option value="skip">跳过重复项</Option>
              </Select>
              <div style={{ marginTop: 8, fontSize: "12px", color: "var(--co-text-secondary)" }}>
                有 {previewData.conflictCount} 间宿舍已存在
              </div>
            </Card>
          )}

          {(previewData.invalidCount || 0) > 0 && (
            <Alert
              type="error"
              showIcon
              message={`异常记录（${previewData.invalidCount} 条无法导入）`}
              description={
                <div style={{ maxHeight: "180px", overflowY: "auto", marginTop: 8, background: 'var(--co-error-bg)', padding: '8px 12px', borderRadius: 4 }}>
                  {(previewData.invalidItems || []).map((item, idx) => (
                    <div key={idx} style={{ fontSize: "12px", marginBottom: 6, paddingBottom: 6, borderBottom: '1px solid var(--co-glass-border)' }}>
                      <span style={{ fontWeight: 600, color: 'var(--co-error)' }}>第 {item.row} 行</span>
                      {item.field ? (
                        <span style={{ color: 'var(--co-text-secondary)' }}> · {item.field}：</span>
                      ) : (
                        <span>：</span>
                      )}
                      <span>{item.reason}</span>
                      {item.content && <span style={{ marginLeft: 8, color: 'var(--co-text-muted)' }}>（{item.content}）</span>}
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
