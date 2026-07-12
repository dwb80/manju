"use client";

/**
 * 发布中心独立页面
 *
 * 功能：
 * - 管理成片与发布计划
 * - 追踪发布进度和统计数据
 * - 支持查看成片详情和发布计划详情
 * - 提供预览、下载等快捷操作
 *
 * 页面布局：
 * - 顶部：StandalonePageHeader + StatsOverview
 * - 主体：PublishCenter 组件
 * - 底部：数据来源 + 最后更新时间
 *
 * 数据来源：
 * - 通过真实API接口获取数据
 *
 * @module publish/page
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Rocket, Video, Calendar, CheckCircle2, Clock } from "lucide-react";
import { PublishCenter, PublishStatistics } from "@/components/publish/publish-center";
import type {
  PublishedVideo,
  PublishPlan,
} from "@/components/publish/published-videos-list";
import {
  StandalonePageHeader,
  StatsOverview,
  Alert,
} from "@/components/layout";
import { notify } from "@/lib/notify";
import { createLogger } from "@/lib/logger";

const log = createLogger('publish-page')

/**
 * API响应格式
 */
interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

/**
 * 成片响应格式（来自后端）
 */
interface PublishedVideoResponse {
  id: string;
  name: string;
  projectId: string;
  duration: number;
  createdAt: string;
  publishStatus: "unpublished" | "scheduled" | "published";
  publishPlatforms: string[];
  videoUrl: string;
  prompt: string;
}

/**
 * 发布计划响应格式（来自后端）
 */
interface PublishPlanResponse {
  id: string;
  name: string;
  status: "draft" | "scheduled" | "publishing" | "published" | "failed" | "cancelled";
  plannedDate: string;
  publishedDate: string;
  videos: string[];
  platforms: string[];
  assignee: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

/**
 * 发布中心页面组件
 */
export default function PublishCenterPage() {
  // 路由
  const router = useRouter();

  // 加载状态
  const [loading, setLoading] = useState(false);
  // 最后更新时间
  const [lastUpdate, setLastUpdate] = useState<string>("");
  // 加载错误
  const [loadError, setLoadError] = useState<string>("");

  // 发布统计数据
  const [statistics, setStatistics] = useState<PublishStatistics>({
    totalVideos: 0,
    publishedCount: 0,
    pendingCount: 0,
    thisMonthCount: 0,
  });

  // 成片列表数据
  const [recentVideos, setRecentVideos] = useState<PublishedVideo[]>([]);

  // 发布计划数据
  const [plans, setPlans] = useState<PublishPlan[]>([]);

  /**
   * 加载发布中心数据
   */
  async function loadData() {
    setLoading(true);
    setLoadError("")
    log.debug('load data')

    try {
      const [videosResponse, plansResponse] = await Promise.all([
        fetch("/api/publish/videos"),
        fetch("/api/publish/plans"),
      ]);

      const videosResult: ApiResponse<PublishedVideoResponse[]> = await videosResponse.json();
      const plansResult: ApiResponse<PublishPlanResponse[]> = await plansResponse.json();

      // 处理成片
      if (videosResult.code === 0 && videosResult.data) {
        const videos = videosResult.data;
        const convertedVideos: PublishedVideo[] = videos.map(video => ({
          id: video.id,
          name: video.name,
          projectId: video.projectId,
          projectName: "",
          duration: video.duration,
          createdAt: video.createdAt,
          publishStatus: video.publishStatus === "scheduled" ? "pending" : video.publishStatus as "pending" | "published",
          publishedPlatform: video.publishPlatforms[0] as any || "other",
          publishedAt: "",
          videoUrl: video.videoUrl,
          thumbnailUrl: "",
        }));
        setRecentVideos(convertedVideos);

        const now = new Date();
        const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const thisMonthVideos = videos.filter(v => new Date(v.createdAt) >= thisMonthStart);

        setStatistics({
          totalVideos: videos.length,
          publishedCount: videos.filter(v => v.publishStatus === "published").length,
          pendingCount: videos.filter(v => v.publishStatus === "unpublished" || v.publishStatus === "scheduled").length,
          thisMonthCount: thisMonthVideos.length,
        });
        log.info('videos loaded', { total: videos.length })
      } else {
        log.warn('videos load failed', { message: videosResult.message })
      }

      // 处理计划
      if (plansResult.code === 0 && plansResult.data) {
        const plansData = plansResult.data;
        const convertedPlans: PublishPlan[] = plansData.map(plan => ({
          id: plan.id,
          name: plan.name,
          status: plan.status as "planned" | "executing" | "completed" | "cancelled",
          date: plan.plannedDate || plan.created_at,
          videos: recentVideos.filter(v => plan.videos.includes(v.id)),
          platforms: plan.platforms as any[],
          owner: plan.assignee,
          createdAt: plan.created_at,
          updatedAt: plan.updated_at,
        }));
        setPlans(convertedPlans);
        log.info('plans loaded', { total: plansData.length })
      } else {
        log.warn('plans load failed', { message: plansResult.message })
      }

      if (videosResult.code !== 0 || plansResult.code !== 0) {
        setLoadError("部分数据加载失败")
      }
    } catch (err) {
      log.error('API call failed', { error: (err as Error).message })
      setLoadError(`API 调用失败：${(err as Error).message}`)
      setRecentVideos([]);
      setPlans([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    setLastUpdate(new Date().toLocaleString("zh-CN"));
  }, []);

  function handleViewAllVideos() {
    log.debug('view all videos')
    router.push("/videos");
  }

  async function handleCreatePlan() {
    log.debug('create plan')
    notify.info("创建发布计划功能即将上线")
  }

  function handleViewStatistics() {
    log.debug('view statistics')
    router.push("/data");
  }

  function handlePreviewVideo(video: PublishedVideo) {
    log.debug('preview video', { id: video.id, name: video.name })
    router.push(`/videos/${video.id}`);
  }

  function handleDownloadVideo(video: PublishedVideo) {
    log.info('download video', { id: video.id, name: video.name })
    if (video.videoUrl) {
      const link = document.createElement('a');
      link.href = video.videoUrl;
      link.download = `${video.name}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      notify.success(`已开始下载：${video.name}`)
    } else {
      notify.warn("该成片无可用下载地址")
    }
  }

  /**
   * 一键打包（评审优化 P2）
   *
   * 把成片 + 元数据打成 publish package manifest，
   * 生成可下载的 JSON 文件，并提示用户进入发布计划页面继续操作。
   */
  async function handlePackageVideo(video: PublishedVideo) {
    log.info('package video', { id: video.id, name: video.name })
    try {
      const manifest = {
        package_version: '1.0',
        generated_at: new Date().toISOString(),
        source: {
          video_id: video.id,
          name: video.name,
          project_id: video.projectId,
          project_name: video.projectName,
          duration: video.duration,
          video_url: video.videoUrl,
          thumbnail_url: video.thumbnailUrl,
          created_at: video.createdAt,
        },
        publishing: {
          status: video.publishStatus,
          platform: video.publishedPlatform ?? null,
          published_at: video.publishedAt ?? null,
          recommended_platforms: ['douyin', 'bilibili', 'xiaohongshu'],
          suggested_tags: [`#${video.projectName}`, '#AI漫剧'],
        },
        next_steps: [
          '使用本 manifest 创建发布计划',
          '上传至目标平台',
          '回填发布链接 / 发布时间',
        ],
      }

      const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `publish-package-${video.id}.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      notify.success('已生成发布包', `${video.name} 打包完成，已下载 manifest`)
    } catch (err) {
      log.error('package video failed', { error: (err as Error).message })
      notify.error('打包失败', (err as Error).message)
    }
  }

  function handleRefresh() {
    loadData();
  }

  return (
    <main className="min-h-screen bg-[#181818] text-[#ececec]">
      {/* === 统一页面头 === */}
      <StandalonePageHeader
        title="发布中心"
        description="管理成片与发布计划，追踪发布进度。支持多平台发布管理和成片预览下载。"
        breadcrumbs={["首页", "发布中心"]}
        extraRight={
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Rocket className="h-4 w-4" />
              <span>共 {statistics.totalVideos} 个成片</span>
            </div>
            <button
              onClick={handleRefresh}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-[#888] transition-colors hover:bg-white/10 hover:text-white"
              aria-label="刷新数据"
              disabled={loading}
            >
              {loading ? "加载中..." : "刷新"}
            </button>
          </div>
        }
      />

      <div className="px-6 py-4 space-y-4">
        {/* === 错误提示 === */}
        {loadError && <Alert tone="error">{loadError}</Alert>}

        {/* === 统一统计卡组 === */}
        <StatsOverview
          columns={4}
          cards={[
            {
              tone: "blue",
              icon: <Video className="h-4 w-4" />,
              title: "总成片",
              value: statistics.totalVideos,
              sub: "全部成片",
            },
            {
              tone: "emerald",
              icon: <CheckCircle2 className="h-4 w-4" />,
              title: "已发布",
              value: statistics.publishedCount,
              sub: "成功发布",
            },
            {
              tone: "amber",
              icon: <Clock className="h-4 w-4" />,
              title: "待发布",
              value: statistics.pendingCount,
              sub: "排期中",
            },
            {
              tone: "purple",
              icon: <Calendar className="h-4 w-4" />,
              title: "本月新增",
              value: statistics.thisMonthCount,
              sub: "本月创建",
            },
          ]}
        />
      </div>

      <section className="px-6 py-6">
        <PublishCenter
          statistics={statistics}
          recentVideos={recentVideos}
          plans={plans}
          onViewAllVideos={handleViewAllVideos}
          onCreatePlan={handleCreatePlan}
          onViewStatistics={handleViewStatistics}
          onPreviewVideo={handlePreviewVideo}
          onDownloadVideo={handleDownloadVideo}
          onPackageVideo={handlePackageVideo}
        />
      </section>

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