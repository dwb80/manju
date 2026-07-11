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
        return "text-emerald-400";
      case "processing":
        return "text-blue-400";
      case "failed":
        return "text-red-400";
      default:
        return "text-yellow-400";
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
    <div className="rounded-xl border border-white/10 bg-[#1a1a1a]">
      {/* 头部 */}
      <div className="flex items-center justify-between border-b border-white/10 p-4">
        <h3 className="text-lg font-semibold text-white">AI任务队列</h3>
        <Button variant="secondary" size="sm" onClick={onRefresh} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          刷新
        </Button>
      </div>

      {/* 任务列表 */}
      <div className="divide-y divide-white/5">
        {tasks.length === 0 ? (
          <div className="p-8 text-center text-[#666]">
            暂无任务
          </div>
        ) : (
          tasks.map((task) => (
            <div key={task.id} className="flex items-center gap-4 p-4">
              {/* 类型图标 */}
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${task.type === "image" ? "bg-purple-500/20 text-purple-400" : "bg-orange-500/20 text-orange-400"}`}>
                {task.type === "image" ? <Image className="h-5 w-5" /> : <Video className="h-5 w-5" />}
              </div>

              {/* 任务信息 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium text-white">{task.title}</span>
                  <span className="text-xs text-[#888]">{task.model}</span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <span className={`text-xs ${getStatusColor(task.status)}`}>
                    {getStatusLabel(task.status)}
                  </span>
                  {task.progress > 0 && task.progress < 100 && (
                    <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 transition-all"
                        style={{ width: `${task.progress}%` }}
                      />
                    </div>
                  )}
                  {task.remainingTime && (
                    <span className="text-xs text-[#666]">{task.remainingTime}</span>
                  )}
                </div>
              </div>

              {/* 操作按钮 */}
              <div className="flex items-center gap-2">
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