import { Tag } from "antd";
import { ACTION_COLORS, formatDateTime } from "./auditLogSchema";

import type { AuditLogOptions, AuditLogRecord } from './types';

interface AuditLogMobileCardProps {
  log: AuditLogRecord;
  options: AuditLogOptions;
}

export const AuditLogMobileCard = ({
  log,
  options,
}: AuditLogMobileCardProps) => {
  const actionKey = log.action || '';
  const actionOption = options.actions.find((item) => item.value === actionKey);
  const moduleOption = options.modules.find((item) => item.value === log.module);
  
  return (
    <div className="mobile-compact-card" style={{ cursor: 'default' }}> {/* Readonly card */}
      <div className="compact-card-header">
        <div className="compact-header-left">
          <div className="compact-title" style={{ fontSize: 14 }}>
            {log.description || `${log.action} ${log.targetName || ""}`}
          </div>
          <div className="compact-subtitle">{formatDateTime(log.createdAt)}</div>
        </div>
        <div className="compact-header-right">
          <Tag color={ACTION_COLORS[actionKey] || "default"} style={{ margin: 0 }}>
            {actionOption?.label || log.action}
          </Tag>
        </div>
      </div>
      <div className="compact-card-grid">
        <div className="compact-info-item">
          <span className="compact-label">模块</span>
          <span className="compact-value">{moduleOption?.label || log.module || '-'}</span>
        </div>
        <div className="compact-info-item">
          <span className="compact-label">操作者</span>
          <span className="compact-value">{log.operatorName || log.operator?.fullName || '系统'}</span>
        </div>
        <div className="compact-info-item">
          <span className="compact-label">目标</span>
          <span className="compact-value">{log.targetName || '-'}</span>
        </div>
        <div className="compact-info-item">
          <span className="compact-label">IP</span>
          <span className="compact-value">{log.ipAddress || '-'}</span>
        </div>
      </div>
    </div>
  );
};
