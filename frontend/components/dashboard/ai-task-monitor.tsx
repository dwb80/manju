/**
 * @file ai-task-monitor.tsx
 * @description AI任务监控组件，实时监控运行中的AI任务进度和状态
 */
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
    color: "text-chart-4",
    bgColor: "bg-chart-4/20",
  },
  video: {
    icon: Video,
    color: "text-chart-1",
    bgColor: "bg-chart-1/20",
  },
  voiceover: {
    icon: Mic,
    color: "text-chart-2",
    bgColor: "bg-chart-2/20",
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
    <div className="rounded-lg border border-border bg-card p-4 transition-all hover:border-border">
      {/* 头部：类型图标和标题 */}
      <div className="mb-3 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${typeConfig.bgColor}`}>
            <Icon className={`h-5 w-5 ${typeConfig.color}`} />
          </div>
          <div>
            <h4 className="text-sm font-medium text-foreground">{task.title}</h4>
            <span className="text-xs text-muted-foreground">{task.model}</span>
          </div>
        </div>

        {/* 状态标签 */}
        {task.status === "running" && (
          <div className="flex items-center gap-1.5 rounded-full bg-info/20 px-2 py-1">
            <div className="h-2 w-2 animate-pulse rounded-full bg-info"></div>
            <span className="text-xs text-info">运行中</span>
          </div>
        )}
        {task.status === "waiting" && (
          <div className="flex items-center gap-1.5 rounded-full bg-muted-foreground/20 px-2 py-1">
            <span className="text-xs text-muted-foreground">等待中</span>
          </div>
        )}
        {task.status === "paused" && (
          <div className="flex items-center gap-1.5 rounded-full bg-warning/20 px-2 py-1">
            <Pause className="h-3 w-3 text-warning" />
            <span className="text-xs text-warning">已暂停</span>
          </div>
        )}
      </div>

      {/* 进度条 */}
      <div className="mb-3">
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="text-muted-foreground">进度</span>
          <span className="text-foreground">{task.progress}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full transition-all duration-300 ${task.status === "waiting"
              ? "bg-muted-foreground"
              : task.status === "paused"
                ? "bg-warning"
                : "bg-gradient-to-r from-info to-chart-1"
              }`}
            style={{ width: `${task.progress}%` }}
          />
        </div>
      </div>

      {/* 底部：剩余时间和操作 */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          剩余时间：{formatRemainingTime(task.remainingTime)}
        </span>

        <div className="flex items-center gap-2">
          {task.status === "running" && (
            <button
              onClick={() => onPause?.(task.id)}
              className="flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Pause className="h-3 w-3" />
              暂停
            </button>
          )}
          {task.status === "waiting" && (
            <button
              onClick={() => onRetry?.(task.id)}
              className="flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <RotateCcw className="h-3 w-3" />
              重试
            </button>
          )}
          <button
            onClick={() => onViewLog?.(task.id)}
            className="flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
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
    <div className="rounded-xl border border-border bg-secondary p-6">
      {/* 标题 */}
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-chart-1/20 to-chart-4/20">
          <Cpu className="h-5 w-5 text-chart-1" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-foreground">AI任务监控</h2>
          <p className="text-sm text-muted-foreground">
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
          <Cpu className="mb-2 h-12 w-12 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">暂无运行中的AI任务</p>
        </div>
      )}
    </div>
  );
});

export default AITaskMonitor;
