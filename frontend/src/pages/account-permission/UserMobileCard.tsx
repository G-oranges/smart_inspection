/**
 * 账号与权限管理模块 - 用户移动端卡片
 * @module pages/account-permission/UserMobileCard
 */

import { Tag } from 'antd';

import type { AccountUser } from './types';

interface UserMobileCardProps {
  user: AccountUser;
  selected?: boolean;
  onSelect?: (selected: boolean) => void;
}

/**
 * 移动端用户卡片组件
 * @param {Object} props
 * @param {Object} props.user - 用户数据
 * @param {number} props.index - 索引
 * @param {boolean} props.selected - 是否选中
 * @param {Function} props.onSelect - 选中回调
 */
export default function UserMobileCard({
  user,
  selected = false,
  onSelect,
}: UserMobileCardProps) {
  return (
    <div
      className={`mobile-compact-card ${selected ? "selected" : ""}`}
      onClick={() => onSelect && onSelect(!selected)}
    >
      <div
        className={`ios-inset-grouped p-4 mb-3 transition-all active:scale-[0.98] cursor-pointer ${selected ? "ring-2 ring-ios-blue bg-blue-50/50 dark:bg-blue-900/10" : "bg-white/80 dark:bg-white/5 backdrop-blur-md"}`}
        onClick={() => onSelect && onSelect(!selected)}
      >
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-ios-blue/10 flex items-center justify-center text-ios-blue text-sm font-bold">
              {user.fullName?.charAt(0) || user.username?.charAt(0)}
            </div>
            <div>
              <div className="text-sm font-bold text-gray-800 dark:text-white leading-tight">
                {user.fullName || user.username}
              </div>
              <div className="text-[11px] text-gray-400 font-mono mt-0.5">
                {user.username}
              </div>
            </div>
          </div>
          <Tag
            className={`rounded-full border-none px-3 m-0 text-[11px] font-bold uppercase tracking-wider ${user.isDisabled ? "bg-red-50 text-red-500" : "bg-green-50 text-green-500"}`}
          >
            {user.isDisabled ? "已停用" : "活跃"}
          </Tag>
        </div>
        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-black/5 dark:border-white/5">
          <div>
            <span className="block text-[11px] text-gray-400 font-bold uppercase tracking-widest mb-0.5">
              学院
            </span>
            <span className="text-[13px] text-gray-600 dark:text-gray-300 font-medium">
              {user.department || "-"}
            </span>
          </div>
          <div>
            <span className="block text-[11px] text-gray-400 font-bold uppercase tracking-widest mb-0.5">
              联系方式
            </span>
            <span className="text-[13px] text-gray-600 dark:text-gray-300 font-mono">
              {user.phone || "-"}
            </span>
          </div>
          <div className="col-span-2">
            <span className="block text-[11px] text-gray-400 font-bold uppercase tracking-widest mb-0.5">
              所属角色
            </span>
            <div className="flex flex-wrap gap-1 mt-1">
              {user.roles?.map((role) => (
                <Tag
                  key={role.id}
                  className="rounded-full border-none bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400 px-2 m-0 text-[11px] font-bold"
                >
                  {role.name}
                </Tag>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
