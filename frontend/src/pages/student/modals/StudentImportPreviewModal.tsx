/**
 * 学生导入预检弹窗
 * @module pages/student/modals/StudentImportPreviewModal
 */

import { Modal, Alert, Card, Select, Row, Col, Button } from "antd";

const { Option } = Select;

import type { StudentImportPreviewModalProps } from "../types";

/**
 * 学生导入预检弹窗
 * @param {Object} props
 * @param {boolean} props.open - 是否打开
 * @param {Object} props.previewData - 预检数据
 * @param {string} props.resolution - 冲突处理策略
 * @param {Function} props.setResolution - 设置冲突处理策略
 * @param {boolean} props.isImporting - 是否正在导入
 * @param {Function} props.onCancel - 取消回调
 * @param {Function} props.onConfirm - 确认回调
 */
export default function StudentImportPreviewModal({
  open,
  previewData,
  resolution,
  setResolution,
  isImporting,
  onCancel,
  onConfirm,
}: StudentImportPreviewModalProps) {
  return (
    <Modal
      title="导入数据预检"
      open={open}
      onCancel={onCancel}
      footer={[
        <Button key="cancel" onClick={onCancel}>
          取消导入
        </Button>,
        <Button
          key="submit"
          type="primary"
          loading={isImporting}
          onClick={onConfirm}
        >
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
                    <div
                      style={{
                        color: "var(--color-text-secondary)",
                        fontSize: "12px",
                      }}
                    >
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
                    <div
                      style={{
                        color: "var(--color-text-secondary)",
                        fontSize: "12px",
                      }}
                    >
                      新增学生
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
                    <div
                      style={{
                        color: "var(--color-text-secondary)",
                        fontSize: "12px",
                      }}
                    >
                      学号冲突
                    </div>
                  </div>
                </Col>
              </Row>
            }
            style={{ marginBottom: 20 }}
          />

          {previewData.conflictCount > 0 && (
            <Card
              size="small"
              title="冲突处理策略"
              style={{ marginBottom: 20 }}
            >
              <Select
                value={resolution}
                onChange={setResolution}
                style={{ width: "100%" }}
              >
                <Option value="overwrite">覆盖现有数据 (推荐)</Option>
                <Option value="skip">跳过重复项</Option>
              </Select>
              <div
                style={{
                  marginTop: 8,
                  fontSize: "12px",
                  color: "var(--color-text-secondary)",
                }}
              >
                检测到 {previewData.conflictCount}{" "}
                条记录的学号已在系统中存在。请选择如何处理这些记录。
              </div>
            </Card>
          )}

          {previewData.invalidCount > 0 && (
            <Alert
              type="error"
              showIcon
              message={`${previewData.invalidCount} 条数据存在问题（无法导入）`}
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
                  {previewData.invalidItems?.map((item, idx) => (
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
                        <span style={{ marginLeft: 8, color: "#666" }}>
                          [{item.field}]
                        </span>
                      )}
                      <span style={{ marginLeft: 8 }}>{item.reason}</span>
                      {item.content && (
                        <span style={{ marginLeft: 8, color: "#999" }}>
                          （{item.content}）
                        </span>
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
