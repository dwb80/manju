"use client";

/**
 * 工厂页顶部全选/部分选中提示行
 *
 * - 显示当前可见项的全选状态
 * - 点击切换"全选当前页/筛选结果"
 * - 可在右侧追加"已选 N 项"等额外信息
 */

import { CheckSquare, Square } from "lucide-react";

/**
 * SelectAllRow - 全选/部分选中提示行组件
 * @description 工厂页顶部的全选控制行，显示当前可见项的全选状态，支持点击切换全选
 * @param {boolean} isAllSelected - 是否已全选
 * @param {boolean} isPartial - 是否部分选中
 * @param {number} allCount - 总项数
 * @param {() => void} onToggle - 切换全选回调
 * @param {React.ReactNode} [totalSelectedLabel] - 右侧追加的额外信息（如"已选 N 项"）
 * @param {boolean} [showSelectAll=true] - 是否显示全选按钮
 * @param {string} [selectAllLabel="全选当前筛选结果"] - 全选按钮文字
 * @param {string} [selectedLabel="已全选当前筛选结果"] - 已全选时的文字
 * @param {string} [partialLabel="已选部分"] - 部分选中时的文字
 * @returns {JSX.Element} 渲染的全选提示行
 */
export function SelectAllRow({
  isAllSelected,
  isPartial,
  allCount,
  onToggle,
  totalSelectedLabel,
  showSelectAll = true,
  selectAllLabel = "全选当前筛选结果",
  selectedLabel = "已全选当前筛选结果",
  partialLabel = "已选部分",
}: {
  isAllSelected: boolean;
  isPartial: boolean;
  allCount: number;
  onToggle: () => void;
  totalSelectedLabel?: React.ReactNode;
  showSelectAll?: boolean;
  selectAllLabel?: string;
  selectedLabel?: string;
  partialLabel?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 pb-3 mb-3 border-b border-white/10">
      {showSelectAll && (
        <button
          type="button"
          onClick={onToggle}
          className="flex items-center gap-2 text-xs text-[#888] hover:text-white transition-colors"
          aria-label={isAllSelected ? "取消全选" : selectAllLabel}
        >
          {isAllSelected ? (
            <CheckSquare className="h-4 w-4 text-emerald-400" />
          ) : isPartial ? (
            <Square className="h-4 w-4 text-emerald-400 opacity-50" />
          ) : (
            <Square className="h-4 w-4" />
          )}
          {isAllSelected ? selectedLabel : isPartial ? partialLabel : selectAllLabel}
        </button>
      )}
      {totalSelectedLabel}
    </div>
  );
}
