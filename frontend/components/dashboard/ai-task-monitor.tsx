"use client";

import { memo } from "react";
import { Image, Video, Mic, Pause, RotateCcw, FileText, Cpu } from "lucide-react";
import type { AITaskMonitor as AITaskMonitorData } from "@/lib/app-types";

/** AI任务监控组件Props */
export interface AITaskMonitorProps {
  /** 任务列表 */
  tasks: AITaskMonitorData[];
  /** 暂停回调 */
  onPause?: (taskId: string) => void;
  /** 重试回调 */
  onRetry?: (taskId: string) => void;
  /** 查看日志回调 */
  onViewLog?: (taskId: string) => void;
}

/** 任务类型配置 */
const taskTypeConfig: Record<"image" | "video" | "voiceover", { icon: typeof Image; color: string; bgColor: string }> = {
  image: {
    icon: Image,
    color: "text-pink-400",
    bgColor: "bg-pink-500/20",
  },
  video: {
    icon: Video,
    color: "text-purple-400",
    bgColor: "bg-purple-500/20",
  },
  voiceover: {
    icon: Mic,
    color: "text-cyan-400",
    bgColor: "bg-cyan-500/20",
  },
};

/** 格式化剩余时间 */
function formatRemainingTime(time: string | undefined): string {
  if (!time) return "计算中...";
  // 如果已经是格式化的字符串，直接返回
  if (typeof time === "string" && !/^\d+$/.test(time)) {
    return time;
  }
  const seconds = parseInt(time, 10);
  if (isNaN(seconds)) return time;
  if (seconds < 60) {
    return `${seconds}秒`;
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}分${secs}秒`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}小时${minutes}分`;
  }
}

/** 任务卡片 */
const TaskCard = memo(function TaskCard({
  task,
  onPause,
  onRetry,
  onViewLog,
}: {
  task: AITaskMonitorData;
  onPause?: (taskId: string) => void;
  onRetry?: (taskId: string) => void;
  onViewLog?: (taskId: string) => void;
}) {
  const typeConfig = taskTypeConfig[task.type];
  const Icon = typeConfig.icon;

  return (
    <div className="rounded-lg border border-white/10 bg-[#1a1a1a] p-4 transition-all hover:border-white/20">
      {/* 头部：类型图标和标题 */}
      <div className="mb-3 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${typeConfig.bgColor}`}>
            <Icon className={`h-5 w-5 ${typeConfig.color}`} />
          </div>
          <div>
            <h4 className="text-sm font-medium text-white">{task.title}</h4>
            <span className="text-xs text-[#666]">{task.model}</span>
          </div>
        </div>

        {/* 状态标签 */}
        {task.status === "running" && (
          <div className="flex items-center gap-1.5 rounded-full bg-blue-500/20 px-2 py-1">
            <div className="h-2 w-2 animate-pulse rounded-full bg-blue-400"></div>
            <span className="text-xs text-blue-400">运行中</span>
          </div>
        )}
        {task.status === "waiting" && (
          <div className="flex items-center gap-1.5 rounded-full bg-[#666]/20 px-2 py-1">
            <span className="text-xs text-[#888]">等待中</span>
          </div>
        )}
        {task.status === "paused" && (
          <div className="flex items-center gap-1.5 rounded-full bg-amber-500/20 px-2 py-1">
            <Pause className="h-3 w-3 text-amber-400" />
            <span className="text-xs text-amber-400">已暂停</span>
          </div>
        )}
      </div>

      {/* 进度条 */}
      <div className="mb-3">
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="text-[#888]">进度</span>
          <span className="text-white">{task.progress}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className={`h-full rounded-full transition-all duration-300 ${task.status === "waiting"
                ? "bg-[#666]"
                : task.status === "paused"
                  ? "bg-amber-500"
                  : "bg-gradient-to-r from-blue-500 to-purple-500"
              }`}
            style={{ width: `${task.progress}%` }}
          />
        </div>
      </div>

      {/* 底部：剩余时间和操作 */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-[#888]">
          剩余时间：{formatRemainingTime(task.remainingTime)}
        </span>

        <div className="flex items-center gap-2">
          {task.status === "running" && (
            <button
              onClick={() => onPause?.(task.id)}
              className="flex items-center gap-1 rounded px-2 py-1 text-xs text-[#888] transition-colors hover:bg-white/10 hover:text-white"
            >
              <Pause className="h-3 w-3" />
              暂停
            </button>
          )}
          {task.status === "waiting" && (
            <button
              onClick={() => onRetry?.(task.id)}
              className="flex items-center gap-1 rounded px-2 py-1 text-xs text-[#888] transition-colors hover:bg-white/10 hover:text-white"
            >
              <RotateCcw className="h-3 w-3" />
              重试
            </button>
          )}
          <button
            onClick={() => onViewLog?.(task.id)}
            className="flex items-center gap-1 rounded px-2 py-1 text-xs text-[#888] transition-colors hover:bg-white/10 hover:text-white"
          >
            <FileText className="h-3 w-3" />
            日志
          </button>
        </div>
      </div>
    </div>
  );
});

/** AI任务监控组件 */
export const AITaskMonitor = memo(function AITaskMonitor({
  tasks,
  onPause,
  onRetry,
  onViewLog,
}: AITaskMonitorProps) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#252525] p-6">
      {/* 标题 */}
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20">
          <Cpu className="h-5 w-5 text-purple-400" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white">AI任务监控</h2>
          <p className="text-sm text-[#888]">
            {tasks.filter((t) => t.status === "running").length} 个任务运行中
          </p>
        </div>
      </div>

      {/* 任务列表 */}
      <div className="space-y-3">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onPause={onPause}
            onRetry={onRetry}
            onViewLog={onViewLog}
          />
        ))}
      </div>

      {/* 空状态 */}
      {tasks.length === 0 && (
        <div className="flex h-40 flex-col items-center justify-center">
          <Cpu className="mb-2 h-12 w-12 text-[#333]" />
          <p className="text-sm text-[#666]">暂无运行中的AI任务</p>
        </div>
      )}
    </div>
  );
});

export default AITaskMonitor;