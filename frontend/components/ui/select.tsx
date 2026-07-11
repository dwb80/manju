"use client";

/**
 * Select 下拉框组件
 *
 * 用于选择选项的下拉框
 */

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  /** 选项列表 */
  options?: { value: string; label: string }[];
  /** 占位符文本 */
  placeholder?: string;
}

export function Select({ className, options = [], placeholder, ...props }: SelectProps) {
  return (
    <div className="relative">
      <select
        className={cn(
          "h-10 w-full appearance-none rounded-md border border-white/20 bg-[#252525] px-3 py-2 pr-10 text-sm text-white transition-colors",
          "focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      >
        {placeholder && (
          <option value="" disabled className="text-[#888]">
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option key={option.value} value={option.value} className="text-white bg-[#252525]">
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#888] pointer-events-none" />
    </div>
  );
}