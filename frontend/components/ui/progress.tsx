"use client";

/**
 * Progress 进度条组件
 *
 * 用于展示进度、完成度等信息
 */

import * as React from "react";

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 进度值 (0-100) */
  value?: number;
  /** 最大值 */
  max?: number;
}

export function Progress({ value = 0, max = 100, className = "", ...props }: ProgressProps) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

  return (
    <div
      className={`relative h-2 w-full overflow-hidden rounded-full bg-[#252525] ${className}`}
      {...props}
    >
      <div
        className="h-full bg-emerald-500 transition-all duration-300 ease-in-out"
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}