import { useEffect, useState } from "react";
import { Modal, Button, Input, Checkbox, Tag } from "antd";
import type { DragEvent } from "react";
import {
  ArrowUpOutlined,
  ArrowDownOutlined,
  HolderOutlined,
  EyeOutlined,
  SortAscendingOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { normalizeColumns } from "../utils/tableConfig";

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
      title={
        <div className="flex items-center gap-2">
          <div className="w-1 h-5 bg-blue-500 rounded-full" />
          <span className="text-base font-bold text-gray-800 dark:text-gray-100">
            {title}
          </span>
        </div>
      }
      onCancel={onClose}
      width={680}
      centered
      className="glass-modal apple-modal"
      footer={
        <div className="flex justify-between items-center p-2">
          <Button
            icon={<ReloadOutlined />}
            onClick={onReset}
            className="rounded-xl border-none bg-gray-100 dark:bg-white/10 text-gray-500"
          >
            恢复默认
          </Button>
          <div className="flex gap-2">
            <Button className="apple-btn-secondary" onClick={onClose}>
              取消
            </Button>
            <Button
              type="primary"
              onClick={handleSave}
              loading={saving}
              className="apple-btn-primary px-8"
            >
              保存更改
            </Button>
          </div>
        </div>
      }
    >
      <div className="bg-blue-50/50 dark:bg-blue-500/5 p-3 rounded-xl mb-4 border border-blue-100/50 dark:border-blue-500/10">
        <p className="text-xs text-blue-600 dark:text-blue-400 m-0 flex items-center gap-2">
          <HolderOutlined />
          提示：长按拖动左侧图标可调整列显示顺序，勾选框控制列表展示项与排序功能。
        </p>
      </div>

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

              {/* 字段标识 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[11px] font-medium px-1.5 py-0.5 bg-gray-100 dark:bg-white/10 rounded text-gray-500 uppercase tracking-wider">
                    {col.fieldKey}
                  </span>
                  {col.required && (
                    <Tag
                      color="error"
                      className="text-[10px] scale-90 border-none rounded-full"
                    >
                      必填
                    </Tag>
                  )}
                </div>
                <Input
                  variant="borderless"
                  className="p-0 text-sm font-bold text-gray-800 dark:text-gray-200 !bg-transparent hover:!placeholder-blue-300"
                  value={col.label || ""}
                  placeholder="编辑显示名称"
                  onChange={(e) =>
                    handleChange(col.fieldKey, { label: e.target.value })
                  }
                />
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
