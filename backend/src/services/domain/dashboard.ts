/**
 * @file dashboard.ts
 * @description 驾驶舱服务模块 - 提供项目概览、生产流水线、AI任务监控、成本分析等仪表盘数据
 */

import type { AppContext } from "../app.js";
import type { AITaskMonitor, CostBreakdown, DashboardData, DashboardKPI, ImageTask, ProductionHealth, ProductionPipeline, Project, ProjectClip, ProjectProgress, ProjectReview, ProjectScript, ProjectStoryboard, RecentGeneration, ResourceMonitorData, ReviewCenterData, TeamActivity, VideoTask } from "../../types.js";

/**
 * getDashboardKPI - 获取驾驶舱KPI数据
 * @param {AppContext} ctx - 应用上下文
 * @returns {Promise<DashboardKPI>} KPI数据
 */
export async function getDashboardKPI(ctx: AppContext): Promise<DashboardKPI> {
  const projects = await ctx.projects.findMany();
  const images = await ctx.images.findMany();
  const videos = await ctx.videos.findMany();

  const today = new Date().toISOString().slice(0, 10);
  const todayImages = images.filter((i: ImageTask) => i.created_at.slice(0, 10) === today && i.status === "success").length;
  const todayVideos = videos.filter((v: VideoTask) => v.created_at.slice(0, 10) === today && v.status === "success").length;
  const runningAITasks = images.filter((i: ImageTask) => i.status === "processing").length + videos.filter((v: VideoTask) => v.status === "processing").length;
  const activeProjects = projects.filter((p: Project) => p.status === "active" || p.status === "production").length;

  // 获取待审核数量 - 从所有项目的review中统计
  let pendingReviews = 0;
  for (const project of projects) {
    const reviews = await ctx.projectReviews.findMany({ project_id: project.id } as Partial<ProjectReview>);
    pendingReviews += reviews.filter((r: ProjectReview) => r.status === "open").length;
  }

  // 计算成功率
  const successImages = images.filter((i: ImageTask) => i.status === "success").length;
  const successVideos = videos.filter((v: VideoTask) => v.status === "success").length;
  const totalTasks = images.length + videos.length;
  const successRate = totalTasks > 0 ? Math.round((successImages + successVideos) / totalTasks * 100) : 100;

  // 未接入主机资源遥测时不伪造利用率。
  const gpuUtilization = 0;
  const todayCost = Math.round(todayImages * 0.5 + todayVideos * 2 + runningAITasks * 0.1);

  return {
    activeProjects,
    todayImages,
    todayVideos,
    runningAITasks,
    pendingReviews,
    gpuUtilization,
    resourceTelemetryAvailable: false,
    todayCost,
    successRate,
  };
}

/**
 * getProductionPipeline - 获取生产流水线数据
 * @param {AppContext} ctx - 应用上下文
 * @param {string} projectId - 项目ID（可选）
 * @returns {Promise<ProductionPipeline>} 流水线数据
 */
export async function getProductionPipeline(ctx: AppContext, projectId?: string): Promise<ProductionPipeline> {
  // 如果指定了项目，获取该项目的流水线，否则取第一个活跃项目
  const projects = await ctx.projects.findMany();
  const targetProject = projectId
    ? projects.find((p: Project) => p.id === projectId)
    : projects.find((p: Project) => p.status === "active" || p.status === "production") || projects[0];

  if (!targetProject) {
    return {
      stages: [
        { name: "剧本", status: "waiting", progress: 0 },
        { name: "Scene", status: "waiting", progress: 0 },
        { name: "Shot", status: "waiting", progress: 0 },
        { name: "图片", status: "waiting", progress: 0 },
        { name: "视频", status: "waiting", progress: 0 },
        { name: "配音", status: "waiting", progress: 0 },
        { name: "审核", status: "waiting", progress: 0 },
        { name: "发布", status: "waiting", progress: 0 },
      ],
    };
  }

  const scripts = await ctx.projectScripts.findMany({ project_id: targetProject.id } as Partial<ProjectScript>);
  const storyboards = await ctx.projectStoryboards.findMany({ project_id: targetProject.id } as Partial<ProjectStoryboard>);
  const reviews = await ctx.projectReviews.findMany({ project_id: targetProject.id } as Partial<ProjectReview>);
  const clips = await ctx.projectClips.findMany({ project_id: targetProject.id } as Partial<ProjectClip>);

  const scriptDone = scripts.filter((s: ProjectScript) => s.status === "storyboarded" || s.status === "archived").length;
  const scriptTotal = scripts.length || 1;

  const storyboardDraft = storyboards.filter((s: ProjectStoryboard) => s.status === "draft").length;
  const storyboardScripted = storyboards.filter((s: ProjectStoryboard) => s.status === "scripted").length;
  const storyboardImage = storyboards.filter((s: ProjectStoryboard) => s.status === "image").length;
  const storyboardVideo = storyboards.filter((s: ProjectStoryboard) => s.status === "video").length;
  const storyboardReview = storyboards.filter((s: ProjectStoryboard) => s.status === "review").length;
  const storyboardDone = storyboards.filter((s: ProjectStoryboard) => s.status === "done").length;
  const storyboardTotal = storyboards.length || 1;

  const reviewDone = reviews.filter((r: ProjectReview) => r.status === "resolved").length;
  const reviewTotal = reviews.length || 1;

  const clipDone = clips.filter((c: ProjectClip) => c.status === "done").length;
  const clipTotal = clips.length || 1;

  return {
    stages: [
      { name: "剧本", status: scriptDone >= scriptTotal ? "completed" : scriptDone > 0 ? "running" : "waiting", progress: Math.round(scriptDone / scriptTotal * 100), count: scriptDone },
      { name: "Scene", status: storyboardScripted + storyboardDone > 0 ? "running" : "waiting", progress: Math.round((storyboardScripted + storyboardDone) / storyboardTotal * 50), count: storyboardScripted },
      { name: "Shot", status: storyboardImage + storyboardVideo + storyboardDone > 0 ? "running" : "waiting", progress: Math.round((storyboardImage + storyboardVideo + storyboardDone) / storyboardTotal * 33), count: storyboardImage },
      { name: "图片", status: storyboardVideo + storyboardDone > 0 ? "running" : storyboardImage > 0 ? "running" : "waiting", progress: Math.round((storyboardVideo + storyboardDone) / storyboardTotal * 66), count: storyboardImage },
      { name: "视频", status: storyboardDone > 0 ? "running" : storyboardVideo > 0 ? "running" : "waiting", progress: Math.round(storyboardDone / storyboardTotal * 80), count: storyboardVideo },
      { name: "配音", status: storyboardDone > storyboardTotal * 0.5 ? "running" : "waiting", progress: Math.round(storyboardDone / storyboardTotal * 85) },
      { name: "审核", status: reviewDone >= reviewTotal ? "completed" : reviewDone > 0 ? "running" : "waiting", progress: Math.round(reviewDone / reviewTotal * 100), count: reviewDone },
      { name: "发布", status: clipDone >= clipTotal && clipTotal > 0 ? "completed" : clipDone > 0 ? "running" : "waiting", progress: Math.round(clipDone / clipTotal * 100), count: clipDone },
    ],
  };
}

/**
 * getMyProjects - 获取我的项目进度列表
 * @param {AppContext} ctx - 应用上下文
 * @returns {Promise<ProjectProgress[]>} 项目进度列表
 */
export async function getMyProjects(ctx: AppContext): Promise<ProjectProgress[]> {
  const projects = await ctx.projects.findMany();
  const result: ProjectProgress[] = [];

  for (const project of projects.slice(0, 6)) { // 最多返回6个项目
    const storyboards = await ctx.projectStoryboards.findMany({ project_id: project.id } as Partial<ProjectStoryboard>);
    const scripts = await ctx.projectScripts.findMany({ project_id: project.id } as Partial<ProjectScript>);

    // 找出当前进度
    const lastStoryboard = storyboards[storyboards.length - 1];
    const currentEpisode = lastStoryboard?.episode || scripts[0]?.episode || 1;
    const currentScene = lastStoryboard?.scene || "01";
    const currentShot = lastStoryboard?.shot || "01";

    // 计算总进度
    const doneStoryboards = storyboards.filter((s: ProjectStoryboard) => s.status === "done").length;
    const totalStoryboards = storyboards.length || 1;
    const totalProgress = Math.round(doneStoryboards / totalStoryboards * 100);

    // 确定当前阶段和AI状态
    const processingImages = await ctx.images.findMany();
    const processingVideos = await ctx.videos.findMany();
    const hasActiveImage = processingImages.some((i: ImageTask) => i.status === "processing");
    const hasActiveVideo = processingVideos.some((v: VideoTask) => v.status === "processing");

    let currentStage = "剧本";
    let aiStatus: "idle" | "generating" | "reviewing" | "failed" = "idle";

    if (storyboards.length > 0) {
      const latestStatus = lastStoryboard?.status || "draft";
      if (latestStatus === "draft") currentStage = "分镜";
      else if (latestStatus === "scripted") currentStage = "Scene";
      else if (latestStatus === "image") currentStage = "图片生成";
      else if (latestStatus === "video") currentStage = "视频生成";
      else if (latestStatus === "review") { currentStage = "审核"; aiStatus = "reviewing"; }
      else if (latestStatus === "done") currentStage = "完成";
    }

    if (hasActiveImage || hasActiveVideo) aiStatus = "generating";

    result.push({
      id: project.id,
      name: project.name,
      coverImage: undefined,
      currentEpisode,
      currentScene,
      currentShot,
      currentStage,
      totalProgress,
      aiStatus,
    });
  }

  return result;
}

/**
 * getAITasksMonitor - 获取AI任务监控列表
 * @param {AppContext} ctx - 应用上下文
 * @returns {Promise<AITaskMonitor[]>} AI任务监控数据
 */
export async function getAITasksMonitor(ctx: AppContext): Promise<AITaskMonitor[]> {
  const images = await ctx.images.findMany();
  const videos = await ctx.videos.findMany();

  const result: AITaskMonitor[] = [];

  // 图片任务
  for (const img of images.filter((i: ImageTask) => i.status === "processing").slice(0, 3)) {
    result.push({
      id: img.id,
      type: "image",
      title: img.prompt.slice(0, 30) + "...",
      model: "FLUX",
      status: "running",
      progress: 0,
      remainingTime: "处理中",
      created_at: img.created_at,
      project_id: img.conversation_id ?? "",
    });
  }

  // 视频任务
  for (const vid of videos.filter((v: VideoTask) => v.status === "processing").slice(0, 3)) {
    result.push({
      id: vid.id,
      type: "video",
      title: vid.prompt.slice(0, 30) + "...",
      model: "Veo",
      status: "running",
      progress: vid.progress || 0,
      remainingTime: "处理中",
      created_at: vid.created_at,
      project_id: vid.conversation_id ?? "",
    });
  }

  return result.slice(0, 5);
}

/**
 * getReviewCenter - 获取待审核中心数据
 * @param {AppContext} ctx - 应用上下文
 * @returns {Promise<ReviewCenterData>} 待审核数据
 */
export async function getReviewCenter(ctx: AppContext): Promise<ReviewCenterData> {
  const projects = await ctx.projects.findMany();
  let images = 0, videos = 0, scripts = 0, storyboards = 0;

  for (const project of projects) {
    const reviews = await ctx.projectReviews.findMany({ project_id: project.id } as Partial<ProjectReview>);
    const pendingReviews = reviews.filter((r: ProjectReview) => r.status === "open");
    images += pendingReviews.filter((r: ProjectReview) => r.target_type === "image").length;
    videos += pendingReviews.filter((r: ProjectReview) => r.target_type === "video").length;
    scripts += pendingReviews.filter((r: ProjectReview) => r.target_type === "storyboard" && r.target_id.includes("script")).length;
    storyboards += pendingReviews.filter((r: ProjectReview) => r.target_type === "storyboard").length;
  }

  return { images, videos, scripts, storyboards };
}

/**
 * getResourceMonitor - 获取资源监控数据
 * @param {AppContext} ctx - 应用上下文
 * @returns {Promise<ResourceMonitorData>} 资源监控数据
 */
export async function getResourceMonitor(ctx: AppContext): Promise<ResourceMonitorData> {
  const images = await ctx.images.findMany();
  const videos = await ctx.videos.findMany();

  const runningTasks = images.filter((i: ImageTask) => i.status === "processing").length + videos.filter((v: VideoTask) => v.status === "processing").length;

  return {
    gpuUsage: 0,
    cpuUsage: 0,
    queueLength: runningTasks,
    workerCount: 0,
    telemetryAvailable: false,
  };
}

/**
 * getCostBreakdown - 获取成本明细
 * @param {AppContext} ctx - 应用上下文
 * @returns {Promise<CostBreakdown>} 成本明细
 */
export async function getCostBreakdown(ctx: AppContext): Promise<CostBreakdown> {
  const images = await ctx.images.findMany();
  const videos = await ctx.videos.findMany();

  const today = new Date().toISOString().slice(0, 10);
  const todayImages = images.filter((i: ImageTask) => i.created_at.slice(0, 10) === today && i.status === "success").length;
  const todayVideos = videos.filter((v: VideoTask) => v.created_at.slice(0, 10) === today && v.status === "success").length;

  return {
    gpt: 0,
    claude: 0,
    images: Math.round(todayImages * 0.5),
    videos: Math.round(todayVideos * 2),
    total: Math.round(todayImages * 0.5 + todayVideos * 2),
  };
}

/**
 * getRecentGenerations - 获取最近生成列表
 * @param {AppContext} ctx - 应用上下文
 * @returns {Promise<RecentGeneration[]>} 最近生成列表
 */
export async function getRecentGenerations(ctx: AppContext): Promise<RecentGeneration[]> {
  const images = await ctx.images.findMany();
  const videos = await ctx.videos.findMany();

  const result: RecentGeneration[] = [];

  // 最近图片
  for (const img of images.filter((i: ImageTask) => i.status === "success").slice(0, 2)) {
    result.push({
      id: img.id,
      title: img.prompt.slice(0, 20) + "...",
      type: "character",
      status: "success",
      createdAt: img.created_at,
    });
  }

  // 最近视频
  for (const vid of videos.filter((v: VideoTask) => v.status === "success").slice(0, 2)) {
    result.push({
      id: vid.id,
      title: vid.prompt.slice(0, 20) + "...",
      type: "video",
      status: "success",
      createdAt: vid.created_at,
    });
  }

  return result.slice(0, 5);
}

/**
 * getTeamActivities - 获取团队动态
 * @param {AppContext} ctx - 应用上下文
 * @returns {Promise<TeamActivity[]>} 团队动态列表
 */
export async function getTeamActivities(ctx: AppContext): Promise<TeamActivity[]> {
  const logs = await ctx.appLogs.findMany({}, { sort: "desc", limit: 5 });
  return logs.map((log) => ({
    id: log.id,
    user: log.operator || "system",
    action: log.action,
    target: log.entity_id,
    createdAt: log.created_at,
  }));
}

/**
 * getProductionHealth - 获取生产健康度
 * @param {AppContext} ctx - 应用上下文
 * @returns {Promise<ProductionHealth>} 生产健康度数据
 */
export async function getProductionHealth(ctx: AppContext): Promise<ProductionHealth> {
  const images = await ctx.images.findMany();
  const videos = await ctx.videos.findMany();

  const failedImages = images.filter((i: ImageTask) => i.status === "failed").length;
  const failedVideos = videos.filter((v: VideoTask) => v.status === "failed").length;
  const totalTasks = images.length + videos.length;

  const failRate = totalTasks > 0 ? Math.round((failedImages + failedVideos) / totalTasks * 100 * 10) / 10 : 0;
  const imageSuccessRate = images.length > 0 ? Math.round(images.filter((item) => item.status === "success").length / images.length * 100) : 100;
  const videoSuccessRate = videos.length > 0 ? Math.round(videos.filter((item) => item.status === "success").length / videos.length * 100) : 100;

  return {
    overallScore: Math.max(0, Math.min(100, Math.round(100 - failRate * 5))),
    imageConsistency: imageSuccessRate,
    characterConsistency: videoSuccessRate,
    failRate,
    avgDuration: 0,
  };
}

/**
 * getDashboardData - 获取完整驾驶舱数据
 * @param {AppContext} ctx - 应用上下文
 * @param {string} projectId - 项目ID（可选）
 * @returns {Promise<DashboardData>} 完整驾驶舱数据
 */
export async function getDashboardData(ctx: AppContext, projectId?: string): Promise<DashboardData> {
  return {
    kpi: await getDashboardKPI(ctx),
    myProjects: await getMyProjects(ctx),
    pipeline: await getProductionPipeline(ctx, projectId),
    aiTasks: await getAITasksMonitor(ctx),
    reviewCenter: await getReviewCenter(ctx),
    resources: await getResourceMonitor(ctx),
    costs: await getCostBreakdown(ctx),
    recentGenerations: await getRecentGenerations(ctx),
    teamActivities: await getTeamActivities(ctx),
    health: await getProductionHealth(ctx),
  };
}
