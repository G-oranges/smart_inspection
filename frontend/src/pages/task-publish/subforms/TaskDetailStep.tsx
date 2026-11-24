/**
 * 任务发布 - 基本信息步骤
 */

import { Input, DatePicker } from "antd";
import {
  MAX_TITLE_LENGTH,
  MAX_NOTES_LENGTH,
} from "../taskPublishSchema";

import type { TaskDetailStepProps } from "../types";

const { TextArea } = Input;

export default function TaskDetailStep({
  isMobile,
  form,
  setForm,
}: TaskDetailStepProps) {
  return (
    <div className={`${isMobile ? "space-y-3" : "space-y-6"} py-3`}>
      {/* 任务名称 */}
      <div className="animate-apple-in">
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
            任务名称 *
          </span>
          <span className="text-[11px] text-gray-400 font-mono">
            {form.title.length}/{MAX_TITLE_LENGTH}
          </span>
        </div>
        <Input
          variant="filled"
          value={form.title}
          onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
          placeholder="例如：第 1 周宿舍卫生检查"
          maxLength={MAX_TITLE_LENGTH}
          className={isMobile ? "h-10" : "h-12"}
        />
      </div>

      {/* 时间周期 */}
      <div className="animate-apple-in" style={{ animationDelay: "0.05s" }}>
        <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">
          执行时间 *
        </div>
        <DatePicker.RangePicker
          variant="filled"
          showTime={{ format: "HH:mm" }}
          needConfirm={false}
          value={[form.startAt, form.deadline]}
          onChange={(vals) =>
            setForm((p) => ({
              ...p,
              startAt: vals?.[0] ?? null,
              deadline: vals?.[1] ?? null,
            }))
          }
          className={`w-full ${isMobile ? "h-10" : "h-12"}`}
          placeholder={["开始时间", "截止时间"]}
          format={isMobile ? "MM-DD HH:mm" : "YYYY-MM-DD HH:mm"}
        />
      </div>

      {/* 备注 */}
      <div className="animate-apple-in" style={{ animationDelay: "0.1s" }}>
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
            备注
          </span>
          <span className="text-[11px] text-gray-400 font-mono">
            {form.notes?.length || 0}/{MAX_NOTES_LENGTH}
          </span>
        </div>
        <TextArea
          variant="filled"
          value={form.notes}
          onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
          rows={isMobile ? 2 : 3}
          placeholder="填写检查注意事项（选填）"
          maxLength={MAX_NOTES_LENGTH}
          className="!rounded-xl text-sm py-2"
        />
      </div>
    </div>
  );
}
