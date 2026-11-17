import { Button, Modal } from "antd";
import { CameraOutlined, PictureOutlined } from "@ant-design/icons";
import type { UploadActionSheetModalProps } from "../types";

export default function UploadActionSheetModal({
  open,
  onClose,
  onPickCamera,
  onPickGallery,
}: UploadActionSheetModalProps) {
  return (
    <Modal
      open={open}
      title={null}
      onCancel={onClose}
      footer={null}
      centered
      width={320}
      className="ios-action-sheet-modal"
    >
      <div className="p-2 space-y-2">
        <h4 className="text-center text-ios-gray-label text-[12px] font-bold uppercase mb-4 tracking-widest">
          选取照片方式
        </h4>
        <Button
          block
          size="large"
          className="h-14 rounded-2xl flex items-center justify-between px-6 font-bold bg-ios-gray/30 border-none"
          icon={<CameraOutlined className="text-ios-blue" />}
          onClick={onPickCamera}
        >
          拍摄照片
        </Button>
        <Button
          block
          size="large"
          className="h-14 rounded-2xl flex items-center justify-between px-6 font-bold bg-ios-gray/30 border-none"
          icon={<PictureOutlined className="text-ios-blue" />}
          onClick={onPickGallery}
        >
          从相册选择
        </Button>
        <div className="pt-2">
          <Button
            block
            size="large"
            className="h-14 rounded-2xl font-bold text-red-500 bg-white dark:bg-zinc-800 border-none"
            onClick={onClose}
          >
            取消
          </Button>
        </div>
      </div>
    </Modal>
  );
}
