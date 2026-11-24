import { useEffect, useState } from "react";
import { Modal, Button, Input, Checkbox, Tag } from "antd";
import type { DragEvent } from "react";
import {
  ArrowUpOutlined,
  ArrowDownOutlined,
  HolderOutlined,
  EyeOutlined,
  SortAscendingOutlined,
} from "@ant-design/icons";
import { normalizeColumns } from "../utils/tableConfig";
import { MODAL_WIDTH } from "./common/modalSizes";

interface TableFieldColumn {
  fieldKey: string;
  key?: string | number;
  label?: string;
  visible?: boolean;
  sortable?: boolean;
  order?: number;
  required?: boolean;
  [key: string]: unknown;
}

interface TableFieldSettingsProps {
  open: boolean;
  columns?: TableFieldColumn[];
  onClose?: () => void;
  onSave?: (columns: TableFieldColumn[]) => void;
  onReset?: () => void;
  saving?: boolean;
  title?: string;
}

export default function TableFieldSettings({
  open,
  columns = [],
  onClose,
  onSave,
  onReset,
  saving = false,
  title = "字段显示与排序设置",
}: TableFieldSettingsProps) {
  const [draft, setDraft] = useState<TableFieldColumn[]>(columns);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  useEffect(() => {
    if (open) {
      setDraft(normalizeColumns(columns, columns));
    }
  }, [open, columns]);

  const handleChange = (
    fieldKey: string,
    patch: Partial<TableFieldColumn>,
  ) => {
    setDraft((prev) =>
      prev.map((item) =>
        item.fieldKey === fieldKey ? { ...item, ...patch } : item,
      ),
    );
  };

  const moveRow = (index: number, delta: number) => {
    const next = [...draft];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    const updated = next.map((col, idx) => ({ ...col, order: idx }));
    setDraft(updated);
  };

  // --- 原生拖拽逻辑 ---
  const handleDragStart = (idx: number) => {
    setDragIdx(idx);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>, idx: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;

    const next = [...draft];
    const item = next.splice(dragIdx, 1)[0];
    next.splice(idx, 0, item);

    setDraft(next.map((col, i) => ({ ...col, order: i })));
    setDragIdx(idx);
  };

  const handleDragEnd = () => {
    setDragIdx(null);
  };

  const handleSave = () => {
    onSave?.(draft);
  };

  return (
    <Modal
      open={open}
      title={title}
      onCancel={onClose}
      width={MODAL_WIDTH.lg}
      centered
      className="co-modal"
      footer={
        <div className="co-modal-footer co-modal-footer--split">
          <Button
            onClick={onReset}
            type="text"
          >
            恢复默认
          </Button>
          <div className="co-modal-footer">
            <Button className="apple-btn-secondary" onClick={onClose}>
              取消
            </Button>
            <Button
              type="primary"
              onClick={handleSave}
              loading={saving}
              className="apple-btn-primary"
            >
              保存更改
            </Button>
          </div>
        </div>
      }
    >
      <div className="max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
        <div className="flex flex-col gap-2">
          {draft.map((col, index) => (
            <div
              key={col.fieldKey || col.key || index}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
              className={`
                flex items-center gap-3 p-3 rounded-2xl border transition-all
                ${dragIdx === index ? "opacity-40 scale-[0.98] border-blue-400" : "bg-white dark:bg-white/5 border-transparent"}
                hover:border-blue-200 dark:hover:border-white/10 hover:shadow-sm group
              `}
            >
              {/* 拖拽手柄 */}
              <div className="cursor-grab active:cursor-grabbing p-1 text-gray-300 group-hover:text-blue-400 transition-colors">
                <HolderOutlined style={{ fontSize: 18 }} />
              </div>

              {/* 字段名称 */}
              <div className="flex-1 min-w-0 flex items-center gap-2">
                <Input
                  variant="borderless"
                  className="p-0 text-sm font-bold text-gray-800 dark:text-gray-200 !bg-transparent hover:!placeholder-blue-300"
                  value={col.label || ""}
                  placeholder="编辑显示名称"
                  onChange={(e) =>
                    handleChange(col.fieldKey, { label: e.target.value })
                  }
                />
                {col.required && (
                  <Tag
                    color="error"
                    className="text-[10px] scale-90 border-none rounded-full shrink-0"
                  >
                    必填
                  </Tag>
                )}
              </div>

              {/* 控件组 */}
              <div className="flex items-center gap-6 pr-2">
                <Checkbox
                  checked={col.visible !== false}
                  onChange={(e) =>
                    handleChange(col.fieldKey, { visible: e.target.checked })
                  }
                  className="apple-checkbox-label"
                >
                  <span className="text-[13px] text-gray-500 flex items-center gap-1.5">
                    <EyeOutlined
                      className={col.visible !== false ? "text-blue-500" : ""}
                    />
                    显示
                  </span>
                </Checkbox>

                <Checkbox
                  checked={!!col.sortable}
                  onChange={(e) =>
                    handleChange(col.fieldKey, { sortable: e.target.checked })
                  }
                  className="apple-checkbox-label"
                >
                  <span className="text-[13px] text-gray-500 flex items-center gap-1.5">
                    <SortAscendingOutlined
                      className={col.sortable ? "text-blue-500" : ""}
                    />
                    排序
                  </span>
                </Checkbox>
              </div>

              {/* 始终显示的备选排序按钮，以便用户更清晰地进行位置调整 */}
              <div className="flex items-center gap-1">
                <Button
                  type="text"
                  size="small"
                  icon={<ArrowUpOutlined style={{ fontSize: 12 }} />}
                  onClick={(e) => {
                    e.stopPropagation();
                    moveRow(index, -1);
                  }}
                  disabled={index === 0}
                  className="text-gray-400 hover:text-blue-500"
                />
                <Button
                  type="text"
                  size="small"
                  icon={<ArrowDownOutlined style={{ fontSize: 12 }} />}
                  onClick={(e) => {
                    e.stopPropagation();
                    moveRow(index, 1);
                  }}
                  disabled={index === draft.length - 1}
                  className="text-gray-400 hover:text-blue-500"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(0, 0, 0, 0.05);
          border-radius: 10px;
        }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
        }
        .apple-checkbox-label .ant-checkbox + span {
          padding-inline-start: 6px;
        }
      `}</style>
    </Modal>
  );
}
