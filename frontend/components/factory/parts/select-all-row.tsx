"use client";

/**
 * 工厂页顶部全选/部分选中提示行
 *
 * - 显示当前可见项的全选状态
 * - 点击切换"全选当前页/筛选结果"
 * - 可在右侧追加"已选 N 项"等额外信息
 */

import { CheckSquare, Square } from "lucide-react";

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
