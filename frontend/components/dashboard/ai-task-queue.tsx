"use client";

import { memo } from "react";
import { Image, Video, RefreshCw, Play, Pause, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface AITask {
  id: string;
  type: "image" | "video";
  title: string;
  model: string;
  status: "pending" | "processing" | "success" | "failed";
  progress: number;
  remainingTime?: string;
  createdAt: string;
  updatedAt: string;
  error?: string;
}

interface AITaskQueueProps {
  tasks: AITask[];
  onRefresh: () => void;
  onCancel: (taskIds: string[]) => void;
  onRetry: (taskIds: string[]) => void;
  onDelete: (taskIds: string[]) => void;
  loading?: boolean;
}

/**
 * AITaskQueue - AI任务队列组件
 * @param {AITaskQueueProps} props - 组件属性
 * @param {AITask[]} props.tasks - 任务列表数据
 * @param {Function} props.onRefresh - 刷新任务列表回调
 * @param {Function} props.onCancel - 取消任务回调
 * @param {Function} props.onRetry - 重试任务回调
 * @param {Function} props.onDelete - 删除任务回调
 * @param {boolean} props.loading - 是否正在加载
 * @returns {JSX.Element} 渲染的任务队列界面
 */
export const AITaskQueue = memo(function AITaskQueue({
  tasks,
  onRefresh,
  onCancel,
  onRetry,
  onDelete,
  loading,
}: AITaskQueueProps) {
  const getStatusColor = (status: AITask["status"]) => {
    switch (status) {
      case "success":
        return "text-primary";
      case "processing":
        return "text-info";
      case "failed":
        return "text-destructive";
      default:
        return "text-chart-5";
    }
  };

  const getStatusLabel = (status: AITask["status"]) => {
    switch (status) {
      case "success":
        return "成功";
      case "processing":
        return "进行中";
      case "failed":
        return "失败";
      default:
        return "队列中";
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card">
      {/* 头部
        * 评审优化：去掉 "AI任务队列" 重复标题（页面级 H1 已含相同文案）
        * 改为功能性副标题 "跨项目任务监控"，保持标题层级 H1→H3
        */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="text-card-title text-foreground">跨项目任务监控</h3>
        <Button variant="secondary" size="sm" onClick={onRefresh} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          刷新
        </Button>
      </div>

      {/* 任务列表 */}
      <div className="divide-y divide-border">
        {tasks.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            暂无任务
          </div>
        ) : (
          tasks.map((task) => (
            <div key={task.id} className="group flex items-center gap-3 px-4 py-2.5">
              {/* 类型图标 */}
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${task.type === "image" ? "bg-chart-1/20 text-chart-1" : "bg-chart-3/20 text-chart-3"}`}>
                {task.type === "image" ? <Image className="h-5 w-5" /> : <Video className="h-5 w-5" />}
              </div>

              {/* 任务信息 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium text-foreground">{task.title}</span>
                  <span className="text-xs text-muted-foreground">{task.model}</span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <span className={`text-xs ${getStatusColor(task.status)}`}>
                    {getStatusLabel(task.status)}
                  </span>
                  {task.progress > 0 && task.progress < 100 && (
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${task.progress}%` }}
                      />
                    </div>
                  )}
                  {task.remainingTime && (
                    <span className="text-xs text-muted-foreground">{task.remainingTime}</span>
                  )}
                </div>
              </div>

              {/* 操作按钮 */}
              <div className="flex items-center gap-2 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                {task.status === "processing" && (
                  <Button variant="ghost" size="sm" onClick={() => onCancel([task.id])}>
                    <Pause className="h-4 w-4" />
                  </Button>
                )}
                {task.status === "failed" && (
                  <Button variant="ghost" size="sm" onClick={() => onRetry([task.id])}>
                    <Play className="h-4 w-4" />
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => onDelete([task.id])}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
});
