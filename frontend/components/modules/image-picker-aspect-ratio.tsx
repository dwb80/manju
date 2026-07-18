"use client";

/**
 * @file image-picker-aspect-ratio.tsx
 * @description 图片比例选择器组件，用于 AI 生图时的比例选项
 */

import { Check } from "lucide-react";
import type { AspectRatioOption, ImageRatio } from "@/lib/module-types";
import { Tip } from "@/components/ui/tip";

interface AspectRatioPickerProps {
  /** 当前选中的比例（value）。 */
  value: ImageRatio;
  /** 选项列表（默认使用 aspectRatioOptions）。 */
  options?: AspectRatioOption[];
  /** 选中时回调。 */
  onChange: (ratio: ImageRatio) => void;
  /** 列数（默认 3，6 项即 3x2）。 */
  columns?: 2 | 3;
  /** 可选类名。 */
  className?: string;
}

/**
 * AspectRatioPicker - 图片比例选择器组件
 * @param {AspectRatioPickerProps} props - 组件属性
 * @param {ImageRatio} props.value - 当前选中的比例（value）
 * @param {AspectRatioOption[]} props.options - 选项列表
 * @param {Function} props.onChange - 选中时回调
 * @param {2|3} props.columns - 列数（默认 3）
 * @param {string} props.className - 可选类名
 * @returns {JSX.Element} 渲染的 React 元素
 * 
 * 视觉上对齐用户截图：每个 chip 显示「比例 + 用途」，选中态有 emerald 边框 + 勾选图标。
 */
export function AspectRatioPicker({
  value,
  options,
  onChange,
  columns = 3,
  className = "",
}: AspectRatioPickerProps) {
  const list = options ?? [];
  const gridClass = columns === 2 ? "grid grid-cols-2 gap-2" : "grid grid-cols-3 gap-2";

  return (
    <div className={`${gridClass} ${className}`}>
      {list.map((option) => {
        const selected = value === option.value;
        return (
          <Tip key={option.value} label={option.useCase} side="top">
            <button
              type="button"
              onClick={() => onChange(option.value)}
              className={`group relative flex flex-col items-start gap-0.5 rounded-md border px-2.5 py-2 text-left transition-colors ${selected
                  ? "border-emerald-500/70 bg-emerald-500/10 text-white"
                  : "border-white/10 bg-[#252525] text-gray-200 hover:border-white/30 hover:bg-[#2a2a2a]"
                }`}
            >
              <span className={`text-sm font-semibold ${selected ? "text-emerald-200" : "text-white"}`}>
                {option.label}
              </span>
              <span className={`text-[10px] leading-tight ${selected ? "text-emerald-100/80" : "text-gray-400"}`}>
                {option.useCase}
              </span>
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
