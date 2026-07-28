"use client";

import { memo, Fragment } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type PipelineStageState = "done" | "running" | "pending";

export interface PipelineStage {
  name: string;
  label: string;
  state: PipelineStageState;
}

interface PipelineFlowViewProps {
  stages: PipelineStage[];
  onStageClick?: (stageName: string) => void;
  className?: string;
}

/**
 * PipelineFlowView — 通用流水线可视化组件
 *
 * 设计约束：
 * - 只接收中性步骤展示模型，负责布局、颜色和可访问性
 * - 不内置任何领域语义（如"剧本、分镜、资产"等业务规则）
 * - 业务状态映射和点击后的领域路由由调用方（domains 层）负责
 */
export const PipelineFlowView = memo(function PipelineFlowView({
  stages,
  onStageClick,
  className,
}: PipelineFlowViewProps) {
  if (!stages.length) return null;

  return (
    <div
      className={cn(
        "flex items-center gap-1 overflow-x-auto py-2",
        className
      )}
      role="list"
      aria-label="流水线阶段"
    >
      {stages.map((stage, idx) => {
        const isLast = idx === stages.length - 1;
        const stateConfig = {
          done: {
            dot: "bg-primary",
            label: "text-primary",
            ring: "ring-primary/30",
          },
          running: {
            dot: "bg-info animate-pulse",
            label: "text-info",
            ring: "ring-info/30",
          },
          pending: {
            dot: "bg-muted-foreground/40",
            label: "text-muted-foreground",
            ring: "ring-transparent",
          },
        }[stage.state];

        return (
          <Fragment key={stage.name}>
            <button
              type="button"
              onClick={() => onStageClick?.(stage.name)}
              className={cn(
                "flex items-center gap-2 rounded-md px-2 py-1 transition-colors",
                onStageClick && "hover:bg-secondary cursor-pointer",
                !onStageClick && "cursor-default"
              )}
              role="listitem"
              aria-current={stage.state === "running" ? "step" : undefined}
            >
              <span
                className={cn(
                  "h-2 w-2 rounded-full ring-2 ring-offset-1 ring-offset-background",
                  stateConfig.dot,
                  stateConfig.ring
                )}
              />
              <span className={cn("text-xs font-medium whitespace-nowrap", stateConfig.label)}>
                {stage.label}
              </span>
            </button>
            {!isLast && (
              <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/50" aria-hidden="true" />
            )}
          </Fragment>
        );
      })}
    </div>
  );
});
