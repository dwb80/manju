/**
 * @file review-queue.tsx
 * @description 审核队列组件，显示待审核内容列表和审核操作
 */

"use client";

import { useState, useMemo } from "react";
import {
  Film,
  Image,
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Calendar,
  User,
  ArrowUp,
  ArrowDown,
  Filter,
  RefreshCw,
} from "lucide-react";

/**
 * 审核队列管理组件：用于审核中心的待审核内容汇总列表。
 *
 * 功能：
 * - 显示待审核内容汇总列表
 * - 审核对象包括：分镜(storyboard)、资产(asset)、剧本(script)
 * - 每项显示：审核对象类型、名称/标题、提交人、提交时间、优先级、状态
 * - 支持优先级排序(默认：高→中→低)和按提交时间排序
 * - 支持快速审核操作(通过/驳回/需修改)
 * - 支持添加审核意见
 * - 统计信息显示
 *
 * @param projectId - 项目ID(可选,为空则显示所有项目的待审核)
 * @param pendingReviews - 待审核列表
 * @param onApprove - 通过审核回调
 * @param onReject - 驳回审核回调
 * @param onRequestChanges - 需修改回调
 * @param loading - 加载状态
 * @param onRefresh - 刷新回调
 *
 * @example
 * ```tsx
 * <ReviewQueue
 *   projectId="project-123"
 *   pendingReviews={reviews}
 *   onApprove={(id, comment) => handleApprove(id, comment)}
 *   onReject={(id, comment) => handleReject(id, comment)}
 *   onRequestChanges={(id, comment) => handleRequestChanges(id, comment)}
 *   loading={false}
 *   onRefresh={() => fetchReviews()}
 * />
 * ```
 */

/** 审核对象类型 */
export type ReviewTargetType = "storyboard" | "asset" | "script";

/** 审核优先级 */
export type ReviewPriority = "high" | "medium" | "low";

/** 审核状态 */
export type ReviewStatus = "pending" | "in_review";

/** 待审核项数据类型 */
export interface PendingReviewItem {
  /** 审核ID */
  id: string;
  /** 项目ID */
  projectId: string;
  /** 项目名称 */
  projectName: string;
  /** 审核对象类型 */
  targetType: ReviewTargetType;
  /** 审核对象ID */
  targetId: string;
  /** 审核对象名称或标题 */
  targetName: string;
  /** 提交人 */
  submitter?: string;
  /** 提交时间 */
  submittedAt: string;
  /** 审核优先级 */
  priority: ReviewPriority;
  /** 审核状态 */
  status: ReviewStatus;
  /** 审核描述/备注 */
  description?: string;
  /** 缩略图URL(可选) */
  thumbnailUrl?: string;
}

/** 审核操作结果类型 */
export interface ReviewActionResult {
  /** 审核ID */
  reviewId: string;
  /** 审核意见 */
  comment: string;
}

type ReviewQueueProps = {
  /** 项目ID(可选,为空则显示所有项目的待审核) */
  projectId?: string;
  /** 待审核列表 */
  pendingReviews: PendingReviewItem[];
  /** 通过审核回调 */
  onApprove: (reviewId: string, comment: string) => void | Promise<void>;
  /** 驳回审核回调 */
  onReject: (reviewId: string, comment: string) => void | Promise<void>;
  /** 需修改回调 */
  onRequestChanges: (reviewId: string, comment: string) => void | Promise<void>;
  /** 加载状态 */
  loading?: boolean;
  /** 刷新回调 */
  onRefresh?: () => void | Promise<void>;
};

/** 排序类型 */
type SortType = "priority" | "time";

/** 审核对象类型配置 */
type TargetTypeConfig = {
  label: string;
  icon: typeof Film;
  color: string;
  bgColor: string;
};

/** 优先级配置 */
type PriorityConfig = {
  label: string;
  icon: typeof ArrowUp;
  color: string;
  bgColor: string;
  borderColor: string;
};

/** 状态配置 */
type StatusConfig = {
  label: string;
  icon: typeof Clock;
  color: string;
  bgColor: string;
  borderColor: string;
};

export function ReviewQueue({
  projectId,
  pendingReviews,
  onApprove,
  onReject,
  onRequestChanges,
  loading = false,
  onRefresh,
}: ReviewQueueProps) {
  // 排序类型
  const [sortBy, setSortBy] = useState<SortType>("priority");
  // 排序方向(仅用于时间排序)
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  // 展开的审核项ID
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // 审核意见输入
  const [reviewComments, setReviewComments] = useState<Record<string, string>>({});
  // 刷新中状态
  const [isRefreshing, setIsRefreshing] = useState(false);

  // 审核对象类型配置映射
  const targetTypeConfigs: Record<ReviewTargetType, TargetTypeConfig> = {
    storyboard: {
      label: "分镜",
      icon: Film,
      color: "text-purple-400",
      bgColor: "bg-purple-500/20",
    },
    asset: {
      label: "资产",
      icon: Image,
      color: "text-amber-400",
      bgColor: "bg-amber-500/20",
    },
    script: {
      label: "剧本",
      icon: FileText,
      color: "text-cyan-400",
      bgColor: "bg-cyan-500/20",
    },
  };

  // 优先级配置映射
  const priorityConfigs: Record<ReviewPriority, PriorityConfig> = {
    high: {
      label: "高",
      icon: ArrowUp,
      color: "text-red-400",
      bgColor: "bg-red-500/20",
      borderColor: "border-red-500/30",
    },
    medium: {
      label: "中",
      icon: ArrowUp,
      color: "text-orange-400",
      bgColor: "bg-orange-500/20",
      borderColor: "border-orange-500/30",
    },
    low: {
      label: "低",
      icon: ArrowDown,
      color: "text-blue-400",
      bgColor: "bg-blue-500/20",
      borderColor: "border-blue-500/30",
    },
  };

  // 状态配置映射
  const statusConfigs: Record<ReviewStatus, StatusConfig> = {
    pending: {
      label: "待审核",
      icon: Clock,
      color: "text-yellow-400",
      bgColor: "bg-yellow-500/20",
      borderColor: "border-yellow-500/30",
    },
    in_review: {
      label: "审核中",
      icon: AlertTriangle,
      color: "text-cyan-400",
      bgColor: "bg-cyan-500/20",
      borderColor: "border-cyan-500/30",
    },
  };

  /**
   * 优先级权重映射
   */
  const priorityWeight: Record<ReviewPriority, number> = {
    high: 3,
    medium: 2,
    low: 1,
  };

  /**
   * 格式化时间显示
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
   * 判断是否为今日提交
   */
  const isToday = (dateString: string): boolean => {
    const date = new Date(dateString);
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  /**
   * 排序后的审核列表
   */
  const sortedReviews = useMemo(() => {
    return [...pendingReviews].sort((a, b) => {
      if (sortBy === "priority") {
        // 按优先级排序：高→中→低
        return priorityWeight[b.priority] - priorityWeight[a.priority];
      } else {
        // 按提交时间排序
        const timeA = new Date(a.submittedAt).getTime();
        const timeB = new Date(b.submittedAt).getTime();
        return sortOrder === "desc" ? timeB - timeA : timeA - timeB;
      }
    });
  }, [pendingReviews, sortBy, sortOrder]);

  /**
   * 统计信息
   */
  const statistics = useMemo(() => {
    const total = pendingReviews.length;
    const highPriority = pendingReviews.filter((r) => r.priority === "high").length;
    const todayCount = pendingReviews.filter((r) => isToday(r.submittedAt)).length;

    return { total, highPriority, todayCount };
  }, [pendingReviews]);

  /**
   * 处理刷新
   */
  const handleRefresh = async () => {
    if (!onRefresh || isRefreshing) return;

    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  /**
   * 切换审核项展开状态
   */
  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  /**
   * 更新审核意见
   */
  const updateComment = (reviewId: string, comment: string) => {
    setReviewComments((prev) => ({ ...prev, [reviewId]: comment }));
  };

  /**
   * 处理通过审核
   */
  const handleApprove = async (reviewId: string) => {
    const comment = reviewComments[reviewId] || "";
    await onApprove(reviewId, comment);
    setReviewComments((prev) => {
      const newComments = { ...prev };
      delete newComments[reviewId];
      return newComments;
    });
  };

  /**
   * 处理驳回审核
   */
  const handleReject = async (reviewId: string) => {
    const comment = reviewComments[reviewId] || "";
    await onReject(reviewId, comment);
    setReviewComments((prev) => {
      const newComments = { ...prev };
      delete newComments[reviewId];
      return newComments;
    });
  };

  /**
   * 处理需修改
   */
  const handleRequestChanges = async (reviewId: string) => {
    const comment = reviewComments[reviewId] || "";
    await onRequestChanges(reviewId, comment);
    setReviewComments((prev) => {
      const newComments = { ...prev };
      delete newComments[reviewId];
      return newComments;
    });
  };

  // 加载中骨架屏
  if (loading) {
    return (
      <div className="space-y-6">
        {/* 统计信息骨架 */}
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-white/5" />
          ))}
        </div>

        {/* 排序和筛选骨架 */}
        <div className="flex gap-3">
          <div className="h-10 w-40 animate-pulse rounded-lg bg-white/5" />
          <div className="h-10 w-40 animate-pulse rounded-lg bg-white/5" />
        </div>

        {/* 审核列表骨架 */}
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-lg bg-white/5" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 标题区域 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500/20 to-cyan-500/20">
            <CheckCircle2 className="h-5 w-5 text-purple-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">待审核队列</h2>
            <p className="text-sm text-[#888]">
              {projectId ? "项目审核" : "跨项目审核"} · 共 {pendingReviews.length} 项待审核
            </p>
          </div>
        </div>

        {/* 刷新按钮 */}
        {onRefresh && (
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            {isRefreshing ? "刷新中..." : "刷新"}
          </button>
        )}
      </div>

      {/* 统计信息卡片 */}
      <div className="grid grid-cols-3 gap-4">
        {/* 待审核总数 */}
        <div className="rounded-xl border border-white/10 bg-gradient-to-br from-purple-500/10 to-purple-500/5 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/20">
              <FileText className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{statistics.total}</div>
              <div className="text-xs text-[#888]">待审核总数</div>
            </div>
          </div>
        </div>

        {/* 高优先级数量 */}
        <div className="rounded-xl border border-white/10 bg-gradient-to-br from-red-500/10 to-red-500/5 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/20">
              <AlertTriangle className="h-5 w-5 text-red-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{statistics.highPriority}</div>
              <div className="text-xs text-[#888]">高优先级</div>
            </div>
          </div>
        </div>

        {/* 今日新增 */}
        <div className="rounded-xl border border-white/10 bg-gradient-to-br from-cyan-500/10 to-cyan-500/5 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-500/20">
              <Calendar className="h-5 w-5 text-cyan-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{statistics.todayCount}</div>
              <div className="text-xs text-[#888]">今日新增</div>
            </div>
          </div>
        </div>
      </div>

      {/* 排序和筛选工具栏 */}
      <div className="flex items-center gap-3">
        <Filter className="h-4 w-4 text-[#888]" />
        <span className="text-sm text-[#888]">排序：</span>

        {/* 优先级排序 */}
        <button
          onClick={() => setSortBy("priority")}
          className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-all ${
            sortBy === "priority"
              ? "border-purple-500/50 bg-purple-500/20 text-purple-400"
              : "border-white/10 bg-white/5 text-[#888] hover:bg-white/10 hover:text-white"
          }`}
        >
          按优先级
        </button>

        {/* 时间排序 */}
        <button
          onClick={() => {
            if (sortBy === "time") {
              setSortOrder(sortOrder === "desc" ? "asc" : "desc");
            } else {
              setSortBy("time");
              setSortOrder("desc");
            }
          }}
          className={`flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm font-medium transition-all ${
            sortBy === "time"
              ? "border-cyan-500/50 bg-cyan-500/20 text-cyan-400"
              : "border-white/10 bg-white/5 text-[#888] hover:bg-white/10 hover:text-white"
          }`}
        >
          按提交时间
          {sortBy === "time" && (sortOrder === "desc" ? " ↓" : " ↑")}
        </button>
      </div>

      {/* 审核列表 */}
      <div className="space-y-2">
        {sortedReviews.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-white/10 bg-[#181818] text-center">
            <CheckCircle2 className="mb-3 h-12 w-12 text-[#333]" />
            <p className="text-sm text-[#666]">暂无待审核项</p>
            <p className="mt-1 text-xs text-[#444]">所有审核已完成</p>
          </div>
        ) : (
          sortedReviews.map((review) => {
            const typeConfig = targetTypeConfigs[review.targetType];
            const priorityConfig = priorityConfigs[review.priority];
            const statusConfig = statusConfigs[review.status];
            const TypeIcon = typeConfig.icon;
            const PriorityIcon = priorityConfig.icon;
            const StatusIcon = statusConfig.icon;
            const isExpanded = expandedId === review.id;

            return (
              <div
                key={review.id}
                className="overflow-hidden rounded-xl border border-white/10 bg-[#181818] transition-all hover:border-white/20"
              >
                {/* 审核项主内容 */}
                <div
                  className="flex cursor-pointer items-center gap-4 p-4"
                  onClick={() => toggleExpand(review.id)}
                >
                  {/* 左侧：审核对象类型 */}
                  <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${typeConfig.bgColor}`}>
                    <TypeIcon className={`h-6 w-6 ${typeConfig.color}`} />
                  </div>

                  {/* 中间：审核信息 */}
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white">{review.targetName}</span>
                      <span className={`rounded px-1.5 py-0.5 text-xs ${typeConfig.bgColor} ${typeConfig.color}`}>
                        {typeConfig.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-[#888]">
                      {review.submitter && (
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          <span>{review.submitter}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        <span>{formatTime(review.submittedAt)}</span>
                      </div>
                      {!projectId && (
                        <div className="flex items-center gap-1">
                          <span className="text-[#666]">项目:</span>
                          <span>{review.projectName}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 右侧：优先级和状态 */}
                  <div className="flex items-center gap-3">
                    {/* 优先级 */}
                    <span
                      className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-medium ${priorityConfig.bgColor} ${priorityConfig.color} ${priorityConfig.borderColor}`}
                    >
                      <PriorityIcon className="h-3 w-3" />
                      {priorityConfig.label}优先级
                    </span>

                    {/* 状态 */}
                    <span
                      className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-medium ${statusConfig.bgColor} ${statusConfig.color} ${statusConfig.borderColor}`}
                    >
                      <StatusIcon className="h-3 w-3" />
                      {statusConfig.label}
                    </span>

                    {/* 展开/收起图标 */}
                    {isExpanded ? (
                      <ChevronUp className="h-5 w-5 text-[#888]" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-[#888]" />
                    )}
                  </div>
                </div>

                {/* 展开的详情区域 */}
                {isExpanded && (
                  <div className="border-t border-white/10 bg-white/[0.02] p-4">
                    {/* 缩略图和描述 */}
                    <div className="mb-4 flex gap-4">
                      {review.thumbnailUrl && (
                        <div className="h-32 w-32 flex-shrink-0 overflow-hidden rounded-lg border border-white/10 bg-white/5">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={review.thumbnailUrl}
                            alt={review.targetName}
                            className="h-full w-full object-cover"
                          />
                        </div>
                      )}
                      <div className="flex-1 space-y-2">
                        <h4 className="text-xs font-semibold text-[#888]">审核详情</h4>
                        {review.description && (
                          <p className="text-sm text-white">{review.description}</p>
                        )}
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-[#666]">审核对象类型：</span>
                            <span className="text-white">{typeConfig.label}</span>
                          </div>
                          <div>
                            <span className="text-[#666]">审核对象ID：</span>
                            <span className="font-mono text-white">{review.targetId}</span>
                          </div>
                          {review.submitter && (
                            <div>
                              <span className="text-[#666]">提交人：</span>
                              <span className="text-white">{review.submitter}</span>
                            </div>
                          )}
                          <div>
                            <span className="text-[#666]">提交时间：</span>
                            <span className="text-white">
                              {new Date(review.submittedAt).toLocaleString("zh-CN")}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 审核意见输入 */}
                    <div className="mb-4">
                      <label className="mb-2 block text-xs font-semibold text-[#888]">审核意见</label>
                      <textarea
                        value={reviewComments[review.id] || ""}
                        onChange={(e) => updateComment(review.id, e.target.value)}
                        placeholder="请输入审核意见（可选）..."
                        rows={3}
                        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-[#666] focus:border-purple-500/50 focus:outline-none focus:ring-1 focus:ring-purple-500/50"
                      />
                    </div>

                    {/* 操作按钮 */}
                    <div className="flex justify-end gap-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRequestChanges(review.id);
                        }}
                        className="flex items-center gap-2 rounded-lg border border-orange-500/30 bg-orange-500/10 px-4 py-2 text-sm font-medium text-orange-400 transition-colors hover:bg-orange-500/20"
                      >
                        <AlertTriangle className="h-4 w-4" />
                        需修改
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleReject(review.id);
                        }}
                        className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/20"
                      >
                        <XCircle className="h-4 w-4" />
                        驳回
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleApprove(review.id);
                        }}
                        className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-400 transition-colors hover:bg-emerald-500/20"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        通过
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* 底部统计 */}
      {sortedReviews.length > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-xs text-[#888]">
          <div className="flex items-center gap-4">
            <span>显示 {sortedReviews.length} 个待审核项</span>
            <div className="flex items-center gap-3">
              {/* 按类型统计 */}
              {Object.entries(targetTypeConfigs).map(([type, config]) => {
                const count = sortedReviews.filter((r) => r.targetType === type).length;
                if (count === 0) return null;
                const Icon = config.icon;
                return (
                  <div key={type} className="flex items-center gap-1">
                    <Icon className={`h-3 w-3 ${config.color}`} />
                    <span>{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span>最后更新: {new Date().toLocaleTimeString("zh-CN")}</span>
          </div>
        </div>
      )}
    </div>
  );
}