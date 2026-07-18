"use client";

/**
 * 工厂页工具栏内的批量操作条
 *
 * 选中项 > 0 时显示。包含：
 * - "已选 N 项" 提示
 * - 全选当前页 / 取消选择
 * - 可选的"批量改类型"按钮
 * - 批量删除
 */

import { CheckSquare, X, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { FilterOption } from "../types";
import { BatchChangeTypeMenu } from "./batch-change-type-menu";

/**
 * FactoryBatchActionsBar - 工厂页批量操作条组件
 * @description 选中项大于0时显示的批量操作条，包含已选计数、全选、取消选择、批量改类型、批量删除等功能
 * @param {number} count - 已选数量
 * @param {string} selectAllLabel - 全选按钮文字
 * @param {() => void} onSelectAll - 全选回调
 * @param {() => void} onClear - 取消选择回调
 * @param {() => void} onDelete - 批量删除回调
 * @param {Object} [batchTypeConfig] - 批量改类型配置
 * @param {(value: string) => void} [onChangeType] - 改类型回调
 * @returns {JSX.Element} 渲染的批量操作条
 */
export function FactoryBatchActionsBar({
  count,
  selectAllLabel,
  onSelectAll,
  onClear,
  onDelete,
  batchTypeConfig,
  onChangeType,
}: {
  count: number;
  selectAllLabel: string;
  onSelectAll: () => void;
  onClear: () => void;
  onDelete: () => void;
  batchTypeConfig?: {
    buttonLabel: string;
    options: FilterOption[];
    onSelect: (value: string) => void;
  };
  onChangeType?: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-1.5">
      <span className="text-xs font-medium text-emerald-300">已选 {count} 项</span>
      <span className="h-4 w-px bg-white/10" />
      <Button variant="ghost" size="sm" onClick={onSelectAll} className="text-xs">
        <CheckSquare className="mr-1 h-3 w-3" />
        {selectAllLabel}
      </Button>
      <Button variant="ghost" size="sm" onClick={onClear} className="text-xs">
        <X className="mr-1 h-3 w-3" />
        取消选择
      </Button>
      {batchTypeConfig && onChangeType && (
        <>
          <span className="h-4 w-px bg-white/10" />
          <BatchChangeTypeMenu
            options={batchTypeConfig.options}
            onSelect={onChangeType}
            label={batchTypeConfig.buttonLabel}
          />
        </>
      )}
      <Button variant="destructive" size="sm" onClick={onDelete} className="text-xs">
        <Trash2 className="mr-1 h-3 w-3" />
        批量删除
      </Button>
    </div>
  );
}
