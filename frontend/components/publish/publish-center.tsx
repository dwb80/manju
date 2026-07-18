/**
 * @file publish-center.tsx
 * @description 发布中心组件，管理视频发布计划和已发布视频列表
 */

"use client";

import { useState, useMemo } from "react";
import {
  Video,
  Upload,
  Calendar,
  TrendingUp,
  PlayCircle,
  Clock,
  CheckCircle,
  BarChart3,
  ChevronRight,
  Package,
} from "lucide-react";
import { Pagination } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PublishedVideo, PublishPlan as PublishPlanType, PublishPlatform } from "./published-videos-list";

/**
 * 发布中心统计数据类型
 */
export type PublishStatistics = {
  /** 总成片数 */
  totalVideos: number;
  /** 已发布数 */
  publishedCount: number;
  /** 待发布数 */
  pendingCount: number;
  /** 本月发布数 */
  thisMonthCount: number;
};

/**
 * 发布中心组件Props
 */
export type PublishCenterProps = {
  /** 发布统计数据 */
  statistics: PublishStatistics;
  /** 最近的成片列表(最新5个) */
  recentVideos: PublishedVideo[];
  /** 发布计划概览 */
  plans: PublishPlanType[];
  /** 查看所有成片回调 */
  onViewAllVideos?: () => void;
  /** 创建发布计划回调 */
  onCreatePlan?: () => void;
  /** 查看发布统计回调 */
  onViewStatistics?: () => void;
  /** 预览视频回调 */
  onPreviewVideo?: (video: PublishedVideo) => void;
  /** 下载视频回调 */
  onDownloadVideo?: (video: PublishedVideo) => void;
  /** 一键打包回调（评审优化 P2）。 */
  onPackageVideo?: (video: PublishedVideo) => void;
};

/**
 * 发布中心主组件
 *
 * 功能：
 * - 显示发布中心标题和简介
 * - 显示统计数据（总成片数、已发布数、待发布数、本月发布数）
 * - 显示最近的成片列表（最新5个）
 * - 显示发布计划概览
 * - 快捷操作按钮
 *
 * @param statistics - 发布统计数据
 * @param recentVideos - 最近的成片列表
 * @param plans - 发布计划列表
 * @param onViewAllVideos - 查看所有成片回调
 * @param onCreatePlan - 创建发布计划回调
 * @param onViewStatistics - 查看发布统计回调
 * @param onPreviewVideo - 预览视频回调
 * @param onDownloadVideo - 下载视频回调
 */
export function PublishCenter({
  statistics,
  recentVideos,
  plans,
  onViewAllVideos,
  onCreatePlan,
  onViewStatistics,
  onPreviewVideo,
  onDownloadVideo,
  onPackageVideo,
}: PublishCenterProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "videos" | "plans">("overview");

  // 分页状态 - 成片列表
  const [videosCurrentPage, setVideosCurrentPage] = useState(1);
  const [videosPageSize, setVideosPageSize] = useState(10);

  // 分页状态 - 发布计划列表
  const [plansCurrentPage, setPlansCurrentPage] = useState(1);
  const [plansPageSize, setPlansPageSize] = useState(10);

  /**
   * 获取平台图标
   */
  const getPlatformIcon = (platform: PublishPlatform) => {
    const platformIcons: Record<PublishPlatform, string> = {
      douyin: "抖音",
      bilibili: "B站",
      weibo: "微博",
      xiaohongshu: "小红书",
      kuaishou: "快手",
      wechat: "微信视频号",
      youtube: "YouTube",
      other: "其他",
    };
    return platformIcons[platform] || platform;
  };

  /**
   * 格式化时长
   */
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  /**
   * 格式化日期
   */
  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return "今天";
    if (days === 1) return "昨天";
    if (days < 7) return `${days}天前`;
    return date.toLocaleDateString("zh-CN");
  };

  /**
   * 分页后的成片列表
   */
  const paginatedVideos = useMemo(() => {
    const start = (videosCurrentPage - 1) * videosPageSize;
    return recentVideos.slice(start, start + videosPageSize);
  }, [recentVideos, videosCurrentPage, videosPageSize]);

  /**
   * 成片总页数
   */
  const videosTotalPages = useMemo(() => {
    return Math.ceil(recentVideos.length / videosPageSize);
  }, [recentVideos.length, videosPageSize]);

  /**
   * 分页后的发布计划列表
   */
  const paginatedPlans = useMemo(() => {
    const start = (plansCurrentPage - 1) * plansPageSize;
    return plans.slice(start, start + plansPageSize);
  }, [plans, plansCurrentPage, plansPageSize]);

  /**
   * 发布计划总页数
   */
  const plansTotalPages = useMemo(() => {
    return Math.ceil(plans.length / plansPageSize);
  }, [plans.length, plansPageSize]);

  return (
    <div className="space-y-6">
      {/* 顶部标题区域 */}
      <div className="rounded-xl border border-white/10 bg-gradient-to-br from-[#1a1a1a] to-[#202020] p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20">
              <Upload className="h-6 w-6 text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">成片与发布计划管理</h2>
              <p className="text-sm text-[#888]">
                管理成片与发布计划，追踪发布进度
              </p>
            </div>
          </div>

          {/* 快捷操作按钮 */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={onViewAllVideos}
              className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#202020] px-4 py-2 text-sm font-medium text-white transition-colors hover:border-white/20 hover:bg-[#252525]"
            >
              <Video className="h-4 w-4" />
              <span>查看所有成片</span>
            </button>
            <button
              onClick={onCreatePlan}
              className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              <Calendar className="h-4 w-4" />
              <span>创建发布计划</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tab 切换 */}
      <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-[#1a1a1a] p-1">
        <button
          onClick={() => setActiveTab("overview")}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-all ${activeTab === "overview"
            ? "bg-white/10 text-white"
            : "text-[#888] hover:text-white"
            }`}
        >
          概览
        </button>
        <button
          onClick={() => setActiveTab("videos")}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-all ${activeTab === "videos"
            ? "bg-white/10 text-white"
            : "text-[#888] hover:text-white"
            }`}
        >
          最新成片
        </button>
        <button
          onClick={() => setActiveTab("plans")}
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-all ${activeTab === "plans"
            ? "bg-white/10 text-white"
            : "text-[#888] hover:text-white"
            }`}
        >
          发布计划
        </button>
      </div>

      {/* 内容区域 */}
      <div className="rounded-xl border border-white/10 bg-[#181818] p-6">
        {/* 概览 Tab */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* 最新成片预览 */}
            <div>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">最新成片</h3>
                <button
                  onClick={() => setActiveTab("videos")}
                  className="flex items-center gap-1 text-sm text-blue-400 transition-colors hover:text-blue-300"
                >
                  查看全部
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              <div className="grid gap-3">
                {recentVideos.slice(0, 3).map((video) => (
                  <div
                    key={video.id}
                    className="flex items-center justify-between rounded-lg border border-white/5 bg-[#202020] p-4 transition-colors hover:border-white/10"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                        <PlayCircle className="h-5 w-5 text-blue-400" />
                      </div>
                      <div>
                        <p className="font-medium text-white">{video.name}</p>
                        <p className="text-xs text-[#888]">
                          {video.projectName} · {formatDuration(video.duration)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${video.publishStatus === "published"
                          ? "bg-emerald-500/10 text-emerald-400"
                          : "bg-orange-500/10 text-orange-400"
                          }`}
                      >
                        {video.publishStatus === "published" ? "已发布" : "待发布"}
                      </span>
                    </div>
                  </div>
                ))}
                {recentVideos.length === 0 && (
                  <div className="py-8 text-center text-[#666]">暂无成片</div>
                )}
              </div>
            </div>

            {/* 发布计划预览 */}
            <div>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">发布计划</h3>
                <button
                  onClick={() => setActiveTab("plans")}
                  className="flex items-center gap-1 text-sm text-blue-400 transition-colors hover:text-blue-300"
                >
                  查看全部
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              <div className="grid gap-3">
                {plans.slice(0, 2).map((plan) => (
                  <div
                    key={plan.id}
                    className="rounded-lg border border-white/5 bg-[#202020] p-4 transition-colors hover:border-white/10"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-white">{plan.name}</p>
                        <p className="mt-1 text-xs text-[#888]">
                          {plan.date} · {plan.videos.length} 个成片
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${plan.status === "completed"
                          ? "bg-emerald-500/10 text-emerald-400"
                          : plan.status === "executing"
                            ? "bg-blue-500/10 text-blue-400"
                            : plan.status === "cancelled"
                              ? "bg-red-500/10 text-red-400"
                              : "bg-orange-500/10 text-orange-400"
                          }`}
                      >
                        {plan.status === "completed"
                          ? "已完成"
                          : plan.status === "executing"
                            ? "执行中"
                            : plan.status === "cancelled"
                              ? "已取消"
                              : "计划中"}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {plan.platforms.map((platform) => (
                        <span
                          key={platform}
                          className="rounded-md bg-white/5 px-2 py-1 text-xs text-[#888]"
                        >
                          {getPlatformIcon(platform)}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
                {plans.length === 0 && (
                  <div className="py-8 text-center text-[#666]">暂无发布计划</div>
                )}
              </div>
            </div>

            {/* 快捷统计 */}
            <div className="rounded-lg border border-white/5 bg-[#202020] p-4">
              <div className="mb-3 flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-[#888]" />
                <span className="text-sm font-medium text-white">发布统计</span>
              </div>
              <button
                onClick={onViewStatistics}
                className="w-full rounded-lg border border-white/10 bg-[#1a1a1a] px-4 py-3 text-sm text-[#888] transition-colors hover:border-white/20 hover:text-white"
              >
                查看详细发布统计和数据分析
              </button>
            </div>
          </div>
        )}

        {/* 最新成片 Tab */}
        {activeTab === "videos" && (
          <div>
            {paginatedVideos.length > 0 ? (
              <div className="rounded-md border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>成片名称</TableHead>
                      <TableHead className="hidden md:table-cell">所属项目</TableHead>
                      <TableHead className="hidden sm:table-cell">时长</TableHead>
                      <TableHead>发布状态</TableHead>
                      <TableHead className="hidden lg:table-cell">发布平台</TableHead>
                      <TableHead className="hidden md:table-cell">创建时间</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedVideos.map((video) => (
                      <TableRow key={video.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded bg-blue-500/10">
                              <PlayCircle className="h-4 w-4 text-blue-400" />
                            </div>
                            <span className="font-medium text-foreground">{video.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground hidden md:table-cell">{video.projectName}</TableCell>
                        <TableCell className="text-muted-foreground hidden sm:table-cell">{formatDuration(video.duration)}</TableCell>
                        <TableCell>
                          <Badge variant={video.publishStatus === "published" ? "success" : "warning"}>
                            {video.publishStatus === "published" ? "已发布" : "待发布"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground hidden lg:table-cell">
                          {video.publishedPlatform ? getPlatformIcon(video.publishedPlatform) : "-"}
                        </TableCell>
                        <TableCell className="text-muted-foreground hidden md:table-cell">{formatDate(video.createdAt)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center gap-1 justify-end">
                            <Button variant="ghost" size="sm" onClick={() => onPreviewVideo?.(video)}>
                              预览
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => onDownloadVideo?.(video)}>
                              下载
                            </Button>
                            {onPackageVideo && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onPackageVideo(video)}
                                className="text-amber-400 hover:text-amber-300"
                                title="一键打包（生成发布 manifest）"
                              >
                                <Package className="h-3 w-3" />
                                打包
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="py-12 text-center">
                <Video className="mx-auto h-12 w-12 text-[#666]" />
                <p className="mt-4 text-[#888]">暂无成片</p>
                <p className="mt-1 text-sm text-[#666]">完成的视频将在这里显示</p>
              </div>
            )}

            {/* 分页组件 */}
            {recentVideos.length > 0 && (
              <div className="mt-4">
                <Pagination
                  currentPage={videosCurrentPage}
                  totalPages={videosTotalPages}
                  totalItems={recentVideos.length}
                  pageSize={videosPageSize}
                  onPageChange={setVideosCurrentPage}
                  onPageSizeChange={setVideosPageSize}
                />
              </div>
            )}
          </div>
        )}

        {/* 发布计划 Tab */}
        {activeTab === "plans" && (
          <div>
            {paginatedPlans.length > 0 ? (
              <div className="rounded-md border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>计划名称</TableHead>
                      <TableHead className="hidden md:table-cell">计划日期</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead className="hidden lg:table-cell">发布平台</TableHead>
                      <TableHead className="hidden sm:table-cell">成片数</TableHead>
                      <TableHead className="hidden md:table-cell">负责人</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedPlans.map((plan) => {
                      const statusBadge =
                        plan.status === "completed" ? (
                          <Badge variant="success">已完成</Badge>
                        ) : plan.status === "executing" ? (
                          <Badge variant="info">执行中</Badge>
                        ) : plan.status === "cancelled" ? (
                          <Badge variant="destructive">已取消</Badge>
                        ) : (
                          <Badge variant="warning">计划中</Badge>
                        );
                      return (
                        <TableRow key={plan.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="flex h-8 w-8 items-center justify-center rounded bg-purple-500/10">
                                <Calendar className="h-4 w-4 text-purple-400" />
                              </div>
                              <span className="font-medium text-foreground">{plan.name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground hidden md:table-cell">{plan.date}</TableCell>
                          <TableCell>{statusBadge}</TableCell>
                          <TableCell className="hidden lg:table-cell">
                            <div className="flex flex-wrap gap-1">
                              {plan.platforms.slice(0, 2).map((platform) => (
                                <Badge key={platform} variant="outline">
                                  {getPlatformIcon(platform)}
                                </Badge>
                              ))}
                              {plan.platforms.length > 2 && (
                                <Badge variant="muted">+{plan.platforms.length - 2}</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground hidden sm:table-cell">{plan.videos.length} 个</TableCell>
                          <TableCell className="text-muted-foreground hidden md:table-cell">{plan.owner}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm">
                              查看
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="py-12 text-center">
                <Calendar className="mx-auto h-12 w-12 text-[#666]" />
                <p className="mt-4 text-[#888]">暂无发布计划</p>
                <button
                  onClick={onCreatePlan}
                  className="mt-4 rounded-lg bg-gradient-to-r from-blue-500 to-purple-500 px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
                >
                  创建发布计划
                </button>
              </div>
            )}

            {/* 分页组件 */}
            {plans.length > 0 && (
              <div className="mt-4">
                <Pagination
                  currentPage={plansCurrentPage}
                  totalPages={plansTotalPages}
                  totalItems={plans.length}
                  pageSize={plansPageSize}
                  onPageChange={setPlansCurrentPage}
                  onPageSizeChange={setPlansPageSize}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}