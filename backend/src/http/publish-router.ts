/**
 * 发布中心路由
 * 提供成片管理和发布计划管理功能
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import type { AppContext } from "../services/app.js";
import type { PublishedVideo, PublishPlan, PublishPlanStatus, PublishPlatform, VideoTask } from "../types.js";
import { id, nowIso } from "../utils.js";
import { rootLogger } from "../logger.js";

/** 发布计划状态列表 */
const publishPlanStatuses: PublishPlanStatus[] = ["draft", "scheduled", "publishing", "published", "failed", "cancelled"];

/** 发布平台列表 */
const publishPlatforms: PublishPlatform[] = ["youtube", "bilibili", "douyin", "tiktok", "kuaishou", "xiaohongshu", "weibo", "wechat", "custom"];

/**
 * 规范化发布计划状态
 */
function normalizePublishPlanStatus(status: unknown): PublishPlanStatus {
  return publishPlanStatuses.includes(status as PublishPlanStatus) ? status as PublishPlanStatus : "draft";
}

/**
 * 规范化发布平台列表
 */
function normalizePublishPlatforms(platforms: unknown): PublishPlatform[] {
  if (!Array.isArray(platforms)) return [];
  return platforms
    .filter((p): p is string => typeof p === "string")
    .filter((p) => publishPlatforms.includes(p as PublishPlatform))
    .map((p) => p as PublishPlatform);
}

/**
 * 规范化视频ID列表
 */
function normalizeVideoIds(videos: unknown): string[] {
  if (!Array.isArray(videos)) return [];
  return videos
    .filter((v): v is string => typeof v === "string" && v.length > 0);
}

/**
 * 根据会话ID获取项目ID
 */
async function getProjectIdByConversationId(ctx: AppContext, conversationId: string): Promise<string> {
  if (!conversationId) return "";
  const conversation = await ctx.conversations.findById(conversationId);
  return conversation?.project_id ?? "";
}

/**
 * 获取成片列表
 * 从已完成的视频任务中提取成片信息
 */
export async function listPublishedVideos(
  ctx: AppContext,
  filters: {
    projectId?: string;
    publishStatus?: "unpublished" | "scheduled" | "published";
  } = {}
): Promise<PublishedVideo[]> {
  // 获取所有已完成的视频任务
  const videoTasks = await ctx.videos.findMany({ status: "success" } as Partial<VideoTask>, { sort: "desc" });
  
  // 获取所有发布计划，用于判断视频的发布状态
  const publishPlans = await ctx.publishPlans.findMany({}, { sort: "desc" });
  
  // 构建视频ID到发布计划的映射
  const videoPlanMap = new Map<string, PublishPlan>();
  for (const plan of publishPlans) {
    for (const videoId of plan.videos) {
      videoPlanMap.set(videoId, plan);
    }
  }
  
  // 获取所有会话信息，用于查找项目ID
  const conversations = await ctx.conversations.findMany({}, { sort: "asc" });
  
  // 转换为成片信息
  const videos: PublishedVideo[] = [];
  for (const task of videoTasks) {
    // 获取项目ID
    const conversationId = task.conversation_id;
    const projectId = await getProjectIdByConversationId(ctx, conversationId);
    
    // 确定发布状态
    const plan = videoPlanMap.get(task.id);
    let publishStatus: "unpublished" | "scheduled" | "published" = "unpublished";
    let publishPlatforms: PublishPlatform[] = [];
    
    if (plan) {
      if (plan.status === "published") {
        publishStatus = "published";
        publishPlatforms = plan.platforms;
      } else if (plan.status === "scheduled" || plan.status === "publishing") {
        publishStatus = "scheduled";
        publishPlatforms = plan.platforms;
      }
    }
    
    // 计算时长
    const duration = task.seconds ? parseFloat(task.seconds) : 5;
    
    // 构建成片名称（使用prompt的前50个字符）
    const name = task.prompt.slice(0, 50) || `成片-${task.id}`;
    
    videos.push({
      id: task.id,
      name,
      projectId,
      duration,
      createdAt: task.created_at,
      publishStatus,
      publishPlatforms,
      videoUrl: task.video_url,
      prompt: task.prompt,
    });
  }
  
  // 应用筛选条件
  let filteredVideos = videos;
  
  // 项目筛选
  if (filters.projectId) {
    filteredVideos = filteredVideos.filter((video) => video.projectId === filters.projectId);
  }
  
  // 发布状态筛选
  if (filters.publishStatus) {
    filteredVideos = filteredVideos.filter((video) => video.publishStatus === filters.publishStatus);
  }
  
  return filteredVideos;
}

/**
 * 获取发布计划列表
 */
export async function listPublishPlans(
  ctx: AppContext,
  filters: {
    status?: PublishPlanStatus;
  } = {}
): Promise<PublishPlan[]> {
  let plans = await ctx.publishPlans.findMany({}, { sort: "desc" });
  
  // 状态筛选
  if (filters.status) {
    plans = plans.filter((plan) => plan.status === filters.status);
  }
  
  return plans;
}

/**
 * 创建发布计划
 */
export async function createPublishPlan(
  ctx: AppContext,
  input: {
    name?: string;
    status?: string;
    plannedDate?: string;
    videos?: unknown;
    platforms?: unknown;
    assignee?: string;
    notes?: string;
  }
): Promise<PublishPlan> {
  const now = nowIso();
  
  // 规范化输入
  const videoIds = normalizeVideoIds(input.videos);
  const platforms = normalizePublishPlatforms(input.platforms);
  
  // 验证视频是否存在且已完成
  for (const videoId of videoIds) {
    const task = await ctx.videos.findById(videoId);
    if (!task) {
      throw new Error(`视频任务 ${videoId} 不存在`);
    }
    if (task.status !== "success") {
      throw new Error(`视频任务 ${videoId} 未完成，无法添加到发布计划`);
    }
  }
  
  const plan: PublishPlan = {
    id: id("pub"),
    name: input.name?.trim() || "新发布计划",
    status: normalizePublishPlanStatus(input.status),
    plannedDate: input.plannedDate?.trim() || "",
    publishedDate: "",
    videos: videoIds,
    platforms,
    assignee: input.assignee?.trim() || "",
    notes: input.notes?.trim() || "",
    created_at: now,
    updated_at: now,
  };
  
  await ctx.publishPlans.insert(plan);
  return plan;
}

/**
 * 更新发布计划
 */
export async function updatePublishPlan(
  ctx: AppContext,
  planId: string,
  input: {
    name?: string;
    status?: string;
    plannedDate?: string;
    videos?: unknown;
    platforms?: unknown;
    assignee?: string;
    notes?: string;
  }
): Promise<PublishPlan> {
  const existing = await ctx.publishPlans.findById(planId);
  if (!existing) {
    throw new Error("发布计划不存在");
  }
  
  const now = nowIso();
  const next: Partial<PublishPlan> = { updated_at: now };
  
  // 更新字段
  if (typeof input.name === "string") {
    next.name = input.name.trim() || existing.name;
  }
  if (typeof input.status === "string") {
    next.status = normalizePublishPlanStatus(input.status);
    // 如果状态变为已发布，记录发布时间
    if (input.status === "published" && !existing.publishedDate) {
      next.publishedDate = now;
    }
  }
  if (typeof input.plannedDate === "string") {
    next.plannedDate = input.plannedDate.trim();
  }
  if (input.videos !== undefined) {
    const videoIds = normalizeVideoIds(input.videos);
    // 验证视频是否存在且已完成
    for (const videoId of videoIds) {
      const task = await ctx.videos.findById(videoId);
      if (!task) {
        throw new Error(`视频任务 ${videoId} 不存在`);
      }
      if (task.status !== "success") {
        throw new Error(`视频任务 ${videoId} 未完成，无法添加到发布计划`);
      }
    }
    next.videos = videoIds;
  }
  if (input.platforms !== undefined) {
    next.platforms = normalizePublishPlatforms(input.platforms);
  }
  if (typeof input.assignee === "string") {
    next.assignee = input.assignee.trim();
  }
  if (typeof input.notes === "string") {
    next.notes = input.notes.trim();
  }
  
  await ctx.publishPlans.update(planId, next);
  return (await ctx.publishPlans.findById(planId)) as PublishPlan;
}

/**
 * 删除发布计划
 */
export async function deletePublishPlan(ctx: AppContext, planId: string): Promise<void> {
  const existing = await ctx.publishPlans.findById(planId);
  if (!existing) {
    throw new Error("发布计划不存在");
  }
  await ctx.publishPlans.delete(planId);
}

/**
 * 读取JSON请求体
 */
async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) as Record<string, unknown> : {};
}

/**
 * 发送JSON响应
 */
function sendJsonResponse<T>(res: ServerResponse, data: T, status = 200): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify({ code: 0, message: "ok", data }));
}

/**
 * 发送错误响应
 */
function sendErrorResponse(res: ServerResponse, error: unknown, status = 400): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify({
    code: status === 404 ? 1004 : 1001,
    message: (error as Error).message ?? "error",
    data: null,
  }));
}

/**
 * 解析成片列表查询参数
 */
function parseVideoQueryParams(req: IncomingMessage): {
  projectId?: string;
  publishStatus?: "unpublished" | "scheduled" | "published";
} {
  const url = new URL(req.url ?? "/", "http://localhost");
  const searchParams = url.searchParams;
  
  const publishStatusValue = searchParams.get("publishStatus");
  const validStatuses = ["unpublished", "scheduled", "published"];
  
  return {
    projectId: searchParams.get("projectId") ?? undefined,
    publishStatus: publishStatusValue && validStatuses.includes(publishStatusValue)
      ? publishStatusValue as "unpublished" | "scheduled" | "published"
      : undefined,
  };
}

/**
 * 解析发布计划列表查询参数
 */
function parsePlanQueryParams(req: IncomingMessage): {
  status?: PublishPlanStatus;
} {
  const url = new URL(req.url ?? "/", "http://localhost");
  const searchParams = url.searchParams;
  
  const statusValue = searchParams.get("status");
  
  return {
    status: statusValue && publishPlanStatuses.includes(statusValue as PublishPlanStatus)
      ? statusValue as PublishPlanStatus
      : undefined,
  };
}

/**
 * 处理发布中心相关的HTTP请求
 */
export async function handlePublishRouter(
  ctx: AppContext,
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const method = req.method ?? "GET";
  const url = new URL(req.url ?? "/", "http://localhost");
  const pathname = url.pathname;
  
  try {
    // GET /api/publish/videos - 获取成片列表
    if (method === "GET" && pathname === "/api/publish/videos") {
      const params = parseVideoQueryParams(req);
      const videos = await listPublishedVideos(ctx, params);
      sendJsonResponse(res, videos);
      return;
    }
    
    // GET /api/publish/plans - 获取发布计划列表
    if (method === "GET" && pathname === "/api/publish/plans") {
      const params = parsePlanQueryParams(req);
      const plans = await listPublishPlans(ctx, params);
      sendJsonResponse(res, plans);
      return;
    }
    
    // POST /api/publish/plans - 创建发布计划
    if (method === "POST" && pathname === "/api/publish/plans") {
      const body = await readJsonBody(req);
      const plan = await createPublishPlan(ctx, {
        name: body.name as string,
        status: body.status as string,
        plannedDate: body.plannedDate as string,
        videos: body.videos,
        platforms: body.platforms,
        assignee: body.assignee as string,
        notes: body.notes as string,
      });
      sendJsonResponse(res, plan);
      return;
    }
    
    // PUT /api/publish/plans/:id - 更新发布计划
    if (method === "PUT" && pathname.startsWith("/api/publish/plans/") && pathname !== "/api/publish/plans") {
      const planId = pathname.replace("/api/publish/plans/", "");
      if (!planId) {
        sendErrorResponse(res, new Error("计划ID不能为空"));
        return;
      }
      const body = await readJsonBody(req);
      const plan = await updatePublishPlan(ctx, planId, {
        name: body.name as string,
        status: body.status as string,
        plannedDate: body.plannedDate as string,
        videos: body.videos,
        platforms: body.platforms,
        assignee: body.assignee as string,
        notes: body.notes as string,
      });
      sendJsonResponse(res, plan);
      return;
    }
    
    // DELETE /api/publish/plans/:id - 删除发布计划
    if (method === "DELETE" && pathname.startsWith("/api/publish/plans/") && pathname !== "/api/publish/plans") {
      const planId = pathname.replace("/api/publish/plans/", "");
      if (!planId) {
        sendErrorResponse(res, new Error("计划ID不能为空"));
        return;
      }
      await deletePublishPlan(ctx, planId);
      sendJsonResponse(res, { deleted: true });
      return;
    }
    
    // 未匹配的路由
    sendErrorResponse(res, new Error("未找到发布中心路由"), 404);
  } catch (error) {
    rootLogger.error({ event: "router.error", route: "publish", err: error }, `发布中心路由错误`);
    sendErrorResponse(res, error);
  }
}