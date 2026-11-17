/**
 * 主题设置抽屉组件
 * @module components/common/ThemeSettingsDrawer
 *
 * iOS/macOS 风格主题选择面板
 * 支持内置背景预设 + 自定义背景上传
 */
import { Drawer, Upload, App } from "antd";
import {
  CheckCircleFilled,
  PlusOutlined,
  DeleteOutlined,
  UndoOutlined,
} from "@ant-design/icons";
import type { UploadProps } from "antd";
import { useAppContext } from "../../context/AppContext";
import { commonService } from "../../services/commonService";
import type { ThemeCustomizationState } from "../../types/app";

interface ThemeSettingsDrawerProps {
  open: boolean;
  onClose: () => void;
}

interface UploadResponse {
  url?: string;
  data?: {
    url?: string;
  };
}

interface ServiceError {
  message?: string;
}

/**
 * 主题设置抽屉
 * @param {Object} props
 * @param {boolean} props.open - 是否打开
 * @param {Function} props.onClose - 关闭回调
 */
export default function ThemeSettingsDrawer({
  open,
  onClose,
}: ThemeSettingsDrawerProps) {
  const { themeCustomization } = useAppContext();
  const { message: messageApi } = App.useApp();

  if (!themeCustomization) return null;

  const {
    bgPreset,
    customBgUrl,
    selectPreset,
    setCustomBackground,
    resetToDefault,
    presets,
  } = themeCustomization;

  // 当前激活的key
  const activeKey = customBgUrl ? "custom" : bgPreset;

  /**
   * 自定义背景上传处理
   */
  const handleCustomUpload: UploadProps["customRequest"] = async ({
    file,
    onSuccess,
    onError,
  }) => {
    try {
      const res = (await commonService.uploadPhoto(file as File)) as UploadResponse;
      const url = res?.url || res?.data?.url;
      if (url) {
        setCustomBackground(url);
        onSuccess?.(res);
        messageApi.success("背景已更新");
      } else {
        throw new Error("上传成功但未返回 URL");
      }
    } catch (err) {
      onError?.(err as Error);
      messageApi.error("上传失败：" + ((err as ServiceError).message || "未知错误"));
    }
  };

  /**
   * 清除自定义背景
   */
  const handleClearCustom = () => {
    selectPreset("default");
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={null}
      closable={false}
      placement="bottom"
      height="auto"
      styles={{
        body: { padding: 0 },
        wrapper: { borderRadius: "20px 20px 0 0", overflow: "hidden" },
      }}
      className="theme-drawer"
    >
      <div className="px-5 pt-5 pb-8">
        {/* 拖拽条 */}
        <div className="flex justify-center mb-4">
          <div className="w-10 h-1 rounded-full bg-black/10 dark:bg-white/20" />
        </div>

        {/* 标题 */}
        <h3 className="text-[17px] font-bold text-black dark:text-white mb-1">
          外观设置
        </h3>
        <p className="text-[13px] text-gray-500 dark:text-gray-400 mb-5">
          选择一款背景主题，打造专属界面
        </p>

        {/* 预设网格 */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          {presets.map((preset) => {
            const isActive = activeKey === preset.key;
            return (
              <button
                key={preset.key}
                type="button"
                onClick={() => selectPreset(preset.key)}
                className={`
                  relative rounded-2xl p-3 text-center transition-all duration-200
                  active:scale-95 border-2 cursor-pointer
                  ${
                    isActive
                      ? "border-ios-blue shadow-lg shadow-ios-blue/20"
                      : "border-transparent bg-black/[0.03] dark:bg-white/[0.05] hover:bg-black/[0.06] dark:hover:bg-white/[0.08]"
                  }
                `}
                style={
                  preset.key !== "default"
                    ? {
                        backgroundImage: preset.value,
                        backgroundSize: "cover",
                      }
                    : undefined
                }
              >
                {/* 选中标记 */}
                {isActive && (
                  <div className="absolute top-1.5 right-1.5">
                    <CheckCircleFilled className="text-ios-blue text-[16px]" />
                  </div>
                )}
                {/* emoji + 标签 */}
                <div className="text-2xl mb-1">{preset.emoji}</div>
                <div
                  className={`text-[12px] font-semibold ${
                    isActive
                      ? "text-ios-blue"
                      : "text-gray-600 dark:text-gray-300"
                  }`}
                >
                  {preset.label}
                </div>
              </button>
            );
          })}

          {/* 自定义上传格 */}
          <div className="relative">
            {customBgUrl ? (
              /* 已有自定义背景 - 显示预览 */
              <button
                type="button"
                onClick={() => selectPreset("custom")}
                className={`
                  w-full rounded-2xl p-3 text-center transition-all duration-200
                  active:scale-95 border-2 cursor-pointer relative overflow-hidden
                  ${
                    activeKey === "custom"
                      ? "border-ios-blue shadow-lg shadow-ios-blue/20"
                      : "border-transparent hover:border-black/10 dark:hover:border-white/10"
                  }
                `}
                style={{
                  backgroundImage: `url(${customBgUrl})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              >
                {activeKey === "custom" && (
                  <div className="absolute top-1.5 right-1.5">
                    <CheckCircleFilled className="text-ios-blue text-[16px]" />
                  </div>
                )}
                <div className="text-2xl mb-1">🎨</div>
                <div className="text-[12px] font-semibold text-gray-600 dark:text-gray-300 bg-white/60 dark:bg-black/40 rounded-lg px-1">
                  自定义
                </div>
              </button>
            ) : (
              /* 未有自定义 - 上传按钮 */
              <Upload
                accept="image/*"
                showUploadList={false}
                customRequest={handleCustomUpload}
              >
                <button
                  type="button"
                  className="w-full rounded-2xl p-3 text-center transition-all duration-200
                    active:scale-95 border-2 border-dashed border-black/10 dark:border-white/15
                    hover:border-ios-blue/40 cursor-pointer bg-black/[0.02] dark:bg-white/[0.03]"
                >
                  <div className="text-xl mb-1 text-gray-400 dark:text-gray-500">
                    <PlusOutlined />
                  </div>
                  <div className="text-[12px] font-semibold text-gray-400 dark:text-gray-500">
                    自定义
                  </div>
                </button>
              </Upload>
            )}
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex gap-3">
          {customBgUrl && (
            <button
              type="button"
              onClick={handleClearCustom}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl
                bg-red-50 dark:bg-red-900/20 text-red-500 text-[13px] font-semibold
                active:scale-95 transition-all"
            >
              <DeleteOutlined className="text-[12px]" />
              清除自定义
            </button>
          )}
          {bgPreset !== "default" && (
            <button
              type="button"
              onClick={resetToDefault}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl
                bg-black/[0.04] dark:bg-white/[0.06] text-gray-500 dark:text-gray-400
                text-[13px] font-semibold active:scale-95 transition-all"
            >
              <UndoOutlined className="text-[12px]" />
              恢复默认
            </button>
          )}
        </div>
      </div>
    </Drawer>
  );
}

