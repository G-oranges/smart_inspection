import { useState, useEffect, useCallback, useImperativeHandle, forwardRef } from "react";
import { createPortal } from "react-dom";
import { DatePicker, Input, Button, Tag, Tooltip, Space, Typography, Divider, Empty, message, Alert, Drawer, FloatButton, Badge, Modal } from "antd";
import PanelSelect from './common/PanelSelect';
import { SearchOutlined, ReloadOutlined, ClockCircleOutlined, SwapOutlined, UserOutlined, InfoCircleOutlined, HistoryOutlined, DeleteOutlined, FilterOutlined } from "@ant-design/icons";
import type { Dayjs } from "dayjs";
import type { Key, ReactNode } from "react";
import type { TableProps } from "antd";
import { useAppContext } from "../context/AppContext";
import { useMobile } from "../hooks/useMobile";
import ResponsiveDataView from "./ResponsiveDataView";
import GlassTable from "./GlassTable";
import { dormService } from "../services/dormService";
import { tokenManager } from "../utils/api";
import { confirmDangerCountdown } from "../utils/confirm";
import type { EntityId, ServiceRecord, ServiceTableResponse } from "../types/service";
import type { QueryParams } from "../types/api";

const { RangePicker } = DatePicker;
const { Text } = Typography;

type DateRangeValue = [Dayjs, Dayjs] | null;

interface OccupancyHistoryFilters {
  action?: string;
  keyword: string;
  dateRange: DateRangeValue;
}

interface OccupancyHistoryStats {
  total: number;
  todayCount: number;
  latestTime: string | null;
}

interface OccupancyHistoryProps {
  externalFilters?: OccupancyHistoryFilters;
  onFiltersChange?: React.Dispatch<React.SetStateAction<OccupancyHistoryFilters>>;
  onStatsChange?: (stats: OccupancyHistoryStats) => void;
  hideFilterBar?: boolean;
}

interface OccupancyHistoryRef {
  reload: () => void;
  getStats: () => { total: number; logs: OccupancyLogRecord[] };
}

interface OccupancyLogRecord extends ServiceRecord {
  id?: EntityId;
  createdAt?: string;
  action?: string;
  description?: string;
  targetName?: string;
  targetId?: EntityId;
  operatorName?: string;
  operator?: {
    name?: string;
    [key: string]: unknown;
  };
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
}

interface OccupancyHistoryResponse extends ServiceTableResponse {
  items: OccupancyLogRecord[];
  page?: number;
  pageSize?: number;
  todayCount?: number;
}

interface AppEntityLike extends ServiceRecord {
  id?: EntityId;
  fullName?: string;
  building?: string;
  roomNo?: string | number;
  roomNumber?: string | number;
  bedNo?: string | number;
}

interface ServiceError {
  message?: string;
}

// 针对宿舍异动的动作映射
const ACTION_COLORS: Record<string, string> = {
  CREATE: "green",    // 可能对应 分配
  UPDATE: "blue",     // 可能对应 换宿/调宿
  DELETE: "red",      // 可能对应 退宿
  ASSIGN: "cyan",     // 如果有特定 Action
  SWAP: "geekblue",
  MOVE: "purple",
  CHECKOUT: "magenta"
};

const ACTION_LABELS: Record<string, string> = {
  CREATE: "创建",
  UPDATE: "更新",
  DELETE: "删除",
  ASSIGN: "分配",
  SWAP: "调宿",
  MOVE: "换宿",
  CHECKOUT: "退宿"
};

const FIELD_LABELS: Record<string, string> = {
    studentName: "学生姓名",
    bedNo: "床位号",
    dormName: "宿舍",
    building: "楼栋",
    room: "房间",
    status: "状态"
};

/**
 * OccupancyHistory 组件
 * @param {Object} props
 * @param {Object} props.externalFilters - 外部传入的筛选状态 { action, keyword, dateRange }
 * @param {Function} props.onFiltersChange - 筛选状态变化回调
 * @param {Function} props.onStatsChange - 统计数据变化回调 (total, todayCount)
 * @param {boolean} props.hideFilterBar - 是否隐藏内部筛选栏（由父组件统一渲染）
 */
const OccupancyHistory = forwardRef<OccupancyHistoryRef, OccupancyHistoryProps>(function OccupancyHistory({ 
  externalFilters, 
  onFiltersChange, 
  onStatsChange,
  hideFilterBar = false 
}, ref) {
  const { data: globalData } = useAppContext();
  const isMobile = useMobile();
  const [logs, setLogs] = useState<OccupancyLogRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  
  // 使用外部筛选状态或内部状态
  const [internalFilters, setInternalFilters] = useState<OccupancyHistoryFilters>({
    action: undefined,
    keyword: "",
    dateRange: null,
  });
  
  // 决定使用哪个筛选状态
  const filters = externalFilters || internalFilters;
  const setFilters = onFiltersChange || setInternalFilters;
  
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);
  const [fetchError, setFetchError] = useState("");
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  
  // 暴露方法给父组件
  useImperativeHandle(ref, () => ({
    reload: () => loadLogs(1, pagination.pageSize),
    getStats: () => ({ total: pagination.total, logs }),
  }));

  const loadLogs = useCallback(async (page = 1, pageSize = 20) => {
    if (!tokenManager.hasTokens()) return;
    setLoading(true);
    setFetchError("");
    try {
      const params: QueryParams = {
        page,
        pageSize,
        keyword: filters.keyword,
        action: filters.action
      };
      
      if (filters.dateRange && filters.dateRange.length === 2) {
        params.dateFrom = filters.dateRange[0].toISOString();
        params.dateTo = filters.dateRange[1].toISOString();
      }

      const data = await dormService.getOccupancyHistory(params) as OccupancyHistoryResponse;
      setLogs(data.items || []);
      const newPagination = {
        current: data.page || 1,
        pageSize: data.pageSize || 20,
        total: data.total || 0,
      };
      setPagination(newPagination);
      
      // 通知父组件统计数据变化
      if (onStatsChange) {
        onStatsChange({
          total: data.total || 0,
          todayCount: data.todayCount || 0, // 后端可提供
          latestTime: data.items?.[0]?.createdAt || null,
        });
      }
    } catch (error) {
      console.error("加载异动记录失败:", error);
      setFetchError((error as ServiceError).message || "加载异动记录失败，请稍后重试");
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [filters, onStatsChange]);

  useEffect(() => {
    loadLogs(1, pagination.pageSize);
  }, [loadLogs, pagination.pageSize]);

  const handleSearch = () => loadLogs(1, pagination.pageSize);
  const handleReset = () => {
    setFilters({ action: undefined, keyword: "", dateRange: null });
  }; // useEffect will trigger reload

  // === Helpers ===
  const resolveName = (id: unknown) => {
     if (!id || typeof id !== 'string' || id.length < 20) return id;
     const student = (globalData?.students as AppEntityLike[] | undefined)?.find((s) => s.id === id);
     if (student) return `${student.fullName}`;
     const dorm = (globalData?.dorms as AppEntityLike[] | undefined)?.find((d) => d.id === id);
     if (dorm) return `${dorm.building}-${dorm.roomNo || dorm.roomNumber}`;
     const bed = (globalData?.dormBeds as AppEntityLike[] | undefined)?.find((b) => b.id === id);
     if (bed) return `${bed.bedNo}号床`;
     return id;
  };

  const formatDescription = (text?: string) => {
      if (!text) return text;
      // Replace UUIDs found in text
      return text.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, (match) => String(resolveName(match) ?? match));
  };

  const handleBatchDelete = async () => {
    if (!selectedRowKeys.length) return;
    const firstConfirmed = await new Promise((resolve) => {
      Modal.confirm({
        title: "确认批量删除历史记录",
        content: `即将删除选中的 ${selectedRowKeys.length} 条历史记录，删除后无法恢复。`,
        okText: "确认删除",
        okType: "danger",
        cancelText: "取消",
        maskClosable: false,
        keyboard: false,
        onOk: () => resolve(true),
        onCancel: () => resolve(false),
      });
    });
    if (!firstConfirmed) return;

    const finalConfirmed = await confirmDangerCountdown({
      title: "是否确认 — 删除历史记录",
      content: `将永久删除选中的 ${selectedRowKeys.length} 条记录，确认继续？`,
      okText: "确认删除",
    });
    if (!finalConfirmed) return;

    setLoading(true);
    try {
      await dormService.deleteOccupancyHistory(selectedRowKeys.filter((key): key is EntityId => typeof key === "string" || typeof key === "number"));
      message.success("历史记录已清除");
      setSelectedRowKeys([]);
      loadLogs(1, pagination.pageSize);
    } catch (error) {
      console.error(error);
      message.error("删除失败");
    } finally {
      setLoading(false);
    }
  };

  // === 渲染辅助函数 (复用自 AuditLogPage 但简化) ===
  const formatDateTime = (value?: string) => {
    if (!value) return "-";
    return new Date(value).toLocaleString("zh-CN", {
      year: "numeric", month: "2-digit", day: "2-digit", 
      hour: "2-digit", minute: "2-digit"
    });
  };

  const renderChangesDetail = (record: OccupancyLogRecord) => {
      // 仅展示 UPDATE 的详情，或者 CREATE/DELETE 的关键信息
      // 对于 Occupancy，我们主要关注 oldValue vs newValue
      if (!record.oldValue && !record.newValue) return null;
      
      const { oldValue, newValue } = record;
      const changedFields = new Set([
        ...Object.keys(oldValue || {}),
        ...Object.keys(newValue || {}),
      ]);
      
      // 过滤掉不感兴趣的系统字段
      const validFields = Array.from(changedFields).filter((field) => !['id', 'updatedAt', 'version'].includes(field));
      
      if (validFields.length === 0) return <div style={{ padding: 12, color: '#999' }}>无详细变更记录</div>;

      return (
        <div style={{ padding: "12px 20px", background: "var(--info-bg)", borderRadius: 8 }}>
           <div style={{ marginBottom: 8, fontWeight: 500, color: "#666" }}>
             <SwapOutlined style={{ marginRight: 8 }} /> 变更详情
           </div>
           
           <div style={{ display: 'grid', gap: 8 }}>
               {validFields.map(field => {
                   const oldVal = oldValue?.[field];
                   const newVal = newValue?.[field];
                   // 如果也是对象（比如关联对象），尝试取 name 或 JSON stringify
                   // 如果是 UUID，尝试从 globalData 解析
                   const formatVal = (v: unknown): ReactNode => {
                       if (v === null || v === undefined) return <Text type="secondary">空</Text>;
                       if (typeof v === 'object') return (v as { name?: string }).name || JSON.stringify(v);
                       return String(resolveName(v));
                   };
                   
                   return (
                       <div key={field} style={{ display: 'flex', alignItems: 'center', fontSize: '13px' }}>
                           <span style={{ width: 80, color: '#888' }}>{FIELD_LABELS[field] || field}:</span>
                           <Space>
                               <Tag style={{ margin: 0 }} color={oldVal ? 'red' : 'default'}>{formatVal(oldVal)}</Tag>
                               <SwapOutlined style={{ color: '#ccc', fontSize: '12px' }} />
                               <Tag style={{ margin: 0 }} color={newVal ? 'green' : 'default'}>{formatVal(newVal)}</Tag>
                           </Space>
                       </div>
                   );
               })}
           </div>
        </div>
      );
  };

  const columns: TableProps<OccupancyLogRecord>["columns"] = [
    {
      title: "时间",
      dataIndex: "createdAt",
      width: 170,
      render: (val?: string) => <span style={{ color: '#666' }}><ClockCircleOutlined style={{ marginRight: 6 }}/>{formatDateTime(val)}</span>
    },
    {
      title: "操作",
      dataIndex: "action",
      width: 100,

      render: (action?: string) => <Tag color={ACTION_COLORS[action || ""] || 'default'}>{ACTION_LABELS[action || ""] || action}</Tag>
    },
    {
      title: "描述",
      dataIndex: "description",
      render: (text: string | undefined, record: OccupancyLogRecord) => {
          const actionLabel = ACTION_LABELS[record.action || ""] || record.action;
          const display = formatDescription(text || `${actionLabel} ${record.targetName || ''}`);
          return (
            <Tooltip title={display}>
                <span>{display}</span>
            </Tooltip>
          );
      }
    },
    {
      title: "对象",
      dataIndex: "targetName",
      width: 150,
      ellipsis: true,
      render: (text: string | undefined, record: OccupancyLogRecord) => {
          // 优先使用 backend 提供的 targetName
          if (text && text.length < 30) return text;
          
          // 如果 targetName 是 UUID 或无效，尝试解析 targetId
          const id = record.targetId || text;
          if (!id) return '-';
          
          const student = (globalData?.students as AppEntityLike[] | undefined)?.find((s) => s.id === id);
          if (student) return student.fullName;
          
          const dorm = (globalData?.dorms as AppEntityLike[] | undefined)?.find((d) => d.id === id);
          if (dorm) return `${dorm.building}-${dorm.roomNo || dorm.roomNumber}`;
          
          return text || id || '-';
      }
    },
    {
      title: "操作人",
      dataIndex: "operatorName",
      width: 120,
      render: (text: string | undefined, record: OccupancyLogRecord) => (
          <span><UserOutlined style={{ marginRight: 4 }}/>{text || record.operator?.name || '系统'}</span>
      )
    }
  ];

  const renderCard = (record: OccupancyLogRecord, _index: number, { selected, onSelect }: { selected: boolean; onSelect?: (checked: boolean) => void }) => {
    const isSelected = selected;
    const actionLabel = ACTION_LABELS[record.action || ""] || record.action;
    const actionColor = ACTION_COLORS[record.action || ""] || 'default';
    const displayDesc = formatDescription(record.description || `${actionLabel} ${record.targetName || ''}`);

    return (
      <div 
        className={`mobile-compact-card ${isSelected ? 'selected' : ''}`}
        onClick={() => onSelect && onSelect(!isSelected)}
        style={{ marginBottom: 12 }}
      >
        <div className="compact-card-header">
          <div className="compact-header-left">
            <div className="compact-title">{actionLabel}</div>
            <div className="compact-subtitle">{formatDateTime(record.createdAt)}</div>
          </div>
          <div className="compact-header-right">
            <Tag color={actionColor} style={{ margin: 0 }}>{actionLabel}</Tag>
          </div>
        </div>
        
        <div style={{ padding: '0 12px 12px', fontSize: '13px', color: '#666' }}>
          {displayDesc}
        </div>

        <div className="compact-card-grid">
          <div className="compact-info-item">
            <span className="compact-label">操作人</span>
            <span className="compact-value">{record.operatorName || record.operator?.name || '系统'}</span>
          </div>
          <div className="compact-info-item">
            <span className="compact-label">对象</span>
            <span className="compact-value">{record.targetName || '-'}</span>
          </div>
        </div>

        {isSelected && (record.oldValue || record.newValue) && (
          <div className="compact-card-actions" onClick={(e) => e.stopPropagation()} style={{ borderTop: '1px solid rgba(0,0,0,0.05)', marginTop: 8, paddingTop: 8 }}>
            {renderChangesDetail(record)}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="occupancy-history">
        {/* Filter Bar - 当 hideFilterBar 为 true 时由父组件渲染 */}
        {!hideFilterBar && (
        <div className="filter-bar" style={{ 
            display: "flex", 
            gap: 12, 
            flexWrap: "wrap", 
            alignItems: "center",
            padding: "0 0 16px 0" 
        }}>
            {isMobile ? (
              <div style={{ display: 'flex', gap: 8, width: '100%' }}>
                  <Input 
                      placeholder="搜索学生/宿舍..." 
                      prefix={<SearchOutlined />} 
                      value={filters.keyword}
                      onChange={(e) => setFilters((prev) => ({ ...prev, keyword: e.target.value }))}
                      onPressEnter={handleSearch}
                      style={{ flex: 1 }}
                      allowClear
                  />
                  <Button 
                    icon={<FilterOutlined />} 
                    onClick={() => setFilterDrawerOpen(true)}
                  >
                    筛选
                    {(filters.action || filters.dateRange) && (
                      <Badge dot offset={[2, -2]}>
                        <span />
                      </Badge>
                    )}
                  </Button>
                  <Button icon={<ReloadOutlined />} onClick={handleReset}>重置</Button>
              </div>
            ) : (
              <>
                <RangePicker 
                    showTime 
                    placeholder={['开始时间', '结束时间']}
                    value={filters.dateRange}
                    onChange={(dates) => setFilters((prev) => ({ ...prev, dateRange: dates as DateRangeValue }))}
                    style={{ width: 260 }}
                />
                <Input 
                    placeholder="搜索学生/宿舍..." 
                    prefix={<SearchOutlined />} 
                    value={filters.keyword}
                    onChange={(e) => setFilters((prev) => ({ ...prev, keyword: e.target.value }))}
                    onPressEnter={handleSearch}
                    style={{ width: 200 }}
                    allowClear
                />
                <PanelSelect
                    placeholder="动作类型"
                    allowClear
                    style={{ width: 120 }}
                    value={filters.action}
                    onChange={(val) => setFilters((prev) => ({ ...prev, action: val }))}
                    options={[
                        { label: '分配', value: 'CREATE' },
                        { label: '变动', value: 'UPDATE' },
                        { label: '退宿', value: 'DELETE' },
                    ]}
                />
                <Space style={{ marginLeft: 'auto' }}>
                    {selectedRowKeys.length > 0 && (
                        <Button danger icon={<DeleteOutlined />} onClick={handleBatchDelete}>
                          删除 ({selectedRowKeys.length})
                        </Button>
                    )}
                    <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>搜索</Button>
                    <Button icon={<ReloadOutlined />} onClick={handleReset}>重置</Button>
                </Space>
              </>
            )}
        </div>
        )}

        {/* Content */}
        {fetchError ? (
          <div className="error-state">
            <Alert 
              message={fetchError} 
              type="error" 
              showIcon 
              action={<Button size="small" onClick={() => loadLogs(1, pagination.pageSize)}>重试</Button>}
            />
          </div>
        ) : isMobile ? (
            <>
            <ResponsiveDataView
                isMobile={true}
                dataSource={logs}
                loading={loading}
                rowKey="id"
                emptyText="暂无异动记录"
                renderCard={renderCard}
                selectedKeys={selectedRowKeys}
                onSelectChange={setSelectedRowKeys}
                pagination={pagination}
                onPaginationChange={(c, s) => loadLogs(c, s)}
            />
            
            <Drawer
              title="筛选记录"
              placement="bottom"
              onClose={() => setFilterDrawerOpen(false)}
              open={filterDrawerOpen}
              styles={{
                body: { paddingBottom: 80 }
              }}
              footer={
                <div style={{ 
                  textAlign: 'right', 
                  display: 'flex', 
                  gap: 12,
                  width: '100%',
                  padding: '0 8px' // slight padding adjustment
                }}>
                  <Button block onClick={() => setFilterDrawerOpen(false)}>
                    取消
                  </Button>
                  <Button type="primary" block onClick={() => { handleSearch(); setFilterDrawerOpen(false); }}>
                    确认
                  </Button>
                </div>
              }
            >
              <Space direction="vertical" style={{ width: '100%' }} size="middle">
                  <div>
                      <div style={{ marginBottom: 8, fontWeight: 500 }}>动作类型</div>
                      <PanelSelect
                          placeholder="选择动作类型"
                          allowClear
                          style={{ width: '100%' }}
                          value={filters.action}
                          onChange={(val) => setFilters((prev) => ({ ...prev, action: val }))}
                          options={[
                              { label: '分配', value: 'CREATE' },
                              { label: '变动', value: 'UPDATE' },
                              { label: '退宿', value: 'DELETE' },
                          ]}
                      />
                  </div>
                  <div>
                      <div style={{ marginBottom: 8, fontWeight: 500 }}>时间范围</div>
                      <RangePicker 
                          showTime 
                          placeholder={['开始', '结束']}
                          value={filters.dateRange}
                          onChange={(dates) => setFilters((prev) => ({ ...prev, dateRange: dates as DateRangeValue }))}
                          style={{ width: '100%' }}
                      />
                  </div>
              </Space>
            </Drawer>
            
            {selectedRowKeys.length > 0 && createPortal(
              <div className="bottom-selection-bar">
                <div className="selection-info">已选择 {selectedRowKeys.length} 条记录</div>
                <Space>
                  <Button size="small" ghost onClick={() => setSelectedRowKeys([])}>取消</Button>
                  <Button size="small" danger type="primary" onClick={handleBatchDelete}>
                    清除记录
                  </Button>
                </Space>
              </div>,
              document.body
            )}
        </>
        ) : (
            <div className="table-wrapper dorm-table-wrapper">
              <GlassTable
                  className="macos-table dorm-table"
                  columns={columns}
                  dataSource={logs}
                  rowKey="id"
                  loading={loading}
                  pagination={pagination}
                  onChange={(p) => setPagination((prev) => ({ ...prev, current: p.current ?? prev.current, pageSize: p.pageSize ?? prev.pageSize }))}
                  expandable={{
                      expandedRowRender: renderChangesDetail,
                      rowExpandable: (record) => Boolean(record.oldValue || record.newValue),
                      expandRowByClick: true
                  }}
                  rowSelection={{
                      selectedRowKeys,
                      onChange: (keys) => setSelectedRowKeys(keys)
                  }}
              />
            </div>
        )}
    </div>
  );
});

export default OccupancyHistory;
