/**
 * 任务发布 - 检查人员选择步骤
 */

import { Input, Select, Table, Tag } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import {
  EXECUTOR_PAGE_SIZE,
  EXECUTOR_ROLES,
  ROLE_NAME_MAP,
} from "../taskPublishSchema";

import type { EntityId } from "../../../types/service";
import type { ExecutorSelectionStepProps, TaskExecutor } from "../types";

const { Option } = Select;

export default function ExecutorSelectionStep({
  executorFilter,
  setExecutorFilter,
  executorPage,
  setExecutorPage,
  executorData,
  executorLoading,
  pickerSelection,
  setPickerSelection,
  setSelectedExecutors,
  executorCache,
  userLookup,
}: ExecutorSelectionStepProps) {
  return (
    <div className="py-4">
      <div className="flex gap-4 mb-6">
        <Select
          variant="filled"
          value={executorFilter.role || undefined}
          onChange={(v) => {
            setExecutorFilter((p) => ({ ...p, role: v || "" }));
            setExecutorPage(1);
          }}
          placeholder="角色"
          className="w-40"
          allowClear
        >
          {EXECUTOR_ROLES.map((r) => (
            <Option key={r.value} value={r.value}>
              {r.label}
            </Option>
          ))}
        </Select>
        <Input
          variant="filled"
          value={executorFilter.keyword}
          onChange={(e) => {
            setExecutorFilter((p) => ({ ...p, keyword: e.target.value }));
            setExecutorPage(1);
          }}
          placeholder="搜索姓名或工号"
          className="flex-1"
          prefix={<SearchOutlined className="opacity-40" />}
        />
      </div>

      <div className="ios-inset-grouped border border-black/5 rounded-2xl overflow-hidden shadow-sm mb-4">
        <Table
          rowSelection={{
            selectedRowKeys: Array.from(pickerSelection),
            onChange: (keys) => {
              setPickerSelection(new Set(keys as EntityId[]));
              setSelectedExecutors(
                (keys as EntityId[])
                  .map((id) => executorCache[String(id)] || userLookup[String(id)])
                  .filter((executor): executor is TaskExecutor => Boolean(executor))
              );
            },
          }}
          dataSource={executorData.items}
          rowKey="id"
          loading={executorLoading}
          pagination={{
            current: executorPage,
            pageSize: EXECUTOR_PAGE_SIZE,
            total: executorData.total,
            onChange: setExecutorPage,
            className: "apple-pagination p-2",
          }}
          size="small"
          className="macos-table border border-black/5 rounded-2xl overflow-hidden shadow-sm"
          columns={[
            {
              title: "姓名",
              dataIndex: "fullName",
              key: "name",
              render: (text: string | undefined) => (
                <span className="font-bold text-gray-700 dark:text-gray-200">
                  {text}
                </span>
              ),
            },
            {
              title: "工号",
              dataIndex: "username",
              key: "uid",
              render: (text: string | undefined) => (
                <span className="font-mono text-[10px] opacity-40">{text}</span>
              ),
            },
            {
              title: "身份",
              dataIndex: "role",
              key: "role",
              render: (role: string | undefined) => (
                <Tag className="rounded-full border-none bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 px-3 m-0 text-xs font-medium">
                  {ROLE_NAME_MAP[role || ""] || role}
                </Tag>
              ),
            },
          ]}
        />
      </div>
    </div>
  );
}
