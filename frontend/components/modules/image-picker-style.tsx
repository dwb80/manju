"use client";

/**
 * @file image-picker-style.tsx
 * @description 风格选择器组件，用于 AI 生图时的风格修饰选项
 */

import { Check } from "lucide-react";
import type { StyleOption, StyleValue } from "@/lib/module-types";
import { Tip } from "@/components/ui/tip";

interface StylePickerProps {
  /** 当前选中的风格 value。 */
  value: StyleValue;
  /** 选项列表（默认使用 styleOptions）。 */
  options?: StyleOption[];
  /** 选中时回调。 */
  onChange: (value: StyleValue) => void;
  /** 列数（默认 2，13 项即 2x7，可滚动）。 */
  columns?: 2 | 3;
  /** 可选类名。 */
  className?: string;
}

/**
 * StylePicker - 风格选择器组件
 * @param {StylePickerProps} props - 组件属性
 * @param {StyleValue} props.value - 当前选中的风格 value
 * @param {StyleOption[]} props.options - 选项列表
 * @param {Function} props.onChange - 选中时回调
 * @param {2|3} props.columns - 列数（默认 2）
 * @param {string} props.className - 可选类名
 * @returns {JSX.Element} 渲染的 React 元素
 * 
 * 视觉上对齐用户截图：每个 chip 显示「emoji + 名称」，选中态有 emerald 边框 + 勾选图标。
 */
export function StylePicker({
  value,
  options,
  onChange,
  columns = 2,
  className = "",
}: StylePickerProps) {
  const list = options ?? [];
  const gridClass = columns === 2 ? "grid grid-cols-2 gap-2" : "grid grid-cols-3 gap-2";

  return (
    <div className={`${gridClass} ${className}`}>
      {list.map((option) => {
        const selected = value === option.value;
        return (
          <Tip
            key={option.value || "default"}
            label={option.promptSuffix ? `追加：${option.promptSuffix}` : "不追加风格修饰"}
            side="top"
          >
            <button
              type="button"
              onClick={() => onChange(option.value)}
              className={`group relative flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-left transition-colors ${selected
                ? "border-emerald-500/70 bg-emerald-500/10 text-white"
                : "border-white/10 bg-[#252525] text-gray-200 hover:border-white/30 hover:bg-[#2a2a2a]"
                }`}
            >
              <span className="text-base leading-none" aria-hidden>
                {option.emoji ?? ""}
              </span>
              <span className="text-sm">{option.label}</span>
              {selected && (
                <span className="absolute right-1.5 top-1.5 grid h-3.5 w-3.5 place-items-center rounded-full bg-emerald-500 text-white">
                  <Check className="h-2.5 w-2.5" strokeWidth={3} />
                </span>
              )}
            </button>
          </Tip>
        );
      })}
    </div>
  );
}
