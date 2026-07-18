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
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/20",
    borderColor: "border-emerald-500/30",
    progressColor: "bg-emerald-500",
  },
  running: {
    icon: null,
    color: "text-blue-400",
    bgColor: "bg-blue-500/20",
    borderColor: "border-blue-500/30",
    progressColor: "bg-blue-500",
  },
  waiting: {
    icon: null,
    color: "text-[#666]",
    bgColor: "bg-white/5",
    borderColor: "border-white/10",
    progressColor: "bg-white/20",
  },
  failed: {
    icon: null,
    color: "text-red-400",
    bgColor: "bg-red-500/20",
    borderColor: "border-red-500/30",
    progressColor: "bg-red-500",
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
        <div className="absolute h-4 w-4 animate-ping rounded-full bg-blue-400 opacity-75"></div>
        <div className="relative h-3 w-3 rounded-full bg-blue-400"></div>
      </div>
    );
  }
  if (status === "waiting") {
    return <div className="h-3 w-3 rounded-full border-2 border-[#666]"></div>;
  }
  if (status === "failed") {
    return <div className="flex h-4 w-4 items-center justify-center text-red-400">✗</div>;
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
      <div className="mt-2 h-1 w-12 overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full rounded-full ${config.progressColor} transition-all duration-300`}
          style={{ width: `${stage.progress}%` }}
        />
      </div>

      {/* 进度百分比 */}
      <span className="mt-1 text-xs text-[#666]">{stage.progress}%</span>
    </div>
  );
});

/** 连接箭头 */
const ConnectorArrow = memo(function ConnectorArrow({
  fromStatus,
  toStatus,
}: {
  fromStatus: PipelineStageStatus;
  toStatus: PipelineStageStatus;
}) {
  const isCompleted = fromStatus === "completed";
  const isRunning = fromStatus === "running";

  let colorClass = "text-white/20";
  if (isCompleted) {
    colorClass = "text-emerald-400";
  } else if (isRunning) {
    colorClass = "text-blue-400";
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
    <div className="rounded-xl border border-white/10 bg-[#252525] p-6">
      {/* 标题 */}
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20">
          <Layers className="h-5 w-5 text-blue-400" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white">AI生产流水线</h2>
          <p className="text-sm text-[#888]">实时监控生产流程进度</p>
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
      <div className="mt-6 flex items-center justify-center gap-6 border-t border-white/10 pt-4">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <span className="text-xs text-[#888]">已完成</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-blue-400"></div>
          <span className="text-xs text-[#888]">进行中</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full border-2 border-[#666]"></div>
          <span className="text-xs text-[#888]">等待中</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex h-4 w-4 items-center justify-center text-red-400">✗</div>
          <span className="text-xs text-[#888]">失败</span>
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