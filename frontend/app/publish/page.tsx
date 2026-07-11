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
 * - 顶部：页面标题 + 返回首页按钮 + 面包屑导航
 * - 主体：PublishCenter组件
 *
 * 数据来源：
 * - 通过真实API接口获取数据
 *
 * @module publish/page
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, LayoutDashboard, Upload } from "lucide-react";
import { PublishCenter, PublishStatistics } from "@/components/publish/publish-center";
import type {
  PublishedVideo,
  PublishPlan,
} from "@/components/publish/published-videos-list";

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
  // 路由导航
  const router = useRouter();

  // 加载状态
  const [loading, setLoading] = useState(false);

  // 最后更新时间（避免hydration错误）
  const [lastUpdate, setLastUpdate] = useState<string>("");

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
   * 通过真实API获取数据
   */
  async function loadData() {
    setLoading(true);

    try {
      // 并行调用2个API接口
      const [videosResponse, plansResponse] = await Promise.all([
        fetch("/api/publish/videos"),
        fetch("/api/publish/plans"),
      ]);

      // 解析响应
      const videosResult: ApiResponse<PublishedVideoResponse[]> = await videosResponse.json();
      const plansResult: ApiResponse<PublishPlanResponse[]> = await plansResponse.json();

      // 处理成片列表数据
      if (videosResult.code === 0 && videosResult.data) {
        const videos = videosResult.data;

        // 转换为前端PublishedVideo格式
        const convertedVideos: PublishedVideo[] = videos.map(video => ({
          id: video.id,
          name: video.name,
          projectId: video.projectId,
          projectName: "", // API未返回项目名称，需要单独查询
          duration: video.duration,
          createdAt: video.createdAt,
          publishStatus: video.publishStatus === "scheduled" ? "pending" : video.publishStatus as "pending" | "published", // 映射状态
          publishedPlatform: video.publishPlatforms[0] as any || "other", // 取第一个平台
          publishedAt: "", // API未返回发布时间
          videoUrl: video.videoUrl,
          thumbnailUrl: "", // API未返回缩略图URL
        }));

        setRecentVideos(convertedVideos);

        // 计算统计数据
        const now = new Date();
        const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const thisMonthVideos = videos.filter(v => new Date(v.createdAt) >= thisMonthStart);

        setStatistics({
          totalVideos: videos.length,
          publishedCount: videos.filter(v => v.publishStatus === "published").length,
          pendingCount: videos.filter(v => v.publishStatus === "unpublished" || v.publishStatus === "scheduled").length,
          thisMonthCount: thisMonthVideos.length,
        });
      } else {
        console.error("获取成片列表失败:", videosResult.message);
        setRecentVideos([]);
      }

      // 处理发布计划数据
      if (plansResult.code === 0 && plansResult.data) {
        const plansData = plansResult.data;

        // 转换为前端PublishPlan格式
        const convertedPlans: PublishPlan[] = plansData.map(plan => ({
          id: plan.id,
          name: plan.name,
          status: plan.status as "planned" | "executing" | "completed" | "cancelled",
          date: plan.plannedDate || plan.created_at,
          videos: recentVideos.filter(v => plan.videos.includes(v.id)), // 关联视频列表
          platforms: plan.platforms as any[], // 平台列表
          owner: plan.assignee,
          createdAt: plan.created_at,
          updatedAt: plan.updated_at,
        }));

        setPlans(convertedPlans);
      } else {
        console.error("获取发布计划列表失败:", plansResult.message);
        setPlans([]);
      }
    } catch (error) {
      console.error("API调用失败:", error);
      setRecentVideos([]);
      setPlans([]);
    } finally {
      setLoading(false);
    }
  }

  /**
   * 页面加载时获取数据和设置时间
   */
  useEffect(() => {
    loadData();
    setLastUpdate(new Date().toLocaleString("zh-CN"));
  }, []);

  /**
   * 查看所有成片
   */
  function handleViewAllVideos() {
    // TODO: 跳转到成片列表页面或打开成片详情弹窗
    console.log("查看所有成片");
    router.push("/videos");
  }

  /**
   * 创建发布计划
   */
  async function handleCreatePlan() {
    // TODO: 打开创建发布计划弹窗
    console.log("创建发布计划");
  }

  /**
   * 查看发布统计
   */
  function handleViewStatistics() {
    // TODO: 跳转到发布统计页面或打开统计详情弹窗
    console.log("查看发布统计");
    router.push("/data");
  }

  /**
   * 预览视频
   */
  function handlePreviewVideo(video: PublishedVideo) {
    // TODO: 打开视频预览弹窗或播放器
    console.log("预览视频:", video.name);
    router.push(`/videos/${video.id}`);
  }

  /**
   * 下载视频
   */
  function handleDownloadVideo(video: PublishedVideo) {
    // TODO: 实现视频下载功能
    console.log("下载视频:", video.name);
    // 模拟下载链接
    if (video.videoUrl) {
      const link = document.createElement('a');
      link.href = video.videoUrl;
      link.download = `${video.name}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }

  /**
   * 返回首页
   */
  function goBackToHome() {
    router.push("/");
  }

  /**
   * 刷新数据
   */
  function handleRefresh() {
    loadData();
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
              <span className="flex items-center gap-1 text-white font-medium">
                <Upload className="h-3 w-3" />
                <span>发布中心</span>
              </span>
            </nav>
          </div>

          {/* 右侧：页面信息和刷新按钮 */}
          <div className="flex items-center gap-4">
            {/* 数据统计提示 */}
            <div className="text-xs text-[#888]">
              共 {statistics.totalVideos} 个成片
            </div>

            {/* 刷新按钮 */}
            <button
              onClick={handleRefresh}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-[#888] transition-colors hover:bg-white/10 hover:text-white"
              aria-label="刷新数据"
              disabled={loading}
            >
              <span>{loading ? "加载中..." : "刷新"}</span>
            </button>
          </div>
        </div>

        {/* 页面标题和描述 */}
        <div className="mt-4">
          <h1 className="text-2xl font-bold text-white">
            发布中心
          </h1>
          <p className="mt-1 text-sm text-[#888]">
            管理成片与发布计划，追踪发布进度。支持多平台发布管理和成片预览下载。
          </p>
        </div>
      </header>

      {/* 页面主体：发布中心组件 */}
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