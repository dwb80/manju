"use client";

/**
 * @file image-picker-aspect-ratio-select.tsx
 * @description 图片比例下拉选择器组件，用于纵向空间紧张的场景
 */

import { ChevronDown } from "lucide-react";
import type { AspectRatioOption, ImageRatio } from "@/lib/module-types";

interface AspectRatioSelectProps {
  /** 当前选中的比例（value）。 */
  value: ImageRatio;
  /** 选项列表（默认使用 aspectRatioOptions）。 */
  options?: AspectRatioOption[];
  /** 选中时回调。 */
  onChange: (ratio: ImageRatio) => void;
  /** 可选类名（外层）。 */
  className?: string;
  /** 是否禁用。 */
  disabled?: boolean;
}

/**
 * 比例选择的"下拉框 + 比例条 mini icon"形态。
 * 与 AspectRatioPicker（chip 网格）并存，专门用于纵向空间紧张的场景
 * （如角色图片生成器的侧栏），同时保留形状直觉：
 *  ▢  1:1（方）
 *  ▯  2:3 / 3:4（竖长方）
 *  ▭  4:3（横宽方）
 *  ▮  9:16（最长的竖条）
 *  ▬  16:9（最长的横条）
 *
 * 当前选中项会同时显示在 trigger 和下拉项中；
 * 选中态的 mini icon 用 emerald 色，未选中用 white/40。
 */
export function AspectRatioSelect({
  value,
  options,
  onChange,
  className = "",
  disabled = false,
}: AspectRatioSelectProps) {
  const list = options ?? [];
  const current = list.find((o) => o.value === value) ?? list[0];

  return (
    <div className={`relative ${className}`}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as ImageRatio)}
        disabled={disabled}
        aria-label="选择图片比例"
        className={[
          "h-10 w-full appearance-none rounded-md border border-white/10 bg-[#252525]",
          "pl-3 pr-9 text-sm text-white outline-none transition-colors",
          "focus:border-emerald-500",
          disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:border-white/30",
        ].join(" ")}
      >
        {list.map((option) => (
          // option 元素原生支持 padding 的浏览器有限（Chrome/Edge 支持，Safari 不支持），
          // 同时设置 style（行内）+ className 提升命中率；下拉项的纵向留白做到 10px。
          <option
            key={option.value}
            value={option.value}
            style={{ padding: "10px" }}
            className="bg-[#1f1f1f] text-white py-2.5"
          >
            {option.label} · {option.useCase}
          </option>
        ))}
      </select>
      {/* 左侧 mini icon 覆盖在 select 上方（pointer-events-none 不影响下拉） */}
      {current && (
        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2">
          <RatioIcon ratio={current.value} selected />
        </span>
      )}
      <ChevronDown
        className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
        aria-hidden
      />
    </div>
  );
}

/**
 * RatioIcon - 比例条 mini icon 组件
 * @param {Object} props - 组件属性
 * @param {ImageRatio} props.ratio - 图片比例
 * @param {boolean} props.selected - 是否选中
 * @param {number} props.size - 图标大小（默认 14）
 * @returns {JSX.Element} 渲染的 React 元素
 * 
 * 16×16 的方形外框，内部按 w/h 比例填充的形状。
 * 选中态用 emerald-400；未选中用 white/80。
 * 不同比例的内部形状宽度（统一 12 高的容器下）：
 *  - 1:1  → 12×12 (正方)
 *  - 2:3  → 8×12  (竖长)
 *  - 3:4  → 9×12  (竖长)
 *  - 4:3  → 12×9  (横宽)
 *  - 9:16 → 7×12  (竖长条)
 *  - 16:9 → 12×7  (横长条)
 */
export function RatioIcon({
  ratio,
  selected = false,
  size = 14,
}: {
  ratio: ImageRatio;
  selected?: boolean;
  size?: number;
}) {
  const fill = selected ? "bg-emerald-400" : "bg-white/80";
  const border = selected ? "border-emerald-500/40" : "border-white/20";

  // 容器 16 单位，内部按比例换算
  const dims: Record<ImageRatio, [number, number]> = {
    "1:1": [12, 12],
    "2:3": [8, 12],
    "3:4": [9, 12],
    "4:3": [12, 9],
    "9:16": [7, 12],
    "16:9": [12, 7],
    "3:2": [12, 8],
  };
  const [w, h] = dims[ratio] ?? [12, 12];
  const innerW = (w / 16) * size;
  const innerH = (h / 16) * size;

  return (
    <span
      className={`inline-flex items-center justify-center rounded-sm border ${border} bg-black/20`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <span
        className={`block rounded-[1px] ${fill}`}
        style={{ width: innerW, height: innerH }}
      />
    </span>
  );
}
