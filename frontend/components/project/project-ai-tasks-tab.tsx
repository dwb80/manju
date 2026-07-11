"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Search,
  RefreshCw,
  XCircle,
  ChevronDown,
  ChevronUp,
  Image,
  Video,
  Clock,
  CheckCircle2,
  XCircle as XCircleIcon,
  Loader2,
  Calendar,
  AlertCircle,
  Eye,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

/**
 * 项目AI任务Tab组件：显示项目相关的AI生成任务。
 *
 * 功能：
 * - 显示项目相关的AI生成任务列表
 * - 任务信息展示：
 *   * 任务ID
 *   * 任务类型(图片/视频)
 *   * Prompt描述
 *   * 状态(queued/in_progress/completed/failed)
 *   * 创建时间
 *   * 完成时间
 *   * 耗时
 * - 任务状态可视化(不同状态使用不同颜色和图标)
 * - 支持任务筛选：
 *   * 按任务类型筛选(图片/视频)
 *   * 按状态筛选(队列中/执行中/已完成/失败)
 * - 支持任务操作：
 *   * 查看任务详情
 *   * 取消任务(仅队列中和执行中的任务)
 *   * 重试任务(仅失败的任务)
 * - 实时刷新功能(自动刷新开关+手动刷新按钮)
 * - 分页显示
 *
 * 设计依据：
 * - 参考现有组件的深色主题设计风格
 * - 使用表格布局展示任务列表
 * - 状态标签使用不同颜色区分
 *
 * @param projectId - 项目ID
 * @param tasks - 项目相关的AI任务列表
 * @param onRefresh - 刷新回调
 * @param onCancelTask - 取消任务回调(可选)
 * @param onRetryTask - 重试任务回调(可选)
 *
 * @example
 * ```tsx
 * <ProjectAITasksTab
 *   projectId="project-123"
 *   tasks={taskList}
 *   onRefresh={() => fetchTasks()}
 *   onCancelTask={(taskId) => cancelTask(taskId)}
 *   onRetryTask={(taskId) => retryTask(taskId)}
 * />
 * ```
 */

/** 任务状态类型 */
export type AITaskStatus = "queued" | "in_progress" | "completed" | "failed";

/** 任务类型 */
export type AITaskType = "image" | "video";

/** AI任务数据类型 */
export interface ProjectAITask {
  /** 任务ID */
  id: string;
  /** 任务类型(图片/视频) */
  type: AITaskType;
  /** Prompt描述 */
  prompt: string;
  /** 状态(queued/in_progress/completed/failed) */
  status: AITaskStatus;
  /** 创建时间 */
  createdAt: string;
  /** 完成时间(如已完成) */
  completedAt?: string;
  /** 耗时(秒,如已完成) */
  duration?: number;
  /** 错误信息(如失败) */
  error?: string;
  /** 生成的资源URL列表 */
  resultUrls?: string[];
  /** 进度(0-100) */
  progress?: number;
}

type ProjectAITasksTabProps = {
  /** 项目ID */
  projectId: string;
  /** 任务列表数组 */
  tasks: ProjectAITask[];
  /** 刷新回调 */
  onRefresh: () => void | Promise<void>;
  /** 取消任务回调(可选) */
  onCancelTask?: (taskId: string) => void | Promise<void>;
  /** 重试任务回调(可选) */
  onRetryTask?: (taskId: string) => void | Promise<void>;
  /** 每页显示数量(默认10) */
  pageSize?: number;
};

/** 筛选器状态类型 */
type FilterState = {
  /** 搜索关键词 */
  searchQuery: string;
  /** 任务类型筛选(空字符串表示全部) */
  type: AITaskType | "";
  /** 状态筛选(空字符串表示全部) */
  status: AITaskStatus | "";
};

/** 状态配置类型 */
type StatusConfig = {
  /** 状态名称 */
  label: string;
  /** 图标组件 */
  icon: typeof Clock;
  /** 文本颜色 */
  textColor: string;
  /** 背景颜色 */
  bgColor: string;
  /** 边框颜色 */
  borderColor: string;
};

/** 任务类型配置类型 */
type TypeConfig = {
  /** 类型名称 */
  label: string;
  /** 图标组件 */
  icon: typeof Image;
  /** 颜色 */
  color: string;
};

export function ProjectAITasksTab({
  projectId,
  tasks,
  onRefresh,
  onCancelTask,
  onRetryTask,
  pageSize = 10,
}: ProjectAITasksTabProps) {
  // 筛选器状态
  const [filters, setFilters] = useState<FilterState>({
    searchQuery: "",
    type: "",
    status: "",
  });

  // 展开的任务详情ID
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  // 自动刷新开关
  const [autoRefresh, setAutoRefresh] = useState(false);

  // 刷新中状态
  const [isRefreshing, setIsRefreshing] = useState(false);

  // 当前页码
  const [currentPage, setCurrentPage] = useState(1);

  // 状态配置映射
  const statusConfigs: Record<AITaskStatus, StatusConfig> = {
    queued: {
      label: "队列中",
      icon: Clock,
      textColor: "text-gray-400",
      bgColor: "bg-gray-500/20",
      borderColor: "border-gray-500/30",
    },
    in_progress: {
      label: "执行中",
      icon: Loader2,
      textColor: "text-cyan-400",
      bgColor: "bg-cyan-500/20",
      borderColor: "border-cyan-500/30",
    },
    completed: {
      label: "已完成",
      icon: CheckCircle2,
      textColor: "text-emerald-400",
      bgColor: "bg-emerald-500/20",
      borderColor: "border-emerald-500/30",
    },
    failed: {
      label: "失败",
      icon: XCircleIcon,
      textColor: "text-red-400",
      bgColor: "bg-red-500/20",
      borderColor: "border-red-500/30",
    },
  };

  // 任务类型配置映射
  const typeConfigs: Record<AITaskType, TypeConfig> = {
    image: {
      label: "图片",
      icon: Image,
      color: "text-purple-400",
    },
    video: {
      label: "视频",
      icon: Video,
      color: "text-amber-400",
    },
  };

  /**
   * 格式化时间显示
   * @param dateString - ISO时间字符串
   * @returns 格式化的时间字符串
   */
  const formatTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "刚刚";
    if (diffMins < 60) return `${diffMins}分钟前`;
    if (diffHours < 24) return `${diffHours}小时前`;
    if (diffDays < 7) return `${diffDays}天前`;

    return date.toLocaleDateString("zh-CN", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  /**
   * 格式化耗时显示
   * @param seconds - 秒数
   * @returns 格式化的时间字符串
   */
  const formatDuration = (seconds: number): string => {
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
  };

  /**
   * 筛选后的任务列表
   */
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      // 搜索关键词筛选
      if (
        filters.searchQuery &&
        !task.prompt.toLowerCase().includes(filters.searchQuery.toLowerCase()) &&
        !task.id.toLowerCase().includes(filters.searchQuery.toLowerCase())
      ) {
        return false;
      }

      // 任务类型筛选
      if (filters.type && task.type !== filters.type) {
        return false;
      }

      // 状态筛选
      if (filters.status && task.status !== filters.status) {
        return false;
      }

      return true;
    });
  }, [tasks, filters]);

  /**
   * 分页后的任务列表
   */
  const paginatedTasks = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return filteredTasks.slice(startIndex, endIndex);
  }, [filteredTasks, currentPage, pageSize]);

  /**
   * 总页数
   */
  const totalPages = useMemo(() => {
    return Math.ceil(filteredTasks.length / pageSize);
  }, [filteredTasks.length, pageSize]);

  /**
   * 各状态任务统计
   */
  const taskStats = useMemo(() => {
    return {
      total: tasks.length,
      queued: tasks.filter((t) => t.status === "queued").length,
      in_progress: tasks.filter((t) => t.status === "in_progress").length,
      completed: tasks.filter((t) => t.status === "completed").length,
      failed: tasks.filter((t) => t.status === "failed").length,
    };
  }, [tasks]);

  /**
   * 处理手动刷新
   */
  const handleRefresh = async () => {
    if (isRefreshing) return;

    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  /**
   * 切换任务详情展开状态
   */
  const toggleTaskDetails = (taskId: string) => {
    setExpandedTaskId(expandedTaskId === taskId ? null : taskId);
  };

  /**
   * 处理取消任务
   */
  const handleCancelTask = async (taskId: string) => {
    if (!onCancelTask) return;
    await onCancelTask(taskId);
  };

  /**
   * 处理重试任务
   */
  const handleRetryTask = async (taskId: string) => {
    if (!onRetryTask) return;
    await onRetryTask(taskId);
  };

  /**
   * 处理页码变化
   */
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    setExpandedTaskId(null); // 切换页面时关闭展开的详情
  };

  /**
   * 清除筛选条件
   */
  const clearFilters = () => {
    setFilters({
      searchQuery: "",
      type: "",
      status: "",
    });
    setCurrentPage(1);
  };

  // 自动刷新定时器
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      onRefresh();
    }, 10000); // 每10秒刷新一次

    return () => clearInterval(interval);
  }, [autoRefresh, onRefresh]);

  // 当筛选条件变化时重置页码
  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  return (
    <div className="space-y-4">
      {/* 标题和刷新控制 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500/20 to-purple-500/20">
            <AlertCircle className="h-5 w-5 text-cyan-400" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">AI生成任务</h3>
            <p className="text-xs text-[#888]">共 {tasks.length} 个任务</p>
          </div>
        </div>

        {/* 刷新控制 */}
        <div className="flex items-center gap-2">
          {/* 自动刷新开关 */}
          <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-gray-600 bg-gray-700 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-0"
            />
            <span className="text-[#888]">自动刷新</span>
          </label>

          {/* 手动刷新按钮 */}
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white transition-all hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            {isRefreshing ? "刷新中..." : "刷新"}
          </button>
        </div>
      </div>

      {/* 状态统计 */}
      <div className="grid grid-cols-5 gap-2">
        {[
          { key: "total", label: "全部", count: taskStats.total, color: "text-white" },
          { key: "queued", label: "队列中", count: taskStats.queued, color: "text-gray-400" },
          { key: "in_progress", label: "执行中", count: taskStats.in_progress, color: "text-cyan-400" },
          { key: "completed", label: "已完成", count: taskStats.completed, color: "text-emerald-400" },
          { key: "failed", label: "失败", count: taskStats.failed, color: "text-red-400" },
        ].map((stat) => (
          <button
            key={stat.key}
            onClick={() => setFilters({ ...filters, status: stat.key === "total" ? "" : (stat.key as AITaskStatus) })}
            className={`rounded-lg border border-white/10 bg-white/5 px-3 py-2 transition-colors hover:bg-white/10 ${
              (stat.key === "total" && !filters.status) || filters.status === stat.key ? "bg-white/10" : ""
            }`}
          >
            <div className={`text-lg font-bold ${stat.color}`}>{stat.count}</div>
            <div className="text-xs text-[#888]">{stat.label}</div>
          </button>
        ))}
      </div>

      {/* 工具栏：搜索和筛选 */}
      <div className="flex flex-wrap items-center gap-2">
        {/* 搜索框 */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#666]" />
          <input
            type="text"
            placeholder="搜索任务ID、Prompt..."
            value={filters.searchQuery}
            onChange={(e) => setFilters({ ...filters, searchQuery: e.target.value })}
            className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-10 pr-4 text-sm text-white placeholder-[#666] focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
          />
        </div>

        {/* 任务类型筛选 */}
        <select
          value={filters.type}
          onChange={(e) => setFilters({ ...filters, type: e.target.value as FilterState["type"] })}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-cyan-500/50 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
        >
          <option value="">全部类型</option>
          <option value="image">图片任务</option>
          <option value="video">视频任务</option>
        </select>

        {/* 清除筛选 */}
        {(filters.searchQuery || filters.type || filters.status) && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-[#888] transition-colors hover:text-white"
          >
            <XCircle className="h-3.5 w-3.5" />
            清除筛选
          </button>
        )}
      </div>

      {/* 任务列表表格 */}
      <div className="overflow-hidden rounded-xl border border-white/10 bg-[#181818]">
        {/* 表格头部 */}
        <div className="grid grid-cols-[60px_1fr_100px_120px_120px_80px] gap-3 border-b border-white/10 bg-white/5 px-4 py-2.5 text-xs font-medium text-[#888]">
          <div>类型</div>
          <div>Prompt描述</div>
          <div>状态</div>
          <div>创建时间</div>
          <div>耗时</div>
          <div>操作</div>
        </div>

        {/* 任务列表 */}
        <div className="divide-y divide-white/5">
          {paginatedTasks.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center text-center">
              <AlertCircle className="mb-3 h-10 w-10 text-[#333]" />
              <p className="text-sm text-[#666]">暂无任务</p>
              <p className="mt-1 text-xs text-[#444]">
                {tasks.length === 0 ? "创建任务后将在此显示" : "没有符合筛选条件的任务"}
              </p>
            </div>
          ) : (
            paginatedTasks.map((task) => {
              const statusConfig = statusConfigs[task.status];
              const typeConfig = typeConfigs[task.type];
              const StatusIcon = statusConfig.icon;
              const TypeIcon = typeConfig.icon;
              const isExpanded = expandedTaskId === task.id;

              return (
                <div key={task.id}>
                  {/* 任务行 */}
                  <div
                    className={`grid grid-cols-[60px_1fr_100px_120px_120px_80px] gap-3 px-4 py-3 transition-colors hover:bg-white/5 ${
                      isExpanded ? "bg-white/5" : ""
                    }`}
                  >
                    {/* 任务类型 */}
                    <div className="flex items-center gap-1.5">
                      <TypeIcon className={`h-4 w-4 ${typeConfig.color}`} />
                      <span className={`text-xs ${typeConfig.color}`}>{typeConfig.label}</span>
                    </div>

                    {/* Prompt描述 */}
                    <div className="flex items-center">
                      <div className="flex-1 truncate text-sm text-white">
                        {task.prompt}
                      </div>
                    </div>

                    {/* 状态 */}
                    <div className="flex items-center">
                      <span
                        className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-xs font-medium ${statusConfig.bgColor} ${statusConfig.textColor} ${statusConfig.borderColor}`}
                      >
                        <StatusIcon
                          className={`h-3 w-3 ${
                            task.status === "in_progress" ? "animate-spin" : ""
                          }`}
                        />
                        {statusConfig.label}
                      </span>
                    </div>

                    {/* 创建时间 */}
                    <div className="flex items-center text-xs text-[#888]">
                      <Calendar className="mr-1 h-3 w-3" />
                      {formatTime(task.createdAt)}
                    </div>

                    {/* 耗时 */}
                    <div className="flex items-center text-xs text-[#888]">
                      {task.duration ? (
                        <span>{formatDuration(task.duration)}</span>
                      ) : task.status === "in_progress" && task.progress ? (
                        <span className="text-cyan-400">{task.progress}%</span>
                      ) : (
                        <span className="text-[#666]">--</span>
                      )}
                    </div>

                    {/* 操作按钮 */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => toggleTaskDetails(task.id)}
                        className="rounded p-1 text-[#888] transition-colors hover:bg-white/10 hover:text-white"
                        title="查看详情"
                      >
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* 任务详情展开区域 */}
                  {isExpanded && (
                    <div className="border-t border-white/5 bg-white/[0.02] px-4 py-3">
                      <div className="grid gap-3 md:grid-cols-2">
                        {/* 基本信息 */}
                        <div className="space-y-1.5">
                          <h4 className="text-xs font-semibold text-[#888]">基本信息</h4>
                          <div className="space-y-1 text-xs">
                            <div className="flex gap-2">
                              <span className="w-16 text-[#666]">任务ID:</span>
                              <span className="font-mono text-white">{task.id}</span>
                            </div>
                            <div className="flex gap-2">
                              <span className="w-16 text-[#666]">任务类型:</span>
                              <span className="text-white">{typeConfig.label}</span>
                            </div>
                            <div className="flex gap-2">
                              <span className="w-16 text-[#666]">状态:</span>
                              <span className={statusConfig.textColor}>{statusConfig.label}</span>
                            </div>
                            <div className="flex gap-2">
                              <span className="w-16 text-[#666]">创建时间:</span>
                              <span className="text-white">
                                {new Date(task.createdAt).toLocaleString("zh-CN")}
                              </span>
                            </div>
                            {task.completedAt && (
                              <div className="flex gap-2">
                                <span className="w-16 text-[#666]">完成时间:</span>
                                <span className="text-white">
                                  {new Date(task.completedAt).toLocaleString("zh-CN")}
                                </span>
                              </div>
                            )}
                            {task.duration && (
                              <div className="flex gap-2">
                                <span className="w-16 text-[#666]">耗时:</span>
                                <span className="text-white">{formatDuration(task.duration)}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* 详细信息 */}
                        <div className="space-y-1.5">
                          <h4 className="text-xs font-semibold text-[#888]">详细信息</h4>
                          <div className="space-y-1 text-xs">
                            {/* 错误信息 */}
                            {task.error && (
                              <div className="rounded border border-red-500/30 bg-red-500/10 p-2">
                                <div className="mb-1 text-xs font-medium text-red-400">错误信息</div>
                                <div className="text-xs text-red-300">{task.error}</div>
                              </div>
                            )}

                            {/* 进度信息 */}
                            {task.status === "in_progress" && task.progress !== undefined && (
                              <div className="rounded border border-cyan-500/30 bg-cyan-500/10 p-2">
                                <div className="mb-2 text-xs font-medium text-cyan-400">执行进度</div>
                                <div className="h-2 overflow-hidden rounded-full bg-white/10">
                                  <div
                                    className="h-full rounded-full bg-cyan-500 transition-all"
                                    style={{ width: `${task.progress}%` }}
                                  />
                                </div>
                                <div className="mt-1 text-xs text-cyan-400">{task.progress}%</div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* 完整Prompt */}
                      <div className="mt-3">
                        <h4 className="mb-1.5 text-xs font-semibold text-[#888]">Prompt</h4>
                        <div className="rounded border border-white/10 bg-white/5 p-2.5 text-xs text-white">
                          {task.prompt}
                        </div>
                      </div>

                      {/* 生成的资源 */}
                      {task.resultUrls && task.resultUrls.length > 0 && (
                        <div className="mt-3">
                          <h4 className="mb-1.5 text-xs font-semibold text-[#888]">生成的资源</h4>
                          <div className="flex flex-wrap gap-2">
                            {task.resultUrls.map((url, index) => (
                              <a
                                key={index}
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 rounded border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-cyan-400 transition-colors hover:bg-white/10"
                              >
                                <Eye className="h-3 w-3" />
                                资源 {index + 1}
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 操作按钮 */}
                      <div className="mt-3 flex justify-end gap-2">
                        {task.status === "queued" || task.status === "in_progress" ? (
                          onCancelTask && (
                            <button
                              onClick={() => handleCancelTask(task.id)}
                              className="flex items-center gap-1 rounded-lg bg-orange-500/20 px-3 py-1.5 text-xs font-medium text-orange-400 transition-colors hover:bg-orange-500/30"
                            >
                              <XCircle className="h-3.5 w-3.5" />
                              取消任务
                            </button>
                          )
                        ) : null}
                        {task.status === "failed" && onRetryTask && (
                          <button
                            onClick={() => handleRetryTask(task.id)}
                            className="flex items-center gap-1 rounded-lg bg-blue-500/20 px-3 py-1.5 text-xs font-medium text-blue-400 transition-colors hover:bg-blue-500/30"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            重试任务
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 分页控制 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-4 py-2">
          <div className="text-xs text-[#888]">
            显示 {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, filteredTasks.length)} / {filteredTasks.length} 个任务
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="rounded p-1.5 text-[#888] transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => handlePageChange(page)}
                className={`min-w-[28px] rounded px-2 py-1 text-xs transition-colors ${
                  currentPage === page
                    ? "bg-cyan-500/20 text-cyan-400"
                    : "text-[#888] hover:bg-white/10 hover:text-white"
                }`}
              >
                {page}
              </button>
            ))}
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="rounded p-1.5 text-[#888] transition-colors hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* 底部提示 */}
      {filteredTasks.length > 0 && (
        <div className="flex items-center justify-between text-xs text-[#888]">
          <div className="flex items-center gap-4">
            {Object.entries(statusConfigs).map(([status, config]) => {
              const count = filteredTasks.filter((t) => t.status === status).length;
              if (count === 0) return null;
              const Icon = config.icon;
              return (
                <div key={status} className="flex items-center gap-1">
                  <Icon className={`h-3 w-3 ${config.textColor}`} />
                  <span>{config.label}: {count}</span>
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            {autoRefresh && (
              <div className="flex items-center gap-1">
                <div className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
                <span>自动刷新中</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}