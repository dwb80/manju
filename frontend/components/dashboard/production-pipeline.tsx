"use client";

import { memo } from "react";
import {
  FileText,
  Layers,
  Film,
  Image,
  Video,
  Mic,
  CheckCircle2,
  Upload,
  ChevronRight,
  LucideIcon,
} from "lucide-react";
import type { ProductionPipeline as ProductionPipelineData, PipelineStage as PipelineStageData } from "@/lib/app-types";

/** 流水线阶段状态 - 从 app-types 重新导出 */
export type PipelineStageStatus = "completed" | "running" | "waiting" | "failed";

/** 流水线阶段数据（内部使用，包含图标） */
export interface PipelineStage {
  /** 阶段标识 */
  id: string;
  /** 阶段名称 */
  name: string;
  /** 状态 */
  status: PipelineStageStatus;
  /** 进度百分比 (0-100) */
  progress: number;
  /** 图标 */
  icon: LucideIcon;
}

/** 生产流水线组件Props */
export interface ProductionPipelineProps {
  /** 流水线阶段数据 */
  pipeline: ProductionPipelineData;
}

/** 状态配置 */
const statusConfig = {
  completed: {
    icon: CheckCircle2,
    color: "text-primary",
    bgColor: "bg-primary/20",
    borderColor: "border-primary/30",
    progressColor: "bg-primary",
  },
  running: {
    icon: null,
    color: "text-info",
    bgColor: "bg-info/20",
    borderColor: "border-info/30",
    progressColor: "bg-info",
  },
  waiting: {
    icon: null,
    color: "text-muted-foreground",
    bgColor: "bg-muted/50",
    borderColor: "border-border",
    progressColor: "bg-muted",
  },
  failed: {
    icon: null,
    color: "text-destructive",
    bgColor: "bg-destructive/20",
    borderColor: "border-destructive/30",
    progressColor: "bg-destructive",
  },
};

/** 状态图标组件 */
const StatusIcon = memo(function StatusIcon({ status }: { status: PipelineStageStatus }) {
  const config = statusConfig[status];

  if (status === "completed") {
    return <CheckCircle2 className={`h-4 w-4 ${config.color}`} />;
  }
  if (status === "running") {
    return (
      <div className="relative flex h-4 w-4 items-center justify-center">
        <div className="absolute h-4 w-4 animate-ping rounded-full bg-info opacity-75"></div>
        <div className="relative h-3 w-3 rounded-full bg-info"></div>
      </div>
    );
  }
  if (status === "waiting") {
    return <div className="h-3 w-3 rounded-full border-2 border-border"></div>;
  }
  if (status === "failed") {
    return <div className="flex h-4 w-4 items-center justify-center text-destructive">✗</div>;
  }
  return null;
});

/** 单个阶段卡片 */
const StageCard = memo(function StageCard({ stage }: { stage: PipelineStage }) {
  const config = statusConfig[stage.status];
  const Icon = stage.icon;

  return (
    <div className="flex flex-col items-center">
      {/* 阶段容器 */}
      <div
        className={`flex h-16 w-16 flex-col items-center justify-center rounded-xl border ${config.borderColor} ${config.bgColor} transition-all`}
      >
        <Icon className={`mb-1 h-5 w-5 ${config.color}`} />
        <StatusIcon status={stage.status} />
      </div>

      {/* 阶段名称 */}
      <span className={`mt-2 text-xs font-medium ${config.color}`}>{stage.name}</span>

      {/* 进度条 */}
      <div className="mt-2 h-1 w-12 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full ${config.progressColor} transition-all duration-300`}
          style={{ width: `${stage.progress}%` }}
        />
      </div>

      {/* 进度百分比 */}
      <span className="mt-1 text-xs text-muted-foreground">{stage.progress}%</span>
    </div>
  );
});

/** 连接箭头 */
const ConnectorArrow = memo(function ConnectorArrow({
  fromStatus,
}: {
  fromStatus: PipelineStageStatus;
  toStatus: PipelineStageStatus;
}) {
  const isCompleted = fromStatus === "completed";
  const isRunning = fromStatus === "running";

  let colorClass = "text-foreground/20";
  if (isCompleted) {
    colorClass = "text-primary";
  } else if (isRunning) {
    colorClass = "text-info";
  }

  return (
    <div className="flex items-center">
      <ChevronRight className={`h-5 w-5 ${colorClass}`} />
    </div>
  );
});

/** 默认图标映射 */
const stageIconMap: Record<string, LucideIcon> = {
  "剧本": FileText,
  "Scene": Layers,
  "Shot": Film,
  "图片": Image,
  "视频": Video,
  "配音": Mic,
  "审核": CheckCircle2,
  "发布": Upload,
};

/** 将 PipelineStageData 转换为内部 PipelineStage */
function transformStages(dataStages: PipelineStageData[]): PipelineStage[] {
  return dataStages.map((stage, index) => ({
    id: `stage-${index}`,
    name: stage.name,
    status: stage.status,
    progress: stage.progress,
    icon: stageIconMap[stage.name] || FileText,
  }));
}

/**
 * ProductionPipeline - AI生产流水线组件
 * @param {ProductionPipelineProps} props - 组件属性
 * @param {ProductionPipelineData} props.pipeline - 流水线阶段数据
 * @returns {JSX.Element} 渲染的生产流水线界面
 */
export const ProductionPipeline = memo(function ProductionPipeline({ pipeline }: ProductionPipelineProps) {
  const stages = transformStages(pipeline.stages);

  return (
    <div className="rounded-xl border border-border bg-secondary p-6">
      {/* 标题 */}
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-info/20 to-chart-1/20">
          <Layers className="h-5 w-5 text-info" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-foreground">AI生产流水线</h2>
          <p className="text-sm text-muted-foreground">实时监控生产流程进度</p>
        </div>
      </div>

      {/* 流水线阶段 */}
      <div className="flex items-center justify-between overflow-x-auto pb-2">
        {stages.map((stage, index) => (
          <div key={stage.id} className="flex items-center">
            <StageCard stage={stage} />
            {index < stages.length - 1 && (
              <ConnectorArrow
                fromStatus={stage.status}
                toStatus={stages[index + 1].status}
              />
            )}
          </div>
        ))}
      </div>

      {/* 图例 */}
      <div className="mt-6 flex items-center justify-center gap-6 border-t border-border pt-4">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-primary" />
          <span className="text-xs text-muted-foreground">已完成</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-info"></div>
          <span className="text-xs text-muted-foreground">进行中</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full border-2 border-border"></div>
          <span className="text-xs text-muted-foreground">等待中</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex h-4 w-4 items-center justify-center text-destructive">✗</div>
          <span className="text-xs text-muted-foreground">失败</span>
        </div>
      </div>
    </div>
  );
});

/** 默认流水线阶段配置 */
export const defaultPipeline: ProductionPipelineData = {
  stages: [
    { name: "剧本", status: "completed", progress: 100 },
    { name: "Scene", status: "completed", progress: 100 },
    { name: "Shot", status: "running", progress: 65 },
    { name: "图片", status: "waiting", progress: 0 },
    { name: "视频", status: "waiting", progress: 0 },
    { name: "配音", status: "waiting", progress: 0 },
    { name: "审核", status: "waiting", progress: 0 },
    { name: "发布", status: "waiting", progress: 0 },
  ],
};

export default ProductionPipeline;
