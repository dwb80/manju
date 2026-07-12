"use client";

import { Check } from "lucide-react";
import type { StyleOption, StyleValue } from "@/lib/module-types";

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
 * 风格选择器（chip 网格，单选）。
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
          <button
            key={option.value || "default"}
            type="button"
            onClick={() => onChange(option.value)}
            className={`group relative flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-left transition-colors ${
              selected
                ? "border-emerald-500/70 bg-emerald-500/10 text-white"
                : "border-white/10 bg-[#252525] text-gray-200 hover:border-white/30 hover:bg-[#2a2a2a]"
            }`}
            title={option.promptSuffix ? `追加：${option.promptSuffix}` : "不追加风格修饰"}
          >
            <span className="text-base leading-none" aria-hidden>
              {option.emoji}
            </span>
            <span className={`text-xs font-medium ${selected ? "text-emerald-100" : "text-white"}`}>
              {option.label}
            </span>
            {selected && (
              <span className="ml-auto grid h-3.5 w-3.5 place-items-center rounded-full bg-emerald-500 text-white">
                <Check className="h-2.5 w-2.5" strokeWidth={3} />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
