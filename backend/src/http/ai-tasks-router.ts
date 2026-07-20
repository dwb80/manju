/**
 * @file ai-tasks-router.ts
 * @description AI 任务统一管理路由模块
 *
 * 提供跨项目的 AI 任务统一查询和管理能力：
 * - 任务列表查询（支持搜索、筛选、分页）
 * - 任务详情获取
 * - 批量取消任务
 * - 批量重试失败任务
 * - 单个任务删除
 *
 * 统一 ImageTask 和 VideoTask 为 AITask 格式，便于前端展示
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import type { AppContext } from "../services/app.js";
import type { ImageTask, VideoTask, TaskStatus } from "../types.js";
import { rootLogger } from "../logger.js";
import { readJsonBody } from "./http-utils.js";

/** 统一的AI任务类型，合并ImageTask和VideoTask */
export type AITaskType = "image" | "video";

/** 统一的AI任务响应格式 */
export interface AITask {
  id: string;
  type: AITaskType;
  prompt: string;
  status: TaskStatus;
  projectId: string;
  conversationId: string;
  createdAt: string;
  updatedAt: string;
  duration: number | null;
  model: string;
  error: string;
  /** 图片任务特有字段 */
  imageUrls?: string[];
  /** 视频任务特有字段 */
  videoUrl?: string;
  progress?: number;
  seconds?: string;
  size?: string;
}

/** AI任务列表查询参数 */
export interface AITaskQueryParams {
  /** 搜索关键词，匹配prompt字段 */
  q?: string;
  /** 任务类型筛选 */
  type?: AITaskType;
  /** 任务状态筛选 */
  status?: TaskStatus;
  /** 项目ID筛选 */
  projectId?: string;
  /** 会话ID筛选 */
  conversationId?: string;
  /** 创建时间起始范围 */
  startTime?: string;
  /** 创建时间结束范围 */
  endTime?: string;
  /** 分页页码 */
  page?: number;
  /** 每页数量 */
  pageSize?: number;
}

/** AI任务列表响应格式 */
export interface AITaskListResponse {
  tasks: AITask[];
  total: number;
  page: number;
  pageSize: number;
}

/** 批量操作请求体 */
export interface BatchOperationRequest {
  taskIds: string[];
}

/** 批量操作响应格式 */
export interface BatchOperationResponse {
  success: string[];
  failed: Array<{ id: string; error: string }>;
}

/** 当前用户对 AI 任务及其所属项目的访问上下文。 */
export interface AITaskAccessContext {
  userId: string;
  isAdmin: boolean;
  canAccessProject: (projectId: string) => Promise<boolean>;
}

function ownsTask(task: ImageTask | VideoTask, access: AITaskAccessContext): boolean {
  return task.user_id === access.userId || (!task.user_id && access.isAdmin);
}

async function canUseTask(
  ctx: AppContext,
  task: ImageTask | VideoTask,
  access: AITaskAccessContext,
): Promise<boolean> {
  if (!ownsTask(task, access)) return false;
  const projectId = await getProjectIdByConversationId(ctx, task.conversation_id);
  return !projectId || access.canAccessProject(projectId);
}

/**
 * convertImageTask - 将 ImageTask 转换为统一的 AITask 格式
 * @param {ImageTask} task - 图片任务对象
 * @param {string} projectId - 项目ID
 * @returns {AITask} 统一的 AI 任务格式
 */
function convertImageTask(task: ImageTask, projectId: string): AITask {
  return {
    id: task.id,
    type: "image",
    prompt: task.prompt,
    status: task.status,
    projectId,
    conversationId: task.conversation_id,
    createdAt: task.created_at,
    updatedAt: task.created_at, // ImageTask没有updated_at字段，使用created_at
    duration: null, // 图片任务没有duration概念
    model: "agnes-image", // 图片生成模型
    error: task.error,
    imageUrls: task.image_urls,
  };
}

/**
 * convertVideoTask - 将 VideoTask 转换为统一的 AITask 格式
 * @param {VideoTask} task - 视频任务对象
 * @param {string} projectId - 项目ID
 * @returns {AITask} 统一的 AI 任务格式
 */
function convertVideoTask(task: VideoTask, projectId: string): AITask {
  const duration = task.seconds ? parseFloat(task.seconds) : null;
  return {
    id: task.id,
    type: "video",
    prompt: task.prompt,
    status: task.status,
    projectId,
    conversationId: task.conversation_id,
    createdAt: task.created_at,
    updatedAt: task.created_at, // VideoTask没有updated_at字段，使用created_at
    duration,
    model: task.params.model || "agnes-video-v2.0",
    error: task.error,
    videoUrl: task.video_url,
    progress: task.progress,
    seconds: task.seconds,
    size: task.size,
  };
}

/**
 * getProjectIdByConversationId - 根据会话 ID 获取项目 ID
 * @param {AppContext} ctx - 应用上下文
 * @param {string} conversationId - 会话ID
 * @returns {Promise<string>} 项目ID
 */
async function getProjectIdByConversationId(ctx: AppContext, conversationId: string): Promise<string> {
  if (!conversationId) return "";
  const conversation = await ctx.conversations.findById(conversationId);
  return conversation?.project_id ?? "";
}

/**
 * listAITasks - 获取所有 AI 任务列表
 * @param {AppContext} ctx - 应用上下文
 * @param {AITaskQueryParams} params - 查询参数
 * @returns {Promise<AITaskListResponse>} 任务列表响应
 * @description 支持跨项目、跨会话查询，支持搜索、筛选和分页
 */
export async function listAITasks(
  ctx: AppContext,
  params: AITaskQueryParams,
  access: AITaskAccessContext,
): Promise<AITaskListResponse> {
  // 获取所有图片任务
  const imageTasks = await ctx.images.findMany({}, { sort: "desc" });
  // 获取所有视频任务
  const videoTasks = await ctx.videos.findMany({}, { sort: "desc" });
  // 获取所有会话信息，用于查找项目ID
  const conversations = await ctx.conversations.findMany({}, { sort: "asc" });

  // 转换任务格式
  const allTasks: AITask[] = [];

  // 处理图片任务
  for (const task of imageTasks) {
    if (!(await canUseTask(ctx, task, access))) continue;
    const conversationId = task.conversation_id || findConversationIdByTime(task.created_at, conversations);
    const projectId = await getProjectIdByConversationId(ctx, conversationId);
    allTasks.push(convertImageTask(task, projectId));
  }

  // 处理视频任务
  for (const task of videoTasks) {
    if (!(await canUseTask(ctx, task, access))) continue;
    const conversationId = task.conversation_id || findConversationIdByTime(task.created_at, conversations);
    const projectId = await getProjectIdByConversationId(ctx, conversationId);
    allTasks.push(convertVideoTask(task, projectId));
  }

  // 应用筛选条件
  let filteredTasks = allTasks;

  // 搜索筛选（匹配prompt）
  if (params.q && params.q.trim()) {
    const query = params.q.trim().toLowerCase();
    filteredTasks = filteredTasks.filter(task =>
      task.prompt.toLowerCase().includes(query)
    );
  }

  // 类型筛选
  if (params.type) {
    filteredTasks = filteredTasks.filter(task => task.type === params.type);
  }

  // 状态筛选
  if (params.status) {
    filteredTasks = filteredTasks.filter(task => task.status === params.status);
  }

  // 项目筛选
  if (params.projectId) {
    filteredTasks = filteredTasks.filter(task => task.projectId === params.projectId);
  }

  // 会话筛选
  if (params.conversationId) {
    filteredTasks = filteredTasks.filter(task => task.conversationId === params.conversationId);
  }

  // 时间范围筛选
  if (params.startTime) {
    const startTime = params.startTime;
    filteredTasks = filteredTasks.filter(task =>
      task.createdAt >= startTime
    );
  }
  if (params.endTime) {
    const endTime = params.endTime;
    filteredTasks = filteredTasks.filter(task =>
      task.createdAt <= endTime
    );
  }

  // 按创建时间排序（降序）
  filteredTasks.sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  // 分页
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  const total = filteredTasks.length;
  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedTasks = filteredTasks.slice(startIndex, endIndex);

  return {
    tasks: paginatedTasks,
    total,
    page,
    pageSize,
  };
}

/**
 * findConversationIdByTime - 根据时间查找会话 ID
 * @param {string} createdAt - 创建时间
 * @param {Array} conversations - 会话列表
 * @returns {string} 会话ID（简化实现，可能返回空字符串）
 */
function findConversationIdByTime(createdAt: string, conversations: Array<{ id: string; created_at: string; updated_at: string }>): string {
  // 这是一个简化的实现，实际可能需要更复杂的逻辑
  return "";
}

/**
 * getAITaskById - 获取单个 AI 任务详情
 * @param {AppContext} ctx - 应用上下文
 * @param {string} taskId - 任务ID
 * @returns {Promise<AITask | null>} 任务详情，不存在则返回 null
 */
export async function getAITaskById(ctx: AppContext, taskId: string, access: AITaskAccessContext): Promise<AITask | null> {
  // 尝试查找图片任务
  const imageTask = await ctx.images.findById(taskId);
  if (imageTask && await canUseTask(ctx, imageTask, access)) {
    const conversationId = imageTask.conversation_id;
    const projectId = await getProjectIdByConversationId(ctx, conversationId);
    return convertImageTask(imageTask, projectId);
  }

  // 尝试查找视频任务
  const videoTask = await ctx.videos.findById(taskId);
  if (videoTask && await canUseTask(ctx, videoTask, access)) {
    const conversationId = videoTask.conversation_id;
    const projectId = await getProjectIdByConversationId(ctx, conversationId);
    return convertVideoTask(videoTask, projectId);
  }

  return null;
}

/**
 * cancelAITasks - 批量取消任务
 * @param {AppContext} ctx - 应用上下文
 * @param {string[]} taskIds - 任务ID列表
 * @returns {Promise<BatchOperationResponse>} 操作结果
 * @description 将任务状态标记为 failed（无 cancelled 状态）
 */
export async function cancelAITasks(
  ctx: AppContext,
  taskIds: string[],
  access: AITaskAccessContext,
): Promise<BatchOperationResponse> {
  const success: string[] = [];
  const failed: Array<{ id: string; error: string }> = [];

  for (const taskId of taskIds) {
    try {
      // 尝试查找并取消图片任务
      const imageTask = await ctx.images.findById(taskId);
      if (imageTask) {
        if (!(await canUseTask(ctx, imageTask, access))) {
          failed.push({ id: taskId, error: "任务不存在" });
          continue;
        }
        if (imageTask.status === "pending" || imageTask.status === "processing") {
          await ctx.images.update(taskId, {
            status: "failed" as TaskStatus,
            error: "任务已手动取消"
          } as Partial<ImageTask>);
          success.push(taskId);
        } else {
          failed.push({ id: taskId, error: "任务已完成或已失败，无法取消" });
        }
        continue;
      }

      // 尝试查找并取消视频任务
      const videoTask = await ctx.videos.findById(taskId);
      if (videoTask) {
        if (!(await canUseTask(ctx, videoTask, access))) {
          failed.push({ id: taskId, error: "任务不存在" });
          continue;
        }
        if (videoTask.status === "pending" || videoTask.status === "processing") {
          await ctx.videos.update(taskId, {
            status: "failed" as TaskStatus,
            error: "任务已手动取消"
          } as Partial<VideoTask>);
          success.push(taskId);
        } else {
          failed.push({ id: taskId, error: "任务已完成或已失败，无法取消" });
        }
        continue;
      }

      failed.push({ id: taskId, error: "任务不存在" });
    } catch (error) {
      failed.push({
        id: taskId,
        error: (error as Error).message ?? "取消失败"
      });
    }
  }

  return { success, failed };
}

/**
 * retryAITasks - 批量重试失败任务
 * @param {AppContext} ctx - 应用上下文
 * @param {string[]} taskIds - 任务ID列表
 * @returns {Promise<BatchOperationResponse>} 操作结果
 * @description 只重置任务状态，实际重新生成需要前端重新发起请求
 */
export async function retryAITasks(
  ctx: AppContext,
  taskIds: string[],
  access: AITaskAccessContext,
): Promise<BatchOperationResponse> {
  const success: string[] = [];
  const failed: Array<{ id: string; error: string }> = [];

  for (const taskId of taskIds) {
    try {
      // 尝试查找并重试图片任务
      const imageTask = await ctx.images.findById(taskId);
      if (imageTask) {
        if (!(await canUseTask(ctx, imageTask, access))) {
          failed.push({ id: taskId, error: "任务不存在" });
          continue;
        }
        if (imageTask.status === "failed") {
          // 这里只是标记为pending，实际重新生成需要前端重新调用generateImage API
          await ctx.images.update(taskId, {
            status: "pending" as TaskStatus,
            error: ""
          } as Partial<ImageTask>);
          success.push(taskId);
        } else {
          failed.push({ id: taskId, error: "只有失败的任务可以重试" });
        }
        continue;
      }

      // 尝试查找并重试视频任务
      const videoTask = await ctx.videos.findById(taskId);
      if (videoTask) {
        if (!(await canUseTask(ctx, videoTask, access))) {
          failed.push({ id: taskId, error: "任务不存在" });
          continue;
        }
        if (videoTask.status === "failed") {
          // 这里只是标记为pending，实际重新生成需要前端重新调用generateVideo API
          await ctx.videos.update(taskId, {
            status: "pending" as TaskStatus,
            error: ""
          } as Partial<VideoTask>);
          success.push(taskId);
        } else {
          failed.push({ id: taskId, error: "只有失败的任务可以重试" });
        }
        continue;
      }

      failed.push({ id: taskId, error: "任务不存在" });
    } catch (error) {
      failed.push({
        id: taskId,
        error: (error as Error).message ?? "重试失败"
      });
    }
  }

  return { success, failed };
}

/**
 * deleteAITask - 删除单个 AI 任务
 * @param {AppContext} ctx - 应用上下文
 * @param {string} taskId - 任务ID
 * @returns {Promise<boolean>} 是否删除成功
 */
export async function deleteAITask(ctx: AppContext, taskId: string, access: AITaskAccessContext): Promise<boolean> {
  // 尝试删除图片任务
  const imageTask = await ctx.images.findById(taskId);
  if (imageTask && await canUseTask(ctx, imageTask, access)) {
    await ctx.images.delete(taskId);
    return true;
  }

  // 尝试删除视频任务
  const videoTask = await ctx.videos.findById(taskId);
  if (videoTask && await canUseTask(ctx, videoTask, access)) {
    await ctx.videos.delete(taskId);
    return true;
  }

  return false;
}

/**
 * parseQueryParams - 解析查询参数
 * @param {IncomingMessage} req - HTTP 请求对象
 * @returns {AITaskQueryParams} 查询参数对象
 */
function parseQueryParams(req: IncomingMessage): AITaskQueryParams {
  const url = new URL(req.url ?? "/", "http://localhost");
  const searchParams = url.searchParams;

  return {
    q: searchParams.get("q") ?? undefined,
    type: (searchParams.get("type") as AITaskType) ?? undefined,
    status: (searchParams.get("status") as TaskStatus) ?? undefined,
    projectId: searchParams.get("projectId") ?? undefined,
    conversationId: searchParams.get("conversationId") ?? undefined,
    startTime: searchParams.get("startTime") ?? undefined,
    endTime: searchParams.get("endTime") ?? undefined,
    page: searchParams.get("page") ? parseInt(searchParams.get("page")!, 10) : undefined,
    pageSize: searchParams.get("pageSize") ? parseInt(searchParams.get("pageSize")!, 10) : undefined,
  };
}

/**
 * sendJsonResponse - 发送 JSON 响应
 * @param {ServerResponse} res - HTTP 响应对象
 * @param {T} data - 响应数据
 * @param {number} status - HTTP 状态码，默认 200
 * @returns {void}
 */
function sendJsonResponse<T>(res: ServerResponse, data: T, status = 200): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify({ code: 0, message: "ok", data }));
}

/**
 * sendErrorResponse - 发送错误响应
 * @param {ServerResponse} res - HTTP 响应对象
 * @param {unknown} error - 错误对象
 * @param {number} status - HTTP 状态码，默认 400
 * @returns {void}
 */
function sendErrorResponse(res: ServerResponse, error: unknown, status = 400): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify({
    code: status === 404 ? 1004 : 1001,
    message: (error as Error).message ?? "error",
    data: null
  }));
}

/**
 * handleAITasksRouter - 处理 AI 任务相关的 HTTP 请求
 * @param {AppContext} ctx - 应用上下文
 * @param {IncomingMessage} req - HTTP 请求对象
 * @param {ServerResponse} res - HTTP 响应对象
 * @returns {Promise<void>}
 */
export async function handleAITasksRouter(
  ctx: AppContext,
  req: IncomingMessage,
  res: ServerResponse,
  access: AITaskAccessContext,
): Promise<void> {
  const method = req.method ?? "GET";
  const url = new URL(req.url ?? "/", "http://localhost");
  const pathname = url.pathname;

  try {
    // GET /api/ai/tasks - 获取所有AI任务列表
    if (method === "GET" && pathname === "/api/ai/tasks") {
      const params = parseQueryParams(req);
      const result = await listAITasks(ctx, params, access);
      sendJsonResponse(res, result);
      return;
    }

    // GET /api/ai/tasks/:id - 获取单个AI任务详情
    if (method === "GET" && pathname.startsWith("/api/ai/tasks/") && pathname !== "/api/ai/tasks/cancel" && pathname !== "/api/ai/tasks/retry") {
      const taskId = pathname.replace("/api/ai/tasks/", "");
      const task = await getAITaskById(ctx, taskId, access);
      if (!task) {
        sendErrorResponse(res, new Error("任务不存在"), 404);
        return;
      }
      sendJsonResponse(res, task);
      return;
    }

    // POST /api/ai/tasks/cancel - 批量取消任务
    if (method === "POST" && pathname === "/api/ai/tasks/cancel") {
      const body = await readJsonBody(req);
      const taskIds = Array.isArray(body.taskIds)
        ? body.taskIds.filter((id): id is string => typeof id === "string" && id.length > 0)
        : [];

      if (taskIds.length === 0) {
        sendErrorResponse(res, new Error("taskIds不能为空"));
        return;
      }

      const result = await cancelAITasks(ctx, taskIds, access);
      sendJsonResponse(res, result);
      return;
    }

    // POST /api/ai/tasks/retry - 批量重试失败任务
    if (method === "POST" && pathname === "/api/ai/tasks/retry") {
      const body = await readJsonBody(req);
      const taskIds = Array.isArray(body.taskIds)
        ? body.taskIds.filter((id): id is string => typeof id === "string" && id.length > 0)
        : [];

      if (taskIds.length === 0) {
        sendErrorResponse(res, new Error("taskIds不能为空"));
        return;
      }

      const result = await retryAITasks(ctx, taskIds, access);
      sendJsonResponse(res, result);
      return;
    }

    // DELETE /api/ai/tasks/:id - 删除单个任务
    if (method === "DELETE" && pathname.startsWith("/api/ai/tasks/") && pathname !== "/api/ai/tasks/cancel" && pathname !== "/api/ai/tasks/retry") {
      const taskId = pathname.replace("/api/ai/tasks/", "");
      const deleted = await deleteAITask(ctx, taskId, access);
      if (!deleted) {
        sendErrorResponse(res, new Error("任务不存在"), 404);
        return;
      }
      sendJsonResponse(res, { deleted: true });
      return;
    }

    // 未匹配的路由
    sendErrorResponse(res, new Error("未找到AI任务路由"), 404);
  } catch (error) {
    rootLogger.error({ event: "router.error", route: "ai-tasks", err: error }, `AI任务路由错误`);
    sendErrorResponse(res, error);
  }
}
