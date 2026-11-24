/**
 * DormActionSheet.jsx - 宿舍操作菜单
 * 
 * 移动端 iOS 风格底部操作菜单
 */
import { 
  EditOutlined, 
  DeleteOutlined, 
  EyeOutlined,
  CheckCircleOutlined,
} from "@ant-design/icons";
import IOSActionSheet from "../../../components/common/IOSActionSheet";

import type { IOSActionSheetAction } from '../../../components/common/IOSActionSheet';
import type { EntityId } from '../../../types/service';
import type { DormRecord } from '../types';

interface DormActionSheetProps {
  open: boolean;
  onClose: () => void;
  selectedIds?: EntityId[];
  selectAcrossPages?: boolean;
  tableItems?: DormRecord[];
  totalCount?: number;
  canEdit?: boolean;
  batchLoading?: boolean;
  onView?: (dorm: DormRecord) => void;
  onEdit?: (dorm: DormRecord) => void;
  onDelete?: () => void;
  onSelectAll?: () => void;
}

/**
 * 宿舍操作菜单
 * @param {Object} props
 * @param {boolean} props.open - 是否打开
 * @param {Function} props.onClose - 关闭回调
 * @param {Array} props.selectedIds - 选中的 ID 列表
 * @param {boolean} props.selectAcrossPages - 是否跨页全选
 * @param {Array} props.tableItems - 当前页数据
 * @param {number} props.totalCount - 总记录数
 * @param {boolean} props.canEdit - 是否有编辑权限
 * @param {boolean} props.batchLoading - 批量操作 loading
 * @param {Function} props.onView - 查看详情回调
 * @param {Function} props.onEdit - 编辑回调
 * @param {Function} props.onDelete - 删除回调
 * @param {Function} props.onSelectAll - 全选回调
 */
export default function DormActionSheet({
  open,
  onClose,
  selectedIds = [],
  selectAcrossPages = false,
  tableItems = [],
  totalCount = 0,
  canEdit = false,
  batchLoading = false,
  onView,
  onEdit,
  onDelete,
  onSelectAll,
}: DormActionSheetProps) {
  const selectedCount = selectAcrossPages ? totalCount : selectedIds.length;
  const singleDorm = selectedIds.length === 1 
    ? tableItems.find((dorm) => String(dorm.id) === String(selectedIds[0])) 
    : null;

  const actions: IOSActionSheetAction[] = [
    {
      key: 'selectAll',
      label: `全选筛选结果 (${totalCount})`,
      icon: <CheckCircleOutlined />,
      type: 'default',
      hidden: selectAcrossPages || totalCount <= tableItems.length,
      onClick: () => {
        onSelectAll?.();
      },
    },
    // 单选时的详情操作
    {
      key: 'view',
      label: '查看详情',
      icon: <EyeOutlined />,
      type: 'default',
      hidden: selectedIds.length !== 1,
      onClick: () => {
        if (singleDorm) {
          onView?.(singleDorm);
        }
        onClose();
      },
    },
    // 单选时的编辑操作
    {
      key: 'edit',
      label: '编辑宿舍',
      icon: <EditOutlined />,
      type: 'primary',
      hidden: selectedIds.length !== 1 || !canEdit,
      onClick: () => {
        if (singleDorm) {
          onEdit?.(singleDorm);
        }
        onClose();
      },
    },
    // 批量删除
    {
      key: 'delete',
      label: `删除 (${selectedCount} 间)`,
      icon: <DeleteOutlined />,
      type: 'danger',
      hidden: !canEdit,
      loading: batchLoading,
      onClick: () => {
        onClose();
        onDelete?.();
      },
    },
  ];

  const singleTitle = singleDorm
    ? `${singleDorm.building || ''} ${singleDorm.roomNo || ''}`.trim()
    : '宿舍操作';

  return (
    <IOSActionSheet
      open={open}
      onClose={onClose}
      title={selectedCount > 1 ? `批量操作 (${selectedCount} 间)` : singleTitle}
      subtitle={selectAcrossPages && selectedCount === 1 ? '已选全部筛选结果' : undefined}
      actions={actions}
      cancelText="关闭"
    />
  );
}
