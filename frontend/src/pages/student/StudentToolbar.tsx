/**
 * 学生管理工具栏组件（桌面端）
 * @module pages/student/StudentToolbar
 */

import { Button, Input } from "antd";
import {
  SearchOutlined,
  PlusOutlined,
  ExportOutlined,
  ImportOutlined,
  SettingOutlined,
  CloseCircleOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import FilterDropdownPanel from "../../components/common/FilterDropdownPanel";
import CollegeMajorClassCascader from "../../components/common/CollegeMajorClassCascader";
import { prefetchImportWizardModal } from "../../components/common/importWizardPrefetch";

import type { StudentToolbarProps } from "./types";

/**
 * 学生管理工具栏（桌面端）
 * @param {Object} props - 组件属性
 */
export default function StudentToolbar({
  // 搜索相关
  draftSearchTerm,
  setDraftSearchTerm,
  isDirty,
  loading,
  onSearch,
  onReset,
  // 权限
  canEdit,
  canImport,
  canExport,
  // 操作回调
  onOpenModal,
  onOpenImport,
  onExport,
  onOpenSettings,
  // 批量操作
  batchLoading,
  onBulkDelete,
  // 筛选相关
  draftFilters,
  setDraftFilters,
  uniqueGrades,
  buildings,
  // 选中状态相关
  selectedCount,
  selectAcrossPages,
  tableTotal,
  tableItemsLength,
  paginationCurrent,
  onSelectAllResults,
  onClearSelection,
}: StudentToolbarProps) {
  return (
    <>
      {/* 搜索栏和操作按钮 */}
      <div className="dorm-toolbar-shell">
        <div className="dorm-toolbar-row dorm-toolbar-row-main">
          <Input
            placeholder="搜索姓名、学号、手机号..."
            prefix={<SearchOutlined className="text-gray-400" />}
            className="apple-search-input dorm-toolbar-search !bg-gray-100/50 dark:!bg-white/5 border-none flex-1 min-w-[220px]"
            value={draftSearchTerm}
            onChange={(e) => setDraftSearchTerm(e.target.value)}
            onPressEnter={onSearch}
            allowClear
          />
          <Button
            type="primary"
            icon={<SearchOutlined />}
            onClick={onSearch}
            disabled={!isDirty}
            loading={loading}
            className="apple-btn-primary dorm-toolbar-button dorm-toolbar-button-primary active:scale-95 transition-all border-none"
          >
            搜索
          </Button>
          <Button
            onClick={onReset}
            className="dorm-toolbar-button dorm-toolbar-button-subtle active:scale-95 transition-all"
            icon={<ReloadOutlined />}
          >
            重置
          </Button>
        </div>

        {/* 操作按钮组 */}
        <div className="dorm-toolbar-row dorm-toolbar-row-actions">
          {canEdit && (
            <Button
              type="primary"
              className="apple-btn-primary dorm-toolbar-button dorm-toolbar-button-primary active:scale-95 transition-all"
              icon={<PlusOutlined />}
              onClick={onOpenModal}
            >
              新增学生
            </Button>
          )}
          {canImport && (
            <Button
              className="dorm-toolbar-button dorm-toolbar-button-subtle active:scale-95 transition-all"
              icon={<ImportOutlined />}
              onClick={onOpenImport}
              onMouseEnter={prefetchImportWizardModal}
              onFocus={prefetchImportWizardModal}
              onTouchStart={prefetchImportWizardModal}
            >
              导入
            </Button>
          )}
          {canExport && (
            <Button
              className="dorm-toolbar-button dorm-toolbar-button-subtle active:scale-95 transition-all"
              icon={<ExportOutlined />}
              onClick={onExport}
            >
              导出
            </Button>
          )}
          <Button
            className="dorm-toolbar-button dorm-toolbar-button-subtle active:scale-95 transition-all"
            icon={<SettingOutlined className="text-gray-600 dark:text-gray-300" />}
            onClick={onOpenSettings}
          >
            字段管理
          </Button>
          {/* 批量删除按钮 */}
          {canEdit && selectedCount > 0 && (
            <Button
              danger
              className="dorm-toolbar-button dorm-toolbar-button-danger active:scale-95 transition-all ml-2"
              icon={<CloseCircleOutlined />}
              loading={batchLoading}
              onClick={onBulkDelete}
            >
              删除 ({selectedCount})
            </Button>
          )}
        </div>
      </div>

      {/* 筛选下拉面板 */}
      <div className="dorm-toolbar-row dorm-toolbar-row-filters">
        <FilterDropdownPanel
          filters={[
            {
              key: "grade",
              label: "年级",
              options: uniqueGrades.map((g) => ({
                label: g,
                value: g,
              })),
              value: draftFilters.grade || [],
              onChange: (val) =>
                setDraftFilters((prev) => ({ ...prev, grade: val })),
            },
            {
              key: "gender",
              label: "性别",
              options: [
                { label: "男", value: "男" },
                { label: "女", value: "女" },
                { label: "未指定", value: "未指定" },
              ],
              value: draftFilters.gender || [],
              onChange: (val) =>
                setDraftFilters((prev) => ({
                  ...prev,
                  gender: val,
                })),
            },
            {
              key: "college_major_class",
              label: "学院专业班级",
              value: [
                ...(draftFilters.college || []),
                ...(draftFilters.major || []),
                ...(draftFilters.className || []),
              ],
              customRender: (
                <CollegeMajorClassCascader
                  value={{
                    college: draftFilters.college,
                    major: draftFilters.major,
                    className: draftFilters.className,
                  }}
                  onChange={(val) => {
                    setDraftFilters((prev) => ({
                      ...prev,
                      college: val.college ?? [],
                      major: val.major ?? [],
                      className: val.className ?? [],
                    }));
                  }}
                />
              ),
              onChange: () => {},
            },
            {
              key: "building",
              label: "楼栋",
              options: buildings
                .map((building) => building.name)
                .filter((name): name is string => Boolean(name))
                .map((name) => ({
                  label: name,
                  value: name,
                })),
              value: draftFilters.building || [],
              onChange: (val) => {
                setDraftFilters((prev) => ({
                  ...prev,
                  building: val,
                  floor: [],
                  roomNo: [],
                }));
              },
            },
          ]}
        />
      </div>

      {/* 选中状态显示 */}
      {selectedCount > 0 && (
        <div className="mt-2 flex items-center justify-between p-3 bg-blue-500/10 rounded-2xl border border-blue-500/20">
          <div className="flex items-center gap-3">
            <span className="text-blue-600 font-medium text-sm">
              已选择 {selectedCount} 名学生
              {selectAcrossPages && " (跨全页)"}
            </span>
            {paginationCurrent > 1 || tableTotal > tableItemsLength
              ? !selectAcrossPages && (
                  <Button
                    type="link"
                    size="small"
                    className="text-blue-600 font-semibold p-0 h-auto"
                    onClick={onSelectAllResults}
                  >
                    选择所有筛选结果 ({tableTotal})
                  </Button>
                )
              : null}
          </div>
          <Button
            type="link"
            size="small"
            className="text-gray-500 p-0 h-auto"
            onClick={onClearSelection}
          >
            清空
          </Button>
        </div>
      )}
    </>
  );
}
