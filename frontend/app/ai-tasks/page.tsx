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
 * - 顶部：页面标题 + 返回首页按钮
 * - 主体：AITaskQueue组件
 *
 * 数据来源：
 * - 通过真实API接口获取数据
 *
 * @module ai-tasks/page
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, LayoutDashboard } from "lucide-react";
import { AITaskQueue, type AITask } from "@/components/dashboard/ai-task-queue";

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
  // 路由导航
  const router = useRouter();

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

    try {
      // 调用真实API获取任务列表
      const response = await fetch("/api/ai/tasks?page=1&pageSize=50");
      const result: ApiResponse<AITaskListResponse> = await response.json();

      if (result.code === 0 && result.data) {
        setTasks(result.data.tasks);
        setTotalCount(result.data.total);
      } else {
        console.error("获取任务列表失败:", result.message);
        setTasks([]);
        setTotalCount(0);
      }
    } catch (error) {
      console.error("API调用失败:", error);
      setTasks([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }

  /**
   * 页面加载时获取任务列表和设置时间
   */
  useEffect(() => {
    loadTasks();
    setLastUpdate(new Date().toLocaleString("zh-CN"));
  }, []);

  /**
   * 刷新任务列表
   */
  async function handleRefresh() {
    await loadTasks();
  }

  /**
   * 取消指定的任务
   * 通过真实API取消任务
   * @param taskIds - 要取消的任务ID列表
   */
  async function handleCancel(taskIds: string[]) {
    try {
      // 调用真实API取消任务
      const response = await fetch("/api/ai/tasks/cancel", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ taskIds }),
      });

      const result: ApiResponse<BatchOperationResponse> = await response.json();

      if (result.code === 0 && result.data) {
        // 更新任务状态
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

        console.log("已成功取消任务:", result.data.success);
        if (result.data.failed.length > 0) {
          console.warn("取消失败的任务:", result.data.failed);
        }
      } else {
        console.error("取消任务失败:", result.message);
      }
    } catch (error) {
      console.error("取消任务API调用失败:", error);
    }
  }

  /**
   * 重试失败的任务
   * 通过真实API重试任务
   * @param taskIds - 要重试的任务ID列表
   */
  async function handleRetry(taskIds: string[]) {
    try {
      // 调用真实API重试任务
      const response = await fetch("/api/ai/tasks/retry", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ taskIds }),
      });

      const result: ApiResponse<BatchOperationResponse> = await response.json();

      if (result.code === 0 && result.data) {
        // 更新任务状态为队列中
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

        console.log("已成功重试任务:", result.data.success);
        if (result.data.failed.length > 0) {
          console.warn("重试失败的任务:", result.data.failed);
        }
      } else {
        console.error("重试任务失败:", result.message);
      }
    } catch (error) {
      console.error("重试任务API调用失败:", error);
    }
  }

  /**
   * 删除指定的任务
   * 通过真实API删除任务
   * @param taskIds - 要删除的任务ID列表
   */
  async function handleDelete(taskIds: string[]) {
    try {
      // 批量删除任务
      for (const taskId of taskIds) {
        const response = await fetch(`/api/ai/tasks/${taskId}`, {
          method: "DELETE",
        });

        const result: ApiResponse<{ deleted: boolean }> = await response.json();

        if (result.code !== 0) {
          console.warn(`删除任务 ${taskId} 失败:`, result.message);
        }
      }

      // 从列表中移除已删除的任务
      setTasks(prevTasks =>
        prevTasks.filter(task => !taskIds.includes(task.id))
      );

      setTotalCount(prev => prev - taskIds.length);
      console.log("已删除任务:", taskIds);
    } catch (error) {
      console.error("删除任务API调用失败:", error);
    }
  }

  /**
   * 返回首页
   */
  function goBackToHome() {
    router.push("/");
  }

  return (
    <main className="min-h-screen bg-[#181818] text-[#ececec]">
      {/* 页面头部 */}
      <header className="sticky top-0 z-10 border-b border-white/10 bg-[#181818]/95 px-6 py-4 backdrop-blur">
        <div className="flex items-center justify-between">
          {/* 左侧：返回按钮和标题 */}
          <div className="flex items-center gap-4">
            {/* 返回首页按钮 */}
            <button
              onClick={goBackToHome}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-[#888] transition-colors hover:bg-white/10 hover:text-white"
              aria-label="返回首页"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>返回首页</span>
            </button>

            {/* 分隔线 */}
            <div className="h-4 w-px bg-white/20" />

            {/* 面包屑导航 */}
            <nav className="flex items-center gap-2 text-sm text-[#888]">
              <button
                onClick={goBackToHome}
                className="flex items-center gap-1 hover:text-white"
              >
                <LayoutDashboard className="h-3 w-3" />
                <span>首页</span>
              </button>
              <span className="text-white/40">/</span>
              <span className="text-white font-medium">AI任务队列</span>
            </nav>
          </div>

          {/* 右侧：页面信息 */}
          <div className="text-xs text-[#888]">
            共 {totalCount} 个任务
          </div>
        </div>

        {/* 页面标题和描述 */}
        <div className="mt-4">
          <h1 className="text-2xl font-bold text-white">
            AI任务队列
          </h1>
          <p className="mt-1 text-sm text-[#888]">
            监控和管理跨项目、跨会话的AI生成任务，支持图片和视频生成任务的搜索、筛选和批量操作
          </p>
        </div>
      </header>

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
          <div>
            数据来源：真实API接口
          </div>
          <div suppressHydrationWarning>
            最后更新：{lastUpdate || "加载中..."}
          </div>
        </div>
      </footer>
    </main>
  );
}