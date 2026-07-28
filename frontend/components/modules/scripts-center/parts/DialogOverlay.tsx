"use client";

/**
 * 通用对话框覆盖层组件
 *
 * 提供全屏半透明背景 + 居中卡片 + 关闭按钮 + 滚动内容区的基础能力。
 * 多个对话框组件（导入/分析/审批/标签管理）共用同一个布局。
 */

import { X } from "lucide-react";

export function DialogOverlay({
  title,
  children,
  onClose,
  wide,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className={`relative w-full ${wide ? "max-w-5xl" : "max-w-2xl"} max-h-[85vh] mx-4 rounded-lg bg-card border border-border flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 对话框头部 */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-muted transition-colors"
          >
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>
        {/* 对话框内容 */}
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}
