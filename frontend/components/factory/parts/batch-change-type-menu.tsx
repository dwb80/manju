"use client";

/**
 * 工厂页工具栏内"批量改类型"下拉菜单
 *
 * - 基于 shadcn Popover 自动处理：
 *   - 点击外部关闭
 *   - ESC 关闭
 *   - Portal 渲染避免 z-index 冲突
 *   - 焦点管理
 * - 保留旧 API：{ options, onSelect, label }，调用方零迁移
 */

import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Check } from "lucide-react";
import type { FilterOption } from "../types";

/**
 * BatchChangeTypeMenu - 批量改类型下拉菜单组件
 * @description 工厂页工具栏内的批量改类型下拉菜单，基于 shadcn Popover 实现点击外部关闭、ESC 关闭等功能
 * @param {FilterOption[]} options - 类型选项列表
 * @param {(value: string) => void} onSelect - 选择回调
 * @param {string} label - 按钮文字
 * @param {string} [currentValue] - 当前选中值（用于高亮显示）
 * @returns {JSX.Element} 渲染的下拉菜单组件
 */
export function BatchChangeTypeMenu({
  options,
  onSelect,
  label,
  currentValue,
}: {
  options: FilterOption[];
  onSelect: (value: string) => void;
  label: string;
  /** 当前选中值（高亮显示） */
  currentValue?: string;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="secondary" size="sm" className="text-xs gap-1">
          {label}
          <ChevronDown className="h-3 w-3 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[180px] p-1">
        <div className="max-h-72 overflow-y-auto">
          {options.map((opt) => {
            const isCurrent = currentValue === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onSelect(opt.value)}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs text-white hover:bg-white/10"
              >
                {isCurrent ? (
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                ) : (
                  <span className="h-3.5 w-3.5" />
                )}
                <span className="flex-1">{opt.label}</span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
