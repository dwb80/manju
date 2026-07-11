"use client";

import { useState } from "react";
import {
  Video,
  Play,
  Download,
  Upload,
  Filter,
  Search,
  Calendar,
  Clock,
  MoreVertical,
  Eye,
  CheckCircle,
} from "lucide-react";

/**
 * 发布平台枚举
 */
export type PublishPlatform =
  | "douyin"
  | "bilibili"
  | "weibo"
  | "xiaohongshu"
  | "kuaishou"
  | "wechat"
  | "youtube"
  | "other";

/**
 * 发布状态枚举
 */
export type PublishStatus = "pending" | "published";

/**
 * 成片数据类型
 */
export type PublishedVideo = {
  /** 成片ID */
  id: string;
  /** 成片名称 */
  name: string;
  /** 所属项目ID */
  projectId: string;
  /** 所属项目名称 */
  projectName: string;
  /** 视频时长(秒) */
  duration: number;
  /** 创建时间 */
  createdAt: string;
  /** 发布状态 */
  publishStatus: PublishStatus;
  /** 发布平台(如已发布) */
  publishedPlatform?: PublishPlatform;
  /** 发布时间(如已发布) */
  publishedAt?: string;
  /** 视频URL */
  videoUrl: string;
  /** 缩略图URL */
  thumbnailUrl?: string;
};

/**
 * 筛选条件类型
 */
export type VideoFilter = {
  /** 项目筛选 */
  projectId?: string;
  /** 发布状态筛选 */
  publishStatus?: PublishStatus | "all";
  /** 搜索关键词 */
  searchKeyword?: string;
};

/**
 * 成片管理组件Props
 */
export type PublishedVideosListProps = {
  /** 成片列表 */
  videos: PublishedVideo[];
  /** 项目列表(用于筛选) */
  projects: Array<{ id: string; name: string }>;
  /** 预览视频回调 */
  onPreviewVideo?: (video: PublishedVideo) => void;
  /** 下载视频回调 */
  onDownloadVideo?: (video: PublishedVideo) => void;
  /** 标记为已发布回调 */
  onMarkAsPublished?: (video: PublishedVideo, platform: PublishPlatform) => void;
  /** 设置发布平台回调 */
  onSetPublishPlatform?: (video: PublishedVideo, platform: PublishPlatform) => void;
};

/**
 * 发布计划数据类型
 */
export type PublishPlan = {
  /** 计划ID */
  id: string;
  /** 计划名称 */
  name: string;
  /** 计划状态 */
  status: "planned" | "executing" | "completed" | "cancelled";
  /** 计划日期 */
  date: string;
  /** 包含的成片列表 */
  videos: PublishedVideo[];
  /** 发布平台 */
  platforms: PublishPlatform[];
  /** 负责人 */
  owner: string;
  /** 创建时间 */
  createdAt: string;
  /** 更新时间 */
  updatedAt: string;
};

/**
 * 成片管理组件
 *
 * 功能：
 * - 显示成片列表(表格或卡片)
 * - 每个成片显示：名称、所属项目、视频时长、创建时间、发布状态、发布平台、发布时间
 * - 支持筛选：按项目筛选、按发布状态筛选
 * - 支持操作：预览视频、下载视频、标记为已发布、设置发布平台
 *
 * @param videos - 成片列表
 * @param projects - 项目列表
 * @param onPreviewVideo - 预览视频回调
 * @param onDownloadVideo - 下载视频回调
 * @param onMarkAsPublished - 标记为已发布回调
 * @param onSetPublishPlatform - 设置发布平台回调
 */
export function PublishedVideosList({
  videos,
  projects,
  onPreviewVideo,
  onDownloadVideo,
  onMarkAsPublished,
  onSetPublishPlatform,
}: PublishedVideosListProps) {
  const [filter, setFilter] = useState<VideoFilter>({
    projectId: undefined,
    publishStatus: "all",
    searchKeyword: "",
  });
  const [viewMode, setViewMode] = useState<"table" | "card">("table");
  const [showPlatformSelector, setShowPlatformSelector] = useState<string | null>(null);

  /**
   * 获取平台中文名
   */
  const getPlatformName = (platform: PublishPlatform): string => {
    const platformNames: Record<PublishPlatform, string> = {
      douyin: "抖音",
      bilibili: "B站",
      weibo: "微博",
      xiaohongshu: "小红书",
      kuaishou: "快手",
      wechat: "微信视频号",
      youtube: "YouTube",
      other: "其他",
    };
    return platformNames[platform] || platform;
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
    return date.toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  };

  /**
   * 筛选视频
   */
  const filteredVideos = videos.filter((video) => {
    // 项目筛选
    if (filter.projectId && video.projectId !== filter.projectId) {
      return false;
    }
    // 发布状态筛选
    if (filter.publishStatus && filter.publishStatus !== "all") {
      if (video.publishStatus !== filter.publishStatus) {
        return false;
      }
    }
    // 关键词搜索
    if (filter.searchKeyword) {
      const keyword = filter.searchKeyword.toLowerCase();
      if (
        !video.name.toLowerCase().includes(keyword) &&
        !video.projectName.toLowerCase().includes(keyword)
      ) {
        return false;
      }
    }
    return true;
  });

  /**
   * 处理平台选择
   */
  const handlePlatformSelect = (video: PublishedVideo, platform: PublishPlatform) => {
    if (video.publishStatus === "pending") {
      onMarkAsPublished?.(video, platform);
    } else {
      onSetPublishPlatform?.(video, platform);
    }
    setShowPlatformSelector(null);
  };

  /**
   * 平台选项列表
   */
  const platformOptions: PublishPlatform[] = [
    "douyin",
    "bilibili",
    "weibo",
    "xiaohongshu",
    "kuaishou",
    "wechat",
    "youtube",
    "other",
  ];

  return (
    <div className="space-y-4">
      {/* 顶部工具栏 */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* 搜索框 */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#888]" />
          <input
            type="text"
            placeholder="搜索成片名称或项目..."
            value={filter.searchKeyword || ""}
            onChange={(e) =>
              setFilter((prev) => ({ ...prev, searchKeyword: e.target.value }))
            }
            className="w-full rounded-lg border border-white/10 bg-[#1a1a1a] py-2 pl-10 pr-4 text-sm text-white placeholder-[#666] focus:border-white/20 focus:outline-none"
          />
        </div>

        {/* 筛选和视图控制 */}
        <div className="flex items-center gap-2">
          {/* 项目筛选 */}
          <select
            value={filter.projectId || ""}
            onChange={(e) =>
              setFilter((prev) => ({
                ...prev,
                projectId: e.target.value || undefined,
              }))
            }
            className="rounded-lg border border-white/10 bg-[#1a1a1a] px-3 py-2 text-sm text-white focus:border-white/20 focus:outline-none"
          >
            <option value="">所有项目</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>

          {/* 发布状态筛选 */}
          <select
            value={filter.publishStatus || "all"}
            onChange={(e) =>
              setFilter((prev) => ({
                ...prev,
                publishStatus: e.target.value as PublishStatus | "all",
              }))
            }
            className="rounded-lg border border-white/10 bg-[#1a1a1a] px-3 py-2 text-sm text-white focus:border-white/20 focus:outline-none"
          >
            <option value="all">全部状态</option>
            <option value="pending">待发布</option>
            <option value="published">已发布</option>
          </select>

          {/* 视图切换 */}
          <div className="flex rounded-lg border border-white/10 bg-[#1a1a1a] p-1">
            <button
              onClick={() => setViewMode("table")}
              className={`rounded px-3 py-1 text-sm ${
                viewMode === "table"
                  ? "bg-white/10 text-white"
                  : "text-[#888] hover:text-white"
              }`}
            >
              表格
            </button>
            <button
              onClick={() => setViewMode("card")}
              className={`rounded px-3 py-1 text-sm ${
                viewMode === "card"
                  ? "bg-white/10 text-white"
                  : "text-[#888] hover:text-white"
              }`}
            >
              卡片
            </button>
          </div>
        </div>
      </div>

      {/* 统计信息 */}
      <div className="flex items-center gap-4 text-sm text-[#888]">
        <span>
          共 <span className="font-medium text-white">{filteredVideos.length}</span> 个成片
        </span>
        <span>|</span>
        <span>
          已发布 <span className="font-medium text-emerald-400">{videos.filter(v => v.publishStatus === "published").length}</span> 个
        </span>
        <span>
          待发布 <span className="font-medium text-orange-400">{videos.filter(v => v.publishStatus === "pending").length}</span> 个
        </span>
      </div>

      {/* 表格视图 */}
      {viewMode === "table" && (
        <div className="overflow-x-auto rounded-xl border border-white/10 bg-[#1a1a1a]">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-white/10 bg-[#202020]">
              <tr>
                <th className="px-4 py-3 font-medium text-[#888]">成片名称</th>
                <th className="px-4 py-3 font-medium text-[#888]">所属项目</th>
                <th className="px-4 py-3 font-medium text-[#888]">时长</th>
                <th className="px-4 py-3 font-medium text-[#888]">创建时间</th>
                <th className="px-4 py-3 font-medium text-[#888]">发布状态</th>
                <th className="px-4 py-3 font-medium text-[#888]">发布平台</th>
                <th className="px-4 py-3 font-medium text-[#888]">发布时间</th>
                <th className="px-4 py-3 font-medium text-[#888]">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredVideos.map((video) => (
                <tr
                  key={video.id}
                  className="transition-colors hover:bg-white/5"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded bg-blue-500/10">
                        <Video className="h-4 w-4 text-blue-400" />
                      </div>
                      <span className="font-medium text-white">{video.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[#888]">{video.projectName}</td>
                  <td className="px-4 py-3 text-[#888]">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {formatDuration(video.duration)}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[#888]">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {formatDate(video.createdAt)}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
                        video.publishStatus === "published"
                          ? "bg-emerald-500/10 text-emerald-400"
                          : "bg-orange-500/10 text-orange-400"
                      }`}
                    >
                      {video.publishStatus === "published" ? (
                        <>
                          <CheckCircle className="h-3 w-3" />
                          已发布
                        </>
                      ) : (
                        <>
                          <Clock className="h-3 w-3" />
                          待发布
                        </>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {video.publishedPlatform ? (
                      <span className="rounded-md bg-white/5 px-2 py-1 text-xs text-[#888]">
                        {getPlatformName(video.publishedPlatform)}
                      </span>
                    ) : (
                      <span className="text-[#666]">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-[#888]">
                    {video.publishedAt ? formatDate(video.publishedAt) : "-"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onPreviewVideo?.(video)}
                        className="rounded border border-white/10 bg-[#202020] px-2.5 py-1 text-xs text-white transition-colors hover:border-white/20"
                        title="预览"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => onDownloadVideo?.(video)}
                        className="rounded border border-white/10 bg-[#202020] px-2.5 py-1 text-xs text-white transition-colors hover:border-white/20"
                        title="下载"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </button>
                      <div className="relative">
                        <button
                          onClick={() =>
                            setShowPlatformSelector(
                              showPlatformSelector === video.id ? null : video.id
                            )
                          }
                          className="rounded bg-blue-500/10 px-2.5 py-1 text-xs text-blue-400 transition-colors hover:bg-blue-500/20"
                          title="标记发布"
                        >
                          <Upload className="h-3.5 w-3.5" />
                        </button>
                        {showPlatformSelector === video.id && (
                          <div className="absolute right-0 top-full z-10 mt-1 w-40 rounded-lg border border-white/10 bg-[#1a1a1a] p-2 shadow-lg">
                            {platformOptions.map((platform) => (
                              <button
                                key={platform}
                                onClick={() => handlePlatformSelect(video, platform)}
                                className="w-full rounded px-3 py-2 text-left text-sm text-white transition-colors hover:bg-white/5"
                              >
                                {getPlatformName(platform)}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredVideos.length === 0 && (
            <div className="py-12 text-center">
              <Video className="mx-auto h-12 w-12 text-[#666]" />
              <p className="mt-4 text-[#888]">暂无成片</p>
              <p className="mt-1 text-sm text-[#666]">完成的视频将在这里显示</p>
            </div>
          )}
        </div>
      )}

      {/* 卡片视图 */}
      {viewMode === "card" && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredVideos.map((video) => (
            <div
              key={video.id}
              className="group rounded-xl border border-white/10 bg-[#1a1a1a] overflow-hidden transition-colors hover:border-white/20"
            >
              {/* 缩略图区域 */}
              <div className="relative aspect-video bg-[#202020]">
                {video.thumbnailUrl ? (
                  <img
                    src={video.thumbnailUrl}
                    alt={video.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <Video className="h-12 w-12 text-[#666]" />
                  </div>
                )}
                {/* 播放按钮 */}
                <button
                  onClick={() => onPreviewVideo?.(video)}
                  className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
                    <Play className="h-7 w-7 text-white" />
                  </div>
                </button>
                {/* 时长标签 */}
                <div className="absolute bottom-2 right-2 rounded bg-black/60 px-2 py-1 text-xs text-white backdrop-blur-sm">
                  {formatDuration(video.duration)}
                </div>
                {/* 状态标签 */}
                <div className="absolute top-2 left-2">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium backdrop-blur-sm ${
                      video.publishStatus === "published"
                        ? "bg-emerald-500/80 text-white"
                        : "bg-orange-500/80 text-white"
                    }`}
                  >
                    {video.publishStatus === "published" ? "已发布" : "待发布"}
                  </span>
                </div>
              </div>

              {/* 信息区域 */}
              <div className="p-4">
                <h4 className="font-medium text-white line-clamp-1">{video.name}</h4>
                <p className="mt-1 text-sm text-[#888] line-clamp-1">{video.projectName}</p>

                <div className="mt-3 flex items-center justify-between text-xs text-[#666]">
                  <span>{formatDate(video.createdAt)}</span>
                  {video.publishedPlatform && (
                    <span className="rounded bg-white/5 px-2 py-0.5 text-[#888]">
                      {getPlatformName(video.publishedPlatform)}
                    </span>
                  )}
                </div>

                {/* 操作按钮 */}
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => onPreviewVideo?.(video)}
                    className="flex-1 rounded border border-white/10 bg-[#202020] px-3 py-1.5 text-xs text-white transition-colors hover:border-white/20"
                  >
                    预览
                  </button>
                  <button
                    onClick={() => onDownloadVideo?.(video)}
                    className="flex-1 rounded border border-white/10 bg-[#202020] px-3 py-1.5 text-xs text-white transition-colors hover:border-white/20"
                  >
                    下载
                  </button>
                  <div className="relative">
                    <button
                      onClick={() =>
                        setShowPlatformSelector(
                          showPlatformSelector === video.id ? null : video.id
                        )
                      }
                      className="rounded bg-blue-500/10 px-3 py-1.5 text-xs text-blue-400 transition-colors hover:bg-blue-500/20"
                    >
                      发布
                    </button>
                    {showPlatformSelector === video.id && (
                      <div className="absolute bottom-full right-0 z-10 mb-1 w-40 rounded-lg border border-white/10 bg-[#1a1a1a] p-2 shadow-lg">
                        {platformOptions.map((platform) => (
                          <button
                            key={platform}
                            onClick={() => handlePlatformSelect(video, platform)}
                            className="w-full rounded px-3 py-2 text-left text-sm text-white transition-colors hover:bg-white/5"
                          >
                            {getPlatformName(platform)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
          {filteredVideos.length === 0 && (
            <div className="col-span-full py-12 text-center">
              <Video className="mx-auto h-12 w-12 text-[#666]" />
              <p className="mt-4 text-[#888]">暂无成片</p>
              <p className="mt-1 text-sm text-[#666]">完成的视频将在这里显示</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}