"use client";

import { memo } from "react";
import { cn } from "@/lib/utils";
import { Loader2, AlertCircle, CheckCircle2, WifiOff } from "lucide-react";

export type ProjectionState = "fresh" | "syncing" | "delayed" | "failed";

interface CqrsSyncStatusProps {
  state: ProjectionState;
  className?: string;
}

const config: Record<
  ProjectionState,
  {
    icon: React.ReactNode;
    label: string;
    description: string;
    tone: string;
  }
> = {
  fresh: {
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    label: "已同步",
    description: "数据已是最新",
    tone: "text-muted-foreground",
  },
  syncing: {
    icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
    label: "同步中",
    description: "正在同步最新状态…",
    tone: "text-primary",
  },
  delayed: {
    icon: <AlertCircle className="h-3.5 w-3.5" />,
    label: "同步延迟",
    description: "数据同步有延迟，请稍后刷新",
    tone: "text-warning",
  },
  failed: {
    icon: <WifiOff className="h-3.5 w-3.5" />,
    label: "同步失败",
    description: "数据同步中断，请检查网络或联系管理员",
    tone: "text-destructive",
  },
};

/**
 * CqrsSyncStatus — CQRS 投影同步状态指示器
 *
 * 规范映射：
 * - fresh   → 投影与写模型一致
 * - syncing → 事件已发出，读模型更新中
 * - delayed → 读模型滞后（可接受阈值内）
 * - failed  → 同步中断，需人工介入
 */
export const CqrsSyncStatus = memo(function CqrsSyncStatus({
  state,
  className,
}: CqrsSyncStatusProps) {
  const c = config[state];

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary px-2 py-1",
        className
      )}
      title={c.description}
      role="status"
      aria-live="polite"
      aria-label={`同步状态：${c.label}`}
    >
      <span className={cn(c.tone)}>{c.icon}</span>
      <span className={cn("text-xs font-medium", c.tone)}>{c.label}</span>
    </div>
  );
});
