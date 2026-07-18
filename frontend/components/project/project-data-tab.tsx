/**
 * @file project-data-tab.tsx
 * @description 项目数据Tab组件，显示项目的数据统计和分析
 */

"use client";

import { useMemo } from "react";
import {
  TrendingUp,
  Film,
  Image,
  Video,
  Users,
  MapPin,
  Clock,
  Calendar,
  BarChart3,
  DollarSign,
  Zap,
  Timer,
  Layers,
} from "lucide-react";
import type { ProjectSummary } from "@/lib/app-types";

/**
 * 项目数据Tab组件：显示项目的数据统计和分析。
 *
 * 功能：
 * - 显示项目数据统计：
 *   * 项目进度百分比
 *   * 剧集统计(总数、已完成数、完成率)
 *   * 分镜统计(总数、已完成数、完成率)
 *   * 视频统计(总数、已完成数、完成率)
 *   * 资产统计(角色数、场景数、图片数、视频数)
 * - 显示AI使用数据：
 *   * 图片生成次数
 *   * 视频生成次数
 *   * AI成本估算
 *   * 平均响应时间
 * - 显示时间数据：
 *   * 项目创建时间
 *   * 项目持续时间
 *   * 预计完成时间
 *   * 剩余天数(如设置了截止日期)
 * - 数据可视化：
 *   * 使用进度条展示完成率
 *   * 使用卡片展示关键指标
 *
 * 设计依据：
 * - 参考现有组件的深色主题设计风格
 * - 卡片式布局展示统计数据
 * - 进度条使用不同颜色区分状态
 * - 数据分组展示(项目数据、AI数据、时间数据)
 *
 * @param projectId - 项目ID
 * @param projectSummary - 项目统计摘要数据
 * @param aiUsageStats - AI使用统计数据(可选)
 *
 * @example
 * ```tsx
 * <ProjectDataTab
 *   projectId="project-123"
 *   projectSummary={summary}
 *   aiUsageStats={{
 *     imageGenerations: 100,
 *     videoGenerations: 50,
 *     estimatedCost: 25.50,
 *     avgResponseTime: 3.2
 *   }}
 * />
 * ```
 */

/** AI使用统计数据类型 */
export interface AIUsageStats {
  /** 图片生成次数 */
  imageGenerations: number;
  /** 视频生成次数 */
  videoGenerations: number;
  /** AI成本估算(美元) */
  estimatedCost: number;
  /** 平均响应时间(秒) */
  avgResponseTime: number;
}

/** 资产统计类型 */
type AssetStats = {
  /** 角色数量 */
  characters: number;
  /** 场景数量 */
  scenes: number;
  /** 图片数量 */
  images: number;
  /** 视频数量 */
  videos: number;
};

/** 进度条配置类型 */
type ProgressConfig = {
  /** 百分比(0-100) */
  percentage: number;
  /** 背景颜色 */
  bgColor: string;
  /** 进度条颜色 */
  barColor: string;
};

/** 统计卡片配置类型 */
type StatCardConfig = {
  /** 图标组件 */
  icon: typeof TrendingUp;
  /** 标题 */
  label: string;
  /** 主数值 */
  value: string | number;
  /** 副文本 */
  subText?: string;
  /** 图标背景颜色 */
  iconBgColor: string;
  /** 图标颜色 */
  iconColor: string;
};

/** 进度卡片配置类型 */
type ProgressCardConfig = {
  /** 图标组件 */
  icon: typeof Film;
  /** 标题 */
  label: string;
  /** 当前值 */
  current: number;
  /** 总值 */
  total: number;
  /** 百分比 */
  percentage: number;
  /** 进度条颜色 */
  barColor: string;
  /** 子标签 */
  subLabel?: string;
};

type ProjectDataTabProps = {
  /** 项目ID */
  projectId: string;
  /** 项目统计摘要数据 */
  projectSummary: ProjectSummary | null;
  /** AI使用统计数据(可选) */
  aiUsageStats?: AIUsageStats | null;
  /** 资产统计数据(可选) */
  assetStats?: AssetStats | null;
};

export function ProjectDataTab({
  projectId,
  projectSummary,
  aiUsageStats,
  assetStats,
}: ProjectDataTabProps) {
  /**
   * 计算项目整体进度
   */
  const overallProgress = useMemo(() => {
    if (!projectSummary) return 0;

    const completedImages = projectSummary.completed_images || 0;
    const completedVideos = projectSummary.completed_videos || 0;
    const totalImages = projectSummary.images || 0;
    const totalVideos = projectSummary.videos || 0;
    const total = totalImages + totalVideos;
    const completed = completedImages + completedVideos;

    if (total === 0) return 0;
    return Math.round((completed / total) * 100);
  }, [projectSummary]);

  /**
   * 计算分镜完成率
   */
  const storyboardProgress = useMemo(() => {
    if (!projectSummary) return { current: 0, total: 0, percentage: 0 };

    const total = projectSummary.images || 0;
    const current = projectSummary.completed_images || 0;
    const percentage = total === 0 ? 0 : Math.round((current / total) * 100);

    return { current, total, percentage };
  }, [projectSummary]);

  /**
   * 计算视频完成率
   */
  const videoProgress = useMemo(() => {
    if (!projectSummary) return { current: 0, total: 0, percentage: 0 };

    const total = projectSummary.videos || 0;
    const current = projectSummary.completed_videos || 0;
    const percentage = total === 0 ? 0 : Math.round((current / total) * 100);

    return { current, total, percentage };
  }, [projectSummary]);

  /**
   * 计算任务完成率
   */
  const taskProgress = useMemo(() => {
    if (!projectSummary) return { current: 0, total: 0, percentage: 0 };

    const total = projectSummary.tasks || 0;
    const current = projectSummary.completed_tasks || 0;
    const percentage = total === 0 ? 0 : Math.round((current / total) * 100);

    return { current, total, percentage };
  }, [projectSummary]);

  /**
   * 计算问题解决率
   */
  const issueProgress = useMemo(() => {
    if (!projectSummary) return { current: 0, total: 0, percentage: 0 };

    const total = projectSummary.issues || 0;
    const current = total - (projectSummary.open_issues || 0);
    const percentage = total === 0 ? 0 : Math.round((current / total) * 100);

    return { current, total, percentage };
  }, [projectSummary]);

  /**
   * 时间相关数据
   */
  const timeData = useMemo(() => {
    if (!projectSummary?.project) return null;

    const project = projectSummary.project;
    const createdAt = new Date(project.created_at);
    const now = new Date();

    // 计算项目持续天数
    const durationDays = Math.floor(
      (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );

    // 计算剩余天数(如果有截止日期)
    let remainingDays: number | null = null;
    let dueDate: string | null = null;

    if (project.due_date) {
      const due = new Date(project.due_date);
      dueDate = due.toLocaleDateString("zh-CN", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      remainingDays = Math.ceil(
        (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
    }

    return {
      createdAt: createdAt.toLocaleDateString("zh-CN", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
      durationDays,
      dueDate,
      remainingDays,
    };
  }, [projectSummary]);

  /**
   * 格式化金额
   */
  const formatCost = (cost: number): string => {
    return `$${cost.toFixed(2)}`;
  };

  /**
   * 获取进度条颜色
   */
  const getProgressColor = (percentage: number): string => {
    if (percentage >= 80) return "bg-emerald-500";
    if (percentage >= 60) return "bg-cyan-500";
    if (percentage >= 40) return "bg-yellow-500";
    if (percentage >= 20) return "bg-orange-500";
    return "bg-red-500";
  };

  /**
   * 进度卡片列表
   */
  const progressCards: ProgressCardConfig[] = [
    {
      icon: Image,
      label: "分镜进度",
      current: storyboardProgress.current,
      total: storyboardProgress.total,
      percentage: storyboardProgress.percentage,
      barColor: getProgressColor(storyboardProgress.percentage),
      subLabel: `${storyboardProgress.current}/${storyboardProgress.total} 已完成`,
    },
    {
      icon: Video,
      label: "视频进度",
      current: videoProgress.current,
      total: videoProgress.total,
      percentage: videoProgress.percentage,
      barColor: getProgressColor(videoProgress.percentage),
      subLabel: `${videoProgress.current}/${videoProgress.total} 已完成`,
    },
    {
      icon: Layers,
      label: "任务进度",
      current: taskProgress.current,
      total: taskProgress.total,
      percentage: taskProgress.percentage,
      barColor: getProgressColor(taskProgress.percentage),
      subLabel: `${taskProgress.current}/${taskProgress.total} 已完成`,
    },
    {
      icon: BarChart3,
      label: "问题解决",
      current: issueProgress.current,
      total: issueProgress.total,
      percentage: issueProgress.percentage,
      barColor: getProgressColor(issueProgress.percentage),
      subLabel: `${issueProgress.current}/${issueProgress.total} 已解决`,
    },
  ];

  /**
   * 统计卡片列表
   */
  const statCards: StatCardConfig[] = [
    {
      icon: Film,
      label: "剧集数",
      value: projectSummary?.episodes || 0,
      subText: "总剧集",
      iconBgColor: "bg-purple-500/20",
      iconColor: "text-purple-400",
    },
    {
      icon: Users,
      label: "团队成员",
      value: projectSummary?.members || 0,
      subText: "位成员",
      iconBgColor: "bg-blue-500/20",
      iconColor: "text-blue-400",
    },
    {
      icon: MapPin,
      label: "里程碑",
      value: projectSummary?.milestones || 0,
      subText: `${projectSummary?.open_milestones || 0} 进行中`,
      iconBgColor: "bg-amber-500/20",
      iconColor: "text-amber-400",
    },
    {
      icon: TrendingUp,
      label: "对话数",
      value: projectSummary?.conversations || 0,
      subText: "次对话",
      iconBgColor: "bg-emerald-500/20",
      iconColor: "text-emerald-400",
    },
  ];

  /**
   * AI使用统计卡片列表
   */
  const aiStatCards: StatCardConfig[] = [
    {
      icon: Image,
      label: "图片生成",
      value: aiUsageStats?.imageGenerations || 0,
      subText: "次生成",
      iconBgColor: "bg-pink-500/20",
      iconColor: "text-pink-400",
    },
    {
      icon: Video,
      label: "视频生成",
      value: aiUsageStats?.videoGenerations || 0,
      subText: "次生成",
      iconBgColor: "bg-indigo-500/20",
      iconColor: "text-indigo-400",
    },
    {
      icon: DollarSign,
      label: "成本估算",
      value: aiUsageStats ? formatCost(aiUsageStats.estimatedCost) : "$0.00",
      subText: "累计成本",
      iconBgColor: "bg-green-500/20",
      iconColor: "text-green-400",
    },
    {
      icon: Timer,
      label: "平均响应",
      value: aiUsageStats ? `${aiUsageStats.avgResponseTime}s` : "--",
      subText: "响应时间",
      iconBgColor: "bg-cyan-500/20",
      iconColor: "text-cyan-400",
    },
  ];

  /**
   * 资产统计卡片列表
   */
  const assetStatCards: StatCardConfig[] = [
    {
      icon: Users,
      label: "角色资产",
      value: assetStats?.characters || 0,
      subText: "个角色",
      iconBgColor: "bg-violet-500/20",
      iconColor: "text-violet-400",
    },
    {
      icon: MapPin,
      label: "场景资产",
      value: assetStats?.scenes || 0,
      subText: "个场景",
      iconBgColor: "bg-teal-500/20",
      iconColor: "text-teal-400",
    },
    {
      icon: Image,
      label: "图片资产",
      value: assetStats?.images || 0,
      subText: "张图片",
      iconBgColor: "bg-rose-500/20",
      iconColor: "text-rose-400",
    },
    {
      icon: Video,
      label: "视频资产",
      value: assetStats?.videos || 0,
      subText: "个视频",
      iconBgColor: "bg-sky-500/20",
      iconColor: "text-sky-400",
    },
  ];

  return (
    <div className="space-y-6">
      {/* 整体进度卡片 */}
      <div className="rounded-[22px] border border-white/10 bg-gradient-to-br from-[#202020] to-[#1a1a1a] p-6 shadow-lg">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">项目整体进度</h3>
            <p className="mt-1 text-sm text-[#888]">
              综合分镜和视频完成情况
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20">
              <TrendingUp className="h-7 w-7 text-cyan-400" />
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-white">{overallProgress}%</div>
              <div className="text-xs text-[#888]">完成度</div>
            </div>
          </div>
        </div>

        {/* 整体进度条 */}
        <div className="space-y-2">
          <div className="h-4 overflow-hidden rounded-full bg-white/5">
            <div
              className={`h-full rounded-full transition-all duration-500 ${getProgressColor(overallProgress)}`}
              style={{ width: `${overallProgress}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-[#888]">
            <span>开始</span>
            <span>{overallProgress}% 完成</span>
            <span>完成</span>
          </div>
        </div>
      </div>

      {/* 进度统计网格 */}
      <div>
        <h4 className="mb-4 text-base font-semibold text-white">进度统计</h4>
        <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
          {progressCards.map((card, index) => {
            const Icon = card.icon;
            return (
              <div
                key={index}
                className="rounded-xl border border-white/10 bg-[#202020] p-5 transition-all hover:border-white/20"
              >
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`rounded-lg bg-white/5 p-2`}>
                      <Icon className="h-5 w-5 text-white/70" />
                    </div>
                    <span className="text-sm font-medium text-white">
                      {card.label}
                    </span>
                  </div>
                  <div className="text-2xl font-bold text-white">
                    {card.percentage}%
                  </div>
                </div>

                {/* 进度条 */}
                <div className="mb-2 h-2 overflow-hidden rounded-full bg-white/5">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${card.barColor}`}
                    style={{ width: `${card.percentage}%` }}
                  />
                </div>

                {/* 子标签 */}
                {card.subLabel && (
                  <div className="text-xs text-[#888]">{card.subLabel}</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 项目数据统计 */}
      <div>
        <h4 className="mb-4 text-base font-semibold text-white">项目数据</h4>
        <div className="grid grid-cols-4 gap-4 max-lg:grid-cols-2 max-sm:grid-cols-1">
          {statCards.map((card, index) => {
            const Icon = card.icon;
            return (
              <div
                key={index}
                className="rounded-xl border border-white/10 bg-[#202020] p-5 transition-all hover:border-white/20"
              >
                <div className="mb-3 flex items-center gap-3">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-lg ${card.iconBgColor}`}
                  >
                    <Icon className={`h-5 w-5 ${card.iconColor}`} />
                  </div>
                  <div className="text-sm text-[#888]">{card.label}</div>
                </div>
                <div className="text-3xl font-bold text-white">{card.value}</div>
                {card.subText && (
                  <div className="mt-1 text-xs text-[#666]">{card.subText}</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 资产统计 */}
      {assetStats && (
        <div>
          <h4 className="mb-4 text-base font-semibold text-white">资产统计</h4>
          <div className="grid grid-cols-4 gap-4 max-lg:grid-cols-2 max-sm:grid-cols-1">
            {assetStatCards.map((card, index) => {
              const Icon = card.icon;
              return (
                <div
                  key={index}
                  className="rounded-xl border border-white/10 bg-[#202020] p-5 transition-all hover:border-white/20"
                >
                  <div className="mb-3 flex items-center gap-3">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-lg ${card.iconBgColor}`}
                    >
                      <Icon className={`h-5 w-5 ${card.iconColor}`} />
                    </div>
                    <div className="text-sm text-[#888]">{card.label}</div>
                  </div>
                  <div className="text-3xl font-bold text-white">
                    {card.value}
                  </div>
                  {card.subText && (
                    <div className="mt-1 text-xs text-[#666]">{card.subText}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* AI使用统计 */}
      <div>
        <h4 className="mb-4 text-base font-semibold text-white">AI使用统计</h4>
        <div className="rounded-[22px] border border-white/10 bg-[#202020] p-6">
          <div className="grid grid-cols-4 gap-4 max-lg:grid-cols-2 max-sm:grid-cols-1">
            {aiStatCards.map((card, index) => {
              const Icon = card.icon;
              return (
                <div
                  key={index}
                  className="rounded-xl border border-white/5 bg-white/[0.02] p-4 transition-all hover:bg-white/[0.04]"
                >
                  <div className="mb-3 flex items-center gap-2">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-lg ${card.iconBgColor}`}
                    >
                      <Icon className={`h-4 w-4 ${card.iconColor}`} />
                    </div>
                    <div className="text-xs text-[#888]">{card.label}</div>
                  </div>
                  <div className="text-2xl font-bold text-white">{card.value}</div>
                  {card.subText && (
                    <div className="mt-1 text-xs text-[#666]">{card.subText}</div>
                  )}
                </div>
              );
            })}
          </div>

          {/* AI统计说明 */}
          {!aiUsageStats && (
            <div className="mt-4 rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-4">
              <div className="flex items-start gap-3">
                <Zap className="mt-0.5 h-5 w-5 text-cyan-400" />
                <div>
                  <div className="text-sm font-medium text-cyan-400">
                    AI使用数据未启用
                  </div>
                  <div className="mt-1 text-xs text-[#888]">
                    启用AI使用统计后，将在此显示图片生成次数、视频生成次数、成本估算等数据。
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 时间数据 */}
      {timeData && (
        <div>
          <h4 className="mb-4 text-base font-semibold text-white">时间数据</h4>
          <div className="rounded-[22px] border border-white/10 bg-[#202020] p-6">
            <div className="grid grid-cols-3 gap-4 max-md:grid-cols-1">
              {/* 创建时间 */}
              <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-[#888]" />
                  <span className="text-sm text-[#888]">创建时间</span>
                </div>
                <div className="text-base font-semibold text-white">
                  {timeData.createdAt}
                </div>
              </div>

              {/* 项目持续时间 */}
              <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-[#888]" />
                  <span className="text-sm text-[#888]">已持续时间</span>
                </div>
                <div className="text-base font-semibold text-white">
                  {timeData.durationDays} 天
                </div>
              </div>

              {/* 截止日期 */}
              <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Timer className="h-4 w-4 text-[#888]" />
                  <span className="text-sm text-[#888]">
                    {timeData.remainingDays !== null ? "剩余天数" : "截止日期"}
                  </span>
                </div>
                <div className="text-base font-semibold text-white">
                  {timeData.remainingDays !== null ? (
                    <>
                      <span
                        className={
                          timeData.remainingDays < 0
                            ? "text-red-400"
                            : timeData.remainingDays < 7
                            ? "text-orange-400"
                            : "text-white"
                        }
                      >
                        {timeData.remainingDays < 0
                          ? `已超期 ${Math.abs(timeData.remainingDays)} 天`
                          : `${timeData.remainingDays} 天`}
                      </span>
                      {timeData.dueDate && (
                        <div className="mt-1 text-xs text-[#666]">
                          截止: {timeData.dueDate}
                        </div>
                      )}
                    </>
                  ) : (
                    <span className="text-[#666]">未设置</span>
                  )}
                </div>
              </div>
            </div>

            {/* 最近活动时间 */}
            {projectSummary?.latest_activity_at && (
              <div className="mt-4 flex items-center gap-2 text-sm text-[#888]">
                <Clock className="h-4 w-4" />
                <span>
                  最近活动:{" "}
                  {new Date(projectSummary.latest_activity_at).toLocaleString(
                    "zh-CN"
                  )}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 空状态提示 */}
      {!projectSummary && (
        <div className="flex h-64 flex-col items-center justify-center text-center">
          <BarChart3 className="mb-4 h-12 w-12 text-[#333]" />
          <div className="text-base font-medium text-[#666]">暂无项目数据</div>
          <div className="mt-1 text-sm text-[#444]">
            项目数据将在创建后显示在此处
          </div>
        </div>
      )}
    </div>
  );
}