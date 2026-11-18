/**
 * 任务发布弹窗（发布/编辑向导）
 */

import { Button, Modal, Steps } from "antd";

import type { TaskPreviewModalProps } from "./types";
import { MODAL_WIDTH } from "../../components/common/modalSizes";

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
      title={mode === "create" ? "发布任务" : "编辑任务"}
      width={isMobile ? "100%" : MODAL_WIDTH.lg}
      centered
      onCancel={onClose}
      style={isMobile ? { top: 0, paddingBottom: 0 } : undefined}
      footer={[
        <div
          key="footer"
          className={
            isMobile
              ? "task-publish-footer flex justify-end gap-3 px-6 py-5"
              : "co-modal-footer"
          }
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
              className="apple-btn-primary"
            >
              下一步
            </Button>
          ) : (
            <Button
              type="primary"
              onClick={onSubmit}
              className="apple-btn-primary"
            >
              {mode === "create" ? "发布任务" : "保存修改"}
            </Button>
          )}
        </div>,
      ]}
      styles={
        isMobile
          ? {
              body: {
                padding: 0,
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                flex: 1,
                minHeight: 0,
                maxHeight: "100dvh",
              },
            }
          : undefined
      }
      className={`task-publish-modal management-theme-page${isMobile ? "" : " co-modal"}`}
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
