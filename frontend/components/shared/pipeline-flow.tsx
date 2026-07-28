"use client";

import { memo } from "react";
import { Check, Loader2, X, type LucideIcon } from "lucide-react";

/** 流水线阶段状态 */
export type PipelineFlowStatus = "done" | "running" | "pending" | "failed";

/** 流水线阶段定义 */
export interface PipelineFlowStage {
  /** 阶段标识 */
  id: string;
  /** 阶段名称 */
  name: string;
  /** 可选显示标签；未提供时使用 name */
  label?: string;
  /** 状态 */
  status: PipelineFlowStatus;
  /** 可选：进度百分比 (0-100)，仅 running 状态时显示 */
  progress?: number;
  /** 可选：阶段图标 */
  icon?: LucideIcon;
}

/** PipelineFlow 组件 Props */
export interface PipelineFlowProps {
  /** 阶段列表 */
  stages: PipelineFlowStage[];
  /** 是否显示图例，默认 false */
  showLegend?: boolean;
  /** 是否显示进度百分比，默认 true */
  showProgress?: boolean;
  /** 自定义类名 */
  className?: string;
  /** 点击阶段时跳转或切换对应模块 */
  onStageClick?: (stageId: string) => void;
}

/** 状态圆点 */
const StatusDot = memo(function StatusDot({ status }: { status: PipelineFlowStatus }) {
  if (status === "done") {
    return (
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <Check className="h-3.5 w-3.5" strokeWidth={3} />
      </div>
    );
  }
  if (status === "running") {
    return (
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-primary bg-transparent">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
      </div>
    );
  }
  if (status === "failed") {
    return (
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-destructive bg-destructive/10 text-destructive">
        <X className="h-3.5 w-3.5" strokeWidth={3} />
      </div>
    );
  }
  // pending
  return (
    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-muted-foreground" />
  );
});

/** 连接线 */
const Connector = memo(function Connector({ status }: { status: PipelineFlowStatus }) {
  const colorClass =
    status === "done"
      ? "bg-primary"
      : status === "running"
        ? "bg-primary/40"
        : "bg-border";
  return <div className={`h-0.5 flex-1 min-w-[16px] transition-colors duration-300 ${colorClass}`} />;
});

/**
 * PipelineFlow — 紧凑横向流水线组件
 *
 * 用于展示多阶段流程的进度状态，支持 done/running/pending/failed 四种状态。
 * 设计参考 production-ui-prototype 的 .pipeline-flow 规范。
 */
export const PipelineFlow = memo(function PipelineFlow({
  stages,
  showLegend = false,
  showProgress = true,
  className = "",
  onStageClick,
}: PipelineFlowProps) {
  if (stages.length === 0) return null;

  return (
    <div className={`rounded-lg border border-border bg-card px-4 py-3.5 ${className}`}>
      {/* 流水线主体 */}
      <div className="flex items-center gap-1 overflow-x-auto">
        {stages.map((stage, index) => {
          const Icon = stage.icon;
          return (
            <div key={stage.id} className="flex items-center gap-1">
              {/* 阶段节点 */}
              <button
                type="button"
                onClick={() => onStageClick?.(stage.id)}
                disabled={!onStageClick}
                className="flex shrink-0 flex-col items-center gap-1.5 rounded-md p-1 transition-colors enabled:hover:bg-muted enabled:focus-visible:ring-2 enabled:focus-visible:ring-ring/40"
                aria-label={`${stage.label ?? stage.name}：${stage.status}`}
              >
                <StatusDot status={stage.status} />
                <div className="flex flex-col items-center">
                  {Icon && <Icon className="mb-0.5 h-3 w-3 text-muted-foreground" />}
                  <span
                    className={`text-xs font-medium whitespace-nowrap ${
                      stage.status === "done"
                        ? "text-primary"
                        : stage.status === "running"
                          ? "text-foreground"
                          : stage.status === "failed"
                            ? "text-destructive"
                            : "text-muted-foreground"
                    }`}
                  >
                    {stage.label ?? stage.name}
                  </span>
                  {showProgress && stage.status === "running" && stage.progress !== undefined && (
                    <span className="text-[10px] text-muted-foreground">{stage.progress}%</span>
                  )}
                </div>
              </button>
              {/* 连接线 */}
              {index < stages.length - 1 && <Connector status={stage.status} />}
            </div>
          );
        })}
      </div>

      {/* 图例 */}
      {showLegend && (
        <div className="mt-3 flex items-center justify-center gap-5 border-t border-border pt-2.5">
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-full bg-primary" />
            <span className="text-[11px] text-muted-foreground">已完成</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-full border-2 border-primary" />
            <span className="text-[11px] text-muted-foreground">进行中</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-full border border-border bg-muted" />
            <span className="text-[11px] text-muted-foreground">等待中</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-full border-2 border-destructive bg-destructive/10" />
            <span className="text-[11px] text-muted-foreground">失败</span>
          </div>
        </div>
      )}
    </div>
  );
});

export default PipelineFlow;
