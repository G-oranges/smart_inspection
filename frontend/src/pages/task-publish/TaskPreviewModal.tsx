/**
 * 任务发布弹窗（发布/编辑向导）
 */

import { Button, Modal, Steps } from "antd";
import { ArrowRightOutlined, CheckCircleOutlined } from "@ant-design/icons";

import type { TaskPreviewModalProps } from "./types";

export const TaskPreviewModal = ({
  open,
  mode,
  isMobile,
  currentStep,
  steps,
  onClose,
  onPrev,
  onNext,
  onSubmit,
  children,
}: TaskPreviewModalProps) => {
  return (
    <Modal
      open={open}
      title={
        <div className="py-1">
          <div className="text-xl font-bold text-gray-800 dark:text-gray-100">
            {mode === "create" ? "发布新任务" : "修改任务信息"}
          </div>
        </div>
      }
      width={isMobile ? "100%" : 780}
      centered
      onCancel={onClose}
      style={isMobile ? { top: 0, paddingBottom: 0 } : undefined}
      footer={[
        <div
          key="footer"
          className="task-publish-footer flex justify-end gap-3 px-6 py-5"
        >
          <Button
            onClick={onClose}
            className="apple-btn-secondary"
          >
            取消
          </Button>
          {currentStep > 0 && (
            <Button
              onClick={onPrev}
              className="apple-btn-secondary"
            >
              上一步
            </Button>
          )}
          {currentStep < 2 ? (
            <Button
              type="primary"
              onClick={onNext}
              icon={<ArrowRightOutlined />}
              iconPosition="end"
              className="apple-btn-primary px-8"
            >
              下一步
            </Button>
          ) : (
            <Button
              type="primary"
              onClick={onSubmit}
              icon={<CheckCircleOutlined />}
              className="apple-btn-primary px-8"
            >
              确认发布任务
            </Button>
          )}
        </div>,
      ]}
      styles={{
        body: {
          padding: 0,
          overflow: "hidden",
          borderRadius: "28px",
          display: "flex",
          flexDirection: "column",
          flex: 1,
          minHeight: 0,
          maxHeight: isMobile ? "100dvh" : "calc(100vh - 96px)",
        },
        mask: {
          backdropFilter: "blur(12px)",
          backgroundColor: "rgba(0,0,0,0.3)",
        },
      }}
      className="task-publish-modal management-theme-page apple-modal glass-modal"
    >
      <div className={isMobile ? "px-2 py-1" : "py-1"}>
        <Steps
          current={currentStep}
          items={steps}
          direction="horizontal"
          responsive={false}
          labelPlacement={isMobile ? "vertical" : "horizontal"}
          className={`apple-steps ${isMobile ? "mb-3" : "mb-6"}`}
          size="small"
        />
        <div className={isMobile ? "min-h-[260px]" : "min-h-[360px]"}>
          {children}
        </div>
      </div>
    </Modal>
  );
}
