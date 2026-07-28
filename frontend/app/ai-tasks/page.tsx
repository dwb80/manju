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

import { useState, useEffect, useMemo } from "react";
import {
  ListChecks,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";
import { AITaskQueue, type AITask } from "@/components/dashboard/ai-task-queue";
import { PageContainer, PageCard } from "@/components/layout/page-container";
import { FilterSelect, ModuleToolbar, SearchInput, StatCard, StatCardGrid } from "@/components/shared";
import { createLogger } from "@/lib/logger";
import { api } from "@/lib/api-client";

// 模块级 logger
const log = createLogger('ai-tasks-page')


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
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  /**
   * 加载任务列表数据
   * 通过真实API获取任务列表
   */
  async function loadTasks() {
    setLoading(true);
    log.debug('load tasks')

    try {
      // P1-4: 改用 api() 统一处理响应 / 错误 / 缓存
      const data = await api<AITaskListResponse>("/api/ai/tasks?page=1&pageSize=50");

      setTasks(data.tasks);
      setTotalCount(data.total);
      log.info('load tasks success', { count: data.total })
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
      // P1-4: 改用 api() 统一处理响应 / 错误 / 缓存
      const data = await api<BatchOperationResponse>("/api/ai/tasks/cancel", {
        method: "POST",
        body: JSON.stringify({ taskIds }),
      });

      setTasks(prevTasks =>
        prevTasks.map(task => {
          if (data.success.includes(task.id)) {
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
      log.info('cancel tasks success', { count: data.success.length })
      if (data.failed.length > 0) {
        log.warn('cancel tasks partial failure', { failed: data.failed.length })
      }
    } catch (err) {
      log.error('cancel API call failed', { error: (err as Error).message })
    }
  }

  async function handleRetry(taskIds: string[]) {
    log.info('retry tasks', { count: taskIds.length })
    try {
      // P1-4: 改用 api() 统一处理响应 / 错误 / 缓存
      const data = await api<BatchOperationResponse>("/api/ai/tasks/retry", {
        method: "POST",
        body: JSON.stringify({ taskIds }),
      });

      setTasks(prevTasks =>
        prevTasks.map(task => {
          if (data.success.includes(task.id)) {
            return {
              ...task,
              status: "pending" as const,
              updatedAt: new Date().toISOString(),
            };
          }
          return task;
        }) as AITask[]
      );
      log.info('retry tasks success', { count: data.success.length })
    } catch (err) {
      log.error('retry API call failed', { error: (err as Error).message })
    }
  }

  async function handleDelete(taskIds: string[]) {
    log.info('delete tasks', { count: taskIds.length })
    // P1-4: 改用 api() 统一处理响应 / 错误 / 缓存
    const results = await Promise.allSettled(
      taskIds.map((taskId) =>
        api<{ deleted: boolean }>(`/api/ai/tasks/${taskId}`, { method: "DELETE" }),
      ),
    );
    results.forEach((r, idx) => {
      if (r.status === "rejected") {
        log.warn('delete task failed', { taskId: taskIds[idx], error: r.reason?.message })
      }
    });
    // 成功删除的任务（fulfilled）从列表移除
    const successIds = new Set(
      results
        .map((r, idx) => (r.status === "fulfilled" ? taskIds[idx] : null))
        .filter((id): id is string => Boolean(id)),
    );
    setTasks(prevTasks => prevTasks.filter(task => !successIds.has(task.id)));
    setTotalCount(prev => prev - successIds.size);
    log.info('delete tasks done', { count: successIds.size })
  }

  // 统计计算
  const successCount = tasks.filter((t) => t.status === "success").length
  const failedCount = tasks.filter((t) => t.status === "failed").length
  const runningCount = tasks.filter(
    (t) => t.status === "pending" || t.status === "processing",
  ).length
  const filteredTasks = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return tasks.filter((task) => {
      const matchesQuery = !query || [task.title, task.model, task.type].some((value) => value.toLowerCase().includes(query));
      return matchesQuery && (!statusFilter || task.status === statusFilter);
    });
  }, [searchQuery, statusFilter, tasks]);

  return (
    <PageContainer
      title="AI 任务队列"
      description="监控和管理跨项目、跨会话的 AI 生成任务"
      actions={<span className="text-caption text-muted-foreground">共 {totalCount} 个任务</span>}
    >
      <PageCard className="mb-4">
        <StatCardGrid columns={4}>
          <StatCard label="总任务" value={totalCount} icon={ListChecks} color="blue" />
          <StatCard label="进行中" value={runningCount} icon={Loader2} color="orange" />
          <StatCard label="已完成" value={successCount} icon={CheckCircle2} color="emerald" />
          <StatCard label="失败" value={failedCount} icon={XCircle} color="orange" />
        </StatCardGrid>
      </PageCard>

      <ModuleToolbar
        left={
          <>
            <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder="搜索任务标题、模型或类型..." />
            <FilterSelect
              value={statusFilter}
              onChange={setStatusFilter}
              placeholder="全部状态"
              options={[
                { value: "pending", label: "队列中" },
                { value: "processing", label: "进行中" },
                { value: "success", label: "成功" },
                { value: "failed", label: "失败" },
              ]}
            />
          </>
        }
      />

      <section>
        <AITaskQueue
          tasks={filteredTasks}
          onRefresh={handleRefresh}
          onCancel={handleCancel}
          onRetry={handleRetry}
          onDelete={handleDelete}
          loading={loading}
        />
      </section>

      {/* 页面底部信息 */}
      <footer className="mt-4 border-t border-border py-3 text-caption text-muted-foreground">
        <div className="flex items-center justify-between">
          <div>数据来源：真实API接口</div>
          <div suppressHydrationWarning>
            最后更新：{lastUpdate || "加载中..."}
          </div>
        </div>
      </footer>
    </PageContainer>
  );
}
