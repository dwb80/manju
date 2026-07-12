"use client";

import { Check } from "lucide-react";
import type { AspectRatioOption, ImageRatio } from "@/lib/module-types";

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
 * 比例选择器（chip 网格，单选）。
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
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`group relative flex flex-col items-start gap-0.5 rounded-md border px-2.5 py-2 text-left transition-colors ${
              selected
                ? "border-emerald-500/70 bg-emerald-500/10 text-white"
                : "border-white/10 bg-[#252525] text-gray-200 hover:border-white/30 hover:bg-[#2a2a2a]"
            }`}
            title={option.useCase}
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
        );
      })}
    </div>
  );
}
