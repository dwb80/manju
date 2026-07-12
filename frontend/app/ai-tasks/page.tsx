"use client";

/**
 * AI任务队列独立页面
 *
 * 功能：
 * - 跨项目、跨会话的AI任务监控和管理
 * - 支持图片生成和视频生成任务
 * - 提供任务搜索、筛选、批量操作等功能
 * - 实时刷新和任务详情查看
 *
 * 页面布局：
 * - 顶部：StandalonePageHeader 统一页面头 + StatsOverview 统计卡组
 * - 主体：AITaskQueue 组件
 * - 底部：数据来源 + 最后更新时间
 *
 * 数据来源：
 * - 通过真实API接口获取数据
 *
 * @module ai-tasks/page
 */

import { useState, useEffect } from "react";
import {
  ListChecks,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";
import { AITaskQueue, type AITask } from "@/components/dashboard/ai-task-queue";
import {
  StandalonePageHeader,
  StatsOverview,
} from "@/components/layout";
import { createLogger } from "@/lib/logger";

// 模块级 logger
const log = createLogger('ai-tasks-page')

/**
 * API响应格式
 */
interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

/**
 * AI任务列表响应格式
 */
interface AITaskListResponse {
  tasks: AITask[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * 批量操作响应格式
 */
interface BatchOperationResponse {
  success: string[];
  failed: Array<{ id: string; error: string }>;
}

/**
 * AI任务队列页面组件
 */
export default function AITasksPage() {
  // 任务列表状态
  const [tasks, setTasks] = useState<AITask[]>([]);
  // 加载状态
  const [loading, setLoading] = useState(false);
  // 最后更新时间（避免hydration错误）
  const [lastUpdate, setLastUpdate] = useState<string>("");
  // 总任务数
  const [totalCount, setTotalCount] = useState(0);

  /**
   * 加载任务列表数据
   * 通过真实API获取任务列表
   */
  async function loadTasks() {
    setLoading(true);
    log.debug('load tasks')

    try {
      const response = await fetch("/api/ai/tasks?page=1&pageSize=50");
      const result: ApiResponse<AITaskListResponse> = await response.json();

      if (result.code === 0 && result.data) {
        setTasks(result.data.tasks);
        setTotalCount(result.data.total);
        log.info('load tasks success', { count: result.data.total })
      } else {
        log.warn('load tasks failed', { message: result.message })
        setTasks([]);
        setTotalCount(0);
      }
    } catch (err) {
      log.error('API call failed', { error: (err as Error).message })
      setTasks([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTasks();
    setLastUpdate(new Date().toLocaleString("zh-CN"));
  }, []);

  async function handleRefresh() {
    await loadTasks();
  }

  async function handleCancel(taskIds: string[]) {
    log.info('cancel tasks', { count: taskIds.length })
    try {
      const response = await fetch("/api/ai/tasks/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskIds }),
      });
      const result: ApiResponse<BatchOperationResponse> = await response.json();

      if (result.code === 0 && result.data) {
        setTasks(prevTasks =>
          prevTasks.map(task => {
            if (result.data.success.includes(task.id)) {
              return {
                ...task,
                status: "failed",
                error: "任务已被用户取消",
                updatedAt: new Date().toISOString(),
              };
            }
            return task;
          })
        );
        log.info('cancel tasks success', { count: result.data.success.length })
        if (result.data.failed.length > 0) {
          log.warn('cancel tasks partial failure', { failed: result.data.failed.length })
        }
      } else {
        log.error('cancel tasks failed', { message: result.message })
      }
    } catch (err) {
      log.error('cancel API call failed', { error: (err as Error).message })
    }
  }

  async function handleRetry(taskIds: string[]) {
    log.info('retry tasks', { count: taskIds.length })
    try {
      const response = await fetch("/api/ai/tasks/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskIds }),
      });
      const result: ApiResponse<BatchOperationResponse> = await response.json();

      if (result.code === 0 && result.data) {
        setTasks(prevTasks =>
          prevTasks.map(task => {
            if (result.data.success.includes(task.id)) {
              return {
                ...task,
                status: "pending" as const,
                updatedAt: new Date().toISOString(),
              };
            }
            return task;
          }) as AITask[]
        );
        log.info('retry tasks success', { count: result.data.success.length })
      } else {
        log.error('retry tasks failed', { message: result.message })
      }
    } catch (err) {
      log.error('retry API call failed', { error: (err as Error).message })
    }
  }

  async function handleDelete(taskIds: string[]) {
    log.info('delete tasks', { count: taskIds.length })
    try {
      for (const taskId of taskIds) {
        const response = await fetch(`/api/ai/tasks/${taskId}`, {
          method: "DELETE",
        });
        const result: ApiResponse<{ deleted: boolean }> = await response.json();
        if (result.code !== 0) {
          log.warn('delete task partial failure', { taskId, message: result.message })
        }
      }
      setTasks(prevTasks => prevTasks.filter(task => !taskIds.includes(task.id)));
      setTotalCount(prev => prev - taskIds.length);
      log.info('delete tasks done', { count: taskIds.length })
    } catch (err) {
      log.error('delete API call failed', { error: (err as Error).message })
    }
  }

  // 统计计算
  const successCount = tasks.filter((t) => t.status === "success").length
  const failedCount = tasks.filter((t) => t.status === "failed").length
  const runningCount = tasks.filter(
    (t) => t.status === "pending" || t.status === "processing",
  ).length

  return (
    <main className="min-h-screen bg-[#181818] text-[#ececec]">
      {/* === 统一页面头 === */}
      <StandalonePageHeader
        title="AI 任务队列"
        description="监控和管理跨项目、跨会话的AI生成任务，支持图片和视频生成任务的搜索、筛选和批量操作"
        breadcrumbs={["首页", "AI任务队列"]}
        extraRight={
          <div className="flex items-center gap-2">
            <ListChecks className="h-4 w-4" />
            <span>共 {totalCount} 个任务</span>
          </div>
        }
      />

      <div className="px-6 py-4">
        {/* === 统一统计卡组 === */}
        <StatsOverview
          columns={4}
          cards={[
            {
              tone: "blue",
              icon: <ListChecks className="h-4 w-4" />,
              title: "总任务",
              value: totalCount,
              sub: "全部任务",
            },
            {
              tone: "amber",
              icon: <Loader2 className="h-4 w-4" />,
              title: "进行中",
              value: runningCount,
              sub: "排队 / 运行",
            },
            {
              tone: "emerald",
              icon: <CheckCircle2 className="h-4 w-4" />,
              title: "已完成",
              value: successCount,
              sub: "成功",
            },
            {
              tone: "red",
              icon: <XCircle className="h-4 w-4" />,
              title: "失败",
              value: failedCount,
              sub: "需处理",
            },
          ]}
        />
      </div>

      {/* 页面主体：任务队列组件 */}
      <section className="px-6 py-6">
        <AITaskQueue
          tasks={tasks}
          onRefresh={handleRefresh}
          onCancel={handleCancel}
          onRetry={handleRetry}
          onDelete={handleDelete}
          loading={loading}
        />
      </section>

      {/* 页面底部信息 */}
      <footer className="border-t border-white/10 px-6 py-4 text-xs text-[#666]">
        <div className="flex items-center justify-between">
          <div>数据来源：真实API接口</div>
          <div suppressHydrationWarning>
            最后更新：{lastUpdate || "加载中..."}
          </div>
        </div>
      </footer>
    </main>
  );
}